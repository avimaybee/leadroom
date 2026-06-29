import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const discoveryScopes = sqliteTable('discovery_scopes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  industryFilter: text('industry_filter'),
  geographyFilter: text('geography_filter'),
  companySizeFilter: text('company_size_filter'),
  businessTypeFilter: text('business_type_filter'),
  digitalPresenceFilter: text('digital_presence_filter'),
  notes: text('notes'),
  autoResearchPromotedLeads: integer('auto_research_promoted_leads', { mode: 'boolean' }).default(true).notNull(),
  createdByUserId: text('created_by_user_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const candidateLeads = sqliteTable('candidate_leads', {
  id: text('id').primaryKey(),
  discoveryScopeId: text('discovery_scope_id').references(() => discoveryScopes.id),
  rawName: text('raw_name').notNull(),
  rawWebsiteUrl: text('raw_website_url'),
  rawContactInfo: text('raw_contact_info'),
  rawLocation: text('raw_location'),
  notes: text('notes'),
  status: text('status').$type<'NEW' | 'REVIEWED' | 'PROMOTED' | 'DISCARDED'>().default('NEW').notNull(),
  promotedLeadId: text('promoted_lead_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  discoveryScopeIdIndex: index('candidate_leads_discovery_scope_id_idx').on(table.discoveryScopeId),
  promotedLeadIdIndex: index('candidate_leads_promoted_lead_id_idx').on(table.promotedLeadId),
}));


