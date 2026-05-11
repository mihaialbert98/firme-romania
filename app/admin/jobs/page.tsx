import { db } from "@/lib/db"
import { syncJobs } from "@/lib/db/schema"
import { desc } from "drizzle-orm"
import { formatDate } from "@/lib/utils"
import { TriggerButton } from "./trigger-button"

export default async function JobsPage() {
  const jobs = await db.select().from(syncJobs).orderBy(desc(syncJobs.createdAt)).limit(50)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Sincronizări</h1>
        <div className="flex gap-2">
          <TriggerButton type="onrc_bulk" label="Sync ONRC" />
          <TriggerButton type="anaf_daily" label="Sync ANAF" />
          <TriggerButton type="financials_annual" label="Sync Financiare" />
        </div>
      </div>

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
                <td className="px-4 py-3 text-red-400 text-xs max-w-xs truncate">{j.errorMsg ?? "—"}</td>
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
