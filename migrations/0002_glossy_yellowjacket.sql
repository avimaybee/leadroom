ALTER TABLE `candidate_leads` ADD `triage_priority` text DEFAULT 'UNASSESSED' NOT NULL;--> statement-breakpoint
ALTER TABLE `candidate_leads` ADD `triage_reason` text;