import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { getDb } from "../db";
import { ResearchWorkflowService } from "../services/research-workflow";
import { jobRuns } from "../db/schema/research";
import { activities, notifications } from "../db/schema/core";
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

      // Step 3: Fetch and scrape website
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

      // Step 4: Save any contacts extracted from the website scrape
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
            await workflowService.saveContacts(leadId, scraped, userId);
          }
        );
      }

      // Step 5: LLM Inference & Persist Snapshot/Audit/Score/Activity
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
          await workflowService.generateSnapshots(lead, scraped, userId || null, jobId);
        }
      );

      // Step 6: Mark Job Complete
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

      // Save failure details inside DB
      try {
        await db.update(jobRuns)
          .set({
            status: "FAILED",
            errorSummary: errMsg,
            finishedAt: new Date(),
          })
          .where(eq(jobRuns.id, jobId));

        await db.insert(activities).values({
          id: crypto.randomUUID(),
          leadId,
          type: "Enrichment failed",
          summary: `AI research generation failed: ${errMsg}`,
          timestamp: new Date(),
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
      } catch (dbErr: unknown) {
        // Handled silently
      }

      throw error;
    }
  }
}

