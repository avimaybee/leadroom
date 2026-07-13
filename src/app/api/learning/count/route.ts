import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { learningSuggestions } from '@/db/schema/outreach';
import { workspaces } from '@/db/schema/strategy';
import { getUserId } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ count: 0 });

    const db = getDb();
    const [ws] = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.id, userId)).limit(1);
    if (!ws) return NextResponse.json({ count: 0 });

    const rows = await db
      .select({ id: learningSuggestions.id })
      .from(learningSuggestions)
      .where(and(eq(learningSuggestions.status, 'PENDING'), eq(learningSuggestions.workspaceId, ws.id)))
      .limit(100);

    return NextResponse.json({ count: rows.length });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
