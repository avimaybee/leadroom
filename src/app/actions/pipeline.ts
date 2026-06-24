'use server';

import { getDb } from '@/db';
import { stageThresholds, pipelineConfig } from '@/db/schema/core';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getUserId } from '@/lib/auth';

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

  const rulesJson = formData.get('nbaRules') as string;
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
