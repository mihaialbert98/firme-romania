import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { syncJobs } from "@/lib/db/schema"
import { runAnafEnrichment } from "@/lib/ingestion/anaf-api"

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const [job] = await db.insert(syncJobs).values({ type: "anaf_daily", status: "pending" }).returning()
  runAnafEnrichment(job.id).catch(console.error)
  return NextResponse.json({ jobId: job.id })
}
