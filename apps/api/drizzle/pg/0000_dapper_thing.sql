CREATE TABLE "accounts" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"profile_id" varchar(21) NOT NULL,
	"user_id" varchar(21) NOT NULL,
	"type" varchar(50) NOT NULL,
	"institution" text,
	"account_number" text,
	"account_name" text,
	"product_name" text,
	"statement_password" text,
	"currency" varchar(3) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_config" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"is_encrypted" text DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_conversations" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"profile_id" varchar(21) NOT NULL,
	"user_id" varchar(21) NOT NULL,
	"title" text,
	"summary" text,
	"summary_up_to_message_id" varchar(21),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"conversation_id" varchar(21) NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text,
	"provider" varchar(50),
	"model" varchar(100),
	"tool_calls" text,
	"tool_results" text,
	"reasoning" text,
	"approval_state" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_query_cache" (
	"query_id" varchar(50) PRIMARY KEY NOT NULL,
	"profile_id" varchar(21) NOT NULL,
	"data_type" varchar(50) NOT NULL,
	"filters" text NOT NULL,
	"count" integer NOT NULL,
	"data" text NOT NULL,
	"schema" text NOT NULL,
	"data_size_bytes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investment_holdings" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"source_id" varchar(21),
	"profile_id" varchar(21) NOT NULL,
	"user_id" varchar(21) NOT NULL,
	"investment_type" varchar(50) NOT NULL,
	"symbol" varchar(50),
	"name" text NOT NULL,
	"isin" varchar(20),
	"units" numeric(18, 6),
	"average_cost" numeric(15, 4),
	"current_price" numeric(15, 4),
	"current_value" numeric(15, 2) NOT NULL,
	"invested_value" numeric(15, 2),
	"gain_loss" numeric(15, 2),
	"gain_loss_percent" numeric(8, 4),
	"folio_number" text,
	"maturity_date" date,
	"interest_rate" numeric(6, 3),
	"currency" varchar(3) NOT NULL,
	"as_of_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investment_snapshots" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"source_id" varchar(21),
	"profile_id" varchar(21) NOT NULL,
	"user_id" varchar(21) NOT NULL,
	"snapshot_date" date NOT NULL,
	"snapshot_type" varchar(20) NOT NULL,
	"total_invested" numeric(15, 2),
	"total_current" numeric(15, 2) NOT NULL,
	"total_gain_loss" numeric(15, 2),
	"gain_loss_percent" numeric(8, 4),
	"holdings_count" integer NOT NULL,
	"holdings_detail" jsonb,
	"currency" varchar(3) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "investment_snapshots_source_date_unique" UNIQUE("source_id","snapshot_date")
);
--> statement-breakpoint
CREATE TABLE "investment_sources" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"profile_id" varchar(21) NOT NULL,
	"user_id" varchar(21) NOT NULL,
	"source_type" varchar(50) NOT NULL,
	"source_name" text NOT NULL,
	"institution" text,
	"account_identifier" text,
	"country_code" varchar(2) DEFAULT 'IN' NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"last_statement_date" date,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investment_transactions" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"source_id" varchar(21),
	"holding_id" varchar(21),
	"profile_id" varchar(21) NOT NULL,
	"user_id" varchar(21) NOT NULL,
	"transaction_type" varchar(20) NOT NULL,
	"symbol" varchar(50),
	"name" text NOT NULL,
	"units" numeric(18, 6),
	"price_per_unit" numeric(15, 4),
	"amount" numeric(15, 2) NOT NULL,
	"fees" numeric(15, 2),
	"transaction_date" date NOT NULL,
	"settlement_date" date,
	"description" text,
	"currency" varchar(3) NOT NULL,
	"hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "investment_transactions_source_hash_unique" UNIQUE("source_id","hash")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"user_id" varchar(21) NOT NULL,
	"name" varchar(50) NOT NULL,
	"relationship" varchar(20),
	"summary" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_user_id_name_unique" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"user_id" varchar(21) NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"fingerprint_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"absolute_expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"user_agent" text,
	"ip_address" text
);
--> statement-breakpoint
CREATE TABLE "statements" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"account_id" varchar(21),
	"source_id" varchar(21),
	"profile_id" varchar(21) NOT NULL,
	"user_id" varchar(21) NOT NULL,
	"document_type" varchar(30) DEFAULT 'bank_statement' NOT NULL,
	"original_filename" text NOT NULL,
	"file_type" varchar(10) NOT NULL,
	"file_size_bytes" integer,
	"period_start" date,
	"period_end" date,
	"opening_balance" numeric(15, 2),
	"closing_balance" numeric(15, 2),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"summary" jsonb,
	"transaction_count" integer DEFAULT 0,
	"holdings_count" integer,
	"parse_started_at" timestamp with time zone,
	"parse_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"account_id" varchar(21) NOT NULL,
	"statement_id" varchar(21) NOT NULL,
	"profile_id" varchar(21) NOT NULL,
	"user_id" varchar(21) NOT NULL,
	"date" date NOT NULL,
	"type" varchar(10) NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"balance" numeric(15, 2),
	"original_description" text NOT NULL,
	"summary" text,
	"category" varchar(50) NOT NULL,
	"category_confidence" numeric(3, 2),
	"is_subscription" boolean,
	"hash" varchar(64) NOT NULL,
	"linked_transaction_id" varchar(21),
	"link_type" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_account_hash_unique" UNIQUE("account_id","hash")
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"user_id" varchar(21) NOT NULL,
	"profile_id" varchar(21),
	"key" varchar(100) NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_user_profile_key_unique" UNIQUE("user_id","profile_id","key")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"email" text,
	"name" text,
	"picture" text,
	"google_id" text,
	"country" varchar(2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_holdings" ADD CONSTRAINT "investment_holdings_source_id_investment_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."investment_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_holdings" ADD CONSTRAINT "investment_holdings_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_holdings" ADD CONSTRAINT "investment_holdings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_snapshots" ADD CONSTRAINT "investment_snapshots_source_id_investment_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."investment_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_snapshots" ADD CONSTRAINT "investment_snapshots_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_snapshots" ADD CONSTRAINT "investment_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_sources" ADD CONSTRAINT "investment_sources_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_sources" ADD CONSTRAINT "investment_sources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_source_id_investment_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."investment_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_holding_id_investment_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."investment_holdings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statements" ADD CONSTRAINT "statements_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statements" ADD CONSTRAINT "statements_source_id_investment_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."investment_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statements" ADD CONSTRAINT "statements_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statements" ADD CONSTRAINT "statements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_statement_id_statements_id_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."statements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_profile_id_idx" ON "accounts" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_conversations_profile_id_idx" ON "chat_conversations" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "chat_conversations_user_id_idx" ON "chat_conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_messages_conversation_id_idx" ON "chat_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "chat_messages_created_at_idx" ON "chat_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "chat_query_cache_profile_id_idx" ON "chat_query_cache" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "investment_holdings_source_id_idx" ON "investment_holdings" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "investment_holdings_profile_id_idx" ON "investment_holdings" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "investment_holdings_user_id_idx" ON "investment_holdings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "investment_holdings_investment_type_idx" ON "investment_holdings" USING btree ("investment_type");--> statement-breakpoint
CREATE INDEX "investment_snapshots_source_id_idx" ON "investment_snapshots" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "investment_snapshots_profile_id_idx" ON "investment_snapshots" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "investment_snapshots_user_id_idx" ON "investment_snapshots" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "investment_snapshots_date_idx" ON "investment_snapshots" USING btree ("snapshot_date");--> statement-breakpoint
CREATE INDEX "investment_sources_profile_id_idx" ON "investment_sources" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "investment_sources_user_id_idx" ON "investment_sources" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "investment_sources_source_type_idx" ON "investment_sources" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "investment_transactions_source_id_idx" ON "investment_transactions" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "investment_transactions_holding_id_idx" ON "investment_transactions" USING btree ("holding_id");--> statement-breakpoint
CREATE INDEX "investment_transactions_profile_id_idx" ON "investment_transactions" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "investment_transactions_user_id_idx" ON "investment_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "investment_transactions_date_idx" ON "investment_transactions" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "profiles_user_id_idx" ON "profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_token_hash_idx" ON "sessions" USING btree ("refresh_token_hash");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "statements_account_id_idx" ON "statements" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "statements_source_id_idx" ON "statements" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "statements_profile_id_idx" ON "statements" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "statements_user_id_idx" ON "statements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "statements_status_idx" ON "statements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "statements_document_type_idx" ON "statements" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "transactions_account_id_idx" ON "transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "transactions_statement_id_idx" ON "transactions" USING btree ("statement_id");--> statement-breakpoint
CREATE INDEX "transactions_profile_id_idx" ON "transactions" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "transactions_user_id_idx" ON "transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transactions_date_idx" ON "transactions" USING btree ("date");--> statement-breakpoint
CREATE INDEX "transactions_category_idx" ON "transactions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "user_preferences_user_id_idx" ON "user_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_preferences_profile_id_idx" ON "user_preferences" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "users_google_id_idx" ON "users" USING btree ("google_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");