import { type Db } from '@/db';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { outcomes, learningSuggestions } from '@/db/schema/outreach';
import { prospects, users } from '@/db/schema/core';
import { icpProfiles, workspaces } from '@/db/schema/strategy';
import { generateLearningSuggestions } from '@/lib/domain/outcomes';
import { researchTasks } from '@/db/schema/jobs';
import type { ExtractedSignal } from '@/lib/domain/scoring';
import { createNotification } from '@/lib/notifications';
import { getLogger } from '@/lib/logger';

const log = getLogger('LearningService');

export class LearningService {
  constructor(private db: Db) {}

  async triggerLearningLoop(workspaceId: string): Promise<void> {
    const outcomeRows = await this.db
      .select({
        id: outcomes.id,
        prospectId: outcomes.prospectId,
        outcomeType: outcomes.outcomeType,
      })
      .from(outcomes)
      .innerJoin(prospects, eq(outcomes.prospectId, prospects.id))
      .where(eq(prospects.workspaceId, workspaceId))
      .limit(500);

    if (outcomeRows.length < 3) return;

    const [icpRow] = await this.db
      .select()
      .from(icpProfiles)
      .where(eq(icpProfiles.workspaceId, workspaceId))
      .limit(1);

    if (!icpRow) return;

    const positiveSignals = safeParseJsonArray(icpRow.positiveSignals);
    const negativeSignals = safeParseJsonArray(icpRow.negativeSignals);
    const disqualifiers = safeParseJsonArray(icpRow.disqualifiers);

    const prospectIds = [...new Set(outcomeRows.map((o) => o.prospectId))];
    if (prospectIds.length === 0) return;

    const signalRows = await this.db
      .select({
        prospectId: researchTasks.prospectId,
        extractedSignals: researchTasks.extractedSignals,
      })
      .from(researchTasks)
      .where(inArray(researchTasks.prospectId, prospectIds))
      .limit(500);

    const signalsByProspect = new Map<string, any[]>();
    for (const sr of signalRows) {
      if (sr.extractedSignals) {
        try {
          signalsByProspect.set(sr.prospectId, sr.extractedSignals as ExtractedSignal[]);
        } catch {
          log.warn('Failed to parse extractedSignals for prospect', { prospectId: sr.prospectId });
        }
      }
    }

    const outcomeEvents = outcomeRows.map((o) => ({
      prospectId: o.prospectId,
      outcomeType: o.outcomeType,
      signals: (signalsByProspect.get(o.prospectId) || []) as ExtractedSignal[],
    }));

    const suggestions = generateLearningSuggestions(
      workspaceId,
      outcomeEvents,
      {
        positiveSignals: positiveSignals.map((s: any) => ({
          name: s.name ?? s,
          weight: s.weight ?? 1,
          description: s.description ?? '',
        })),
        negativeSignals: negativeSignals.map((s: any) => ({
          name: s.name ?? s,
          weight: s.weight ?? 1,
          description: s.description ?? '',
        })),
        disqualifiers: disqualifiers.map((d: any) => (typeof d === 'string' ? d : d.name ?? d)),
      },
    );

    if (suggestions.length === 0) return;

    // Batch-check existing PENDING suggestions matching target + type
    const existingPairs = new Set<string>();
    if (suggestions.length <= 100) {
      try {
        const existingRows = await this.db
          .select({
            target: sql`json_extract(${learningSuggestions.suggestedChange}, '$.target')`,
            type: sql`json_extract(${learningSuggestions.suggestedChange}, '$.type')`,
          })
          .from(learningSuggestions)
          .where(and(
            eq(learningSuggestions.workspaceId, workspaceId),
            eq(learningSuggestions.status, 'PENDING'),
          ))
          .limit(500);
        for (const row of existingRows) {
          existingPairs.add(`${row.target}:${row.type}`);
        }
      } catch {
        log.warn('Failed to fetch existing pending suggestions for dedup');
      }
    }

    const newRows: Array<typeof learningSuggestions.$inferInsert> = [];
    const notificationsToCreate: Array<{ userId: string; title: string; message: string }> = [];

    for (const s of suggestions) {
      const pairKey = `${s.suggestion.suggestedChange.target}:${s.suggestion.suggestedChange.type}`;
      if (existingPairs.has(pairKey)) continue;

      newRows.push({
        id: crypto.randomUUID(),
        workspaceId,
        suggestedChange: JSON.stringify(s.suggestion.suggestedChange),
        supportingEvidence: JSON.stringify(s.suggestion.supportingEvidence),
        status: 'PENDING',
        createdAt: new Date(),
      } as any);

      notificationsToCreate.push({
        userId: workspaceId,
        title: 'New ICP Insight Suggestion',
        message: `The system has identified pattern variations and suggested: ${s.suggestion.suggestedChange.type.replace(/_/g, ' ')} "${s.suggestion.suggestedChange.target}"`,
      });
    }

    if (newRows.length > 0) {
      await this.db.insert(learningSuggestions).values(newRows);
    }

    for (const n of notificationsToCreate) {
      await createNotification(this.db, n.userId, null, n.title, n.message, 'INFO', '/settings/insights');
    }
  }

