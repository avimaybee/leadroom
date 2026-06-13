import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { getDb } from "../db";
import { fetchSiteContent } from "../lib/scraper";
import { generateResearch } from "../lib/ai";
import { jobRuns, researchSnapshots } from "../db/schema/research";
import { leads, activities } from "../db/schema/core";
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

    // Inject environment variables and bindings into process.env so libraries can access them
    (process as any).env = {
      ...(process as any).env,
      ...this.env,
    };

    const db = getDb();

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
          const [row] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
          if (!row) {
            throw new Error(`Lead not found: ${leadId}`);
          }
          return {
            name: row.name,
            company: row.company || null,
            website: row.website || null,
            industry: row.industry || null,
            city: row.city || null,
            region: row.region || null,
          };
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
          if (!lead.website) {
            return null;
          }
          try {
            return await fetchSiteContent(lead.website);
          } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : String(error);
            console.error(`Website scraping failed for ${lead.website}:`, error);
            if (error instanceof Error && (error as any).status === 429) {
              throw error; // Re-throw 429 daily limit error so workflow fails transparently
            }
            // Return placeholder structure so we can still attempt enrichment based on metadata
            return {
              title: "",
              url: lead.website,
              content: `[Failed to scrape website: ${errMsg}]`,
              description: "",
            };
          }
        }
      );

      // Step 4: LLM Inference
      const research = await step.do(
        "call-llm",
        {
          retries: {
            limit: 3,
            delay: 5000,
            backoff: "exponential",
          },
          timeout: "5 minutes",
        },
        async () => {
          const websiteMarkdown = scraped?.content || null;
          const location = [lead.city, lead.region].filter(Boolean).join(", ") || null;
          return await generateResearch(
            db,
            lead.name,
            lead.company,
            lead.website,
            lead.industry,
            websiteMarkdown,
            location
          );
        }
      );

      // Step 5: Save Snapshot & Activity
      const snapshotId = crypto.randomUUID();
      await step.do(
        "save-snapshot",
        {
          retries: {
            limit: 3,
            delay: 2000,
            backoff: "exponential",
          },
          timeout: "2 minutes",
        },
        async () => {
          await db.insert(researchSnapshots).values({
            id: snapshotId,
            leadId,
            createdByUserId: userId || null,
            origin: "AI_GENERATED",
            snapshotTitle: scraped?.title ? `Research Snapshot: ${scraped.title}` : "AI Research Snapshot",
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
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Log system activity
          await db.insert(activities).values({
            id: crypto.randomUUID(),
            leadId,
            type: "Research generated",
            summary: `AI research snapshot generated with ${research.confidenceLevel} confidence`,
            timestamp: new Date(),
          });
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
        }
      );

    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "Unknown workflow error occurred";
      console.error(`Research Snapshot Workflow failed for lead ${leadId}:`, error);

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
      } catch (dbErr: unknown) {
        console.error("Failed to write workflow error to DB:", dbErr);
      }

      throw error;
    }
  }
}
