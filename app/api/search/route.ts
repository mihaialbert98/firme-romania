import { NextRequest, NextResponse } from "next/server"
import { searchCompanies } from "@/lib/search"

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? ""
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "20"), 50)
  const offset = parseInt(req.nextUrl.searchParams.get("offset") ?? "0")

  if (!q || q.trim().length < 2) {
    return NextResponse.json([])
  }

  try {
    const results = await searchCompanies({ q: q.trim() }, limit, offset)
    return NextResponse.json(results)
  } catch {
    return NextResponse.json([], { status: 500 })
  }
}
