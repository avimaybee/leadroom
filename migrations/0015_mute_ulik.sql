CREATE TABLE `playbooks` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`trigger_stage` text NOT NULL,
	`delay_hours` integer NOT NULL,
	`task_title` text NOT NULL,
	`task_description` text,
	`task_priority` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
