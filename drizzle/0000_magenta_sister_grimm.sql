CREATE TABLE "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text
);
--> statement-breakpoint
CREATE TABLE "associates" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'associate' NOT NULL,
	"share_percent" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"cui" text NOT NULL,
	"j_number" text,
	"name" text NOT NULL,
	"status" text DEFAULT 'activa' NOT NULL,
	"legal_form" text,
	"county" text,
	"city" text,
	"address" text,
	"caen_code" text,
	"caen_description" text,
	"registration_date" timestamp,
	"deregistration_date" timestamp,
	"vat_registered" boolean DEFAULT false,
	"vat_cash_accounting" boolean DEFAULT false,
	"inactive" boolean DEFAULT false,
	"e_invoice" boolean DEFAULT false,
	"company_score" integer DEFAULT 0,
	"search_vector" "tsvector",
	"last_anaf_check_at" timestamp,
	"last_onrc_sync_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "companies_cui_unique" UNIQUE("cui")
);
--> statement-breakpoint
CREATE TABLE "company_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"event_type" text NOT NULL,
	"event_date" timestamp,
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "financials" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"year" integer NOT NULL,
	"turnover" integer,
	"profit_loss" integer,
	"total_assets" integer,
	"employees" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "uq_financials_company_year" UNIQUE("company_id","year")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp,
	"rows_processed" integer DEFAULT 0,
	"error_msg" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"image" text,
	"email_verified" timestamp,
	"password" text,
	"role" text DEFAULT 'user' NOT NULL,
	"subscription_tier" text DEFAULT 'free' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "associates" ADD CONSTRAINT "associates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_events" ADD CONSTRAINT "company_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financials" ADD CONSTRAINT "financials_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_companies_cui" ON "companies" USING btree ("cui");--> statement-breakpoint
CREATE INDEX "idx_companies_status" ON "companies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_companies_county" ON "companies" USING btree ("county");--> statement-breakpoint
CREATE INDEX "idx_companies_caen" ON "companies" USING btree ("caen_code");--> statement-breakpoint
CREATE INDEX "idx_companies_search" ON "companies" USING gin ("search_vector");