'use server';

import { ResearchService } from '@/services/research';
import { LeadService } from '@/services/lead';
import { getDb } from '@/db';
import { revalidatePath } from 'next/cache';
import { getUserId, verifyProspectAccess } from '@/lib/auth';
import { prospects } from '@/db/schema/core';
import { researchTasks } from '@/db/schema/jobs';
import { workspaces } from '@/db/schema/strategy';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

import { withLogging } from '@/lib/actions/with-logging';
 
async function getService() {
  const db = getDb();
  return new ResearchService(db);
}

export type ActionState = { error?: string | null, success?: boolean, issues?: unknown } | null | undefined;

const CreateProspectSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  company: z.string().optional(),
  domain: z.string().min(1, 'Domain is required'),
  notes: z.string().optional(),
  marketId: z.string().optional().nullable(),
});

const TASK_TYPES = ['WEBSITE_ANALYST', 'ICP_FIT', 'PAIN_EXTRACTOR', 'DISQUALIFIER_CHECK'] as const;

async function createProspectActionImpl(prev: any, form: FormData) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const db = getDb();
  const wsRows = await db.select().from(workspaces).where(eq(workspaces.id, userId)).limit(1);
  if (wsRows.length === 0) return { error: 'No workspace found' };

  const raw = {
    name: String(form.get('name') ?? ''),
    company: String(form.get('company') ?? ''),
    domain: String(form.get('domain') ?? form.get('website') ?? ''),
    notes: String(form.get('notes') ?? ''),
    marketId: String(form.get('marketId') ?? '') || null,
  };

  const validated = CreateProspectSchema.safeParse(raw);
  if (!validated.success) {
    return { error: 'Validation failed', issues: validated.error.format() };
  }

  const id = crypto.randomUUID();
  const now = new Date();
  const website = validated.data.domain.startsWith('http')
    ? validated.data.domain
    : `https://${validated.data.domain}`;

  try {
    await db.insert(prospects).values({
      id,
      name: validated.data.name,
      company: validated.data.company || null,
      website,
      stage: 'New',
      status: 'Active',
      workspaceId: wsRows[0].id,
      marketId: validated.data.marketId,
      ownerId: userId,
      notes: validated.data.notes || null,
      scoreDirty: true,
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
      stageUpdatedAt: now,
    });

    const taskIds: string[] = [];
    for (const taskType of TASK_TYPES) {
      const taskId = crypto.randomUUID();
      taskIds.push(taskId);
      await db.insert(researchTasks).values({
        id: taskId,
        prospectId: id,
        taskType,
        status: 'PENDING',
        createdAt: now,
        updatedAt: now,
      });
    }

    revalidatePath('/prospects');
    revalidatePath('/research');
    return { success: true, prospectId: id };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to create prospect';
    return { error: msg };
  }
}

export const createProspectAction = withLogging('createProspectAction', createProspectActionImpl);



async function retryResearchTaskActionImpl(taskId: string) {
  const userId = await getUserId();
  if (!userId) throw new Error('Unauthorized');

  const db = getDb();
  await db.update(researchTasks).set({
    status: 'PENDING',
    errorMessage: null,
    updatedAt: new Date(),
  }).where(eq(researchTasks.id, taskId));

  revalidatePath('/research');
  return { success: true };
}

export const retryResearchTaskAction = withLogging('retryResearchTaskAction', retryResearchTaskActionImpl);

