DROP INDEX `chat_query_cache_expires_at_idx`;--> statement-breakpoint
ALTER TABLE `chat_query_cache` DROP COLUMN `expires_at`;