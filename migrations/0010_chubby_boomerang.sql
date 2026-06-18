CREATE TABLE `activity_metadata` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_id` text NOT NULL,
	`metadata` text NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE no action
);
