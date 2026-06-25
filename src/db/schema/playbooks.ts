import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const playbooks = sqliteTable('playbooks', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  triggerStage: text('trigger_stage').notNull(),
  delayHours: integer('delay_hours').notNull(),
  taskTitle: text('task_title').notNull(),
  taskDescription: text('task_description'),
  taskPriority: text('task_priority').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});
