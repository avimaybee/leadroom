# [037] Stage 6 — Pipeline Discipline & Next-Best-Action

**Category:** Core Feature / UX / Automation
**Effort:** XL (7 work items)
**Impact:** Transforms pipeline from passive tracking to active discipline — auto-scheduled follow-ups, enforced progression, reminder engine, funnel analytics, intelligent next-action, task assignments, bulk operations.

---

## Context

Stage 6 in PLAN.md aims to *reduce dropped leads and inconsistent follow-up*. The audit (conducted 2026-06-24) found a **solid foundation** (stage transitions, stale detection, notifications, tasks, next-action display) but 7 missing pieces that prevent the system from feeling like an active pipeline manager.

All 7 gaps are independent in implementation but should be shipped in the numbered order below — each builds on the previous to create a coherent discipline layer.

### Design Principles (from AGENTS.md, applied to Stage 6)

1. **Human-in-the-loop** — All automation creates tasks/notifications for human review. No auto-messaging.
2. **Traceability** — Every automated action is logged as an activity. No silent mutations.
3. **Strong defaults with override** — Default 7-day follow-up, default forward-only progression, but operator can override.
4. **Calm UX** — Information-dense, obvious next actions, low cognitive overhead. No flashing or alert fatigue.
5. **Existing design system** — All new UI uses the tokens from `globals.css`: `text-heading-xl`, `text-label-14`, `text-copy-14`, `p-4 rounded-lg border border-border`, `bg-card`, `text-muted-foreground`, `bg-destructive/10`, etc.

---

## Work Item 1 — Auto-schedule Follow-Up on Stage Entry

**Problem:** When a lead enters "Outreach Sent", the only automation is `MonitorStalledLeadWorkflow` which waits 72h before creating a "Follow up on stalled outreach" task. There is no immediate task creation for a sensible 7-day follow-up cadence.

**Goal:** When a lead enters "Outreach Sent" *or* "Meeting", auto-create an appropriately dated follow-up task.

### Design

- **"Outreach Sent" entry** → Create a follow-up task due in 7 days:
  - Title: `"Follow up on outreach"`
  - Description: `"This lead was marked as Outreach Sent on {date}. Schedule a follow-up touchpoint."`
  - Priority: `"High"`
  - Due date: `now + 7 days`

- **"Meeting" entry** → Create a follow-up task due in 3 days:
  - Title: `"Follow up on meeting"`
  - Description: `"This lead was marked as Meeting on {date}. Send a recap and next steps."`
  - Priority: `"High"`
  - Due date: `now + 3 days`

- **Idempotency guard**: Only create the task if there is no existing `Open` task for the same lead with the matching title (to prevent task duplication on re-entry or manual edits).

### Implementation

#### 1a. Add `autoScheduleFollowUp` method to `LeadService` (`src/services/lead.ts`)

New method after line 352 (after `addTask`):

```typescript
private async autoScheduleFollowUp(leadId: string, newStage: string, oldStage: string) {
  const FOLLOWUP_CONFIG: Record<string, { title: string; description: string; days: number } | null> = {
    'Outreach Sent': {
      title: 'Follow up on outreach',
      description: `This lead was marked as Outreach Sent. Schedule a follow-up touchpoint.`,
      days: 7,
    },
    'Meeting': {
      title: 'Follow up on meeting',
      description: `This lead was marked as Meeting. Send a recap and next steps.`,
      days: 3,
    },
  };

  const config = FOLLOWUP_CONFIG[newStage];
  if (!config || oldStage === newStage) return;

  // Idempotency: check no open task with same title exists
  const existingTasks = await this.db.select()
    .from(tasks)
    .where(and(
      eq(tasks.leadId, leadId),
      eq(tasks.title, config.title),
      eq(tasks.status, 'Open'),
    ));
  if (existingTasks.length > 0) return;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + config.days);

  await this.addTask(leadId, config.title, config.description, dueDate, 'High');
}
```

#### 1b. Call from `updateStage` and `updateLead` and `createLead`

In `src/services/lead.ts`:

- `updateStage()` — after line 257 (after `triggerWorkflowIfOutreachSent`), add: `await this.autoScheduleFollowUp(id, newStage, oldStage);`
- `updateLead()` — after line 208 (after `triggerWorkflowIfOutreachSent`), add: `await this.autoScheduleFollowUp(id, input.stage, oldLead.stage);`
- `createLead()` — after line 133 (after `triggerWorkflowIfOutreachSent`), add: `await this.autoScheduleFollowUp(id, leadData.stage || 'New', '');`

#### 1c. Tests

Add to `src/db/__tests__/lead.integration.test.ts`:

- When lead enters "Outreach Sent", verify a task is created with title "Follow up on outreach" and dueDate = now + 7 days
- When lead enters "Meeting", verify a task is created with title "Follow up on meeting" and dueDate = now + 3 days
- When lead was already in "Outreach Sent" and updateStage is called again with "Outreach Sent", verify no duplicate task
- When lead enters "New" → verify no auto task created

### Edge Cases

- **Lead created directly in "Outreach Sent"** (via `createLead`): Should still create the follow-up task.
- **Stage changed from "Outreach Sent" → "Meeting"**: Should create meeting follow-up (different title, so idempotency passes).
- **Stage changed from "Outreach Sent" → "Outreach Sent"** (same stage re-save): Idempotency guard prevents duplicate.
- **User manually creates a "Follow up on outreach" task**: Idempotency guard prevents auto-creation, respecting the user's existing task.

### Files Changed

| File | Change |
|------|--------|
| `src/services/lead.ts` | Add `autoScheduleFollowUp` method, call from 3 mutation sites |
| `src/db/__tests__/lead.integration.test.ts` | Add 4 test cases |

---

## Work Item 2 — Transition Guardrails

**Problem:** `advanceStageIfEarlier` enforces forward-only movement for automated actions, but `updateStage` (used by the manual dropdown in the lead detail page) allows **any** stage transition, including backward jumps. There's no "required step" enforcement — a lead can skip from "New" straight to "Ready to Send".

**Goal:** 
1. Make the manual stage dropdown also enforce forward-only by default, with an "Override" confirmation for backward moves.
2. Add optional required-step enforcement (configurable, off by default).

### Design

**Forward-only default**: When a user selects a stage *earlier* in the pipeline than the current stage, show a confirmation dialog: *"Moving {lead} from {currentStage} to {targetStage} will reset progress. Are you sure?"* The action only proceeds on confirmation.

**Required-step enforcement**: (Optional, settings toggle). When enabled, a lead cannot skip stages. E.g., "New" → "Auditing" would be blocked unless the lead has passed through "In Research" (has a `leadStageHistory` entry for that stage). **Off by default** to not impede workflow.

### Implementation

#### 2a. Stage dropdown client component → confirmation dialog

Current: `LeadDetailsWorkspace.tsx` renders a `<select>` for stage changes with `handleStageChange`. Replace with a `ClientStageDropdown` component.

**New file:** `src/components/ClientStageDropdown.tsx`

```tsx
'use client';

import { useState } from 'react';
import { PIPELINE_STAGES, type PipelineStage } from '@/services/lead';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ClientStageDropdownProps {
  currentStage: string;
  leadName: string;
  onStageChange: (newStage: string) => Promise<void>;
}

export function ClientStageDropdown({ currentStage, leadName, onStageChange }: ClientStageDropdownProps) {
  const [pendingStage, setPendingStage] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const currentIdx = PIPELINE_STAGES.indexOf(currentStage as PipelineStage);
  const isBackward = (target: string) => {
    const targetIdx = PIPELINE_STAGES.indexOf(target as PipelineStage);
    return targetIdx >= 0 && targetIdx < currentIdx;
  };

  const handleSelect = (newStage: string) => {
    if (newStage === currentStage) return;
    if (isBackward(newStage)) {
      setPendingStage(newStage);
      setIsConfirmOpen(true);
    } else {
      commitChange(newStage);
    }
  };

  const commitChange = async (stage: string) => {
    setIsLoading(true);
    try {
      await onStageChange(stage);
    } finally {
      setIsLoading(false);
      setPendingStage(null);
    }
  };

  return (
    <>
      <select
        value={currentStage}
        onChange={(e) => handleSelect(e.target.value)}
        disabled={isLoading}
        className="..."
      >
        {PIPELINE_STAGES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move lead backward?</AlertDialogTitle>
            <AlertDialogDescription>
              Moving <strong>{leadName}</strong> from <strong>{currentStage}</strong> to <strong>{pendingStage}</strong> will reset its pipeline progress. This may affect stale detection and analytics.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setIsConfirmOpen(false); if (pendingStage) commitChange(pendingStage); }}>
              Move backward
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

#### 2b. Required-step enforcement (optional, off by default)

Add to `settings/pipeline` page: a toggle "Enforce stage ordering (prevents skipping stages)".

**New column** on `settings` table or persist in a new `pipeline_settings` row. For simplicity, add a JSON config column to `stageThresholds` or use the existing `settings` pattern.

Actually — simplest: add a new table `pipeline_config`:
```sql
CREATE TABLE pipeline_config (
  id text PRIMARY KEY,
  enforce_stage_order integer NOT NULL DEFAULT 0,
  updated_at integer
);
```

In `LeadService.updateStage()`, when `enforce_stage_order` is true:
- Check `leadStageHistory` for intermediate stages between current and target.
- If any intermediate stage is missing, block the transition and throw an error with message: *"Cannot skip from {currentStage} to {targetStage}. Lead must pass through: {missingStages}."*

#### 2c. Tests

- Forward stage change via dropdown → no confirmation, stage changes
- Backward stage change via dropdown → confirmation dialog appears, stage changes only after confirm
- Backward stage change via dropdown → cancel → stage unchanged
- (If enforce enabled) Skipping a stage → error thrown
- (If enforce enabled) Valid forward transition → allowed

### Files Changed

| File | Change |
|------|--------|
| `src/components/ClientStageDropdown.tsx` | **New** — stage select with backward confirmation |
| `src/app/(dashboard)/leads/[id]/LeadDetailsWorkspace.tsx` | Replace inline `<select>` with `ClientStageDropdown` |
| `src/db/schema/core.ts` | **New** `pipeline_config` table |
| `src/services/lead.ts` | Add `enforceStageOrder` check in `updateStage` |
| `src/app/actions/pipeline.ts` | Add `updatePipelineConfig` server action |
| `src/components/settings/StageThresholdsTable.tsx` | Add enforce toggle row (or new component) |
| `migrations/` | New migration for `pipeline_config` table |

---

## Work Item 3 — Reminder Engine

**Problem:** The only scheduled notification mechanism is the SSE polling loop (checks for new DB rows every 2s) and `MonitorStalledLeadWorkflow` (72h sleep). There is no way for the system to push a notification at a specific future time — e.g., "Remind me about this lead tomorrow at 9am".

**Goal:** Add a lightweight reminder engine that creates time-specific push notifications visible in the notification bell, plus optional browser desktop notifications.

### Design

**Reminder table:**
```sql
CREATE TABLE reminders (
  id text PRIMARY KEY,
  lead_id text REFERENCES leads(id),
  user_id text NOT NULL,
  title text NOT NULL,
  message text,
  remind_at integer NOT NULL,  -- unix timestamp
  is_fired integer NOT NULL DEFAULT 0,
  created_at integer DEFAULT (strftime('%s', 'now')),
  link text,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);
