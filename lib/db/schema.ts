import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  serial,
  index,
  unique,
  customType,
} from "drizzle-orm/pg-core"

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector"
  },
})

export const companies = pgTable(
  "companies",
  {
    id: serial("id").primaryKey(),
    cui: text("cui").notNull().unique(),
    jNumber: text("j_number"),
    name: text("name").notNull(),
    status: text("status").notNull().default("activa"), // activa | inactiva | radiata
    legalForm: text("legal_form"),
    county: text("county"),
    city: text("city"),
    address: text("address"), // gated
    caenCode: text("caen_code"),
    caenDescription: text("caen_description"),
    registrationDate: timestamp("registration_date"),
    deregistrationDate: timestamp("deregistration_date"),
    // gated fields
    vatRegistered: boolean("vat_registered").default(false),
    vatCashAccounting: boolean("vat_cash_accounting").default(false),
    inactive: boolean("inactive").default(false),
    eInvoice: boolean("e_invoice").default(false),
    // computed
    companyScore: integer("company_score").default(0),
    searchVector: tsvector("search_vector"),
    // sync tracking
    lastAnafCheckAt: timestamp("last_anaf_check_at"),
    lastOnrcSyncAt: timestamp("last_onrc_sync_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [
    index("idx_companies_cui").on(t.cui),
    index("idx_companies_status").on(t.status),
    index("idx_companies_county").on(t.county),
    index("idx_companies_caen").on(t.caenCode),
    index("idx_companies_search").using("gin", t.searchVector),
  ]
)

export const financials = pgTable("financials", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  turnover: integer("turnover"),
  profitLoss: integer("profit_loss"),
  totalAssets: integer("total_assets"),
  employees: integer("employees"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  unique("uq_financials_company_year").on(t.companyId, t.year),
])

export const associates = pgTable("associates", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role").notNull().default("associate"), // associate | admin
  sharePercent: integer("share_percent"),
  createdAt: timestamp("created_at").defaultNow(),
})

export const companyEvents = pgTable("company_events", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  eventDate: timestamp("event_date"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
})

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  emailVerified: timestamp("email_verified"),
  password: text("password"),
  role: text("role").notNull().default("user"), // user | admin
  subscriptionTier: text("subscription_tier").notNull().default("free"),
  createdAt: timestamp("created_at").defaultNow(),
})

export const accounts = pgTable("accounts", {
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
})

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires").notNull(),
})

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires").notNull(),
})

export const syncJobs = pgTable("sync_jobs", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // onrc_bulk | anaf_daily | financials_annual
  status: text("status").notNull().default("pending"), // pending | running | done | failed
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  rowsProcessed: integer("rows_processed").default(0),
  errorMsg: text("error_msg"),
  createdAt: timestamp("created_at").defaultNow(),
})

export type Company = typeof companies.$inferSelect
export type NewCompany = typeof companies.$inferInsert
export type Financial = typeof financials.$inferSelect
export type Associate = typeof associates.$inferSelect
export type SyncJob = typeof syncJobs.$inferSelect
export type User = typeof users.$inferSelect
