import { Db } from '../db';
import { ReminderService } from './reminders';
import { LeadService } from './lead';
import { ScoringService } from './scoring';
import { tasks, notifications, prospects as leads } from '../db/schema/core';
import { createNotification } from '@/lib/notifications';
import { eq, and, isNotNull, lt, gte, count } from 'drizzle-orm';

export interface SweepResult {
  remindersFired: number;
  staleAlerts: number;
  overdueNotifications: number;
}

export async function runReminderSweep(db: Db): Promise<number> {
  const service = new ReminderService(db);
  return service.fireDueReminders();
}

export async function runStaleLeadSweep(db: Db): Promise<number> {
  const service = new LeadService(db);
  return service.checkAndAlertStaleLeads();
}

export async function runOverdueTaskSweep(db: Db): Promise<number> {
  const now = new Date();
  const overdueTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.status, 'Open'),
        isNotNull(tasks.dueDate),
        lt(tasks.dueDate, now),
      )
    );

  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  let notified = 0;
  for (const task of overdueTasks) {
    const userId = task.assigneeId;
    if (!userId) continue;

    // Dedup: skip if already notified in the last 24h about this task
    const [existing] = await db
      .select({ count: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          gte(notifications.createdAt, cutoff),
          eq(notifications.title, `Overdue task: ${task.title}`),
        )
      )
      .limit(1);
    if (existing?.count > 0) continue;

    await createNotification(
      db,
      userId,
      null,
      `Overdue task: ${task.title}`,
      `Task "${task.title}" is overdue (due: ${task.dueDate?.toISOString().split('T')[0]}).`,
      'INFO',
      task.leadId ? `/leads/${task.leadId}` : undefined,
    );
    notified++;
  }
  return notified;
}

export async function runScoreSweep(db: Db): Promise<number> {
  const dirtyLeads = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.status, 'Active'), eq(leads.scoreDirty, true)));

  if (dirtyLeads.length === 0) return 0;

  const scoringService = new ScoringService(db);
  let recalculated = 0;
  for (const { id } of dirtyLeads) {
    try {
      await scoringService.recalculateScore(id);
      recalculated++;
    } catch {
      // skip individual failures
    }
  }
  return recalculated;
}

export async function runAllSweeps(db: Db): Promise<SweepResult & { scoresRecalculated: number }> {
  const [remindersFired, staleAlerts, overdueNotifications, scoresRecalculated] = await Promise.all([
    runReminderSweep(db).catch(() => 0),
    runStaleLeadSweep(db).catch(() => 0),
    runOverdueTaskSweep(db).catch(() => 0),
    runScoreSweep(db).catch(() => 0),
  ]);
  return { remindersFired, staleAlerts, overdueNotifications, scoresRecalculated };
}
