import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { getDb } from '../db';
import { LeadService } from '../services/lead';
import { eq } from 'drizzle-orm';
import { leads } from '../db/schema/core';

type MonitorParams = {
  leadId: string;
  stageUpdatedAt: number;
};

type Env = {
  DB: D1Database;
};

export class MonitorStalledLeadWorkflow extends WorkflowEntrypoint<Env, MonitorParams> {
  async run(event: WorkflowEvent<MonitorParams>, step: WorkflowStep) {
    const { leadId, stageUpdatedAt } = event.payload;

    (process as any).env = {
      ...(process as any).env,
      ...this.env,
    };

    const db = getDb();

    // Sleep for 72 hours
    await step.sleep('wait-72-hours', '72 hours');

    await step.do('check-and-create-task', { retries: { limit: 3, delay: 5000 } }, async () => {
      const leadService = new LeadService(db);
      const lead = await leadService.getLead(leadId);
      
      if (!lead) return;

      // Check if lead is still in 'Outreach Sent'
      const currentStageUpdatedAt = lead.stageUpdatedAt ? new Date(lead.stageUpdatedAt).getTime() : 0;
      
      // If the stage changed to something else and back to Outreach Sent, stageUpdatedAt will be greater than the workflow's stageUpdatedAt
      // We allow a small tolerance (e.g. 5 seconds) just in case.
      const isUnchanged = Math.abs(currentStageUpdatedAt - stageUpdatedAt) < 5000;

      if (lead.stage === 'Outreach Sent' && isUnchanged) {
        await leadService.addTask(
          leadId,
          'Follow up on stalled outreach',
          'This lead has been in the "Outreach Sent" stage for 72 hours without any movement. Please follow up.',
          new Date(),
          'High'
        );
      }
    });
  }
}
