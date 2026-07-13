import { getLogger } from '../lib/logger';
import { LoggingService } from './logging';
import { Db } from '../db';
import { eq, sql, desc, and } from 'drizzle-orm';

const log = getLogger('DiscoveryService');
import { discoveryScopes, candidateLeads } from '../db/schema/discovery';
import { prospects as leads, activities } from '../db/schema/core';
import { CreateDiscoveryScopeInput, CreateCandidateLeadInput } from '../db/models/discovery';
import { ScoringService } from './scoring';

export class DiscoveryService {
  constructor(private db: Db) {}

  async createScope(id: string, input: CreateDiscoveryScopeInput) {
    const now = new Date();
    await this.db.insert(discoveryScopes).values({
      id,
      name: input.name,
      description: input.description ?? null,
      industryFilter: input.industryFilter ?? null,
      geographyFilter: input.geographyFilter ?? null,
      companySizeFilter: input.companySizeFilter ?? null,
      businessTypeFilter: input.businessTypeFilter ?? null,
      digitalPresenceFilter: input.digitalPresenceFilter ?? null,
      notes: input.notes ?? null,
      autoResearchPromotedLeads: input.autoResearchPromotedLeads ?? true,
      createdByUserId: input.createdByUserId,
      createdAt: now,
      updatedAt: now,
    });
    
    // For D1 / Better-SQLite3, we can query it back
    const results = await this.db.select().from(discoveryScopes).where(eq(discoveryScopes.id, id));
    return results[0] || null;
  }

  async updateScopeName(scopeId: string, name: string, userId?: string) {
    const now = new Date();
    const conditions: any[] = [eq(discoveryScopes.id, scopeId)];
    if (userId) conditions.push(eq(discoveryScopes.createdByUserId, userId));
    await this.db
      .update(discoveryScopes)
      .set({ name, updatedAt: now })
      .where(and(...conditions));

    const [scope] = await this.db.select().from(discoveryScopes).where(and(...conditions)).limit(1);
    return scope || null;
  }

  async listScopes(userId?: string) {
    if (userId) {
      return this.db.select().from(discoveryScopes).where(eq(discoveryScopes.createdByUserId, userId)).orderBy(desc(discoveryScopes.createdAt));
    }
    return this.db.select().from(discoveryScopes).orderBy(desc(discoveryScopes.createdAt));
  }

  async createCandidateLead(id: string, input: CreateCandidateLeadInput) {
    const now = new Date();
    await this.db.insert(candidateLeads).values({
      id,
      discoveryScopeId: input.discoveryScopeId ?? null,
      rawName: input.rawName,
      rawWebsiteUrl: input.rawWebsiteUrl ?? null,
      rawContactInfo: input.rawContactInfo ?? null,
      rawLocation: input.rawLocation ?? null,
      notes: input.notes ?? null,
      status: input.status || 'NEW',
      promotedLeadId: input.promotedLeadId ?? null,
      createdAt: now,
      updatedAt: now,
    });

    const results = await this.db.select().from(candidateLeads).where(eq(candidateLeads.id, id));
    return results[0] || null;
  }

  async listCandidatesByScope(scopeId: string, userId?: string) {
    if (userId) {
      const [scope] = await this.db.select({ id: discoveryScopes.id }).from(discoveryScopes).where(and(eq(discoveryScopes.id, scopeId), eq(discoveryScopes.createdByUserId, userId))).limit(1);
      if (!scope) return [];
    }
    return this.db.select().from(candidateLeads).where(eq(candidateLeads.discoveryScopeId, scopeId));
  }

  async countPendingCandidates(userId?: string): Promise<number> {
    const conditions: any[] = [eq(candidateLeads.status, 'NEW')];
    if (userId) {
      conditions.push(eq(discoveryScopes.createdByUserId, userId));
    }
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(candidateLeads)
      .innerJoin(discoveryScopes, eq(candidateLeads.discoveryScopeId, discoveryScopes.id))
      .where(and(...conditions));
    
    return Number(result[0]?.count || 0);
  }

  async updateCandidateStatus(candidateId: string, status: 'NEW' | 'REVIEWED' | 'PROMOTED' | 'DISCARDED') {
    const now = new Date();
    await this.db
      .update(candidateLeads)
      .set({ status, updatedAt: now })
      .where(eq(candidateLeads.id, candidateId));

    const results = await this.db.select().from(candidateLeads).where(eq(candidateLeads.id, candidateId));
    return results[0] || null;
  }

