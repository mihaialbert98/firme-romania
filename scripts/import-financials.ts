#!/usr/bin/env npx tsx
/**
 * Imports annual financial statements from data.gov.ro (Ministerul Finantelor).
 * Run locally: pnpm import:financials
 * Source: situatii_financiare_YYYY dataset, file WEB_BL_BS_SL_AN{YYYY}.txt
 * Columns used: CUI, CAEN, i1(fixed assets), i13(turnover), i18(net profit), i19(net loss), i20(employees)
 */

import { config } from "dotenv"
config({ path: ".env.local" })

import { parse } from "csv-parse"
import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "../lib/db/schema"
import { companies, financials, syncJobs } from "../lib/db/schema"
import { sql, eq } from "drizzle-orm"

const db = drizzle(neon(process.env.DATABASE_URL!), { schema })
const INSERT_CHUNK = 500

async function getDatasetUrl(year: number): Promise<string> {
  const id = `situatii_financiare_${year}`
  const res = await fetch(`https://data.gov.ro/api/3/action/package_show?id=${id}`)
  const json = await res.json()
  if (!json.success) throw new Error(`Dataset not found: ${id}`)
  const resources: { url: string; name: string }[] = json.result.resources
  const target = `WEB_BL_BS_SL_AN${year}`
  const txt = resources.find((r) => r.name.toUpperCase().startsWith(target) && r.url.endsWith(".txt"))?.url
  if (!txt) throw new Error(`Could not find ${target}.txt in dataset ${id}`)
  return txt
}

async function main() {
  const year = parseInt(process.argv[2] ?? "") || 2024
  console.log(`Importing financials for year: ${year}`)

  const [job] = await db.insert(syncJobs).values({ type: "financials_annual", status: "running", startedAt: new Date() }).returning()
  console.log(`Job ID: ${job.id}`)

  let rowsProcessed = 0
  try {
    const url = await getDatasetUrl(year)
    console.log(`Dataset URL: ${url}`)

    // Load CUI -> company id map (paged to avoid 64MB HTTP limit)
    console.log("Loading CUI map from DB...")
    const cuiMap = new Map<string, number>()
    const PAGE = 200000
    let lastId = 0
    while (true) {
      const batch = await db.execute(sql`SELECT id, cui FROM companies WHERE id > ${lastId} ORDER BY id LIMIT ${PAGE}`)
      const rows = batch.rows as { id: number; cui: string }[]
      for (const row of rows) cuiMap.set(row.cui, row.id)
      if (rows.length < PAGE) break
      lastId = rows[rows.length - 1].id
      process.stdout.write(`\r  ${cuiMap.size.toLocaleString()} entries loaded...`)
    }
    console.log(`\nCUI map loaded: ${cuiMap.size} entries`)

    const res = await fetch(url)
    if (!res.ok || !res.body) throw new Error(`Failed to fetch: ${res.status}`)
    console.log("Streaming financial data...")

    type FinRow = typeof financials.$inferInsert
    let buffer: FinRow[] = []
    const caenUpdates: { cui: string; caen: string }[] = []

    async function flush() {
      if (!buffer.length) return
      const raw = buffer.splice(0)
      const seen = new Map<number, FinRow>()
      for (const row of raw) seen.set(row.companyId, row)
      const chunk = [...seen.values()]
      await db.insert(financials).values(chunk).onConflictDoUpdate({
        target: [financials.companyId, financials.year],
        set: {
          turnover: sql`EXCLUDED.turnover`,
          profitLoss: sql`EXCLUDED.profit_loss`,
          totalAssets: sql`EXCLUDED.total_assets`,
          employees: sql`EXCLUDED.employees`,
        },
      })
      rowsProcessed += chunk.length
      if (rowsProcessed % 50000 < INSERT_CHUNK) {
        process.stdout.write(`\r  ${rowsProcessed.toLocaleString()} rows inserted...`)
        await db.update(syncJobs).set({ rowsProcessed }).where(eq(syncJobs.id, job.id))
      }
    }

    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      delimiter: ";",
      quote: false,
    })

    const reader = res.body.getReader()
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read()
        if (done) { parser.end(); break }
        parser.write(Buffer.from(value))
      }
    }
    pump().catch(() => {})

    for await (const record of parser as AsyncIterable<Record<string, string>>) {
      const cui = (record.CUI ?? "").replace(/^RO/, "").trim()
      if (!cui) continue
      const companyId = cuiMap.get(cui)
      if (!companyId) continue

      const caen = (record.CAEN ?? "").trim()
      if (caen) caenUpdates.push({ cui, caen })

      const i13 = parseInt(record.i13) || 0 // turnover
      const i1 = parseInt(record.i1) || 0   // fixed assets (proxy for total assets)
      const i18 = parseInt(record.i18) || 0 // net profit
      const i19 = parseInt(record.i19) || 0 // net loss
      const i20 = parseInt(record.i20) || 0 // employees

      buffer.push({
        companyId,
        year,
        turnover: i13,
        profitLoss: i18 > 0 ? i18 : -i19,
        totalAssets: i1,
        employees: i20,
      })

      if (buffer.length >= INSERT_CHUNK) await flush()
    }
    await flush()

    // Bulk update CAEN codes
    if (caenUpdates.length > 0) {
      console.log(`\nUpdating CAEN codes for ${caenUpdates.length.toLocaleString()} companies...`)
      for (let i = 0; i < caenUpdates.length; i += 1000) {
        const batch = caenUpdates.slice(i, i + 1000)
        await db.execute(sql`
          UPDATE companies SET caen_code = v.caen
          FROM (VALUES ${sql.raw(batch.map(({ cui, caen }) => `('${cui.replace(/'/g, "''")}', '${caen.replace(/'/g, "''")}')`).join(","))}) AS v(cui, caen)
          WHERE companies.cui = v.cui AND (companies.caen_code IS NULL OR companies.caen_code != v.caen)
        `)
        if (i % 50000 < 1000) process.stdout.write(`\r  ${Math.min(i + 1000, caenUpdates.length).toLocaleString()} CAEN codes updated...`)
      }
    }

    await db.update(syncJobs).set({ status: "done", finishedAt: new Date(), rowsProcessed }).where(eq(syncJobs.id, job.id))
    console.log(`\nDone! ${rowsProcessed.toLocaleString()} financial records imported for ${year}.`)
  } catch (err) {
    await db.update(syncJobs).set({ status: "failed", finishedAt: new Date(), errorMsg: String(err) }).where(eq(syncJobs.id, job.id))
    console.error("Failed:", err)
    process.exit(1)
  }
}

main()
