export const dynamic = 'force-dynamic';

import { getDb } from '@/db';
import { researchTasks } from '@/db/schema/jobs';
import { outreachDrafts } from '@/db/schema/outreach';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { LeadService } from '@/services/lead';
import { getUserId } from '@/lib/auth';
import { ProspectDetailClient } from './ProspectDetailClient';

export default async function ProspectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const userId = await getUserId();
  if (!userId) notFound();

  const leadService = new LeadService(db);
  const prospect = await leadService.getProspectDetail(id, userId);
  if (!prospect) notFound();

  const tasks = await db
    .select({
      taskType: researchTasks.taskType,
      status: researchTasks.status,
      extractedSignals: researchTasks.extractedSignals,
      confidence: researchTasks.confidence,
      errorMessage: researchTasks.errorMessage,
    })
    .from(researchTasks)
    .where(eq(researchTasks.prospectId, id))
    .orderBy(researchTasks.createdAt);

  const drafts = await db
    .select({
      id: outreachDrafts.id,
      subject: outreachDrafts.subject,
      body: outreachDrafts.body,
      status: outreachDrafts.status,
      citedEvidence: outreachDrafts.citedEvidence,
      riskFlags: outreachDrafts.riskFlags,
      rejectionReason: outreachDrafts.rejectionReason,
    })
    .from(outreachDrafts)
    .where(eq(outreachDrafts.leadId, id))
    .orderBy(outreachDrafts.createdAt);

  return (
    <ProspectDetailClient
      prospect={{
        id: prospect.id,
        name: prospect.name,
        company: prospect.company ?? null,
        website: prospect.website ?? null,
        email: prospect.email ?? null,
        stage: prospect.stage,
        status: prospect.status,
        fitScore: prospect.fitScore ?? null,
        confidenceScore: prospect.confidenceScore ?? null,
        priorityTier: prospect.priorityTier ?? null,
        disqualifiedReason: prospect.disqualifiedReason ?? null,
        fitReasoning: prospect.fitReasoning ?? null,
      }}
      researchTasks={tasks.map((t) => ({
        taskType: t.taskType,
        status: t.status,
        extractedSignals: t.extractedSignals ?? null,
        confidence: t.confidence ?? null,
        errorMessage: t.errorMessage ?? null,
      }))}
      initialDrafts={drafts.map((d) => ({
        id: d.id,
        subject: d.subject ?? null,
        body: d.body,
        status: d.status,
        citedEvidence: d.citedEvidence ?? null,
        riskFlags: d.riskFlags ?? null,
        rejectionReason: d.rejectionReason ?? null,
      }))}
    />
  );
}