  async promoteCandidate(candidateId: string, ownerId: string) {
    const now = new Date();

    // 1. Fetch the candidate
    const [candidate] = await this.db.select().from(candidateLeads).where(eq(candidateLeads.id, candidateId)).limit(1);
    if (!candidate) {
      throw new Error(`Candidate with ID ${candidateId} not found`);
    }

    if (candidate.status === 'PROMOTED') {
      throw new Error(`Candidate with ID ${candidateId} has already been promoted`);
    }

    // 2. Fetch the scope details if any
    let scopeName = 'Discovery';
    let scopeIndustry = null;
    if (candidate.discoveryScopeId) {
      const [scope] = await this.db.select().from(discoveryScopes).where(eq(discoveryScopes.id, candidate.discoveryScopeId)).limit(1);
      if (scope) {
        scopeName = scope.name;
        scopeIndustry = scope.industryFilter;
      }
    }

    // 3. Auto-detect industry from website if not already known
    const leadId = crypto.randomUUID();
    let detectedIndustry = scopeIndustry;
    if (!detectedIndustry && candidate.rawWebsiteUrl) {
      try {
        const response = await fetch(candidate.rawWebsiteUrl, { signal: AbortSignal.timeout(5000) });
        const html = await response.text();
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch?.[1] || '';
        const metaMatch = html.match(/<meta\s+name="(?:description|keywords)"[^>]*content="([^"]+)"/i) 
          || html.match(/<meta\s+property="og:description"[^>]*content="([^"]+)"/i);
        const meta = metaMatch?.[1] || '';

        const text = `${title} ${meta}`.toLowerCase();
        const industryKeywords: Record<string, string[]> = {
          'Healthcare': ['dentist', 'clinic', 'medical', 'healthcare', 'hospital', 'doctor', 'dental', 'pediatric', 'wellness', 'physical therapy'],
          'Legal': ['lawyer', 'attorney', 'legal', 'law firm', 'notary', 'litigation'],
          'Financial Services': ['bank', 'credit union', 'financial', 'insurance', 'mortgage', 'accounting', 'cpa', 'tax', 'investment'],
          'Real Estate': ['real estate', 'realtor', 'property', 'rental', 'apartment', 'condo', 'property management', 'home'],
          'Technology': ['software', 'tech', 'saas', 'it ', 'technology', 'startup', 'digital', 'cloud', 'cyber'],
          'Hospitality': ['hotel', 'restaurant', 'cafe', 'bar', 'inn', 'lodging', 'dining', 'food', 'brewery', 'bakery'],
          'Education': ['school', 'academy', 'university', 'college', 'education', 'learning', 'tutoring', 'training'],
          'Local Services': ['plumber', 'electrician', 'contractor', 'roofing', 'hvac', 'landscaping', 'cleaning', 'pest control', 'mechanic', 'auto repair', 'salon', 'spa'],
          'Retail': ['store', 'shop', 'boutique', 'goods', 'furniture', 'gift', 'market', 'grocer'],
          'Professional Services': ['consulting', 'agency', 'marketing', 'design', 'photography', 'consultant', 'recruiting', 'hr'],
        };
        for (const [industry, keywords] of Object.entries(industryKeywords)) {
          if (keywords.some((kw) => text.includes(kw))) {
            detectedIndustry = industry;
            break;
          }
        }
      } catch {
        // Silently fall back to scope industry or null
      }
    }

    const [scopeFull] = candidate.discoveryScopeId
      ? await this.db.select({
          workspaceId: discoveryScopes.workspaceId,
          marketId: discoveryScopes.marketId,
        }).from(discoveryScopes).where(eq(discoveryScopes.id, candidate.discoveryScopeId)).limit(1)
      : [{ workspaceId: null as string | null, marketId: null as string | null }];

    await this.db.insert(leads).values({
      id: leadId,
      name: candidate.rawName,
      website: candidate.rawWebsiteUrl,
      city: candidate.rawLocation || null,
      industry: detectedIndustry,
      stage: 'New',
      status: 'Active',
      ownerId: ownerId,
      workspaceId: scopeFull?.workspaceId ?? null,
      marketId: scopeFull?.marketId ?? null,
      createdAt: now,
      updatedAt: now,
    });

    // 4. Update candidate status
    await this.db
      .update(candidateLeads)
      .set({
        status: 'PROMOTED',
        promotedLeadId: leadId,
        updatedAt: now,
      })
      .where(eq(candidateLeads.id, candidateId));

    // 5. Create activity record
    const activityId = crypto.randomUUID();
    await new LoggingService(this.db).log({
      leadId: leadId,
      type: 'SYSTEM',
      summary: `Promoted from candidate lead in Scope: ${scopeName}`,
      metadata: {
        from_stage: 'Candidate',
        to_stage: 'New',
      },
    });

    // 6. Recalculate baseline priority score
    const scoringService = new ScoringService(this.db);
    await scoringService.recalculateScore(leadId);

    // 7. Auto-trigger research if candidate has a website and scope allows it
    let shouldAutoResearch = !!candidate.rawWebsiteUrl;
    if (shouldAutoResearch && candidate.discoveryScopeId) {
      const [scope] = await this.db.select({ autoResearchPromotedLeads: discoveryScopes.autoResearchPromotedLeads })
        .from(discoveryScopes)
        .where(eq(discoveryScopes.id, candidate.discoveryScopeId))
        .limit(1);
      if (scope && !scope.autoResearchPromotedLeads) {
        shouldAutoResearch = false;
      }
    }

    if (shouldAutoResearch) {
      const jobId = crypto.randomUUID();
      const { jobRuns } = await import('../db/schema/research');
      await this.db.insert(jobRuns).values({
        id: jobId,
        jobType: 'RESEARCH_GENERATION',
        status: 'QUEUED',
        targetLeadId: leadId,
        triggeredByUserId: ownerId,
        externalRunId: 'AUTO_TRIGGERED',
        startedAt: null,
        finishedAt: null,
        createdAt: now,
      });

      const { triggerResearchWorkflow } = await import('../lib/workflow-client');
      let workflowBinding: any = undefined;
      try {
        const { getCloudflareContext } = await import('@opennextjs/cloudflare');
        workflowBinding = getCloudflareContext().env?.RESEARCH_SNAPSHOT_WORKFLOW;
      } catch (e) {
        log.info('getCloudflareContext unavailable — falling back to process.env for workflow binding');
      }
      if (!workflowBinding) {
        workflowBinding = (process.env as any)?.RESEARCH_SNAPSHOT_WORKFLOW;
      }
      await triggerResearchWorkflow(this.db, workflowBinding, leadId, jobId, ownerId);
    }

    const [promotedLead] = await this.db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    return promotedLead;
  }
}
