CREATE TABLE `lead_stage_history` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`from_stage` text,
	`to_stage` text NOT NULL,
	`timestamp` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
