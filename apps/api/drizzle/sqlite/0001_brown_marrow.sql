CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`institution` text,
	`account_number` text,
	`account_name` text,
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
CREATE TABLE `investments` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`institution` text,
	`name` text NOT NULL,
	`units` real,
	`purchase_value` real,
	`current_value` real,
	`currency` text NOT NULL,
	`folio_number` text,
	`account_number` text,
	`maturity_date` text,
	`interest_rate` real,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `investments_profile_id_idx` ON `investments` (`profile_id`);--> statement-breakpoint
CREATE INDEX `investments_user_id_idx` ON `investments` (`user_id`);--> statement-breakpoint
CREATE INDEX `investments_type_idx` ON `investments` (`type`);--> statement-breakpoint
CREATE TABLE `statements` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`user_id` text NOT NULL,
	`original_filename` text NOT NULL,
	`file_type` text NOT NULL,
	`file_size_bytes` integer,
	`period_start` text,
	`period_end` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`error_message` text,
	`summary` text,
	`transaction_count` integer DEFAULT 0,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `statements_account_id_idx` ON `statements` (`account_id`);--> statement-breakpoint
CREATE INDEX `statements_profile_id_idx` ON `statements` (`profile_id`);--> statement-breakpoint
CREATE INDEX `statements_user_id_idx` ON `statements` (`user_id`);--> statement-breakpoint
CREATE INDEX `statements_status_idx` ON `statements` (`status`);--> statement-breakpoint
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
	`original_description` text NOT NULL,
	`summary` text,
	`category` text NOT NULL,
	`category_confidence` real,
	`hash` text NOT NULL,
	`linked_transaction_id` text,
	`link_type` text,
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
CREATE UNIQUE INDEX `transactions_account_hash_unique` ON `transactions` (`account_id`,`hash`);