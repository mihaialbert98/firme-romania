import { parse } from "csv-parse"
import { Readable } from "stream"
import { db } from "@/lib/db"
import { companies, syncJobs } from "@/lib/db/schema"
import { sql, eq } from "drizzle-orm"

const CKAN_PACKAGE_ID = "firme-inregistrate-la-registrul-comertului"
const CKAN_API = "https://data.gov.ro/api/3/action/package_show"
const BATCH_SIZE = 1000 // rows per invocation
const MAX_MS = 7000     // stop before Vercel's 10s limit

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

// Called once to kick off — downloads CSV, stores URL, starts first batch
export async function startOnrcImport(jobId: number): Promise<void> {
  try {
    const csvUrl = await getLatestCsvUrl()
    await db.update(syncJobs).set({ status: "running", startedAt: new Date(), csvUrl, currentOffset: 0 }).where(eq(syncJobs.id, jobId))
    await processOnrcBatch(jobId)
  } catch (err) {
    await db.update(syncJobs).set({ status: "failed", finishedAt: new Date(), errorMsg: String(err) }).where(eq(syncJobs.id, jobId))
  }
}

// Processes one batch starting at stored offset, then re-triggers itself
export async function processOnrcBatch(jobId: number): Promise<void> {
  const [job] = await db.select().from(syncJobs).where(eq(syncJobs.id, jobId)).limit(1)
  if (!job || !job.csvUrl) return

  const offset = job.currentOffset ?? 0
  const started = Date.now()

  try {
    const res = await fetch(job.csvUrl)
    if (!res.ok) throw new Error(`Failed to fetch CSV: ${res.status}`)
    const text = await res.text()
    const records = await parseCsv(text)

    const batch = records.slice(offset, offset + BATCH_SIZE)
    if (!batch.length) {
      // All done — update search vectors and mark complete
      await db.execute(
        sql`UPDATE companies SET search_vector = to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(cui,'') || ' ' || coalesce(city,''))
            WHERE search_vector IS NULL`
      )
      await db.update(syncJobs).set({ status: "done", finishedAt: new Date() }).where(eq(syncJobs.id, jobId))
      return
    }

    const values = batch.map((r) => ({
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

    if (values.length) {
      await db.insert(companies).values(values).onConflictDoUpdate({
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

    const newOffset = offset + BATCH_SIZE
    const newTotal = (job.rowsProcessed ?? 0) + values.length
    await db.update(syncJobs).set({ currentOffset: newOffset, rowsProcessed: newTotal }).where(eq(syncJobs.id, jobId))

    // Re-trigger next batch via internal API (bypasses serverless timeout)
    const appUrl = process.env.NEXTAUTH_URL ?? process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000"
    fetch(`${appUrl}/api/admin/onrc-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": process.env.CRON_SECRET ?? "" },
      body: JSON.stringify({ jobId }),
    }).catch(() => {})

  } catch (err) {
    await db.update(syncJobs).set({ status: "failed", finishedAt: new Date(), errorMsg: String(err) }).where(eq(syncJobs.id, jobId))
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
