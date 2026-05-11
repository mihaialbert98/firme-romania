import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { syncJobs } from "@/lib/db/schema"
import { runOnrcImport } from "@/lib/ingestion/onrc"
import { runAnafEnrichment } from "@/lib/ingestion/anaf-api"
import { runFinancialsImport } from "@/lib/ingestion/financials"

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

  // Fire and forget — don't await so the response returns immediately
  const runners: Record<string, (id: number) => Promise<void>> = {
    onrc_bulk: runOnrcImport,
    anaf_daily: runAnafEnrichment,
    financials_annual: runFinancialsImport,
  }
  runners[type](job.id).catch(console.error)

  return NextResponse.json({ jobId: job.id })
}
