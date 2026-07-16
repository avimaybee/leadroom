export const revalidate = 30;

import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { notifications } from '@/db/schema';
import { eq, and, desc, gte } from 'drizzle-orm';
import { getUserId } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 200);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

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
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(notifs);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
