CREATE TABLE `pipeline_config` (
	`id` text PRIMARY KEY DEFAULT 'global' NOT NULL,
	`enforce_stage_order` integer DEFAULT false NOT NULL,
	`nba_rules` text,
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`message` text,
	`remind_at` integer NOT NULL,
	`is_fired` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`link` text,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reminders_remind_at_fired_idx` ON `reminders` (`remind_at`,`is_fired`);--> statement-breakpoint
ALTER TABLE `tasks` ADD `assignee_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `tasks` ADD `category` text;--> statement-breakpoint
CREATE INDEX `tasks_lead_id_idx` ON `tasks` (`lead_id`);--> statement-breakpoint
CREATE INDEX `tasks_assignee_status_idx` ON `tasks` (`assignee_id`,`status`);--> statement-breakpoint
CREATE INDEX `notes_lead_id_idx` ON `notes` (`lead_id`);--> statement-breakpoint
CREATE INDEX `notifications_user_id_created_at_idx` ON `notifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `candidate_leads_discovery_scope_id_idx` ON `candidate_leads` (`discovery_scope_id`);--> statement-breakpoint
CREATE INDEX `candidate_leads_promoted_lead_id_idx` ON `candidate_leads` (`promoted_lead_id`);--> statement-breakpoint
CREATE INDEX `contacts_lead_id_deleted_at_idx` ON `contacts` (`lead_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `job_runs_target_lead_id_job_type_status_idx` ON `job_runs` (`target_lead_id`,`job_type`,`status`);--> statement-breakpoint
CREATE INDEX `research_snapshots_lead_id_idx` ON `research_snapshots` (`lead_id`);--> statement-breakpoint
CREATE INDEX `research_snapshots_job_run_id_idx` ON `research_snapshots` (`job_run_id`);--> statement-breakpoint
CREATE INDEX `audits_lead_id_idx` ON `audits` (`lead_id`);--> statement-breakpoint
CREATE INDEX `lead_scores_lead_id_is_current_idx` ON `lead_scores` (`lead_id`,`is_current`);--> statement-breakpoint
CREATE INDEX `outreach_drafts_lead_id_idx` ON `outreach_drafts` (`lead_id`);