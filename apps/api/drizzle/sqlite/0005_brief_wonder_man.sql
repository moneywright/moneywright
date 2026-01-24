PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_chat_query_cache` (
	`query_id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`data_type` text NOT NULL,
	`filters` text NOT NULL,
	`count` integer NOT NULL,
	`data` text NOT NULL,
	`schema` text NOT NULL,
	`data_size_bytes` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_chat_query_cache`("query_id", "profile_id", "data_type", "filters", "count", "data", "schema", "data_size_bytes", "created_at", "expires_at") SELECT "query_id", "profile_id", "data_type", "filters", "count", "data", "schema", "data_size_bytes", "created_at", "expires_at" FROM `chat_query_cache`;--> statement-breakpoint
DROP TABLE `chat_query_cache`;--> statement-breakpoint
ALTER TABLE `__new_chat_query_cache` RENAME TO `chat_query_cache`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `chat_query_cache_profile_id_idx` ON `chat_query_cache` (`profile_id`);--> statement-breakpoint
CREATE INDEX `chat_query_cache_expires_at_idx` ON `chat_query_cache` (`expires_at`);