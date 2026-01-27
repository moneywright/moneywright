CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`institution` text,
	`account_number` text,
	`account_name` text,
	`product_name` text,
	`statement_password` text,
	`currency` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `accounts_profile_id_idx` ON `accounts` (`profile_id`);--> statement-breakpoint
CREATE INDEX `accounts_user_id_idx` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `app_config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`is_encrypted` text DEFAULT '0' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chat_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text,
	`user_id` text NOT NULL,
	`title` text,
	`summary` text,
	`summary_up_to_message_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chat_conversations_profile_id_idx` ON `chat_conversations` (`profile_id`);--> statement-breakpoint
CREATE INDEX `chat_conversations_user_id_idx` ON `chat_conversations` (`user_id`);--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text,
	`provider` text,
	`model` text,
	`tool_calls` text,
	`tool_results` text,
	`reasoning` text,
	`approval_state` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `chat_conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chat_messages_conversation_id_idx` ON `chat_messages` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `chat_messages_created_at_idx` ON `chat_messages` (`created_at`);--> statement-breakpoint
CREATE TABLE `chat_query_cache` (
	`query_id` text PRIMARY KEY NOT NULL,
	`profile_id` text,
	`data_type` text NOT NULL,
	`filters` text NOT NULL,
	`count` integer NOT NULL,
	`data` text NOT NULL,
	`schema` text NOT NULL,
	`data_size_bytes` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `chat_query_cache_profile_id_idx` ON `chat_query_cache` (`profile_id`);--> statement-breakpoint
CREATE TABLE `investment_holdings` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text,
	`profile_id` text NOT NULL,
	`user_id` text NOT NULL,
	`investment_type` text NOT NULL,
	`symbol` text,
	`name` text NOT NULL,
	`isin` text,
	`units` real,
	`average_cost` real,
	`current_price` real,
	`current_value` real NOT NULL,
	`invested_value` real,
	`gain_loss` real,
	`gain_loss_percent` real,
	`folio_number` text,
	`maturity_date` text,
	`interest_rate` real,
	`currency` text NOT NULL,
	`as_of_date` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `investment_sources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `investment_holdings_source_id_idx` ON `investment_holdings` (`source_id`);--> statement-breakpoint
CREATE INDEX `investment_holdings_profile_id_idx` ON `investment_holdings` (`profile_id`);--> statement-breakpoint
CREATE INDEX `investment_holdings_user_id_idx` ON `investment_holdings` (`user_id`);--> statement-breakpoint
CREATE INDEX `investment_holdings_investment_type_idx` ON `investment_holdings` (`investment_type`);--> statement-breakpoint
CREATE TABLE `investment_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text,
	`profile_id` text NOT NULL,
	`user_id` text NOT NULL,
	`snapshot_date` text NOT NULL,
	`snapshot_type` text NOT NULL,
	`total_invested` real,
	`total_current` real NOT NULL,
	`total_gain_loss` real,
	`gain_loss_percent` real,
	`holdings_count` integer NOT NULL,
	`holdings_detail` text,
	`currency` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `investment_sources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `investment_snapshots_source_id_idx` ON `investment_snapshots` (`source_id`);--> statement-breakpoint
