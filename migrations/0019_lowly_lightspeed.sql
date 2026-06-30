CREATE TABLE `research_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`prospect_id` text NOT NULL,
	`task_type` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`raw_artifacts` text,
	`extracted_signals` text,
	`confidence` integer,
	`error_message` text,
	`retry_count` integer DEFAULT 0,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`prospect_id`) REFERENCES `prospects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `research_tasks_prospect_id_task_type_idx` ON `research_tasks` (`prospect_id`,`task_type`);--> statement-breakpoint
CREATE INDEX `research_tasks_status_idx` ON `research_tasks` (`status`);