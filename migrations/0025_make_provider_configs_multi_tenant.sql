ALTER TABLE `provider_configs` RENAME TO `provider_configs_old`;
--> statement-breakpoint
CREATE TABLE `provider_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`api_key` text NOT NULL,
	`model_name` text NOT NULL,
	`user_id` text NOT NULL,
	`is_research_active` integer DEFAULT 0,
	`is_scoring_active` integer DEFAULT 0,
	`is_drafting_active` integer DEFAULT 0,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `provider_configs` (`id`, `provider`, `api_key`, `model_name`, `user_id`, `is_research_active`, `is_scoring_active`, `is_drafting_active`, `created_at`, `updated_at`)
  SELECT `id`, `provider`, `api_key`, `model_name`, '' AS `user_id`, `is_research_active`, `is_scoring_active`, `is_drafting_active`, `created_at`, `updated_at`
  FROM `provider_configs_old`;
--> statement-breakpoint
DROP TABLE `provider_configs_old`;
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_user_idx` ON `provider_configs` (`provider`,`user_id`);
