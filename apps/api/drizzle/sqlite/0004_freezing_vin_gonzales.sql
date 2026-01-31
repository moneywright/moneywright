ALTER TABLE `transactions` RENAME COLUMN "linked_transaction_id" TO "linked_entity_id";--> statement-breakpoint
ALTER TABLE `transactions` ADD `linked_entity_type` text;--> statement-breakpoint
ALTER TABLE `transactions` DROP COLUMN `link_type`;