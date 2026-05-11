import { NextRequest, NextResponse } from "next/server"

export const maxDuration = 300
import { db } from "@/lib/db"
import { syncJobs } from "@/lib/db/schema"
import { startOnrcImport } from "@/lib/ingestion/onrc"

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const [job] = await db.insert(syncJobs).values({ type: "onrc_bulk", status: "pending" }).returning()
  startOnrcImport(job.id).catch(console.error)
  return NextResponse.json({ jobId: job.id })
}
