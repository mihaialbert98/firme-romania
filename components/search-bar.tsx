"use client"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Search, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface SearchResult {
  cui: string
  name: string
  status: string
  city: string | null
  county: string | null
  caenDescription: string | null
}

export function SearchBar({ autoFocus = false, size = "lg" }: { autoFocus?: boolean; size?: "lg" | "md" }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    setLoading(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=6`)
        const data = await res.json()
        setResults(data)
        setOpen(true)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) {
      setOpen(false)
      router.push(`/cautare?q=${encodeURIComponent(query.trim())}`)
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={handleSubmit}>
        <div className={cn(
          "flex items-center gap-3 rounded-xl border border-border bg-card px-4 transition-all focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20",
          size === "lg" ? "h-14" : "h-10"
        )}>
          {loading
            ? <Loader2 className="size-5 text-muted-foreground shrink-0 animate-spin" />
            : <Search className="size-5 text-muted-foreground shrink-0" />
          }
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Caută după denumire, CUI, oraș..."
            autoFocus={autoFocus}
            className={cn(
              "flex-1 bg-transparent outline-none placeholder:text-muted-foreground",
              size === "lg" ? "text-base" : "text-sm"
            )}
          />
          {query && (
            <button type="submit" className="px-3 py-1 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors">
              Caută
            </button>
          )}
        </div>
      </form>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-2 w-full z-50 rounded-xl border border-border bg-card shadow-xl overflow-hidden">
          {results.map((r) => (
            <Link
              key={r.cui}
              href={`/firma/${r.cui}`}
              onClick={() => setOpen(false)}
              className="flex items-start gap-3 px-4 py-3 hover:bg-secondary transition-colors border-b border-border/50 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{r.name}</span>
                  <StatusBadge status={r.status} />
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  CUI: {r.cui} {r.city ? `· ${r.city}` : ""} {r.county ? `· ${r.county}` : ""}
                </div>
                {r.caenDescription && (
                  <div className="text-xs text-muted-foreground/70 truncate mt-0.5">{r.caenDescription}</div>
                )}
              </div>
            </Link>
          ))}
          <Link
            href={`/cautare?q=${encodeURIComponent(query)}`}
            onClick={() => setOpen(false)}
            className="flex items-center justify-center py-2.5 text-xs text-primary hover:bg-secondary transition-colors"
          >
            Vezi toate rezultatele →
          </Link>
        </div>
      )}
    </div>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    activa: { label: "Activă", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    inactiva: { label: "Inactivă", className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
    radiata: { label: "Radiată", className: "bg-red-500/15 text-red-400 border-red-500/30" },
  }
  const s = map[status] ?? map.inactiva
  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium border", s.className)}>
      {s.label}
    </span>
  )
}
