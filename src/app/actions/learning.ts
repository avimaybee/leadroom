'use server';

import { getDb } from '@/db';
import { revalidatePath } from 'next/cache';
import { getUserId } from '@/lib/auth';
import { LearningService } from '@/services/learning';
import { learningSuggestions } from '@/db/schema/outreach';
import { eq } from 'drizzle-orm';

export async function applyLearningSuggestionAction(suggestionId: string) {
  const db = getDb();
  const userId = await getUserId();

  if (!userId) {
    return { error: 'Unauthorized' };
  }

  try {
    const learningService = new LearningService(db);
    await learningService.applySuggestion(suggestionId, userId);

    try {
      revalidatePath('/settings/pipeline');
      revalidatePath('/');
    } catch (e) {}

    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to apply suggestion';
    return { error: msg };
  }
}

export async function dismissLearningSuggestionAction(suggestionId: string) {
  const db = getDb();
  const userId = await getUserId();

  if (!userId) {
    return { error: 'Unauthorized' };
  }

  try {
    const learningService = new LearningService(db);
    await learningService.dismissSuggestion(suggestionId, userId);

    try {
      revalidatePath('/settings/pipeline');
      revalidatePath('/');
    } catch (e) {}

    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to dismiss suggestion';
    return { error: msg };
  }
}
