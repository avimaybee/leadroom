import { test } from 'node:test';
import assert from 'node:assert';
import { setupTestDb as initTestDb } from './test-helpers';
import { LeadService } from '../../services/lead';
import { leadStageHistory } from '../schema/core';
import { eq } from 'drizzle-orm';

function setupTestDb() {
  const { db } = initTestDb();
  return { db, leadService: new LeadService(db as any) };
}

test('FunnelAnalytics', async (t) => {
  await t.test('returns all stages with zero counts when no history exists', async () => {
    const { leadService } = setupTestDb();
    const funnel = await leadService.getStageFunnel();
    const expectedStages = ['New', 'In Research', 'Auditing', 'Audited', 'Drafting', 'Ready to Send', 'Outreach Sent', 'Meeting', 'Won', 'Lost'];
    assert.strictEqual(funnel.length, expectedStages.length);
    for (const stage of expectedStages) {
      const row = funnel.find((r) => r.stage === stage);
      assert.ok(row, `Stage ${stage} missing from funnel`);
      assert.strictEqual(row!.entered, 0);
      assert.strictEqual(row!.exited, 0);
      assert.strictEqual(row!.conversionRate, null);
      assert.strictEqual(row!.droppedCount, 0);
      assert.strictEqual(row!.droppedPercent, null);
      assert.strictEqual(row!.avgDaysInStage, null);
    }
  });

  await t.test('entered count tracks auto-created history rows', async () => {
    const { leadService } = setupTestDb();
    await leadService.createLead({ name: 'L1' });
    await leadService.createLead({ name: 'L2' });
    const funnel = await leadService.getStageFunnel();
    const newStage = funnel.find((r) => r.stage === 'New')!;
    assert.strictEqual(newStage.entered, 2, 'Expected 2 entered for New (from createLead)');
    const researchStage = funnel.find((r) => r.stage === 'In Research')!;
    assert.strictEqual(researchStage.entered, 0);
  });

  await t.test('exited count with explicit history rows', async () => {
    const { db, leadService } = setupTestDb();
    const lead1 = await leadService.createLead({ name: 'L1' });
    const lead2 = await leadService.createLead({ name: 'L2' });
    
    // Both enter In Research
    await db.insert(leadStageHistory).values({
      id: crypto.randomUUID(),
      leadId: lead1.id,
      fromStage: 'New',
      toStage: 'In Research',
      timestamp: new Date(Date.now() - 86400000),
    });
    await db.insert(leadStageHistory).values({
      id: crypto.randomUUID(),
      leadId: lead2.id,
      fromStage: 'New',
      toStage: 'In Research',
      timestamp: new Date(),
    });
    
    // Only lead1 exits In Research
    await db.insert(leadStageHistory).values({
      id: crypto.randomUUID(),
      leadId: lead1.id,
      fromStage: 'In Research',
      toStage: 'Auditing',
      timestamp: new Date(),
    });

    const funnel = await leadService.getStageFunnel();
    const researchStage = funnel.find((r) => r.stage === 'In Research')!;
    assert.strictEqual(researchStage.entered, 2);
    assert.strictEqual(researchStage.exited, 1);
    assert.strictEqual(researchStage.droppedCount, 1);
  });

  await t.test('conversionRate between stages', async () => {
    const { db, leadService } = setupTestDb();
    const lead1 = await leadService.createLead({ name: 'L1' });
    const lead2 = await leadService.createLead({ name: 'L2' });
    
    // Both leave New and enter In Research
    for (const lead of [lead1, lead2]) {
      await db.insert(leadStageHistory).values({
        id: crypto.randomUUID(),
        leadId: lead.id,
        fromStage: 'New',
        toStage: 'In Research',
        timestamp: new Date(Date.now() - 86400000),
      });
    }

    const funnel = await leadService.getStageFunnel();
    const newStage = funnel.find((r) => r.stage === 'New')!;
    assert.strictEqual(newStage.entered, 2);
    assert.strictEqual(newStage.exited, 2);
    assert.strictEqual(newStage.conversionRate, 100);
  });

  await t.test('avgDaysInStage computed via transitions', async () => {
    const { db, leadService } = setupTestDb();
    const lead1 = await leadService.createLead({ name: 'L1' });
    const lead2 = await leadService.createLead({ name: 'L2' });
    const entered1 = new Date(Date.now() - 5 * 86400000);
    const exited1 = new Date(Date.now() - 2 * 86400000);
    const entered2 = new Date(Date.now() - 3 * 86400000);
    const exited2 = new Date(Date.now() - 2 * 86400000);
    
    await db.insert(leadStageHistory).values({
      id: crypto.randomUUID(),
      leadId: lead1.id,
      fromStage: 'New',
      toStage: 'In Research',
      timestamp: entered1,
    });
    await db.insert(leadStageHistory).values({
      id: crypto.randomUUID(),
      leadId: lead1.id,
      fromStage: 'In Research',
      toStage: 'Auditing',
      timestamp: exited1,
    });
    
    await db.insert(leadStageHistory).values({
      id: crypto.randomUUID(),
      leadId: lead2.id,
      fromStage: 'New',
      toStage: 'In Research',
      timestamp: entered2,
    });
    await db.insert(leadStageHistory).values({
      id: crypto.randomUUID(),
      leadId: lead2.id,
      fromStage: 'In Research',
      toStage: 'Auditing',
      timestamp: exited2,
    });

    const funnel = await leadService.getStageFunnel();
    const row = funnel.find((r) => r.stage === 'In Research')!;
    assert.ok(row.avgDaysInStage !== null, 'avgDaysInStage should not be null');
    assert.ok(row.avgDaysInStage >= 1.5 && row.avgDaysInStage <= 2.5, `Expected avgDaysInStage ~2, got ${row.avgDaysInStage}`);
  });
});
