CREATE TABLE `lead_stage_history` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`stage` text NOT NULL,
	`entered_at` integer DEFAULT (strftime('%s', 'now')),
	`exited_at` integer,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
