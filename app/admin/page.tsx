import { db } from "@/lib/db"
import { companies, syncJobs } from "@/lib/db/schema"
import { sql, eq, desc } from "drizzle-orm"
import { formatDate } from "@/lib/utils"

export default async function AdminPage() {
  const [[{ total }], [{ active }], recentJobs] = await Promise.all([
    db.select({ total: sql<number>`count(*)` }).from(companies),
    db.select({ active: sql<number>`count(*)` }).from(companies).where(eq(companies.status, "activa")),
    db.select().from(syncJobs).orderBy(desc(syncJobs.createdAt)).limit(5),
  ])

  const lastOnrc = recentJobs.find((j) => j.type === "onrc_bulk" && j.status === "done")
  const lastAnaf = recentJobs.find((j) => j.type === "anaf_daily" && j.status === "done")

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total firme" value={Number(total).toLocaleString("ro-RO")} />
        <StatCard label="Firme active" value={Number(active).toLocaleString("ro-RO")} />
        <StatCard label="Ultima sync ONRC" value={lastOnrc ? formatDate(lastOnrc.finishedAt) : "Niciodată"} />
        <StatCard label="Ultima sync ANAF" value={lastAnaf ? formatDate(lastAnaf.finishedAt) : "Niciodată"} />
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold mb-4">Ultimele sincronizări</h2>
        <JobsTable jobs={recentJobs} />
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  )
}

function JobsTable({ jobs }: { jobs: { id: number; type: string; status: string; startedAt: Date | null; finishedAt: Date | null; rowsProcessed: number | null; errorMsg: string | null }[] }) {
  if (!jobs.length) return <p className="text-sm text-muted-foreground">Nicio sincronizare înregistrată.</p>
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-muted-foreground">
          <th className="pb-2 font-medium">Tip</th>
          <th className="pb-2 font-medium">Status</th>
          <th className="pb-2 font-medium">Rânduri</th>
          <th className="pb-2 font-medium">Finalizat</th>
        </tr>
      </thead>
      <tbody>
        {jobs.map((j) => (
          <tr key={j.id} className="border-b border-border/50 last:border-0">
            <td className="py-2 font-mono text-xs">{j.type}</td>
            <td className="py-2"><StatusChip status={j.status} /></td>
            <td className="py-2 text-muted-foreground">{j.rowsProcessed?.toLocaleString("ro-RO") ?? "—"}</td>
            <td className="py-2 text-muted-foreground">{formatDate(j.finishedAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    done: "text-emerald-400 bg-emerald-500/10",
    running: "text-blue-400 bg-blue-500/10",
    pending: "text-yellow-400 bg-yellow-500/10",
    failed: "text-red-400 bg-red-500/10",
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? map.pending}`}>
      {status}
    </span>
  )
}
