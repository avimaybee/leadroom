export const dynamic = 'force-dynamic';

import { getDb } from '@/db';
import { eq, sql, and, inArray } from 'drizzle-orm';
import { getUserId } from '@/lib/auth';
import { ProspectsClient } from '@/components/prospects/ProspectsClient';
import { prospects } from '@/db/schema/core';
import { markets } from '@/db/schema/strategy';
import { ShieldAlert } from 'lucide-react';

export const metadata = {
  title: 'Prospects | Leadroom',
};

export default async function ProspectsPage() {
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

  const allProspects = await db
    .select()
    .from(prospects)
    .where(and(eq(prospects.status, 'Active'), eq(prospects.ownerId, userId)))
    .orderBy(sql`COALESCE(${prospects.fitScore}, 0) DESC`);

  const marketIds = [...new Set(allProspects.map(p => p.marketId).filter(Boolean))] as string[];
  const marketRows = marketIds.length > 0
    ? await db.select().from(markets).where(inArray(markets.id, marketIds))
    : [];

  return (
    <ProspectsClient
      initialProspects={allProspects.map(p => ({
        ...p,
        createdAt: p.createdAt ? p.createdAt.toISOString() : null,
        updatedAt: p.updatedAt ? p.updatedAt.toISOString() : null,
        stageUpdatedAt: p.stageUpdatedAt ? p.stageUpdatedAt.toISOString() : null,
        lastActivityAt: p.lastActivityAt ? p.lastActivityAt.toISOString() : null,
      }))}
      markets={marketRows.map(m => ({ id: m.id, name: m.name }))}
    />
  );
}
