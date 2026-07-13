'use server';

import { ResearchService } from '@/services/research';
import { LeadService } from '@/services/lead';
import { getDb } from '@/db';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { decrypt, getUserId, verifyProspectAccess } from '@/lib/auth';
import { prospects } from '@/db/schema/core';
import { researchTasks } from '@/db/schema/jobs';
import { workspaces, markets } from '@/db/schema/strategy';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';
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
  marketId: z.string().min(1, 'Market is required'),
});

const TASK_TYPES = ['WEBSITE_ANALYST', 'ICP_FIT', 'PAIN_EXTRACTOR', 'DISQUALIFIER_CHECK'] as const;

async function createProspectActionImpl(prev: any, form: FormData) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const db = getDb();
  const wsRows = await db.select().from(workspaces).where(eq(workspaces.id, userId)).limit(1);
  if (wsRows.length === 0) return { error: 'No workspace found' };

  const raw = {
    name: form.get('name') as string,
    company: (form.get('company') as string) || '',
    domain: (form.get('domain') as string) || (form.get('website') as string) || '',
    notes: (form.get('notes') as string) || '',
    marketId: form.get('marketId') as string,
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

    revalidatePath(`/markets/${validated.data.marketId}/prospects`);
    revalidatePath('/research');
    return { success: true, prospectId: id };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to create prospect';
    return { error: msg };
  }
}

export const createProspectAction = withLogging('createProspectAction', createProspectActionImpl);

async function importProspectsCSVActionImpl(formData: FormData) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const db = getDb();
  const wsRows = await db.select().from(workspaces).where(eq(workspaces.id, userId)).limit(1);
  if (wsRows.length === 0) return { error: 'No workspace found' };

  const csvRaw = formData.get('csv') as string;
  const marketId = formData.get('marketId') as string;
  if (!csvRaw || !marketId) return { error: 'CSV data and market ID required' };

  const lines = csvRaw.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return { error: 'CSV must have a header row and at least one data row' };

  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const nameIdx = header.indexOf('name');
  const domainIdx = header.indexOf('domain');
  const notesIdx = header.indexOf('notes');

  if (nameIdx === -1 || domainIdx === -1) {
    return { error: 'CSV must have at least "name" and "domain" columns' };
  }

  const created: string[] = [];
  const errors: { row: number; reason: string }[] = [];
  const now = new Date();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    const name = cols[nameIdx] || '';
    const domain = cols[domainIdx] || '';
    const notes = notesIdx !== -1 ? (cols[notesIdx] || '') : '';

    if (!name || !domain) {
      errors.push({ row: i + 1, reason: 'Missing name or domain' });
      continue;
    }

    const website = domain.startsWith('http') ? domain : `https://${domain}`;
    const id = crypto.randomUUID();

    try {
      await db.insert(prospects).values({
        id,
        name,
        website,
        stage: 'New',
        status: 'Active',
        workspaceId: wsRows[0].id,
        marketId,
        ownerId: userId,
        notes: notes || null,
        scoreDirty: true,
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
        stageUpdatedAt: now,
      });

      for (const taskType of TASK_TYPES) {
        await db.insert(researchTasks).values({
          id: crypto.randomUUID(),
          prospectId: id,
          taskType,
          status: 'PENDING',
          createdAt: now,
          updatedAt: now,
        });
      }

      created.push(id);
    } catch {
      errors.push({ row: i + 1, reason: 'Database error' });
    }
  }

  revalidatePath(`/markets/${marketId}/prospects`);
  revalidatePath('/research');
  return { success: true, created: created.length, total: lines.length - 1, errors };
}

export const importProspectsCSVAction = withLogging('importProspectsCSVAction', importProspectsCSVActionImpl);

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

  const leadId = formData.get('leadId') as string;
  if (!leadId) {
    return { error: 'Lead ID is required' };
  }

  const db = getDb();
  if (!(await verifyProspectAccess(db, leadId, userId))) {
    return { error: 'Forbidden: you do not own this prospect' };
  }

  const companySummary = formData.get('companySummary') as string;
  const productsServicesSummary = formData.get('productsServicesSummary') as string;
  const digitalPresenceNotes = formData.get('digitalPresenceNotes') as string;
  const websiteNotes = formData.get('websiteNotes') as string;
  const brandingNotes = formData.get('brandingNotes') as string;
  const painPointsHypotheses = formData.get('painPointsHypotheses') as string;
  const opportunityHypotheses = formData.get('opportunityHypotheses') as string;
  const confidenceLevel = formData.get('confidenceLevel') as string;
  const rawSources = formData.get('sources') as string;

  if (!leadId) {
    return { error: 'Lead ID is required' };
  }

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

  revalidatePath(`/leads/${leadId}`);
  return { error: null, success: true };
}

export const saveResearchSnapshotAction = withLogging('saveResearchSnapshotAction', saveResearchSnapshotActionImpl);

export async function addContactAction(prevState: ActionState, formData: FormData) {
  const service = await getService();
  const userId = await getUserId();
  if (!userId) return { error: 'Authentication required' };

  const leadId = formData.get('leadId') as string;
  const fullName = formData.get('fullName') as string;
  const roleTitle = formData.get('roleTitle') as string;
  const email = formData.get('email') as string;
  const phone = formData.get('phone') as string;
  const linkedinUrl = formData.get('linkedinUrl') as string;
  const isPrimary = formData.get('isPrimary') === 'true' || formData.get('isPrimary') === 'on';

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

  revalidatePath(`/leads/${leadId}`);
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
  revalidatePath(`/leads/${leadId}`);
}

export async function updateContactAction(prevState: ActionState, formData: FormData) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const service = await getService();
  const leadId = formData.get('leadId') as string;
  const contactId = formData.get('contactId') as string;
  const fullName = formData.get('fullName') as string;
  const roleTitle = formData.get('roleTitle') as string;
  const email = formData.get('email') as string;
  const phone = formData.get('phone') as string;
  const linkedinUrl = formData.get('linkedinUrl') as string;
  const isPrimary = formData.get('isPrimary') === 'true' || formData.get('isPrimary') === 'on';

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

  revalidatePath(`/leads/${leadId}`);
  return { error: null, success: true };
}
