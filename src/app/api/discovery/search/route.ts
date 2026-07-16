export const dynamic = 'force-dynamic';

import { getLogger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { getUserId } from '@/lib/auth';
import { runSearchForScope } from '@/lib/discovery/run-search';
import { discoverySearchLimiter } from '@/lib/rate-limit';

const log = getLogger('DiscoverySearchAPI');

const SearchRequestSchema = z.object({
  niche: z.string().min(1).max(500),
  location: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(200).optional(),
  scopeId: z.string().min(1),
});

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!discoverySearchLimiter.check(userId)) {
    return NextResponse.json({ error: 'Too many requests. Please wait before starting another search.' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const parsed = SearchRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
    }
    const { niche, location, scopeId, limit } = parsed.data;
    const leadLimit = limit ?? 20;

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