  async applySuggestion(suggestionId: string, userId: string): Promise<void> {
    // workspace.id === userId by convention (set by getOrCreateWorkspaceAction)
    const [suggestion] = await this.db
      .select()
      .from(learningSuggestions)
      .where(and(eq(learningSuggestions.id, suggestionId), eq(learningSuggestions.workspaceId, userId)))
      .limit(1);

    if (!suggestion) throw new Error('Suggestion not found');
    if (suggestion.status !== 'PENDING') throw new Error('Suggestion is not pending');

    let change: any = suggestion.suggestedChange ?? {};
    const workspaceId = suggestion.workspaceId;

    const [icpRow] = await this.db
      .select()
      .from(icpProfiles)
      .where(eq(icpProfiles.workspaceId, workspaceId))
      .limit(1);

    if (!icpRow) throw new Error('ICP profile not found');

    const positiveSignals: any[] = safeParseJsonArray(icpRow.positiveSignals);
    const negativeSignals: any[] = safeParseJsonArray(icpRow.negativeSignals);
    const disqualifiers: string[] = safeParseJsonArray(icpRow.disqualifiers);

    if (change.type === 'increase_weight' || change.type === 'decrease_weight') {
      const idx = positiveSignals.findIndex((s: any) => s.name === change.target);
      if (idx !== -1) {
        positiveSignals[idx].weight = change.suggestedValue ?? positiveSignals[idx].weight;
      }
    } else if (change.type === 'make_negative') {
      const idx = positiveSignals.findIndex((s: any) => s.name === change.target);
      if (idx !== -1) {
        const signal = positiveSignals.splice(idx, 1)[0];
        negativeSignals.push({ ...signal, weight: Math.abs(signal.weight ?? 1) });
      }
    } else if (change.type === 'remove_disqualifier') {
      const idx = disqualifiers.indexOf(change.target);
      if (idx !== -1) disqualifiers.splice(idx, 1);
    } else if (change.type === 'add_disqualifier') {
      if (!disqualifiers.includes(change.target)) {
        disqualifiers.push(change.target);
      }
    }

    await this.db
      .update(icpProfiles)
      .set({
        positiveSignals: JSON.stringify(positiveSignals),
        negativeSignals: JSON.stringify(negativeSignals),
        disqualifiers: JSON.stringify(disqualifiers),
        updatedAt: new Date(),
      })
      .where(eq(icpProfiles.id, icpRow.id));

    await this.db
      .update(learningSuggestions)
      .set({
        status: 'APPLIED',
        reviewedAt: new Date(),
        reviewedByUserId: userId,
      })
      .where(eq(learningSuggestions.id, suggestionId));
  }

  async dismissSuggestion(suggestionId: string, userId: string): Promise<void> {
    // workspace.id === userId by convention (set by getOrCreateWorkspaceAction)
    const [suggestion] = await this.db
      .select()
      .from(learningSuggestions)
      .where(and(eq(learningSuggestions.id, suggestionId), eq(learningSuggestions.workspaceId, userId)))
      .limit(1);

    if (!suggestion) throw new Error('Suggestion not found');
    if (suggestion.status !== 'PENDING') throw new Error('Suggestion is not pending');

    await this.db
      .update(learningSuggestions)
      .set({
        status: 'DISMISSED',
        reviewedAt: new Date(),
        reviewedByUserId: userId,
      })
      .where(eq(learningSuggestions.id, suggestionId));
  }

  async getPendingSuggestions(workspaceId: string) {
    return this.db
      .select()
      .from(learningSuggestions)
      .where(
        and(
          eq(learningSuggestions.workspaceId, workspaceId),
          eq(learningSuggestions.status, 'PENDING'),
        ),
      )
      .orderBy(learningSuggestions.createdAt);
  }
}

function safeParseJsonArray(value: unknown): any[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
