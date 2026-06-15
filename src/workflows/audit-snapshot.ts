import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { getDb } from "../db";
import { fetchSiteContent } from "../lib/scraper";
import { generateAudit } from "../lib/ai";
import { jobRuns, researchSnapshots } from "../db/schema/research";
import { leads } from "../db/schema/core";
import { AuditService } from "../services/audits";
import { eq, desc } from "drizzle-orm";

type Env = {
  DB: D1Database;
  BROWSER?: any;
};

type Params = {
  leadId: string;
  jobId: string;
  userId?: string | null;
};

export class AuditSnapshotWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const { leadId, jobId, userId } = event.payload;

    // Inject environment variables and bindings into process.env so libraries can access them
    (process as any).env = {
      ...(process as any).env,
      ...this.env,
    };

    const db = getDb();
    const auditService = new AuditService(db);

    try {
      // Step 1: Fetch Lead Info + Research Snapshot
      const { lead, websiteConfirmed } = await step.do(
        "fetch-lead-details",
        {
          retries: {
            limit: 3,
            delay: 1000,
            backoff: "exponential",
          },
          timeout: "1 minute",
        },
        async () => {
          const [row] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
          if (!row) {
            throw new Error(`Lead not found for audit: ${leadId}`);
          }
          const lead = {
            name: row.name,
            company: row.company || null,
            website: row.website || null,
            industry: row.industry || null,
          };

          // Check research snapshot — if it confirms no website, skip scrape + AI
          let websiteConfirmed = true;
          try {
            const [snapshot] = await db.select()
              .from(researchSnapshots)
              .where(eq(researchSnapshots.leadId, leadId))
              .orderBy(desc(researchSnapshots.createdAt))
              .limit(1);
            if (snapshot) {
              const notes = snapshot.websiteNotes || '';
              const noWebsiteKeywords = ['no website', 'does not have a website', 'website not found', 'no web presence'];
              websiteConfirmed = !(notes.length === 0 || noWebsiteKeywords.some(k => notes.toLowerCase().includes(k)));
            }
          } catch (e) {
            // Snapshot query failed — proceed assuming website exists
          }

          return { lead, websiteConfirmed };
        }
      );

      // Step 2: Rate limit sleep (10s)
      await step.sleep("rate-limit-sleep-audit", "10 seconds");

      // Step 3: Fetch website content (skip if research confirmed no website)
      const scraped = await step.do(
        "scrape-site-audit",
        {
          retries: {
            limit: 2,
            delay: 5000,
            backoff: "linear",
          },
          timeout: "2 minutes",
        },
        async () => {
          if (!lead.website || !websiteConfirmed) {
            return null;
          }
          try {
            return await fetchSiteContent(lead.website);
          } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : String(error);
            console.error(`Website scraping failed in audit workflow for ${lead.website}:`, error);
            if (error instanceof Error && 'status' in error && (error as { status?: number }).status === 429) {
              throw error;
            }
            console.warn(`[AuditWorkflow] Scraping failed for ${lead.website}, will rely on research snapshot context. Error: ${errMsg}`);
            return {
              title: '',
              url: lead.website,
              content: `[Failed to scrape website: ${errMsg}]`,
              description: '',
            };
          }
        }
      );

      // Step 4: Run AI Audit (skip if research confirmed no website)
      const auditResult = await step.do(
        "run-ai-audit",
        {
          retries: {
            limit: 3,
            delay: 5000,
            backoff: "exponential",
          },
          timeout: "5 minutes",
        },
        async () => {
          if (!websiteConfirmed) {
            const name = lead.company || lead.name;
            return {
              websiteQualityScore: 0,
              designAestheticScore: 0,
              messagingClarityScore: 0,
              socialPresenceScore: 15,
              overallBrandingScore: 0,
              keyStrengths: '',
              keyWeaknesses: '- No website exists for this business\n- No digital presence to evaluate',
              recommendedImprovements: '- Build a professional website\n- Establish a basic digital footprint',
              sources: [] as string[],
            };
          }
          return await generateAudit(
            db,
            lead.name,
            lead.company,
            lead.website,
            lead.industry,
            scraped?.content || null,
            leadId
          );
        }
      );

      // Step 5: Save Audit snapshot and trigger scoring via service
      await step.do(
        "save-audit-results",
        {
          retries: {
            limit: 3,
            delay: 1000,
            backoff: "linear",
          },
          timeout: "1 minute",
        },
        async () => {
          await auditService.createAudit({
            leadId,
            createdByUserId: userId,
            origin: "AI_GENERATED",
            websiteQualityScore: auditResult.websiteQualityScore,
            designAestheticScore: auditResult.designAestheticScore,
            messagingClarityScore: auditResult.messagingClarityScore,
            socialPresenceScore: auditResult.socialPresenceScore,
            overallBrandingScore: auditResult.overallBrandingScore,
            keyStrengths: auditResult.keyStrengths,
            keyWeaknesses: auditResult.keyWeaknesses,
            recommendedImprovements: auditResult.recommendedImprovements,
            sources: auditResult.sources || [lead.website || ""].filter(Boolean),
            jobRunId: jobId,
          });
        }
      );

      // Step 6: Mark job as COMPLETED
      await step.do(
        "complete-audit-job",
        async () => {
          await db.update(jobRuns)
            .set({ status: "COMPLETED", finishedAt: new Date() })
            .where(eq(jobRuns.id, jobId));
        }
      );

    } catch (err: unknown) {
      console.error("Audit workflow execution failed:", err);
      // Update job run status to FAILED
      try {
        await db.update(jobRuns)
          .set({
            status: "FAILED",
            errorSummary: err instanceof Error ? err.message : String(err),
            finishedAt: new Date()
          })
          .where(eq(jobRuns.id, jobId));
      } catch (dbErr) {
        console.error("Failed to mark job run as failed:", dbErr);
      }
      throw err;
    }
  }
}
