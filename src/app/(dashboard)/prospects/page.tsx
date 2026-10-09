export const dynamic = 'force-dynamic';

import { getDb } from '@/db';
import { eq, sql, and, inArray, or, like, count } from 'drizzle-orm';
import { getUserId } from '@/lib/auth';
import { ProspectsClient } from '@/components/prospects/ProspectsClient';
import { prospects } from '@/db/schema/core';
import { markets } from '@/db/schema/strategy';
import { ShieldAlert } from 'lucide-react';

export const metadata = {
  title: 'Prospects | Leadroom',
};

const PAGE_LIMIT = 200;

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; stage?: string; search?: string; market?: string }>;
}) {
  const db = getDb();
  const userId = await getUserId();

  if (!userId) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
        <ShieldAlert className="w-5 h-5 text-destructive shrink-0" />
        <p className="text-copy-14 text-destructive">Unauthorized. Please log in.</p>
      </div>
    );
  }

  const resolved = await searchParams;
  const tierFilter = (resolved.tier || 'all').toLowerCase();
  const stageFilter = resolved.stage || '';
  const search = (resolved.search || '').trim();
  const marketFilter = resolved.market || 'all';

  const conditions = [eq(prospects.status, 'Active'), eq(prospects.ownerId, userId)];
  if (tierFilter !== 'all') {
    conditions.push(eq(prospects.priorityTier, tierFilter));
  }
  if (stageFilter) {
    conditions.push(eq(prospects.stage, stageFilter));
  }
  if (marketFilter !== 'all') {
    conditions.push(eq(prospects.marketId, marketFilter));
  }
  if (search) {
    conditions.push(
      or(
        like(prospects.company, `%${search}%`),
        like(prospects.name, `%${search}%`)
      )!
    );
  }

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: prospects.id,
        name: prospects.name,
        company: prospects.company,
        email: prospects.email,
        phone: prospects.phone,
        website: prospects.website,
        city: prospects.city,
        region: prospects.region,
        industry: prospects.industry,
        stage: prospects.stage,
        isRead: prospects.isRead,
        status: prospects.status,
        workspaceId: prospects.workspaceId,
        marketId: prospects.marketId,
        fitScore: prospects.fitScore,
        confidenceScore: prospects.confidenceScore,
        priorityTier: prospects.priorityTier,
        disqualifiedReason: prospects.disqualifiedReason,
        ownerId: prospects.ownerId,
        createdAt: prospects.createdAt,
        updatedAt: prospects.updatedAt,
        stageUpdatedAt: prospects.stageUpdatedAt,
        lastActivityAt: prospects.lastActivityAt,
      })
      .from(prospects)
      .where(and(...conditions))
      .orderBy(sql`COALESCE(${prospects.fitScore}, 0) DESC`)
      .limit(PAGE_LIMIT),
    db
      .select({ count: count() })
      .from(prospects)
      .where(and(...conditions)),
  ]);

  const total = Number(totalRow[0]?.count ?? rows.length);
  const marketIds = [...new Set(rows.map(p => p.marketId).filter(Boolean))] as string[];
  const marketRows = marketIds.length > 0
    ? await db.select().from(markets).where(inArray(markets.id, marketIds))
    : [];

  const description =
    total === rows.length
      ? `Showing ${rows.length} prospect${rows.length === 1 ? '' : 's'}`
      : `Showing ${rows.length} of ${total} prospects — refine filters to narrow down`;

  return (
    <ProspectsClient
      initialProspects={rows.map(p => ({
        ...p,
        createdAt: p.createdAt ? p.createdAt.toISOString() : null,
        updatedAt: p.updatedAt ? p.updatedAt.toISOString() : null,
        stageUpdatedAt: p.stageUpdatedAt ? p.stageUpdatedAt.toISOString() : null,
        lastActivityAt: p.lastActivityAt ? p.lastActivityAt.toISOString() : null,
      }))}
      markets={marketRows.map(m => ({ id: m.id, name: m.name }))}
      activeTier={tierFilter}
      activeStage={stageFilter}
      activeSearch={search}
      activeMarket={marketFilter}
      description={description}
      totalCount={total}
    />
  );
}
