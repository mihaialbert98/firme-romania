import { Navbar } from "@/components/navbar"
import { SearchBar, StatusBadge } from "@/components/search-bar"
import { searchCompanies } from "@/lib/search"
import Link from "next/link"
import type { Metadata } from "next"

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string>> }): Promise<Metadata> {
  const { q } = await searchParams
  return { title: q ? `Rezultate pentru "${q}"` : "Caută firme" }
}

const JUDETE = [
  "Alba","Arad","Argeș","Bacău","Bihor","Bistrița-Năsăud","Botoșani","Brașov","Brăila","Bucureşti",
  "Buzău","Călărași","Caraș-Severin","Cluj","Constanța","Covasna","Dâmbovița","Dolj","Galați","Giurgiu",
  "Gorj","Harghita","Hunedoara","Ialomița","Iași","Ilfov","Maramureș","Mehedinți","Mureș","Neamț",
  "Olt","Prahova","Sălaj","Satu Mare","Sibiu","Suceava","Teleorman","Timiș","Tulcea","Vâlcea","Vaslui","Vrancea",
]

const STATUSES = [
  { value: "activa", label: "Activă" },
  { value: "inactiva", label: "Inactivă" },
  { value: "radiata", label: "Radiată" },
]

const EMPLOYEE_RANGES = [
  { label: "1–9", min: 1, max: 9 },
  { label: "10–49", min: 10, max: 49 },
  { label: "50–249", min: 50, max: 249 },
  { label: "250+", min: 250, max: undefined },
]

const TURNOVER_RANGES = [
  { label: "< 100k RON", min: undefined, max: 100 },
  { label: "100k–1M RON", min: 100, max: 1000 },
  { label: "1M–10M RON", min: 1000, max: 10000 },
  { label: "10M+ RON", min: 10000, max: undefined },
]

