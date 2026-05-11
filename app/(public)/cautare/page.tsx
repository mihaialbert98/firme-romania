import { Navbar } from "@/components/navbar"
import { SearchBar, StatusBadge } from "@/components/search-bar"
import { searchCompanies } from "@/lib/search"
import Link from "next/link"
import type { Metadata } from "next"

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string }> }): Promise<Metadata> {
  const { q } = await searchParams
  return { title: q ? `Rezultate pentru "${q}"` : "Caută firme" }
}

export default async function CautarePage({ searchParams }: { searchParams: Promise<{ q?: string; p?: string }> }) {
  const { q = "", p = "1" } = await searchParams
  const page = Math.max(1, parseInt(p))
  const limit = 20
  const offset = (page - 1) * limit
  const results = q.trim().length >= 2 ? await searchCompanies(q.trim(), limit, offset) : []

  return (
    <>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8 flex-1">
        <div className="mb-6">
          <SearchBar size="md" />
        </div>

        {q && (
          <p className="text-sm text-muted-foreground mb-4">
            {results.length === 0
              ? `Niciun rezultat pentru „${q}"`
              : `Rezultate pentru „${q}"`}
          </p>
        )}

        <div className="space-y-3">
          {results.map((company) => (
            <Link
              key={company.cui}
              href={`/firma/${company.cui}`}
              className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-secondary/50 transition-all group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                    {company.name}
                  </span>
                  <StatusBadge status={company.status} />
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  CUI: {company.cui}
                  {company.legalForm && ` · ${company.legalForm}`}
                  {company.city && ` · ${company.city}`}
                  {company.county && `, ${company.county}`}
                </div>
                {company.caenDescription && (
                  <div className="text-xs text-muted-foreground/70 mt-0.5 truncate">{company.caenDescription}</div>
                )}
              </div>
              {company.companyScore != null && (
                <ScorePill score={company.companyScore} />
              )}
            </Link>
          ))}
        </div>

        {results.length === limit && (
          <div className="mt-6 flex justify-center">
            <Link
              href={`/cautare?q=${encodeURIComponent(q)}&p=${page + 1}`}
              className="px-4 py-2 rounded-lg border border-border hover:bg-secondary transition-colors text-sm"
            >
              Pagina următoare →
            </Link>
          </div>
        )}

        {!q && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg font-medium mb-2">Caută o firmă</p>
            <p className="text-sm">Introdu denumirea, CUI-ul sau orașul</p>
          </div>
        )}
      </main>
    </>
  )
}

function ScorePill({ score }: { score: number }) {
  const color =
    score >= 80 ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" :
    score >= 60 ? "text-green-400 border-green-500/30 bg-green-500/10" :
    score >= 40 ? "text-yellow-400 border-yellow-500/30 bg-yellow-500/10" :
    "text-red-400 border-red-500/30 bg-red-500/10"
  return (
    <div className={`shrink-0 flex items-center justify-center size-10 rounded-lg border font-bold text-sm ${color}`}>
      {score}
    </div>
  )
}
