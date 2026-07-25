import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { getLogger } from '@/lib/logger';
import { outreachDrafts } from '@/db/schema/outreach';
import { prospects } from '@/db/schema/core';
import { getUserId } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

const log = getLogger('ApprovalsCountAPI');

export const revalidate = 30;

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb();
    const rows = await db
      .select({ id: outreachDrafts.id })
      .from(outreachDrafts)
      .innerJoin(prospects, eq(outreachDrafts.leadId, prospects.id))
      .where(and(eq(outreachDrafts.status, 'DRAFT'), eq(prospects.ownerId, userId)))
      .limit(100);

    return NextResponse.json({ count: rows.length });
  } catch (err) {
    log.error('Failed to fetch approval count', err);
    return NextResponse.json({ error: 'Failed to fetch approval count' }, { status: 500 });
  }
}
