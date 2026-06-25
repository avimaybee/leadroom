import { LoggingService } from '@/services/logging';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { getDb } from '@/db';
import { leads, activities } from '@/db/schema/core';
import { discoveryScopes, candidateLeads } from '@/db/schema/discovery';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { decrypt, getUserId } from '@/lib/auth';
import { LeadService } from '@/services/lead';

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { items, filename } = (await request.json()) as {
      items?: Array<{
        name: string;
        website?: string | null;
        phone?: string | null;
        city?: string | null;
        region?: string | null;
        industry?: string | null;
        sourceUrl?: string | null;
      }>;
      filename?: string;
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided for import' }, { status: 400 });
    }

    const db = getDb();
    const leadService = new LeadService(db);

    const importSourceName = filename ? filename.replace(/\.csv$/i, '') : 'CSV Import';

    const importedLeadIds = await leadService.import(items, importSourceName, userId);

    return NextResponse.json({ 
      success: true, 
      importedCount: importedLeadIds.length,
      leadIds: importedLeadIds 
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'An internal error occurred' },
      { status: 500 }
    );
  }
}
