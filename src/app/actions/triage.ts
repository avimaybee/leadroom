'use server';

import { getDb } from '@/db';
import { eq } from 'drizzle-orm';
import { leads, tasks } from '@/db/schema/core';
import { outreachDrafts } from '@/db/schema/outreach';
import { revalidatePath } from 'next/cache';

export async function toggleTriageStatusAction(
  entityType: 'lead' | 'task' | 'draft',
  entityId: string,
  isRead: boolean
) {
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
