import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { getDb } from '../db';
import { LeadService } from '../services/lead';
import { eq } from 'drizzle-orm';
import { playbooks } from '../db/schema/playbooks';

type MonitorParams = {
  leadId: string;
  stageUpdatedAt: number;
  playbookId: string;
};

type Env = {
  DB: D1Database;
};

export class MonitorStalledLeadWorkflow extends WorkflowEntrypoint<Env, MonitorParams> {
  async run(event: WorkflowEvent<MonitorParams>, step: WorkflowStep) {
    const { leadId, stageUpdatedAt, playbookId } = event.payload;

    (process as any).env = {
      ...(process as any).env,
      ...this.env,
    };

    const db = getDb();

    // Fetch the playbook rule
    const rule = await step.do('fetch-playbook', async () => {
      const [r] = await db.select().from(playbooks).where(eq(playbooks.id, playbookId)).limit(1);
      return r;
    });

    if (!rule) return; // Playbook might have been deleted

    // Sleep for dynamic duration
    await step.sleep(`wait-${rule.delayHours}-hours`, `${rule.delayHours} hours`);

    await step.do('check-and-create-task', { retries: { limit: 3, delay: 5000 } }, async () => {
      const leadService = new LeadService(db);
      const lead = await leadService.getLead(leadId);
      
      if (!lead) return;

      // Check if lead is still in the trigger stage
      const currentStageUpdatedAt = lead.stageUpdatedAt ? new Date(lead.stageUpdatedAt).getTime() : 0;
      
      // If the stage changed to something else and back, stageUpdatedAt will be greater than the workflow's stageUpdatedAt
      // We allow a small tolerance (e.g. 5 seconds) just in case.
      const isUnchanged = Math.abs(currentStageUpdatedAt - stageUpdatedAt) < 5000;

      if (lead.stage === rule.triggerStage && isUnchanged) {
        await leadService.addTask(
          leadId,
          rule.taskTitle,
          rule.taskDescription || '',
          new Date(),
          rule.taskPriority
        );
      }
    });
  }
}
