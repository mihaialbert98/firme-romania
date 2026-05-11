import NextAuth from "next-auth"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import Credentials from "next-auth/providers/credentials"
import { getDb } from "@/lib/db"
import { users, accounts, sessions, verificationTokens } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const db = getDb()
  return {
    adapter: DrizzleAdapter(db, {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }),
    session: { strategy: "jwt" },
    providers: [
      Credentials({
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Parolă", type: "password" },
        },
        async authorize(credentials) {
          if (!credentials?.email || !credentials?.password) return null
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, credentials.email as string))
            .limit(1)
          if (!user?.password) return null
          const valid = await bcrypt.compare(credentials.password as string, user.password)
          if (!valid) return null
          return { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role }
        },
      }),
    ],
    callbacks: {
      jwt({ token, user }) {
        if (user) {
          token.role = (user as { role?: string }).role
          token.id = user.id
        }
        return token
      },
      session({ session, token }) {
        if (session.user) {
          session.user.id = token.id as string
          ;(session.user as { role?: string }).role = token.role as string
        }
        return session
      },
    },
    pages: {
      signIn: "/login",
      error: "/login",
    },
  }
})
