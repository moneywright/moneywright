CREATE TABLE `insurance_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`user_id` text NOT NULL,
	`policy_type` text NOT NULL,
	`provider` text NOT NULL,
	`policy_number` text,
	`policy_holder_name` text,
	`sum_insured` real,
	`premium_amount` real,
	`premium_frequency` text,
	`start_date` text,
	`end_date` text,
	`status` text DEFAULT 'active' NOT NULL,
	`details` text,
	`original_filename` text,
	`file_type` text,
	`parse_status` text DEFAULT 'pending' NOT NULL,
	`error_message` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `insurance_policies_profile_id_idx` ON `insurance_policies` (`profile_id`);--> statement-breakpoint
CREATE INDEX `insurance_policies_user_id_idx` ON `insurance_policies` (`user_id`);--> statement-breakpoint
CREATE INDEX `insurance_policies_policy_type_idx` ON `insurance_policies` (`policy_type`);--> statement-breakpoint
CREATE INDEX `insurance_policies_status_idx` ON `insurance_policies` (`status`);--> statement-breakpoint
CREATE INDEX `insurance_policies_end_date_idx` ON `insurance_policies` (`end_date`);