import { type Db } from '../db';
import { getLogger } from '../lib/logger';
import { ReminderService } from './reminders';
import { LeadService } from './lead';
import { ScoringService } from './scoring';
import { tasks, notifications, sweepLocks, prospects as leads, leadStageHistory, nbaActionLogs } from '../db/schema/core';
import { leadScores, audits } from '../db/schema/audits';
import { jobRuns } from '../db/schema/research';
import { researchTasks } from '../db/schema/jobs';
import { createNotification } from '@/lib/notifications';
import { eq, and, isNotNull, lt, gte, lte, inArray } from 'drizzle-orm';

const log = getLogger('Sweeps');
const SWEEP_CONCURRENCY = 5;
const SWEEP_LOCK_TTL_MS = 4 * 60 * 1000; // 4 minutes — cron runs every 5 min, so 4 min prevents overlap

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
    .select({
      id: tasks.id,
      title: tasks.title,
      assigneeId: tasks.assigneeId,
      leadId: tasks.leadId,
      dueDate: tasks.dueDate,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.status, 'Open'),
        isNotNull(tasks.dueDate),
        lt(tasks.dueDate, now),
      )
    )
    .limit(500);

  if (overdueTasks.length === 0) return 0;

  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const existingNotifs = await db
    .select({
      userId: notifications.userId,
      title: notifications.title,
    })
    .from(notifications)
    .where(
      and(
        gte(notifications.createdAt, cutoff),
        eq(notifications.status, 'INFO'),
      )
    );
  const notifiedSet = new Set(existingNotifs.map(n => `${n.userId}:${n.title}`));

  let notified = 0;
  const executing = new Set<Promise<void>>();
  for (const task of overdueTasks) {
    const userId = task.assigneeId;
    if (!userId) continue;
    const notifTitle = `Overdue task: ${task.title}`;
    if (notifiedSet.has(`${userId}:${notifTitle}`)) continue;

    const p = (async () => {
      await createNotification(
        db,
        userId,
        null,
        notifTitle,
        `Task "${task.title}" is overdue (due: ${task.dueDate?.toISOString().split('T')[0]}).`,
        'INFO',
        task.leadId ? `/leads/${task.leadId}` : undefined,
      );
      notified++;
    })();
    executing.add(p);
    p.finally(() => executing.delete(p));
    if (executing.size >= SWEEP_CONCURRENCY) {
      await Promise.race(executing);
    }
  }
  await Promise.allSettled(executing);
  return notified;
}

export async function runScoreSweep(db: Db): Promise<number> {
  const dirtyLeads = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.status, 'Active'), eq(leads.scoreDirty, true)))
    .limit(500);

  if (dirtyLeads.length === 0) return 0;

  const scoringService = new ScoringService(db);
  let recalculated = 0;
  const failedLeadIds: string[] = [];
  const executing = new Set<Promise<void>>();
  const sweepStartTime = Date.now();
  const MAX_SWEEP_DURATION_MS = 20_000;
  for (const { id } of dirtyLeads) {
    if (Date.now() - sweepStartTime > MAX_SWEEP_DURATION_MS) {
      log.warn(`Score sweep budget exceeded ${MAX_SWEEP_DURATION_MS}ms — stopping early, leaving ${dirtyLeads.length - recalculated - failedLeadIds.length} rows for next sweep`);
      break;
    }
    const p = (async () => {
      try {
        await scoringService.recalculateScore(id);
        recalculated++;
      } catch (err) {
        failedLeadIds.push(id);
        log.error('runScoreSweep failed for lead', err, { leadId: id });
      }
    })();
    executing.add(p);
    p.finally(() => executing.delete(p));
    if (executing.size >= SWEEP_CONCURRENCY) {
      await Promise.race(executing);
    }
  }
  await Promise.allSettled(executing);
  return recalculated;
}

/**
 * Resets research tasks that have been stuck in RUNNING state for more than 30 minutes
 * back to PENDING so they can be retried by the next trigger.
 */
export async function runStuckResearchTaskSweep(db: Db): Promise<number> {
  const STUCK_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS);

  const stuckTasks = await db
    .select({ id: researchTasks.id })
    .from(researchTasks)
    .where(
      and(
        eq(researchTasks.status, 'RUNNING'),
        lt(researchTasks.startedAt, cutoff),
      )
    )
    .limit(500);

  if (stuckTasks.length === 0) return 0;

  const now = new Date();
  const batchUpdates = stuckTasks.map(({ id }) =>
    db
      .update(researchTasks)
      .set({ status: 'PENDING', startedAt: null, updatedAt: now })
      .where(eq(researchTasks.id, id))
  );
  await db.batch(batchUpdates as any);

  log.info(`Reset ${stuckTasks.length} stuck research task(s) back to PENDING`);
  return stuckTasks.length;
}

/**
 * Resets job runs that have been stuck in RUNNING state for more than 30 minutes to FAILED.
 */
export async function runStuckJobRunSweep(db: Db): Promise<number> {
  const STUCK_THRESHOLD_MS = 30 * 60 * 1000;
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS);

  const stuckJobs = await db
    .select({ id: jobRuns.id })
    .from(jobRuns)
    .where(
      and(
        eq(jobRuns.status, 'RUNNING'),
        lt(jobRuns.startedAt, cutoff),
      )
    )
    .limit(500);

  if (stuckJobs.length === 0) return 0;

  const now = new Date();
  const batchUpdates = stuckJobs.map(({ id }) =>
    db
      .update(jobRuns)
      .set({ status: 'FAILED', finishedAt: now })
      .where(eq(jobRuns.id, id))
  );
  await db.batch(batchUpdates as any);

  log.info(`Reset ${stuckJobs.length} stuck job run(s) to FAILED`);
  return stuckJobs.length;
}

