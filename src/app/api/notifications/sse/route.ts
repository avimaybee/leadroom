export const dynamic = 'force-dynamic';

import { getDb } from '@/db';
import { notifications } from '@/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { getUserId } from '@/lib/auth';

export async function GET(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const encoder = new TextEncoder();
  let isClosed = false;

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
          const newNotifs = await db.select()
            .from(notifications)
            .where(
              and(
                eq(notifications.userId, userId),
                gt(notifications.createdAt, lastCheck)
              )
            );

          if (newNotifs.length > 0) {
            // Update lastCheck to the latest notification's createdAt plus 1ms, or just now.
            // Using `now` is safer if system clocks are identical.
            lastCheck = new Date();
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(newNotifs)}\n\n`));
            } catch (err) {
              isClosed = true;
              break;
            }
          } else {
            // Keep-alive heartbeat
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

        // Wait 2 seconds
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
