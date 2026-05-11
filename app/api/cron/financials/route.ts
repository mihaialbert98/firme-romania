import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { syncJobs } from "@/lib/db/schema"
import { runFinancialsImport } from "@/lib/ingestion/financials"

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const [job] = await db.insert(syncJobs).values({ type: "financials_annual", status: "pending" }).returning()
  runFinancialsImport(job.id).catch(console.error)
  return NextResponse.json({ jobId: job.id })
}
