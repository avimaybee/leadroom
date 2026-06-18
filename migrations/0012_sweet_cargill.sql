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
CREATE INDEX `activities_lead_id_timestamp_idx` ON `activities` (`lead_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `leads_status_updated_at_idx` ON `leads` (`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `tasks_status_due_date_idx` ON `tasks` (`status`,`due_date`);