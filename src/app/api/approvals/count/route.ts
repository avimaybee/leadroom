import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { outreachDrafts } from '@/db/schema/outreach';
import { prospects } from '@/db/schema/core';
import { getUserId } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ count: 0 });

    const db = getDb();
    const rows = await db
      .select({ id: outreachDrafts.id })
      .from(outreachDrafts)
      .innerJoin(prospects, eq(outreachDrafts.leadId, prospects.id))
      .where(and(eq(outreachDrafts.status, 'DRAFT'), eq(prospects.ownerId, userId)))
      .limit(100);

    return NextResponse.json({ count: rows.length });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
