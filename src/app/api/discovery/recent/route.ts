export const revalidate = 30;

import { getLogger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { jobRuns } from '@/db/schema/research';
import { eq, desc, and } from 'drizzle-orm';
import { getUserId } from '@/lib/auth';

const log = getLogger('DiscoveryRecentAPI');

export async function GET(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const filterScopeId = searchParams.get('scopeId');

  const db = getDb();

  try {
    // If filtering by scope, fetch more runs so we can filter in memory and return up to 5.
    // Always scope by the authenticated user to prevent cross-tenant leakage.
    const runs = await db
      .select()
      .from(jobRuns)
      .where(
        and(
          eq(jobRuns.jobType, 'DISCOVERY_SEARCH'),
          eq(jobRuns.triggeredByUserId, userId)
        )
      )
      .orderBy(desc(jobRuns.createdAt))
      .limit(filterScopeId ? 100 : 5);

    const formattedRuns = [];
    for (const run of runs) {
      let niche = '';
      let location = '';
      let scopeId: string | null = null;
      try {
        if (run.jobMeta) {
          const meta = JSON.parse(run.jobMeta);
          niche = meta.niche || '';
          location = meta.location || '';
          scopeId = meta.scopeId || null;
        }
      } catch (e) {
        log.error('Failed to parse jobMeta', e);
      }

      if (filterScopeId && scopeId !== filterScopeId) {
        continue;
      }

      formattedRuns.push({
        id: run.id,
        status: run.status,
        niche,
        location,
        scopeId,
        createdAt: run.createdAt,
        finishedAt: run.finishedAt,
        errorSummary: run.errorSummary,
      });

      if (formattedRuns.length >= 5) {
        break;
      }
    }

    return NextResponse.json({ success: true, data: formattedRuns });
  } catch (error: unknown) {
    log.error('Failed to fetch recent discovery jobs', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
