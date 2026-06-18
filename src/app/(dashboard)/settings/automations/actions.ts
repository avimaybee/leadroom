'use server';

import { getDb } from '@/db';
import { automationSettings } from '@/db/schema/core';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getUserId } from '@/lib/auth';


export async function toggleAutomationAction(eventType: string, isEnabled: boolean) {
  const db = getDb();
  const userId = await getUserId();
  if (!userId) {
    return { error: 'Unauthorized' };
  }

  const existing = await db.select().from(automationSettings)
    .where(and(eq(automationSettings.userId, userId), eq(automationSettings.eventType, eventType)));

  if (existing.length > 0) {
    await db.update(automationSettings)
      .set({ isEnabled, updatedAt: new Date() })
      .where(eq(automationSettings.id, existing[0].id));
  } else {
    await db.insert(automationSettings).values({
      id: crypto.randomUUID(),
      userId,
      eventType,
      isEnabled,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  revalidatePath('/settings/automations');
  return { success: true };
}
