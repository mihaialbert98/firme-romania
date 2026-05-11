"use client"
import { signOut } from "next-auth/react"
import { LogOut } from "lucide-react"

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border hover:bg-secondary transition-colors text-sm text-muted-foreground hover:text-foreground"
      title="Deconectare"
    >
      <LogOut className="size-3.5" />
      <span className="hidden sm:inline">Ieșire</span>
    </button>
  )
}
