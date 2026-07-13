import { LoggingService } from './logging';
import { Db } from '../db';
import { fetchSiteContent, ScrapedContent, contentHash } from '../lib/scraper';
import { generateResearchAndAudit, extractICPSignals, generateSDRWebsiteAnalysis, generateSDRICPFit } from '../lib/ai';
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
      const { merged, hash } = await this.checkCacheAndGenerateAI(lead, websiteMarkdown, location, userId, jobId);

      if (!merged) {
        throw new Error('Failed to generate or load research data');
      }

      await this.persistSnapshots(lead, scraped, merged, hash, userId, jobId, now);
      await this.saveContactsFromAI(lead.id, merged, userId);

      // Run SDR parallel analyses alongside legacy flow
      const [icpProfile, sdrWebsiteResult] = await Promise.all([
        this.fetchICPProfile(lead.id),
        generateSDRWebsiteAnalysis(
          this.db,
          lead.company || lead.name,
          lead.website,
          websiteMarkdown,
          userId,
        ).catch((err) => {
          logger.error('SDR website analysis failed, continuing with legacy flow', err);
          return null;
        }),
      ]);

      let matchedPositive: any[] = [];
      let matchedNegative: any[] = [];
      let matchedDisqualifiers: any[] = [];
      let sdrIcpFitResult: any = null;

      if (icpProfile) {
        // Run comprehensive SDR ICP fit assessment in parallel
        sdrIcpFitResult = await generateSDRICPFit(
          this.db,
          lead.company || lead.name,
          lead.website,
          websiteMarkdown,
          icpProfile,
          userId,
        ).catch((err) => {
          logger.error('SDR ICP fit assessment failed, falling back to legacy signal extraction', err);
          return null;
        });

        if (sdrIcpFitResult) {
          matchedPositive = sdrIcpFitResult.matchedPositiveSignals || [];
          matchedNegative = sdrIcpFitResult.matchedNegativeSignals || [];
          matchedDisqualifiers = sdrIcpFitResult.disqualifiersTriggered || [];
        } else {
          // Fallback to legacy signal extraction
          const fallback = await this.extractAndMatchSignals(lead, websiteMarkdown, icpProfile);
          matchedPositive = fallback.matchedPositive;
          matchedNegative = fallback.matchedNegative;
          matchedDisqualifiers = fallback.matchedDisqualifiers;
        }
      }

      await this.updateResearchTasks(lead.id, merged, matchedPositive, matchedNegative, matchedDisqualifiers, icpProfile, now, sdrWebsiteResult, sdrIcpFitResult);
      await this.recalculateAndAdvance(lead.id, jobId, userId);

    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      await this.db
        .update(researchTasks)
        .set({ status: 'FAILED', errorMessage: errMsg, updatedAt: new Date() })
        .where(eq(researchTasks.prospectId, lead.id));
      throw error;
    }
  }

  async checkCacheAndGenerateAI(
    lead: WorkflowLead,
    websiteMarkdown: string | null,
    location: string | null,
    userId: string | null,
    jobId: string
  ): Promise<{ merged: any; hash: string }> {
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
      merged = await generateResearchAndAudit(
        this.db,
        lead.name,
        lead.company,
        lead.website,
        lead.industry,
        websiteMarkdown,
        location
      );
    }

    return { merged, hash };
  }

  async persistSnapshots(
    lead: WorkflowLead,
    scraped: ScrapedContent | null,
    merged: any,
    hash: string,
    userId: string | null,
    jobId: string,
    now: Date
  ): Promise<void> {
    const snapshotId = crypto.randomUUID();
    const auditId = crypto.randomUUID();

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
  }

  async saveContactsFromAI(leadId: string, merged: any, userId: string | null): Promise<void> {
    if (!merged.contacts) return;

    const savedContactsCount = await saveAIExtractedContacts(
      this.db,
      leadId,
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
      await logContactDiscoveryActivity(this.db, leadId, contactExtractObj, savedContactsCount);
    }
  }

  async fetchICPProfile(leadId: string): Promise<any> {
    const [prospectRow] = await this.db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    if (!prospectRow?.marketId) return null;

    const [marketRow] = await this.db.select().from(markets).where(eq(markets.id, prospectRow.marketId)).limit(1);
    if (!marketRow?.icpProfileId) return null;

    const [icpRow] = await this.db.select().from(icpProfiles).where(eq(icpProfiles.id, marketRow.icpProfileId)).limit(1);
    if (!icpRow) return null;

    return {
      positiveSignals: icpRow.positiveSignals ? JSON.parse(icpRow.positiveSignals) : [],
      negativeSignals: icpRow.negativeSignals ? JSON.parse(icpRow.negativeSignals) : [],
      disqualifiers: icpRow.disqualifiers ? JSON.parse(icpRow.disqualifiers) : [],
    };
  }

  async extractAndMatchSignals(
    lead: WorkflowLead,
    websiteMarkdown: string | null,
    icpProfile: any
  ): Promise<{ matchedPositive: any[]; matchedNegative: any[]; matchedDisqualifiers: any[] }> {
    const extractedSignals = await extractICPSignals(
      this.db,
      lead.company || lead.name,
      lead.website,
      websiteMarkdown,
      icpProfile
    );

    const matchedPositive = extractedSignals.filter((s: any) =>
      icpProfile.positiveSignals.some((p: any) => p.name === s.signalName)
    );
    const matchedNegative = extractedSignals.filter((s: any) =>
      icpProfile.negativeSignals.some((n: any) => n.name === s.signalName)
    );
    const matchedDisqualifiers = extractedSignals.filter((s: any) =>
      icpProfile.disqualifiers.includes(s.signalName)
    );

    return { matchedPositive, matchedNegative, matchedDisqualifiers };
  }

  async updateResearchTasks(
    leadId: string,
    merged: any,
    matchedPositive: any[],
    matchedNegative: any[],
    matchedDisqualifiers: any[],
    icpProfile: any,
    now: Date,
    sdrWebsiteResult?: { companyName: string; websiteSummary: string; productsServices: string[]; targetAudience: string; painSignalsFound: Array<{ signal: string; evidenceQuote: string; sourceUrl: string }>; confidence: number } | null,
    sdrIcpFitResult?: { matchedPositiveSignals: any[]; matchedNegativeSignals: any[]; disqualifiersTriggered: string[]; overallAssessment: string; confidence: number } | null,
  ): Promise<void> {
    // ── WEBSITE_ANALYST: prefer structured SDR data, fall back to legacy ──
    if (sdrWebsiteResult) {
      await this.db.update(researchTasks).set({
        status: 'COMPLETED',
        confidence: sdrWebsiteResult.confidence,
        rawArtifacts: JSON.stringify({
          companyName: sdrWebsiteResult.companyName,
          websiteSummary: sdrWebsiteResult.websiteSummary,
          productsServices: sdrWebsiteResult.productsServices,
          targetAudience: sdrWebsiteResult.targetAudience,
        }),
        extractedSignals: JSON.stringify(sdrWebsiteResult.painSignalsFound),
        completedAt: now,
        updatedAt: now,
      }).where(and(eq(researchTasks.prospectId, leadId), eq(researchTasks.taskType, 'WEBSITE_ANALYST')));
    } else {
      await this.db.update(researchTasks).set({
        status: 'COMPLETED',
        confidence: merged.confidenceLevel === 'HIGH' ? 90 : merged.confidenceLevel === 'MEDIUM' ? 60 : 30,
        rawArtifacts: JSON.stringify({ summary: merged.companySummary, websiteNotes: merged.websiteNotes, digitalPresenceNotes: merged.digitalPresenceNotes, brandingNotes: merged.brandingNotes }),
        extractedSignals: JSON.stringify([]),
        completedAt: now,
        updatedAt: now,
      }).where(and(eq(researchTasks.prospectId, leadId), eq(researchTasks.taskType, 'WEBSITE_ANALYST')));
    }

    // ── PAIN_EXTRACTOR: from SDR website analysis pain signals or legacy ──
    if (sdrWebsiteResult && sdrWebsiteResult.painSignalsFound.length > 0) {
      await this.db.update(researchTasks).set({
        status: 'COMPLETED',
        confidence: sdrWebsiteResult.confidence,
        rawArtifacts: JSON.stringify({ painSignals: sdrWebsiteResult.painSignalsFound }),
        extractedSignals: JSON.stringify(matchedPositive),
        completedAt: now,
        updatedAt: now,
      }).where(and(eq(researchTasks.prospectId, leadId), eq(researchTasks.taskType, 'PAIN_EXTRACTOR')));
    } else {
      await this.db.update(researchTasks).set({
        status: 'COMPLETED',
        confidence: 90,
        rawArtifacts: JSON.stringify({ painPoints: merged.painPointsHypotheses, opportunity: merged.opportunityHypotheses }),
        extractedSignals: JSON.stringify(matchedPositive),
        completedAt: now,
        updatedAt: now,
      }).where(and(eq(researchTasks.prospectId, leadId), eq(researchTasks.taskType, 'PAIN_EXTRACTOR')));
    }

    // ── ICP_FIT: prefer structured SDR fit assessment, fall back to legacy ──
    if (sdrIcpFitResult) {
      await this.db.update(researchTasks).set({
        status: 'COMPLETED',
        confidence: sdrIcpFitResult.confidence,
        rawArtifacts: JSON.stringify({
          overallAssessment: sdrIcpFitResult.overallAssessment,
          matchedPositiveSignals: sdrIcpFitResult.matchedPositiveSignals,
          matchedNegativeSignals: sdrIcpFitResult.matchedNegativeSignals,
          disqualifiersTriggered: sdrIcpFitResult.disqualifiersTriggered,
        }),
        extractedSignals: JSON.stringify(matchedNegative),
        completedAt: now,
        updatedAt: now,
      }).where(and(eq(researchTasks.prospectId, leadId), eq(researchTasks.taskType, 'ICP_FIT')));
    } else {
      await this.db.update(researchTasks).set({
        status: 'COMPLETED',
        confidence: 90,
        rawArtifacts: JSON.stringify({ keyStrengths: merged.keyStrengths }),
        extractedSignals: JSON.stringify(matchedNegative),
        completedAt: now,
        updatedAt: now,
      }).where(and(eq(researchTasks.prospectId, leadId), eq(researchTasks.taskType, 'ICP_FIT')));
    }

    // ── DISQUALIFIER_CHECK: remains derived from matchedDisqualifiers ──
    await this.db.update(researchTasks).set({
      status: 'COMPLETED',
      confidence: 90,
      rawArtifacts: JSON.stringify({
        keyWeaknesses: merged.keyWeaknesses,
        ...(sdrIcpFitResult ? { overallAssessment: sdrIcpFitResult.overallAssessment } : {}),
      }),
      extractedSignals: JSON.stringify(matchedDisqualifiers),
      completedAt: now,
      updatedAt: now,
    }).where(and(eq(researchTasks.prospectId, leadId), eq(researchTasks.taskType, 'DISQUALIFIER_CHECK')));
  }

  async recalculateAndAdvance(leadId: string, jobId: string, userId: string | null): Promise<void> {
    const scoringService = new ScoringService(this.db);
    const savedScore = await scoringService.recalculateScore(leadId, jobId, userId);

    await new LoggingService(this.db).log({
      leadId,
      type: 'Research generated',
      summary: `AI research, design audit, and lead score (${savedScore.scoreValue}) generated.`,
    });

    const leadService = new LeadService(this.db);
    await leadService.advanceStageIfEarlier(leadId, 'In Research');
  }
}
