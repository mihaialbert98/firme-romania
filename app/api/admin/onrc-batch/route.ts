import { NextRequest, NextResponse } from "next/server"
import { processOnrcBatch } from "@/lib/ingestion/onrc"

export async function POST(req: NextRequest) {
  if (req.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { jobId } = await req.json()
  // Fire and forget — returns immediately, batch runs async
  processOnrcBatch(jobId).catch(console.error)
  return NextResponse.json({ ok: true })
}
