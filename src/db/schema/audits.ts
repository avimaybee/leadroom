import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users, leads } from './core';
import { jobRuns } from './research';

export const audits = sqliteTable('audits', {
  id: text('id').primaryKey(),
  leadId: text('lead_id').notNull().references(() => leads.id),
  createdByUserId: text('created_by_user_id').references(() => users.id),
  origin: text('origin').notNull().default('AI_GENERATED'), // 'MANUAL' | 'AI_GENERATED'
  websiteQualityScore: integer('website_quality_score'), // 0 to 100
  designAestheticScore: integer('design_aesthetic_score'), // 0 to 100
  messagingClarityScore: integer('messaging_clarity_score'), // 0 to 100
  socialPresenceScore: integer('social_presence_score'), // 0 to 100
  overallBrandingScore: integer('overall_branding_score'), // 0 to 100
  keyStrengths: text('key_strengths'), // Markdown-enabled text or paragraph
  keyWeaknesses: text('key_weaknesses'), // Markdown-enabled text or paragraph
  recommendedImprovements: text('recommended_improvements'), // Markdown-enabled text or paragraph
  opportunityNotes: text('opportunity_notes'), // Hypotheses or comments
  sources: text('sources'), // JSON stringified array of URLs
  jobRunId: text('job_run_id').references(() => jobRuns.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const leadScores = sqliteTable('lead_scores', {
  id: text('id').primaryKey(),
  leadId: text('lead_id').notNull().references(() => leads.id),
  scoreValue: integer('score_value').notNull(), // 0 to 100
  scoreLabel: text('score_label'), // 'High' | 'Medium' | 'Low'
  rationaleSummary: text('rationale_summary'), // Explanation of the score
  factors: text('factors'), // JSON object listing scoring sub-weights or factors
  origin: text('origin').notNull().default('RULE_BASED'), // 'RULE_BASED' | 'AI_SUGGESTED' | 'MANUAL_OVERRIDE'
  isCurrent: integer('is_current').notNull().default(1), // 1 = true, 0 = false
  createdByUserId: text('created_by_user_id').references(() => users.id),
  jobRunId: text('job_run_id').references(() => jobRuns.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});
