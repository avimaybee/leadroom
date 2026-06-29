ALTER TABLE `leads` ADD `score_dirty` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `playbook_tasks` ADD `action_type` text DEFAULT 'TASK' NOT NULL;--> statement-breakpoint
ALTER TABLE `playbook_tasks` ADD `job_type` text;--> statement-breakpoint
ALTER TABLE `discovery_scopes` ADD `auto_research_promoted_leads` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `research_snapshots` ADD `content_hash` text;--> statement-breakpoint
ALTER TABLE `audits` ADD `content_hash` text;--> statement-breakpoint
CREATE INDEX `activity_metadata_activity_id_idx` ON `activity_metadata` (`activity_id`);--> statement-breakpoint
CREATE INDEX `lead_stage_history_lead_id_stage_idx` ON `lead_stage_history` (`lead_id`,`stage`);--> statement-breakpoint
CREATE INDEX `lead_stage_history_lead_id_exited_at_idx` ON `lead_stage_history` (`lead_id`,`exited_at`);--> statement-breakpoint
CREATE INDEX `nba_action_logs_lead_id_signal_idx` ON `nba_action_logs` (`lead_id`,`signal`,`result_stage_target`);--> statement-breakpoint
CREATE INDEX `nba_action_logs_lead_id_action_taken_at_idx` ON `nba_action_logs` (`lead_id`,`action_taken_at`);