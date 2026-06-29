import { test } from 'node:test';
import * as assert from 'node:assert';
import { setupTestDb as initTestDb } from './test-helpers';
import { LeadService, PIPELINE_STAGES } from '../../services/lead';
import { pipelineConfig } from '../schema/core';
import { outreachDrafts as outreachDraftsTable } from '../schema/outreach';
import { researchSnapshots } from '../schema/research';
import { eq } from 'drizzle-orm';

function setupTestDb() {
  const { db } = initTestDb();
  const leadService = new LeadService(db as any);
  return { db, leadService };
}

test('StageRequirements', async (t) => {
  await t.test('no requirements configured — stage transition succeeds', async () => {
    const { leadService } = setupTestDb();
    const lead = await leadService.createLead({ name: 'Test' });
    const updated = await leadService.updateStage(lead.id, 'In Research');
    assert.ok(updated);
    assert.strictEqual(updated!.stage, 'In Research');
  });

  await t.test('blocks transition when require_research is missing', async () => {
    const { db, leadService } = setupTestDb();
    await db.insert(pipelineConfig).values({
      id: 'global',
      stageRequirements: { 'Audited': ['require_research'] },
      enforceStageOrder: false,
    });

    const lead = await leadService.createLead({ name: 'No Research' });
    await leadService.updateStage(lead.id, 'Auditing');

    await assert.rejects(
      () => leadService.updateStage(lead.id, 'Audited'),
      /Stage Transition Blocked/,
    );
  });

  await t.test('succeeds when require_research is satisfied', async () => {
    const { db, leadService } = setupTestDb();
    await db.insert(pipelineConfig).values({
      id: 'global',
      stageRequirements: { 'Audited': ['require_research'] },
      enforceStageOrder: false,
    });

    const lead = await leadService.createLead({ name: 'Has Research' });
    await db.insert(researchSnapshots).values({
      id: crypto.randomUUID(),
      leadId: lead.id,
      companySummary: 'Test research',
      confidenceLevel: 'MEDIUM',
      createdAt: new Date(),
    });

    await leadService.updateStage(lead.id, 'Auditing');
    const updated = await leadService.updateStage(lead.id, 'Audited');
    assert.ok(updated);
    assert.strictEqual(updated!.stage, 'Audited');
  });

  await t.test('blocks transition when require_draft is missing', async () => {
    const { db, leadService } = setupTestDb();
    await db.insert(pipelineConfig).values({
      id: 'global',
      stageRequirements: { 'Ready to Send': ['require_draft'] },
      enforceStageOrder: false,
    });

    const lead = await leadService.createLead({ name: 'No Draft' });
    await leadService.updateStage(lead.id, 'Drafting');

    await assert.rejects(
      () => leadService.updateStage(lead.id, 'Ready to Send'),
      /Stage Transition Blocked/,
    );
  });

  await t.test('blocks transition when require_contact_email is missing', async () => {
    const { db, leadService } = setupTestDb();
    await db.insert(pipelineConfig).values({
      id: 'global',
      stageRequirements: { 'Outreach Sent': ['require_contact_email'] },
      enforceStageOrder: false,
    });

    const lead = await leadService.createLead({ name: 'No Email' });
    await leadService.updateStage(lead.id, 'Ready to Send');

    await assert.rejects(
      () => leadService.updateStage(lead.id, 'Outreach Sent'),
      /Stage Transition Blocked/,
    );
  });

  await t.test('backward moves are not blocked by requirements', async () => {
    const { db, leadService } = setupTestDb();
    await db.insert(pipelineConfig).values({
      id: 'global',
      stageRequirements: { 'Ready to Send': ['require_draft'] },
      enforceStageOrder: false,
    });

    const lead = await leadService.createLead({ name: 'Backward' });
    await leadService.updateStage(lead.id, 'In Research');
    await leadService.updateStage(lead.id, 'Auditing');
    await leadService.updateStage(lead.id, 'Audited');
    await leadService.updateStage(lead.id, 'Drafting');
    await db.insert(outreachDraftsTable).values({
      id: crypto.randomUUID(),
      leadId: lead.id,
      channel: 'EMAIL',
      body: 'Test draft body',
      status: 'DRAFT',
      createdAt: new Date(),
    });
    await leadService.updateStage(lead.id, 'Ready to Send');
    const back = await leadService.updateStage(lead.id, 'Drafting');
    assert.ok(back);
    assert.strictEqual(back!.stage, 'Drafting');
  });
});
