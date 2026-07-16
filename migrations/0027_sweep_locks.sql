CREATE TABLE `sweep_locks` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
