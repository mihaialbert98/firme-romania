import { parse } from "csv-parse"
import { Readable } from "stream"
import { db } from "@/lib/db"
import { companies, financials, syncJobs } from "@/lib/db/schema"
import { sql, eq } from "drizzle-orm"

const CKAN_API = "https://data.gov.ro/api/3/action/package_show"

async function getFinancialsUrl(year: number): Promise<string> {
  const id = `situatii_financiare_${year}`
  const res = await fetch(`${CKAN_API}?id=${id}`)
  const json = await res.json()
  const resources = json.result?.resources ?? []
  const csv = resources.find(
    (r: { format: string; url: string }) =>
      r.format?.toLowerCase() === "csv" || r.url?.endsWith(".txt")
  )
  if (!csv) throw new Error(`No CSV/TXT resource found for year ${year}`)
  return csv.url
}

export async function runFinancialsImport(jobId: number, year = new Date().getFullYear() - 1): Promise<void> {
  await db.update(syncJobs).set({ status: "running", startedAt: new Date() }).where(eq(syncJobs.id, jobId))

  let rowsProcessed = 0
  try {
    const url = await getFinancialsUrl(year)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to fetch financials: ${res.status}`)
    const text = await res.text()

    const records: Record<string, string>[] = await new Promise((resolve, reject) => {
      const rows: Record<string, string>[] = []
      const parser = parse({ columns: true, skip_empty_lines: true, trim: true, bom: true, delimiter: [",", ";", "\t"] })
      parser.on("readable", () => {
        let r: Record<string, string>
        while ((r = parser.read()) !== null) rows.push(r)
      })
      parser.on("error", reject)
      parser.on("end", () => resolve(rows))
      Readable.from(text).pipe(parser)
    })

    const CHUNK = 500
    for (let i = 0; i < records.length; i += CHUNK) {
      const chunk = records.slice(i, i + CHUNK)
      for (const r of chunk) {
        const cui = (r.CUI || r.cui || "").replace(/^RO/, "").trim()
        if (!cui) continue

        const [company] = await db
          .select({ id: companies.id })
          .from(companies)
          .where(eq(companies.cui, cui))
          .limit(1)
        if (!company) continue

        await db
          .insert(financials)
          .values({
            companyId: company.id,
            year,
            turnover: parseInt(r.CA || r.CIFRA_AFACERI || "0") || null,
            profitLoss: parseInt(r.PROFIT || r.PROFIT_NET || "0") || null,
            totalAssets: parseInt(r.TOTAL_ACTIVE || "0") || null,
            employees: parseInt(r.NR_SALARIATI || r.SALARIATI || "0") || null,
          })
          .onConflictDoNothing()

        rowsProcessed++
      }
    }

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
