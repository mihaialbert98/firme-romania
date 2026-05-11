import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { syncJobs } from "@/lib/db/schema"
import { startOnrcImport } from "@/lib/ingestion/onrc"
import { runAnafEnrichment } from "@/lib/ingestion/anaf-api"
import { runFinancialsImport } from "@/lib/ingestion/financials"

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user || role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { type } = await req.json()
  if (!["onrc_bulk", "anaf_daily", "financials_annual"].includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 })
  }

  const [job] = await db.insert(syncJobs).values({ type, status: "pending" }).returning()

  const runners: Record<string, (id: number) => Promise<void>> = {
    onrc_bulk: startOnrcImport,
    anaf_daily: runAnafEnrichment,
    financials_annual: runFinancialsImport,
  }

  // Await the job — maxDuration = 300s gives us enough time
  // The HTTP response only returns once the job finishes or fails
  try {
    await runners[type](job.id)
    return NextResponse.json({ jobId: job.id, status: "done" })
  } catch (err) {
    return NextResponse.json({ jobId: job.id, status: "failed", error: String(err) }, { status: 500 })
  }
}