```

**Mechanism:** A lightweight polling loop (in the existing SSE endpoint) that checks `reminders WHERE remind_at <= now AND is_fired = 0` every 30 seconds. When a reminder is due:
1. Create a notification row (reusing `createNotification` helper)
2. Mark `is_fired = 1`
3. The existing SSE push delivers it within 2s

**UI:**
- Lead detail page → "Set reminder" button in the action bar → opens a dialog with:
  - Date picker (or relative: "Tomorrow 9am", "Next Monday 9am")
  - Title (prefilled from context: "Follow up on {lead}")
  - Message (optional)
- Dashboard → notification bell shows reminder notifications with a distinct bell icon
- Clicking a reminder notification navigates to the lead (via `link` field)

### Implementation

#### 3a. DB Schema

Add to `src/db/schema/core.ts`:
```typescript
export const reminders = sqliteTable('reminders', {
  id: text('id').primaryKey(),
  leadId: text('lead_id').references(() => leads.id),
  userId: text('user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  message: text('message'),
  remindAt: integer('remind_at', { mode: 'timestamp' }).notNull(),
  isFired: integer('is_fired', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  link: text('link'),
});
```

#### 3b. Reminder Service

**New file:** `src/services/reminders.ts`

```typescript
export class ReminderService {
  constructor(private db: Db) {}

  async createReminder(leadId: string, userId: string, title: string, message: string | null, remindAt: Date, link?: string) {
    const id = crypto.randomUUID();
    await this.db.insert(reminders).values({
      id, leadId, userId, title, message,
      remindAt, link,
      isFired: false,
      createdAt: new Date(),
    });
    await new LoggingService(this.db).log({
      leadId, type: 'Reminder set',
      summary: `Reminder set: "${title}" for ${remindAt.toISOString()}`,
    });
    return id;
  }

  async fireDueReminders(): Promise<number> {
    const now = new Date();
    const due = await this.db.select()
      .from(reminders)
      .where(and(
        lte(reminders.remindAt, now),
        eq(reminders.isFired, false),
      ));

    for (const r of due) {
      await createNotification(
        this.db, r.userId, null,
        `⏰ ${r.title}`,
        r.message || 'Reminder is due.',
        'INFO',
        r.link || (r.leadId ? `/leads/${r.leadId}` : undefined),
      );
      await this.db.update(reminders)
        .set({ isFired: true })
        .where(eq(reminders.id, r.id));
    }

    return due.length;
  }
}
```

#### 3c. SSE integration

In `src/app/api/notifications/sse/route.ts`, before the notifications query in the polling loop, add:
```typescript
const reminderService = new ReminderService(db);
await reminderService.fireDueReminders();
```

#### 3d. UI — Set Reminder Dialog

**New file:** `src/components/SetReminderDialog.tsx`

Dialog with:
- Title input (default: "Follow up on {leadName}")
- Message textarea (optional)
- Date/time picker. Use `<input type="datetime-local">` for simplicity.
- "Set Reminder" submit button → calls server action `createReminderAction`

**New server action** in `src/app/actions/reminders.ts`:
```typescript
export async function createReminderAction(prevState: ActionState, formData: FormData) {
  // auth check
  // validate: title required, remindAt in future
  // create via ReminderService
  // revalidate lead detail path
}
```

#### 3e. Tests

- Create a reminder with future `remindAt` → not fired yet
- Fire due reminders → notification created, `isFired = true`
- Reminder due in the past (immediate fire) → notification created immediately
- Empty state: no due reminders → no notifications, no error

### Edge Cases

- **Reminder fires while user is offline**: Next SSE poll delivers the notification. Acceptable latency (up to 32s worst case).
- **Reminder for a lead that was archived**: Still fires, but link may 404. Graceful — lead detail page shows "not found".
- **Reminder in the past**: Validate on creation — `remindAt must be in the future`.
- **Rapid-fire reminders (dozens due at once)**: Loop through all due reminders, fire them in batch. Each gets its own notification.

### Files Changed

| File | Change |
|------|--------|
| `src/db/schema/core.ts` | Add `reminders` table |
| `src/services/reminders.ts` | **New** — `ReminderService` |
| `src/app/api/notifications/sse/route.ts` | Call `fireDueReminders` in polling loop |
| `src/app/actions/reminders.ts` | **New** — `createReminderAction` |
| `src/components/SetReminderDialog.tsx` | **New** — reminder creation UI |
| `src/app/(dashboard)/leads/[id]/LeadDetailsWorkspace.tsx` | Add "Set Reminder" button in header |
| `migrations/` | New migration for `reminders` table |

---

## Work Item 4 — Pipeline Funnel Analytics

**Problem:** There is no visibility into conversion rates between stages or average time per stage. Operators can see *how many* leads are in each stage (pipeline distribution) but not *how well* leads progress through the pipeline or where they get stuck.

**Goal:** Add a lightweight analytics view on the dashboard showing:
- Conversion rate between each adjacent stage pair
- Average time spent in each stage (for leads that have exited it)
- Drop-off rate (leads that entered a stage but never exited, vs total who entered)

### Design

**Data source:** `leadStageHistory` table (has complete enter/exit timestamps for every stage for every lead).

**Computation:** Server-side aggregate query.

**View location:** New tab/section on the dashboard page, below the existing pipeline distribution card. Or expand the pipeline distribution card to include conversion arrows.

**Visual approach:** A horizontal funnel/flow chart showing each stage as a node, with:
- Node size proportional to lead count currently in stage
- Arrows between stages showing conversion rate % and avg time
- Color coding: green (high conversion), yellow (medium), red (low)

But to keep it simple and aligned with the existing dashboard's calm UX, use a compact table instead:

```
Stage            Entered  Exited  Conversion  Avg Time  Dropped
──────────────────────────────────────────────────────────────
New               45       38      84%         4.2d      7 (16%)
In Research       38       30      79%         6.1d      8 (21%)
Auditing          30       25      83%         3.8d      5 (17%)
...
```

### Implementation

#### 4a. Analytics service method

**New method** in `LeadService` (or new `src/services/analytics.ts`):

```typescript
export interface StageFunnelRow {
  stage: string;
  entered: number;
  exited: number;
  conversionRate: number | null;  // null for last stage (Won, Lost)
  avgDaysInStage: number | null;
  droppedCount: number;
  droppedPercent: number | null;
}

async getStageFunnel(): Promise<StageFunnelRow[]> {
  // For each PIPELINE_STAGES:
  //   entered = COUNT(*) FROM leadStageHistory WHERE stage = X
  //   exited = COUNT(*) FROM leadStageHistory WHERE stage = X AND exited_at IS NOT NULL
  //   dropped = entered - (SELECT entered FROM next stage)
  // Wait — dropped is more nuanced.
  //
  // Better approach:
  //   for each stage, count leads who entered this stage AND whose
  //   most recent exited_at (or lack thereof) puts them here.
  //   Conversion from stage A to B = leads who entered B / leads who exited A.
  //   Avg time in stage A = AVG(exited_at - entered_at) for those with exited_at.

  const rows: StageFunnelRow[] = [];
  
  for (let i = 0; i < PIPELINE_STAGES.length; i++) {
    const stage = PIPELINE_STAGES[i];
    
    // Leads who entered this stage
    const enteredResult = await this.db.select({ count: count() })
      .from(leadStageHistory)
      .where(eq(leadStageHistory.stage, stage));
    const entered = enteredResult[0]?.count ?? 0;
    
    // Leads who exited this stage (have exited_at)
    const exitedResult = await this.db.select({ count: count() })
      .from(leadStageHistory)
      .where(and(
        eq(leadStageHistory.stage, stage),
        isNotNull(leadStageHistory.exitedAt),
      ));
    const exited = exitedResult[0]?.count ?? 0;
    
    // Average days in stage (for those who exited)
    const avgDays = await this.getAvgDaysInStage(stage);
    
    // Conversion to next stage
    const nextStage = PIPELINE_STAGES[i + 1];
    let conversionRate: number | null = null;
    if (nextStage && exited > 0) {
      const nextEnteredResult = await this.db.select({ count: count() })
        .from(leadStageHistory)
        .where(eq(leadStageHistory.stage, nextStage));
      const nextEntered = nextEnteredResult[0]?.count ?? 0;
      conversionRate = Math.round((nextEntered / exited) * 100);
    }
    
    const droppedCount = entered - exited;
    const droppedPercent = entered > 0 ? Math.round((droppedCount / entered) * 100) : null;
    
    rows.push({ stage, entered, exited, conversionRate, avgDaysInStage: avgDays, droppedCount, droppedPercent });
  }
  
  return rows;
}

private async getAvgDaysInStage(stage: string): Promise<number | null> {
  // Compute average of (exited_at - entered_at) in days
  const result = await this.db.execute(sql`
    SELECT AVG(
      (CAST(strftime('%s', exited_at) AS INTEGER) - CAST(strftime('%s', entered_at) AS INTEGER)) / 86400.0
    ) as avg_days
    FROM lead_stage_history
    WHERE stage = ${stage} AND exited_at IS NOT NULL
  `);
  // Depending on D1/SQLite dialect, parse result
}
```

#### 4b. Dashboard analytics card

Add a new card section in `src/app/(dashboard)/page.tsx` below the pipeline distribution:

```tsx
{/* Funnel Analytics */}
<div className="bg-card p-6 rounded-xl border border-border space-y-4">
  <div>
    <h3 className="text-label-14 text-foreground uppercase border-b border-border pb-1.5">
      Stage Conversion
    </h3>
    <p className="text-label-12 text-muted-foreground mt-1">
      Pipeline flow rates and average dwell times.
    </p>
  </div>
  <div className="overflow-x-auto">
    <table className="w-full text-copy-13">
      <thead>
        <tr className="text-label-12 text-muted-foreground border-b border-border">
          <th className="text-left py-2 pr-4">Stage</th>
          <th className="text-right py-2 px-4">Entered</th>
          <th className="text-right py-2 px-4">Exited</th>
          <th className="text-right py-2 px-4">→ Conv.</th>
          <th className="text-right py-2 px-4">Avg Time</th>
          <th className="text-right py-2 pl-4">Dropped</th>
        </tr>
      </thead>
      <tbody>
        {funnel.map((row) => (
          <tr key={row.stage} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
            <td className="py-2.5 pr-4 font-medium text-foreground">{row.stage}</td>
            <td className="text-right py-2.5 px-4 text-muted-foreground">{row.entered}</td>
            <td className="text-right py-2.5 px-4 text-muted-foreground">{row.exited}</td>
            <td className={`text-right py-2.5 px-4 font-semibold ${
              row.conversionRate !== null && row.conversionRate < 50 ? 'text-destructive'
              : row.conversionRate !== null && row.conversionRate < 75 ? 'text-chart-5'
              : 'text-chart-2'
            }`}>
              {row.conversionRate !== null ? `${row.conversionRate}%` : '—'}
            </td>
            <td className="text-right py-2.5 px-4 text-muted-foreground">
              {row.avgDaysInStage !== null ? `${row.avgDaysInStage.toFixed(1)}d` : '—'}
            </td>
            <td className={`text-right py-2.5 pl-4 ${row.droppedCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {row.droppedCount > 0 ? `${row.droppedCount} (${row.droppedPercent}%)` : '0'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>
```

#### 4c. Tests

- With 3 leads that moved New → In Research → Auditing, verify funnel shows correct counts
- With a lead stuck in New (no exit), verify New shows entered=1, exited=0, dropped=1
- With a lead that went New → In Research → (back to) New, verify stage history correctly tracks both entries

### Edge Cases

- **No leads in pipeline yet**: All counts 0, conversion rates null. Show `—` for all values, grayed out.
- **Stage with no exits**: `droppedCount` = `entered` (all are dropped). Show red highlight.
- **Stage with 100% conversion**: Green highlight.
- **Very new system with small numbers**: Percentages may look extreme. That's fine — real numbers will stabilize.

### Files Changed

| File | Change |
|------|--------|
| `src/services/lead.ts` | Add `getStageFunnel()` and `getAvgDaysInStage()` |
| `src/app/(dashboard)/page.tsx` | Add funnel analytics section below pipeline distribution |
| `src/db/__tests__/lead.integration.test.ts` | Add funnel query tests |

---

## Work Item 5 — NBA Engine (Next-Best-Action)

**Problem:** Current next-action logic is purely heuristic (overdue task > future task > stale > none). It's hardcoded and doesn't learn from outcomes or support configurable prioritization.

**Goal:** Make next-action recommendation configurable (which signals to weight) and add tracking of which recommendations were acted on.

### Design

Replace the hardcoded priority chain with a **configurable scoring function** stored as pipeline-level settings:

```typescript
interface NBARule {
  signal: 'overdue_task' | 'future_task' | 'stale' | 'unsent_draft' | 'no_research' | 'no_audit' | 'unread';
  weight: number;  // 0-100
}
```

Default weights preserving current behavior:
- `overdue_task`: 100
- `future_task`: 80
- `stale`: 60
- `unsent_draft`: 70
- `no_research`: 50
- `no_audit`: 40
- `unread`: 30

**Storage**: Add to `pipeline_config` as a JSON column `nba_rules`.

**NBA output**: Each lead gets a scored recommendation with rationale, displayed as:
```
[High] Follow up on outreach (task overdue by 3d)
[Med] Review audit results (stale 8d in Audited)
[Low] Start research (no research snapshot)
```

### Implementation

#### 5a. NBA settings UI

**New section** in `/settings/pipeline` (below stage thresholds): "Next-Best-Action Signals"

Rendered as a table of signal rows with weight sliders (0-100):
```
Signal                    Weight
─────────────────────────────────
Overdue task             [100] ────
Future task              [80]  ────
Stale lead               [60]  ────
Unsent draft             [70]  ────
No research              [50]  ────
No audit                 [40]  ────
Unread lead              [30]  ────
```

Sliders use `<input type="range" min="0" max="100">` with a number display.

#### 5b. NBA computation engine

**New method** `getNextBestAction(lead)` on `LeadService`:

```typescript
interface NBAResult {
  action: string;
  type: 'task' | 'research' | 'audit' | 'outreach' | 'review';
  priority: 'High' | 'Medium' | 'Low';
  rationale: string;
  link?: string;
  score: number;
}

async getNextBestActions(leadId: string, nbaRules: NBARule[]): Promise<NBAResult[]> {
  const lead = await this.getLead(leadId);
  if (!lead) return [];
  
  const scores: { action: NBAResult }[] = [];
  
  for (const rule of nbaRules) {
    const signalValue = await this.evaluateSignal(lead, rule.signal);
    const weightedScore = signalValue * rule.weight;
    
    if (weightedScore > 0) {
      scores.push({ action: { ...this.signalToAction(rule.signal, lead), score: weightedScore } });
    }
  }
  
  return scores.sort((a, b) => b.score - a.score);
}

private async evaluateSignal(lead: Lead, signal: string): Promise<number /* 0-1 */> {
  // Each signal returns a float 0-1 representing how strong the signal is
  // e.g., overdue tasks: count / maxOverdueConsidered (cap at 3)
}
```

#### 5c. Frontend integration

- **Lead list "Next Action" column**: Use NBA score instead of hardcoded priority chain.
- **Lead detail "Next Action" section**: Show the top recommendation with option to see all ranked.
- **Dashboard action feed**: NBA items shown with their priority badge (High/Med/Low).

#### 5d. Action tracking

When a user clicks "Execute Task" or navigates to the recommended view, log an activity:
```
type: 'NBA action taken',
summary: `Acted on NBA: ${actionType} for ${lead.name}`,
metadata: { recommendationType: actionType, leadId }
```

This enables future analysis: "Which NBA signals lead to the most actions?"

### Edge Cases

- **All weights = 0**: No recommendations shown. Display "No next action (all signals disabled)".
- **Multiple signals tie**: Sort by signal name alphabetically, then show both.
- **Lead is Won/Lost/Archived**: No NBA recommendations (stage is terminal).
- **Fresh system, no data yet**: All signal values 0 → "Start building your pipeline to see recommendations."

### Files Changed

| File | Change |
|------|--------|
| `src/db/schema/core.ts` | Add `nba_rules` JSON column to `pipeline_config` |
| `src/services/lead.ts` | Add `getNextBestActions`, `evaluateSignal`, `signalToAction` |
| `src/components/settings/NbaRulesEditor.tsx` | **New** — NBA weight sliders |
| `src/app/(dashboard)/settings/pipeline/page.tsx` | Add NBA section |
| `src/app/actions/pipeline.ts` | Add `updateNbaRules` action |
| `src/app/(dashboard)/leads/page.tsx` | Use NBA for next-action display |
| `src/app/(dashboard)/leads/[id]/LeadDetailsWorkspace.tsx` | Use NBA for next-action section |

---

## Work Item 6 — Task Assignments

**Problem:** Tasks have no `assigneeId`. Every task is ownerless. There's no way to filter "my tasks" vs "all tasks". No categories/tags for organizing tasks.

**Goal:** Add task assignments (to a user), task categories, and a "My Tasks" view on the dashboard.

### Design

**Schema changes to `tasks` table:**
- Add `assignee_id text REFERENCES users(id)` (nullable — tasks can be unassigned)
- Add `category text` (nullable — freeform string tag: "follow-up", "research", "audit", "outreach", "admin")

**UI:**
- Task creation form gets an "Assign to" user dropdown (populated from the `users` table) and a "Category" dropdown (predefined list: Follow-up, Research, Audit, Outreach, Admin — or freeform input).
- "My Tasks" card on dashboard: `tasks WHERE assignee_id = currentUserId AND status = 'Open'` with count.
- Lead detail task list shows assignee name next to each task.
- Dashboard task list gets an "Assignee" column/filter.

### Implementation

#### 6a. Migration

```sql
ALTER TABLE tasks ADD COLUMN assignee_id text REFERENCES users(id);
ALTER TABLE tasks ADD COLUMN category text;
```

#### 6b. Schema update

In `src/db/schema/core.ts`, add to `tasks` table:
```typescript
assigneeId: text('assignee_id').references(() => users.id),
category: text('category'),
```

#### 6c. Service updates

In `LeadService`:
- Update `addTask` signature to accept `assigneeId` and `category`
- Update `getDashboardTasks` to accept optional `assigneeId` filter
- New method `getMyTasks(userId)` returning tasks assigned to user

#### 6d. UI updates

**ClientTaskForm.tsx**: Add:
- "Assign to" dropdown (select from users list — fetched server-side in the page component)
- "Category" dropdown: "Follow-up", "Research", "Audit", "Outreach", "Admin", "Other"

**Dashboard**: Add "My Tasks" card showing count of tasks assigned to current user, with link to filtered leads view.

**Lead detail task items**: Show avatar/initials + name of assignee, and category badge.

**DashboardTaskList.tsx**: Show assignee name, category badge.

#### 6e. Server action updates

`createTaskAction` — accept and persist `assigneeId` and `category`. Validate `assigneeId` exists in `users`.

### Edge Cases

- **No users in system yet**: Assignee dropdown shows "Unassigned" only. Tasks created without assignee.
- **User assigned to task is deleted**: Assignee shows as "Unknown user" with muted styling.
- **Category freeform vs predefined**: Allow both — predefined list for convenience, "Other" + text input for custom.
- **Bulk reassign**: Not in scope. Future enhancement.

### Files Changed

| File | Change |
|------|--------|
| `migrations/` | New migration adding `assignee_id` and `category` columns |
| `src/db/schema/core.ts` | Add columns to `tasks` table |
| `src/services/lead.ts` | Update `addTask`, `getDashboardTasks`, add `getMyTasks` |
| `src/app/actions/tasks.ts` | Accept `assigneeId`, `category` in create action |
| `src/app/(dashboard)/leads/[id]/ClientTaskForm.tsx` | Add assignee dropdown + category selector |
| `src/app/(dashboard)/leads/[id]/ClientTaskItem.tsx` | Show assignee + category |
| `src/components/dashboard/DashboardTaskList.tsx` | Show assignee + category |
| `src/app/(dashboard)/page.tsx` | Add "My Tasks" card |

---

## Work Item 7 — Bulk Stale Actions

**Problem:** Cannot select multiple stale leads and advance/remind them in bulk. Each lead must be handled individually.

**Goal:** Add a checkbox selection mode to the leads list, with a floating action bar that appears when ≥1 lead is selected, offering:
- "Advance stage" (bulk advance all selected leads forward by one stage)
- "Set reminder" (bulk create a reminder for all selected)
- "Add task" (bulk create the same task for all selected)

### Design

**Selection mode**: A toggle button in the leads list toolbar (icon: `CheckSquare`). When active, each lead row gets a checkbox. A floating bottom bar shows `N selected` with action buttons.

**Lead list** already has complex filtering and state management. The selection state should be client-side only (no URL param persistence).

### Implementation

#### 7a. Bulk action server actions

**New file** `src/app/actions/bulk.ts`:

```typescript
export async function bulkAdvanceStageAction(leadIds: string[]) {
  const userId = await getUserId();
  if (!userId) throw new Error('Unauthorized');
  const service = new LeadService(getDb());
  const results = { advanced: 0, skipped: 0, errors: 0 };
  for (const id of leadIds) {
    try {
      const lead = await service.getLead(id);
      if (!lead) continue;
      const currentIdx = PIPELINE_STAGES.indexOf(lead.stage as PipelineStage);
      if (currentIdx < 0 || currentIdx >= PIPELINE_STAGES.length - 1) {
        results.skipped++; // terminal stage
        continue;
      }
      const nextStage = PIPELINE_STAGES[currentIdx + 1];
      await service.updateStage(id, nextStage);
      results.advanced++;
    } catch {
      results.errors++;
    }
  }
  revalidatePath('/leads');
  return results;
}

export async function bulkAddTaskAction(leadIds: string[], title: string, dueDate: string | null, priority: string) {
  // Same pattern: iterate, create task for each
}

export async function bulkSetReminderAction(leadIds: string[], title: string, remindAt: string) {
  // Same pattern
}
```

#### 7b. UI — Selection toolbar

**New file** `src/components/BulkActionBar.tsx`:

Floating bottom bar (fixed positioned) when visible:
```
┌────────────────────────────────────────────┐
│  3 selected  [Advance] [Add Task] [Remind] │
└────────────────────────────────────────────┘
```

- "Advance" → calls `bulkAdvanceStageAction` with selected IDs
- "Add Task" → opens a dialog with title + due date + priority → calls `bulkAddTaskAction`
- "Remind" → opens a dialog with title + remindAt → calls `bulkSetReminderAction`
- Deselect all (X) button

After action completes, show a sonner toast: `"Advanced 3 leads to next stage"` / `"Task added to 3 leads"`.

#### 7c. Lead list modifications

Add to `src/app/(dashboard)/leads/page.tsx` — the page is server component. Selection state lives in a new client wrapper:

**New file** `src/app/(dashboard)/leads/LeadListWithBulk.tsx` — wraps the leads table with selection state. Or more simply, add a `LeadListClientWrapper` that adds checkboxes to each row.

But the current leads list renders rows in the server component directly. To add client-side selection, we need to either:

a) Convert the table to a client component (costly, loses SSR)
b) Add a lightweight client wrapper that overlays checkboxes using DOM IDs

**Recommended approach**: Add a thin client component at the top level that provides the selection context, and pass lead IDs to a `BulkActionBar`. The checkboxes can be added via a separate client component rendered next to each row.

**Simpler approach**: Add a `LeadRowCheckbox` client component for each row (just a checkbox input) plus the `BulkActionBar`. The checkbox IDs match lead IDs. The bar reads checked state from the DOM.

Even simpler: Use a simple React context for selection state that wraps the leads page content, with a `LeadCheckbox` component for each row.

```tsx
// BulkSelectProvider (context)
// useBulkSelect() hook
// LeadCheckbox renders <input type="checkbox" onChange={toggle(id)}>
// BulkActionBar reads selectedIds from context
```

### Edge Cases

- **0 selected**: Action bar hidden.
- **1 selected**: "1 selected" — actions still work normally.
- **All selected leads in terminal stage (Won/Lost)**: Advance is skipped for those, toast says "Advanced 2 of 5 (3 in terminal stages)".
- **Mix of stages in selection**: Advance moves each lead to their *next* stage individually (not all to the same stage).
- **Selection persists across page navigation**: Not in scope. Selection resets on page leave.

### Files Changed

| File | Change |
|------|--------|
| `src/app/actions/bulk.ts` | **New** — bulk advance, add task, set reminder actions |
| `src/components/BulkActionBar.tsx` | **New** — floating selection action bar |
| `src/components/BulkSelectProvider.tsx` | **New** — selection context + hook |
| `src/app/(dashboard)/leads/page.tsx` | Add selection context provider, checkboxes, action bar |
| `src/app/(dashboard)/leads/LeadRowCheckbox.tsx` | **New** — individual row checkbox |

---

## Dependency Order & Effort Estimate

```
Work Item          Effort  Depends On    Can Parallelize
────────────────────────────────────────────────────────
1. Auto-followup   S       —             —
2. Guardrails      M       —             ✓ (with Wi1)
3. Reminder engine L       —             ✓ (with Wi1, Wi2)
4. Funnel analytics M      —             ✓ (all)
5. NBA engine      L       —             —
6. Task assignments M      Wi5 (UX uses same patterns? No, independent)
7. Bulk actions    M       —             ✓ (with Wi1-6)
```

**Total effort**: L (Large) — approximately 5-7 focused coding sessions.

**Suggested execution order (by dependency flow):**
1. Wi1 (Auto-followup) + Wi4 (Funnel) — parallel, both add to LeadService
2. Wi2 (Guardrails) + Wi6 (Task assignments) — parallel, independent
3. Wi3 (Reminder engine) — standalone
4. Wi5 (NBA engine) — standalone, most complex logic
5. Wi7 (Bulk actions) — needs everything else stable, last to ship

But for simplicity in a single pass: **do them in numeric order** (1→2→3→4→5→6→7).

---

## Verification

### Per Work Item

| Work Item | Verification |
|-----------|--------------|
| Wi1 | `npm test` — 4 new tests pass. Manual: move lead to Outreach Sent, verify task created with 7-day due date. |
| Wi2 | `npm test` — 4 new tests pass. Manual: try backward move, see confirmation dialog. |
| Wi3 | `npm test` — 3 new tests pass. Manual: set reminder, wait for notification to appear. |
| Wi4 | `npm test` — 3 new tests pass. Manual: open dashboard, see funnel table with realistic data. |
| Wi5 | `npm test` — new service tests. Manual: adjust weights in settings, see reordered recommendations. |
| Wi6 | `npm test` — existing task tests updated. Manual: create task with assignee, see it in My Tasks. |
| Wi7 | `npm test` — 3 new bulk action tests. Manual: select 3 leads, advance, see toast. |

### Full Verification

```bash
npm run build     # Must pass cleanly
npm test          # Must pass with 94+ tests (existing + new)
```

### Rollback

Each work item is independently deployable. If one causes issues, revert only that item's changes. No schema migrations are destructive (all add nullable columns or new tables).

---

## Design System Reference

All new UI must use these existing tokens and patterns:

### Typography
| Token | Usage |
|-------|-------|
| `text-heading-4xl` | Page titles (36px, bold) |
| `text-heading-xl` | Section titles (20px, semibold) |
| `text-heading-lg` | Card titles (18px, semibold) |
| `text-label-14` | Labels, uppercase section headers (14px, semibold) |
| `text-label-12` | Badges, table headers, secondary labels (12px, semibold) |
| `text-copy-16` | Body text (16px, regular) |
| `text-copy-14` | Secondary body text (14px, regular) |
| `text-copy-13` | Small body text, table cells (13px, regular) |

### Colors
| Token | Usage |
|-------|-------|
| `bg-background` | Page background (white) |
| `bg-card` | Card backgrounds (white) |
| `card` | Card background |
| `bg-foreground` | Dark section backgrounds (for "Next Action" hero section) |
| `bg-muted` | Subtle background (`#f5f5f0`) |
| `bg-destructive/10` | Warning/alert backgrounds (red tint) |
| `text-foreground` | Primary text |
| `text-muted-foreground` | Secondary text |
| `text-destructive` | Error/overdue text |
| `text-primary` | Links, emphasis |
| `border-border` | Default border (`#e6e5e0`) |
| `border-foreground/10` | Subtle borders on dark backgrounds |

### Spacing
| Token | Usage |
|-------|-------|
| `p-4` / `px-4 py-3` | Card padding |
| `p-6` | Section padding |
| `gap-3` | Between form elements |
| `gap-4` | Between cards |
| `space-y-4` | Between section children |
| `space-y-6` | Between major sections |

### Layout Patterns
- Page wrapper: `<div className="space-y-8 animate-fade-in text-left">`
- Section card: `<div className="bg-card p-6 rounded-xl border border-border space-y-4">`
- Section header: `<h3 className="text-label-14 text-foreground uppercase border-b border-border pb-1.5">`
- Card grid: `<div className="grid grid-cols-2 md:grid-cols-5 gap-4">`
- Split layout: `<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">`

### Component Patterns
- Buttons: `<Button variant="default|outline|ghost|secondary" size="default|sm|xs">`
- Badges: `<Badge variant="default|destructive|secondary|outline">`
- Links as buttons: `<Link href="..." className={buttonVariants({ variant: 'outline' })}>`
- Inputs: standard `<input>` styled via Tailwind classes in shadcn patterns
- Dialogs: shadcn `<AlertDialog>` for confirmations, shadcn `<Dialog>` for forms
- Empty states: centered text `text-copy-14 text-muted-foreground py-6`

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Reminder engine poll adds DB load | Low (30s interval, small table) | Low | Keep query indexed on `(remind_at, is_fired)` |
| NBA engine overcomplicates simple thing | Medium | Medium | Ship with conservative defaults matching current behavior; make configurable |
| Bulk actions cause accidental mass changes | Medium | High | Show confirmation dialog with count; log bulk actions to activity feed; always show action results toast |
| Transition guardrails frustrate power users | Medium | Low | Backward moves show confirmation (not block); enforce toggle is opt-in |
| Funnel analytics query is slow on large datasets | Low (hundreds of leads) | Low | Compute on page load (no caching needed at this scale); add DB index on `lead_stage_history.stage` |

---

## Part 2 — Fleshed-Out Implementations & Additional Work Items

The sections above define the 7 core work items. Below, each critical work item is expanded with full implementation code, exact file paths, line numbers of integration points, wireframe prose, and additional work items (8–10) that emerged during the deep-dive.

---

## Expanded Work Item 1 — Auto-Schedule Follow-Up (Full Code & Integration Map)

### 1d. Exact integration points in `src/services/lead.ts`

Current file structure (line numbers from audit):

```
Line 33-50:   triggerWorkflowIfOutreachSent (private)
Line 52-60:   advanceStageIfEarlier
Line 62-137:  createLead
Line 164-212: updateLead
Line 214-257: updateStage
Line 259-273: archiveLead
Line 326-352: addTask → INSERT AFTER THIS LINE
```

**After line 352**, insert the full `autoScheduleFollowUp`:

```typescript
private async autoScheduleFollowUp(leadId: string, newStage: string, oldStage: string) {
  const FOLLOWUP_CONFIG: Record<string, { title: string; description: string; days: number } | null> = {
    'Outreach Sent': {
      title: 'Follow up on outreach',
      description: `This lead was marked as Outreach Sent on ${new Date().toLocaleDateString()}. Schedule a follow-up touchpoint.`,
      days: 7,
    },
    'Meeting': {
      title: 'Follow up on meeting',
      description: `This lead was marked as Meeting on ${new Date().toLocaleDateString()}. Send a recap and next steps.`,
      days: 3,
    },
  };

  const config = FOLLOWUP_CONFIG[newStage];
  if (!config || oldStage === newStage) return;

  // Idempotency: check no open task with same title for this lead
  const [existing] = await this.db
    .select({ count: count() })
    .from(tasks)
    .where(and(
      eq(tasks.leadId, leadId),
      eq(tasks.title, config.title),
      eq(tasks.status, 'Open'),
    ))
    .limit(1);

  if (existing?.count > 0) return;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + config.days);

  await this.addTask(leadId, config.title, description, dueDate, 'High');
}
```

**Call sites (exact line insertions):**

| Method | Insert after line | Inserted code |
|--------|------------------|---------------|
| `createLead` | Line 133 (`await this.triggerWorkflowIfOutreachSent(...)`) | `await this.autoScheduleFollowUp(id, leadData.stage || 'New', '');` |
| `updateLead` | Line 208 (`await this.triggerWorkflowIfOutreachSent(...)`) | `await this.autoScheduleFollowUp(id, input.stage, oldLead.stage);` |
| `updateStage` | Line 257 (`await this.triggerWorkflowIfOutreachSent(...)`) | `await this.autoScheduleFollowUp(id, newStage, oldStage);` |

### 1e. Test code for `lead.integration.test.ts`

```typescript
// Add to existing test file
describe('autoScheduleFollowUp', () => {
  it('creates 7-day follow-up task when entering Outreach Sent', async () => {
    const lead = await service.createLead({ name: 'Test Lead', stage: 'New' });
    await service.updateStage(lead.id, 'Outreach Sent');
    const tasks = await service.getTasks(lead.id);
    const followUp = tasks.find(t => t.title === 'Follow up on outreach');
    expect(followUp).toBeDefined();
    expect(followUp!.priority).toBe('High');
    expect(followUp!.status).toBe('Open');
    const dueDate = followUp!.dueDate!.getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(dueDate - (Date.now() + sevenDays))).toBeLessThan(5000);
  });

  it('does not duplicate follow-up task on re-entry', async () => {
    const lead = await service.createLead({ name: 'Test Lead', stage: 'New' });
    await service.updateStage(lead.id, 'Outreach Sent');
    await service.updateStage(lead.id, 'New');
    await service.updateStage(lead.id, 'Outreach Sent');
    const tasks = await service.getTasks(lead.id);
    const followUps = tasks.filter(t => t.title === 'Follow up on outreach');
    expect(followUps.length).toBe(1);
  });

  it('creates 3-day meeting follow-up', async () => {
    const lead = await service.createLead({ name: 'Test Lead', stage: 'Outreach Sent' });
    await service.updateStage(lead.id, 'Meeting');
    const tasks = await service.getTasks(lead.id);
    const followUp = tasks.find(t => t.title === 'Follow up on meeting');
    expect(followUp).toBeDefined();
    expect(followUp!.priority).toBe('High');
  });

  it('respects existing user-created task with same title', async () => {
    const lead = await service.createLead({ name: 'Test Lead', stage: 'New' });
    await service.addTask(lead.id, 'Follow up on outreach', null, null, 'Low');
    await service.updateStage(lead.id, 'Outreach Sent');
    const tasks = await service.getTasks(lead.id);
    const followUps = tasks.filter(t => t.title === 'Follow up on outreach');
    expect(followUps.length).toBe(1); // Did not duplicate
    expect(followUps[0].priority).toBe('Low'); // Preserved user's priority
  });

  it('skips auto-followup for non-configured stages like Won and Lost', async () => {
    const lead = await service.createLead({ name: 'Test Lead', stage: 'New' });
    await service.updateStage(lead.id, 'Won');
    const tasks = await service.getTasks(lead.id);
    expect(tasks.length).toBe(0); // No auto created tasks
  });
});
```

---

## Expanded Work Item 5 — NBA Engine (Full Signal Evaluation)

### 5e. Complete `evaluateSignal` implementation

Each signal must be evaluated using real DB queries. Add these to `LeadService`:

```typescript
type NBASignal = 'overdue_task' | 'future_task' | 'stale' | 'unsent_draft' | 'no_research' | 'no_audit' | 'unread';

interface NBARule {
  signal: NBASignal;
  weight: number;
}

interface NBAResult {
  action: string;
  type: 'task' | 'research' | 'audit' | 'outreach' | 'review';
  priority: 'High' | 'Medium' | 'Low';
  rationale: string;
  link?: string;
  score: number;
}

// NBARules default
const DEFAULT_NBA_RULES: NBARule[] = [
  { signal: 'overdue_task', weight: 100 },
  { signal: 'future_task', weight: 80 },
  { signal: 'stale', weight: 60 },
  { signal: 'unsent_draft', weight: 70 },
  { signal: 'no_research', weight: 50 },
  { signal: 'no_audit', weight: 40 },
  { signal: 'unread', weight: 30 },
];

async getNextBestActions(leadId: string, rules?: NBARule[]): Promise<NBAResult[]> {
  const lead = await this.getLead(leadId);
  if (!lead) return [];
  if (lead.status !== 'Active') return [];
  if (lead.stage === 'Won' || lead.stage === 'Lost') return [];

  const activeRules = rules || DEFAULT_NBA_RULES;
  const results: Array<NBAResult & { score: number }> = [];

  for (const rule of activeRules) {
    if (rule.weight <= 0) continue;
    const signalStrength = await this.evaluateSignal(lead, rule.signal);
    if (signalStrength <= 0) continue;
    const weighted = Math.round(signalStrength * rule.weight);
    results.push({
      ...this.signalToAction(rule.signal, lead, signalStrength),
      score: weighted,
    });
  }

  return results.sort((a, b) => b.score - a.score);
}

private async evaluateSignal(lead: Lead, signal: NBASignal): Promise<number /* 0-1 */> {
  switch (signal) {
    case 'overdue_task': {
      const [row] = await this.db
        .select({ count: count() })
        .from(tasks)
        .where(and(
          eq(tasks.leadId, lead.id),
          eq(tasks.status, 'Open'),
          isNotNull(tasks.dueDate),
          lte(tasks.dueDate, new Date()),
        ));
      const count = Math.min(row?.count ?? 0, 3); // cap at 3
      return count / 3; // 0, 0.33, 0.67, 1.0
    }

    case 'future_task': {
      const [row] = await this.db
        .select({ count: count() })
        .from(tasks)
        .where(and(
          eq(tasks.leadId, lead.id),
          eq(tasks.status, 'Open'),
          isNotNull(tasks.dueDate),
          gt(tasks.dueDate, new Date()),
        ));
      return row?.count && row.count > 0 ? 0.5 : 0;
    }

    case 'stale': {
      if (!lead.stageUpdatedAt) return 0;
      const thresholdDays = await this.getStageThresholdDays(lead.stage);
      const ageMs = Date.now() - new Date(lead.stageUpdatedAt).getTime();
      const ageDays = ageMs / (24 * 60 * 60 * 1000);
      if (ageDays <= thresholdDays) return 0;
      // How far past threshold: 1x over = 0.5, 2x over = 0.75, 3x+ over = 1.0
      const overBy = ageDays / thresholdDays;
      return Math.min(0.5 + (overBy - 1) * 0.25, 1.0);
    }

    case 'unsent_draft': {
      const [row] = await this.db
        .select({ count: count() })
        .from(outreachDrafts)
        .where(and(
          eq(outreachDrafts.leadId, lead.id),
          eq(outreachDrafts.status, 'DRAFT'),
        ));
      return row?.count && row.count > 0 ? 0.6 : 0;
    }

    case 'no_research': {
      const [row] = await this.db
        .select({ count: count() })
        .from(researchSnapshots)
        .where(eq(researchSnapshots.leadId, lead.id));
      return row?.count && row.count > 0 ? 0 : 1.0;
    }

    case 'no_audit': {
      const [row] = await this.db
        .select({ count: count() })
        .from(audits)
        .where(eq(audits.leadId, lead.id));
      return row?.count && row.count > 0 ? 0 : 1.0;
    }

    case 'unread': {
      return lead.isRead ? 0 : 1.0;
    }

    default:
      return 0;
  }
}

private async getStageThresholdDays(stage: string): Promise<number> {
  const [row] = await this.db
    .select({ days: stageThresholds.days })
    .from(stageThresholds)
    .where(eq(stageThresholds.stage, stage))
    .limit(1);
  return row?.days ?? 5;
}

private signalToAction(signal: NBASignal, lead: Lead, strength: number): Omit<NBAResult, 'score'> {
  switch (signal) {
    case 'overdue_task':
      return {
        action: 'Complete overdue tasks',
        type: 'task',
        priority: strength >= 0.67 ? 'High' : 'Medium',
        rationale: `${lead.name} has overdue tasks requiring attention.`,
        link: `/leads/${lead.id}`,
      };
    case 'future_task':
      return {
        action: 'Review upcoming tasks',
        type: 'task',
        priority: 'Medium',
        rationale: `${lead.name} has scheduled tasks to prepare for.`,
        link: `/leads/${lead.id}`,
      };
    case 'stale':
      return {
        action: 'Re-engage stalled lead',
        type: 'review',
        priority: strength >= 0.75 ? 'High' : 'Medium',
        rationale: `${lead.name} has been idle in "${lead.stage}" past threshold.`,
        link: `/leads/${lead.id}`,
      };
    case 'unsent_draft':
      return {
        action: 'Review and send outreach draft',
        type: 'outreach',
        priority: 'High',
        rationale: `${lead.name} has an unsent outreach draft ready.`,
        link: `/leads/${lead.id}?tab=outreach`,
      };
    case 'no_research':
      return {
        action: 'Start lead research',
        type: 'research',
        priority: 'High',
        rationale: `${lead.name} has no research snapshot.`,
        link: `/leads/${lead.id}?tab=research`,
      };
    case 'no_audit':
      return {
        action: 'Run digital presence audit',
        type: 'audit',
        priority: 'Medium',
        rationale: `${lead.name} has not been audited.`,
        link: `/leads/${lead.id}?tab=audit`,
      };
    case 'unread':
      return {
        action: 'Review new lead',
        type: 'review',
        priority: 'High',
        rationale: `${lead.name} is unread.`,
        link: `/leads/${lead.id}`,
      };
    default:
      return {
        action: 'Review lead',
        type: 'review',
        priority: 'Low',
        rationale: `Review ${lead.name} for next steps.`,
        link: `/leads/${lead.id}`,
      };
  }
}
```

### 5f. Frontend: NBA recommendation list component

**New file: `src/components/lead/NextBestActionsList.tsx`**

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lightbulb, ArrowRight } from 'lucide-react';

interface NBAResult {
  action: string;
  type: 'task' | 'research' | 'audit' | 'outreach' | 'review';
  priority: 'High' | 'Medium' | 'Low';
  rationale: string;
  link?: string;
  score: number;
}

interface Props {
  recommendations: NBAResult[];
}

const ACTION_ICONS = {
  task: '📋',
  research: '🔍',
  audit: '📊',
  outreach: '✉️',
  review: '👁️',
} as const;

const PRIORITY_VARIANTS: Record<string, 'destructive' | 'secondary' | 'outline'> = {
  High: 'destructive',
  Medium: 'secondary',
  Low: 'outline',
};

export function NextBestActionsList({ recommendations }: Props) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? recommendations : recommendations.slice(0, 3);

  if (recommendations.length === 0) {
    return (
      <div className="bg-card p-6 rounded-xl border border-border">
        <div className="flex items-center gap-2 text-label-12 text-muted-foreground uppercase mb-3">
          <Lightbulb className="w-3.5 h-3.5" />
          <span>Recommended Next Actions</span>
        </div>
        <p className="text-copy-14 text-muted-foreground">
          No recommendations — all signals are clear or the lead is in a terminal stage.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card p-6 rounded-xl border border-border space-y-3">
      <div className="flex items-center gap-2 text-label-12 text-muted-foreground uppercase">
        <Lightbulb className="w-3.5 h-3.5" />
        <span>Recommended Next Actions</span>
        <span className="ml-auto text-label-12">{recommendations.length} signals</span>
      </div>

      <div className="space-y-2">
        {displayed.map((r, i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/60 transition-colors"
          >
            <span className="text-base mt-0.5">{ACTION_ICONS[r.type]}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-copy-14 font-semibold text-foreground">{r.action}</span>
                <Badge variant={PRIORITY_VARIANTS[r.priority]} className="uppercase">
                  {r.priority}
                </Badge>
              </div>
              <p className="text-copy-13 text-muted-foreground mt-0.5">{r.rationale}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-label-12 text-muted-foreground">{r.score}</span>
              {r.link && (
                <Link href={r.link}>
                  <Button variant="ghost" size="icon-xs">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {recommendations.length > 3 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-label-12"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? 'Show fewer' : `Show all ${recommendations.length} recommendations`}
        </Button>
      )}
    </div>
  );
}
```

### 5g. Wireframe: NBA rules settings UI

**New file: `src/components/settings/NbaRulesEditor.tsx`**

Layout:
```
┌─ Pipeline Settings ──────────────────────────────────────────┐
│                                                                │
│  ┌─ Next-Best-Action Signals ───────────────────────────────┐ │
│  │                                                           │ │
│  │  Configure which signals influence next-action             │ │
│  │  recommendations. Higher weight = more influence.          │ │
│  │                                                           │ │
│  │  Overdue task          [████████████████████] 100  ────   │ │
│  │  Future task           [████████████        ]  80   ────   │ │
│  │  Stale lead            [██████████          ]  60   ────   │ │
│  │  Unsent draft          [█████████████       ]  70   ────   │ │
│  │  No research           [████████            ]  50   ────   │ │
│  │  No audit              [███████             ]  40   ────   │ │
│  │  Unread lead           [█████               ]  30   ────   │ │
│  │                                                           │ │
│  │  [Save Changes]                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

Each row in the slider uses:
```tsx
<div className="flex items-center gap-4 py-2 group">
  <span className="text-copy-14 w-32">{label}</span>
  <input
    type="range"
    min="0" max="100" step="5"
    value={rule.weight}
    onChange={(e) => setWeight(rule.signal, Number(e.target.value))}
    className="flex-1"
  />
  <span className="text-label-14 w-10 text-right font-semibold">{rule.weight}</span>
  <button
    onClick={() => resetWeight(rule.signal)}
    className="opacity-0 group-hover:opacity-100 transition-opacity text-label-12 text-muted-foreground hover:text-foreground"
  >
    Reset
  </button>
</div>
```

Server action:
```typescript
// src/app/actions/pipeline.ts
export async function updateNbaRulesAction(prevState: ActionState, formData: FormData) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const rulesJson = formData.get('nbaRules') as string;
  let rules: NBARule[];
  try {
    rules = JSON.parse(rulesJson);
  } catch {
    return { error: 'Invalid rules format' };
  }

  const db = getDb();
  // Upsert into pipeline_config
  await db
    .insert(pipelineConfig)
    .values({ id: 'global', nbaRules: rulesJson, updatedAt: new Date() })
    .onConflictDoUpdate({ target: pipelineConfig.id, set: { nbaRules: rulesJson, updatedAt: new Date() } });

  revalidatePath('/settings/pipeline');
  revalidatePath('/');
  return { success: true };
}
```

### 5h. Complete NBA integration in leads list (`leads/page.tsx`)

Current next-action display (lines 237–255) is server-side logic that checks `overdueTasks`, `openTasks`, `isStale`. Replace with a call to `getNextBestActions`:

In the server component data enrichment loop (around line 43):
```typescript
const enlargedLeads = await Promise.all(
  activeLeadsData.map(async (lead) => {
    // ...existing enrichment (stageThreshold, isStale, etc.)...
    const nbaResults = await leadService.getNextBestActions(lead.id, nbaRules);
    return { ...lead, nbaResults, nbaTop: nbaResults[0] ?? null };
  })
);
```

Then in the table rendering (lines 237–255), replace:
```tsx
{/* Next Action */}
{lead.nbaTop ? (
  <span className={`${lead.nbaTop.priority === 'High' ? 'text-destructive font-semibold' : lead.nbaTop.priority === 'Medium' ? 'text-chart-5 font-semibold' : 'text-muted-foreground'}`}>
    {lead.nbaTop.action}
  </span>
) : (
  <span className="text-muted-foreground">No next action</span>
)}
```

### 5i. Action tracking

When a user clicks an NBA recommendation (in the lead detail "Next Action" section or the NBA list component), log it:

```typescript
// In a "use client" component click handler:
async function trackNbaAction(leadId: string, actionType: string, priority: string) {
  await fetch('/api/actions/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      leadId,
      type: 'NBA action taken',
      summary: `Acted on NBA: ${actionType}`,
      metadata: { recommendationType: actionType, priority },
    }),
  });
}
```

**New API endpoint:** `POST /api/actions/log` — thin wrapper around `LoggingService.log()`. (Or reuse existing activity logging — check if `LoggingService` is accessible from client via a server action.)

Simpler: create a server action:
```typescript
// src/app/actions/tracking.ts
export async function logNbaActionAction(leadId: string, actionType: string, priority: string) {
  const userId = await getUserId();
  if (!userId) return;
  const db = getDb();
  await new LoggingService(db).log({
    leadId,
    type: 'NBA action taken',
    summary: `Acted on NBA: ${actionType}`,
    metadata: { recommendationType: actionType, priority },
  });
}
```

---

## Expanded Work Item 7 — Bulk Actions (Full UI)

### 7d. BulkSelectProvider context

**New file: `src/components/BulkSelectProvider.tsx`**

```tsx
'use client';

import { createContext, useContext, useCallback, useState } from 'react';

interface BulkSelectContextType {
  selectedIds: Set<string>;
  isSelecting: boolean;
  toggleSelect: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  toggleSelectionMode: () => void;
  selectionCount: number;
}

const BulkSelectContext = createContext<BulkSelectContextType | null>(null);

export function BulkSelectProvider({ children }: { children: React.ReactNode }) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setIsSelecting(false);
  }, []);

  const toggleSelectionMode = useCallback(() => {
    setIsSelecting(prev => !prev);
    setSelectedIds(new Set());
  }, []);

  return (
    <BulkSelectContext.Provider
      value={{
        selectedIds,
        isSelecting,
        toggleSelect,
        selectAll,
        clearSelection,
        toggleSelectionMode,
        selectionCount: selectedIds.size,
      }}
    >
      {children}
    </BulkSelectContext.Provider>
  );
}

export function useBulkSelect() {
  const ctx = useContext(BulkSelectContext);
  if (!ctx) throw new Error('useBulkSelect must be used within BulkSelectProvider');
  return ctx;
}

export function LeadCheckbox({ leadId }: { leadId: string }) {
  const { isSelecting, selectedIds, toggleSelect } = useBulkSelect();
  if (!isSelecting) return null;
  return (
    <input
      type="checkbox"
      checked={selectedIds.has(leadId)}
      onChange={() => toggleSelect(leadId)}
      className="h-4 w-4 rounded border-input text-primary focus:ring-primary cursor-pointer"
    />
  );
}
```

### 7e. BulkActionBar component

**New file: `src/components/BulkActionBar.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useBulkSelect } from './BulkSelectProvider';
import { bulkAdvanceStageAction, bulkAddTaskAction, bulkSetReminderAction } from '@/app/actions/bulk';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ArrowRight, Plus, Bell, X } from 'lucide-react';

type DialogType = 'task' | 'reminder' | null;

export function BulkActionBar() {
  const { selectedIds, selectionCount, clearSelection } = useBulkSelect();
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (selectionCount === 0) return null;

  const ids = Array.from(selectedIds);

  const handleAdvance = async () => {
    setIsLoading(true);
    try {
      const result = await bulkAdvanceStageAction(ids);
      toast.success(`Advanced ${result.advanced} lead${result.advanced !== 1 ? 's' : ''}${result.skipped > 0 ? `. ${result.skipped} skipped (terminal stage).` : ''}`);
      clearSelection();
    } catch {
      toast.error('Failed to advance leads');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-xl shadow-lg px-5 py-3 flex items-center gap-4 animate-fade-in">
        <span className="text-label-14 text-foreground font-semibold whitespace-nowrap">
          {selectionCount} selected
        </span>

        <div className="flex items-center gap-2 border-l border-border/50 pl-4">
          <Button
            variant="default"
            size="sm"
            onClick={handleAdvance}
            disabled={isLoading}
          >
            <ArrowRight className="w-3.5 h-3.5 mr-1" />
            Advance
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveDialog('task')}
            disabled={isLoading}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Task
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveDialog('reminder')}
            disabled={isLoading}
          >
            <Bell className="w-3.5 h-3.5 mr-1" />
            Remind
          </Button>
        </div>

        <button
          onClick={clearSelection}
          className="text-muted-foreground hover:text-foreground transition-colors ml-2"
          disabled={isLoading}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Bulk Add Task Dialog */}
      <Dialog open={activeDialog === 'task'} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add task to {selectionCount} lead{selectionCount !== 1 ? 's' : ''}</DialogTitle>
            <DialogDescription>
              A task will be created for each selected lead with the same title, due date, and priority.
            </DialogDescription>
          </DialogHeader>
          <BulkTaskForm
            leadIds={ids}
            onSuccess={() => { setActiveDialog(null); clearSelection(); }}
          />
        </DialogContent>
      </Dialog>

      {/* Bulk Set Reminder Dialog */}
      <Dialog open={activeDialog === 'reminder'} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set reminder for {selectionCount} lead{selectionCount !== 1 ? 's' : ''}</DialogTitle>
            <DialogDescription>
              A reminder notification will be created for each selected lead.
            </DialogDescription>
          </DialogHeader>
          <BulkReminderForm
            leadIds={ids}
            onSuccess={() => { setActiveDialog(null); clearSelection(); }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
```

### 7f. Bulk form components

```tsx
// BulkTaskForm embedded in BulkActionBar file or separate
function BulkTaskForm({ leadIds, onSuccess }: { leadIds: string[]; onSuccess: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('Medium');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setIsSubmitting(true);
    try {
      const result = await bulkAddTaskAction(leadIds, title.trim(), dueDate || null, priority);
      toast.success(`Task added to ${result.created} lead${result.created !== 1 ? 's' : ''}.`);
      onSuccess();
    } catch {
      toast.error('Failed to add tasks');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* title input, dueDate input, priority dropdown */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onSuccess}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting || !title.trim()}>Add Tasks</Button>
      </div>
    </form>
  );
}
```

### 7g. Wiring in leads page

In `src/app/(dashboard)/leads/page.tsx`, wrap the entire page content:

```tsx
import { BulkSelectProvider, LeadCheckbox } from '@/components/BulkSelectProvider';
import { BulkActionBar } from '@/components/BulkActionBar';

export default async function LeadsPage({ searchParams }) {
  // ... existing data fetching ...

  return (
    <BulkSelectProvider>
      <div className="space-y-8 animate-fade-in text-left">
        {/* ... existing header, filters, table ... */}
        {/* In each table row, add <LeadCheckbox leadId={lead.id} /> before the stage/name */}
        {/* Or wrapped by CampaignFilter component */}
      </div>
      <BulkActionBar />
    </BulkSelectProvider>
  );
}
```

For the checkbox column in the table header, add a "Select" toggle button:
```tsx
<Button
  size="icon-xs"
  variant="ghost"
  onClick={() => toggleSelectionMode()}
  title="Toggle selection mode"
>
  <CheckSquare className="w-4 h-4" />
</Button>
```

---

## Work Item 8 — Dashboard Redesign for Pipeline Discipline

**Problem:** The dashboard currently shows simple counts (overdue tasks, needs research, etc.) and a pipeline distribution chart — but doesn't surface the *disciplinary* signals: aging leads, stale-by-stage drilldown, or NBA-driven actions.

**Goal:** Redesign the dashboard right column (and expand the left feed) to make pipeline discipline the primary focus.

### 8a. New dashboard layout

Current layout (from `page.tsx`):
```
Left (lg:col-span-2):   UnifiedFeedLoader
Right (lg:col-span-1):  Pipeline Distribution card + Quick Shortcuts card
```

New layout:
```
Left (lg:col-span-2):   
  ├─ Summary Cards (existing — 5 cards, but add "Stale Leads" card)
  ├─ UnifiedFeedLoader (existing)
  └─ Stage Funnel table (from Wi4)

Right (lg:col-span-1):
  ├─ Stale Leads by Stage (NEW — compact breakdown)
  ├─ Pipeline Distribution (existing)
  └─ My Tasks (from Wi6)
  └─ Quick Shortcuts (existing)
```

### 8b. "Stale Leads by Stage" card

```tsx
{/* Stale Leads by Stage */}
<div className="bg-card p-6 rounded-xl border border-border space-y-4">
  <div>
    <h3 className="text-label-14 text-foreground uppercase border-b border-border pb-1.5 flex items-center gap-2">
      <Clock className="w-3.5 h-3.5 text-chart-5" />
      Stale Leads by Stage
    </h3>
  </div>
  {staleByStage.length > 0 ? (
    <div className="space-y-2">
      {staleByStage.map(({ stage, count, maxDays }) => (
        <Link
          key={stage}
          href={`/leads?stage=${encodeURIComponent(stage)}&filter=stale`}
          className="flex items-center justify-between p-2.5 rounded-md bg-destructive/5 hover:bg-destructive/10 border border-destructive/10 transition-colors group"
        >
          <div className="space-y-0.5">
            <span className="text-copy-14 font-medium text-foreground">{stage}</span>
            <p className="text-label-12 text-muted-foreground">Inactive {maxDays}+ days</p>
          </div>
          <span className="text-heading-lg text-destructive font-bold">{count}</span>
        </Link>
      ))}
    </div>
  ) : (
    <div className="text-center text-copy-14 text-muted-foreground py-4">
      <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-chart-2" />
      <p>No stale leads. All stages are within threshold.</p>
    </div>
  )}
</div>
```

### 8c. Data enrichment for stale-by-stage

In `src/app/(dashboard)/page.tsx`, add:

```typescript
// Aggregate stale leads by stage
const staleByStageMap = new Map<string, { count: number; maxDays: number }>();
for (const lead of leads) {
  if (lead.status !== 'Active') continue;
  const threshold = thresholds.find(t => t.stage === lead.stage)?.days ?? 5;
  const stageAgeMs = lead.stageUpdatedAt ? Date.now() - new Date(lead.stageUpdatedAt).getTime() : 0;
  const stageAgeDays = stageAgeMs / (24 * 60 * 60 * 1000);
  if (stageAgeDays > threshold) {
    const entry = staleByStageMap.get(lead.stage) || { count: 0, maxDays: 0 };
    entry.count++;
    entry.maxDays = Math.max(entry.maxDays, Math.round(stageAgeDays));
    staleByStageMap.set(lead.stage, entry);
  }
}
const staleByStage = Array.from(staleByStageMap.entries())
  .map(([stage, data]) => ({ stage, ...data }))
  .sort((a, b) => b.count - a.count);
```

### 8d. "My Tasks" card (from Wi6)

```tsx
{/* My Tasks */}
<div className="bg-card p-6 rounded-xl border border-border space-y-3">
  <h3 className="text-label-14 text-foreground uppercase border-b border-border pb-1.5 flex items-center gap-2">
    <CheckSquare className="w-3.5 h-3.5" />
    My Tasks
  </h3>
  {myTasks.length > 0 ? (
    <>
      <p className="text-heading-2xl text-foreground">{myTasks.length}</p>
      <p className="text-label-12 text-muted-foreground">
        {overdueMyTasks > 0 && (
          <span className="text-destructive font-semibold">{overdueMyTasks} overdue. </span>
        )}
        Open tasks assigned to you.
      </p>
      <Link
        href="/leads?filter=my_tasks"
        className={buttonVariants({ variant: 'outline', size: 'sm', className: 'w-full' })}
      >
        View My Tasks
      </Link>
    </>
  ) : (
    <p className="text-copy-14 text-muted-foreground py-2">No tasks assigned to you.</p>
  )}
</div>
```

### 8e. Summary cards: add "Stale Leads" card

Insert between "Outreach Ready" and "Pending Triages" cards:

```tsx
{/* Stale Leads card */}
<Link
  href="/leads?filter=stale"
  className={`group p-4 rounded-lg border transition-all flex flex-col justify-between h-28 ${
    staleLeadsCount > 0
      ? 'bg-chart-5/10 border-chart-5/30 text-chart-5 hover:bg-chart-5/15'
      : 'bg-card border-border hover:border-primary/45 hover:shadow-sm'
  }`}
>
  <div className="flex justify-between items-center">
    <span className="text-label-12 uppercase opacity-90">Stale Leads</span>
    <Clock className="w-4 h-4 opacity-70 group-hover:scale-105 transition-transform" />
  </div>
  <div>
    <h3 className="text-heading-2xl">{staleLeadsCount}</h3>
    <p className="text-label-12 opacity-80 mt-1">{staleLeadsCount === 1 ? 'Lead is' : 'Leads are'} past threshold</p>
  </div>
</Link>
```

### 8f. Files changed for Wi8

| File | Change |
|------|--------|
| `src/app/(dashboard)/page.tsx` | Add stale-by-stage aggregation, stale lead count, My Tasks count; add Stale Leads summary card, Stale By Stage card, My Tasks card; add funnel analytics card |
| No new files | All changes in existing `page.tsx` |

---

## Work Item 9 — Proactive Stale Lead Alerts

**Problem:** Stale detection is passive (static flags in the UI). The system doesn't proactively *notify* operators when a lead has been idle past its threshold. This means an operator must open the dashboard or leads list to discover staleness.

**Goal:** When a lead crosses its stale threshold, push a notification via the existing SSE system. Also, when a lead is about to become stale (80% of threshold), push a warning notification.

### 9a. Stale check service

**New method** `checkAndAlertStaleLeads` runs on a periodic timer (integrated into the SSE loop, alongside the reminder engine poll):

```typescript
// src/services/lead.ts
async checkAndAlertStaleLeads(): Promise<number> {
  const activeLeads = await this.db
    .select()
    .from(leads)
    .where(eq(leads.status, 'Active'));

  const thresholds = await this.db
    .select()
    .from(stageThresholds);

  let alertCount = 0;

  for (const lead of activeLeads) {
    if (!lead.stageUpdatedAt) continue;
    if (lead.stage === 'Won' || lead.stage === 'Lost') continue;

    const thresholdDays = thresholds.find(t => t.stage === lead.stage)?.days ?? 5;
    const ageMs = Date.now() - new Date(lead.stageUpdatedAt).getTime();
    const ageDays = ageMs / (24 * 60 * 60 * 1000);

    if (ageDays >= thresholdDays) {
      // Check if we already alerted for this staleness event (within last 24h)
      const alreadyAlerted = await this.hasRecentStaleAlert(lead.id, 24);
      if (alreadyAlerted) continue;

      await createNotification(
        this.db,
        lead.ownerId || (await this.getAnyUserId()), // fallback: notify first user
        null,
        `Lead stale: ${lead.name}`,
        `${lead.name} has been idle in "${lead.stage}" for ${Math.round(ageDays)} days (threshold: ${thresholdDays}).`,
        'ERROR',
        `/leads/${lead.id}`,
      );
      alertCount++;
    }
  }

  return alertCount;
}

private async hasRecentStaleAlert(leadId: string, withinHours: number): Promise<boolean> {
  const cutoff = new Date(Date.now() - withinHours * 60 * 60 * 1000);
  const [row] = await this.db
    .select({ count: count() })
    .from(notifications)
    .where(and(
      eq(notifications.jobRunId, null),
      like(notifications.title, `Lead stale: %`),
      gte(notifications.createdAt, cutoff),
    ));
  return (row?.count ?? 0) > 0;
}
```

### 9b. Integration into SSE loop

In `src/app/api/notifications/sse/route.ts`, add to the existing polling loop (after `fireDueReminders`):

```typescript
// Fire stale lead alerts every 60s (not every 2s — too aggressive)
let lastStaleCheck = 0;
const STALE_CHECK_INTERVAL = 60_000; // 60 seconds

// Inside the polling loop:
const now = Date.now();
if (now - lastStaleCheck > STALE_CHECK_INTERVAL) {
  try {
    const leadService = new LeadService(db);
    const alerted = await leadService.checkAndAlertStaleLeads();
    if (alerted > 0) {
      console.log(`Stale alert: ${alerted} lead(s) triggered alerts`);
    }
  } catch (e) {
    console.error('Stale alert check failed:', e);
  }
  lastStaleCheck = now;
}
```

### 9c. Stale warning (80% of threshold)

Same loop — when `ageDays >= thresholdDays * 0.8` but `ageDays < thresholdDays`, send an `INFO` notification instead of `ERROR`:

```typescript
if (ageDays >= thresholdDays * 0.8 && ageDays < thresholdDays) {
  // Warning: approaching stale
  const alreadyWarned = await this.hasRecentStaleAlert(lead.id, 48); // 48h cooldown
  if (alreadyWarned) continue;

  await createNotification(
    this.db, lead.ownerId || fallbackUserId, null,
    `Lead aging: ${lead.name}`,
    `${lead.name} has been in "${lead.stage}" for ${Math.round(ageDays)} days (${Math.round((ageDays / thresholdDays) * 100)}% of threshold).`,
    'INFO',
    `/leads/${lead.id}`,
  );
}
```

### 9d. Files changed for Wi9

| File | Change |
|------|--------|
| `src/services/lead.ts` | Add `checkAndAlertStaleLeads`, `hasRecentStaleAlert` |
| `src/app/api/notifications/sse/route.ts` | Add stale check every 60s in polling loop |

---

## Work Item 10 — Stage Aging & Lead Detail Improvements

**Problem:** The lead detail page shows the current stage but does not show how long the lead has been in that stage, whether it's aging toward stale, or what the next expected action deadline is.

**Goal:** Add a stage aging indicator to the lead detail overview, showing days-in-stage, progress toward stale threshold, and expected action deadline.

### 10a. Wireframe: Lead detail overview — stage aging section

Current layout after Wi5 (NBA section):
```
┌─ Next Action ────────────────────────────────────────┐
│ Next action: Review evidence and prepare outreach     │
│ [Open outreach]                                       │
└──────────────────────────────────────────────────────┘

┌─ Stage Progress ─────────────────────────────────────┐
│                                                       │
│  Outreach Sent  ●━━━━━━━━━━━━━━━━━━━━━━●  Meeting    │
│                 ●━━━━━━━━━━━━━━━━━━●●──              │
│                 ▲ you are here      ▲ 3d threshold    │
│                                                       │
│  In stage: 5 days  ▲  (71% of 7d threshold)          │
│  Auto follow-up: Follow up on outreach — Due in 2d    │
│  If no movement by: Fri, Jun 26                        │
│                                                       │
└──────────────────────────────────────────────────────┘
```

### 10b. Aging bar component

**New file: `src/components/lead/StageAgingBar.tsx`**

```tsx
'use client';

interface Props {
  stage: string;
  stageUpdatedAt: Date | null;
  daysThreshold: number;
  autoFollowUpDue?: Date | null;
}

export function StageAgingBar({ stage, stageUpdatedAt, daysThreshold, autoFollowUpDue }: Props) {
  if (!stageUpdatedAt) return null;

  const ageMs = Date.now() - new Date(stageUpdatedAt).getTime();
  const ageDays = Math.round(ageMs / (24 * 60 * 60 * 1000) * 10) / 10;
  const progress = Math.min(ageDays / daysThreshold, 1); // 0–1, cap at 1 (100%)
  const percent = Math.round(progress * 100);

  const isStale = ageDays >= daysThreshold;
  const isWarning = ageDays >= daysThreshold * 0.8 && !isStale;

  const barColor = isStale
    ? 'bg-destructive'
    : isWarning
    ? 'bg-chart-5'
    : 'bg-primary/60';

  // Expected exit date (when threshold will be reached)
  const remainingDays = Math.max(0, daysThreshold - ageDays);
  const expectedExit = new Date(Date.now() + remainingDays * 24 * 60 * 60 * 1000);

  return (
    <div className="bg-card p-5 rounded-xl border border-border space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-label-14 text-foreground uppercase">Stage Progress</h3>
        <span className={`text-label-12 font-semibold ${
          isStale ? 'text-destructive' : isWarning ? 'text-chart-5' : 'text-muted-foreground'
        }`}>
          {isStale ? '⚠ Stale' : isWarning ? '⚠ Approaching limit' : 'On track'}
        </span>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-label-12 text-muted-foreground">
          <span>{stage}</span>
          <span>{daysThreshold}d threshold</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden border border-border/20">
          <div
            className={`${barColor} h-full rounded-full transition-all duration-500`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-label-12">
          <span className={isStale ? 'text-destructive font-semibold' : 'text-foreground'}>
            {ageDays}d in stage
          </span>
          <span className="text-muted-foreground">{percent}% of threshold</span>
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/50">
        <div>
          <span className="text-label-12 text-muted-foreground">Auto follow-up</span>
          <p className="text-copy-13 text-foreground mt-0.5">
            {autoFollowUpDue
              ? `Due ${autoFollowUpDue.toLocaleDateString()}`
              : 'None scheduled'}
          </p>
        </div>
        <div>
          <span className="text-label-12 text-muted-foreground">If no movement by</span>
          <p className={`text-copy-13 mt-0.5 ${isStale ? 'text-destructive font-semibold' : 'text-foreground'}`}>
            {expectedExit.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  );
}
```

### 10c. Integration in LeadDetailsWorkspace.tsx

In the overview section (around line 424, the grid layout), add the StageAgingBar as a right-column card alongside the Next Action section:

```tsx
<main>
  {activeView === 'overview' ? (
    <div className="grid gap-6 lg:gap-8 xl:grid-cols-12">
      {/* Main Column (8 spans) — existing */}
      <div className="space-y-6 xl:col-span-8">
        {/* 1. Next Action — existing */}
        <section>...</section>
        {/* 2. Lead Summary — existing */}
        {/* 3. Open Tasks — existing */}
        {/* 4. Recent Activity — existing */}
      </div>

      {/* Sidebar Column (4 spans) — NEW: aging + NBA */}
      <aside className="space-y-6 xl:col-span-4">
        <StageAgingBar
          stage={lead.stage}
          stageUpdatedAt={lead.stageUpdatedAt}
          daysThreshold={stageThreshold}
          autoFollowUpDue={nextFollowUp?.dueDate}
        />
        <NextBestActionsList recommendations={nbaResults} />
      </aside>
    </div>
  ) : null}
</main>
```

### 10d. Data for aging bar

In the lead detail server component, fetch:
```typescript
const stageThreshold = (await db.select()
  .from(stageThresholds)
  .where(eq(stageThresholds.stage, lead.stage))
  .limit(1))[0]?.days ?? 5;

const nextFollowUp = (await db.select()
  .from(tasks)
  .where(and(
    eq(tasks.leadId, lead.id),
    eq(tasks.status, 'Open'),
    like(tasks.title, 'Follow up on %'),
  ))
  .orderBy(asc(tasks.dueDate))
  .limit(1))[0] ?? null;

const nbaRules = ... // from pipeline_config
const nbaResults = await leadService.getNextBestActions(lead.id, nbaRules);
```

### 10e. Files changed for Wi10

| File | Change |
|------|--------|
| `src/components/lead/StageAgingBar.tsx` | **New** — aging bar component |
| `src/app/(dashboard)/leads/[id]/LeadDetailsWorkspace.tsx` | Add StageAgingBar + NextBestActionsList to overview sidebar |
| `src/app/(dashboard)/leads/[id]/page.tsx` | Fetch `stageThreshold`, `nextFollowUp`, `nbaResults` for passing to workspace |

---

## Complete Migration SQL

When all work items are implemented, run a single combined migration (or 3 separate migrations for traceability):

```sql
-- 037a: pipeline_config table
CREATE TABLE pipeline_config (
  id text PRIMARY KEY DEFAULT 'global',
  enforce_stage_order integer NOT NULL DEFAULT 0,
  nba_rules text,  -- JSON string of NBARule[]
  updated_at integer
);

-- 037b: reminders table
CREATE TABLE reminders (
  id text PRIMARY KEY,
  lead_id text REFERENCES leads(id),
  user_id text NOT NULL REFERENCES users(id),
  title text NOT NULL,
  message text,
  remind_at integer NOT NULL,
  is_fired integer NOT NULL DEFAULT 0,
  created_at integer DEFAULT (strftime('%s', 'now')),
  link text,
  FOREIGN KEY (lead_id) REFERENCES leads(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Index for reminder polling
CREATE INDEX reminders_due_fired_idx ON reminders(remind_at, is_fired);

-- 037c: tasks columns (nullable additions)
ALTER TABLE tasks ADD COLUMN assignee_id text REFERENCES users(id);
ALTER TABLE tasks ADD COLUMN category text;

-- Index for "my tasks" queries
CREATE INDEX tasks_assignee_status_idx ON tasks(assignee_id, status);

-- Index for stale queries on lead stage history
CREATE INDEX lead_stage_history_stage_idx ON lead_stage_history(stage);
```

---

## Complete Test Inventory

| Wi | Test file | Tests |
|----|-----------|-------|
| 1 | `lead.integration.test.ts` | autoScheduleFollowUp creates 7d task; respects existing; idempotent re-entry; 3d meeting; skips Won/Lost |
| 2 | `lead.integration.test.ts` | forward move no confirm; backward move confirm; cancel keeps stage; enforce-order blocks skip; enforce-order allows valid |
| 3 | `reminders.integration.test.ts` | create with future date not fired; fireDueReminders creates notification; immediate fire for past date; empty state |
| 4 | `lead.integration.test.ts` | funnel counts match history; stuck lead shows dropped; stage re-entry counted correctly |
| 5 | `nba.integration.test.ts` | overdue task signal returns 0.33/0.67/1.0; stale signal intensity scales; no research returns 1.0; Won/Lost returns empty; all weights 0 returns empty |
| 6 | `lead.integration.test.ts` | createTask saves assigneeId; getMyTasks filters by user; category persists |
| 7 | `bulk.integration.test.ts` | bulkAdvanceStage advances each to next; terminal stages skipped; partial results returned; bulkAddTask creates per lead |
| 8 | manual | dashboard shows stale-by-stage; My Tasks card; funnel analytics table |
| 9 | `lead.integration.test.ts` | `checkAndAlertStaleLeads` creates notification for stale lead; does not duplicate within 24h; warning at 80% |
| 10 | manual | aging bar shows correct progress; expected exit date is accurate; stale state highlighted red |

---

## Complete Build & Verify Checklist

Before marking Stage 6 as complete:

1. [ ] `npm run build` — clean compile
2. [ ] `npm test` — all 94+ existing tests pass + 20+ new tests pass
3. [ ] Manual: Create lead → move to Outreach Sent → verify 7d follow-up task
4. [ ] Manual: Try backward stage move → confirmation dialog appears
5. [ ] Manual: Open dashboard → see stale-by-stage card, funnel table, My Tasks
6. [ ] Manual: Set a reminder → wait for SSE notification (or simulate past date)
7. [ ] Manual: Enable enforce-order → try skipping stage → blocked
8. [ ] Manual: Select 3 leads in list → bulk advance → see toast result
9. [ ] Manual: Click NBA recommendation → verify action is tracked in activity log
10. [ ] Manual: Let a lead become stale → check notification bell for alert
11. [ ] Manual: Open lead detail → see aging bar with correct progress percentage
12. [ ] Review: All new UI uses existing design tokens (no new CSS variables)
13. [ ] Review: All new code has edge case handling (empty states, nulls, etc.)
14. [ ] Update `PLAN.md` Stage 6 exit criteria: mark as complete
