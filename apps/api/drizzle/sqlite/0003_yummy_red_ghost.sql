CREATE TABLE `loans` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`user_id` text NOT NULL,
	`loan_type` text NOT NULL,
	`lender` text NOT NULL,
	`loan_account_number` text,
	`borrower_name` text,
	`principal_amount` real,
	`interest_rate` real,
	`interest_type` text,
	`emi_amount` real,
	`tenure_months` integer,
	`disbursement_date` text,
	`first_emi_date` text,
	`end_date` text,
	`status` text DEFAULT 'active' NOT NULL,
	`details` text,
	`original_filename` text,
	`file_type` text,
	`parse_status` text DEFAULT 'pending' NOT NULL,
	`error_message` text,
	`raw_text` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `loans_profile_id_idx` ON `loans` (`profile_id`);--> statement-breakpoint
CREATE INDEX `loans_user_id_idx` ON `loans` (`user_id`);--> statement-breakpoint
CREATE INDEX `loans_loan_type_idx` ON `loans` (`loan_type`);--> statement-breakpoint
CREATE INDEX `loans_status_idx` ON `loans` (`status`);--> statement-breakpoint
CREATE INDEX `loans_end_date_idx` ON `loans` (`end_date`);