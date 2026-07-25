export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { getLogger } from '@/lib/logger';
import { notifications } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getUserId } from '@/lib/auth';

const log = getLogger('NotificationsReadAll');

export async function POST(request: Request) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();
    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));

    return NextResponse.json({ success: true });
  } catch (err) {
    log.error('Failed to mark all notifications read', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