CREATE INDEX `investment_snapshots_profile_id_idx` ON `investment_snapshots` (`profile_id`);--> statement-breakpoint
CREATE INDEX `investment_snapshots_user_id_idx` ON `investment_snapshots` (`user_id`);--> statement-breakpoint
CREATE INDEX `investment_snapshots_date_idx` ON `investment_snapshots` (`snapshot_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `investment_snapshots_source_date_unique` ON `investment_snapshots` (`source_id`,`snapshot_date`);--> statement-breakpoint
CREATE TABLE `investment_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`user_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_name` text NOT NULL,
	`institution` text,
	`account_identifier` text,
	`country_code` text DEFAULT 'IN' NOT NULL,
	`currency` text DEFAULT 'INR' NOT NULL,
	`last_statement_date` text,
	`last_sync_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `investment_sources_profile_id_idx` ON `investment_sources` (`profile_id`);--> statement-breakpoint
CREATE INDEX `investment_sources_user_id_idx` ON `investment_sources` (`user_id`);--> statement-breakpoint
CREATE INDEX `investment_sources_source_type_idx` ON `investment_sources` (`source_type`);--> statement-breakpoint
CREATE TABLE `investment_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text,
	`holding_id` text,
	`profile_id` text NOT NULL,
	`user_id` text NOT NULL,
	`transaction_type` text NOT NULL,
	`symbol` text,
	`name` text NOT NULL,
	`units` real,
	`price_per_unit` real,
	`amount` real NOT NULL,
	`fees` real,
	`transaction_date` text NOT NULL,
	`settlement_date` text,
	`description` text,
	`currency` text NOT NULL,
	`hash` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `investment_sources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`holding_id`) REFERENCES `investment_holdings`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `investment_transactions_source_id_idx` ON `investment_transactions` (`source_id`);--> statement-breakpoint
CREATE INDEX `investment_transactions_holding_id_idx` ON `investment_transactions` (`holding_id`);--> statement-breakpoint
CREATE INDEX `investment_transactions_profile_id_idx` ON `investment_transactions` (`profile_id`);--> statement-breakpoint
CREATE INDEX `investment_transactions_user_id_idx` ON `investment_transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `investment_transactions_date_idx` ON `investment_transactions` (`transaction_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `investment_transactions_source_hash_unique` ON `investment_transactions` (`source_id`,`hash`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`relationship` text,
	`summary` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `profiles_user_id_idx` ON `profiles` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_user_id_name_unique` ON `profiles` (`user_id`,`name`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`refresh_token_hash` text NOT NULL,
	`fingerprint_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`absolute_expires_at` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`last_used_at` text DEFAULT (datetime('now')) NOT NULL,
	`revoked_at` text,
	`user_agent` text,
	`ip_address` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_token_hash_idx` ON `sessions` (`refresh_token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `statements` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text,
	`source_id` text,
	`profile_id` text NOT NULL,
	`user_id` text NOT NULL,
	`document_type` text DEFAULT 'bank_statement' NOT NULL,
	`original_filename` text NOT NULL,
	`file_type` text NOT NULL,
	`file_size_bytes` integer,
	`period_start` text,
	`period_end` text,
	`opening_balance` real,
	`closing_balance` real,
	`status` text DEFAULT 'pending' NOT NULL,
	`error_message` text,
	`summary` text,
	`transaction_count` integer DEFAULT 0,
	`holdings_count` integer,
	`parse_started_at` text,
	`parse_completed_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `investment_sources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `statements_account_id_idx` ON `statements` (`account_id`);--> statement-breakpoint
CREATE INDEX `statements_source_id_idx` ON `statements` (`source_id`);--> statement-breakpoint
CREATE INDEX `statements_profile_id_idx` ON `statements` (`profile_id`);--> statement-breakpoint
CREATE INDEX `statements_user_id_idx` ON `statements` (`user_id`);--> statement-breakpoint
CREATE INDEX `statements_status_idx` ON `statements` (`status`);--> statement-breakpoint
CREATE INDEX `statements_document_type_idx` ON `statements` (`document_type`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`statement_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text NOT NULL,
	`balance` real,
	`original_description` text NOT NULL,
	`summary` text,
	`category` text NOT NULL,
	`category_confidence` real,
	`is_subscription` integer,
	`hash` text NOT NULL,
	`linked_transaction_id` text,
	`link_type` text,
	`is_manually_categorized` integer DEFAULT false,
	`is_hidden` integer DEFAULT false,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`statement_id`) REFERENCES `statements`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `transactions_account_id_idx` ON `transactions` (`account_id`);--> statement-breakpoint
CREATE INDEX `transactions_statement_id_idx` ON `transactions` (`statement_id`);--> statement-breakpoint
CREATE INDEX `transactions_profile_id_idx` ON `transactions` (`profile_id`);--> statement-breakpoint
CREATE INDEX `transactions_user_id_idx` ON `transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `transactions_date_idx` ON `transactions` (`date`);--> statement-breakpoint
CREATE INDEX `transactions_category_idx` ON `transactions` (`category`);--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_account_hash_unique` ON `transactions` (`account_id`,`hash`);--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`profile_id` text,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_preferences_user_id_idx` ON `user_preferences` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_preferences_profile_id_idx` ON `user_preferences` (`profile_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_preferences_user_profile_key_unique` ON `user_preferences` (`user_id`,`profile_id`,`key`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text,
	`name` text,
	`picture` text,
	`google_id` text,
	`country` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_id_unique` ON `users` (`google_id`);--> statement-breakpoint
CREATE INDEX `users_google_id_idx` ON `users` (`google_id`);--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);