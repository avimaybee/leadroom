'use server';

import { ResearchService } from '@/services/research';
import { LeadService } from '@/services/lead';
import { getDb } from '@/db';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { decrypt, getUserId, verifyProspectAccess } from '@/lib/auth';
 
async function getService() {
  const db = getDb();
  return new ResearchService(db);
}

export type ActionState = { error?: string | null, success?: boolean, issues?: unknown } | null | undefined;

export async function saveResearchSnapshotAction(prevState: ActionState, formData: FormData) {
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
