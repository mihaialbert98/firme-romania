import { db } from "@/lib/db"
import { companies } from "@/lib/db/schema"
import { sql, eq, ilike, or } from "drizzle-orm"

export async function searchCompanies(query: string, limit = 20, offset = 0) {
  const q = query.trim()
  if (!q) return []

  // exact CUI match first
  if (/^\d+$/.test(q)) {
    return db
      .select({
        id: companies.id,
        cui: companies.cui,
        name: companies.name,
        status: companies.status,
        city: companies.city,
        county: companies.county,
        caenCode: companies.caenCode,
        caenDescription: companies.caenDescription,
        companyScore: companies.companyScore,
        legalForm: companies.legalForm,
      })
      .from(companies)
      .where(eq(companies.cui, q))
      .limit(1)
  }

  return db
    .select({
      id: companies.id,
      cui: companies.cui,
      name: companies.name,
      status: companies.status,
      city: companies.city,
      county: companies.county,
      caenCode: companies.caenCode,
      caenDescription: companies.caenDescription,
      companyScore: companies.companyScore,
      legalForm: companies.legalForm,
    })
    .from(companies)
    .where(
      sql`${companies.searchVector} @@ plainto_tsquery('simple', ${q})`
    )
    .orderBy(sql`ts_rank(${companies.searchVector}, plainto_tsquery('simple', ${q})) DESC`)
    .limit(limit)
    .offset(offset)
}
