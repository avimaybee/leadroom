import { getLogger } from '../lib/logger';
import { LoggingService } from '@/services/logging';
import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { getDb } from "../db";
import { ResearchWorkflowService } from "../services/research-workflow";
import { jobRuns } from "../db/schema/research";
import { notifications } from "../db/schema/core";
import { researchTasks } from "../db/schema/jobs";
import { eq, and, inArray } from "drizzle-orm";

const log = getLogger('ResearchSnapshotWorkflow');

type Env = {
  DB: D1Database;
  BROWSER?: any;
};

type Params = {
  leadId: string;
  jobId: string;
  userId?: string | null;
};

export class ResearchSnapshotWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const { leadId, jobId, userId } = event.payload;

    const db = getDb(this.env);
    // Ensure Cloudflare context global is set so getEncryptionSecret() (via IntegrationsService) can find DB_ENCRYPTION_KEY
    // WorkflowEntrypoint.run() is called outside the fetch handler, so OpenNext's context isn't set automatically.
    const cfKey = Symbol.for('__cloudflare-context__');
    if (!(globalThis as any)[cfKey]) {
      (globalThis as any)[cfKey] = { env: this.env };
    }
    const workflowService = new ResearchWorkflowService(db, this.env.BROWSER);

    try {
      // Step 0: Mark job as RUNNING so the UI sees progress immediately
      await step.do(
        "mark-running",
        {
          retries: {
            limit: 3,
            delay: 1000,
            backoff: "linear",
          },
          timeout: "30 seconds",
        },
        async () => {
          await db.update(jobRuns)
            .set({ status: "RUNNING", startedAt: new Date() })
            .where(eq(jobRuns.id, jobId));
        }
      );

      // Step 0.5: Check if cancelled before proceeding
      await step.do(
        "check-cancelled-1",
        {
          retries: { limit: 0, delay: 1000 },
          timeout: "30 seconds",
        },
        async () => {
          const [job] = await db
            .select({ status: jobRuns.status })
            .from(jobRuns)
            .where(eq(jobRuns.id, jobId))
            .limit(1);
          if (job?.status === "CANCELLED") {
            throw new Error("CANCELLED_BY_USER");
          }
        }
      );

      // Step 1: Fetch Lead Info
      const lead = await step.do(
        "fetch-lead",
        {
          retries: {
            limit: 3,
            delay: 1000,
            backoff: "exponential",
          },
          timeout: "1 minute",
        },
        async () => {
          return await workflowService.fetchLead(leadId);
        }
      );

      // Step 2: Sleep to respect rate limits (minimum 10s between calls)
      await step.sleep("rate-limit-delay", "10 seconds");

      // Step 3: Check if cancelled after sleep
      await step.do(
        "check-cancelled-2",
        {
          retries: { limit: 0, delay: 1000 },
          timeout: "30 seconds",
        },
        async () => {
          const [job] = await db
            .select({ status: jobRuns.status })
            .from(jobRuns)
            .where(eq(jobRuns.id, jobId))
            .limit(1);
          if (job?.status === "CANCELLED") {
            throw new Error("CANCELLED_BY_USER");
          }
        }
      );

      // Step 4: Fetch and scrape website
      const scraped = await step.do(
        "fetch-site",
        {
          retries: {
            limit: 2,
            delay: 5000,
            backoff: "linear",
          },
          timeout: "2 minutes",
        },
        async () => {
          try {
            const result = await workflowService.scrapeWebsite(lead.website);
            // Strip screenshot before step output is persisted to DO — base64 can be 300KB–2MB
            if (result && 'screenshot' in result) {
              delete (result as any).screenshot;
            }
            return result;
          } catch (error: unknown) {
            log.error('Research workflow step failed', error);
            const errMsg = error instanceof Error ? error.message : String(error);
            if (error instanceof Error && (error as any).status === 429) {
              throw error; // Re-throw 429 daily limit error so workflow fails transparently
            }
            return {
              title: "",
              url: lead.website || "",
              content: `[Failed to scrape website: ${errMsg}]`,
              description: "",
            };
          }
        }
      );

      // Step 5: Save any contacts extracted from the website scrape
      if (scraped?.extractedContacts) {
        await step.do(
          "save-contacts",
          {
            retries: {
              limit: 2,
              delay: 1000,
              backoff: "linear",
            },
            timeout: "1 minute",
          },
          async () => {
            await workflowService.saveContacts(leadId, scraped, userId ?? null);
          }
        );
      }

      // Step 7a: Check cache & call AI (may be network I/O heavy)
      const websiteMarkdown = scraped?.content || null;
      const location = [lead.city, lead.region].filter(Boolean).join(', ') || null;
      const { merged, hash } = await step.do(
        "check-cache-and-generate-ai",
        {
          retries: {
            limit: 1,
            delay: 5000,
            backoff: "exponential",
          },
          timeout: "10 minutes",
        },
        async () => {
          return await workflowService.checkCacheAndGenerateAI(lead, websiteMarkdown, location, userId ?? null, jobId);
        }
      );

      if (!merged) {
        throw new Error('Failed to generate or load research data');
      }

      // Truncate evidence summaries to stay under 128KB DO limit
      const mergedStr = JSON.stringify(merged);
      if (mergedStr.length > 100000 && merged.evidenceSummaries && Array.isArray(merged.evidenceSummaries)) {
        log.warn('merged output exceeds 100KB, truncating evidence summaries', { size: mergedStr.length });
        while (JSON.stringify(merged).length > 100000 && merged.evidenceSummaries.length > 0) {
          merged.evidenceSummaries = merged.evidenceSummaries.slice(0, -1);
        }
      }

      // Step 9b: Persist snapshot records
      const now = new Date();
      await step.do(
        "persist-snapshots",
        {
          retries: {
            limit: 3,
            delay: 1000,
            backoff: "linear",
          },
          timeout: "1 minute",
        },
        async () => {
          await workflowService.persistSnapshots(lead, scraped, merged, hash, userId ?? null, jobId, now);
        }
      );

      // Step 9c: Save AI-extracted contacts
      await step.do(
        "save-contacts-from-ai",
        {
          retries: {
            limit: 2,
            delay: 1000,
            backoff: "linear",
          },
          timeout: "1 minute",
        },
        async () => {
          await workflowService.saveContactsFromAI(lead.id, merged, userId ?? null);
        }
      );

      // Step 9d: Fetch ICP profile
      const icpProfile = await step.do(
        "fetch-icp-profile",
        {
          retries: {
            limit: 2,
            delay: 1000,
            backoff: "linear",
          },
          timeout: "30 seconds",
        },
        async () => {
          return await workflowService.fetchICPProfile(lead.id);
        }
      );

      // Step 9e: Extract & match ICP signals
      const { matchedPositive, matchedNegative, matchedDisqualifiers } = icpProfile
        ? await step.do(
            "extract-and-match-signals",
            {
              retries: {
            limit: 1,
            delay: 5000,
            backoff: "exponential",
          },
          timeout: "5 minutes",
        },
        async () => {
          return await workflowService.extractAndMatchSignals(lead, websiteMarkdown, icpProfile);
            }
          )
        : { matchedPositive: [], matchedNegative: [], matchedDisqualifiers: [] };

      // Step 9f: Update research tasks
      await step.do(
        "update-research-tasks",
        {
          retries: {
            limit: 3,
            delay: 1000,
            backoff: "linear",
          },
          timeout: "1 minute",
        },
        async () => {
          await workflowService.updateResearchTasks(lead.id, merged, matchedPositive, matchedNegative, matchedDisqualifiers, icpProfile, new Date());
        }
      );

      // Step 9g: Recalculate score & advance stage
      await step.do(
        "recalculate-and-advance",
        {
          retries: {
            limit: 3,
            delay: 1000,
            backoff: "linear",
          },
          timeout: "1 minute",
        },
        async () => {
          await workflowService.recalculateAndAdvance(lead.id, jobId, userId ?? null);
        }
      );

      // Step 10: Check if cancelled after LLM inference
      await step.do(
        "check-cancelled-6",
        {
          retries: { limit: 0, delay: 1000 },
          timeout: "30 seconds",
        },
        async () => {
          const [job] = await db
            .select({ status: jobRuns.status })
            .from(jobRuns)
            .where(eq(jobRuns.id, jobId))
            .limit(1);
          if (job?.status === "CANCELLED") {
            throw new Error("CANCELLED_BY_USER");
          }
        }
      );

      // Step 11: Mark Job Complete
      await step.do(
        "mark-job-complete",
        {
          retries: {
            limit: 3,
            delay: 1000,
            backoff: "linear",
          },
          timeout: "1 minute",
        },
        async () => {
          await db.update(jobRuns)
            .set({
               status: "COMPLETED",
               finishedAt: new Date(),
            })
            .where(eq(jobRuns.id, jobId));
            
          if (userId) {
            await db.insert(notifications).values({
              id: crypto.randomUUID(),
              userId,
              jobRunId: jobId,
              title: "Research Completed",
              message: "Research workflow for lead completed.",
              status: "SUCCESS",
              link: `/prospects/${leadId}?view=research`,
              isRead: false,
              createdAt: new Date(),
            });
          }
        }
      );

    } catch (error: unknown) {
      log.error('Research workflow failed', error);
      const errMsg = error instanceof Error ? error.message : "Unknown workflow error occurred";
      const isCancelled = errMsg === "CANCELLED_BY_USER";

      // Save status inside DB
      try {
        await db.batch([
          db.update(jobRuns)
            .set({
              status: isCancelled ? "CANCELLED" : "FAILED",
              errorSummary: isCancelled ? "Cancelled by user" : errMsg,
              finishedAt: new Date(),
            })
            .where(eq(jobRuns.id, jobId)),
          db.update(researchTasks)
            .set({ status: 'FAILED', updatedAt: new Date() })
            .where(and(
              eq(researchTasks.prospectId, leadId),
              inArray(researchTasks.status, ['RUNNING', 'PENDING'])
            )),
        ]);

        if (isCancelled) {
          await new LoggingService(db).log({
            leadId,
            type: "Research cancelled",
            summary: "Research workflow cancelled by operator",
          });

          if (userId) {
            await db.insert(notifications).values({
              id: crypto.randomUUID(),
              userId,
              jobRunId: jobId,
              title: "Research Cancelled",
              message: "Research workflow was cancelled by operator.",
              status: "ERROR",
              link: `/prospects/${leadId}?view=research`,
              isRead: false,
              createdAt: new Date(),
            });
          }
        } else {
          await new LoggingService(db).log({
            leadId,
            type: "Enrichment failed",
            summary: `AI research generation failed: ${errMsg}`,
          });

          if (userId) {
            await db.insert(notifications).values({
              id: crypto.randomUUID(),
              userId,
              jobRunId: jobId,
              title: "Research Failed",
              message: `AI research generation failed: ${errMsg}`,
              status: "ERROR",
              link: `/prospects/${leadId}?view=research`,
              isRead: false,
              createdAt: new Date(),
            });
          }
        }
      } catch (dbErr: unknown) {
        // Handled silently
      }

      throw error;
    }
  }
}

