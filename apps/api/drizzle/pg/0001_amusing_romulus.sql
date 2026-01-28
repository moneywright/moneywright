CREATE TABLE "insurance_policies" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"profile_id" varchar(21) NOT NULL,
	"user_id" varchar(21) NOT NULL,
	"policy_type" varchar(30) NOT NULL,
	"provider" text NOT NULL,
	"policy_number" text,
	"policy_holder_name" text,
	"sum_insured" numeric(15, 2),
	"premium_amount" numeric(15, 2),
	"premium_frequency" varchar(20),
	"start_date" date,
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
ALTER TABLE "insurance_policies" ADD CONSTRAINT "insurance_policies_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurance_policies" ADD CONSTRAINT "insurance_policies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "insurance_policies_profile_id_idx" ON "insurance_policies" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "insurance_policies_user_id_idx" ON "insurance_policies" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "insurance_policies_policy_type_idx" ON "insurance_policies" USING btree ("policy_type");--> statement-breakpoint
CREATE INDEX "insurance_policies_status_idx" ON "insurance_policies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "insurance_policies_end_date_idx" ON "insurance_policies" USING btree ("end_date");