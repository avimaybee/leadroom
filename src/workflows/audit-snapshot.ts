import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { getDb } from "../db";
import { fetchSiteContent } from "../lib/scraper";
import { generateAudit } from "../lib/ai";
import { jobRuns } from "../db/schema/research";
import { leads } from "../db/schema/core";
import { AuditService } from "../services/audits";
import { eq } from "drizzle-orm";

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
    const db = getDb();
    const auditService = new AuditService(db);

    try {
      // Step 1: Fetch Lead Info
      const lead = await step.do(
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
          return {
            name: row.name,
            company: row.company || null,
            website: row.website || null,
            industry: row.industry || null,
          };
        }
      );

      // Step 2: Rate limit sleep (10s)
      await step.sleep("rate-limit-sleep-audit", "10 seconds");

      // Step 3: Fetch website content
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
          if (!lead.website) {
            return null;
          }
          try {
            return await fetchSiteContent(lead.website);
          } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : String(error);
            console.error(`Website scraping failed in audit workflow for ${lead.website}:`, error);
            if (error instanceof Error && 'status' in error && (error as { status?: number }).status === 429) {
              throw error; // Re-throw 429 rate limit
            }
            return {
              title: "",
              url: lead.website,
              content: `[Failed to scrape website: ${errMsg}]`,
              description: "",
            };
          }
        }
      );

      // Step 4: Run AI Audit
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
          return await generateAudit(
            db,
            lead.name,
            lead.company,
            lead.website,
            lead.industry,
            scraped?.content || null
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
