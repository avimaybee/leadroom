CREATE INDEX `activities_lead_id_timestamp_idx` ON `activities` (`lead_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `leads_status_updated_at_idx` ON `leads` (`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `tasks_status_due_date_idx` ON `tasks` (`status`,`due_date`);