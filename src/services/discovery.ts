import { eq } from 'drizzle-orm';
import { discoveryScopes, candidateLeads } from '../db/schema/discovery';
import { CreateDiscoveryScopeInput, CreateCandidateLeadInput } from '../db/models/discovery';

export class DiscoveryService {
  constructor(private db: any) {}

  async createScope(id: string, input: CreateDiscoveryScopeInput) {
    const now = new Date().toISOString();
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
    const now = new Date().toISOString();
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

  async listCandidatesByScope(scopeId: string) {
    return this.db.select().from(candidateLeads).where(eq(candidateLeads.discoveryScopeId, scopeId));
  }
}
