export const dynamic = 'force-dynamic';

import { getLogger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { getUserId } from '@/lib/auth';
import { runSearchForScope } from '@/lib/discovery/run-search';
import { discoverySearchLimiter } from '@/lib/rate-limit';

const log = getLogger('DiscoverySearchAPI');

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!discoverySearchLimiter.check(userId)) {
    return NextResponse.json({ error: 'Too many requests. Please wait before starting another search.' }, { status: 429 });
  }

  try {
    const { niche, location, limit, scopeId } = (await request.json()) as {
      niche?: string;
      location?: string;
      limit?: number;
      scopeId?: string;
    };

    if (!niche || !location) {
      return NextResponse.json({ error: 'Niche and location are required' }, { status: 400 });
    }
    if (typeof niche !== 'string' || niche.length > 500) {
      return NextResponse.json({ error: 'Niche must be at most 500 characters' }, { status: 400 });
    }
    if (typeof location !== 'string' || location.length > 500) {
      return NextResponse.json({ error: 'Location must be at most 500 characters' }, { status: 400 });
    }
    if (!scopeId || typeof scopeId !== 'string') {
      return NextResponse.json({ error: 'scopeId is required' }, { status: 400 });
    }
    const leadLimit = Math.min(Math.max(limit || 20, 1), 200);

    const db = getDb();
    const result = await runSearchForScope(db, {
      niche,
      location,
      limit: leadLimit,
      scopeId,
      userId,
    });

    return NextResponse.json(result, { status: 202 });
  } catch (error: unknown) {
    log.error('Discovery Search API Error', error);
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
