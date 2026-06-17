import { type Db } from '@/db';
import { notifications } from '@/db/schema';

export async function createNotification(
  db: Db,
  userId: string,
  jobRunId: string | null,
  title: string,
  message: string,
  status: 'SUCCESS' | 'ERROR' | 'INFO',
  link?: string
) {
  try {
    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      userId,
      jobRunId,
      title,
      message,
      status,
      link: link || null,
      isRead: false,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('Failed to create notification', error);
  }
}
