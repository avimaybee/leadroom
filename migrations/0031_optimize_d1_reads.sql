-- Migration 0031: Optimize D1 read queries and sweep indexes
-- Council & Incident Fix: Fix 4M daily row reads on Cloudflare D1

-- 1. Fix notifications: Drop (created_at, is_read) where range column preceded equality column.
--    Add (is_read, created_at) index so SQLite seeks directly to read rows (is_read = 1).
DROP INDEX IF EXISTS `notifications_created_at_is_read_idx`;
CREATE INDEX IF NOT EXISTS `notifications_is_read_created_at_idx` ON `notifications` (`is_read`, `created_at`);
CREATE INDEX IF NOT EXISTS `notifications_created_at_idx` ON `notifications` (`created_at`);

-- 2. Fix lead_scores: Drop (created_at, is_current) and add (is_current, created_at).
DROP INDEX IF EXISTS `lead_scores_created_at_is_current_idx`;
CREATE INDEX IF NOT EXISTS `lead_scores_is_current_created_at_idx` ON `lead_scores` (`is_current`, `created_at`);

-- 3. Fix reminders: Drop (remind_at, is_fired) and add (is_fired, remind_at).
DROP INDEX IF EXISTS `reminders_remind_at_fired_idx`;
CREATE INDEX IF NOT EXISTS `reminders_is_fired_remind_at_idx` ON `reminders` (`is_fired`, `remind_at`);
DROP INDEX IF EXISTS `reminders_user_id_remind_at_fired_idx`;
CREATE INDEX IF NOT EXISTS `reminders_user_id_is_fired_remind_at_idx` ON `reminders` (`user_id`, `is_fired`, `remind_at`);

-- 4. Fix job_runs: Add indexes to prevent full table scans on stuck jobs sweep and pruning.
CREATE INDEX IF NOT EXISTS `job_runs_status_started_at_idx` ON `job_runs` (`status`, `started_at`);
CREATE INDEX IF NOT EXISTS `job_runs_status_created_at_idx` ON `job_runs` (`status`, `created_at`);

-- 5. Fix research_tasks: Add compound index for stuck tasks sweep.
CREATE INDEX IF NOT EXISTS `research_tasks_status_started_at_idx` ON `research_tasks` (`status`, `started_at`);

-- 6. Fix table pruning targets: Add indexes on timestamp cutoff columns to prevent full table scans.
CREATE INDEX IF NOT EXISTS `lead_stage_history_entered_at_idx` ON `lead_stage_history` (`entered_at`);
CREATE INDEX IF NOT EXISTS `nba_action_logs_action_taken_at_idx` ON `nba_action_logs` (`action_taken_at`);
CREATE INDEX IF NOT EXISTS `audits_created_at_idx` ON `audits` (`created_at`);
