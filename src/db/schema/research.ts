import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users, leads } from './core';

export const jobRuns = sqliteTable('job_runs', {
  id: text('id').primaryKey(),
  jobType: text('job_type').notNull(), // 'ENRICHMENT' | 'RESEARCH_GENERATION' | 'AUDIT_GENERATION' | 'DISCOVERY_SEARCH'
  status: text('status').notNull(), // 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED'
  targetLeadId: text('target_lead_id').references(() => leads.id),
  triggeredByUserId: text('triggered_by_user_id').references(() => users.id),
  errorSummary: text('error_summary'),
  /** External provider job ID (e.g. Apify actor run ID) for async status polling */
  externalRunId: text('external_run_id'),
  /** JSON-serialised partial data used between polling steps (e.g. Apify datasetId) */
  jobMeta: text('job_meta').$type<string>(),
  totalItems: integer('total_items'),
  itemsProcessed: integer('items_processed'),
  currentStage: text('current_stage'),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  finishedAt: integer('finished_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  targetLeadIdJobTypeStatusIndex: index('job_runs_target_lead_id_job_type_status_idx').on(table.targetLeadId, table.jobType, table.status),
}));

export const researchSnapshots = sqliteTable('research_snapshots', {
  id: text('id').primaryKey(),
  leadId: text('lead_id').notNull().references(() => leads.id),
  createdByUserId: text('created_by_user_id').references(() => users.id),
  origin: text('origin').notNull().default('AI_GENERATED'), // 'MANUAL' | 'AI_GENERATED'
  snapshotTitle: text('snapshot_title'),
  companySummary: text('company_summary'),
  productsServicesSummary: text('products_services_summary'),
  digitalPresenceNotes: text('digital_presence_notes'),
  websiteNotes: text('website_notes'),
  brandingNotes: text('branding_notes'),
  painPointsHypotheses: text('pain_points_hypotheses'),
  opportunityHypotheses: text('opportunity_hypotheses'),
  sources: text('sources'), // JSON stringified array of string URLs
  confidenceLevel: text('confidence_level').notNull().default('UNKNOWN'), // 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN'
  userRemarks: text('user_remarks'), // Appended notes by the human operator
  jobRunId: text('job_run_id').references(() => jobRuns.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  leadIdIndex: index('research_snapshots_lead_id_idx').on(table.leadId),
  jobRunIdIndex: index('research_snapshots_job_run_id_idx').on(table.jobRunId),
}));

export const contacts = sqliteTable('contacts', {
  id: text('id').primaryKey(),
  leadId: text('lead_id').notNull().references(() => leads.id),
  fullName: text('full_name'),
  roleTitle: text('role_title'),
  email: text('email'),
  phone: text('phone'),
  linkedinUrl: text('linkedin_url'),
  otherProfileUrl: text('other_profile_url'),
  isPrimary: integer('is_primary').notNull().default(0), // 0 or 1
  confidenceLevel: text('confidence_level').notNull().default('UNKNOWN'), // 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN'
  sourceType: text('source_type').notNull().default('MANUAL'), // 'MANUAL' | 'ENRICHMENT' | 'IMPORT'
  createdByUserId: text('created_by_user_id').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
}, (table) => ({
  leadIdDeletedAtIndex: index('contacts_lead_id_deleted_at_idx').on(table.leadId, table.deletedAt),
}));
