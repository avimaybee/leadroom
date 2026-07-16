import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { prospects } from './core';

export const researchTasks = sqliteTable('research_tasks', {
  id: text('id').primaryKey(),
  prospectId: text('prospect_id').notNull().references(() => prospects.id),
  taskType: text('task_type', { enum: ['WEBSITE_ANALYST', 'ICP_FIT', 'PAIN_EXTRACTOR', 'DISQUALIFIER_CHECK'] }).notNull(),
  status: text('status', { enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'] }).notNull().default('PENDING'),
  rawArtifacts: text('raw_artifacts', { mode: 'json' }),
  extractedSignals: text('extracted_signals', { mode: 'json' }),
  confidence: integer('confidence'),
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').default(0),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  prospectTaskTypeIndex: index('research_tasks_prospect_id_task_type_idx').on(table.prospectId, table.taskType),
  statusIndex: index('research_tasks_status_idx').on(table.status),
}));
