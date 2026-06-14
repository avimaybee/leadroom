import { Db } from '../db';
import { eq, sql } from 'drizzle-orm';
import { discoveryScopes, candidateLeads } from '../db/schema/discovery';
import { leads, activities } from '../db/schema/core';
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
      createdByUserId: input.createdByUserId,
      createdAt: now,
      updatedAt: now,
    });
    
    // For D1 / Better-SQLite3, we can query it back
    const results = await this.db.select().from(discoveryScopes).where(eq(discoveryScopes.id, id));
    return results[0] || null;
  }

  async listScopes() {
    return this.db.select().from(discoveryScopes);
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
      triagePriority: input.triagePriority ?? 'UNASSESSED',
      triageReason: input.triageReason ?? null,
      promotedLeadId: input.promotedLeadId ?? null,
      createdAt: now,
      updatedAt: now,
    });

    const results = await this.db.select().from(candidateLeads).where(eq(candidateLeads.id, id));
    return results[0] || null;
  }

  async listCandidatesByScope(scopeId: string) {
    return this.db.select().from(candidateLeads).where(eq(candidateLeads.discoveryScopeId, scopeId));
  }

  async countPendingCandidates(): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(candidateLeads)
      .where(eq(candidateLeads.status, 'NEW'));
    
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

  async updateCandidateTriage(candidateId: string, triagePriority: 'HIGH' | 'MEDIUM' | 'SKIP', triageReason: string | null) {
    const now = new Date();
    await this.db
      .update(candidateLeads)
      .set({ triagePriority, triageReason, updatedAt: now })
      .where(eq(candidateLeads.id, candidateId));

    const [candidate] = await this.db.select().from(candidateLeads).where(eq(candidateLeads.id, candidateId)).limit(1);

    if (candidate && candidate.promotedLeadId) {
      await this.db
        .update(leads)
        .set({ triagePriority, triageReason, updatedAt: now })
        .where(eq(leads.id, candidate.promotedLeadId));

      const scoringService = new ScoringService(this.db);
      await scoringService.recalculateScore(candidate.promotedLeadId);
    }

    return candidate || null;
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
    if (candidate.discoveryScopeId) {
      const [scope] = await this.db.select().from(discoveryScopes).where(eq(discoveryScopes.id, candidate.discoveryScopeId)).limit(1);
      if (scope) {
        scopeName = scope.name;
      }
    }

    // 3. Insert into active leads
    const leadId = crypto.randomUUID();
    await this.db.insert(leads).values({
      id: leadId,
      name: candidate.rawName,
      website: candidate.rawWebsiteUrl,
      city: candidate.rawLocation || null,
      stage: 'New',
      status: 'Active',
      triagePriority: candidate.triagePriority,
      triageReason: candidate.triageReason,
      ownerId: ownerId,
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
    await this.db.insert(activities).values({
      id: activityId,
      leadId: leadId,
      type: 'SYSTEM',
      summary: `Promoted from candidate lead in Scope: ${scopeName}`,
      timestamp: now,
    });

    // 6. Recalculate baseline priority score
    const scoringService = new ScoringService(this.db);
    await scoringService.recalculateScore(leadId);

    const [promotedLead] = await this.db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    return promotedLead;
  }
}
