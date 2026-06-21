CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`job_run_id` text,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`status` text NOT NULL,
	`is_read` integer DEFAULT false NOT NULL,
	`link` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `stage_thresholds` (
	`id` text PRIMARY KEY NOT NULL,
	`stage` text NOT NULL,
	`days` integer DEFAULT 5 NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stage_thresholds_stage_unique` ON `stage_thresholds` (`stage`);--> statement-breakpoint
ALTER TABLE `leads` ADD `stage_updated_at` integer;--> statement-breakpoint
ALTER TABLE `leads` ADD `last_activity_at` integer;--> statement-breakpoint
UPDATE `leads` SET `stage_updated_at` = CAST(strftime('%s', 'now') AS INTEGER), `last_activity_at` = CAST(strftime('%s', 'now') AS INTEGER) WHERE `stage_updated_at` IS NULL;