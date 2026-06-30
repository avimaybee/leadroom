'use server';

import { getDb } from '@/db';
import { ReminderService } from '@/services/reminders';
import { revalidatePath } from 'next/cache';
import { getUserId, verifyProspectAccess } from '@/lib/auth';

export type ActionState = { error?: string | null; success?: boolean } | null | undefined;

export async function createReminderAction(prevState: ActionState, formData: FormData) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const leadId = formData.get('leadId') as string;
  const title = formData.get('title') as string;
  const message = formData.get('message') as string;
  const remindAtStr = formData.get('remindAt') as string;

  if (!title || title.trim() === '') {
    return { error: 'Reminder title is required' };
  }
  if (!remindAtStr) {
    return { error: 'Reminder date and time is required' };
  }

  const remindAt = new Date(remindAtStr);
  if (isNaN(remindAt.getTime())) {
    return { error: 'Invalid date' };
  }
  if (remindAt <= new Date()) {
    return { error: 'Reminder must be set in the future' };
  }

  if (leadId) {
    const db = getDb();
    if (!(await verifyProspectAccess(db, leadId, userId))) {
      return { error: 'Forbidden: you do not own this prospect' };
    }
  }

  try {
    const db = getDb();
    const service = new ReminderService(db);
    await service.createReminder(leadId, userId, title.trim(), message?.trim() || null, remindAt);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to set reminder';
    return { error: msg };
  }

  revalidatePath('/');
  if (leadId) revalidatePath(`/leads/${leadId}`);
  return { success: true };
}
