#!/usr/bin/env npx tsx
/**
 * Run locally: npx tsx scripts/import-onrc.ts
 * This imports all Romanian companies directly from data.gov.ro into Neon.
 * Run from your machine — bypasses Vercel's network restrictions.
 */

import { config } from "dotenv"
config({ path: ".env.local" })

import { parse } from "csv-parse"
import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "../lib/db/schema"
import { companies, syncJobs } from "../lib/db/schema"
import { sql, eq } from "drizzle-orm"

const db = drizzle(neon(process.env.DATABASE_URL!), { schema })
const INSERT_CHUNK = 500

async function getLatestUrls() {
  const res = await fetch(
    "https://data.gov.ro/api/3/action/package_search?q=firme+registrul+comertului&rows=1&sort=metadata_modified+desc"
  )
  const json = await res.json()
  const latestId = json.result.results[0].name
  console.log(`Using dataset: ${latestId}`)

  const detail = await fetch(`https://data.gov.ro/api/3/action/package_show?id=${latestId}`)
  const detailJson = await detail.json()
  const resources: { url: string }[] = detailJson.result.resources

  const firme = resources.find((r) => r.url.endsWith("od_firme.csv"))?.url
  const stare = resources.find((r) => r.url.endsWith("od_stare_firma.csv"))?.url
  if (!firme || !stare) throw new Error("CSV files not found in dataset")
  return { firme, stare }
}

async function main() {
  const [job] = await db.insert(syncJobs).values({ type: "onrc_bulk", status: "running", startedAt: new Date() }).returning()
  console.log(`Job ID: ${job.id}`)

  let rowsProcessed = 0
  try {
    const urls = await getLatestUrls()

    // Load status map from small file
    console.log("Loading status map...")
    const stareRes = await fetch(urls.stare)
    const stareText = await stareRes.text()
    const stareMap = new Map<string, string>()
    for (const line of stareText.split("\n").slice(1)) {
      const [cod, status] = line.split("^")
      if (cod?.trim()) stareMap.set(cod.trim(), (status ?? "").trim())
    }
    console.log(`Status map loaded: ${stareMap.size} entries`)

    // Stream main file
    console.log("Streaming od_firme.csv...")
    const firmeRes = await fetch(urls.firme)
    if (!firmeRes.ok || !firmeRes.body) throw new Error(`Failed to fetch firme: ${firmeRes.status}`)

    type Row = typeof companies.$inferInsert
    let buffer: Row[] = []

    async function flush() {
      if (!buffer.length) return
      const chunk = buffer.splice(0)
      await db.insert(companies).values(chunk).onConflictDoUpdate({
        target: companies.cui,
        set: {
          name: sql`EXCLUDED.name`,
          status: sql`EXCLUDED.status`,
          legalForm: sql`EXCLUDED.legal_form`,
          county: sql`EXCLUDED.county`,
          city: sql`EXCLUDED.city`,
          address: sql`EXCLUDED.address`,
          caenCode: sql`EXCLUDED.caen_code`,
          caenDescription: sql`EXCLUDED.caen_description`,
          registrationDate: sql`EXCLUDED.registration_date`,
          jNumber: sql`EXCLUDED.j_number`,
          lastOnrcSyncAt: sql`EXCLUDED.last_onrc_sync_at`,
          updatedAt: sql`EXCLUDED.updated_at`,
        },
      })
      rowsProcessed += chunk.length
      if (rowsProcessed % 10000 < INSERT_CHUNK) {
        process.stdout.write(`\r  ${rowsProcessed.toLocaleString()} rows inserted...`)
        await db.update(syncJobs).set({ rowsProcessed }).where(eq(syncJobs.id, job.id))
      }
    }

    await new Promise<void>((resolve, reject) => {
      const parser = parse({ columns: true, skip_empty_lines: true, trim: true, bom: true, delimiter: "^", quote: false })

      parser.on("readable", async () => {
        let record: Record<string, string>
        while ((record = parser.read()) !== null) {
          const row = mapRow(record, stareMap)
          if (row) buffer.push(row)
          if (buffer.length >= INSERT_CHUNK) {
            parser.pause()
            await flush().catch(reject)
            parser.resume()
          }
        }
      })

      parser.on("end", async () => {
        await flush().catch(reject)
        resolve()
      })

      parser.on("error", reject)

      const reader = firmeRes.body!.getReader()
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read()
          if (done) { parser.end(); break }
          parser.write(Buffer.from(value))
        }
      }
      pump().catch(reject)
    })

    console.log(`\nBuilding search vectors...`)
    await db.execute(
      sql`UPDATE companies SET search_vector = to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(cui,'') || ' ' || coalesce(city,'')) WHERE search_vector IS NULL`
    )

    await db.update(syncJobs).set({ status: "done", finishedAt: new Date(), rowsProcessed }).where(eq(syncJobs.id, job.id))
    console.log(`\nDone! ${rowsProcessed.toLocaleString()} companies imported.`)
  } catch (err) {
    await db.update(syncJobs).set({ status: "failed", finishedAt: new Date(), errorMsg: String(err) }).where(eq(syncJobs.id, job.id))
    console.error("Failed:", err)
    process.exit(1)
  }
}

main()

function mapRow(r: Record<string, string>, stareMap: Map<string, string>) {
  const name = (r.DENUMIRE ?? "").trim()
  if (!name) return null
  const cui = (r.CUI ?? "").replace(/^RO/, "").trim()
  const jNumber = (r.COD_INMATRICULARE ?? "").trim() || null
  if (!cui && !jNumber) return null
  const statusCode = jNumber ? stareMap.get(jNumber) : undefined
  const address = [
    r.ADR_DEN_STRADA, r.ADR_NR_STRADA,
    r.ADR_BLOC ? `Bl. ${r.ADR_BLOC}` : "",
    r.ADR_SCARA ? `Sc. ${r.ADR_SCARA}` : "",
    r.ADR_APARTAMENT ? `Ap. ${r.ADR_APARTAMENT}` : "",
    r.ADR_SECTOR ? `Sector ${r.ADR_SECTOR}` : "",
  ].filter(Boolean).join(", ") || null
  return {
    cui: cui || `_${jNumber}`,
    jNumber,
    name,
    status: mapStatusCode(statusCode),
    legalForm: (r.FORMA_JURIDICA ?? "").trim() || null,
    county: (r.ADR_JUDET ?? "").trim() || null,
    city: (r.ADR_LOCALITATE ?? "").trim() || null,
    address,
    caenCode: null as null,
    caenDescription: null as null,
    registrationDate: parseDate(r.DATA_INMATRICULARE),
    companyScore: 0,
    lastOnrcSyncAt: new Date(),
    updatedAt: new Date(),
  }
}

function mapStatusCode(code: string | undefined): string {
  if (!code) return "activa"
  if (code === "1048") return "activa"
  if (code === "1084" || code === "1085") return "radiata"
  return "inactiva"
}

function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null
  const parts = raw.trim().split("/")
  if (parts.length === 3) {
    const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}
