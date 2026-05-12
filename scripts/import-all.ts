#!/usr/bin/env npx tsx
/**
 * Run all imports in sequence: ONRC companies, then financial statements.
 * Usage: pnpm import:all
 *        pnpm import:all 2023   # import financials for a specific year
 */

import { execSync } from "child_process"

const year = process.argv[2] ?? String(new Date().getFullYear() - 1)

function run(label: string, cmd: string) {
  console.log(`\n${"=".repeat(60)}`)
  console.log(`▶ ${label}`)
  console.log("=".repeat(60))
  execSync(cmd, { stdio: "inherit", env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=8192" } })
}

run("Step 1/2: Importing ONRC companies", "tsx scripts/import-onrc.ts")
run(`Step 2/2: Importing financials (${year})`, `tsx scripts/import-financials.ts ${year}`)

console.log("\n✓ All imports complete.")
