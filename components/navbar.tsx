"use client"
import Link from "next/link"
import { Building2 } from "lucide-react"

export function Navbar() {
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
        </nav>
      </div>
    </header>
  )
}
