import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { syncJobs } from "@/lib/db/schema"
import { runOnrcImport } from "@/lib/ingestion/onrc"

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const [job] = await db.insert(syncJobs).values({ type: "onrc_bulk", status: "pending" }).returning()
  runOnrcImport(job.id).catch(console.error)
  return NextResponse.json({ jobId: job.id })
}
