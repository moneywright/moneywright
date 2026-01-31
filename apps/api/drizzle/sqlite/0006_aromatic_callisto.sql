CREATE TABLE `pin_config` (
	`id` text PRIMARY KEY NOT NULL,
	`pin_hash` text NOT NULL,
	`backup_code_hash` text NOT NULL,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
