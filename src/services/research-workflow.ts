import { LoggingService } from './logging';
import { Db } from '../db';
import { fetchSiteContent, ScrapedContent, contentHash } from '../lib/scraper';
import { generateResearchAndAudit } from '../lib/ai';
import { saveExtractedContacts, logContactDiscoveryActivity, saveAIExtractedContacts } from '../lib/contacts';
import { leads, activities, researchSnapshots, audits, leadScores } from '../db/schema';
import { ScoringService } from './scoring';
import { eq, and } from 'drizzle-orm';
import { getLogger } from '../lib/logger';
import { LeadService } from './lead';

const logger = getLogger('ResearchWorkflowService');

export interface WorkflowLead {
  id: string;
  name: string;
  company: string | null;
  website: string | null;
  industry: string | null;
  city: string | null;
  region: string | null;
}

export class ResearchWorkflowService {
  constructor(private db: Db) {}

  async fetchLead(leadId: string): Promise<WorkflowLead> {
    logger.info('Fetching lead info', { leadId });
    const [row] = await this.db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    if (!row) {
      throw new Error(`Lead not found: ${leadId}`);
    }
    return {
      id: row.id,
      name: row.name,
      company: row.company || null,
      website: row.website || null,
      industry: row.industry || null,
      city: row.city || null,
      region: row.region || null,
    };
  }

  async scrapeWebsite(websiteUrl: string | null): Promise<ScrapedContent | null> {
    if (!websiteUrl) {
      logger.info('No website provided, skipping scraping');
      return null;
    }
    logger.info('Scraping website content', { websiteUrl });
    return await fetchSiteContent(websiteUrl);
  }

  async saveContacts(leadId: string, scraped: ScrapedContent | null, userId?: string | null): Promise<void> {
    if (!scraped?.extractedContacts) {
      return;
    }
    logger.info('Saving extracted contacts', { leadId });
    const saved = await saveExtractedContacts(
      this.db,
      leadId,
      scraped.extractedContacts,
      userId
    );
    if (saved > 0) {
      await logContactDiscoveryActivity(this.db, leadId, scraped.extractedContacts, saved);
    }
  }

  async generateSnapshots(
    lead: WorkflowLead,
    scraped: ScrapedContent | null,
    userId: string | null,
    jobId: string
  ): Promise<void> {
    logger.info('Generating AI snapshots', { leadId: lead.id, jobId });
    const websiteMarkdown = scraped?.content || null;
    const location = [lead.city, lead.region].filter(Boolean).join(', ') || null;

    // Check cache: skip AI call if website content hasn't changed
    const hash = contentHash(lead.website, websiteMarkdown);
    const [cachedSnapshot] = await this.db
      .select({ id: researchSnapshots.id, confidenceLevel: researchSnapshots.confidenceLevel })
      .from(researchSnapshots)
      .where(and(eq(researchSnapshots.leadId, lead.id), eq(researchSnapshots.contentHash, hash)))
      .limit(1);

    if (cachedSnapshot) {
      logger.info('Using cached research+audit results (content unchanged)', { leadId: lead.id, snapshotId: cachedSnapshot.id });
      await new LoggingService(this.db).log({
        leadId: lead.id,
        type: 'Research cached',
        summary: `AI research skipped — website content unchanged since last snapshot (${cachedSnapshot.id.slice(0, 8)}).`,
      });
      const leadService = new LeadService(this.db);
      await leadService.advanceStageIfEarlier(lead.id, 'In Research');
      return;
    }

    // Run the merged single LLM call (Research + Audit + Contacts)
    const merged = await generateResearchAndAudit(
      this.db,
      lead.name,
      lead.company,
      lead.website,
      lead.industry,
      websiteMarkdown,
      location
    );

    const snapshotId = crypto.randomUUID();
    const auditId = crypto.randomUUID();
    const now = new Date();

    // Persist snapshot records
    await this.db.insert(researchSnapshots).values({
      id: snapshotId,
      leadId: lead.id,
      createdByUserId: userId || null,
      origin: 'AI_GENERATED',
      snapshotTitle: scraped?.title ? `Research Snapshot: ${scraped.title}` : 'AI Research Snapshot',
      companySummary: merged.companySummary,
      productsServicesSummary: merged.productsServicesSummary,
      digitalPresenceNotes: merged.digitalPresenceNotes,
      websiteNotes: merged.websiteNotes,
      brandingNotes: merged.brandingNotes,
      painPointsHypotheses: merged.painPointsHypotheses,
      opportunityHypotheses: merged.opportunityHypotheses,
      sources: JSON.stringify(merged.sources || [lead.website].filter(Boolean)),
      confidenceLevel: merged.confidenceLevel,
      contentHash: hash,
      jobRunId: jobId,
      createdAt: now,
      updatedAt: now,
    });

    await this.db.insert(audits).values({
      id: auditId,
      leadId: lead.id,
      createdByUserId: userId || null,
      origin: 'AI_GENERATED',
      keyStrengths: merged.keyStrengths,
      keyWeaknesses: merged.keyWeaknesses,
      recommendedImprovements: merged.recommendedImprovements,
      opportunityNotes: null,
      contentHash: hash,
      sources: JSON.stringify(merged.sources || [lead.website].filter(Boolean)),
      jobRunId: jobId,
      createdAt: now,
      updatedAt: now,
    });

    // Save AI extracted contacts if present
    if (merged.contacts) {
      const savedContactsCount = await saveAIExtractedContacts(
        this.db,
        lead.id,
        merged.contacts,
        userId
      );
      if (savedContactsCount > 0) {
        const contactExtractObj = {
          emails: merged.contacts.emails || [],
          phones: merged.contacts.phones || [],
          socialLinks: (merged.contacts.socialLinks || {}) as Record<string, string>,
          contactPageUrls: [],
        };
        await logContactDiscoveryActivity(this.db, lead.id, contactExtractObj, savedContactsCount);
      }
    }

    // Recalculate score deterministically in code (bypasses LLM call)
    const scoringService = new ScoringService(this.db);
    const savedScore = await scoringService.recalculateScore(lead.id, jobId, userId);

    await new LoggingService(this.db).log({
      leadId: lead.id,
      type: 'Research generated',
      summary: `AI research, design audit, and lead score (${savedScore.scoreValue}) generated.`,
    });

    // Auto-advance stage from New to In Research after successful generation
    const leadService = new LeadService(this.db);
    await leadService.advanceStageIfEarlier(lead.id, 'In Research');
  }
}
