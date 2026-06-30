-- Migration number: 0018 	 2026-06-29T08:58:50.867Z

CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE TABLE `offers` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL REFERENCES workspaces(id),
	`name` text NOT NULL,
	`target_pain` text,
	`desired_outcome` text,
	`proof_points` text,
	`forbidden_claims` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE TABLE `icp_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL REFERENCES workspaces(id),
	`name` text NOT NULL,
	`positive_signals` text,
	`negative_signals` text,
	`disqualifiers` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE TABLE `markets` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL REFERENCES workspaces(id),
	`name` text NOT NULL,
	`icp_profile_id` text REFERENCES icp_profiles(id),
	`offer_id` text REFERENCES offers(id),
	`status` text DEFAULT 'active',
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE INDEX `markets_workspace_id_status_idx` ON `markets` (`workspace_id`, `status`);
--> statement-breakpoint
ALTER TABLE `leads` RENAME TO `prospects`;
--> statement-breakpoint
DROP INDEX IF EXISTS `leads_status_updated_at_idx`;
--> statement-breakpoint
CREATE INDEX `prospects_status_updated_at_idx` ON `prospects` (`status`, `updated_at`);
--> statement-breakpoint
ALTER TABLE `prospects` ADD COLUMN `workspace_id` text REFERENCES `workspaces`(`id`);
--> statement-breakpoint
ALTER TABLE `prospects` ADD COLUMN `market_id` text REFERENCES `markets`(`id`);
--> statement-breakpoint
ALTER TABLE `prospects` ADD COLUMN `fit_score` integer;
--> statement-breakpoint
ALTER TABLE `prospects` ADD COLUMN `confidence_score` integer;
--> statement-breakpoint
ALTER TABLE `prospects` ADD COLUMN `priority_tier` text;
--> statement-breakpoint
ALTER TABLE `prospects` ADD COLUMN `disqualified_reason` text;
