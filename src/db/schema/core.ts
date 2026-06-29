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
  scoreDirty: integer('score_dirty', { mode: 'boolean' }).default(true).notNull(),
}, (table) => ({
  statusUpdatedAtIndex: index('leads_status_updated_at_idx').on(table.status, table.updatedAt),
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
  assigneeId: text('assignee_id').references(() => users.id),
  category: text('category'),
  source: text('source'),
  playbookId: text('playbook_id').references(() => playbooks.id),
  googleCalendarEventId: text('google_calendar_event_id'),
  googleCalendarSyncStatus: text('google_calendar_sync_status').default('PENDING'),
  googleCalendarSyncError: text('google_calendar_sync_error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
}, (table) => ({
  statusDueDateIndex: index('tasks_status_due_date_idx').on(table.status, table.dueDate),
  leadIdIndex: index('tasks_lead_id_idx').on(table.leadId),
  assigneeStatusIndex: index('tasks_assignee_status_idx').on(table.assigneeId, table.status),
}));

export const notes = sqliteTable('notes', {
  id: text('id').primaryKey(),
  leadId: text('lead_id').notNull().references(() => leads.id),
  authorId: text('author_id').references(() => users.id),
  body: text('body').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  leadIdIndex: index('notes_lead_id_idx').on(table.leadId),
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
  leadIdTimestampIndex: index('activities_lead_id_timestamp_idx').on(table.leadId, table.timestamp),
}));

export const leadStageHistory = sqliteTable('lead_stage_history', {
  id: text('id').primaryKey(),
  leadId: text('lead_id').notNull().references(() => leads.id),
  stage: text('stage').notNull(),
  enteredAt: integer('entered_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  exitedAt: integer('exited_at', { mode: 'timestamp' }),
}, (table) => ({
  leadIdStageIdx: index('lead_stage_history_lead_id_stage_idx').on(table.leadId, table.stage),
  leadIdExitedAtIdx: index('lead_stage_history_lead_id_exited_at_idx').on(table.leadId, table.exitedAt),
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

export const pipelineConfig = sqliteTable('pipeline_config', {
  id: text('id').primaryKey().default('global'),
  enforceStageOrder: integer('enforce_stage_order', { mode: 'boolean' }).notNull().default(false),
  nbaRules: text('nba_rules'),
  stageRequirements: text('stage_requirements', { mode: 'json' }).$type<Record<string, string[]>>().default({}),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const googleCalendarTokens = sqliteTable('google_calendar_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique().references(() => users.id),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  scope: text('scope'),
  tokenType: text('token_type').default('Bearer'),
  expiryDate: integer('expiry_date', { mode: 'timestamp' }),
  googleClientId: text('google_client_id'),
  googleClientSecret: text('google_client_secret'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const reminders = sqliteTable('reminders', {
  id: text('id').primaryKey(),
  leadId: text('lead_id').references(() => leads.id),
  userId: text('user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  message: text('message'),
  remindAt: integer('remind_at', { mode: 'timestamp' }).notNull(),
  isFired: integer('is_fired', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  link: text('link'),
}, (table) => ({
  remindAtFiredIndex: index('reminders_remind_at_fired_idx').on(table.remindAt, table.isFired),
}));

export const nbaActionLogs = sqliteTable('nba_action_logs', {
  id: text('id').primaryKey(),
  leadId: text('lead_id').notNull().references(() => leads.id),
  userId: text('user_id').notNull().references(() => users.id),
  signal: text('signal').notNull(),
  actionTakenAt: integer('action_taken_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  resultStageTarget: text('result_stage_target'),
  resultStageReachedAt: integer('result_stage_reached_at', { mode: 'timestamp' }),
}, (table) => ({
  leadIdSignalIdx: index('nba_action_logs_lead_id_signal_idx').on(table.leadId, table.signal, table.resultStageTarget),
  leadIdActionTakenAtIdx: index('nba_action_logs_lead_id_action_taken_at_idx').on(table.leadId, table.actionTakenAt),
}));

export const playbooks = sqliteTable('playbooks', {
  id: text('id').primaryKey(),
  stage: text('stage').notNull().unique(),
  name: text('name').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const playbookTasks = sqliteTable('playbook_tasks', {
  id: text('id').primaryKey(),
  playbookId: text('playbook_id').notNull().references(() => playbooks.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  daysOffset: integer('days_offset').notNull(),
  priority: text('priority').notNull().default('Medium'),
  category: text('category'),
  actionType: text('action_type').notNull().default('TASK'),
  jobType: text('job_type'),
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
  userIdCreatedAtIndex: index('notifications_user_id_created_at_idx').on(table.userId, table.createdAt),
}));
