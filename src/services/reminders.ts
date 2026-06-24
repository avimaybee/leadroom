import { type Db } from '@/db';
import { reminders } from '@/db/schema/core';
import { eq, and, lte } from 'drizzle-orm';
import { createNotification } from '@/lib/notifications';
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
      .all();

    for (const r of due) {
      await createNotification(
        this.db,
        r.userId,
        null,
        `\u23F0 ${r.title}`,
        r.message || 'Reminder is due.',
        'INFO',
        r.link || (r.leadId ? `/leads/${r.leadId}` : undefined),
      );

      await this.db
        .update(reminders)
        .set({ isFired: true })
        .where(eq(reminders.id, r.id));
    }

    return due.length;
  }
}
