import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users, prospects } from './core';
import { jobRuns } from './research';

export const audits = sqliteTable('audits', {
  id: text('id').primaryKey(),
  leadId: text('lead_id').notNull().references(() => prospects.id),
  createdByUserId: text('created_by_user_id').references(() => users.id),
  origin: text('origin').notNull().default('AI_GENERATED'), // 'MANUAL' | 'AI_GENERATED'
  keyStrengths: text('key_strengths'), // Markdown-enabled text or paragraph
  keyWeaknesses: text('key_weaknesses'), // Markdown-enabled text or paragraph
  recommendedImprovements: text('recommended_improvements'), // Markdown-enabled text or paragraph
  opportunityNotes: text('opportunity_notes'), // Hypotheses or comments
  contentHash: text('content_hash'),
  sources: text('sources', { mode: 'json' }), // JSON array of URLs
  jobRunId: text('job_run_id').references(() => jobRuns.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  leadIdIndex: index('audits_lead_id_idx').on(table.leadId),
}));

export const leadScores = sqliteTable('lead_scores', {
  id: text('id').primaryKey(),
  leadId: text('lead_id').notNull().references(() => prospects.id),
  scoreValue: integer('score_value').notNull(), // 0 to 100
  scoreLabel: text('score_label'), // 'High' | 'Medium' | 'Low'
  rationaleSummary: text('rationale_summary'), // Explanation of the score
  factors: text('factors', { mode: 'json' }), // JSON object listing scoring sub-weights or factors
  origin: text('origin').notNull().default('RULE_BASED'), // 'RULE_BASED' | 'AI_SUGGESTED' | 'MANUAL_OVERRIDE'
  isCurrent: integer('is_current').notNull().default(1), // 1 = true, 0 = false
  createdByUserId: text('created_by_user_id').references(() => users.id),
  jobRunId: text('job_run_id').references(() => jobRuns.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  leadIdIsCurrentIndex: index('lead_scores_lead_id_is_current_idx').on(table.leadId, table.isCurrent),
  createdAtIsCurrentIndex: index('lead_scores_created_at_is_current_idx').on(table.createdAt, table.isCurrent),
}));
