import { eq, and } from 'drizzle-orm';

import { automationSettings, tasks, leads } from '../../db/schema/core';



export function setupTaskAutomationSubscribers(eventBus: any) {
  eventBus.subscribe('research.completed', async (payload: any, db: any) => {
    const { leadId, jobId, userId } = payload;
    if (!userId) return;

    // Check settings
    const settings = await db.select().from(automationSettings)
      .where(and(eq(automationSettings.userId, userId), eq(automationSettings.eventType, 'research.completed')));

    if (settings.length > 0 && !settings[0].isEnabled) {
      return; // Automated tasks disabled for this event
    }

    const leadInfo = await db.select().from(leads).where(eq(leads.id, leadId));
    if (leadInfo.length === 0) return;

    // Check for duplicate task creation for this job
    const existingTask = await db.select().from(tasks)
      .where(and(
        eq(tasks.jobRunId, jobId),
        eq(tasks.title, 'Review Research')
      ));
    if (existingTask.length > 0) return;

    await db.insert(tasks).values({
      id: crypto.randomUUID(),
      title: `Review Research`,
      description: `Review the newly generated background research snapshot for ${leadInfo[0].name}. \n\n[View Research](/dashboard/leads/${leadId}/research)`,
      leadId: leadId,
      jobRunId: jobId,
      status: 'Open',
      isRead: false,
      priority: 'Medium',
      origin: 'AUTOMATED',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  eventBus.subscribe('audit.completed', async (payload: any, db: any) => {
    const { leadId, jobId, userId } = payload;
    if (!userId) return;

    // Check settings
    const settings = await db.select().from(automationSettings)
      .where(and(eq(automationSettings.userId, userId), eq(automationSettings.eventType, 'audit.completed')));

    if (settings.length > 0 && !settings[0].isEnabled) {
      return; // Automated tasks disabled for this event
    }

    const leadInfo = await db.select().from(leads).where(eq(leads.id, leadId));
    if (leadInfo.length === 0) return;

    // Check for duplicate task creation for this job
    const existingTask = await db.select().from(tasks)
      .where(and(
        eq(tasks.jobRunId, jobId),
        eq(tasks.title, 'Review Audit Report')
      ));
    if (existingTask.length > 0) return;

    await db.insert(tasks).values({
      id: crypto.randomUUID(),
      title: `Review Audit Report`,
      description: `Review the newly generated website audit report for ${leadInfo[0].name}. \n\n[View Audit](/dashboard/leads/${leadId}/research)`,
      leadId: leadId,
      jobRunId: jobId,
      status: 'Open',
      isRead: false,
      priority: 'Medium',
      origin: 'AUTOMATED',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });
}
