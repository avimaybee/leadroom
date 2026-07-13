import { LoggingService } from './logging';
import { Db } from '../db';
import { fetchSiteContent, ScrapedContent, contentHash } from '../lib/scraper';
import { generateResearchAndAudit, extractICPSignals } from '../lib/ai';
import { saveExtractedContacts, logContactDiscoveryActivity, saveAIExtractedContacts } from '../lib/contacts';
import { leads, activities, researchSnapshots, audits, leadScores, researchTasks } from '../db/schema';
import { markets, icpProfiles } from '../db/schema/strategy';
import { ScoringService } from './scoring';
import { eq, and, desc } from 'drizzle-orm';
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
    const now = new Date();

    // Mark all pending/running tasks for this prospect as RUNNING
    await this.db
      .update(researchTasks)
      .set({ status: 'RUNNING', startedAt: now, updatedAt: now })
      .where(eq(researchTasks.prospectId, lead.id));

    try {
      // Check cache: skip AI call if website content hasn't changed
      const hash = contentHash(lead.website, websiteMarkdown);
      const [cachedSnapshot] = await this.db
        .select({ id: researchSnapshots.id, confidenceLevel: researchSnapshots.confidenceLevel })
        .from(researchSnapshots)
        .where(and(eq(researchSnapshots.leadId, lead.id), eq(researchSnapshots.contentHash, hash)))
        .limit(1);

      let merged: any = null;

      if (cachedSnapshot) {
        logger.info('Using cached research+audit results (content unchanged)', { leadId: lead.id, snapshotId: cachedSnapshot.id });
        await new LoggingService(this.db).log({
          leadId: lead.id,
          type: 'Research cached',
          summary: `AI research skipped — website content unchanged since last snapshot (${cachedSnapshot.id.slice(0, 8)}).`,
        });

        // Load the cached snapshots to use for tasks
        const [researchSnap] = await this.db.select().from(researchSnapshots).where(eq(researchSnapshots.leadId, lead.id)).orderBy(desc(researchSnapshots.createdAt)).limit(1);
        const [auditSnap] = await this.db.select().from(audits).where(eq(audits.leadId, lead.id)).orderBy(desc(audits.createdAt)).limit(1);

        if (researchSnap && auditSnap) {
          merged = {
            companySummary: researchSnap.companySummary,
            websiteNotes: researchSnap.websiteNotes,
            digitalPresenceNotes: researchSnap.digitalPresenceNotes,
            brandingNotes: researchSnap.brandingNotes,
            painPointsHypotheses: researchSnap.painPointsHypotheses,
            opportunityHypotheses: researchSnap.opportunityHypotheses,
            keyStrengths: auditSnap.keyStrengths,
            keyWeaknesses: auditSnap.keyWeaknesses,
            recommendedImprovements: auditSnap.recommendedImprovements,
            confidenceLevel: researchSnap.confidenceLevel,
          };
        }
      }

      if (!merged) {
        // Run the merged single LLM call (Research + Audit + Contacts)
        merged = await generateResearchAndAudit(
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
      }

      // Fetch market & ICP profile associated with this prospect
      const [prospectRow] = await this.db.select().from(leads).where(eq(leads.id, lead.id)).limit(1);
      let icpProfile: any = null;
      if (prospectRow?.marketId) {
        const [marketRow] = await this.db.select().from(markets).where(eq(markets.id, prospectRow.marketId)).limit(1);
        if (marketRow?.icpProfileId) {
          const [icpRow] = await this.db.select().from(icpProfiles).where(eq(icpProfiles.id, marketRow.icpProfileId)).limit(1);
          if (icpRow) {
            icpProfile = {
              positiveSignals: icpRow.positiveSignals ? JSON.parse(icpRow.positiveSignals) : [],
              negativeSignals: icpRow.negativeSignals ? JSON.parse(icpRow.negativeSignals) : [],
              disqualifiers: icpRow.disqualifiers ? JSON.parse(icpRow.disqualifiers) : [],
            };
          }
        }
      }

      // Run AI Signal Extraction if ICP Profile is linked
      const extractedSignals = icpProfile
        ? await extractICPSignals(this.db, lead.company || lead.name, lead.website, websiteMarkdown, icpProfile)
        : [];

      // Populate discrete tasks
      if (icpProfile) {
        const matchedPositive = extractedSignals.filter(s => 
          icpProfile.positiveSignals.some((p: any) => p.name === s.signalName)
        );
        const matchedNegative = extractedSignals.filter(s => 
          icpProfile.negativeSignals.some((n: any) => n.name === s.signalName)
        );
        const matchedDisqualifiers = extractedSignals.filter(s => 
          icpProfile.disqualifiers.includes(s.signalName)
        );

        // Update WEBSITE_ANALYST
        await this.db.update(researchTasks).set({
          status: 'COMPLETED',
          confidence: merged.confidenceLevel === 'HIGH' ? 90 : merged.confidenceLevel === 'MEDIUM' ? 60 : 30,
          rawArtifacts: JSON.stringify({ summary: merged.companySummary, websiteNotes: merged.websiteNotes, digitalPresenceNotes: merged.digitalPresenceNotes, brandingNotes: merged.brandingNotes }),
          extractedSignals: JSON.stringify([]),
          completedAt: now,
          updatedAt: now,
        }).where(and(eq(researchTasks.prospectId, lead.id), eq(researchTasks.taskType, 'WEBSITE_ANALYST')));

        // Update PAIN_EXTRACTOR
        await this.db.update(researchTasks).set({
          status: 'COMPLETED',
          confidence: 90,
          rawArtifacts: JSON.stringify({ painPoints: merged.painPointsHypotheses, opportunity: merged.opportunityHypotheses }),
          extractedSignals: JSON.stringify(matchedPositive),
          completedAt: now,
          updatedAt: now,
        }).where(and(eq(researchTasks.prospectId, lead.id), eq(researchTasks.taskType, 'PAIN_EXTRACTOR')));

        // Update DISQUALIFIER_CHECK
        await this.db.update(researchTasks).set({
          status: 'COMPLETED',
          confidence: 90,
          rawArtifacts: JSON.stringify({ keyWeaknesses: merged.keyWeaknesses }),
          extractedSignals: JSON.stringify(matchedDisqualifiers),
          completedAt: now,
          updatedAt: now,
        }).where(and(eq(researchTasks.prospectId, lead.id), eq(researchTasks.taskType, 'DISQUALIFIER_CHECK')));

        // Update ICP_FIT
        await this.db.update(researchTasks).set({
          status: 'COMPLETED',
          confidence: 90,
          rawArtifacts: JSON.stringify({ keyStrengths: merged.keyStrengths }),
          extractedSignals: JSON.stringify(matchedNegative),
          completedAt: now,
          updatedAt: now,
        }).where(and(eq(researchTasks.prospectId, lead.id), eq(researchTasks.taskType, 'ICP_FIT')));
      } else {
        // Fallback: complete tasks with empty signals so SDR UI doesn't hang
        for (const tType of ['WEBSITE_ANALYST', 'PAIN_EXTRACTOR', 'DISQUALIFIER_CHECK', 'ICP_FIT'] as const) {
          await this.db.update(researchTasks).set({
            status: 'COMPLETED',
            confidence: 90,
            rawArtifacts: JSON.stringify({}),
            extractedSignals: JSON.stringify([]),
            completedAt: now,
            updatedAt: now,
          }).where(and(eq(researchTasks.prospectId, lead.id), eq(researchTasks.taskType, tType)));
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

    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      // Mark all tasks for this prospect as FAILED
      await this.db
        .update(researchTasks)
        .set({ status: 'FAILED', errorMessage: errMsg, updatedAt: new Date() })
        .where(eq(researchTasks.prospectId, lead.id));
      throw error;
    }
  }
}
