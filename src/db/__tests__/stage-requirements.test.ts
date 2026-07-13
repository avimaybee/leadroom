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
  await t.test('blocks Outreach Drafted without research snapshot', async () => {
    const { leadService } = setupTestDb();
    const lead = await leadService.createLead({ name: 'No Research' });
    await assert.rejects(
      () => leadService.updateStage(lead.id, 'Outreach Drafted'),
      /Stage Transition Blocked/,
    );
  });

  await t.test('allows Outreach Drafted when research snapshot exists', async () => {
    const { db, leadService } = setupTestDb();
    const lead = await leadService.createLead({ name: 'Has Research' });
    await db.insert(researchSnapshots).values({
      id: crypto.randomUUID(), leadId: lead.id,
      companySummary: 'Test', confidenceLevel: 'MEDIUM', createdAt: new Date(),
    });
    const updated = await leadService.updateStage(lead.id, 'Outreach Drafted');
    assert.ok(updated);
    assert.strictEqual(updated!.stage, 'Outreach Drafted');
  });

  await t.test('blocks Contacted without draft', async () => {
    const { db, leadService } = setupTestDb();
    const lead = await leadService.createLead({ name: 'No Draft' });
    // Add research and move through outreach drafted
    await db.insert(researchSnapshots).values({
      id: crypto.randomUUID(), leadId: lead.id,
      companySummary: 'Test', confidenceLevel: 'HIGH', createdAt: new Date(),
    });
    await leadService.updateStage(lead.id, 'Outreach Drafted');
    await assert.rejects(
      () => leadService.updateStage(lead.id, 'Contacted'),
      /Stage Transition Blocked/,
    );
  });

  await t.test('allows Contacted when draft exists', async () => {
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
    const updated = await leadService.updateStage(lead.id, 'Contacted');
    assert.ok(updated);
    assert.strictEqual(updated!.stage, 'Contacted');
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
    await leadService.updateStage(lead.id, 'Contacted');
    const back = await leadService.updateStage(lead.id, 'Outreach Drafted');
    assert.ok(back);
    assert.strictEqual(back!.stage, 'Outreach Drafted');
  });
});
