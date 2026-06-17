import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users, leads } from './core';

export const outreachDrafts = sqliteTable('outreach_drafts', {
  id: text('id').primaryKey(),
  leadId: text('lead_id').notNull().references(() => leads.id),
  channel: text('channel').notNull(), // 'EMAIL' | 'LINKEDIN' | 'CALL' | 'MEETING'
  subject: text('subject'),
  body: text('body').notNull(),
  status: text('status').notNull().default('DRAFT'), // 'DRAFT' | 'APPROVED' | 'REJECTED' | 'SENT'
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  origin: text('origin').notNull().default('AI_GENERATED'), // 'AI_GENERATED' | 'MANUAL'
  createdByUserId: text('created_by_user_id').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  attachments: text('attachments'),
});

export const approvals = sqliteTable('approvals', {
  id: text('id').primaryKey(),
  draftId: text('draft_id').notNull().references(() => outreachDrafts.id),
  userId: text('user_id').notNull().references(() => users.id),
  decision: text('decision').notNull(), // 'APPROVED' | 'REJECTED'
  feedback: text('feedback'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});
