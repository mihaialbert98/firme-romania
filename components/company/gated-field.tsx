import Link from "next/link"
import { Lock } from "lucide-react"

interface GatedFieldProps {
  value: string | null | undefined
  authenticated: boolean
  placeholder?: string
}

export function GatedField({ value, authenticated, placeholder = "Disponibil după autentificare" }: GatedFieldProps) {
  if (authenticated) {
    return <span>{value ?? "—"}</span>
  }
  return (
    <span className="relative inline-flex items-center gap-1.5 group">
      <span className="blur-sm select-none text-foreground/80 pointer-events-none" aria-hidden>
        {value ?? "Str. Exemplu nr. 1, Sector 1"}
      </span>
      <Link
        href="/register"
        className="absolute inset-0 flex items-center gap-1 justify-center rounded bg-background/60 backdrop-blur-[2px] text-xs text-primary hover:text-primary/80 transition-colors"
      >
        <Lock className="size-3" />
        <span className="sr-only md:not-sr-only">{placeholder}</span>
      </Link>
    </span>
  )
}
