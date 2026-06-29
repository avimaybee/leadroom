export const dynamic = 'force-dynamic';

import { getDb } from '@/db';
import { notifications } from '@/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { getUserId } from '@/lib/auth';
import { runReminderSweep, runStaleLeadSweep, runOverdueTaskSweep } from '@/services/sweeps';

export async function GET(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const encoder = new TextEncoder();
  let isClosed = false;
  let lastStaleCheck = 0;
  let lastReminderCheck = 0;
  const STALE_CHECK_INTERVAL = 60_000;
  const REMINDER_CHECK_INTERVAL = 30_000;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(': connected\n\n'));
      } catch (e) {
        isClosed = true;
      }
      
      const db = getDb();
      let lastCheck = new Date();

      while (!isClosed) {
        try {
          // Fire background sweeps
          const now = Date.now();
          if (now - lastReminderCheck > REMINDER_CHECK_INTERVAL) {
            await runReminderSweep(db).catch(e => console.error('Reminder sweep failed:', e));
            lastReminderCheck = now;
          }
          if (now - lastStaleCheck > STALE_CHECK_INTERVAL) {
            await runStaleLeadSweep(db).catch(e => console.error('Stale sweep failed:', e));
            await runOverdueTaskSweep(db).catch(e => console.error('Overdue task sweep failed:', e));
            lastStaleCheck = now;
          }

          const newNotifs = await db.select()
            .from(notifications)
            .where(
              and(
                eq(notifications.userId, userId),
                gt(notifications.createdAt, lastCheck)
              )
            );

          if (newNotifs.length > 0) {
            lastCheck = new Date();
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(newNotifs)}\n\n`));
            } catch (err) {
              isClosed = true;
              break;
            }
          } else {
            try {
              controller.enqueue(encoder.encode(':\n\n'));
            } catch (err) {
              isClosed = true;
              break;
            }
          }
        } catch (err) {
          console.error('SSE DB Error:', err);
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      if (!isClosed) {
        try {
          controller.close();
        } catch (e) {}
      }
    },
    cancel() {
      isClosed = true;
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
