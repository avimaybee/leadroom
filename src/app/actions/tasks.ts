'use server';

import { LeadService } from '@/services/lead';
import { getDb } from '@/db';
import { revalidatePath } from 'next/cache';

async function getService() {
  const db = getDb();
  return new LeadService(db);
}

export type ActionState = { error?: string | null, success?: boolean, issues?: unknown } | null | undefined;

export async function createTaskAction(prevState: ActionState, formData: FormData) {
  const service = await getService();
  
  const leadId = formData.get('leadId') as string;
  const title = formData.get('title') as string;
  const description = formData.get('description') as string;
  const dueDateStr = formData.get('dueDate') as string;
  const priority = formData.get('priority') as string;

  if (!title || title.trim() === '') {
    return { error: 'Task title is required' };
  }

  try {
    await service.addTask(
      leadId || '',
      title,
      description || null,
      dueDateStr ? new Date(dueDateStr) : null,
      priority || 'Medium'
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to add task';
    return { error: msg };
  }
  
  revalidatePath('/');
  if (leadId) {
    revalidatePath(`/leads/${leadId}`);
  }
  return { error: null };
}

export async function toggleTaskStatusAction(id: string, currentStatus: string, leadId?: string | null) {
  const service = await getService();
  await service.toggleTaskStatus(id, currentStatus);
  
  revalidatePath('/');
  if (leadId) {
    revalidatePath(`/leads/${leadId}`);
  }
}
