'use server';

import { getDb } from '@/db';
import { revalidatePath } from 'next/cache';
import { getUserId } from '@/lib/auth';
import { getLogger } from '@/lib/logger';

const log = getLogger('DiscoveryMarketActions');
import { markets } from '@/db/schema/strategy';
import { eq, and } from 'drizzle-orm';
import { DiscoveryService } from '@/services/discovery';
import { runSearchForScope } from '@/lib/discovery/run-search';
import { discoverySearchLimiter } from '@/lib/rate-limit';
import { withLogging } from '@/lib/actions/with-logging';

async function triggerDiscoveryForMarketActionImpl(
  prevState: { error?: string | null; success?: boolean; scopeId?: string; jobId?: string } | null | undefined,
  formData: FormData
) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const marketId = String(formData.get('marketId') ?? '');
  const niche = String(formData.get('niche') ?? '');
  const location = String(formData.get('location') ?? '');
  const rawLimit = String(formData.get('limit') ?? '');

  if (!marketId || !niche || !location) {
    return { error: 'Market, niche, and location are required' };
  }

  if (typeof niche !== 'string' || niche.length > 500) {
    return { error: 'Niche must be at most 500 characters' };
  }
  if (typeof location !== 'string' || location.length > 500) {
    return { error: 'Location must be at most 500 characters' };
  }

  if (!discoverySearchLimiter.check(userId)) {
    return { error: 'Too many requests. Please wait before starting another search.' };
  }

  const db = getDb();

  // Verify market ownership
  const [market] = await db
    .select({ id: markets.id, name: markets.name, workspaceId: markets.workspaceId })
    .from(markets)
    .where(and(eq(markets.id, marketId), eq(markets.workspaceId, userId)))
    .limit(1);

  if (!market) {
    return { error: 'Market not found' };
  }

  const leadLimit = Math.min(Math.max(parseInt(rawLimit) || 20, 1), 200);

  try {
    // Create a discovery scope linked to this market
    const scopeId = crypto.randomUUID();
    const discoveryService = new DiscoveryService(db);
    await discoveryService.createScope(scopeId, {
      name: `${market.name} Discovery`,
      description: `Auto-discovery for market "${market.name}" searching "${niche}" in "${location}"`,
      industryFilter: niche,
      geographyFilter: location,
      autoResearchPromotedLeads: true,
      createdByUserId: userId,
      workspaceId: market.workspaceId,
      marketId: market.id,
    });

    // Start the Apify search
    const result = await runSearchForScope(db, {
      niche,
      location,
      limit: leadLimit,
      scopeId,
      userId,
    });

    revalidatePath(`/markets/${marketId}/prospects`);
    return { success: true, scopeId, jobId: result.jobId };
  } catch (error: unknown) {
    log.error('Discovery market failed', error);
    const msg = error instanceof Error ? error.message : 'Failed to start discovery search';
    return { error: msg };
  }
}

export const triggerDiscoveryForMarketAction = withLogging(
  'triggerDiscoveryForMarketAction',
  triggerDiscoveryForMarketActionImpl
);
