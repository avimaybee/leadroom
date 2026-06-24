'use server';

import { getDb } from '@/db';
import { eq } from 'drizzle-orm';
import { leads, tasks } from '@/db/schema/core';
import { outreachDrafts } from '@/db/schema/outreach';
import { revalidatePath } from 'next/cache';
import { getUserId } from '@/lib/auth';

export async function toggleTriageStatusAction(
  entityType: 'lead' | 'task' | 'draft',
  entityId: string,
  isRead: boolean
) {
  const userId = await getUserId();
  if (!userId) return { error: 'Authentication required' };
  const db = getDb();
  
  if (entityType === 'lead') {
    await db.update(leads).set({ isRead }).where(eq(leads.id, entityId));
  } else if (entityType === 'task') {
    await db.update(tasks).set({ isRead }).where(eq(tasks.id, entityId));
  } else if (entityType === 'draft') {
    await db.update(outreachDrafts).set({ isRead }).where(eq(outreachDrafts.id, entityId));
  }
  
  revalidatePath('/');
  revalidatePath('/leads');
  revalidatePath(`/leads/${entityId}`);
}
