CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL DEFAULT 1,
	`window_start` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
