'use server';

import { LeadService } from '@/services/lead';
import { CreateLeadSchema, CreateLeadInput } from '@/db/models/lead';
import { getDb } from '@/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getUserId, verifyProspectAccess } from '@/lib/auth';
import { getLogger } from '@/lib/logger';

const log = getLogger('ProspectsActions');


async function getService() {
  const db = getDb();
  return new LeadService(db);
}

export type LeadDuplicate = { id: string; name: string; website: string | null; email: string | null; company: string | null };

export type ActionState = { error?: string | null, success?: boolean, issues?: unknown, duplicates?: LeadDuplicate[] } | null | undefined;

export async function createLeadAction(prevState: ActionState, formData: FormData) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const service = await getService();
  
  const rawData = {
    name: String(formData.get('name') ?? ''),
    company: String(formData.get('company') ?? ''),
    email: String(formData.get('email') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    website: String(formData.get('website') ?? ''),
    city: String(formData.get('city') ?? ''),
    region: String(formData.get('region') ?? ''),
    industry: String(formData.get('industry') ?? ''),
    stage: String(formData.get('stage') ?? ''),
    sourceName: String(formData.get('sourceName') ?? ''),
  };

  const validated = CreateLeadSchema.safeParse(rawData);

  if (!validated.success) {
    return { error: 'Validation failed. Please check the fields.', issues: validated.error.format() };
  }

  // Check for duplicates unless force-created
  const force = String(formData.get('_force') ?? '') === 'true';
  if (!force) {
    const duplicates = await service.checkDuplicates(validated.data, userId);
    if (duplicates.length > 0) {
      return { duplicates, error: null };
    }
  }

  try {
    const lead = await service.createLead({ ...validated.data, ownerId: userId });
  } catch (error: unknown) {
    log.error('Prospects action failed', error);
    const msg = error instanceof Error ? error.message : 'Failed to create lead.';
    return { error: msg };
  }
  
  revalidatePath('/prospects');
  redirect('/prospects');
}

export async function archiveLeadAction(id: string) {
  const userId = await getUserId();
  if (!userId) throw new Error('Unauthorized');

  const db = getDb();
  if (!(await verifyProspectAccess(db, id, userId))) {
    throw new Error('Forbidden: you do not own this prospect');
  }

  const service = await getService();
  await service.archiveLead(id);
  revalidatePath('/prospects');
}

export async function updateStageAction(formData: FormData) {
  const userId = await getUserId();
  if (!userId) throw new Error('Unauthorized');

  const db = getDb();
  const id = String(formData.get('leadId') ?? '');
  if (id && !(await verifyProspectAccess(db, id, userId))) {
    throw new Error('Forbidden: you do not own this prospect');
  }

  const service = await getService();
  const stage = String(formData.get('stage') ?? '');
  
  if (id && stage) {
    await service.updateStage(id, stage);
    revalidatePath(`/prospects/${id}`);
    revalidatePath('/prospects');
    revalidatePath('/');
  }
}

export async function updateLeadAction(prevState: ActionState, formData: FormData) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const service = await getService();
  const id = String(formData.get('leadId') ?? '');
  if (!id) return { error: 'Lead ID is required' };

  const db = getDb();
  if (!(await verifyProspectAccess(db, id, userId))) {
    return { error: 'Forbidden: you do not own this prospect' };
  }

  const rawData = {
    name: String(formData.get('name') ?? ''),
    company: String(formData.get('company') ?? ''),
    email: String(formData.get('email') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    website: String(formData.get('website') ?? ''),
    city: String(formData.get('city') ?? ''),
    region: String(formData.get('region') ?? ''),
    industry: String(formData.get('industry') ?? ''),
  };

  const validated = CreateLeadSchema.partial().safeParse(rawData);

  if (!validated.success) {
    return { error: 'Validation failed. Please check the fields.', issues: validated.error.format() };
  }

  try {
    await service.updateLead(id, validated.data);
  } catch (error: unknown) {
    log.error('Prospects action failed', error);
    const msg = error instanceof Error ? error.message : 'Failed to update lead.';
    return { error: msg };
  }
  
  revalidatePath(`/prospects/${id}`);
  revalidatePath('/prospects');
  revalidatePath('/');
  return { success: true };
}

export async function addNoteAction(prevState: ActionState, formData: FormData) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const service = await getService();
  const leadId = String(formData.get('leadId') ?? '');
  const body = String(formData.get('body') ?? '');

  if (!leadId) return { error: 'Lead ID is required' };
  if (!body || body.trim() === '') {
    return { error: 'Note content cannot be empty' };
  }

  const db = getDb();
  if (!(await verifyProspectAccess(db, leadId, userId))) {
    return { error: 'Forbidden: you do not own this prospect' };
  }

  try {
    await service.addNote(leadId, userId, body);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to add note';
    return { error: msg };
  }

  revalidatePath(`/prospects/${leadId}`);
  revalidatePath('/');
}

export async function verifyStageRequirementsAction(leadId: string, targetStage: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };
  const service = await getService();
  const reason = await service.verifyStageRequirements(leadId, targetStage);
  if (reason) return { blocked: true, reason };
  return { blocked: false };
}

export async function getUnmetStageRequirementsAction(leadId: string, email: string | null) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };
  const service = await getService();
  return service.getUnmetStageRequirements(leadId, email);
}
