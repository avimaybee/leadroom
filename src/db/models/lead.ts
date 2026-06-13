import { z } from 'zod';
import { leads } from '../schema/core';

export const CreateLeadSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  company: z.string().optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  stage: z.string().optional(),
  ownerId: z.string().optional().nullable(),
});

export type Lead = typeof leads.$inferSelect;
export type CreateLeadInput = {
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  city?: string | null;
  region?: string | null;
  industry?: string | null;
  stage?: string;
  triagePriority?: string | null;
  triageReason?: string | null;
  ownerId?: string | null;
};
