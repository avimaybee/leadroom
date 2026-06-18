import { LoggingService } from '@/services/logging';
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
        stage: 'New',
        status: 'Active',
        createdAt: now,
        updatedAt: now,
      });

      // Log import activity
      await new LoggingService(db).log({
leadId,
        type: 'Lead imported',
        summary: `Imported via Discovery Engine. Source: ${item.sourceUrl || 'Local Search API'}`,
        
});

      importedLeadIds.push(leadId);
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
