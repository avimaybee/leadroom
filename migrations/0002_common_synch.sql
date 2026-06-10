CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`full_name` text,
	`role_title` text,
	`email` text,
	`phone` text,
	`linkedin_url` text,
	`other_profile_url` text,
	`is_primary` integer DEFAULT 0 NOT NULL,
	`confidence_level` text DEFAULT 'UNKNOWN' NOT NULL,
	`source_type` text DEFAULT 'MANUAL' NOT NULL,
	`created_by_user_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	`deleted_at` integer,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `job_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`job_type` text NOT NULL,
	`status` text NOT NULL,
	`target_lead_id` text,
	`triggered_by_user_id` text,
	`error_summary` text,
	`started_at` integer,
	`finished_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`target_lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`triggered_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `research_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`created_by_user_id` text,
	`origin` text DEFAULT 'AI_GENERATED' NOT NULL,
	`snapshot_title` text,
	`company_summary` text,
	`products_services_summary` text,
	`digital_presence_notes` text,
	`website_notes` text,
	`branding_notes` text,
	`pain_points_hypotheses` text,
	`opportunity_hypotheses` text,
	`sources` text,
	`confidence_level` text DEFAULT 'UNKNOWN' NOT NULL,
	`job_run_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_run_id`) REFERENCES `job_runs`(`id`) ON UPDATE no action ON DELETE no action
);
