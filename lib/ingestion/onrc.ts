import { parse } from "csv-parse"
import { Readable } from "stream"
import { db } from "@/lib/db"
import { companies, syncJobs } from "@/lib/db/schema"
import { sql, eq } from "drizzle-orm"
import { computeScore } from "@/lib/scoring"

const CKAN_PACKAGE_ID = "firme-inregistrate-la-registrul-comertului"
const CKAN_API = "https://data.gov.ro/api/3/action/package_show"

async function getLatestCsvUrl(): Promise<string> {
  const res = await fetch(`${CKAN_API}?id=${CKAN_PACKAGE_ID}`)
  const json = await res.json()
  const resources = json.result?.resources ?? []
  const csv = resources.find((r: { format: string; url: string }) => r.format?.toLowerCase() === "csv")
  if (!csv) throw new Error("No CSV resource found in ONRC dataset")
  return csv.url
}

export async function runOnrcImport(jobId: number): Promise<void> {
  await db.update(syncJobs).set({ status: "running", startedAt: new Date() }).where(eq(syncJobs.id, jobId))

  let rowsProcessed = 0
  try {
    const csvUrl = await getLatestCsvUrl()
    const res = await fetch(csvUrl)
    if (!res.ok) throw new Error(`Failed to fetch CSV: ${res.status}`)
    const text = await res.text()

    const records: Record<string, string>[] = await new Promise((resolve, reject) => {
      const rows: Record<string, string>[] = []
      const parser = parse({ columns: true, skip_empty_lines: true, trim: true, bom: true })
      parser.on("readable", () => {
        let record: Record<string, string>
        while ((record = parser.read()) !== null) rows.push(record)
      })
      parser.on("error", reject)
      parser.on("end", () => resolve(rows))
      Readable.from(text).pipe(parser)
    })

    const CHUNK = 500
    for (let i = 0; i < records.length; i += CHUNK) {
      const chunk = records.slice(i, i + CHUNK)
      const values = chunk.map((r) => ({
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
      })).filter((v) => v.cui)

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
    }

    // update search vectors in bulk
    await db.execute(
      sql`UPDATE companies SET search_vector = to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(cui,'') || ' ' || coalesce(city,''))
          WHERE search_vector IS NULL OR last_onrc_sync_at > updated_at - interval '1 hour'`
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
