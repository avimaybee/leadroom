'use server';

import { LeadService } from '@/services/lead';
import { CreateLeadSchema, CreateLeadInput } from '@/db/models/lead';
import { getDb } from '@/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { decrypt } from '@/lib/auth';
import { triggerTriageWorkflow, CloudflareWorkflow } from '@/lib/workflow-client';

async function getService() {
  const db = getDb();
  return new LeadService(db);
}

async function getUserId() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    const payload = await decrypt(sessionToken);
    return payload?.userId || null;
  } catch (e) {
    return null;
  }
}

export type ActionState = { error?: string | null, success?: boolean, issues?: unknown } | null | undefined;

export async function createLeadAction(prevState: ActionState, formData: FormData) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

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
    const lead = await service.createLead({ ...validated.data, ownerId: userId });
    if (lead && lead.website) {
      const db = getDb();
      const env = (process.env as unknown as Record<string, unknown>);
      const workflowBinding = env?.TRIAGE_WORKFLOW as CloudflareWorkflow | undefined;
      await triggerTriageWorkflow(db, workflowBinding, lead.id);
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create lead.';
    return { error: msg };
  }
  
  revalidatePath('/leads');
  redirect('/leads');
}

export async function archiveLeadAction(id: string) {
  const userId = await getUserId();
  if (!userId) throw new Error('Unauthorized');

  const service = await getService();
  await service.archiveLead(id);
  revalidatePath('/leads');
}

export async function updateStageAction(formData: FormData) {
  const userId = await getUserId();
  if (!userId) throw new Error('Unauthorized');

  const service = await getService();
  const id = formData.get('leadId') as string;
  const stage = formData.get('stage') as string;
  
  if (id && stage) {
    await service.updateStage(id, stage);
    revalidatePath(`/leads/${id}`);
    revalidatePath('/leads');
  }
}

export async function updateLeadAction(prevState: ActionState, formData: FormData) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const service = await getService();
  const id = formData.get('leadId') as string;
  if (!id) return { error: 'Lead ID is required' };

  const rawData = {
    name: formData.get('name') as string,
    company: formData.get('company') as string || null,
    email: formData.get('email') as string || null,
    phone: formData.get('phone') as string || null,
    website: formData.get('website') as string || null,
    city: formData.get('city') as string || null,
    region: formData.get('region') as string || null,
    industry: formData.get('industry') as string || null,
  };

  const validated = CreateLeadSchema.partial().safeParse(rawData);

  if (!validated.success) {
    return { error: 'Validation failed. Please check the fields.', issues: validated.error.format() };
  }

  try {
    const oldLead = await service.getLead(id);
    await service.updateLead(id, validated.data);
    
    if (validated.data.website && validated.data.website !== oldLead?.website) {
      const db = getDb();
      const env = (process.env as unknown as Record<string, unknown>);
      const workflowBinding = env?.TRIAGE_WORKFLOW as CloudflareWorkflow | undefined;
      await triggerTriageWorkflow(db, workflowBinding, id);
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update lead.';
    return { error: msg };
  }
  
  revalidatePath(`/leads/${id}`);
  revalidatePath('/leads');
  return { success: true };
}

export async function addNoteAction(prevState: ActionState, formData: FormData) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const service = await getService();
  const leadId = formData.get('leadId') as string;
  const body = formData.get('body') as string;

  if (!body || body.trim() === '') {
    return { error: 'Note content cannot be empty' };
  }

  try {
    await service.addNote(leadId, userId, body);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to add note';
    return { error: msg };
  }

  revalidatePath(`/leads/${leadId}`);
}
