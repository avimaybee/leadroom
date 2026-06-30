'use server';

import { getDb } from '@/db';
import { eq } from 'drizzle-orm';
import { prospects as leads, tasks } from '@/db/schema/core';
import { outreachDrafts } from '@/db/schema/outreach';
import { revalidatePath } from 'next/cache';
import { getUserId, verifyProspectAccess } from '@/lib/auth';

export async function toggleTriageStatusAction(
  entityType: 'lead' | 'task' | 'draft',
  entityId: string,
  isRead: boolean
) {
  const userId = await getUserId();
  if (!userId) return { error: 'Authentication required' };
  const db = getDb();

  if (entityType === 'lead') {
    if (!(await verifyProspectAccess(db, entityId, userId))) {
      return { error: 'Forbidden: you do not own this prospect' };
    }
    await db.update(leads).set({ isRead }).where(eq(leads.id, entityId));
  } else if (entityType === 'task') {
    const [task] = await db.select({ leadId: tasks.leadId }).from(tasks).where(eq(tasks.id, entityId)).limit(1);
    if (task?.leadId && !(await verifyProspectAccess(db, task.leadId, userId))) {
      return { error: 'Forbidden: you do not own this prospect' };
    }
    await db.update(tasks).set({ isRead }).where(eq(tasks.id, entityId));
  } else if (entityType === 'draft') {
    const [draft] = await db.select({ leadId: outreachDrafts.leadId }).from(outreachDrafts).where(eq(outreachDrafts.id, entityId)).limit(1);
    if (draft?.leadId && !(await verifyProspectAccess(db, draft.leadId, userId))) {
      return { error: 'Forbidden: you do not own this prospect' };
    }
    await db.update(outreachDrafts).set({ isRead }).where(eq(outreachDrafts.id, entityId));
  }

  revalidatePath('/');
  revalidatePath('/leads');
  revalidatePath(`/leads/${entityId}`);
}
