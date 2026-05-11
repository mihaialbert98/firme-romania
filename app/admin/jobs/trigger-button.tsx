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
      {label}
    </button>
  )
}

export function FullSyncButton() {
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState("")
  const router = useRouter()

  async function triggerSync(type: string) {
    const res = await fetch("/api/admin/trigger-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    })
    const data = await res.json()
    return data.jobId as number
  }

  async function waitForDone(jobId: number): Promise<boolean> {
    for (let i = 0; i < 300; i++) {
      await new Promise((r) => setTimeout(r, 3000))
      const res = await fetch(`/api/admin/job-status?id=${jobId}`)
      const data = await res.json()
      if (data.status === "done") return true
      if (data.status === "failed") return false
    }
    return false
  }

  async function runFullSync() {
    setLoading(true)
    try {
      setStep("Importând date ONRC (firme)...")
      const onrcId = await triggerSync("onrc_bulk")
      router.refresh()
      const onrcOk = await waitForDone(onrcId)
      if (!onrcOk) { setStep("ONRC a eșuat. Verifică joburile."); return }

      setStep("Îmbogățind date ANAF...")
      const anafId = await triggerSync("anaf_daily")
      router.refresh()
      await waitForDone(anafId)

      setStep("Importând situații financiare...")
      const finId = await triggerSync("financials_annual")
      router.refresh()
      await waitForDone(finId)

      setStep("Sync complet!")
      router.refresh()
    } finally {
      setLoading(false)
      setTimeout(() => setStep(""), 4000)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {step && <span className="text-xs text-primary animate-pulse">{step}</span>}
      <button
        onClick={runFullSync}
        disabled={loading}
        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm disabled:opacity-50"
      >
        <Play className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
        Sync complet
      </button>
    </div>
  )
}
