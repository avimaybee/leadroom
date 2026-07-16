import { LoggingService } from './logging';
import { type Db } from '../db';
import { eq, desc, and, isNull } from 'drizzle-orm';
import { researchSnapshots, contacts } from '../db/schema/research';
import { activities } from '../db/schema/core';

export class ResearchService {
  constructor(private db: Db) {}

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
    await new LoggingService(this.db).log({
leadId,
      type: 'Research updated',
      summary: 'Research snapshot updated manually by operator',
      
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
    await new LoggingService(this.db).log({
leadId,
      type: 'Contact added',
      summary: `Contact ${input.fullName || input.email || 'unnamed'} was added`,
      
});

    const [contact] = await this.db.select()
      .from(contacts)
      .where(eq(contacts.id, id))
      .limit(1);

    return contact;
  }

  async updateContact(
    leadId: string,
    contactId: string,
    input: {
      fullName?: string | null;
      roleTitle?: string | null;
      email?: string | null;
      phone?: string | null;
      linkedinUrl?: string | null;
      isPrimary?: boolean;
    },
    userId?: string | null
  ) {
    const now = new Date();
    const isPrimaryInt = input.isPrimary ? 1 : 0;

    // If making this contact primary, unmark others for this lead
    if (isPrimaryInt === 1) {
      await this.db.update(contacts)
        .set({ isPrimary: 0, updatedAt: now })
        .where(eq(contacts.leadId, leadId));
    }

    await this.db.update(contacts)
      .set({
        fullName: input.fullName !== undefined ? input.fullName : undefined,
        roleTitle: input.roleTitle !== undefined ? input.roleTitle : undefined,
        email: input.email !== undefined ? input.email : undefined,
        phone: input.phone !== undefined ? input.phone : undefined,
        linkedinUrl: input.linkedinUrl !== undefined ? input.linkedinUrl : undefined,
        isPrimary: input.isPrimary !== undefined ? isPrimaryInt : undefined,
        updatedAt: now,
      })
      .where(eq(contacts.id, contactId));

    // Log activity
    await new LoggingService(this.db).log({
leadId,
      type: 'Contact updated',
      summary: `Contact ${input.fullName || 'unnamed'} was updated`,
      
});

    const [contact] = await this.db.select()
      .from(contacts)
      .where(eq(contacts.id, contactId))
      .limit(1);

    return contact;
  }

  async deleteContact(leadId: string, contactId: string, userId?: string | null) {
    const now = new Date();
    
    // Fetch contact details before soft deletion for summary logging
    const [c] = await this.db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1);
    
    await this.db.update(contacts)
      .set({
        deletedAt: now,
        updatedAt: now,
      })
      .where(eq(contacts.id, contactId));

    // Log activity
    await new LoggingService(this.db).log({
leadId,
      type: 'Contact deleted',
      summary: `Contact ${c?.fullName || c?.email || 'unnamed'} was deleted`,
      
});
  }
}
