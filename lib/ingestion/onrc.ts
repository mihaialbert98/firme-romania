import { parse } from "csv-parse"
import { Readable } from "stream"
import { db } from "@/lib/db"
import { companies, syncJobs } from "@/lib/db/schema"
import { sql, eq } from "drizzle-orm"

const CKAN_SEARCH = "https://data.gov.ro/api/3/action/package_search"
const INSERT_CHUNK = 500

interface DatasetUrls {
  firme: string
  stare: string
}

// Find the latest monthly ONRC dataset and return the two CSV URLs we need
async function getLatestUrls(): Promise<DatasetUrls> {
  const res = await fetch(
    `${CKAN_SEARCH}?q=firme+registrul+comertului&rows=1&sort=metadata_modified+desc`,
    { signal: AbortSignal.timeout(10000) }
  )
  if (!res.ok) throw new Error(`CKAN search failed: ${res.status}`)
  const json = await res.json()
  const results = json.result?.results ?? []
  if (!results.length) throw new Error("No ONRC datasets found on data.gov.ro")

  const latestId: string = results[0].name
  const detail = await fetch(`https://data.gov.ro/api/3/action/package_show?id=${latestId}`, {
    signal: AbortSignal.timeout(10000),
  })
  const detailJson = await detail.json()
  const resources: { url: string }[] = detailJson.result?.resources ?? []

  const firme = resources.find((r) => r.url.endsWith("od_firme.csv"))?.url
  const stare = resources.find((r) => r.url.endsWith("od_stare_firma.csv"))?.url
  if (!firme) throw new Error("od_firme.csv not found in latest ONRC dataset")
  if (!stare) throw new Error("od_stare_firma.csv not found in latest ONRC dataset")

  return { firme, stare }
}

async function fetchCsv(url: string): Promise<Record<string, string>[]> {
  const res = await fetch(url, { signal: AbortSignal.timeout(120000) })
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  const text = await res.text()

  return new Promise((resolve, reject) => {
    const rows: Record<string, string>[] = []
    const parser = parse({ columns: true, skip_empty_lines: true, trim: true, bom: true, delimiter: "^" })
    parser.on("readable", () => {
      let r: Record<string, string>
      while ((r = parser.read()) !== null) rows.push(r)
    })
    parser.on("error", reject)
    parser.on("end", () => resolve(rows))
    Readable.from(text).pipe(parser)
  })
}

export async function startOnrcImport(jobId: number): Promise<void> {
  await db.update(syncJobs).set({ status: "running", startedAt: new Date() }).where(eq(syncJobs.id, jobId))

  let rowsProcessed = 0
  try {
    const urls = await getLatestUrls()

    // Load status lookup: COD_INMATRICULARE -> status code
    const stareRows = await fetchCsv(urls.stare)
    const stareMap = new Map<string, string>()
    for (const r of stareRows) {
      if (r.COD_INMATRICULARE) stareMap.set(r.COD_INMATRICULARE.trim(), r.COD ?? "")
    }

    // Load main companies file
    const firmeRows = await fetchCsv(urls.firme)

    // Upsert in chunks of 500
    for (let i = 0; i < firmeRows.length; i += INSERT_CHUNK) {
      const chunk = firmeRows.slice(i, i + INSERT_CHUNK)
      const values = chunk
        .map((r) => {
          const cui = (r.CUI ?? "").replace(/^RO/, "").trim()
          const jNumber = (r.COD_INMATRICULARE ?? "").trim() || null
          const statusCode = jNumber ? stareMap.get(jNumber) : undefined
          const address = [
            r.ADR_DEN_STRADA,
            r.ADR_NR_STRADA,
            r.ADR_BLOC ? `Bl. ${r.ADR_BLOC}` : "",
            r.ADR_SCARA ? `Sc. ${r.ADR_SCARA}` : "",
            r.ADR_APARTAMENT ? `Ap. ${r.ADR_APARTAMENT}` : "",
            r.ADR_SECTOR ? `Sector ${r.ADR_SECTOR}` : "",
          ].filter(Boolean).join(", ") || null

          return {
            cui: cui || `_${jNumber}`,  // fallback key for CUI=0 entries
            jNumber,
            name: (r.DENUMIRE ?? "").trim(),
            status: mapStatusCode(statusCode),
            legalForm: (r.FORMA_JURIDICA ?? "").trim() || null,
            county: (r.ADR_JUDET ?? "").trim() || null,
            city: (r.ADR_LOCALITATE ?? "").trim() || null,
            address,
            caenCode: null,
            caenDescription: null,
            registrationDate: parseDate(r.DATA_INMATRICULARE),
            companyScore: 0,
            lastOnrcSyncAt: new Date(),
            updatedAt: new Date(),
          }
        })
        .filter((v) => v.name)

      if (!values.length) continue

      await db
        .insert(companies)
        .values(values)
        .onConflictDoUpdate({
          target: companies.cui,
          set: {
            name: sql`EXCLUDED.name`,
            status: sql`EXCLUDED.status`,
            legalForm: sql`EXCLUDED.legal_form`,
            county: sql`EXCLUDED.county`,
            city: sql`EXCLUDED.city`,
            address: sql`EXCLUDED.address`,
            caenCode: sql`EXCLUDED.caen_code`,
            caenDescription: sql`EXCLUDED.caen_description`,
            registrationDate: sql`EXCLUDED.registration_date`,
            jNumber: sql`EXCLUDED.j_number`,
            lastOnrcSyncAt: sql`EXCLUDED.last_onrc_sync_at`,
            updatedAt: sql`EXCLUDED.updated_at`,
          },
        })

      rowsProcessed += values.length

      // Update progress every 10k rows
      if (rowsProcessed % 10000 < INSERT_CHUNK) {
        await db.update(syncJobs).set({ rowsProcessed }).where(eq(syncJobs.id, jobId))
      }
    }

    // Build search vectors
    await db.execute(
      sql`UPDATE companies
          SET search_vector = to_tsvector('simple',
            coalesce(name,'') || ' ' || coalesce(cui,'') || ' ' || coalesce(city,''))
          WHERE search_vector IS NULL`
    )

    await db.update(syncJobs)
      .set({ status: "done", finishedAt: new Date(), rowsProcessed })
      .where(eq(syncJobs.id, jobId))
  } catch (err) {
    await db.update(syncJobs)
      .set({ status: "failed", finishedAt: new Date(), rowsProcessed, errorMsg: String(err) })
      .where(eq(syncJobs.id, jobId))
    throw err
  }
}

// Status codes from od_stare_firma.csv: 1048 = active, 1084 = dissolved/inactive
function mapStatusCode(code: string | undefined): string {
  if (!code) return "activa"
  if (code === "1048") return "activa"
  if (code === "1084" || code === "1085") return "radiata"
  return "inactiva"
}

function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null
  // Format: DD/MM/YYYY
  const parts = raw.trim().split("/")
  if (parts.length === 3) {
    const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
    return isNaN(d.getTime()) ? null : d
  }
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}
