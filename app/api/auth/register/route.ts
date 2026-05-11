import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"
import { nanoid } from "nanoid"

export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json()

  if (!email || !password || password.length < 8) {
    return NextResponse.json({ error: "Date invalide." }, { status: 400 })
  }

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (existing) {
    return NextResponse.json({ error: "Există deja un cont cu acest email." }, { status: 409 })
  }

  const hashed = await bcrypt.hash(password, 12)
  await db.insert(users).values({
    id: nanoid(),
    email,
    name: name || null,
    password: hashed,
    role: "user",
    subscriptionTier: "free",
  })

  return NextResponse.json({ ok: true })
}
