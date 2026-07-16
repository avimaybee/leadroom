'use server';

import { getDb } from '@/db';
import { getUserId } from '@/lib/auth';
import { LeadService } from '@/services/lead';
import { LoggingService } from '@/services/logging';

export async function logNbaActionAction(leadId: string, actionType: string, priority: string) {
  const userId = await getUserId();
  if (!userId) return;
  const db = getDb();
  const signal = actionType.toLowerCase().includes('overdue') ? 'overdue_task'
    : actionType.toLowerCase().includes('task') ? 'future_task'
    : actionType.toLowerCase().includes('stall') ? 'stale'
    : actionType.toLowerCase().includes('draft') ? 'unsent_draft'
    : actionType.toLowerCase().includes('research') ? 'no_research'
    : actionType.toLowerCase().includes('audit') ? 'no_audit'
    : 'unread';
  await new LeadService(db).logNBAAction(leadId, signal, userId);
  await new LoggingService(db).log({
    leadId,
    type: 'NBA action taken',
    summary: `Acted on NBA: ${actionType}`,
    metadata: { recommendationType: actionType, priority, signal },
  });
}

export async function dismissNbaActionAction(leadId: string, signal: string) {
  const userId = await getUserId();
  if (!userId) return;
  const db = getDb();
  
  let nbaActionLogs: any;
  try {
    ({ nbaActionLogs } = await import('@/db/schema/core'));
  } catch (e) {
    return;
  }
  
  await db.insert(nbaActionLogs).values({
    id: crypto.randomUUID(),
    leadId,
    userId,
    signal,
    resultStageTarget: 'DISMISSED',
    resultStageReachedAt: new Date(),
  });
  
  await new LoggingService(db).log({
    leadId,
    type: 'NBA action dismissed',
    summary: `Dismissed NBA: ${signal}`,
    metadata: { signal },
  });
}
