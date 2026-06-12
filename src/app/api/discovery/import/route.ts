export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { leads, activities } from '@/db/schema/core';
import { cookies } from 'next/headers';
import { decrypt } from '@/lib/auth';

async function getUserId() {
  if (process.env.NODE_ENV === 'test') {
    return 'user_123';
  }
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    const payload = await decrypt(sessionToken);
    return payload?.userId || null;
  } catch (e) {
    return null;
  }
}

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { items } = (await request.json()) as {
      items?: Array<{
        name: string;
        website?: string | null;
        phone?: string | null;
        city?: string | null;
        region?: string | null;
        industry?: string | null;
        sourceUrl?: string | null;
      }>;
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided for import' }, { status: 400 });
    }

    const db = getDb();
    const importedLeadIds: string[] = [];
    const now = new Date();

    // 1. Bulk Insert Leads
    for (const item of items) {
      const leadId = crypto.randomUUID();
      
      await db.insert(leads).values({
        id: leadId,
        name: item.name,
        website: item.website || null,
        phone: item.phone || null,
        city: item.city || null,
        region: item.region || null,
        industry: item.industry || null,
        ownerId: userId,
        stage: 'NEW',
        status: 'Active',
        triagePriority: 'UNASSESSED',
        createdAt: now,
        updatedAt: now,
      });

      // Log import activity
      await db.insert(activities).values({
        id: crypto.randomUUID(),
        leadId,
        type: 'Lead imported',
        summary: `Imported via Discovery Engine. Source: ${item.sourceUrl || 'Local Search API'}`,
        timestamp: now,
      });

      importedLeadIds.push(leadId);
    }

    // 2. Trigger Triage Workflow for all imported leads
    interface TriageWorkflowBinding {
      create(options: { params: { leadId: string } }): Promise<unknown>;
    }
    const workflowBinding = (process.env as unknown as Record<string, unknown>)?.TRIAGE_WORKFLOW as TriageWorkflowBinding | undefined;
    
    for (const leadId of importedLeadIds) {
      if (workflowBinding && typeof workflowBinding.create === 'function') {
        try {
          await workflowBinding.create({ params: { leadId } });
        } catch (err: unknown) {
          console.error(`Failed to trigger CF Workflow for triage on lead ${leadId}`, err);
          // Fallback handled locally if needed, but for MVP we rely on CF Workflow
        }
      } else {
        console.warn(`[Triage] No TRIAGE_WORKFLOW binding found. Skipping triage for lead ${leadId}.`);
      }
    }

    return NextResponse.json({ 
      success: true, 
      importedCount: importedLeadIds.length,
      leadIds: importedLeadIds 
    }, { status: 200 });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Failed to import leads';
    console.error('[Discovery Import API] Error:', error);
    return NextResponse.json(
      { error: errMsg },
      { status: 500 }
    );
  }
}
