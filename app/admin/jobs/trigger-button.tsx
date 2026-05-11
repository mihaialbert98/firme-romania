"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"

export function TriggerButton({ type, label }: { type: string; label: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function trigger() {
    setLoading(true)
    await fetch("/api/admin/trigger-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    })
    setLoading(false)
    router.refresh()
  }

  return (
    <button
      onClick={trigger}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-secondary transition-colors text-sm disabled:opacity-50"
    >
      <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
      {label}
    </button>
  )
}
