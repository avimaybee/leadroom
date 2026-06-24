# [049] Stage 6 Enhancement — Playbooks (Task Templates)

**Category:** Core Feature / Workflow Automation
**Effort:** M (Medium)
**Impact:** Moves the system from one-off reminders to true operational discipline by ensuring a standardized follow-up cadence for every lead based on stage entry.

---

## Context

In Stage 6, we introduced an `autoScheduleFollowUp` feature that automatically creates a single task (e.g., 7 days out) when a lead enters certain stages. While helpful, real-world agency workflows often require a sequence of activities (a "playbook") rather than a single follow-up. For instance, entering "Outreach Sent" might require checking email open status on Day 3, sending a follow-up ping on Day 7, and making a final attempt on Day 14.

## Goal

Allow operators to define "Playbooks" — configurable sequences of tasks that automatically spawn when a lead enters a specific pipeline stage. 

---

## Design

**Data Model:**
- A new table `playbooks` storing the configuration for each stage.
- A new table `playbook_tasks` storing the template for each task in the sequence (title, description, days offset, priority).

**Execution Logic:**
- Enhance `LeadService.updateStage` to check if a playbook exists for the target stage.
- If a playbook exists, bulk-create the tasks defined in `playbook_tasks` using the `daysOffset` relative to the current date.

**UI Updates:**
- A new settings page `/settings/pipeline/playbooks`.
- An interface to add, edit, and delete task templates within a playbook.

---

## Implementation

### 1. Database Schema

Add the following to `src/db/schema/core.ts`:

```typescript
export const playbooks = sqliteTable('playbooks', {
  id: text('id').primaryKey(),
  stage: text('stage').notNull().unique(), // The pipeline stage this applies to
  name: text('name').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const playbookTasks = sqliteTable('playbook_tasks', {
  id: text('id').primaryKey(),
  playbookId: text('playbook_id').notNull().references(() => playbooks.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  daysOffset: integer('days_offset').notNull(), // Number of days after stage entry
  priority: text('priority').notNull().default('Medium'), // Low, Medium, High
  category: text('category'), // e.g., Follow-up, Research
});
```

### 2. Service Layer Updates

In `src/services/lead.ts`, replace the hardcoded `autoScheduleFollowUp` with a dynamic playbook engine:

```typescript
private async triggerStagePlaybook(leadId: string, newStage: string, oldStage: string) {
  if (newStage === oldStage) return;

  // 1. Fetch active playbook for this stage
  const [playbook] = await this.db.select().from(playbooks)
    .where(and(eq(playbooks.stage, newStage), eq(playbooks.isActive, true)))
    .limit(1);

  if (!playbook) return;

  // 2. Fetch playbook tasks
  const tasksToCreate = await this.db.select().from(playbookTasks)
    .where(eq(playbookTasks.playbookId, playbook.id));

  // 3. Create tasks (with idempotency guard per task title)
  for (const template of tasksToCreate) {
    const existing = await this.db.select({ count: count() }).from(tasks)
      .where(and(
        eq(tasks.leadId, leadId),
        eq(tasks.title, template.title),
        eq(tasks.status, 'Open')
      )).limit(1);

    if (existing[0]?.count > 0) continue;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + template.daysOffset);

    await this.addTask(
      leadId,
      template.title,
      template.description || null,
      dueDate,
      template.priority,
      undefined, // assigneeId
      template.category
    );
  }
}
```

*Update call sites (`createLead`, `updateLead`, `updateStage`) to call `triggerStagePlaybook` instead of `autoScheduleFollowUp`.*

### 3. Settings UI

**New Component: `src/components/settings/PlaybooksEditor.tsx`**
- Displays a list of all Pipeline Stages.
- For each stage, allows adding a "Playbook".
- Inside a Playbook, allows adding multiple tasks:
  - Inputs: Title, Days Offset, Priority, Category.
- Uses Server Actions (`updatePlaybookAction`, `updatePlaybookTaskAction`) to persist changes.

---

## Edge Cases

- **Duplicate task titles in a playbook:** Idempotency guard prevents creating duplicate tasks for the same lead if an "Open" task with that title exists.
- **Negative days offset:** Allowed (e.g., retroactively due tasks), though typically should be >= 0. Validated on the frontend to be >= 0 for safety.
- **Changing playbooks:** Does not affect leads already in that stage. Only applies to leads entering the stage *after* the playbook is updated.

---

## Verification

1. **DB Migration:** Ensure `playbooks` and `playbook_tasks` tables are created.
2. **Integration Tests:** 
   - Create a playbook for "Outreach Sent" with two tasks (Day 3, Day 7).
   - Move a test lead into "Outreach Sent".
   - Assert that exactly two tasks are created with the correct due dates and priorities.
3. **UI Test:** Navigate to `/settings/pipeline` and configure a playbook. Save and verify it persists to the DB.
