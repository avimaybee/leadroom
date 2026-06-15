import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { getDb } from '@/db';
import { leads, activities } from '@/db/schema/core';
import { researchSnapshots } from '@/db/schema/research';
import { eq, desc } from 'drizzle-orm';
import { fetchSiteContent } from '@/lib/scraper';
import { runTriageAI } from '@/lib/ai';
import { ScoringService } from '@/services/scoring';

type TriageParams = {
  leadId: string;
};

type Env = {
  DB: unknown;
};

export class TriageWorkflow extends WorkflowEntrypoint<Env, TriageParams> {
  async run(event: WorkflowEvent<TriageParams>, step: WorkflowStep) {
    const { leadId } = event.payload;

    // Inject environment variables and bindings into process.env so libraries can access them
    (process as any).env = {
      ...(process as any).env,
      ...this.env,
    };

    // 1. Fetch Lead
    const lead = await step.do(
      'fetch-lead',
      {
        retries: {
          limit: 3,
          delay: 1000,
          backoff: 'exponential',
        },
        timeout: '1 minute',
      },
      async () => {
        const db = getDb();
        const results = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
        return results[0] || null;
      }
    );

    if (!lead) {
      throw new Error(`Lead ${leadId} not found`);
    }

    // 2. Initial Website Check
    if (!lead.website) {
      await step.do(
        'mark-no-website',
        {
          retries: {
            limit: 3,
            delay: 1000,
            backoff: 'exponential',
          },
          timeout: '1 minute',
        },
        async () => {
          const db = getDb();
          await db.update(leads)
            .set({ triagePriority: 'HIGH', triageReason: 'No website detected.' })
            .where(eq(leads.id, leadId));
            
          await db.insert(activities).values({
            id: crypto.randomUUID(),
            leadId,
            type: 'Triage complete',
            summary: 'Scored HIGH priority due to missing website.',
            timestamp: new Date(),
          });

          const scoringService = new ScoringService(db);
          await scoringService.recalculateScore(leadId);
        }
      );
      return { status: 'COMPLETED', priority: 'HIGH' };
    }

    // 3. Fetch Site Content (if website exists)
    let siteContent = await step.do(
      'fetch-site',
      {
        retries: {
          limit: 2,
          delay: 3000,
          backoff: 'linear',
        },
        timeout: '2 minutes',
      },
      async () => {
        try {
          const content = await fetchSiteContent(lead.website!);
          // Truncate to first 5000 chars for triage to save tokens/time
          return content.content.substring(0, 5000);
        } catch (err: unknown) {
          return null;
        }
      }
    );

    let triageSource = 'scraped_website';

    if (!siteContent) {
      // Try to fall back to research snapshot
      const researchSnapshotContent = await step.do(
        'fetch-research-fallback-triage',
        async () => {
          const db = getDb();
          const [snapshot] = await db.select()
            .from(researchSnapshots)
            .where(eq(researchSnapshots.leadId, leadId))
            .orderBy(desc(researchSnapshots.createdAt))
            .limit(1);
          if (snapshot && (snapshot.websiteNotes || snapshot.brandingNotes)) {
            return `Website Notes: ${snapshot.websiteNotes || ''}\nBranding Notes: ${snapshot.brandingNotes || ''}`;
          }
          return null;
        }
      );

      if (researchSnapshotContent) {
        siteContent = researchSnapshotContent;
        triageSource = 'research_snapshot';
      }
    }

    if (!siteContent) {
      await step.do(
        'mark-fetch-failed',
        {
          retries: {
            limit: 3,
            delay: 1000,
            backoff: 'linear',
          },
          timeout: '1 minute',
        },
        async () => {
          const db = getDb();
          await db.update(leads)
            .set({ triagePriority: 'HIGH', triageReason: 'Website failed to load or is unreachable.' })
            .where(eq(leads.id, leadId));

          await db.insert(activities).values({
            id: crypto.randomUUID(),
            leadId,
            type: 'Triage complete',
            summary: 'Scored HIGH priority due to unreachable website.',
            timestamp: new Date(),
          });

          const scoringService = new ScoringService(db);
          await scoringService.recalculateScore(leadId);
        }
      );
      return { status: 'COMPLETED', priority: 'HIGH' };
    }

    // 4. AI Triage Analysis
    const triageResult = await step.do(
      'analyze-site',
      {
        retries: {
          limit: 3,
          delay: 3000,
          backoff: 'exponential',
        },
        timeout: '3 minutes',
      },
      async () => {
        const db = getDb();
        return await runTriageAI(db, siteContent!);
      }
    );

    // 5. Save Triage Result
    await step.do(
      'save-triage',
      {
        retries: {
          limit: 3,
          delay: 1000,
          backoff: 'linear',
        },
        timeout: '1 minute',
      },
      async () => {
        const db = getDb();
        const priority = triageResult.status === 'MODERN' ? 'SKIP' : 'MEDIUM';
        const suffix = triageSource === 'research_snapshot' ? ' (Evaluated from research snapshot)' : '';
        
        await db.update(leads)
          .set({ triagePriority: priority, triageReason: triageResult.reason + suffix })
          .where(eq(leads.id, leadId));
          
        await db.insert(activities).values({
          id: crypto.randomUUID(),
          leadId,
          type: 'Triage complete',
          summary: `Scored ${priority} priority. Reason: ${triageResult.reason}${suffix}`,
          timestamp: new Date(),
        });

        const scoringService = new ScoringService(db);
        await scoringService.recalculateScore(leadId);
      }
    );

    return { status: 'COMPLETED', priority: triageResult.status === 'MODERN' ? 'SKIP' : 'MEDIUM' };
  }
}
