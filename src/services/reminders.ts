import { type Db } from '@/db';
import { reminders, notifications } from '@/db/schema/core';
import { eq, and, lte, inArray } from 'drizzle-orm';
import { LoggingService } from './logging';

export class ReminderService {
  constructor(private db: Db) {}

  async createReminder(
    leadId: string,
    userId: string,
    title: string,
    message: string | null,
    remindAt: Date,
    link?: string,
  ) {
    const id = crypto.randomUUID();
    const now = new Date();

    await this.db.insert(reminders).values({
      id,
      leadId,
      userId,
      title,
      message,
      remindAt,
      isFired: false,
      createdAt: now,
      link: link || null,
    });

    await new LoggingService(this.db).log({
      leadId,
      type: 'Reminder set',
      summary: `Reminder set: "${title}" for ${remindAt.toISOString()}`,
    });

    return id;
  }

  async fireDueReminders(): Promise<number> {
    const now = new Date();
    const due = await this.db
      .select()
      .from(reminders)
      .where(and(lte(reminders.remindAt, now), eq(reminders.isFired, false)))
      .limit(200);

    if (due.length === 0) return 0;

    const notificationRows = due.map(r => ({
      id: crypto.randomUUID(),
      userId: r.userId,
      jobRunId: null as string | null,
      title: `\u23F0 ${r.title}`,
      message: r.message || 'Reminder is due.',
      status: 'INFO' as const,
      link: r.link || (r.leadId ? `/leads/${r.leadId}` : undefined) || null,
      isRead: false,
      createdAt: now,
    }));

    await this.db.insert(notifications).values(notificationRows);

    await this.db
      .update(reminders)
      .set({ isFired: true })
      .where(inArray(reminders.id, due.map(r => r.id)));

    return due.length;
  }
}
