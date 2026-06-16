ALTER TABLE `job_runs` ADD `total_items` integer;--> statement-breakpoint
ALTER TABLE `job_runs` ADD `items_processed` integer;--> statement-breakpoint
ALTER TABLE `job_runs` ADD `current_stage` text;--> statement-breakpoint
ALTER TABLE `job_runs` ADD `external_run_id` text;--> statement-breakpoint
ALTER TABLE `job_runs` ADD `job_meta` text;
