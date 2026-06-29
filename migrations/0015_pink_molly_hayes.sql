CREATE TABLE `google_calendar_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text,
	`scope` text,
	`token_type` text DEFAULT 'Bearer',
	`expiry_date` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `google_calendar_tokens_user_id_unique` ON `google_calendar_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `nba_action_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`user_id` text NOT NULL,
	`signal` text NOT NULL,
	`action_taken_at` integer DEFAULT (strftime('%s', 'now')),
	`result_stage_target` text,
	`result_stage_reached_at` integer,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `playbook_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`playbook_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`days_offset` integer NOT NULL,
	`priority` text DEFAULT 'Medium' NOT NULL,
	`category` text,
	FOREIGN KEY (`playbook_id`) REFERENCES `playbooks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `playbooks` (
	`id` text PRIMARY KEY NOT NULL,
	`stage` text NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `playbooks_stage_unique` ON `playbooks` (`stage`);--> statement-breakpoint
ALTER TABLE `pipeline_config` ADD `stage_requirements` text DEFAULT '{}';--> statement-breakpoint
ALTER TABLE `tasks` ADD `source` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `playbook_id` text REFERENCES playbooks(id);--> statement-breakpoint
ALTER TABLE `tasks` ADD `google_calendar_event_id` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `google_calendar_sync_status` text DEFAULT 'PENDING';--> statement-breakpoint
ALTER TABLE `tasks` ADD `google_calendar_sync_error` text;