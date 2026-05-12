import { db } from "@/lib/db"
import { companies, financials } from "@/lib/db/schema"
import { sql, eq, and, gte, lte, inArray, count } from "drizzle-orm"

export type SearchFilters = {
  q?: string
  status?: string[]
  county?: string[]
  legalForm?: string[]
  caenCode?: string
  employeesMin?: number
  employeesMax?: number
  turnoverMin?: number    // RON thousands
  turnoverMax?: number
  year?: number
}

export async function searchCompanies(filters: SearchFilters, limit = 20, offset = 0) {
  const { q, employeesMin, employeesMax, turnoverMin, turnoverMax, year } = filters

  const hasFinancialFilter = employeesMin != null || employeesMax != null || turnoverMin != null || turnoverMax != null
  const financialYear = year ?? new Date().getFullYear() - 1
  const where = buildWhereConditions(filters)

  if (hasFinancialFilter) {
    const finConditions = [eq(financials.year, financialYear)]
    if (employeesMin != null) finConditions.push(gte(financials.employees, employeesMin))
    if (employeesMax != null) finConditions.push(lte(financials.employees, employeesMax))
    if (turnoverMin != null) finConditions.push(gte(financials.turnover, turnoverMin * 1000))
    if (turnoverMax != null) finConditions.push(lte(financials.turnover, turnoverMax * 1000))

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
        employees: financials.employees,
        turnover: financials.turnover,
      })
      .from(companies)
      .innerJoin(financials, and(eq(financials.companyId, companies.id), ...finConditions))
      .where(where)
      .orderBy(
        q?.trim()
          ? sql`ts_rank(${companies.searchVector}, plainto_tsquery('simple', ${q.trim()})) DESC`
          : sql`${financials.employees} DESC NULLS LAST`
      )
      .limit(limit)
      .offset(offset)
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
      employees: sql<number | null>`null`.as("employees"),
      turnover: sql<number | null>`null`.as("turnover"),
    })
    .from(companies)
    .where(where)
    .orderBy(
      q?.trim()
        ? sql`ts_rank(${companies.searchVector}, plainto_tsquery('simple', ${q.trim()})) DESC`
        : companies.name
    )
    .limit(limit)
    .offset(offset)
}

function buildWhereConditions(filters: SearchFilters) {
  const { q, status, county, legalForm, caenCode } = filters
  const conditions = []
  if (q?.trim()) {
    const trimmed = q.trim()
    if (/^\d+$/.test(trimmed)) {
      conditions.push(eq(companies.cui, trimmed))
    } else {
      conditions.push(sql`${companies.searchVector} @@ plainto_tsquery('simple', ${trimmed})`)
    }
  }
  if (status?.length) conditions.push(inArray(companies.status, status))
  if (county?.length) conditions.push(inArray(companies.county, county))
  if (legalForm?.length) conditions.push(inArray(companies.legalForm, legalForm))
  if (caenCode) conditions.push(eq(companies.caenCode, caenCode))
  return conditions.length ? and(...conditions) : undefined
}

export async function countCompanies(filters: SearchFilters): Promise<number> {
  const { employeesMin, employeesMax, turnoverMin, turnoverMax, year } = filters
  const hasFinancialFilter = employeesMin != null || employeesMax != null || turnoverMin != null || turnoverMax != null
  const where = buildWhereConditions(filters)

  if (hasFinancialFilter) {
    const financialYear = year ?? new Date().getFullYear() - 1
    const finConditions = [eq(financials.year, financialYear)]
    if (employeesMin != null) finConditions.push(gte(financials.employees, employeesMin))
    if (employeesMax != null) finConditions.push(lte(financials.employees, employeesMax))
    if (turnoverMin != null) finConditions.push(gte(financials.turnover, turnoverMin * 1000))
    if (turnoverMax != null) finConditions.push(lte(financials.turnover, turnoverMax * 1000))
    const [row] = await db
      .select({ total: count() })
      .from(companies)
      .innerJoin(financials, and(eq(financials.companyId, companies.id), ...finConditions))
      .where(where)
    return row?.total ?? 0
  }

  const [row] = await db.select({ total: count() }).from(companies).where(where)
  return row?.total ?? 0
}
