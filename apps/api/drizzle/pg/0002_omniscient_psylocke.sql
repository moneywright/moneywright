CREATE TABLE "loans" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"profile_id" varchar(21) NOT NULL,
	"user_id" varchar(21) NOT NULL,
	"loan_type" varchar(30) NOT NULL,
	"lender" text NOT NULL,
	"loan_account_number" text,
	"borrower_name" text,
	"principal_amount" numeric(15, 2),
	"interest_rate" numeric(5, 2),
	"interest_type" varchar(20),
	"emi_amount" numeric(15, 2),
	"tenure_months" integer,
	"disbursement_date" date,
	"first_emi_date" date,
	"end_date" date,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"details" jsonb,
	"original_filename" text,
	"file_type" varchar(10),
	"parse_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"raw_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" RENAME COLUMN "linked_transaction_id" TO "linked_entity_id";--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "linked_entity_type" varchar(20);--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "loans_profile_id_idx" ON "loans" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "loans_user_id_idx" ON "loans" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "loans_loan_type_idx" ON "loans" USING btree ("loan_type");--> statement-breakpoint
CREATE INDEX "loans_status_idx" ON "loans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "loans_end_date_idx" ON "loans" USING btree ("end_date");--> statement-breakpoint
ALTER TABLE "transactions" DROP COLUMN "link_type";