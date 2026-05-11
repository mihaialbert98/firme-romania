"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw, Play } from "lucide-react"

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
      {loading ? "Se rulează..." : label}
    </button>
  )
}

export function FullSyncButton() {
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState("")
  const router = useRouter()

  async function triggerAndWait(type: string): Promise<boolean> {
    const res = await fetch("/api/admin/trigger-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    })
    const data = await res.json()
    return data.status === "done"
  }

  async function runFullSync() {
    setLoading(true)
    try {
      setStep("1/3 — Importând firme din ONRC...")
      const onrcOk = await triggerAndWait("onrc_bulk")
      router.refresh()
      if (!onrcOk) { setStep("ONRC a eșuat. Verifică joburile."); return }

      setStep("2/3 — Îmbogățind date ANAF...")
      await triggerAndWait("anaf_daily")
      router.refresh()

      setStep("3/3 — Importând situații financiare...")
      await triggerAndWait("financials_annual")
      router.refresh()

      setStep("✓ Sync complet!")
      setTimeout(() => setStep(""), 4000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {step && <span className="text-xs text-primary">{step}</span>}
      <button
        onClick={runFullSync}
        disabled={loading}
        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm disabled:opacity-50"
      >
        <Play className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Se sincronizează..." : "Sync complet"}
      </button>
    </div>
  )
}
