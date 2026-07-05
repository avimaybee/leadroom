import { test } from 'node:test';
import * as assert from 'node:assert';
import { setupTestDb as initTestDb } from './test-helpers';
import { LeadService } from '../../services/lead';
import { outreachDrafts as outreachDraftsTable } from '../schema/outreach';
import { researchSnapshots } from '../schema/research';

function setupTestDb() {
  const { db } = initTestDb();
  const leadService = new LeadService(db as any);
  return { db, leadService };
}

test('StageRequirements (hardcoded)', async (t) => {
  await t.test('blocks Drafting without research snapshot', async () => {
    const { leadService } = setupTestDb();
    const lead = await leadService.createLead({ name: 'No Research' });
    await assert.rejects(
      () => leadService.updateStage(lead.id, 'Drafting'),
      /Stage Transition Blocked/,
    );
  });

  await t.test('allows Drafting when research snapshot exists', async () => {
    const { db, leadService } = setupTestDb();
    const lead = await leadService.createLead({ name: 'Has Research' });
    await db.insert(researchSnapshots).values({
      id: crypto.randomUUID(), leadId: lead.id,
      companySummary: 'Test', confidenceLevel: 'MEDIUM', createdAt: new Date(),
    });
    const updated = await leadService.updateStage(lead.id, 'Drafting');
    assert.ok(updated);
    assert.strictEqual(updated!.stage, 'Drafting');
  });

  await t.test('blocks Outreach Sent without draft', async () => {
    const { db, leadService } = setupTestDb();
    const lead = await leadService.createLead({ name: 'No Draft' });
    // Add research and move through drafting
    await db.insert(researchSnapshots).values({
      id: crypto.randomUUID(), leadId: lead.id,
      companySummary: 'Test', confidenceLevel: 'HIGH', createdAt: new Date(),
    });
    await leadService.updateStage(lead.id, 'Drafting');
    await assert.rejects(
      () => leadService.updateStage(lead.id, 'Outreach Sent'),
      /Stage Transition Blocked/,
    );
  });

  await t.test('allows Outreach Sent when draft exists', async () => {
    const { db, leadService } = setupTestDb();
    const lead = await leadService.createLead({ name: 'Has Draft' });
    await db.insert(researchSnapshots).values({
      id: crypto.randomUUID(), leadId: lead.id,
      companySummary: 'Test', confidenceLevel: 'HIGH', createdAt: new Date(),
    });
    await db.insert(outreachDraftsTable).values({
      id: crypto.randomUUID(), leadId: lead.id,
      channel: 'EMAIL', body: 'Test draft', status: 'DRAFT',
      createdAt: new Date(),
    });
    const updated = await leadService.updateStage(lead.id, 'Outreach Sent');
    assert.ok(updated);
    assert.strictEqual(updated!.stage, 'Outreach Sent');
  });

  await t.test('backward moves are not blocked', async () => {
    const { db, leadService } = setupTestDb();
    const lead = await leadService.createLead({ name: 'Backward' });
    await db.insert(researchSnapshots).values({
      id: crypto.randomUUID(), leadId: lead.id,
      companySummary: 'Test', confidenceLevel: 'HIGH', createdAt: new Date(),
    });
    await db.insert(outreachDraftsTable).values({
      id: crypto.randomUUID(), leadId: lead.id,
      channel: 'EMAIL', body: 'Test draft', status: 'DRAFT',
      createdAt: new Date(),
    });
    await leadService.updateStage(lead.id, 'Outreach Sent');
    const back = await leadService.updateStage(lead.id, 'Drafting');
    assert.ok(back);
    assert.strictEqual(back!.stage, 'Drafting');
  });
});
