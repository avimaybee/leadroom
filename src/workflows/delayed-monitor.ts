import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { getDb } from "../db";
import { leads, tasks } from "../db/schema/core";
import { eq } from "drizzle-orm";

type Env = {
  DB: any;
};

type Params = {
  leadId: string;
};

export class DelayedMonitorWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const { leadId } = event.payload;

    (process as any).env = {
      ...(process as any).env,
      ...this.env,
    };

    // Requirement 2: The monitor must support a 72-hour pause state before executing status checks
    await step.sleep("wait-72-hours", 72 * 60 * 60 * 1000);

    // Requirement 3: At the end of the delay, check if lead's current stage is still 'Outreach Sent'
    // Requirement 4: If stalled, create a high-priority follow-up task
    await step.do("check-and-notify", async () => {
      const db = getDb();

      const [lead] = await db
        .select({ id: leads.id, stage: leads.stage })
        .from(leads)
        .where(eq(leads.id, leadId))
        .limit(1);

      if (!lead) {
        return;
      }

      if (lead.stage === "Outreach Sent") {
        await db.insert(tasks).values({
          id: crypto.randomUUID(),
          title: "Follow up on outreach",
          description: "This lead has been in the 'Outreach Sent' stage for 72 hours without progression.",
          leadId: lead.id,
          status: "Open",
          priority: "High",
        });
      }
    });
  }
}
