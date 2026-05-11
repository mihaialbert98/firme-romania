import { parse } from "csv-parse"
import { db } from "@/lib/db"
import { companies, syncJobs } from "@/lib/db/schema"
import { sql, eq } from "drizzle-orm"

const CKAN_SEARCH = "https://data.gov.ro/api/3/action/package_search"
const INSERT_CHUNK = 200

interface DatasetUrls {
  firme: string
  stare: string
}

async function getLatestUrls(): Promise<DatasetUrls> {
  const res = await fetch(
    `${CKAN_SEARCH}?q=firme+registrul+comertului&rows=1&sort=metadata_modified+desc`,
    { signal: AbortSignal.timeout(30000) }
  )
  if (!res.ok) throw new Error(`CKAN search failed: ${res.status}`)
  const json = await res.json()
  const results = json.result?.results ?? []
  if (!results.length) throw new Error("No ONRC datasets found on data.gov.ro")

  const latestId: string = results[0].name
  const detail = await fetch(`https://data.gov.ro/api/3/action/package_show?id=${latestId}`, {
    signal: AbortSignal.timeout(30000),
  })
  const detailJson = await detail.json()
  const resources: { url: string }[] = detailJson.result?.resources ?? []

  const firme = resources.find((r) => r.url.endsWith("od_firme.csv"))?.url
  const stare = resources.find((r) => r.url.endsWith("od_stare_firma.csv"))?.url
  if (!firme) throw new Error("od_firme.csv not found in latest ONRC dataset")
  if (!stare) throw new Error("od_stare_firma.csv not found in latest ONRC dataset")

  return { firme, stare }
}

// Fetch smaller stare file fully into memory for lookup
async function loadStareMap(): Promise<Map<string, string>> {
  const urls = await getLatestUrls()
  const res = await fetch(urls.stare)
  if (!res.ok) throw new Error(`Failed to fetch stare: ${res.status}`)
  const text = await res.text()

  const map = new Map<string, string>()
  const lines = text.split("\n").slice(1) // skip header
  for (const line of lines) {
    const [cod, status] = line.split("^")
    if (cod?.trim()) map.set(cod.trim(), (status ?? "").trim())
  }
  return map
}

export async function startOnrcImport(jobId: number): Promise<void> {
  await db.update(syncJobs).set({ status: "running", startedAt: new Date() }).where(eq(syncJobs.id, jobId))

  let rowsProcessed = 0
  try {
    const urls = await getLatestUrls()

    // Load status lookup (small file ~30MB)
    const stareRes = await fetch(urls.stare)
    if (!stareRes.ok) throw new Error(`Failed to fetch stare: ${stareRes.status}`)
    const stareText = await stareRes.text()
    const stareMap = new Map<string, string>()
    for (const line of stareText.split("\n").slice(1)) {
      const [cod, status] = line.split("^")
      if (cod?.trim()) stareMap.set(cod.trim(), (status ?? "").trim())
    }

    // Stream the large firme CSV and process row by row
    const firmeRes = await fetch(urls.firme)
    if (!firmeRes.ok) throw new Error(`Failed to fetch firme: ${firmeRes.status}`)
    if (!firmeRes.body) throw new Error("No response body")

    type MappedRow = NonNullable<ReturnType<typeof mapRow>>
  let buffer: MappedRow[] = []

    await new Promise<void>((resolve, reject) => {
      const parser = parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
        delimiter: "^",
      })

      parser.on("readable", async () => {
        let record: Record<string, string>
        while ((record = parser.read()) !== null) {
          const row = mapRow(record, stareMap)
          if (row) buffer.push(row as MappedRow)

          if (buffer.length >= INSERT_CHUNK) {
            parser.pause()
            const chunk = buffer.splice(0, INSERT_CHUNK)
            try {
              await insertChunk(chunk)
              rowsProcessed += chunk.length
              if (rowsProcessed % 5000 < INSERT_CHUNK) {
                await db.update(syncJobs).set({ rowsProcessed }).where(eq(syncJobs.id, jobId))
              }
            } catch (e) {
              reject(e)
              return
            }
            parser.resume()
          }
        }
      })

      parser.on("end", async () => {
        // Flush remaining rows
        if (buffer.length) {
          try {
            await insertChunk(buffer)
            rowsProcessed += buffer.length
            buffer = []
          } catch (e) { reject(e); return }
        }
        resolve()
      })

      parser.on("error", reject)

      // Pipe Node.js readable stream from fetch body
      const reader = firmeRes.body!.getReader()
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) { parser.end(); break }
            parser.write(Buffer.from(value))
          }
        } catch (e) { reject(e) }
      }
      pump()
    })

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

type MappedRow = NonNullable<ReturnType<typeof mapRow>>

async function insertChunk(values: MappedRow[]) {
  const clean = values.filter(Boolean) as MappedRow[]
  if (!clean.length) return
  await db.insert(companies).values(clean).onConflictDoUpdate({
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
}

function mapRow(r: Record<string, string>, stareMap: Map<string, string>) {
  const name = (r.DENUMIRE ?? "").trim()
  if (!name) return null

  const cui = (r.CUI ?? "").replace(/^RO/, "").trim()
  const jNumber = (r.COD_INMATRICULARE ?? "").trim() || null
  if (!cui && !jNumber) return null

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
    cui: cui || `_${jNumber}`,
    jNumber,
    name,
    status: mapStatusCode(statusCode),
    legalForm: (r.FORMA_JURIDICA ?? "").trim() || null,
    county: (r.ADR_JUDET ?? "").trim() || null,
    city: (r.ADR_LOCALITATE ?? "").trim() || null,
    address,
    caenCode: null as null,
    caenDescription: null as null,
    registrationDate: parseDate(r.DATA_INMATRICULARE),
    companyScore: 0,
    lastOnrcSyncAt: new Date(),
    updatedAt: new Date(),
  }
}

function mapStatusCode(code: string | undefined): string {
  if (!code) return "activa"
  if (code === "1048") return "activa"
  if (code === "1084" || code === "1085") return "radiata"
  return "inactiva"
}

function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null
  const parts = raw.trim().split("/")
  if (parts.length === 3) {
    const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
    return isNaN(d.getTime()) ? null : d
  }
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}
