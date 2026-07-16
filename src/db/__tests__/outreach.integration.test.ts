import { test } from 'node:test';
import assert from 'node:assert';
import { setupTestDb as initTestDb } from './test-helpers';
import { OutreachService } from '../../services/outreach';
import { LeadService } from '../../services/lead';
import { outreachDrafts, approvals } from '../schema';
import { prospects as leads, activities, users } from '../schema/core';
import { eq } from 'drizzle-orm';

function setupTestDb() {
  const { db } = initTestDb();
  return {
    db,
    leadService: new LeadService(db as any),
    outreachService: new OutreachService(db as any),
  };
}

test('Outreach Service Integration', async (t) => {
  const { leadService, outreachService, db } = setupTestDb();

  // Create test user and lead for references
  await db.insert(users).values({
    id: 'user-admin',
    name: 'Admin User',
    email: 'admin@leadroom.com',
    password: 'hashed-password',
  });

  const lead = await leadService.createLead({
    name: 'Creative Agency Client',
    email: 'client@creativeagency.com',
  });

  let draftId = '';

  await t.test('createDraft should create a draft with DRAFT status and log activity', async () => {
    const draft = await outreachService.createDraft({
      leadId: lead.id,
      channel: 'EMAIL',
      subject: 'Outreach Subject Proposal',
      body: 'Hello, we noticed some website gaps...',
      createdByUserId: 'user-admin',
    });

    assert.ok(draft);
    assert.strictEqual(draft.leadId, lead.id);
    assert.strictEqual(draft.channel, 'EMAIL');
    assert.strictEqual(draft.subject, 'Outreach Subject Proposal');
    assert.strictEqual(draft.status, 'DRAFT');
    assert.strictEqual(draft.createdByUserId, 'user-admin');
    assert.ok(draft.id);

    draftId = draft.id;

    // Verify activity logs
    const activitiesList = await db.select().from(activities).where(eq(activities.leadId, lead.id));
    const draftActivity = activitiesList.find(a => a.type === 'Outreach draft created');
    assert.ok(draftActivity);
    assert.ok(draftActivity.summary.includes('Created outreach draft for EMAIL'));
  });

  await t.test('getDraftsForLead and getDraftById should retrieve created drafts', async () => {
    const drafts = await outreachService.getDraftsForLead(lead.id);
    assert.strictEqual(drafts.length, 1);
    assert.strictEqual(drafts[0].id, draftId);

    const draft = await outreachService.getDraftById(draftId);
    assert.ok(draft);
    assert.strictEqual(draft.id, draftId);
  });

  await t.test('recordApproval should save an approval and transition draft status to APPROVED', async () => {
    const approval = await outreachService.recordApproval(
      draftId,
      'user-admin',
      'APPROVED',
      'This draft looks excellent, send it.'
    );

    assert.ok(approval);
    assert.strictEqual(approval.draftId, draftId);
    assert.strictEqual(approval.userId, 'user-admin');
    assert.strictEqual(approval.decision, 'APPROVED');
    assert.strictEqual(approval.feedback, 'This draft looks excellent, send it.');

    // Check draft status was updated to APPROVED
    const updatedDraft = await outreachService.getDraftById(draftId);
    assert.ok(updatedDraft);
    assert.strictEqual(updatedDraft.status, 'APPROVED');

    // Verify activity logs
    const activitiesList = await db.select().from(activities).where(eq(activities.leadId, lead.id));
    const approvalActivity = activitiesList.find(a => a.type === 'Outreach approved');
    assert.ok(approvalActivity);
    assert.ok(approvalActivity.summary.includes('Approved outreach draft for EMAIL'));
  });

  await t.test('updateDraftStatus should update the status directly and log activity on SENT', async () => {
    const updated = await outreachService.updateDraftStatus(draftId, 'SENT');
    assert.ok(updated);
    assert.strictEqual(updated!.status, 'SENT');

    // Verify activity logs
    const activitiesList = await db.select().from(activities).where(eq(activities.leadId, lead.id));
    const sentActivity = activitiesList.find(a => a.type === 'Outreach sent');
    assert.ok(sentActivity);
    assert.ok(sentActivity.summary.includes('Sent outreach draft via EMAIL'));
  });

  await t.test('updateDraftContent should update subject and body and log activity', async () => {
    const tempDraft = await outreachService.createDraft({
      leadId: lead.id,
      channel: 'EMAIL',
      subject: 'Original Subject',
      body: 'Original body',
      createdByUserId: 'user-admin',
    });

    const updated = await outreachService.updateDraftContent(tempDraft.id, 'New Subject Line', 'Updated body text');
    assert.ok(updated);
    assert.strictEqual(updated.subject, 'New Subject Line');
    assert.strictEqual(updated.body, 'Updated body text');

    // Verify activity logged
    const activitiesList = await db.select().from(activities).where(eq(activities.leadId, lead.id));
    const editActivity = activitiesList.find(a => a.type === 'Outreach draft edited');
    assert.ok(editActivity);
    assert.ok(editActivity.summary.includes('Edited outreach draft for EMAIL'));
  });

  await t.test('updateDraftContent should allow editing APPROVED drafts', async () => {
    const tempDraft = await outreachService.createDraft({
      leadId: lead.id,
      channel: 'CALL',
      body: 'Draft for approved edit test',
      createdByUserId: 'user-admin',
    });
    await outreachService.recordApproval(tempDraft.id, 'user-admin', 'APPROVED');

    const updated = await outreachService.updateDraftContent(tempDraft.id, 'Updated Subject', 'Updated body');
    assert.strictEqual(updated.body, 'Updated body');
  });

  await t.test('updateDraftContent should reject editing SENT drafts', async () => {
    const tempDraft = await outreachService.createDraft({
      leadId: lead.id,
      channel: 'CALL',
      body: 'Temp draft for sent-lock test',
      createdByUserId: 'user-admin',
    });
    await outreachService.recordApproval(tempDraft.id, 'user-admin', 'APPROVED');
    await outreachService.updateDraftStatus(tempDraft.id, 'SENT');

    await assert.rejects(
      () => outreachService.updateDraftContent(tempDraft.id, 'Should fail', 'body'),
      (err: Error) => {
        assert.ok(err.message.includes('Only DRAFT or APPROVED drafts can be edited'));
        return true;
      }
    );
  });

  await t.test('updateDraftStatus should reject invalid transition DRAFT -> SENT', async () => {
    const freshDraft = await outreachService.createDraft({
      leadId: lead.id,
      channel: 'LINKEDIN',
      body: 'Test transition guard',
      createdByUserId: 'user-admin',
    });

    await assert.rejects(
      () => outreachService.updateDraftStatus(freshDraft.id, 'SENT'),
      (err: Error) => {
        assert.ok(err.message.includes('Invalid status transition'));
        return true;
      }
    );
  });

  await t.test('updateDraftStatus should reject transition from SENT to DRAFT', async () => {
    await assert.rejects(
      () => outreachService.updateDraftStatus(draftId, 'DRAFT'),
      (err: Error) => {
        assert.ok(err.message.includes('Invalid status transition'));
        return true;
      }
    );
  });

  await t.test('recordApproval should reject if draft is not in DRAFT status', async () => {
    await assert.rejects(
      () => outreachService.recordApproval(draftId, 'user-admin', 'APPROVED', 'Should fail'),
      (err: Error) => {
        assert.ok(err.message.includes('expected DRAFT'));
        return true;
      }
    );
  });

  await t.test('recordApproval should handle REJECTED decision correctly', async () => {
    const rejDraft = await outreachService.createDraft({
      leadId: lead.id,
      channel: 'LINKEDIN',
      body: 'Draft to be rejected',
      createdByUserId: 'user-admin',
    });

    const approval = await outreachService.recordApproval(
      rejDraft.id,
      'user-admin',
      'REJECTED',
      'Tone is too aggressive, needs softening.'
    );

    assert.strictEqual(approval.decision, 'REJECTED');
    assert.strictEqual(approval.feedback, 'Tone is too aggressive, needs softening.');

    const updatedDraft = await outreachService.getDraftById(rejDraft.id);
    assert.ok(updatedDraft);
    assert.strictEqual(updatedDraft.status, 'REJECTED');

    // Verify activity logged
    const activitiesList = await db.select().from(activities).where(eq(activities.leadId, lead.id));
    const rejActivity = activitiesList.find(a => a.type === 'Outreach rejected');
    assert.ok(rejActivity);
    assert.ok(rejActivity.summary.includes('Rejected outreach draft for LINKEDIN'));
  });

  await t.test('deleteDraft should remove a DRAFT-status draft and log activity', async () => {
    const delDraft = await outreachService.createDraft({
      leadId: lead.id,
      channel: 'EMAIL',
      body: 'Draft to delete',
      createdByUserId: 'user-admin',
    });

    const deleted = await outreachService.deleteDraft(delDraft.id);
    assert.ok(deleted);

    const fetched = await outreachService.getDraftById(delDraft.id);
    assert.strictEqual(fetched, null);

    const activitiesList = await db.select().from(activities).where(eq(activities.leadId, lead.id));
    const deleteActivity = activitiesList.find(a => a.type === 'Outreach draft deleted');
    assert.ok(deleteActivity);
  });

  await t.test('deleteDraft should reject deleting non-DRAFT status', async () => {
    await assert.rejects(
      () => outreachService.deleteDraft(draftId),
      (err: Error) => {
        assert.ok(err.message.includes('Only DRAFT status drafts can be deleted'));
        return true;
      }
    );
  });

  await t.test('deleteDraft should return false for non-existent draft', async () => {
    const result = await outreachService.deleteDraft('non-existent-id');
    assert.strictEqual(result, false);
  });

  await t.test('rejected draft cannot transition to SENT', async () => {
    const rejDraft = await outreachService.createDraft({
      leadId: lead.id,
      channel: 'CALL',
      body: 'Another draft to reject',
      createdByUserId: 'user-admin',
    });
    await outreachService.recordApproval(rejDraft.id, 'user-admin', 'REJECTED', 'Not good enough');

    await assert.rejects(
      () => outreachService.updateDraftStatus(rejDraft.id, 'SENT'),
      (err: Error) => {
        assert.ok(err.message.includes('Invalid status transition'));
        return true;
      }
    );
  });
});
