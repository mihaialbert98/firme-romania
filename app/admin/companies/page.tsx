import { db } from "@/lib/db"
import { companies } from "@/lib/db/schema"
import { eq, sql, ilike, desc } from "drizzle-orm"
import Link from "next/link"
import { formatDate } from "@/lib/utils"

export default async function AdminCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; p?: string }>
}) {
  const { q = "", status = "", p = "1" } = await searchParams
  const page = Math.max(1, parseInt(p))
  const limit = 50
  const offset = (page - 1) * limit

  const conditions = []
  if (q) conditions.push(ilike(companies.name, `%${q}%`))
  if (status) conditions.push(eq(companies.status, status))

  const rows = await db
    .select({
      id: companies.id,
      cui: companies.cui,
      name: companies.name,
      status: companies.status,
      city: companies.city,
      county: companies.county,
      lastOnrcSyncAt: companies.lastOnrcSyncAt,
      lastAnafCheckAt: companies.lastAnafCheckAt,
      companyScore: companies.companyScore,
    })
    .from(companies)
    .where(conditions.length > 0 ? sql`${conditions[0]}` : undefined)
    .orderBy(desc(companies.updatedAt))
    .limit(limit)
    .offset(offset)

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Firme în baza de date</h1>

      <form className="flex gap-3 mb-6">
        <input
          name="q"
          defaultValue={q}
          placeholder="Caută după denumire..."
          className="rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary/50 w-64"
        />
        <select
          name="status"
          defaultValue={status}
          className="rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary/50"
        >
          <option value="">Toate statusurile</option>
          <option value="activa">Activă</option>
          <option value="inactiva">Inactivă</option>
          <option value="radiata">Radiată</option>
        </select>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
        >
          Filtrează
        </button>
      </form>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50 text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">CUI</th>
              <th className="px-4 py-3 font-medium">Denumire</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Localitate</th>
              <th className="px-4 py-3 font-medium">Scor</th>
              <th className="px-4 py-3 font-medium">Sync ONRC</th>
              <th className="px-4 py-3 font-medium">Check ANAF</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.cui}</td>
                <td className="px-4 py-3">
                  <Link href={`/firma/${c.cui}`} className="text-primary hover:underline" target="_blank">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <StatusChip status={c.status} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{c.city}{c.county ? `, ${c.county}` : ""}</td>
                <td className="px-4 py-3 font-bold">{c.companyScore}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(c.lastOnrcSyncAt)}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(c.lastAnafCheckAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex gap-2">
        {page > 1 && (
          <Link
            href={`/admin/companies?q=${q}&status=${status}&p=${page - 1}`}
            className="px-3 py-1.5 rounded-lg border border-border hover:bg-secondary text-sm transition-colors"
          >
            ← Anterior
          </Link>
        )}
        {rows.length === limit && (
          <Link
            href={`/admin/companies?q=${q}&status=${status}&p=${page + 1}`}
            className="px-3 py-1.5 rounded-lg border border-border hover:bg-secondary text-sm transition-colors"
          >
            Următor →
          </Link>
        )}
      </div>
    </div>
  )
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    activa: "text-emerald-400 bg-emerald-500/10",
    inactiva: "text-yellow-400 bg-yellow-500/10",
    radiata: "text-red-400 bg-red-500/10",
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? ""}`}>
      {status}
    </span>
  )
}
