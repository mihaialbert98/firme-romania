import { parse } from "csv-parse"
import { Readable } from "stream"
import { db } from "@/lib/db"
import { companies, syncJobs, syncChunks } from "@/lib/db/schema"
import { sql, eq, and } from "drizzle-orm"

const CKAN_PACKAGE_ID = "firme-inregistrate-la-registrul-comertului"
const CKAN_API = "https://data.gov.ro/api/3/action/package_show"
const CHUNK_SIZE = 2000 // rows per chunk stored in DB

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

// Step 1: download CSV once, split into chunks stored in DB, then kick off processing
export async function startOnrcImport(jobId: number): Promise<void> {
  await db.update(syncJobs).set({ status: "running", startedAt: new Date() }).where(eq(syncJobs.id, jobId))

  try {
    const csvUrl = await getLatestCsvUrl()
    await db.update(syncJobs).set({ csvUrl }).where(eq(syncJobs.id, jobId))

    const res = await fetch(csvUrl)
    if (!res.ok) throw new Error(`Failed to fetch CSV: ${res.status}`)
    const text = await res.text()

    const records = await parseCsv(text)
    const totalChunks = Math.ceil(records.length / CHUNK_SIZE)

    // Store all chunks in DB
    for (let i = 0; i < totalChunks; i++) {
      const slice = records.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
      await db.insert(syncChunks).values({
        jobId,
        chunkIndex: i,
        data: JSON.stringify(slice),
        processed: false,
      })
    }

    await db.update(syncJobs).set({ currentOffset: 0, rowsProcessed: 0 }).where(eq(syncJobs.id, jobId))

    // Kick off first chunk
    await processNextChunk(jobId)
  } catch (err) {
    await db.update(syncJobs).set({ status: "failed", finishedAt: new Date(), errorMsg: String(err) }).where(eq(syncJobs.id, jobId))
  }
}

// Step 2: process one chunk, mark it done, trigger next
export async function processOnrcBatch(jobId: number): Promise<void> {
  await processNextChunk(jobId)
}

async function processNextChunk(jobId: number): Promise<void> {
  const [job] = await db.select().from(syncJobs).where(eq(syncJobs.id, jobId)).limit(1)
  if (!job || job.status === "failed") return

  // Find next unprocessed chunk
  const [chunk] = await db
    .select()
    .from(syncChunks)
    .where(and(eq(syncChunks.jobId, jobId), eq(syncChunks.processed, false)))
    .orderBy(syncChunks.chunkIndex)
    .limit(1)

  if (!chunk) {
    // All chunks done — update search vectors and mark complete
    await db.execute(
      sql`UPDATE companies
          SET search_vector = to_tsvector('simple',
            coalesce(name,'') || ' ' || coalesce(cui,'') || ' ' || coalesce(city,''))
          WHERE search_vector IS NULL`
    )
    // Clean up chunks
    await db.delete(syncChunks).where(eq(syncChunks.jobId, jobId))
    await db.update(syncJobs).set({ status: "done", finishedAt: new Date() }).where(eq(syncJobs.id, jobId))
    return
  }

  try {
    const records: Record<string, string>[] = JSON.parse(chunk.data)

    const values = records.map((r) => ({
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

    // Mark chunk as processed
    await db.update(syncChunks).set({ processed: true }).where(eq(syncChunks.id, chunk.id))
    await db.update(syncJobs)
      .set({ rowsProcessed: (job.rowsProcessed ?? 0) + values.length })
      .where(eq(syncJobs.id, jobId))

    // Trigger next chunk via internal API
    const baseUrl = process.env.NEXTAUTH_URL
      ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

    fetch(`${baseUrl}/api/admin/onrc-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": process.env.CRON_SECRET ?? "" },
      body: JSON.stringify({ jobId }),
    }).catch(console.error)

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
