import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { researchTasks } from '@/db/schema/jobs';
import { eq, and, inArray } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const body: { prospectIds?: string[] } = await request.json();
    const prospectIds = body.prospectIds;
    if (!Array.isArray(prospectIds) || prospectIds.length === 0) {
      return NextResponse.json({ signals: {} });
    }

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
          const signals = JSON.parse(task.extractedSignals);
          if (Array.isArray(signals) && signals.length > 0) {
            const top = signals.sort((a: any, b: any) => {
              const order: Record<string, number> = { strong: 3, partial: 2, weak: 1 };
              return (order[b.matchStrength] || 0) - (order[a.matchStrength] || 0);
            })[0];
            signalMap[task.prospectId] = top.signalName || null;
          }
        } catch {}
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
