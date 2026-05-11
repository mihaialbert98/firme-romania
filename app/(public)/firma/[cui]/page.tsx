import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { companies, financials, associates } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { Navbar } from "@/components/navbar"
import { StatusBadge } from "@/components/search-bar"
import { HealthScore } from "@/components/company/health-score"
import { CompanyTimeline } from "@/components/company/timeline"
import { GatedField } from "@/components/company/gated-field"
import { FinancialsChart } from "@/components/company/financials-chart"
import { formatDate, formatNumber, formatCurrency } from "@/lib/utils"
import type { Metadata } from "next"
import { CheckCircle2, XCircle, MinusCircle } from "lucide-react"

export async function generateMetadata({ params }: { params: Promise<{ cui: string }> }): Promise<Metadata> {
  const { cui } = await params
  const [company] = await db.select({ name: companies.name }).from(companies).where(eq(companies.cui, cui)).limit(1)
  if (!company) return { title: "Firmă negăsită" }
  return { title: company.name, description: `Informații despre ${company.name} — CUI ${cui}` }
}

export default async function FirmaPage({ params }: { params: Promise<{ cui: string }> }) {
  const { cui } = await params
  const session = await auth()
  const authenticated = !!session?.user

  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.cui, cui))
    .limit(1)

  if (!company) notFound()

  const fins = await db
    .select()
    .from(financials)
    .where(eq(financials.companyId, company.id))
    .orderBy(desc(financials.year))
    .limit(5)

  const assocs = authenticated
    ? await db.select().from(associates).where(eq(associates.companyId, company.id)).limit(20)
    : []

  const latestFin = fins[0] ?? null

  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8 flex-1">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-6 mb-8">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground">{company.name}</h1>
              <StatusBadge status={company.status} />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>CUI: <strong className="text-foreground">{company.cui}</strong></span>
              {company.jNumber && <span>Nr. Reg: <strong className="text-foreground">{company.jNumber}</strong></span>}
              {company.legalForm && <span>{company.legalForm}</span>}
            </div>
          </div>
          <HealthScore score={company.companyScore ?? 0} />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic info */}
            <Card title="Informații generale">
              <dl className="grid sm:grid-cols-2 gap-3">
                <Row label="Județ" value={company.county} />
                <Row label="Localitate" value={company.city} />
                <Row label="Cod CAEN" value={company.caenCode} />
                <Row label="Activitate" value={company.caenDescription} />
                <Row label="Data înregistrare" value={formatDate(company.registrationDate)} />
                {company.deregistrationDate && (
                  <Row label="Data radiere" value={formatDate(company.deregistrationDate)} />
                )}
              </dl>
            </Card>

            {/* Gated: address + fiscal */}
            <Card title="Adresă și date fiscale" gated={!authenticated}>
              <dl className="grid sm:grid-cols-2 gap-3">
                <div>
                  <dt className="text-xs text-muted-foreground mb-0.5">Adresă sediu</dt>
                  <dd className="text-sm font-medium">
                    <GatedField value={company.address} authenticated={authenticated} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground mb-0.5">TVA</dt>
                  <dd className="text-sm font-medium">
                    {authenticated
                      ? <FiscalBadge value={company.vatRegistered} labelOn="Plătitor TVA" labelOff="Neplătitor TVA" />
                      : <GatedField value={null} authenticated={false} />
                    }
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground mb-0.5">E-Factura</dt>
                  <dd className="text-sm font-medium">
                    {authenticated
                      ? <FiscalBadge value={company.eInvoice} labelOn="Înregistrat" labelOff="Neînregistrat" />
                      : <GatedField value={null} authenticated={false} />
                    }
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground mb-0.5">Stare ANAF</dt>
                  <dd className="text-sm font-medium">
                    {authenticated
                      ? <FiscalBadge value={!company.inactive} labelOn="Activ fiscal" labelOff="Inactiv fiscal" />
                      : <GatedField value={null} authenticated={false} />
                    }
                  </dd>
                </div>
              </dl>
              {!authenticated && (
                <div className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm text-center">
                  <a href="/register" className="text-primary hover:underline font-medium">
                    Creează cont gratuit
                  </a>{" "}
                  <span className="text-muted-foreground">pentru a vedea adresa, TVA și date fiscale complete</span>
                </div>
              )}
            </Card>

            {/* Associates — gated */}
            <Card title="Administratori și asociați" gated={!authenticated}>
              {authenticated ? (
                assocs.length > 0 ? (
                  <div className="space-y-2">
                    {assocs.map((a) => (
                      <div key={a.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                        <span className="text-sm font-medium">{a.name}</span>
                        <div className="flex items-center gap-3">
                          {a.sharePercent != null && (
                            <span className="text-xs text-muted-foreground">{a.sharePercent}%</span>
                          )}
                          <span className="text-xs px-2 py-0.5 rounded-md bg-secondary text-muted-foreground">
                            {a.role === "admin" ? "Administrator" : "Asociat"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nu există asociați/administratori în baza de date.</p>
                )
              ) : (
                <div className="py-6 text-center">
                  <div className="blur-sm space-y-2 pointer-events-none select-none mb-3">
                    {["Ion Popescu — Administrator", "Maria Ionescu — Asociat (50%)"].map((p) => (
                      <div key={p} className="text-sm text-foreground/70">{p}</div>
                    ))}
                  </div>
                  <a href="/register" className="text-primary text-sm hover:underline font-medium">
                    Autentifică-te pentru a vedea asociații și administratorii
                  </a>
                </div>
              )}
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Timeline */}
            <Card title="Istoric">
              <CompanyTimeline company={company} />
            </Card>

            {/* Financials — gated */}
            <Card title="Date financiare" gated={!authenticated}>
              {authenticated ? (
                fins.length > 0 ? (
                  <>
                    {latestFin && (
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <Metric label="Cifra de afaceri" value={formatCurrency(latestFin.turnover)} sub={String(latestFin.year)} />
                        <Metric label="Profit/Pierdere" value={formatCurrency(latestFin.profitLoss)} sub={String(latestFin.year)} />
                        <Metric label="Total active" value={formatCurrency(latestFin.totalAssets)} sub={String(latestFin.year)} />
                        <Metric label="Angajați" value={formatNumber(latestFin.employees)} sub={String(latestFin.year)} />
                      </div>
                    )}
                    <FinancialsChart data={fins} />
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Date financiare indisponibile.</p>
                )
              ) : (
                <div className="py-4 text-center">
                  <div className="blur-sm pointer-events-none select-none mb-3 space-y-1">
                    <div className="text-sm">CA: 1.250.000 RON</div>
                    <div className="text-sm">Profit: 85.000 RON</div>
                    <div className="text-sm">Angajați: 12</div>
                  </div>
                  <a href="/register" className="text-primary text-sm hover:underline font-medium">
                    Cont gratuit pentru date financiare
                  </a>
                </div>
              )}
            </Card>
          </div>
        </div>
      </main>
    </>
  )
}

function Card({ title, children, gated }: { title: string; children: React.ReactNode; gated?: boolean }) {
  return (
    <div className={`rounded-xl border bg-card p-5 ${gated ? "border-primary/20" : "border-border"}`}>
      <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        {title}
        {gated && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/20">Cont gratuit</span>}
      </h2>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground mb-0.5">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value ?? "—"}</dd>
    </div>
  )
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg bg-secondary p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-bold text-foreground mt-0.5">{value}</div>
      <div className="text-[10px] text-muted-foreground/60">{sub}</div>
    </div>
  )
}

function FiscalBadge({ value, labelOn, labelOff }: { value: boolean | null | undefined; labelOn: string; labelOff: string }) {
  if (value == null) return <span className="text-muted-foreground">—</span>
  return value
    ? <span className="inline-flex items-center gap-1 text-emerald-400 text-sm"><CheckCircle2 className="size-3.5" />{labelOn}</span>
    : <span className="inline-flex items-center gap-1 text-muted-foreground text-sm"><XCircle className="size-3.5" />{labelOff}</span>
}
