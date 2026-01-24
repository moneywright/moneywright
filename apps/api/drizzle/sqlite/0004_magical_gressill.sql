CREATE TABLE `chat_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
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
	`profile_id` text NOT NULL,
	`filters` text NOT NULL,
	`count` integer NOT NULL,
	`total_size` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `chat_query_cache_profile_id_idx` ON `chat_query_cache` (`profile_id`);