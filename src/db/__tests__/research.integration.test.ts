import { test } from 'node:test';
import assert from 'node:assert';
import { setupTestDb as initTestDb } from './test-helpers';
import { ResearchService } from '../../services/research';
import { LeadService } from '../../services/lead';
import { activities } from '../schema/core';
import { jobRuns, researchSnapshots, contacts } from '../schema/research';
import { eq } from 'drizzle-orm';

function setupTestDb() {
  const { db } = initTestDb();
  return {
    db,
    leadService: new LeadService(db as any),
    researchService: new ResearchService(db as any),
  };
}

test('ResearchService integration', async (t) => {
  const { leadService, researchService, db } = setupTestDb();

  await t.test('saveResearchSnapshot should store manual edits historically', async () => {
    const lead = await leadService.createLead({ name: 'Manual Edit Test' });
    
    const snapshot = await researchService.saveResearchSnapshot(lead.id, {
      companySummary: 'Handwritten summary',
      productsServicesSummary: 'Handwritten products',
      digitalPresenceNotes: 'Social active',
      websiteNotes: 'Clean UX',
      brandingNotes: 'Excellent theme',
      painPointsHypotheses: 'Scaling operations',
      opportunityHypotheses: 'New logo redesign',
      sources: ['https://customsource.com'],
      confidenceLevel: 'HIGH',
    }, null);

    assert.ok(snapshot);
    assert.strictEqual(snapshot.origin, 'MANUAL');
    assert.strictEqual(snapshot.companySummary, 'Handwritten summary');

    const latest = await researchService.getLatestResearch(lead.id);
    assert.strictEqual(latest?.id, snapshot.id);

    // Verify activity log
    const logs = await db.select().from(activities).where(eq(activities.leadId, lead.id));
    const manualLog = logs.find((l: any) => l.type === 'Research updated');
    assert.ok(manualLog);
  });

  await t.test('addContact and getContacts should manage stakeholder list', async () => {
    const lead = await leadService.createLead({ name: 'Contact Holder Corp' });

    const c1 = await researchService.addContact(lead.id, {
      fullName: 'Alice Manager',
      roleTitle: 'Product Manager',
      email: 'alice@holder.com',
      isPrimary: false,
    }, null);

    const c2 = await researchService.addContact(lead.id, {
      fullName: 'Bob VP',
      roleTitle: 'VP Marketing',
      email: 'bob@holder.com',
      isPrimary: true,
    }, null);

    const list = await researchService.getContacts(lead.id);
    assert.strictEqual(list.length, 2);
    
    // Bob should be first because he is primary
    assert.strictEqual(list[0].id, c2.id);
    assert.strictEqual(list[0].isPrimary, 1);
    
    // Alice should be second
    assert.strictEqual(list[1].id, c1.id);
    assert.strictEqual(list[1].isPrimary, 0);

    // If we add another primary contact, Bob should be demoted
    const c3 = await researchService.addContact(lead.id, {
      fullName: 'Charlie CEO',
      roleTitle: 'CEO',
      email: 'charlie@holder.com',
      isPrimary: true,
    }, null);

    const updatedList = await researchService.getContacts(lead.id);
    assert.strictEqual(updatedList[0].id, c3.id);
    assert.strictEqual(updatedList[0].isPrimary, 1);
    
    const bobUpdated = updatedList.find((c: any) => c.id === c2.id);
    assert.strictEqual(bobUpdated?.isPrimary, 0);
  });

  await t.test('updateContact should modify contact details and handle primary swap', async () => {
    const { leadService, researchService } = setupTestDb();
    const lead = await leadService.createLead({ name: 'Contact Update Test' });

    const c1 = await researchService.addContact(lead.id, {
      fullName: 'Alice Developer',
      isPrimary: true,
    }, null);

    const c2 = await researchService.addContact(lead.id, {
      fullName: 'Bob Engineer',
      isPrimary: false,
    }, null);

    // Update c2 to be primary
    await researchService.updateContact(lead.id, c2.id, {
      fullName: 'Bob Manager',
      isPrimary: true,
    }, null);

    const list = await researchService.getContacts(lead.id);
    const updatedC1 = list.find(c => c.id === c1.id);
    const updatedC2 = list.find(c => c.id === c2.id);

    assert.strictEqual(updatedC2?.fullName, 'Bob Manager');
    assert.strictEqual(updatedC2?.isPrimary, 1);
    // Alice should be demoted
    assert.strictEqual(updatedC1?.isPrimary, 0);
  });

  await t.test('deleteContact should soft delete the contact and set deletedAt', async () => {
    const { leadService, researchService, db } = setupTestDb();
    const lead = await leadService.createLead({ name: 'Contact Delete Test' });

    const c1 = await researchService.addContact(lead.id, {
      fullName: 'Alice Developer',
    }, null);

    await researchService.deleteContact(lead.id, c1.id, null);

    const list = await researchService.getContacts(lead.id);
    // getContacts filters out soft deleted contacts
    assert.strictEqual(list.length, 0);

    // Verify contact still exists in DB but with deletedAt set
    const [dbContact] = await db.select().from(contacts).where(eq(contacts.id, c1.id)).limit(1);
    assert.ok(dbContact);
    assert.ok(dbContact.deletedAt);
  });
});
