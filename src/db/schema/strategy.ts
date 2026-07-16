import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const offers = sqliteTable('offers', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  name: text('name').notNull(),
  targetPain: text('target_pain'),
  desiredOutcome: text('desired_outcome'),
  proofPoints: text('proof_points', { mode: 'json' }),
  forbiddenClaims: text('forbidden_claims', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  workspaceIdIndex: index('offers_workspace_id_idx').on(table.workspaceId),
}));

export const icpProfiles = sqliteTable('icp_profiles', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  name: text('name').notNull(),
  positiveSignals: text('positive_signals', { mode: 'json' }),
  negativeSignals: text('negative_signals', { mode: 'json' }),
  disqualifiers: text('disqualifiers', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  workspaceIdIndex: index('icp_profiles_workspace_id_idx').on(table.workspaceId),
}));

export const markets = sqliteTable('markets', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  name: text('name').notNull(),
  icpProfileId: text('icp_profile_id').references(() => icpProfiles.id),
  offerId: text('offer_id').references(() => offers.id),
  status: text('status').default('active'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  workspaceStatusIndex: index('markets_workspace_id_status_idx').on(table.workspaceId, table.status),
}));
