ALTER TABLE `leads` ADD `is_read` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `is_read` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `outreach_drafts` ADD `is_read` integer DEFAULT false NOT NULL;