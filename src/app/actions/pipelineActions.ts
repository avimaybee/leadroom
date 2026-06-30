'use server';

import { getDb } from '@/db';
import { revalidatePath } from 'next/cache';
import { getUserId } from '@/lib/auth';
import { LeadService } from '@/services/lead';
import { eq, desc, sql, and, isNotNull } from 'drizzle-orm';
import { prospects, leadStageHistory } from '@/db/schema/core';
import { outcomes, learningSuggestions } from '@/db/schema/outreach';
import { researchTasks } from '@/db/schema/jobs';
import { count } from 'drizzle-orm';

export async function getPipelineBoardAction() {
  const db = getDb();
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const stages = ['New', 'In Research', 'Auditing', 'Audited', 'Drafting', 'Ready to Send', 'Outreach Sent', 'Meeting', 'Won', 'Lost'];

  const rows = await db
    .select({
      id: prospects.id,
      name: prospects.name,
      company: prospects.company,
      stage: prospects.stage,
      fitScore: prospects.fitScore,
      confidenceScore: prospects.confidenceScore,
      priorityTier: prospects.priorityTier,
      disqualifiedReason: prospects.disqualifiedReason,
      fitReasoning: prospects.fitReasoning,
      updatedAt: prospects.updatedAt,
      createdAt: prospects.createdAt,
    })
    .from(prospects)
    .where(eq(prospects.status, 'Active'))
    .orderBy(desc(prospects.fitScore));

  const board: Record<string, typeof rows> = {};
  for (const stage of stages) {
    board[stage] = rows.filter((r) => r.stage === stage);
  }

  return { board, stages };
}

export async function updateProspectStageAction(prospectId: string, newStage: string) {
  const db = getDb();
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  try {
    const leadService = new LeadService(db);
    await leadService.updateStage(prospectId, newStage);
    revalidatePath('/pipeline');
    revalidatePath('/');
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to update stage';
    return { error: msg };
  }
}

export async function getPipelineTableAction() {
  const db = getDb();
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const rows = await db
    .select({
      id: prospects.id,
      name: prospects.name,
      company: prospects.company,
      stage: prospects.stage,
      fitScore: prospects.fitScore,
      confidenceScore: prospects.confidenceScore,
      priorityTier: prospects.priorityTier,
      disqualifiedReason: prospects.disqualifiedReason,
      fitReasoning: prospects.fitReasoning,
      updatedAt: prospects.updatedAt,
      createdAt: prospects.createdAt,
    })
    .from(prospects)
    .where(eq(prospects.status, 'Active'))
    .orderBy(desc(prospects.fitScore));

  return { prospects: rows };
}

export async function getPipelineAnalyticsAction() {
  const db = getDb();
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const stageCountRows = await db
    .select({
      stage: prospects.stage,
      count: count(),
    })
    .from(prospects)
    .where(eq(prospects.status, 'Active'))
    .groupBy(prospects.stage);

  const totalActive = stageCountRows.reduce((s, r) => s + r.count, 0);

  const [outcomeStats] = await db
    .select({
      total: count(),
      replied: sql<number>`SUM(CASE WHEN ${outcomes.outcomeType} IN ('REPLIED', 'MEETING_BOOKED', 'WON') THEN 1 ELSE 0 END)`,
      bounced: sql<number>`SUM(CASE WHEN ${outcomes.outcomeType} IN ('BOUNCED', 'NOT_INTERESTED', 'LOST') THEN 1 ELSE 0 END)`,
    })
    .from(outcomes);

  const [pendingSuggestions] = await db
    .select({ count: count() })
    .from(learningSuggestions)
    .where(eq(learningSuggestions.status, 'PENDING'));

  return {
    stageCounts: Object.fromEntries(stageCountRows.map((r) => [r.stage, r.count])),
    totalActive,
    outcomeStats: {
      total: outcomeStats?.total ?? 0,
      replied: outcomeStats?.replied ?? 0,
      bounced: outcomeStats?.bounced ?? 0,
    },
    pendingSuggestions: pendingSuggestions?.count ?? 0,
  };
}
