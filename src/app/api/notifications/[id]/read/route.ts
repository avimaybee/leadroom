export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { getLogger } from '@/lib/logger';
import { notifications } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getUserId } from '@/lib/auth';

const log = getLogger('NotificationsRead');

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let notificationId = 'unknown';
  try {
    const { id } = await params;
    notificationId = id;
    const userId = await getUserId();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();
    await db.update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.userId, userId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (err) {
    log.error('Failed to mark notification read', err, { notificationId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
