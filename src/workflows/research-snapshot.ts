import { LoggingService } from '@/services/logging';
import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { getDb } from "../db";
import { ResearchWorkflowService } from "../services/research-workflow";
import { jobRuns } from "../db/schema/research";
import { notifications } from "../db/schema/core";
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

export class ResearchSnapshotWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const { leadId, jobId, userId } = event.payload;

    (process as any).env = {
      ...(process as any).env,
      ...this.env,
    };

    const db = getDb();
    const workflowService = new ResearchWorkflowService(db);

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
          retries: { limit: 0 },
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

      // Step 2: Check if cancelled before sleeping
      await step.do(
        "check-cancelled-2",
        {
          retries: { limit: 0 },
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

      // Step 3: Sleep to respect rate limits (minimum 10s between calls)
      await step.sleep("rate-limit-delay", "10 seconds");

      // Step 4: Check if cancelled after sleep
      await step.do(
        "check-cancelled-3",
        {
          retries: { limit: 0 },
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

      // Step 5: Fetch and scrape website
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
            return await workflowService.scrapeWebsite(lead.website);
          } catch (error: unknown) {
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

      // Step 6: Check if cancelled after website fetch
      await step.do(
        "check-cancelled-4",
        {
          retries: { limit: 0 },
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

      // Step 7: Save any contacts extracted from the website scrape
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

      // Step 8: Check if cancelled before LLM inference
      await step.do(
        "check-cancelled-5",
        {
          retries: { limit: 0 },
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

      // Step 9: LLM Inference & Persist Snapshot/Audit/Score/Activity
      await step.do(
        "generate-snapshots",
        {
          retries: {
            limit: 3,
            delay: 5000,
            backoff: "exponential",
          },
          timeout: "10 minutes",
        },
        async () => {
          await workflowService.generateSnapshots(lead, scraped, userId ?? null, jobId);
        }
      );

      // Step 10: Check if cancelled after LLM inference
      await step.do(
        "check-cancelled-6",
        {
          retries: { limit: 0 },
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
              message: "Research workflow for lead has been completed successfully.",
              status: "SUCCESS",
              link: `/dashboard/leads/${leadId}/research`,
              isRead: false,
              createdAt: new Date(),
            });
          }
        }
      );

    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "Unknown workflow error occurred";
      const isCancelled = errMsg === "CANCELLED_BY_USER";

      // Save status inside DB
      try {
        await db.update(jobRuns)
          .set({
            status: isCancelled ? "CANCELLED" : "FAILED",
            errorSummary: isCancelled ? "Cancelled by user" : errMsg,
            finishedAt: new Date(),
          })
          .where(eq(jobRuns.id, jobId));

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
              link: `/dashboard/leads/${leadId}/research`,
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
              link: `/dashboard/leads/${leadId}/research`,
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

