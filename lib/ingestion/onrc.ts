import { parse } from "csv-parse"
import { Readable } from "stream"
import { db } from "@/lib/db"
import { companies, syncJobs } from "@/lib/db/schema"
import { sql, eq } from "drizzle-orm"

const CKAN_PACKAGE_ID = "firme-inregistrate-la-registrul-comertului"
const CKAN_API = "https://data.gov.ro/api/3/action/package_show"
const INSERT_CHUNK = 500 // rows per DB insert batch

async function getLatestCsvUrl(): Promise<string> {
  const res = await fetch(`${CKAN_API}?id=${CKAN_PACKAGE_ID}`)
  const json = await res.json()
  const resources = json.result?.resources ?? []
  const csv = resources.find((r: { format: string; url: string }) => r.format?.toLowerCase() === "csv")
  if (!csv) throw new Error("No CSV resource found in ONRC dataset")
  return csv.url
}

async function parseCsv(text: string): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const rows: Record<string, string>[] = []
    const parser = parse({ columns: true, skip_empty_lines: true, trim: true, bom: true })
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
    // Download CSV once
    const csvUrl = await getLatestCsvUrl()
    const res = await fetch(csvUrl)
    if (!res.ok) throw new Error(`Failed to fetch CSV: ${res.status}`)
    const text = await res.text()

    // Parse entire file in memory (fits easily in Vercel's 2GB limit)
    const records = await parseCsv(text)

    // Upsert in chunks of 500 to stay within Neon's query size limits
    for (let i = 0; i < records.length; i += INSERT_CHUNK) {
      const chunk = records.slice(i, i + INSERT_CHUNK)
      const values = chunk
        .map((r) => ({
          cui: (r.CUI || r.cui || "").replace(/^RO/, "").trim(),
          jNumber: r.NR_REG_COM || r.j_number || null,
          name: r.DENUMIRE || r.name || "",
          status: mapStatus(r.STARE_FIRMA || r.status || ""),
          legalForm: r.FORMA_JURIDICA || null,
          county: r.JUDET || r.county || null,
          city: r.LOCALITATE || r.city || null,
          address: r.ADRESA || null,
          caenCode: r.COD_CAEN || null,
          caenDescription: r.DEN_CAEN || null,
          registrationDate: parseDate(r.DATA_INREGISTRARE),
          companyScore: 0,
          lastOnrcSyncAt: new Date(),
          updatedAt: new Date(),
        }))
        .filter((v) => v.cui)

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

      // Update progress every 10 chunks so admin can watch it climb
      if ((i / INSERT_CHUNK) % 10 === 0) {
        await db.update(syncJobs).set({ rowsProcessed }).where(eq(syncJobs.id, jobId))
      }
    }

    // Build search vectors for all newly synced companies
    await db.execute(
      sql`UPDATE companies
          SET search_vector = to_tsvector('simple',
            coalesce(name,'') || ' ' || coalesce(cui,'') || ' ' || coalesce(city,''))
          WHERE search_vector IS NULL`
    )

    await db
      .update(syncJobs)
      .set({ status: "done", finishedAt: new Date(), rowsProcessed })
      .where(eq(syncJobs.id, jobId))
  } catch (err) {
    await db
      .update(syncJobs)
      .set({ status: "failed", finishedAt: new Date(), rowsProcessed, errorMsg: String(err) })
      .where(eq(syncJobs.id, jobId))
    throw err
  }
}

// Keep export name consistent with cron route
export { startOnrcImport as runOnrcImport }

function mapStatus(raw: string): string {
  const s = raw.toLowerCase()
  if (s.includes("activ")) return "activa"
  if (s.includes("radiat")) return "radiata"
  return "inactiva"
}

function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}
