import { Navbar } from "@/components/navbar"
import { SearchBar } from "@/components/search-bar"
import { Building2, TrendingUp, Users, Globe } from "lucide-react"

const STATS = [
  { icon: Building2, label: "Firme înregistrate", value: "1.5M+" },
  { icon: TrendingUp, label: "Date financiare", value: "Anuale" },
  { icon: Users, label: "Administratori", value: "Actualizat lunar" },
  { icon: Globe, label: "Surse oficiale", value: "ONRC · ANAF" },
]

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="hero-grid absolute inset-0 opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
          <div className="relative max-w-3xl mx-auto px-4 pt-24 pb-20 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium mb-6">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              Date actualizate zilnic din surse oficiale
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-4">
              Registrul companiilor din{" "}
              <span className="text-primary">România</span>
            </h1>
            <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
              Informații complete despre orice firmă: stare fiscală, date financiare, administratori, sediu și istoric.
            </p>
            <SearchBar size="lg" autoFocus />
            <p className="text-muted-foreground/60 text-xs mt-3">
              Caută după denumire, CUI sau cod CAEN · Cont gratuit pentru date complete
            </p>
          </div>
        </section>

        {/* Stats */}
        <section className="max-w-5xl mx-auto px-4 pb-16">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {STATS.map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-xl border border-border bg-card p-5 text-center">
                <Icon className="size-6 text-primary mx-auto mb-2" />
                <div className="text-xl font-bold text-foreground">{value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-border">
          <div className="max-w-5xl mx-auto px-4 py-16 grid sm:grid-cols-3 gap-8">
            <Feature
              title="Date în timp real"
              desc="Starea fiscală, TVA și e-factura sunt verificate zilnic prin API-ul oficial ANAF."
            />
            <Feature
              title="Istoric financiar"
              desc="Cifra de afaceri, profit, angajați și active — din situațiile financiare oficiale MFinanțe."
            />
            <Feature
              title="Scor de sănătate"
              desc="Fiecare firmă primește un scor calculat automat din indicatori fiscali și financiari."
            />
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground/60">
        © {new Date().getFullYear()} Firme România · Date din surse publice oficiale: ONRC, ANAF, MFinanțe
      </footer>
    </>
  )
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <h3 className="font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  )
}