export default async function CautarePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const q = params.q ?? ""
  const page = Math.max(1, parseInt(params.p ?? "1"))
  const limit = 20
  const offset = (page - 1) * limit

  const statusFilter = params.status ? params.status.split(",") : []
  const countyFilter = params.county ? params.county.split(",") : []
  const empRange = EMPLOYEE_RANGES.find((r) => params.employees === r.label)
  const turnRange = TURNOVER_RANGES.find((r) => params.turnover === r.label)

  const hasFilters = statusFilter.length > 0 || countyFilter.length > 0 || empRange || turnRange
  const shouldSearch = q.trim().length >= 2 || hasFilters

  const results = shouldSearch
    ? await searchCompanies({
        q: q.trim(),
        status: statusFilter.length ? statusFilter : undefined,
        county: countyFilter.length ? countyFilter : undefined,
        employeesMin: empRange?.min,
        employeesMax: empRange?.max,
        turnoverMin: turnRange?.min,
        turnoverMax: turnRange?.max,
      }, limit, offset)
    : []

  function buildUrl(overrides: Record<string, string | undefined>) {
    const p = { q, status: params.status, county: params.county, employees: params.employees, turnover: params.turnover, ...overrides }
    const sp = new URLSearchParams()
    Object.entries(p).forEach(([k, v]) => { if (v) sp.set(k, v) })
    return `/cautare?${sp.toString()}`
  }

  function toggleMulti(param: string, current: string[], value: string) {
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
    return buildUrl({ [param]: next.join(",") || undefined, p: undefined })
  }

  function toggleSingle(param: string, current: string | undefined, value: string) {
    return buildUrl({ [param]: current === value ? undefined : value, p: undefined })
  }

  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8 flex-1">
        <div className="mb-6">
          <SearchBar size="md" />
        </div>

        <div className="flex gap-6">
          {/* Filters sidebar */}
          <aside className="w-56 shrink-0 space-y-6">
            {/* Status */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Status</p>
              <div className="space-y-1">
                {STATUSES.map((s) => (
                  <Link
                    key={s.value}
                    href={toggleMulti("status", statusFilter, s.value)}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${statusFilter.includes(s.value) ? "bg-primary/10 text-primary font-medium" : "hover:bg-secondary text-foreground"}`}
                  >
                    <span className={`size-4 rounded border flex items-center justify-center shrink-0 ${statusFilter.includes(s.value) ? "bg-primary border-primary" : "border-border"}`}>
                      {statusFilter.includes(s.value) && <span className="text-primary-foreground text-xs">✓</span>}
                    </span>
                    {s.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Employees */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Angajați</p>
              <div className="space-y-1">
                {EMPLOYEE_RANGES.map((r) => (
                  <Link
                    key={r.label}
                    href={toggleSingle("employees", params.employees, r.label)}
                    className={`block px-2 py-1.5 rounded-lg text-sm transition-colors ${params.employees === r.label ? "bg-primary/10 text-primary font-medium" : "hover:bg-secondary text-foreground"}`}
                  >
                    {r.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Turnover */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Cifră de afaceri</p>
              <div className="space-y-1">
                {TURNOVER_RANGES.map((r) => (
                  <Link
                    key={r.label}
                    href={toggleSingle("turnover", params.turnover, r.label)}
                    className={`block px-2 py-1.5 rounded-lg text-sm transition-colors ${params.turnover === r.label ? "bg-primary/10 text-primary font-medium" : "hover:bg-secondary text-foreground"}`}
                  >
                    {r.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* County */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Județ</p>
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {JUDETE.map((j) => (
                  <Link
                    key={j}
                    href={toggleMulti("county", countyFilter, j)}
                    className={`flex items-center gap-2 px-2 py-1 rounded-lg text-sm transition-colors ${countyFilter.includes(j) ? "bg-primary/10 text-primary font-medium" : "hover:bg-secondary text-foreground"}`}
                  >
                    <span className={`size-3.5 rounded border flex items-center justify-center shrink-0 ${countyFilter.includes(j) ? "bg-primary border-primary" : "border-border"}`}>
                      {countyFilter.includes(j) && <span className="text-primary-foreground text-[9px]">✓</span>}
                    </span>
                    {j}
                  </Link>
                ))}
              </div>
            </div>

            {hasFilters && (
              <Link href={buildUrl({ status: undefined, county: undefined, employees: undefined, turnover: undefined, p: undefined })} className="block text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
                Resetează filtrele
              </Link>
            )}
          </aside>

          {/* Results */}
          <div className="flex-1 min-w-0">
            {shouldSearch && (
              <p className="text-sm text-muted-foreground mb-4">
                {results.length === 0
                  ? "Niciun rezultat"
                  : `${results.length === limit ? `${limit}+` : results.length} rezultate`}
                {q && ` pentru „${q}"`}
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
                    {(company.employees != null || company.turnover != null) && (
                      <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
                        {company.employees != null && (
                          <span>{company.employees.toLocaleString("ro-RO")} angajați</span>
                        )}
                        {company.turnover != null && company.turnover > 0 && (
                          <span>CA: {formatTurnover(company.turnover)}</span>
                        )}
                      </div>
                    )}
                  </div>
                  {company.companyScore != null && company.companyScore > 0 && (
                    <ScorePill score={company.companyScore} />
                  )}
                </Link>
              ))}
            </div>

            {results.length === limit && (
              <div className="mt-6 flex justify-center">
                <Link
                  href={buildUrl({ p: String(page + 1) })}
                  className="px-4 py-2 rounded-lg border border-border hover:bg-secondary transition-colors text-sm"
                >
                  Pagina următoare →
                </Link>
              </div>
            )}

            {!shouldSearch && (
              <div className="text-center py-16 text-muted-foreground">
                <p className="text-lg font-medium mb-2">Caută o firmă</p>
                <p className="text-sm">Introdu denumirea, CUI-ul sau selectează filtre din stânga</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  )
}

function formatTurnover(ron: number): string {
  if (ron >= 1_000_000) return `${(ron / 1_000_000).toFixed(1)}M RON`
  if (ron >= 1_000) return `${(ron / 1_000).toFixed(0)}k RON`
  return `${ron} RON`
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
