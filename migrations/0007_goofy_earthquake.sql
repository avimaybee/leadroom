-- Requires SQLite >= 3.35.0 (DROP COLUMN added in SQLite 3.35.0, released 2021-03-12)
ALTER TABLE `leads` DROP COLUMN `triage_priority`;--> statement-breakpoint
ALTER TABLE `leads` DROP COLUMN `triage_reason`;--> statement-breakpoint
ALTER TABLE `candidate_leads` DROP COLUMN `triage_priority`;--> statement-breakpoint
ALTER TABLE `candidate_leads` DROP COLUMN `triage_reason`;--> statement-breakpoint
ALTER TABLE `audits` DROP COLUMN `website_quality_score`;--> statement-breakpoint
ALTER TABLE `audits` DROP COLUMN `design_aesthetic_score`;--> statement-breakpoint
ALTER TABLE `audits` DROP COLUMN `messaging_clarity_score`;--> statement-breakpoint
ALTER TABLE `audits` DROP COLUMN `social_presence_score`;--> statement-breakpoint
ALTER TABLE `audits` DROP COLUMN `overall_branding_score`;--> statement-breakpoint
ALTER TABLE `audits` DROP COLUMN `is_modern`;--> statement-breakpoint
ALTER TABLE `audits` DROP COLUMN `triage_reason`;