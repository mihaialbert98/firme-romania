"use client"
import { scoreLabel, scoreColor, scoreBg } from "@/lib/scoring"

export function HealthScore({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 36
  const progress = (score / 100) * circumference
  const color = scoreColor(score)
  const bgColor = scoreBg(score)

  return (
    <div className="flex flex-col items-center">
      <div className="relative size-24">
        <svg className="size-24 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="36" fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
          <circle
            cx="40" cy="40" r="36" fill="none"
            stroke={`currentColor`}
            strokeWidth="6"
            strokeDasharray={`${progress} ${circumference}`}
            strokeLinecap="round"
            className={color}
            style={{ transition: "stroke-dasharray 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-2xl font-bold ${color}`}>{score}</span>
        </div>
      </div>
      <span className={`text-sm font-medium mt-1 ${color}`}>{scoreLabel(score)}</span>
      <span className="text-xs text-muted-foreground">Scor sănătate</span>
    </div>
  )
}
