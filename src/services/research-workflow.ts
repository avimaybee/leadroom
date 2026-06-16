import { Db } from '../db';
import { fetchSiteContent, ScrapedContent } from '../lib/scraper';
import { generateResearch, generateAudit, generateLeadScore } from '../lib/ai';
import { saveExtractedContacts, logContactDiscoveryActivity } from '../lib/contacts';
import { leads, activities, researchSnapshots, audits, leadScores } from '../db/schema';
import { eq } from 'drizzle-orm';
import { getLogger } from '../lib/logger';

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

    // Run the LLM calls
    const research = await generateResearch(
      this.db,
      lead.name,
      lead.company,
      lead.website,
      lead.industry,
      websiteMarkdown,
      location
    );

    const audit = await generateAudit(
      this.db,
      lead.name,
      lead.company,
      lead.website,
      lead.industry,
      websiteMarkdown,
      lead.id
    );

    const score = await generateLeadScore(
      this.db,
      lead.name,
      research,
      audit
    );

    const snapshotId = crypto.randomUUID();
    const auditId = crypto.randomUUID();
    const scoreId = crypto.randomUUID();
    const now = new Date();

    // Persist snapshot records
    await this.db.insert(researchSnapshots).values({
      id: snapshotId,
      leadId: lead.id,
      createdByUserId: userId || null,
      origin: 'AI_GENERATED',
      snapshotTitle: scraped?.title ? `Research Snapshot: ${scraped.title}` : 'AI Research Snapshot',
      companySummary: research.companySummary,
      productsServicesSummary: research.productsServicesSummary,
      digitalPresenceNotes: research.digitalPresenceNotes,
      websiteNotes: research.websiteNotes,
      brandingNotes: research.brandingNotes,
      painPointsHypotheses: research.painPointsHypotheses,
      opportunityHypotheses: research.opportunityHypotheses,
      sources: JSON.stringify(research.sources || [lead.website].filter(Boolean)),
      confidenceLevel: research.confidenceLevel,
      jobRunId: jobId,
      createdAt: now,
      updatedAt: now,
    });

    await this.db.insert(audits).values({
      id: auditId,
      leadId: lead.id,
      createdByUserId: userId || null,
      origin: 'AI_GENERATED',
      keyStrengths: audit.keyStrengths,
      keyWeaknesses: audit.keyWeaknesses,
      recommendedImprovements: audit.recommendedImprovements,
      opportunityNotes: null,
      sources: JSON.stringify(audit.sources || [lead.website].filter(Boolean)),
      jobRunId: jobId,
      createdAt: now,
      updatedAt: now,
    });

    await this.db.update(leadScores)
      .set({ isCurrent: 0, updatedAt: now })
      .where(eq(leadScores.leadId, lead.id));

    await this.db.insert(leadScores).values({
      id: scoreId,
      leadId: lead.id,
      scoreValue: score.score,
      scoreLabel: score.score >= 80 ? 'High' : (score.score >= 50 ? 'Medium' : 'Low'),
      rationaleSummary: score.rationaleSummary,
      factors: JSON.stringify(score.factors || []),
      origin: 'AI_SUGGESTED',
      isCurrent: 1,
      createdByUserId: userId || null,
      jobRunId: jobId,
      createdAt: now,
      updatedAt: now,
    });

    await this.db.insert(activities).values({
      id: crypto.randomUUID(),
      leadId: lead.id,
      type: 'Research generated',
      summary: `AI research, design audit, and lead score (${score.score}) generated.`,
      timestamp: now,
    });
  }
}
