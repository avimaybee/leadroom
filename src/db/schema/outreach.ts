import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users, prospects } from './core';
import { workspaces } from './strategy';

export const outreachDrafts = sqliteTable('outreach_drafts', {
  id: text('id').primaryKey(),
  leadId: text('lead_id').notNull().references(() => prospects.id),
  channel: text('channel').notNull(),
  subject: text('subject'),
  body: text('body').notNull(),
  status: text('status').notNull().default('DRAFT'),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  origin: text('origin').notNull().default('AI_GENERATED'),
  createdByUserId: text('created_by_user_id').references(() => users.id),
  citedEvidence: text('cited_evidence'),
  riskFlags: text('risk_flags'),
  rejectionReason: text('rejection_reason'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  attachments: text('attachments'),
}, (table) => ({
  leadIdIndex: index('outreach_drafts_lead_id_idx').on(table.leadId),
  statusIndex: index('outreach_drafts_status_idx').on(table.status),
}));

export const approvals = sqliteTable('approvals', {
  id: text('id').primaryKey(),
  draftId: text('draft_id').notNull().references(() => outreachDrafts.id),
  userId: text('user_id').notNull().references(() => users.id),
  decision: text('decision').notNull(),
  feedback: text('feedback'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const outcomes = sqliteTable('outcomes', {
  id: text('id').primaryKey(),
  prospectId: text('prospect_id').notNull().references(() => prospects.id),
  outreachDraftId: text('outreach_draft_id').references(() => outreachDrafts.id),
  outcomeType: text('outcome_type', { enum: ['REPLIED', 'MEETING_BOOKED', 'BOUNCED', 'NOT_INTERESTED', 'WON', 'LOST'] }).notNull(),
  notes: text('notes'),
  loggedByUserId: text('logged_by_user_id').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  prospectOutcomeTypeIndex: index('outcomes_prospect_id_outcome_type_idx').on(table.prospectId, table.outcomeType),
}));

export const learningSuggestions = sqliteTable('learning_suggestions', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  suggestedChange: text('suggested_change'),
  supportingEvidence: text('supporting_evidence'),
  status: text('status', { enum: ['PENDING', 'APPLIED', 'DISMISSED'] }).notNull().default('PENDING'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
  reviewedByUserId: text('reviewed_by_user_id').references(() => users.id),
});
