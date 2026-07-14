'use server';

import { DiscoveryService } from '@/services/discovery';
import { getDb } from '@/db';
import { revalidatePath } from 'next/cache';
import { getUserId } from '@/lib/auth';
import { discoveryScopes, candidateLeads } from '@/db/schema/discovery';
import { jobRuns } from '@/db/schema/research';
import { eq, and } from 'drizzle-orm';
import { withLogging } from '@/lib/actions/with-logging';

async function getService() {
  const db = getDb();
  return new DiscoveryService(db);
}

export type CandidateActionState = { error?: string | null; success?: boolean } | null | undefined;

export type JobStatusResult = {
  status: string;
  currentStage: string | null;
  totalItems: number | null;
  itemsProcessed: number | null;
  errorSummary: string | null;
};

/**
 * List all NEW candidates for a market's discovery scopes.
 */
export async function listCandidatesForMarketAction(marketId: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const db = getDb();
  const rows = await db
    .select({
      id: candidateLeads.id,
      rawName: candidateLeads.rawName,
      rawWebsiteUrl: candidateLeads.rawWebsiteUrl,
      rawLocation: candidateLeads.rawLocation,
      rawContactInfo: candidateLeads.rawContactInfo,
      notes: candidateLeads.notes,
      status: candidateLeads.status,
      promotedLeadId: candidateLeads.promotedLeadId,
      createdAt: candidateLeads.createdAt,
      discoveryScopeId: candidateLeads.discoveryScopeId,
      scopeName: discoveryScopes.name,
    })
    .from(candidateLeads)
    .innerJoin(discoveryScopes, eq(candidateLeads.discoveryScopeId, discoveryScopes.id))
    .where(
      and(
        eq(discoveryScopes.marketId, marketId),
        eq(candidateLeads.status, 'NEW'),
        eq(discoveryScopes.workspaceId, userId)
      )
    )
    .orderBy(candidateLeads.createdAt);

  return { success: true, candidates: rows };
}

/**
 * Promote a candidate to a prospect in the market.
 */
async function promoteCandidateActionImpl(
  prevState: CandidateActionState,
  formData: FormData
) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const candidateId = formData.get('candidateId') as string;
  if (!candidateId) return { error: 'Candidate ID is required' };

  try {
    const service = await getService();
    const promoted = await service.promoteCandidate(candidateId, userId);

    revalidatePath(`/markets/${promoted.marketId}/prospects`);
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to promote candidate';
    return { error: msg };
  }
}

export const promoteCandidateAction = withLogging('promoteCandidateAction', promoteCandidateActionImpl);

/**
 * Update candidate fields (name, website, location) before promoting.
 */
async function updateCandidateActionImpl(
  prevState: CandidateActionState,
  formData: FormData
) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const candidateId = formData.get('candidateId') as string;
  if (!candidateId) return { error: 'Candidate ID is required' };

  const rawName = formData.get('rawName') as string;
  const rawWebsiteUrl = formData.get('rawWebsiteUrl') as string;
  const rawLocation = formData.get('rawLocation') as string;

  if (!rawName || rawName.length > 500) {
    return { error: 'Name is required and must be at most 500 characters' };
  }

  try {
    const service = await getService();
    await service.updateCandidate(candidateId, {
      rawName,
      rawWebsiteUrl: rawWebsiteUrl || null,
      rawLocation: rawLocation || null,
    });

    revalidatePath(`/markets/*/prospects`);
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update candidate';
    return { error: msg };
  }
}

export const updateCandidateAction = withLogging('updateCandidateAction', updateCandidateActionImpl);

/**
 * Discard a candidate (mark as DISCARDED) with an optional reason.
 */
async function discardCandidateActionImpl(
  prevState: CandidateActionState,
  formData: FormData
) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const candidateId = formData.get('candidateId') as string;
  const marketId = formData.get('marketId') as string;
  const discardReason = formData.get('discardReason') as string;
  if (!candidateId) return { error: 'Candidate ID is required' };

  try {
    const service = await getService();
    await service.updateCandidateStatus(candidateId, 'DISCARDED', discardReason || null);

    if (marketId) {
      revalidatePath(`/markets/${marketId}/prospects`);
    }
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to discard candidate';
    return { error: msg };
  }
}

export const discardCandidateAction = withLogging('discardCandidateAction', discardCandidateActionImpl);

/**
 * Check the current status of a discovery search job for polling.
 */
export async function checkDiscoveryJobAction(jobId: string): Promise<JobStatusResult | { error: string }> {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  try {
    const db = getDb();
    const [job] = await db
      .select({
        status: jobRuns.status,
        currentStage: jobRuns.currentStage,
        totalItems: jobRuns.totalItems,
        itemsProcessed: jobRuns.itemsProcessed,
        errorSummary: jobRuns.errorSummary,
      })
      .from(jobRuns)
      .where(and(eq(jobRuns.id, jobId), eq(jobRuns.triggeredByUserId, userId)))
      .limit(1);

    if (!job) return { error: 'Job not found' };
    return job;
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Failed to check job status' };
  }
}
