'use server';

// TODO(22.15): Add optimistic UI updates on lead mutations (create, archive, update stage)
import { LeadService } from '@/services/lead';
import { CreateLeadSchema } from '@/db/models/lead';
import { getDb } from '@/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getUserId } from '@/lib/auth';
import { getLogger } from '@/lib/logger';
import { getSafeErrorMessage } from '@/lib/errors';

const log = getLogger('LeadsActions');


async function getService() {
  const db = getDb();
  return new LeadService(db);
}

export type LeadDuplicate = { id: string; name: string; website: string | null; email: string | null; company: string | null };

export type ActionState = { error?: string | null, success?: boolean, issues?: unknown, duplicates?: LeadDuplicate[] } | null | undefined;

export async function createLeadAction(prevState: ActionState, formData: FormData) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const service = await getService();
  
  const rawData = {
    name: String(formData.get('name') ?? ''),
    company: String(formData.get('company') ?? ''),
    email: String(formData.get('email') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    website: String(formData.get('website') ?? ''),
    city: String(formData.get('city') ?? ''),
    region: String(formData.get('region') ?? ''),
    industry: String(formData.get('industry') ?? ''),
    stage: String(formData.get('stage') ?? ''),
    sourceName: String(formData.get('sourceName') ?? ''),
  };

  const validated = CreateLeadSchema.safeParse(rawData);

  if (!validated.success) {
    return { error: 'Validation failed. Please check the fields.', issues: validated.error.format() };
  }

  // Check for duplicates unless force-created
  const force = String(formData.get('_force') ?? '') === 'true';
  if (!force) {
    const duplicates = await service.checkDuplicates(validated.data, userId);
    if (duplicates.length > 0) {
      return { duplicates, error: null };
    }
  }

  try {
    await service.createLead({ ...validated.data, ownerId: userId });
  } catch (error: unknown) {
    log.error('Leads action failed', error);
    const msg = getSafeErrorMessage(error, 'Failed to create lead.');
    return { error: msg };
  }
  
  revalidatePath('/prospects');
  redirect('/prospects');
}

