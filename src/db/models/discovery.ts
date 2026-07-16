import { z } from 'zod';

export const CreateDiscoveryScopeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(500, 'Name must be at most 500 characters'),
  description: z.string().max(5000, 'Description must be at most 5000 characters').optional().nullable(),
  industryFilter: z.string().max(500, 'Industry filter must be at most 500 characters').optional().nullable(),
  geographyFilter: z.string().max(500, 'Geography filter must be at most 500 characters').optional().nullable(),
  companySizeFilter: z.string().max(100, 'Company size filter must be at most 100 characters').optional().nullable(),
  businessTypeFilter: z.string().max(500, 'Business type filter must be at most 500 characters').optional().nullable(),
  digitalPresenceFilter: z.string().max(500, 'Digital presence filter must be at most 500 characters').optional().nullable(),
  notes: z.string().max(5000, 'Notes must be at most 5000 characters').optional().nullable(),
  autoResearchPromotedLeads: z.boolean().default(true).nullable(),
  createdByUserId: z.string().min(1, 'Created by User ID is required'),
  workspaceId: z.string().uuid().optional().nullable(),
  marketId: z.string().uuid().optional().nullable(),
});

export const CreateCandidateLeadSchema = z.object({
  discoveryScopeId: z.string().uuid('Invalid scope ID format').optional().nullable(),
  rawName: z.string().min(1, 'Raw name is required').max(500, 'Name must be at most 500 characters'),
  rawWebsiteUrl: z.string().url('Invalid website URL').max(2000, 'Website URL must be at most 2000 characters').optional().nullable().or(z.literal('')),
  rawContactInfo: z.string().max(500, 'Contact info must be at most 500 characters').optional().nullable(),
  rawLocation: z.string().max(500, 'Location must be at most 500 characters').optional().nullable(),
  notes: z.string().max(5000, 'Notes must be at most 5000 characters').optional().nullable(),
  status: z.enum(['NEW', 'REVIEWED', 'PROMOTED', 'DISCARDED']).default('NEW'),
  promotedLeadId: z.string().uuid('Invalid lead ID format').optional().nullable(),
});

export type CreateDiscoveryScopeInput = z.input<typeof CreateDiscoveryScopeSchema>;
export type CreateCandidateLeadInput = z.input<typeof CreateCandidateLeadSchema>;

