'use server';

import { getDb } from '@/db';
import { stageThresholds } from '@/db/schema/core';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function updateStageThreshold(stage: string, days: number) {
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
