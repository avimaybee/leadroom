import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { researchTasks } from '@/db/schema/jobs';
import { eq, and, inArray } from 'drizzle-orm';
import { getUserId } from '@/lib/auth';
import { getLogger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';

const log = getLogger('ProspectsSignals');

const SignalsRequestSchema = z.object({
  prospectIds: z.array(z.string().min(1)).min(1),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rateCheck = await checkRateLimit(`signals:${userId}`, 10, 60_000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many signal extraction requests. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.reset - Date.now()) / 1000)) } },
      );
    }

    const body = await request.json();
    const parsed = SignalsRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ signals: {} });
    }
    const prospectIds = parsed.data.prospectIds;

    const db = getDb();
    const taskRows = await db
      .select({ prospectId: researchTasks.prospectId, extractedSignals: researchTasks.extractedSignals })
      .from(researchTasks)
      .where(and(
        eq(researchTasks.status, 'COMPLETED'),
        inArray(researchTasks.prospectId, prospectIds)
      ));

    const signalMap: Record<string, string | null> = {};
    for (const task of taskRows) {
      if (task.extractedSignals) {
        try {
          const signals = task.extractedSignals;
          if (Array.isArray(signals) && signals.length > 0) {
            const top = signals.sort((a: any, b: any) => {
              const order: Record<string, number> = { strong: 3, partial: 2, weak: 1 };
              return (order[b.matchStrength] || 0) - (order[a.matchStrength] || 0);
            })[0];
            signalMap[task.prospectId] = top.signalName || null;
          }
        } catch (e) { log.error('Failed to parse prospect signals', e); }
      }
      if (!signalMap[task.prospectId]) {
        signalMap[task.prospectId] = null;
      }
    }

    return NextResponse.json({ signals: signalMap });
  } catch (error) {
    console.error('Failed to fetch prospect signals:', error);
    return NextResponse.json({ signals: {} });
  }
}
