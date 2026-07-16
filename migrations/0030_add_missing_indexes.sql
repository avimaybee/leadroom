-- Add all indexes declared in schema but never migrated (Council A4)
-- These were identified by comparing schema index() declarations vs existing migrations.

CREATE INDEX `prospects_owner_id_idx` ON `prospects` (`owner_id`);
CREATE INDEX `prospects_owner_id_fit_score_idx` ON `prospects` (`owner_id`, `fit_score`);
CREATE INDEX `prospects_status_score_dirty_idx` ON `prospects` (`status`, `score_dirty`);
CREATE INDEX `prospects_owner_id_status_updated_at_idx` ON `prospects` (`owner_id`, `status`, `updated_at`);
CREATE INDEX `tasks_assignee_status_due_date_idx` ON `tasks` (`assignee_id`, `status`, `due_date`);
CREATE INDEX `offers_workspace_id_idx` ON `offers` (`workspace_id`);
CREATE INDEX `icp_profiles_workspace_id_idx` ON `icp_profiles` (`workspace_id`);
CREATE INDEX `reminders_user_id_remind_at_fired_idx` ON `reminders` (`user_id`, `remind_at`, `is_fired`);
CREATE INDEX `notifications_job_run_id_created_at_idx` ON `notifications` (`job_run_id`, `created_at`);
CREATE INDEX `notifications_created_at_is_read_idx` ON `notifications` (`created_at`, `is_read`);
CREATE INDEX `discovery_scopes_created_by_user_id_created_at_idx` ON `discovery_scopes` (`created_by_user_id`, `created_at`);
CREATE INDEX `outreach_drafts_status_idx` ON `outreach_drafts` (`status`);
CREATE INDEX `outreach_drafts_lead_id_status_idx` ON `outreach_drafts` (`lead_id`, `status`);
CREATE INDEX `approvals_draft_id_idx` ON `approvals` (`draft_id`);
CREATE INDEX `learning_suggestions_workspace_id_status_idx` ON `learning_suggestions` (`workspace_id`, `status`);
CREATE INDEX `lead_scores_created_at_is_current_idx` ON `lead_scores` (`created_at`, `is_current`);
