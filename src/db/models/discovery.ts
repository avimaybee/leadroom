import { z } from 'zod';

export const CreateDiscoveryScopeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable(),
  industryFilter: z.string().optional().nullable(),
  geographyFilter: z.string().optional().nullable(),
  companySizeFilter: z.string().optional().nullable(),
  businessTypeFilter: z.string().optional().nullable(),
  digitalPresenceFilter: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  createdByUserId: z.string().min(1, 'Created by User ID is required'),
});

export const CreateCandidateLeadSchema = z.object({
  discoveryScopeId: z.string().optional().nullable(),
  rawName: z.string().min(1, 'Raw name is required'),
  rawWebsiteUrl: z.string().url('Invalid website URL').optional().nullable().or(z.literal('')),
  rawContactInfo: z.string().optional().nullable(),
  rawLocation: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(['NEW', 'REVIEWED', 'PROMOTED', 'DISCARDED']).default('NEW'),
  promotedLeadId: z.string().optional().nullable(),
});

export type CreateDiscoveryScopeInput = z.infer<typeof CreateDiscoveryScopeSchema>;
export type CreateCandidateLeadInput = z.infer<typeof CreateCandidateLeadSchema>;
