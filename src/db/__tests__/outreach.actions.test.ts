import { test } from 'node:test';
import assert from 'node:assert';
import { eq } from 'drizzle-orm';
import { MockD1Database } from '@/db/local-mock';
import { setupTestDb as initTestDb } from './test-helpers';

// Setup environment variable so getDb works
process.env.AUTH_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
(process.env as any).NODE_ENV = 'test';
(globalThis as any).mockUserId = 'user-admin';

const { sqlite } = initTestDb();

// Set process.env.DB to our mock D1 database before loading getDb
const mockD1 = new MockD1Database(sqlite);
process.env = {
  ...process.env,
  DB: mockD1 as any,
};

import { getDb } from '../../db';
const testDb = getDb();

import {
  generateOutreachDraftAction,
  updateDraftAction,
  recordApprovalAction,
  markAsSentAction,
  duplicateDraftAction,
  deleteDraftAction,
} from '../../app/actions/outreach';

import { users, leads, outreachDrafts, approvals, activities } from '../schema';

test('Outreach Server Actions Integration', async (t) => {
  // Seed test database
  await testDb.insert(users).values({
    id: 'user-admin',
    name: 'Admin User',
    email: 'admin@leadroom.com',
    password: 'hashed-password',
  });

  await testDb.insert(leads).values({
    id: 'lead-client',
    name: 'Client Business Inc',
    website: 'clientbusiness.com',
    stage: 'Researching',
    status: 'Active',
  });

  let draftId = '';

  await t.test('generateOutreachDraftAction should trigger AI generation and save draft', async () => {
    const result = await generateOutreachDraftAction('lead-client', 'EMAIL');
    console.log('generateOutreachDraftAction result:', result);
    assert.ok(result.success);
    assert.ok(result.drafts && result.drafts.length > 0);
    assert.strictEqual(result.drafts![0].channel, 'EMAIL');
    assert.strictEqual(result.drafts![0].status, 'DRAFT');
    assert.ok(result.drafts![0].id);
    draftId = result.drafts![0].id;

    // Verify activity logged
    const activitiesList = await testDb.select().from(activities).where(eq(activities.leadId, 'lead-client'));
    assert.ok(activitiesList.some(a => a.type === 'Outreach draft created'));
  });

  await t.test('updateDraftAction should allow editing subject and body', async () => {
    const result = await updateDraftAction(draftId, 'New Subject', 'New Body Content');
    assert.ok(result.success);

    const [draft] = await testDb.select().from(outreachDrafts).where(eq(outreachDrafts.id, draftId)).limit(1);
    assert.strictEqual(draft.subject, 'New Subject');
    assert.strictEqual(draft.body, 'New Body Content');
  });

  await t.test('recordApprovalAction should record APPROVED and transition draft status', async () => {
    const result = await recordApprovalAction(draftId, 'APPROVED', 'Looks good!');
    assert.ok(result.success);

    const [draft] = await testDb.select().from(outreachDrafts).where(eq(outreachDrafts.id, draftId)).limit(1);
    assert.strictEqual(draft.status, 'APPROVED');

    const [approval] = await testDb.select().from(approvals).where(eq(approvals.draftId, draftId)).limit(1);
    assert.ok(approval);
    assert.strictEqual(approval.decision, 'APPROVED');
    assert.strictEqual(approval.feedback, 'Looks good!');
  });

  await t.test('markAsSentAction should update status to SENT', async () => {
    const result = await markAsSentAction(draftId);
    assert.ok(result.success);

    const [draft] = await testDb.select().from(outreachDrafts).where(eq(outreachDrafts.id, draftId)).limit(1);
    assert.strictEqual(draft.status, 'SENT');
  });

  await t.test('duplicateDraftAction should clone a draft into DRAFT status and preserve original values', async () => {
    const result = await duplicateDraftAction(draftId);
    assert.ok(result.success);
    assert.ok(result.draft);
    assert.notStrictEqual(result.draft.id, draftId);
    assert.strictEqual(result.draft.channel, 'EMAIL');
    assert.strictEqual(result.draft.status, 'DRAFT');
    assert.strictEqual(result.draft.subject, 'New Subject');
    assert.strictEqual(result.draft.body, 'New Body Content');

    // Verify activity logged for new draft creation
    const activitiesList = await testDb.select().from(activities).where(eq(activities.leadId, 'lead-client'));
    assert.ok(activitiesList.some(a => a.summary.includes('Created outreach draft for EMAIL')));
  });

  await t.test('generateOutreachDraftAction should support MEETING channel', async () => {
    const result = await generateOutreachDraftAction('lead-client', 'MEETING');
    assert.ok(result.success);
    assert.ok(result.drafts && result.drafts.length > 0);
    assert.strictEqual(result.drafts![0].channel, 'MEETING');
    assert.strictEqual(result.drafts![0].status, 'DRAFT');
    assert.ok(result.drafts![0].body.includes('MEETING PREP GUIDE'));
  });

  await t.test('deleteDraftAction should delete a DRAFT draft', async () => {
    const genResult = await generateOutreachDraftAction('lead-client', 'EMAIL');
    assert.ok(genResult.success);
    const delId = genResult.drafts![0].id;

    const deleteResult = await deleteDraftAction(delId);
    assert.ok(deleteResult.success);
  });

  await t.test('reject -> duplicate -> re-edit flow should work end-to-end', async () => {
    const genResult = await generateOutreachDraftAction('lead-client', 'LINKEDIN');
    assert.ok(genResult.success);
    const originalDraftId = genResult.drafts![0].id;

    const rejResult = await recordApprovalAction(originalDraftId, 'REJECTED', 'Too formal');
    assert.ok(rejResult.success);

    const dupResult = await duplicateDraftAction(originalDraftId);
    assert.ok(dupResult.success);
    assert.ok(dupResult.draft);
    assert.strictEqual(dupResult.draft.status, 'DRAFT');
    assert.notStrictEqual(dupResult.draft.id, originalDraftId);

    const editResult = await updateDraftAction(dupResult.draft.id, null, 'Less formal body');
    assert.ok(editResult.success);

    const approveResult = await recordApprovalAction(dupResult.draft.id, 'APPROVED');
    assert.ok(approveResult.success);
  });
});
