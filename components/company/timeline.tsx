import { formatDate } from "@/lib/utils"
import type { Company } from "@/lib/db/schema"

export function CompanyTimeline({ company }: { company: Company }) {
  const events = [
    company.registrationDate && { date: company.registrationDate, label: "Înregistrare", color: "bg-primary" },
    company.vatRegistered && { date: null, label: "Înregistrare TVA", color: "bg-emerald-400" },
    company.inactive && { date: null, label: "Declarată inactivă", color: "bg-red-400" },
    company.deregistrationDate && { date: company.deregistrationDate, label: "Radiere", color: "bg-red-500" },
  ].filter(Boolean) as { date: Date | null; label: string; color: string }[]

  if (!events.length) return null

  return (
    <div className="relative">
      <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
      <div className="space-y-4 pl-8">
        {events.map((e, i) => (
          <div key={i} className="relative">
            <div className={`absolute -left-6 top-1.5 size-2.5 rounded-full ${e.color} ring-2 ring-background`} />
            <p className="text-sm font-medium text-foreground">{e.label}</p>
            <p className="text-xs text-muted-foreground">{e.date ? formatDate(e.date) : "—"}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
