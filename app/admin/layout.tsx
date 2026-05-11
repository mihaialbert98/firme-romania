import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Building2, BarChart3, RefreshCw, List } from "lucide-react"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user || role !== "admin") redirect("/login")

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 border-r border-border bg-card flex flex-col">
        <div className="h-14 flex items-center gap-2 px-4 border-b border-border font-semibold">
          <Building2 className="size-4 text-primary" />
          <span className="text-sm">Admin</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <NavLink href="/admin" icon={<BarChart3 className="size-4" />} label="Dashboard" />
          <NavLink href="/admin/jobs" icon={<RefreshCw className="size-4" />} label="Sincronizări" />
          <NavLink href="/admin/companies" icon={<List className="size-4" />} label="Firme" />
        </nav>
        <div className="p-3 border-t border-border">
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Înapoi la site
          </Link>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  )
}

function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
    >
      {icon}
      {label}
    </Link>
  )
}
