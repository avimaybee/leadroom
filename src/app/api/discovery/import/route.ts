import { getLogger } from '@/lib/logger';
import { LoggingService } from '@/services/logging';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { getDb } from '@/db';
import { prospects as leads, activities } from '@/db/schema/core';
import { discoveryScopes, candidateLeads } from '@/db/schema/discovery';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { decrypt, getUserId } from '@/lib/auth';

const log = getLogger('DiscoveryImportAPI');

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
        workspaceId?: string | null;
        marketId?: string | null;
      }>;
      filename?: string;
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided for import' }, { status: 400 });
    }

    const db = getDb();
    const importedLeadIds: string[] = [];
    const now = new Date();

    const importSourceName = filename ? filename.replace(/\.csv$/i, '') : 'CSV Import';

    // 1. Ensure Discovery Scope exists for this import
    let [scope] = await db.select().from(discoveryScopes).where(eq(discoveryScopes.name, importSourceName)).limit(1);
    
    if (!scope) {
      const scopeId = crypto.randomUUID();
      await db.insert(discoveryScopes).values({
        id: scopeId,
        name: importSourceName,
        description: `Imported leads from ${filename || 'CSV Import'}`,
        createdByUserId: userId,
        createdAt: now,
        updatedAt: now,
      });
      [scope] = await db.select().from(discoveryScopes).where(eq(discoveryScopes.id, scopeId)).limit(1);
    }

    // 2. Bulk Insert Leads
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
        workspaceId: item.workspaceId ?? null,
        marketId: item.marketId ?? null,
        createdAt: now,
        updatedAt: now,
      });

      // Link via candidateLead to Discovery Scope
      await db.insert(candidateLeads).values({
        id: crypto.randomUUID(),
        discoveryScopeId: scope.id,
        rawName: item.name,
        rawWebsiteUrl: item.website || null,
        rawContactInfo: item.phone || null,
        rawLocation: [item.city, item.region].filter(Boolean).join(', ') || null,
        status: 'PROMOTED',
        promotedLeadId: leadId,
        createdAt: now,
        updatedAt: now,
      });

      // Log import activity
      await new LoggingService(db).log({
        leadId,
        type: 'Lead imported',
        summary: `Imported via CSV/Bulk Import. Source: ${importSourceName}`,
        metadata: { source: importSourceName }
      });

      importedLeadIds.push(leadId);
    }

    return NextResponse.json({ 
      success: true, 
      importedCount: importedLeadIds.length,
      leadIds: importedLeadIds 
    }, { status: 200 });

  } catch (error: unknown) {
    log.error('Import error', error);
    return NextResponse.json(
      { error: 'An internal error occurred' },
      { status: 500 }
    );
  }
}
