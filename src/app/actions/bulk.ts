'use server';

import { getDb } from '@/db';
import { getUserId } from '@/lib/auth';
import { LeadService, PIPELINE_STAGES, type PipelineStage } from '@/services/lead';
import { ReminderService } from '@/services/reminders';
import { revalidatePath } from 'next/cache';
import { eq, and, inArray, or, isNull } from 'drizzle-orm';
import { prospects as leads, users } from '@/db/schema/core';
import { LoggingService } from '@/services/logging';
import { triggerResearchWorkflow } from '@/lib/workflow-client';
import { jobRuns } from '@/db/schema/research';

export async function bulkAdvanceStageAction(leadIds: string[]) {
  const userId = await getUserId();
  if (!userId) throw new Error('Unauthorized');

  const db = getDb();
  const service = new LeadService(db);
  const leadMap = new Map(
    (await db.select({ id: leads.id, ownerId: leads.ownerId }).from(leads).where(inArray(leads.id, leadIds)))
      .map(l => [l.id, l.ownerId])
  );
  const results: { advanced: number; skipped: { id: string; reason: string }[]; errors: { id: string; reason: string }[] } = { advanced: 0, skipped: [], errors: [] };

  for (const id of leadIds) {
    try {
      if (!leadMap.has(id)) { results.errors.push({ id, reason: 'Lead not found' }); continue; }
      if (leadMap.get(id) && leadMap.get(id) !== userId) { results.skipped.push({ id, reason: 'Not authorized' }); continue; }
      const lead = await service.getLead(id);
      if (!lead) { results.errors.push({ id, reason: 'Lead not found' }); continue; }
      const currentIdx = PIPELINE_STAGES.indexOf(lead.stage as PipelineStage);
      if (currentIdx < 0 || currentIdx >= PIPELINE_STAGES.length - 1) {
        results.skipped.push({ id, reason: `Already at terminal stage "${lead.stage}"` });
        continue;
      }
      const nextStage = PIPELINE_STAGES[currentIdx + 1];
      const reqError = await service.verifyStageRequirements(id, nextStage);
      if (reqError) {
        results.skipped.push({ id, reason: reqError });
        continue;
      }
      await service.updateStage(id, nextStage);
      results.advanced++;
    } catch (err) {
      results.errors.push({ id, reason: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  revalidatePath('/leads');
  revalidatePath('/');
  return results;
}

export async function bulkAdvanceStageToAction(leadIds: string[], targetStage: string) {
  const userId = await getUserId();
  if (!userId) throw new Error('Unauthorized');
  if (!PIPELINE_STAGES.includes(targetStage as PipelineStage)) {
    throw new Error(`Invalid target stage: ${targetStage}`);
  }

  const db = getDb();
  const service = new LeadService(db);
  const leadMap = new Map(
    (await db.select({ id: leads.id, ownerId: leads.ownerId }).from(leads).where(inArray(leads.id, leadIds)))
      .map(l => [l.id, l.ownerId])
  );
  const results: { advanced: number; skipped: { id: string; reason: string }[]; errors: { id: string; reason: string }[] } = { advanced: 0, skipped: [], errors: [] };

  for (const id of leadIds) {
    try {
      if (!leadMap.has(id)) { results.errors.push({ id, reason: 'Lead not found' }); continue; }
      if (leadMap.get(id) && leadMap.get(id) !== userId) { results.skipped.push({ id, reason: 'Not authorized' }); continue; }
      const lead = await service.getLead(id);
      if (!lead) { results.errors.push({ id, reason: 'Lead not found' }); continue; }
      if (lead.status !== 'Active') { results.skipped.push({ id, reason: `Lead is ${lead.status}` }); continue; }
      if (lead.stage === targetStage) { results.skipped.push({ id, reason: `Already in "${targetStage}"` }); continue; }
      const reqError = await service.verifyStageRequirements(id, targetStage);
      if (reqError) { results.skipped.push({ id, reason: reqError }); continue; }
      await service.updateStage(id, targetStage);
      results.advanced++;
    } catch (err) {
      results.errors.push({ id, reason: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  revalidatePath('/leads');
  revalidatePath('/');
  return results;
}

export async function bulkResearchTriggerAction(leadIds: string[]) {
  const userId = await getUserId();
  if (!userId) throw new Error('Unauthorized');

  const db = getDb();
  const leadMap = new Map(
    (await db.select({ id: leads.id, ownerId: leads.ownerId }).from(leads).where(inArray(leads.id, leadIds)))
      .map(l => [l.id, l.ownerId])
  );
  const results: { triggered: number; skipped: { id: string; reason: string }[]; errors: { id: string; reason: string }[] } = { triggered: 0, skipped: [], errors: [] };

  for (const id of leadIds) {
    try {
      if (!leadMap.has(id)) { results.errors.push({ id, reason: 'Lead not found' }); continue; }
      if (leadMap.get(id) && leadMap.get(id) !== userId) { results.skipped.push({ id, reason: 'Not authorized' }); continue; }
      const [existingJob] = await db
        .select({ id: jobRuns.id, status: jobRuns.status })
        .from(jobRuns)
        .where(
          and(
            eq(jobRuns.targetLeadId, id),
            eq(jobRuns.jobType, 'RESEARCH_GENERATION'),
            eq(jobRuns.status, 'QUEUED'),
          )
        )
        .limit(1);

      if (existingJob) {
        results.skipped.push({ id, reason: 'Research already queued' });
        continue;
      }

      const jobId = crypto.randomUUID();
      const now = new Date();

      await db.insert(jobRuns).values({
        id: jobId,
        jobType: 'RESEARCH_GENERATION',
        status: 'QUEUED',
        targetLeadId: id,
        triggeredByUserId: userId,
        externalRunId: 'BULK',
        startedAt: null,
        finishedAt: null,
        createdAt: now,
      });

      let workflowBinding: any = undefined;
      try {
        const { getCloudflareContext } = require('@opennextjs/cloudflare');
        workflowBinding = getCloudflareContext().env?.RESEARCH_SNAPSHOT_WORKFLOW;
      } catch (e) {}
      if (!workflowBinding) {
        workflowBinding = (process.env as any)?.RESEARCH_SNAPSHOT_WORKFLOW;
      }
      await triggerResearchWorkflow(db, workflowBinding, id, jobId, userId);
      results.triggered++;
    } catch (err) {
      results.errors.push({ id, reason: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  revalidatePath('/leads');
  revalidatePath('/');
  return results;
}

export async function bulkArchiveAction(leadIds: string[]) {
  const userId = await getUserId();
  if (!userId) throw new Error('Unauthorized');

  const db = getDb();
  const service = new LeadService(db);
  const leadMap = new Map(
    (await db.select({ id: leads.id, ownerId: leads.ownerId }).from(leads).where(inArray(leads.id, leadIds)))
      .map(l => [l.id, l.ownerId])
  );
  const results: { archived: number; skipped: { id: string; reason: string }[]; errors: { id: string; reason: string }[] } = { archived: 0, skipped: [], errors: [] };

  for (const id of leadIds) {
    try {
      if (!leadMap.has(id)) { results.errors.push({ id, reason: 'Lead not found' }); continue; }
      if (leadMap.get(id) && leadMap.get(id) !== userId) { results.skipped.push({ id, reason: 'Not authorized' }); continue; }
      const lead = await service.getLead(id);
      if (!lead) { results.errors.push({ id, reason: 'Lead not found' }); continue; }
      if (lead.status === 'Archived') { results.skipped.push({ id, reason: 'Already archived' }); continue; }
      await service.archiveLead(id);
      await new LoggingService(db).log({ leadId: id, type: 'SYSTEM', summary: 'Lead archived (bulk operation)' });
      results.archived++;
    } catch (err) {
      results.errors.push({ id, reason: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  revalidatePath('/leads');
  revalidatePath('/');
  return results;
}

export async function bulkReassignAction(leadIds: string[], targetOwnerId: string) {
  const userId = await getUserId();
  if (!userId) throw new Error('Unauthorized');

  const db = getDb();
  const leadMap = new Map(
    (await db.select({ id: leads.id, ownerId: leads.ownerId }).from(leads).where(inArray(leads.id, leadIds)))
      .map(l => [l.id, l.ownerId])
  );

  const [owner] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, targetOwnerId)).limit(1);
  if (!owner) throw new Error('Target owner not found');

  const results: { reassigned: number; skipped: { id: string; reason: string }[]; errors: { id: string; reason: string }[] } = { reassigned: 0, skipped: [], errors: [] };

  for (const id of leadIds) {
    try {
      if (!leadMap.has(id)) { results.errors.push({ id, reason: 'Lead not found' }); continue; }
      if (leadMap.get(id) && leadMap.get(id) !== userId) { results.skipped.push({ id, reason: 'Not authorized' }); continue; }
      const [lead] = await db.select({ id: leads.id, status: leads.status, ownerId: leads.ownerId }).from(leads).where(eq(leads.id, id)).limit(1);
      if (!lead) { results.errors.push({ id, reason: 'Lead not found' }); continue; }
      if (lead.status !== 'Active') { results.skipped.push({ id, reason: `Lead is ${lead.status}` }); continue; }
      if (lead.ownerId === targetOwnerId) { results.skipped.push({ id, reason: 'Already assigned to this owner' }); continue; }
      await db.update(leads).set({ ownerId: targetOwnerId, updatedAt: new Date() }).where(eq(leads.id, id));
      await new LoggingService(db).log({ leadId: id, type: 'SYSTEM', summary: `Lead reassigned to ${owner.name} (bulk operation)` });
      results.reassigned++;
    } catch (err) {
      results.errors.push({ id, reason: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  revalidatePath('/leads');
  revalidatePath('/');
  return results;
}

export async function bulkExportAction(leadIds: string[]): Promise<{ csv: string; count: number }> {
  const userId = await getUserId();
  if (!userId) throw new Error('Unauthorized');

  const db = getDb();
  const rows = await db
    .select({
      name: leads.name,
      company: leads.company,
      email: leads.email,
      phone: leads.phone,
      website: leads.website,
      city: leads.city,
      region: leads.region,
      industry: leads.industry,
      stage: leads.stage,
      status: leads.status,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
    })
    .from(leads)
    .where(and(
      eq(leads.status, 'Active'),
      inArray(leads.id, leadIds),
      or(eq(leads.ownerId, userId), isNull(leads.ownerId)),
    ));

  const headers = ['Name', 'Company', 'Email', 'Phone', 'Website', 'City', 'Region', 'Industry', 'Stage', 'Status', 'Created At', 'Updated At'];
  const escapeCsv = (v: unknown) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push([
      escapeCsv(r.name),
      escapeCsv(r.company),
      escapeCsv(r.email),
      escapeCsv(r.phone),
      escapeCsv(r.website),
      escapeCsv(r.city),
      escapeCsv(r.region),
      escapeCsv(r.industry),
      escapeCsv(r.stage),
      escapeCsv(r.status),
      escapeCsv(r.createdAt?.toISOString()),
      escapeCsv(r.updatedAt?.toISOString()),
    ].join(','));
  }

  return { csv: lines.join('\n'), count: rows.length };
}

export async function bulkAddTaskAction(leadIds: string[], title: string, dueDate: string | null, priority: string) {
  const userId = await getUserId();
  if (!userId) throw new Error('Unauthorized');

  const db = getDb();
  const service = new LeadService(db);
  const leadMap = new Map(
    (await db.select({ id: leads.id, ownerId: leads.ownerId }).from(leads).where(inArray(leads.id, leadIds)))
      .map(l => [l.id, l.ownerId])
  );
  const results = { created: 0, errors: 0 };

  for (const id of leadIds) {
    try {
      if (!leadMap.has(id)) { results.errors++; continue; }
      if (leadMap.get(id) && leadMap.get(id) !== userId) { results.errors++; continue; }
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
  const leadMap = new Map(
    (await db.select({ id: leads.id, ownerId: leads.ownerId }).from(leads).where(inArray(leads.id, leadIds)))
      .map(l => [l.id, l.ownerId])
  );
  const results = { created: 0, errors: 0 };

  for (const id of leadIds) {
    try {
      if (!leadMap.has(id)) { results.errors++; continue; }
      if (leadMap.get(id) && leadMap.get(id) !== userId) { results.errors++; continue; }
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
