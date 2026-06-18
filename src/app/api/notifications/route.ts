export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { notifications } from '@/db/schema';
import { eq, and, desc, gte } from 'drizzle-orm';
import { getUserId } from '@/lib/auth';

export async function GET(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  
  // Requirement: Notification history should be automatically purged or archived after 30 days to maintain performance.
  // We can just query those created in the last 30 days here.
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const notifs = await db.select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        gte(notifications.createdAt, thirtyDaysAgo)
      )
    )
    .orderBy(desc(notifications.createdAt));

  return NextResponse.json(notifs);
}
