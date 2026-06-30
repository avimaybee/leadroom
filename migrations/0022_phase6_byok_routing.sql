ALTER TABLE provider_configs ADD COLUMN is_research_active integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE provider_configs ADD COLUMN is_scoring_active integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE provider_configs ADD COLUMN is_drafting_active integer DEFAULT 0;
