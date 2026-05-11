import type { Company, Financial } from "@/lib/db/schema"

export function computeScore(company: Company, latestFinancial?: Financial | null): number {
  let score = 0
  if (company.status === "activa") score += 30
  if (company.vatRegistered) score += 20
  if (!company.inactive) score += 15
  if (latestFinancial) {
    score += 15
    if (latestFinancial.turnover && latestFinancial.turnover > 0) score += 10
    if (latestFinancial.employees && latestFinancial.employees > 0) score += 10
  }
  return Math.min(100, score)
}

export function scoreLabel(score: number): string {
  if (score >= 80) return "Excelent"
  if (score >= 60) return "Bun"
  if (score >= 40) return "Mediu"
  if (score >= 20) return "Slab"
  return "Critic"
}

export function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400"
  if (score >= 60) return "text-green-400"
  if (score >= 40) return "text-yellow-400"
  if (score >= 20) return "text-orange-400"
  return "text-red-400"
}

export function scoreBg(score: number): string {
  if (score >= 80) return "bg-emerald-400"
  if (score >= 60) return "bg-green-400"
  if (score >= 40) return "bg-yellow-400"
  if (score >= 20) return "bg-orange-400"
  return "bg-red-400"
}
