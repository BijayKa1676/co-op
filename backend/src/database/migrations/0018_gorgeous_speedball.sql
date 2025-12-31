CREATE TABLE "pitch_decks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"startup_id" uuid,
	"filename" varchar(500) NOT NULL,
	"original_name" varchar(500) NOT NULL,
	"storage_path" varchar(1000) NOT NULL,
	"file_size" integer NOT NULL,
	"page_count" integer DEFAULT 0,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"analysis" jsonb DEFAULT '{}'::jsonb,
	"extracted_text" text,
	"slide_summaries" jsonb DEFAULT '[]'::jsonb,
	"investor_type" varchar(50),
	"target_raise" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"analyzed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "cap_table_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cap_table_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"round_type" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'planned' NOT NULL,
	"target_raise" numeric(20, 2),
	"amount_raised" numeric(20, 2) DEFAULT '0',
	"pre_money_valuation" numeric(20, 2),
	"post_money_valuation" numeric(20, 2),
	"price_per_share" numeric(20, 6),
	"shares_issued" bigint DEFAULT 0,
	"valuation_cap" numeric(20, 2),
	"discount_rate" numeric(5, 2),
	"interest_rate" numeric(5, 2),
	"round_date" date,
	"close_date" date,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cap_table_scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cap_table_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"results" jsonb DEFAULT '{}'::jsonb,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cap_table_shareholders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cap_table_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"shareholder_type" varchar(50) NOT NULL,
	"common_shares" bigint DEFAULT 0 NOT NULL,
	"preferred_shares" bigint DEFAULT 0 NOT NULL,
	"options_granted" bigint DEFAULT 0 NOT NULL,
	"options_vested" bigint DEFAULT 0 NOT NULL,
	"options_exercised" bigint DEFAULT 0 NOT NULL,
	"vesting_start_date" date,
	"vesting_cliff_months" integer DEFAULT 12,
	"vesting_total_months" integer DEFAULT 48,
	"investment_amount" numeric(20, 2),
	"investment_date" date,
	"share_price" numeric(20, 6),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cap_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"startup_id" uuid,
	"name" varchar(255) DEFAULT 'Main Cap Table' NOT NULL,
	"description" text,
	"company_name" varchar(255) NOT NULL,
	"incorporation_date" date,
	"authorized_shares" bigint DEFAULT 10000000 NOT NULL,
	"total_issued_shares" bigint DEFAULT 0 NOT NULL,
	"fully_diluted_shares" bigint DEFAULT 0 NOT NULL,
	"current_valuation" numeric(20, 2),
	"price_per_share" numeric(20, 6),
	"options_pool_size" bigint DEFAULT 0,
	"options_pool_allocated" bigint DEFAULT 0,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pitch_decks" ADD CONSTRAINT "pitch_decks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitch_decks" ADD CONSTRAINT "pitch_decks_startup_id_startups_id_fk" FOREIGN KEY ("startup_id") REFERENCES "public"."startups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cap_table_rounds" ADD CONSTRAINT "cap_table_rounds_cap_table_id_cap_tables_id_fk" FOREIGN KEY ("cap_table_id") REFERENCES "public"."cap_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cap_table_scenarios" ADD CONSTRAINT "cap_table_scenarios_cap_table_id_cap_tables_id_fk" FOREIGN KEY ("cap_table_id") REFERENCES "public"."cap_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cap_table_shareholders" ADD CONSTRAINT "cap_table_shareholders_cap_table_id_cap_tables_id_fk" FOREIGN KEY ("cap_table_id") REFERENCES "public"."cap_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cap_tables" ADD CONSTRAINT "cap_tables_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cap_tables" ADD CONSTRAINT "cap_tables_startup_id_startups_id_fk" FOREIGN KEY ("startup_id") REFERENCES "public"."startups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pitch_decks_user_id" ON "pitch_decks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pitch_decks_startup_id" ON "pitch_decks" USING btree ("startup_id");--> statement-breakpoint
CREATE INDEX "idx_pitch_decks_status" ON "pitch_decks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_pitch_decks_created_at" ON "pitch_decks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_cap_rounds_cap_table" ON "cap_table_rounds" USING btree ("cap_table_id");--> statement-breakpoint
CREATE INDEX "idx_cap_rounds_status" ON "cap_table_rounds" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_cap_scenarios_cap_table" ON "cap_table_scenarios" USING btree ("cap_table_id");--> statement-breakpoint
CREATE INDEX "idx_cap_shareholders_cap_table" ON "cap_table_shareholders" USING btree ("cap_table_id");--> statement-breakpoint
CREATE INDEX "idx_cap_shareholders_type" ON "cap_table_shareholders" USING btree ("shareholder_type");--> statement-breakpoint
CREATE INDEX "idx_cap_tables_user_id" ON "cap_tables" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_cap_tables_startup_id" ON "cap_tables" USING btree ("startup_id");