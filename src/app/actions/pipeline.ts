'use server';

import { getDb } from '@/db';
import { LeadService } from '@/services/lead';
import { stageThresholds, pipelineConfig, playbooks, playbookTasks, prospects } from '@/db/schema/core';
import { eq, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getUserId } from '@/lib/auth';
import { CANONICAL_STAGE_MAP } from '@/services/lead';

function normalizeStage(stage: string | null | undefined): string {
  if (!stage) return 'New';
  return CANONICAL_STAGE_MAP[stage] || stage;
}

// ── Pipeline Board ──

export async function getPipelineProspectsAction() {
  const db = getDb();
  const userId = await getUserId();

  if (!userId) {
    return { error: 'Unauthorized', prospects: [] };
  }

  try {
    const rows = await db
      .select({
        id: prospects.id,
        name: prospects.name,
        company: prospects.company,
        stage: prospects.stage,
        fitScore: prospects.fitScore,
        confidenceScore: prospects.confidenceScore,
        priorityTier: prospects.priorityTier,
        website: prospects.website,
        disqualifiedReason: prospects.disqualifiedReason,
        fitReasoning: prospects.fitReasoning,
      })
      .from(prospects)
      .where(eq(prospects.ownerId, userId))
      .orderBy(desc(prospects.fitScore))
      .limit(200);

    const normalized = rows.map(p => ({
      ...p,
      stage: normalizeStage(p.stage),
    }));

    return { success: true, prospects: normalized };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch pipeline';
    return { error: msg, prospects: [] };
  }
}

// ── Stage Thresholds ──

export async function updateStageThreshold(stage: string, days: number) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };
  const db = getDb();
  const existing = await db.select().from(stageThresholds).where(eq(stageThresholds.stage, stage));

  if (existing.length > 0) {
    await db.update(stageThresholds).set({ days, updatedAt: new Date() }).where(eq(stageThresholds.stage, stage));
  } else {
    await db.insert(stageThresholds).values({
      id: crypto.randomUUID(),
      stage,
      days,
      updatedAt: new Date()
    });
  }

  revalidatePath('/settings/pipeline');
  revalidatePath('/');
}

export type ActionState = { error?: string | null; success?: boolean } | null | undefined;

export async function updateNbaRulesAction(prevState: ActionState, formData: FormData) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const rulesJson = String(formData.get('nbaRules') ?? '');
  if (!rulesJson) return { error: 'Missing NBA rules' };

  const db = getDb();
  try {
    const existing = await db.select().from(pipelineConfig).where(eq(pipelineConfig.id, 'global')).limit(1);
    if (existing.length > 0) {
      await db.update(pipelineConfig).set({ nbaRules: rulesJson, updatedAt: new Date() }).where(eq(pipelineConfig.id, 'global'));
    } else {
      await db.insert(pipelineConfig).values({ id: 'global', nbaRules: rulesJson, enforceStageOrder: false, updatedAt: new Date() });
    }
  } catch {
    return { error: 'Failed to save NBA rules' };
  }

  revalidatePath('/settings/pipeline');
  revalidatePath('/');
  return { success: true };
}

export async function toggleEnforceStageOrderAction(enabled: boolean) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const db = getDb();
  const existing = await db.select().from(pipelineConfig).where(eq(pipelineConfig.id, 'global')).limit(1);
  if (existing.length > 0) {
    await db.update(pipelineConfig).set({ enforceStageOrder: enabled, updatedAt: new Date() }).where(eq(pipelineConfig.id, 'global'));
  } else {
    await db.insert(pipelineConfig).values({ id: 'global', enforceStageOrder: enabled, updatedAt: new Date() });
  }

  revalidatePath('/settings/pipeline');
  revalidatePath('/');
}

export async function upsertPlaybookAction(stage: string, name: string, tasksInput: { title: string; description?: string; daysOffset: number; priority: string; category?: string; actionType?: string; jobType?: string }[]) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const db = getDb();
  const id = crypto.randomUUID();
  const existing = await db.select({ id: playbooks.id }).from(playbooks).where(eq(playbooks.stage, stage)).limit(1);

  try {
    if (existing.length > 0) {
      await db.update(playbooks).set({ name, isActive: true }).where(eq(playbooks.id, existing[0].id));
      await db.delete(playbookTasks).where(eq(playbookTasks.playbookId, existing[0].id));
      for (const t of tasksInput) {
        await db.insert(playbookTasks).values({ id: crypto.randomUUID(), playbookId: existing[0].id, ...t, actionType: t.actionType || 'TASK', jobType: t.jobType || null });
      }
    } else {
      await db.insert(playbooks).values({ id, stage, name, isActive: true });
      for (const t of tasksInput) {
        await db.insert(playbookTasks).values({ id: crypto.randomUUID(), playbookId: id, ...t, actionType: t.actionType || 'TASK', jobType: t.jobType || null });
      }
    }
  } catch {
    return { error: 'Failed to save playbook' };
  }

  revalidatePath('/settings/pipeline');
  revalidatePath('/');
  return { success: true };
}

export async function togglePlaybookActiveAction(stage: string, isActive: boolean) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const db = getDb();
  await db.update(playbooks).set({ isActive }).where(eq(playbooks.stage, stage));
  revalidatePath('/settings/pipeline');
  revalidatePath('/');
  return { success: true };
}

export async function deletePlaybookAction(stage: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const db = getDb();
  await db.delete(playbooks).where(eq(playbooks.stage, stage));
  revalidatePath('/settings/pipeline');
  revalidatePath('/');
  return { success: true };
}

export type NBAResultWithName = {
  action: string;
  type: string;
  priority: string;
  rationale: string;
  link?: string;
  score: number;
  leadName: string;
};

export async function simulateNBARulesAction(draftRulesJson: string): Promise<{ results: NBAResultWithName[] } | { error: string }> {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const db = getDb();
  try {
    const rules = JSON.parse(draftRulesJson);
    const results = await new LeadService(db).simulateNBARules(rules, 5, userId);
    return { results };
  } catch {
    return { error: 'Failed to simulate' };
  }
}

export async function saveStageRequirementsAction(requirements: Record<string, string[]>) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const db = getDb();
  try {
    const existing = await db.select().from(pipelineConfig).where(eq(pipelineConfig.id, 'global')).limit(1);
    if (existing.length > 0) {
      await db.update(pipelineConfig).set({ stageRequirements: requirements, updatedAt: new Date() }).where(eq(pipelineConfig.id, 'global'));
    } else {
      await db.insert(pipelineConfig).values({ id: 'global', stageRequirements: requirements, enforceStageOrder: false, updatedAt: new Date() });
    }
  } catch {
    return { error: 'Failed to save stage requirements' };
  }

  revalidatePath('/settings/pipeline');
  revalidatePath('/');
  return { success: true };
}
