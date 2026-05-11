"use client"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import type { Financial } from "@/lib/db/schema"
import { formatCurrency } from "@/lib/utils"

export function FinancialsChart({ data }: { data: Financial[] }) {
  if (!data.length) return null

  const sorted = [...data].sort((a, b) => a.year - b.year)
  const chartData = sorted.map((f) => ({
    year: String(f.year),
    turnover: f.turnover ?? 0,
    profit: f.profitLoss ?? 0,
  }))

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-muted-foreground mb-2">Cifra de afaceri (RON)</p>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={chartData} barSize={16}>
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              formatter={(v) => [formatCurrency(Number(v)), "CA"]}
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              cursor={{ fill: "hsl(var(--secondary))" }}
            />
            <Bar dataKey="turnover" radius={4}>
              {chartData.map((_, i) => (
                <Cell key={i} fill="hsl(var(--primary))" opacity={i === chartData.length - 1 ? 1 : 0.5} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-2">Profit / pierdere (RON)</p>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={chartData} barSize={16}>
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              formatter={(v) => [formatCurrency(Number(v)), "Profit"]}
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              cursor={{ fill: "hsl(var(--secondary))" }}
            />
            <Bar dataKey="profit" radius={4}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.profit >= 0 ? "hsl(var(--primary))" : "#f87171"} opacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
