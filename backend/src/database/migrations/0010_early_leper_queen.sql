DROP TABLE "investor_notable_exits" CASCADE;--> statement-breakpoint
DROP TABLE "investor_portfolio_companies" CASCADE;--> statement-breakpoint
DROP TABLE "investor_regions" CASCADE;--> statement-breakpoint
DROP TABLE "investor_sectors" CASCADE;--> statement-breakpoint
ALTER TABLE "investors" ADD COLUMN "sectors" text NOT NULL;--> statement-breakpoint
ALTER TABLE "investors" ADD COLUMN "regions" text;--> statement-breakpoint
ALTER TABLE "investors" DROP COLUMN "metadata";