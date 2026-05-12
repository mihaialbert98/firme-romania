import Link from "next/link"

interface PaginationProps {
  page: number
  total: number
  limit: number
  buildUrl: (overrides: Record<string, string | undefined>) => string
}

export function Pagination({ page, total, limit, buildUrl }: PaginationProps) {
  const totalPages = Math.ceil(total / limit)
  if (totalPages <= 1) return null

  const pages = getPageNumbers(page, totalPages)

  return (
    <nav className="mt-6 flex items-center justify-center gap-1">
      <PageLink
        href={page > 1 ? buildUrl({ p: String(page - 1) }) : null}
        label="←"
        disabled={page <= 1}
      />
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground text-sm">…</span>
        ) : (
          <PageLink
            key={p}
            href={buildUrl({ p: String(p) })}
            label={String(p)}
            active={p === page}
          />
        )
      )}
      <PageLink
        href={page < totalPages ? buildUrl({ p: String(page + 1) }) : null}
        label="→"
        disabled={page >= totalPages}
      />
    </nav>
  )
}

function PageLink({ href, label, active, disabled }: { href: string | null; label: string; active?: boolean; disabled?: boolean }) {
  const base = "flex items-center justify-center min-w-[2rem] h-8 px-2 rounded-lg text-sm transition-colors"
  if (disabled || !href) {
    return <span className={`${base} text-muted-foreground/40 cursor-default`}>{label}</span>
  }
  if (active) {
    return <span className={`${base} bg-primary text-primary-foreground font-medium`}>{label}</span>
  }
  return <Link href={href} className={`${base} border border-border hover:bg-secondary`}>{label}</Link>
}

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages: (number | "...")[] = []
  const addPage = (p: number) => { if (!pages.includes(p)) pages.push(p) }
  const addEllipsis = () => { if (pages[pages.length - 1] !== "...") pages.push("...") }

  addPage(1)
  if (current > 3) addEllipsis()
  for (let p = Math.max(2, current - 2); p <= Math.min(total - 1, current + 2); p++) addPage(p)
  if (current < total - 2) addEllipsis()
  addPage(total)

  return pages
}
