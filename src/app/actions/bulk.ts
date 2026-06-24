'use server';

import { getDb } from '@/db';
import { getUserId } from '@/lib/auth';
import { LeadService, PIPELINE_STAGES, type PipelineStage } from '@/services/lead';
import { ReminderService } from '@/services/reminders';
import { revalidatePath } from 'next/cache';

export async function bulkAdvanceStageAction(leadIds: string[]) {
  const userId = await getUserId();
  if (!userId) throw new Error('Unauthorized');

  const db = getDb();
  const service = new LeadService(db);
  const results = { advanced: 0, skipped: 0, errors: 0 };

  for (const id of leadIds) {
    try {
      const lead = await service.getLead(id);
      if (!lead) { results.errors++; continue; }
      const currentIdx = PIPELINE_STAGES.indexOf(lead.stage as PipelineStage);
      if (currentIdx < 0 || currentIdx >= PIPELINE_STAGES.length - 1) {
        results.skipped++;
        continue;
      }
      const nextStage = PIPELINE_STAGES[currentIdx + 1];
      await service.updateStage(id, nextStage);
      results.advanced++;
    } catch {
      results.errors++;
    }
  }

  revalidatePath('/leads');
  revalidatePath('/');
  return results;
}

export async function bulkAddTaskAction(leadIds: string[], title: string, dueDate: string | null, priority: string) {
  const userId = await getUserId();
  if (!userId) throw new Error('Unauthorized');

  const db = getDb();
  const service = new LeadService(db);
  const results = { created: 0, errors: 0 };

  for (const id of leadIds) {
    try {
      await service.addTask(id, title, null, dueDate ? new Date(dueDate) : null, priority);
      results.created++;
    } catch {
      results.errors++;
    }
  }

  revalidatePath('/leads');
  revalidatePath('/');
  return results;
}

export async function bulkSetReminderAction(leadIds: string[], title: string, remindAt: string) {
  const userId = await getUserId();
  if (!userId) throw new Error('Unauthorized');

  const db = getDb();
  const reminderService = new ReminderService(db);
  const results = { created: 0, errors: 0 };

  for (const id of leadIds) {
    try {
      await reminderService.createReminder(id, userId, title, null, new Date(remindAt));
      results.created++;
    } catch {
      results.errors++;
    }
  }

  revalidatePath('/leads');
  revalidatePath('/');
  return results;
}
