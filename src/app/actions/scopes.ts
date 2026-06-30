'use server';

import { DiscoveryService } from '@/services/discovery';
import { CreateDiscoveryScopeSchema } from '@/db/models/discovery';
import { getDb } from '@/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getUserId } from '@/lib/auth';

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

  let nameInput = (formData.get('name') as string) || '';
  if (nameInput) {
    nameInput = nameInput
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  const rawData = {
    name: nameInput,
    description: formData.get('description') as string,
    industryFilter: formData.get('industryFilter') as string,
    geographyFilter: formData.get('geographyFilter') as string,
    companySizeFilter: formData.get('companySizeFilter') as string,
    businessTypeFilter: formData.get('businessTypeFilter') as string,
    digitalPresenceFilter: formData.get('digitalPresenceFilter') as string,
    notes: formData.get('notes') as string,
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
    const msg = error instanceof Error ? error.message : 'Failed to create discovery scope.';
    return { error: msg };
  }

  revalidatePath('/scopes');
  redirect('/scopes');
}
