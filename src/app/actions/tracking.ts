'use server';

import { getDb } from '@/db';
import { getUserId } from '@/lib/auth';
import { LoggingService } from '@/services/logging';

export async function logNbaActionAction(leadId: string, actionType: string, priority: string) {
  const userId = await getUserId();
  if (!userId) return;
  const db = getDb();
  await new LoggingService(db).log({
    leadId,
    type: 'NBA action taken',
    summary: `Acted on NBA: ${actionType}`,
    metadata: { recommendationType: actionType, priority },
  });
}
