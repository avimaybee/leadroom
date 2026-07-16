import { getLogger } from '@/lib/logger';
import { LoggingService } from '@/services/logging';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getDb } from '@/db';
import { prospects as leads, activities } from '@/db/schema/core';
import { discoveryScopes, candidateLeads } from '@/db/schema/discovery';
import { eq, and } from 'drizzle-orm';
import { decrypt, getUserId } from '@/lib/auth';

const log = getLogger('DiscoveryImportAPI');

const ImportItemSchema = z.object({
  name: z.string().min(1),
  website: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
  workspaceId: z.string().nullable().optional(),
  marketId: z.string().nullable().optional(),
});

const ImportRequestSchema = z.object({
  items: z.array(ImportItemSchema).min(1),
  filename: z.string().optional(),
});

const MAX_IMPORT_ITEMS = 500;

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = ImportRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
    }
    const { items, filename } = parsed.data;

    if (items.length > MAX_IMPORT_ITEMS) {
      return NextResponse.json({ error: `Maximum ${MAX_IMPORT_ITEMS} items per import` }, { status: 400 });
    }

    const db = getDb();
    const importedLeadIds: string[] = [];
    const now = new Date();

    const importSourceName = filename ? filename.replace(/\.csv$/i, '') : 'CSV Import';

    // 1. Ensure Discovery Scope exists for this import
    let [scope] = await db.select().from(discoveryScopes).where(and(eq(discoveryScopes.name, importSourceName), eq(discoveryScopes.createdByUserId, userId))).limit(1);
    
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

    // 2. Bulk Insert Leads (batched)
    const BATCH_SIZE = 50;
    const leadValues: Array<typeof leads.$inferInsert> = [];
    const candidateValues: Array<typeof candidateLeads.$inferInsert> = [];
    const activityLogs: Array<{ leadId: string; type: string; summary: string; metadata: Record<string, string> }> = [];

    for (const item of items) {
      const leadId = crypto.randomUUID();
      leadValues.push({
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
      candidateValues.push({
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
      activityLogs.push({ leadId, type: 'Lead imported', summary: `Imported via CSV/Bulk Import. Source: ${importSourceName}`, metadata: { source: importSourceName } });
      importedLeadIds.push(leadId);
    }

    for (let i = 0; i < leadValues.length; i += BATCH_SIZE) {
      const batch = leadValues.slice(i, i + BATCH_SIZE);
      await db.insert(leads).values(batch);
    }
    for (let i = 0; i < candidateValues.length; i += BATCH_SIZE) {
      const batch = candidateValues.slice(i, i + BATCH_SIZE);
      await db.insert(candidateLeads).values(batch);
    }
    for (const logEntry of activityLogs) {
      await new LoggingService(db).log(logEntry);
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