/**
 * Prunes old rows from unbounded tables to prevent storage bloat.
 * - notifications: delete READ notifications older than 30 days
 * - lead_scores: delete non-current scores older than 30 days (keep the current score per lead)
 * - lead_stage_history: delete entries older than 90 days
 * - nba_action_logs: delete entries older than 90 days
 * - job_runs: delete COMPLETED/FAILED runs older than 30 days
 * - audits: delete entries older than 90 days
 */
export async function runTablePruningSweep(db: Db): Promise<{ deletedNotifications: number; deletedScores: number; deletedHistory: number; deletedLogs: number; deletedJobs: number; deletedAudits: number }> {
  const cutoff30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const cutoff90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const BATCH_SIZE = 500;

  const deletedNotifications = await db
    .delete(notifications)
    .where(and(lte(notifications.createdAt, cutoff30d), eq(notifications.isRead, true)))
    .limit(BATCH_SIZE)
    .returning({ id: notifications.id });

  const deletedScores = await db
    .delete(leadScores)
    .where(and(lte(leadScores.createdAt, cutoff30d), eq(leadScores.isCurrent, 0)))
    .limit(BATCH_SIZE)
    .returning({ id: leadScores.id });

  const deletedHistory = await db
    .delete(leadStageHistory)
    .where(lte(leadStageHistory.enteredAt, cutoff90d))
    .limit(BATCH_SIZE)
    .returning({ id: leadStageHistory.id });

  const deletedLogs = await db
    .delete(nbaActionLogs)
    .where(lte(nbaActionLogs.actionTakenAt, cutoff90d))
    .limit(BATCH_SIZE)
    .returning({ id: nbaActionLogs.id });

  const deletedJobs = await db
    .delete(jobRuns)
    .where(and(lte(jobRuns.createdAt, cutoff30d), inArray(jobRuns.status, ['COMPLETED', 'FAILED', 'CANCELLED'])))
    .limit(BATCH_SIZE)
    .returning({ id: jobRuns.id });

  const deletedAudits = await db
    .delete(audits)
    .where(lte(audits.createdAt, cutoff90d))
    .limit(BATCH_SIZE)
    .returning({ id: audits.id });

  return {
    deletedNotifications: deletedNotifications.length,
    deletedScores: deletedScores.length,
    deletedHistory: deletedHistory.length,
    deletedLogs: deletedLogs.length,
    deletedJobs: deletedJobs.length,
    deletedAudits: deletedAudits.length,
  };
}

const LOCK_ID = 'sweep_lock';
const LOCK_TTL_MS = SWEEP_LOCK_TTL_MS;

async function acquireSweepLock(db: Db): Promise<boolean> {
  const now = Date.now();
  const expiresAt = new Date(now + LOCK_TTL_MS);

  try {
    const [existing] = await db
      .select({ expiresAt: sweepLocks.expiresAt })
      .from(sweepLocks)
      .where(eq(sweepLocks.id, LOCK_ID))
      .limit(1);

    if (existing) {
      if (existing.expiresAt.getTime() > now) {
        log.warn('Sweep lock still held (D1) — skipping this tick');
        return false;
      }
      await db
        .update(sweepLocks)
        .set({ expiresAt })
        .where(eq(sweepLocks.id, LOCK_ID));
    } else {
      await db.insert(sweepLocks).values({ id: LOCK_ID, expiresAt });
    }
    return true;
  } catch (err) {
    log.error('Failed to acquire sweep lock', err);
    return false;
  }
}

export async function releaseSweepLock(db: Db): Promise<void> {
  try {
    await db.delete(sweepLocks).where(eq(sweepLocks.id, LOCK_ID));
  } catch (err) {
    log.error('Failed to release sweep lock', err);
  }
}

export async function runAllSweeps(db: Db): Promise<SweepResult & { scoresRecalculated: number; stuckTasksReset: number; stuckJobsReset: number } & Awaited<ReturnType<typeof runTablePruningSweep>>> {
  if (!(await acquireSweepLock(db))) {
    return { remindersFired: 0, staleAlerts: 0, overdueNotifications: 0, scoresRecalculated: 0, stuckTasksReset: 0, stuckJobsReset: 0, deletedNotifications: 0, deletedScores: 0, deletedHistory: 0, deletedLogs: 0, deletedJobs: 0, deletedAudits: 0 };
  }

  try {
    const remindersFired = await runReminderSweep(db).catch((err) => { log.error('Sweep failed', err); return 0; });
    const staleAlerts = await runStaleLeadSweep(db).catch((err) => { log.error('Sweep failed', err); return 0; });
    const overdueNotifications = await runOverdueTaskSweep(db).catch((err) => { log.error('Sweep failed', err); return 0; });
    const scoresRecalculated = await runScoreSweep(db).catch((err) => { log.error('Sweep failed', err); return 0; });
    const stuckTasksReset = await runStuckResearchTaskSweep(db).catch((err) => { log.error('Sweep failed', err); return 0; });
    const stuckJobsReset = await runStuckJobRunSweep(db).catch((err) => { log.error('Sweep failed', err); return 0; });
    const pruned = await runTablePruningSweep(db).catch((err) => { log.error('Sweep failed', err); return { deletedNotifications: 0, deletedScores: 0, deletedHistory: 0, deletedLogs: 0, deletedJobs: 0, deletedAudits: 0 }; });

    return { remindersFired, staleAlerts, overdueNotifications, scoresRecalculated, stuckTasksReset, stuckJobsReset, ...pruned };
  } finally {
    // Don't clear lock on failure (fix #22): let it expire naturally via TTL
    // to prevent overlap from a killed-but-reborn isolate
  }
}

