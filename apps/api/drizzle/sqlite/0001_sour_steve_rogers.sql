ALTER TABLE `transactions` ADD `is_manually_categorized` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `transactions` ADD `is_hidden` integer DEFAULT false;