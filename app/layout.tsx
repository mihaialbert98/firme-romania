import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: { default: "Firme România — Registrul Companiilor", template: "%s | Firme România" },
  description: "Caută informații despre orice firmă din România: CUI, stare, date financiare, administratori și multe altele.",
  keywords: ["firme romania", "registrul comertului", "cui firma", "informatii firme"],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" className={`${geistSans.variable} ${geistMono.variable} dark`}>
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  )
}
