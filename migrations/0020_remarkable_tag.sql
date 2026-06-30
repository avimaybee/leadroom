CREATE TABLE `learning_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`suggested_change` text,
	`supporting_evidence` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`reviewed_at` integer,
	`reviewed_by_user_id` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `outcomes` (
	`id` text PRIMARY KEY NOT NULL,
	`prospect_id` text NOT NULL,
	`outreach_draft_id` text,
	`outcome_type` text NOT NULL,
	`notes` text,
	`logged_by_user_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`prospect_id`) REFERENCES `prospects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`outreach_draft_id`) REFERENCES `outreach_drafts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`logged_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `outcomes_prospect_id_outcome_type_idx` ON `outcomes` (`prospect_id`,`outcome_type`);--> statement-breakpoint
ALTER TABLE `outreach_drafts` ADD `cited_evidence` text;--> statement-breakpoint
ALTER TABLE `outreach_drafts` ADD `risk_flags` text;--> statement-breakpoint
ALTER TABLE `outreach_drafts` ADD `rejection_reason` text;