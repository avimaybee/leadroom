import { Db } from '../db';
import { eq, desc, and, isNull } from 'drizzle-orm';
import { jobRuns, researchSnapshots, contacts } from '../db/schema/research';
import { leads, activities } from '../db/schema/core';
import { generateResearch } from '../lib/ai';

export class ResearchService {
  constructor(private db: Db) {}

  async enrichLead(leadId: string, triggeredByUserId?: string | null) {
    const jobId = crypto.randomUUID();
    const now = new Date();

    // Create a job run row in RUNNING status
    await this.db.insert(jobRuns).values({
      id: jobId,
      jobType: 'ENRICHMENT',
      status: 'RUNNING',
      targetLeadId: leadId,
      triggeredByUserId: triggeredByUserId || null,
      startedAt: now,
      createdAt: now,
    });

    try {
      // Fetch lead info
      const [lead] = await this.db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
      if (!lead) {
        throw new Error('Lead not found');
      }

      // Generate AI research
      const research = await generateResearch(
        this.db,
        lead.name,
        lead.company || null,
        lead.website || null,
        lead.industry || null
      );

      const snapshotId = crypto.randomUUID();

      // Store research snapshot
      await this.db.insert(researchSnapshots).values({
        id: snapshotId,
        leadId,
        createdByUserId: triggeredByUserId || null,
        origin: 'AI_GENERATED',
        snapshotTitle: 'AI Research Snapshot',
        companySummary: research.companySummary,
        productsServicesSummary: research.productsServicesSummary,
        digitalPresenceNotes: research.digitalPresenceNotes,
        websiteNotes: research.websiteNotes,
        brandingNotes: research.brandingNotes,
        painPointsHypotheses: research.painPointsHypotheses,
        opportunityHypotheses: research.opportunityHypotheses,
        sources: JSON.stringify(research.sources),
        confidenceLevel: research.confidenceLevel,
        jobRunId: jobId,
        createdAt: now,
        updatedAt: now,
      });

      // Log system audit activity
      await this.db.insert(activities).values({
        id: crypto.randomUUID(),
        leadId,
        type: 'Research generated',
        summary: `AI research snapshot generated with ${research.confidenceLevel} confidence`,
        timestamp: now,
      });

      // Update job run to COMPLETED
      await this.db.update(jobRuns)
        .set({
          status: 'COMPLETED',
          finishedAt: new Date(),
        })
        .where(eq(jobRuns.id, jobId));

      // Fetch the created snapshot
      const [snapshot] = await this.db.select()
        .from(researchSnapshots)
        .where(eq(researchSnapshots.id, snapshotId))
        .limit(1);

      return snapshot;
    } catch (error: unknown) {
      console.error('Enrichment job failed:', error);
      
      const errMsg = error instanceof Error ? error.message : 'Unknown error occurred during enrichment';

      // Update job run to FAILED
      await this.db.update(jobRuns)
        .set({
          status: 'FAILED',
          errorSummary: errMsg,
          finishedAt: new Date(),
        })
        .where(eq(jobRuns.id, jobId));

      // Log failure activity
      await this.db.insert(activities).values({
        id: crypto.randomUUID(),
        leadId,
        type: 'Enrichment failed',
        summary: `AI research generation failed: ${errMsg}`,
        timestamp: now,
      });

      throw error;
    }
  }

  async getLatestResearch(leadId: string) {
    const [snapshot] = await this.db.select()
      .from(researchSnapshots)
      .where(eq(researchSnapshots.leadId, leadId))
      .orderBy(desc(researchSnapshots.createdAt))
      .limit(1);
    
    return snapshot || null;
  }

  async saveResearchSnapshot(
    leadId: string,
    input: {
      companySummary: string;
      productsServicesSummary: string;
      digitalPresenceNotes: string;
      websiteNotes: string;
      brandingNotes: string;
      painPointsHypotheses: string;
      opportunityHypotheses: string;
      sources: string[];
      confidenceLevel: string;
    },
    userId?: string | null
  ) {
    const now = new Date();
    const id = crypto.randomUUID();

    await this.db.insert(researchSnapshots).values({
      id,
      leadId,
      createdByUserId: userId || null,
      origin: 'MANUAL',
      snapshotTitle: 'Manual Snapshot Edit',
      companySummary: input.companySummary,
      productsServicesSummary: input.productsServicesSummary,
      digitalPresenceNotes: input.digitalPresenceNotes,
      websiteNotes: input.websiteNotes,
      brandingNotes: input.brandingNotes,
      painPointsHypotheses: input.painPointsHypotheses,
      opportunityHypotheses: input.opportunityHypotheses,
      sources: JSON.stringify(input.sources),
      confidenceLevel: input.confidenceLevel || 'UNKNOWN',
      createdAt: now,
      updatedAt: now,
    });

    // Log update activity
    await this.db.insert(activities).values({
      id: crypto.randomUUID(),
      leadId,
      type: 'Research updated',
      summary: 'Research snapshot updated manually by operator',
      timestamp: now,
    });

    const [snapshot] = await this.db.select()
      .from(researchSnapshots)
      .where(eq(researchSnapshots.id, id))
      .limit(1);

    return snapshot;
  }

  async getContacts(leadId: string) {
    return this.db.select()
      .from(contacts)
      .where(and(
        eq(contacts.leadId, leadId),
        isNull(contacts.deletedAt)
      ))
      .orderBy(desc(contacts.isPrimary), desc(contacts.createdAt));
  }

  async addContact(
    leadId: string,
    input: {
      fullName?: string | null;
      roleTitle?: string | null;
      email?: string | null;
      phone?: string | null;
      linkedinUrl?: string | null;
      otherProfileUrl?: string | null;
      isPrimary?: boolean;
      confidenceLevel?: string;
      sourceType?: string;
    },
    userId?: string | null
  ) {
    const id = crypto.randomUUID();
    const now = new Date();
    const isPrimaryInt = input.isPrimary ? 1 : 0;

    // If making this contact primary, unmark others for this lead
    if (isPrimaryInt === 1) {
      await this.db.update(contacts)
        .set({ isPrimary: 0, updatedAt: now })
        .where(eq(contacts.leadId, leadId));
    }

    await this.db.insert(contacts).values({
      id,
      leadId,
      fullName: input.fullName || null,
      roleTitle: input.roleTitle || null,
      email: input.email || null,
      phone: input.phone || null,
      linkedinUrl: input.linkedinUrl || null,
      otherProfileUrl: input.otherProfileUrl || null,
      isPrimary: isPrimaryInt,
      confidenceLevel: input.confidenceLevel || 'UNKNOWN',
      sourceType: input.sourceType || 'MANUAL',
      createdByUserId: userId || null,
      createdAt: now,
      updatedAt: now,
    });

    // Log activity
    await this.db.insert(activities).values({
      id: crypto.randomUUID(),
      leadId,
      type: 'Contact added',
      summary: `Contact ${input.fullName || input.email || 'unnamed'} was added`,
      timestamp: now,
    });

    const [contact] = await this.db.select()
      .from(contacts)
      .where(eq(contacts.id, id))
      .limit(1);

    return contact;
  }
}
