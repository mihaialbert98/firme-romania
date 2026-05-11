import Link from "next/link"
import { Building2 } from "lucide-react"
import { auth } from "@/lib/auth"
import { SignOutButton } from "./sign-out-button"

export async function Navbar() {
  const session = await auth()
  const user = session?.user
  const isAdmin = (user as { role?: string } | undefined)?.role === "admin"

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold text-foreground hover:text-primary transition-colors">
          <Building2 className="size-5 text-primary" />
          <span>Firme România</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/cautare" className="text-muted-foreground hover:text-foreground transition-colors">
            Caută
          </Link>
          {user ? (
            <>
              {isAdmin && (
                <Link href="/admin" className="text-muted-foreground hover:text-foreground transition-colors">
                  Admin
                </Link>
              )}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground truncate max-w-[140px]">
                  {user.name ?? user.email}
                </span>
                <SignOutButton />
              </div>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-lg border border-border hover:bg-secondary transition-colors text-sm"
              >
                Autentificare
              </Link>
              <Link
                href="/register"
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm"
              >
                Cont gratuit
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
