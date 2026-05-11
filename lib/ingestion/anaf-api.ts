import pThrottle from "p-throttle"
import { db } from "@/lib/db"
import { companies, syncJobs } from "@/lib/db/schema"
import { sql, lt, isNull, or, eq } from "drizzle-orm"

const ANAF_URL = "https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva"
const BATCH_SIZE = 100
const DAILY_LIMIT = 5000

// 1 request per second
const throttledFetch = pThrottle({ limit: 1, interval: 1000 })(
  async (body: string) => {
    const res = await fetch(ANAF_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    })
    if (!res.ok) throw new Error(`ANAF API error: ${res.status}`)
    return res.json()
  }
)

export async function runAnafEnrichment(jobId: number): Promise<void> {
  await db.update(syncJobs).set({ status: "running", startedAt: new Date() }).where(eq(syncJobs.id, jobId))

  let rowsProcessed = 0
  try {
    const stale = await db
      .select({ cui: companies.cui })
      .from(companies)
      .where(
        or(
          isNull(companies.lastAnafCheckAt),
          lt(companies.lastAnafCheckAt, sql`NOW() - INTERVAL '1 day'`)
        )
      )
      .limit(DAILY_LIMIT)

    const cuis = stale.map((r) => r.cui)
    const today = new Date().toISOString().slice(0, 10)

    for (let i = 0; i < cuis.length; i += BATCH_SIZE) {
      const batch = cuis.slice(i, i + BATCH_SIZE)
      const payload = batch.map((cui) => ({ cui, data: today }))

      let result: { found?: AnafRecord[]; notFound?: string[] }
      try {
        result = await throttledFetch(JSON.stringify(payload))
      } catch {
        continue
      }

      for (const record of result.found ?? []) {
        await db
          .update(companies)
          .set({
            vatRegistered: record.scpTVA,
            vatCashAccounting: record.scpTVA_TVA_lichidare ?? false,
            inactive: record.statusInactivi,
            eInvoice: record.statusRO_e_Factura ?? false,
            lastAnafCheckAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(companies.cui, String(record.cui)))
        rowsProcessed++
      }

      for (const cui of result.notFound ?? []) {
        await db
          .update(companies)
          .set({ lastAnafCheckAt: new Date() })
          .where(eq(companies.cui, String(cui)))
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

interface AnafRecord {
  cui: number | string
  scpTVA: boolean
  scpTVA_TVA_lichidare?: boolean
  statusInactivi: boolean
  statusRO_e_Factura?: boolean
}