async function cancelResearchTaskActionImpl(taskId: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const db = getDb();
  const [task] = await db.select().from(researchTasks).where(eq(researchTasks.id, taskId)).limit(1);
  if (!task) return { error: 'Task not found' };

  if (task.status !== 'PENDING' && task.status !== 'RUNNING') {
    return { error: 'Only pending or running tasks can be cancelled' };
  }

  await db.update(researchTasks).set({
    status: 'CANCELLED',
    errorMessage: 'Cancelled by user',
    completedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(researchTasks.id, taskId));

  revalidatePath('/research');
  return { success: true };
}

export const cancelResearchTaskAction = withLogging('cancelResearchTaskAction', cancelResearchTaskActionImpl);

export async function getResearchQueueAction() {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const db = getDb();
  const rows = await db
    .select({
      task: researchTasks,
      prospectName: prospects.name,
      prospectCompany: prospects.company,
    })
    .from(researchTasks)
    .innerJoin(prospects, eq(researchTasks.prospectId, prospects.id))
    .where(eq(prospects.ownerId, userId))
    .orderBy(desc(researchTasks.createdAt))
    .limit(100);

  return {
    success: true,
    tasks: rows.map(r => ({
      ...r.task,
      prospectName: r.prospectName,
      prospectCompany: r.prospectCompany,
    })),
  };
}

async function saveResearchSnapshotActionImpl(prevState: ActionState, formData: FormData) {
  const service = await getService();
  const userId = await getUserId();
  if (!userId) return { error: 'Authentication required' };

  const leadId = String(formData.get('leadId') ?? '');
  if (!leadId) {
    return { error: 'Lead ID is required' };
  }

  const db = getDb();
  if (!(await verifyProspectAccess(db, leadId, userId))) {
    return { error: 'Forbidden: you do not own this prospect' };
  }

  const companySummary = String(formData.get('companySummary') ?? '');
  const productsServicesSummary = String(formData.get('productsServicesSummary') ?? '');
  const digitalPresenceNotes = String(formData.get('digitalPresenceNotes') ?? '');
  const websiteNotes = String(formData.get('websiteNotes') ?? '');
  const brandingNotes = String(formData.get('brandingNotes') ?? '');
  const painPointsHypotheses = String(formData.get('painPointsHypotheses') ?? '');
  const opportunityHypotheses = String(formData.get('opportunityHypotheses') ?? '');
  const confidenceLevel = String(formData.get('confidenceLevel') ?? '');
  const rawSources = String(formData.get('sources') ?? '');

  const sources = rawSources
    ? rawSources
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : [];

  try {
    await service.saveResearchSnapshot(
      leadId,
      {
        companySummary: companySummary || '',
        productsServicesSummary: productsServicesSummary || '',
        digitalPresenceNotes: digitalPresenceNotes || '',
        websiteNotes: websiteNotes || '',
        brandingNotes: brandingNotes || '',
        painPointsHypotheses: painPointsHypotheses || '',
        opportunityHypotheses: opportunityHypotheses || '',
        sources,
        confidenceLevel: confidenceLevel || 'UNKNOWN',
      },
      userId
    );
    const db = getDb();
    const leadService = new LeadService(db);
    await leadService.advanceStageIfEarlier(leadId, 'In Research');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to save research';
    return { error: msg };
  }

  revalidatePath(`/prospects/${leadId}`);
  return { error: null, success: true };
}

export const saveResearchSnapshotAction = withLogging('saveResearchSnapshotAction', saveResearchSnapshotActionImpl);

export async function addContactAction(prevState: ActionState, formData: FormData) {
  const service = await getService();
  const userId = await getUserId();
  if (!userId) return { error: 'Authentication required' };

  const leadId = String(formData.get('leadId') ?? '');
  const fullName = String(formData.get('fullName') ?? '');
  const roleTitle = String(formData.get('roleTitle') ?? '');
  const email = String(formData.get('email') ?? '');
  const phone = String(formData.get('phone') ?? '');
  const linkedinUrl = String(formData.get('linkedinUrl') ?? '');
  const isPrimary = String(formData.get('isPrimary') ?? '') === 'true' || String(formData.get('isPrimary') ?? '') === 'on';

  if (!leadId) {
    return { error: 'Lead ID is required' };
  }

  const db = getDb();
  if (!(await verifyProspectAccess(db, leadId, userId))) {
    return { error: 'Forbidden: you do not own this prospect' };
  }

  if (!fullName && !email) {
    return { error: 'Either Full Name or Email is required' };
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Invalid email address format' };
  }

  if (linkedinUrl && !/^https?:\/\/.+/.test(linkedinUrl)) {
    return { error: 'Invalid LinkedIn URL format' };
  }

  try {
    await service.addContact(
      leadId,
      {
        fullName: fullName || null,
        roleTitle: roleTitle || null,
        email: email || null,
        phone: phone || null,
        linkedinUrl: linkedinUrl || null,
        isPrimary,
        confidenceLevel: 'HIGH',
        sourceType: 'MANUAL',
      },
      userId
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to add contact';
    return { error: msg };
  }

  revalidatePath(`/prospects/${leadId}`);
  return { error: null, success: true };
}

export async function deleteContactAction(leadId: string, contactId: string) {
  const userId = await getUserId();
  if (!userId) throw new Error('Unauthorized');

  const db = getDb();
  if (!(await verifyProspectAccess(db, leadId, userId))) {
    throw new Error('Forbidden: you do not own this prospect');
  }

  const service = await getService();
  await service.deleteContact(leadId, contactId, userId);
  revalidatePath(`/prospects/${leadId}`);
}

export async function updateContactAction(prevState: ActionState, formData: FormData) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const service = await getService();
  const leadId = String(formData.get('leadId') ?? '');
  const contactId = String(formData.get('contactId') ?? '');
  const fullName = String(formData.get('fullName') ?? '');
  const roleTitle = String(formData.get('roleTitle') ?? '');
  const email = String(formData.get('email') ?? '');
  const phone = String(formData.get('phone') ?? '');
  const linkedinUrl = String(formData.get('linkedinUrl') ?? '');
  const isPrimary = String(formData.get('isPrimary') ?? '') === 'true' || String(formData.get('isPrimary') ?? '') === 'on';

  if (!leadId || !contactId) {
    return { error: 'Lead ID and Contact ID are required' };
  }

  const db = getDb();
  if (!(await verifyProspectAccess(db, leadId, userId))) {
    return { error: 'Forbidden: you do not own this prospect' };
  }

  try {
    await service.updateContact(
      leadId,
      contactId,
      {
        fullName: fullName || null,
        roleTitle: roleTitle || null,
        email: email || null,
        phone: phone || null,
        linkedinUrl: linkedinUrl || null,
        isPrimary,
      },
      userId
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to update contact';
    return { error: msg };
  }

  revalidatePath(`/prospects/${leadId}`);
  return { error: null, success: true };
}
