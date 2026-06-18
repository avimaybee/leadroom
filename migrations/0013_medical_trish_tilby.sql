ALTER TABLE `lead_stage_history` ADD `previous_stage` text;--> statement-breakpoint
ALTER TABLE `lead_stage_history` ADD `changed_by` text REFERENCES users(id);