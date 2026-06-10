'use server';

import { LeadService } from '@/services/lead';
import { CreateLeadSchema, CreateLeadInput } from '@/db/models/lead';
import { drizzle } from 'drizzle-orm/d1';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

async function getService() {
  const env = (process as any).env;
  const db = drizzle(env.DB);
  return new LeadService(db);
}

export async function createLeadAction(prevState: any, formData: FormData) {
  const service = await getService();
  
  const rawData = {
    name: formData.get('name') as string,
    company: formData.get('company') as string,
    email: formData.get('email') as string,
    phone: formData.get('phone') as string,
    website: formData.get('website') as string,
    city: formData.get('city') as string,
    region: formData.get('region') as string,
    industry: formData.get('industry') as string,
    stage: formData.get('stage') as string,
  };

  const validated = CreateLeadSchema.safeParse(rawData);

  if (!validated.success) {
    return { error: 'Validation failed. Please check the fields.', issues: validated.error.format() };
  }

  try {
    await service.createLead(validated.data);
  } catch (error: any) {
    return { error: error.message || 'Failed to create lead.' };
  }
  
  revalidatePath('/leads');
  redirect('/leads');
}

export async function archiveLeadAction(id: string) {
  const service = await getService();
  await service.archiveLead(id);
  revalidatePath('/leads');
}

export async function updateStageAction(formData: FormData) {
  const service = await getService();
  const id = formData.get('leadId') as string;
  const stage = formData.get('stage') as string;
  
  if (id && stage) {
    await service.updateStage(id, stage);
    revalidatePath(`/leads/${id}`);
    revalidatePath('/leads');
  }
}

export async function addNoteAction(prevState: any, formData: FormData) {
  const service = await getService();
  const leadId = formData.get('leadId') as string;
  const body = formData.get('body') as string;

  if (!body || body.trim() === '') {
    return { error: 'Note content cannot be empty' };
  }

  try {
    await service.addNote(leadId, null, body);
  } catch (e: any) {
    return { error: e.message || 'Failed to add note' };
  }

  revalidatePath(`/leads/${leadId}`);
}

export async function addTaskAction(prevState: any, formData: FormData) {
  const service = await getService();
  const leadId = formData.get('leadId') as string;
  const title = formData.get('title') as string;
  const description = formData.get('description') as string;
  const dueDateStr = formData.get('dueDate') as string;
  const priority = formData.get('priority') as string;

  if (!title || title.trim() === '') {
    return { error: 'Task title is required' };
  }

  const dueDate = dueDateStr ? new Date(dueDateStr) : null;

  try {
    await service.addTask(leadId, title, description || null, dueDate, priority || 'Medium');
  } catch (e: any) {
    return { error: e.message || 'Failed to add task' };
  }

  revalidatePath(`/leads/${leadId}`);
}

export async function toggleTaskStatusAction(leadId: string, taskId: string, currentStatus: string) {
  const service = await getService();
  await service.toggleTaskStatus(taskId, currentStatus);
  revalidatePath(`/leads/${leadId}`);
}

