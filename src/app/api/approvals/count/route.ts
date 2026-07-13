import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { outreachDrafts } from '@/db/schema/outreach';
import { getUserId } from '@/lib/auth';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ count: 0 });

    const db = getDb();
    const rows = await db
      .select({ id: outreachDrafts.id })
      .from(outreachDrafts)
      .where(eq(outreachDrafts.status, 'DRAFT'))
      .limit(100);

    return NextResponse.json({ count: rows.length });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
