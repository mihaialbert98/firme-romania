import { db } from "@/lib/db"
import { syncJobs } from "@/lib/db/schema"
import { desc } from "drizzle-orm"
import { formatDate } from "@/lib/utils"
import { TriggerButton, FullSyncButton } from "./trigger-button"
import { Info } from "lucide-react"

export default async function JobsPage() {
  const jobs = await db.select().from(syncJobs).orderBy(desc(syncJobs.createdAt)).limit(50)
  const hasRunning = jobs.some((j) => j.status === "running")

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-bold">Sincronizări</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestionează importul datelor din surse oficiale
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <TriggerButton type="onrc_bulk" label="Sync ONRC" />
          <TriggerButton type="anaf_daily" label="Sync ANAF" />
          <TriggerButton type="financials_annual" label="Sync Financiare" />
          <FullSyncButton />
        </div>
      </div>

      {/* Instructions */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 mb-6 flex gap-3">
        <Info className="size-4 text-primary shrink-0 mt-0.5" />
        <div className="text-sm space-y-1.5">
          <p className="font-medium text-foreground">Cum funcționează sincronizarea</p>
          <ul className="text-muted-foreground space-y-1 list-disc list-inside">
            <li><strong className="text-foreground">Sync complet</strong> — rulează automat toate cele 3 etape în ordine corectă</li>
            <li><strong className="text-foreground">Sync ONRC</strong> — importă toate firmele din România (~1.5M). Durează câteva minute, procesează în batch-uri de 1000</li>
            <li><strong className="text-foreground">Sync ANAF</strong> — îmbogățește firmele cu status TVA, e-factură, inactivi. Rulează după ONRC</li>
            <li><strong className="text-foreground">Sync Financiare</strong> — importă situațiile financiare anuale. Rulează după ONRC</li>
          </ul>
          <p className="text-muted-foreground/70 text-xs mt-2">
            Cron automat: ONRC pe 1 ale lunii · ANAF zilnic la 02:00 · Financiare pe 1 august
          </p>
        </div>
      </div>

      {hasRunning && <AutoRefresh />}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50 text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Tip</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Rânduri procesate</th>
              <th className="px-4 py-3 font-medium">Pornit</th>
              <th className="px-4 py-3 font-medium">Finalizat</th>
              <th className="px-4 py-3 font-medium">Eroare</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-3 text-muted-foreground">{j.id}</td>
                <td className="px-4 py-3 font-mono text-xs">{j.type}</td>
                <td className="px-4 py-3"><StatusChip status={j.status} /></td>
                <td className="px-4 py-3 text-muted-foreground">{j.rowsProcessed?.toLocaleString("ro-RO") ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(j.startedAt)}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(j.finishedAt)}</td>
                <td className="px-4 py-3 text-red-400 text-xs max-w-xs truncate" title={j.errorMsg ?? ""}>{j.errorMsg ?? "—"}</td>
              </tr>
            ))}
            {!jobs.length && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Nicio sincronizare înregistrată.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    done: "text-emerald-400 bg-emerald-500/10",
    running: "text-blue-400 bg-blue-500/10 animate-pulse",
    pending: "text-yellow-400 bg-yellow-500/10",
    failed: "text-red-400 bg-red-500/10",
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? map.pending}`}>
      {status}
    </span>
  )
}

// Auto-refreshes the page every 5s when jobs are running
function AutoRefresh() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `setTimeout(() => location.reload(), 5000)`,
      }}
    />
  )
}
