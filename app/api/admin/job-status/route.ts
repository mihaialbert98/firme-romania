import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { syncJobs } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function GET(req: NextRequest) {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user || role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const id = parseInt(req.nextUrl.searchParams.get("id") ?? "")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  const [job] = await db.select().from(syncJobs).where(eq(syncJobs.id, id)).limit(1)
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({ status: job.status, rowsProcessed: job.rowsProcessed })
}
