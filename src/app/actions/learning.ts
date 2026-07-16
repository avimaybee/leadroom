'use server';

import { getDb } from '@/db';
import { revalidatePath } from 'next/cache';
import { getUserId } from '@/lib/auth';
import { LearningService } from '@/services/learning';
import { learningSuggestions } from '@/db/schema/outreach';
import { workspaces } from '@/db/schema/strategy';
import { eq, and } from 'drizzle-orm';
import { withLogging } from '@/lib/actions/with-logging';
import { getLogger } from '@/lib/logger';

const log = getLogger('LearningActions');

export async function getLearningSuggestionsAction() {
  const db = getDb();
  const userId = await getUserId();

  if (!userId) {
    return { error: 'Unauthorized', suggestions: [] };
  }

  try {
    const [ws] = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.id, userId)).limit(1);
    if (!ws) return { success: true, suggestions: [] };

    const suggestions = await new LearningService(db).getPendingSuggestions(ws.id);
    return {
      success: true,
      suggestions: suggestions.map(s => ({
        id: s.id,
        suggestedChange: s.suggestedChange || '{}',
        supportingEvidence: s.supportingEvidence || '{}',
        createdAt: s.createdAt,
      })),
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch suggestions';
    return { error: msg, suggestions: [] };
  }
}

export async function getLearningSuggestionCountAction() {
  const db = getDb();
  const userId = await getUserId();

  if (!userId) return 0;

  try {
    const [ws] = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.id, userId)).limit(1);
    if (!ws) return 0;

    const rows = await db
      .select({ id: learningSuggestions.id })
      .from(learningSuggestions)
      .where(and(eq(learningSuggestions.status, 'PENDING'), eq(learningSuggestions.workspaceId, ws.id)))
      .limit(100);

    return rows.length;
  } catch { return 0; }
}

async function applyLearningSuggestionActionImpl(suggestionId: string) {
  const db = getDb();
  const userId = await getUserId();

  if (!userId) {
    return { error: 'Unauthorized' };
  }

  try {
    const learningService = new LearningService(db);
    await learningService.applySuggestion(suggestionId, userId);

    try {
      revalidatePath('/settings/insights');
      revalidatePath('/settings/pipeline');
      revalidatePath('/');
    } catch (e) { log.error('revalidatePath failed', e); }

    return { success: true };
  } catch (e: unknown) {
    log.error('Learning action failed', e);
    const msg = e instanceof Error ? e.message : 'Failed to apply suggestion';
    return { error: msg };
  }
}

export const applyLearningSuggestionAction = withLogging('applyLearningSuggestionAction', applyLearningSuggestionActionImpl);

async function dismissLearningSuggestionActionImpl(suggestionId: string) {
  const db = getDb();
  const userId = await getUserId();

  if (!userId) {
    return { error: 'Unauthorized' };
  }

  try {
    const learningService = new LearningService(db);
    await learningService.dismissSuggestion(suggestionId, userId);

    try {
      revalidatePath('/settings/insights');
      revalidatePath('/settings/pipeline');
      revalidatePath('/');
    } catch (e) { log.error('revalidatePath failed', e); }

    return { success: true };
  } catch (e: unknown) {
    log.error('Learning action failed', e);
    const msg = e instanceof Error ? e.message : 'Failed to dismiss suggestion';
    return { error: msg };
  }
}

export const dismissLearningSuggestionAction = withLogging('dismissLearningSuggestionAction', dismissLearningSuggestionActionImpl);
