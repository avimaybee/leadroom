ALTER TABLE `job_runs` ADD `external_run_id` text;--> statement-breakpoint
ALTER TABLE `job_runs` ADD `job_meta` text;--> statement-breakpoint
CREATE TABLE `audits` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`created_by_user_id` text,
	`origin` text DEFAULT 'AI_GENERATED' NOT NULL,
	`website_quality_score` integer,
	`design_aesthetic_score` integer,
	`messaging_clarity_score` integer,
	`social_presence_score` integer,
	`overall_branding_score` integer,
	`key_strengths` text,
	`key_weaknesses` text,
	`recommended_improvements` text,
	`opportunity_notes` text,
	`sources` text,
	`job_run_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_run_id`) REFERENCES `job_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `lead_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`score_value` integer NOT NULL,
	`score_label` text,
	`rationale_summary` text,
	`factors` text,
	`origin` text DEFAULT 'RULE_BASED' NOT NULL,
	`is_current` integer DEFAULT 1 NOT NULL,
	`created_by_user_id` text,
	`job_run_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_run_id`) REFERENCES `job_runs`(`id`) ON UPDATE no action ON DELETE no action
);