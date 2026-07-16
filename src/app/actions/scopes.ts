'use server';

import { DiscoveryService } from '@/services/discovery';
import { CreateDiscoveryScopeSchema } from '@/db/models/discovery';
import { getDb } from '@/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getUserId } from '@/lib/auth';
import { getLogger } from '@/lib/logger';

const log = getLogger('ScopesActions');

async function getService() {
  const db = getDb();
  return new DiscoveryService(db);
}

export type ActionState = { error?: string | null, success?: boolean, issues?: unknown } | null | undefined;

export async function createScopeAction(prevState: ActionState, formData: FormData) {
  const service = await getService();

  const userId = await getUserId();
  if (!userId) {
    return { error: 'Unauthorized' };
  }

  let nameInput = String(formData.get('name') ?? '');
  if (nameInput) {
    nameInput = nameInput
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  const rawData = {
    name: nameInput,
    description: String(formData.get('description') ?? ''),
    industryFilter: String(formData.get('industryFilter') ?? ''),
    geographyFilter: String(formData.get('geographyFilter') ?? ''),
    companySizeFilter: String(formData.get('companySizeFilter') ?? ''),
    businessTypeFilter: String(formData.get('businessTypeFilter') ?? ''),
    digitalPresenceFilter: String(formData.get('digitalPresenceFilter') ?? ''),
    notes: String(formData.get('notes') ?? ''),
    createdByUserId: userId,
  };

  const validated = CreateDiscoveryScopeSchema.safeParse(rawData);

  if (!validated.success) {
    return { error: 'Validation failed. Please fill out all required fields.', issues: validated.error.format() };
  }

  try {
    const id = crypto.randomUUID();
    await service.createScope(id, validated.data);
  } catch (error: unknown) {
    log.error('Create scope failed', error);
    const msg = error instanceof Error ? error.message : 'Failed to create discovery scope.';
    return { error: msg };
  }

  revalidatePath('/scopes');
  redirect('/scopes');
}
