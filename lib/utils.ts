import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCUI(cui: string) {
  return cui.replace(/^RO/, "")
}

export function formatNumber(n: number | null | undefined) {
  if (n == null) return "—"
  return new Intl.NumberFormat("ro-RO").format(n)
}

export function formatCurrency(n: number | null | undefined) {
  if (n == null) return "—"
  return new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(n)
}

export function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" })
}
