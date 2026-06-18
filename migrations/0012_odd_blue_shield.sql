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
CREATE INDEX `idx_activities_lead_id` ON `activities` (`lead_id`);--> statement-breakpoint
CREATE INDEX `idx_lead_stage_history_lead_id` ON `lead_stage_history` (`lead_id`);--> statement-breakpoint
CREATE INDEX `idx_leads_status` ON `leads` (`status`);--> statement-breakpoint
CREATE INDEX `idx_leads_updated_at` ON `leads` (`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_notes_lead_id` ON `notes` (`lead_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_lead_id` ON `tasks` (`lead_id`);--> statement-breakpoint
CREATE INDEX `idx_contacts_lead_id` ON `contacts` (`lead_id`);--> statement-breakpoint
CREATE INDEX `idx_job_runs_target_lead_id` ON `job_runs` (`target_lead_id`);--> statement-breakpoint
CREATE INDEX `idx_research_snapshots_lead_id` ON `research_snapshots` (`lead_id`);--> statement-breakpoint
CREATE INDEX `idx_audits_lead_id` ON `audits` (`lead_id`);--> statement-breakpoint
CREATE INDEX `idx_lead_scores_lead_id` ON `lead_scores` (`lead_id`);--> statement-breakpoint
CREATE INDEX `idx_outreach_drafts_lead_id` ON `outreach_drafts` (`lead_id`);