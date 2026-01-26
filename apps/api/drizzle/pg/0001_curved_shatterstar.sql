ALTER TABLE "transactions" ADD COLUMN "is_manually_categorized" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "is_hidden" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "is_default";