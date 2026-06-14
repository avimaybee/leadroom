CREATE TABLE `approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_id` text NOT NULL,
	`user_id` text NOT NULL,
	`decision` text NOT NULL,
	`feedback` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`draft_id`) REFERENCES `outreach_drafts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `outreach_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`channel` text NOT NULL,
	`subject` text,
	`body` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`created_by_user_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
