import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const leads = sqliteTable('leads', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  company: text('company'),
  email: text('email'),
  phone: text('phone'),
  website: text('website'),
  city: text('city'),
  region: text('region'),
  industry: text('industry'),
  stage: text('stage').notNull().default('New'),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  status: text('status').notNull().default('Active'),
  ownerId: text('owner_id').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  stageUpdatedAt: integer('stage_updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  lastActivityAt: integer('last_activity_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  ownerIdIdx: index('leads_owner_id_idx').on(table.ownerId),
  stageIdx: index('leads_stage_idx').on(table.stage),
  statusIdx: index('leads_status_idx').on(table.status),
  ownerStageIdx: index('leads_owner_stage_idx').on(table.ownerId, table.stage),
  ownerStatusIdx: index('leads_owner_status_idx').on(table.ownerId, table.status),
}));

export const stageThresholds = sqliteTable('stage_thresholds', {
  id: text('id').primaryKey(),
  stage: text('stage').notNull().unique(),
  days: integer('days').notNull().default(5),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  leadId: text('lead_id').references(() => leads.id),
  dueDate: integer('due_date', { mode: 'timestamp' }),
  status: text('status').notNull().default('Open'),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  priority: text('priority').notNull().default('Medium'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
}, (table) => ({
  leadIdIdx: index('tasks_lead_id_idx').on(table.leadId),
  statusIdx: index('tasks_status_idx').on(table.status),
  leadIdStatusIdx: index('tasks_lead_status_idx').on(table.leadId, table.status),
}));

export const notes = sqliteTable('notes', {
  id: text('id').primaryKey(),
  leadId: text('lead_id').notNull().references(() => leads.id),
  authorId: text('author_id').references(() => users.id),
  body: text('body').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  leadIdIdx: index('notes_lead_id_idx').on(table.leadId),
  authorIdIdx: index('notes_author_id_idx').on(table.authorId),
}));

export const activities = sqliteTable('activities', {
  id: text('id').primaryKey(),
  leadId: text('lead_id').notNull().references(() => leads.id),
  type: text('type').notNull(),
  summary: text('summary').notNull(),
  metadata: text('metadata', { mode: 'json' }).$type<{
    from_stage?: string;
    to_stage?: string;
    [key: string]: any;
  }>(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  leadIdIdx: index('activities_lead_id_idx').on(table.leadId),
  timestampIdx: index('activities_timestamp_idx').on(table.timestamp),
}));

export const leadStageHistory = sqliteTable('lead_stage_history', {
  id: text('id').primaryKey(),
  leadId: text('lead_id').notNull().references(() => leads.id),
  stage: text('stage').notNull(),
  enteredAt: integer('entered_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  exitedAt: integer('exited_at', { mode: 'timestamp' }),
}, (table) => ({
  leadIdIdx: index('lead_stage_history_lead_id_idx').on(table.leadId),
}));

export const activityMetadata = sqliteTable('activity_metadata', {
  id: text('id').primaryKey(),
  activityId: text('activity_id').notNull().references(() => activities.id),
  metadata: text('metadata').notNull(),
}, (table) => ({
  activityIdIdx: index('activity_metadata_activity_id_idx').on(table.activityId),
}));

export const providerConfigs = sqliteTable('provider_configs', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull().unique(), // 'gemini' | 'nvidia'
  apiKey: text('api_key').notNull(),
  modelName: text('model_name').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  jobRunId: text('job_run_id'), // can reference jobRuns, but they are in research.ts. Better just leave it as text and link logically.
  title: text('title').notNull(),
  message: text('message').notNull(),
  status: text('status').notNull(), // 'SUCCESS', 'ERROR', 'INFO'
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  link: text('link'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  userIdIdx: index('notifications_user_id_idx').on(table.userId),
  jobRunIdIdx: index('notifications_job_run_id_idx').on(table.jobRunId),
  userIsReadIdx: index('notifications_user_is_read_idx').on(table.userId, table.isRead),
}));
