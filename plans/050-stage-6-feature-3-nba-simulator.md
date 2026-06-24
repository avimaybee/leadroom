# [050] Stage 6 Enhancement — NBA Simulator & Effectiveness Tracking

**Category:** Core Feature / Reporting & Optimization
**Effort:** M (Medium)
**Impact:** Gives operators confidence when tuning Next-Best-Action (NBA) rules by visualizing the immediate impact on their pipeline, and tracks the real-world success of NBA recommendations.

---

## Context

The NBA Engine allows operators to adjust the weights of various signals (e.g., overdue task = 100, no audit = 40) to determine lead prioritization. However, changing these weights is currently a "blind" operation. Users cannot easily see how their adjustments will reorder their active pipeline until they save and navigate back to the dashboard. Furthermore, we don't currently track if following an NBA recommendation actually results in a positive outcome (e.g., stage advancement).

## Goal

1. **Simulator:** Provide a live preview in the NBA Settings page that shows a "Before & After" view of the top recommended actions based on the draft slider weights.
2. **Effectiveness Tracking:** Track when an operator clicks/executes an NBA recommendation and correlate that with subsequent stage advancements to measure the ROI of specific signals.

---

## Design

**Simulator UI:**
- Add a "Test Rules" or "Preview Pipeline Impact" panel next to the weight sliders in `/settings/pipeline`.
- When weights change, asynchronously fetch a sample of active leads and re-score them using the draft rules, displaying a "Top 5 Recommendations" preview.

**Effectiveness Tracking:**
- When an action is taken via the NBA component (e.g., clicking the "Run digital presence audit" link), log a specific interaction metric.
- Extend `LeadService` to track "Last Acted NBA Signal" on a lead.
- If a lead advances to a positive stage (e.g., Meeting, Won) shortly after an NBA action, attribute that success to the signal.

---

## Implementation

### 1. Database Schema

Add a tracking table to `src/db/schema/core.ts`:

```typescript
export const nbaActionLogs = sqliteTable('nba_action_logs', {
  id: text('id').primaryKey(),
  leadId: text('lead_id').notNull().references(() => leads.id),
  userId: text('user_id').notNull().references(() => users.id),
  signal: text('signal').notNull(), // e.g., 'stale', 'no_audit'
  actionTakenAt: integer('action_taken_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
  resultStageTarget: text('result_stage_target'), // Populated if the lead advances stages within X days
  resultStageReachedAt: integer('result_stage_reached_at', { mode: 'timestamp' }),
});
```

### 2. Service Layer Updates

**Simulation Method:**
Add a method to `LeadService` to preview rules without persisting them:

```typescript
async simulateNBARules(draftRules: NBARule[], limit = 5): Promise<NBAResult[]> {
  // Fetch top active leads
  const activeLeads = await this.db.select().from(leads).where(eq(leads.status, 'Active')).limit(50);
  
  let allResults: (NBAResult & { leadName: string })[] = [];
  
  // Score leads using draftRules
  for (const lead of activeLeads) {
    const actions = await this.getNextBestActions(lead.id, draftRules);
    if (actions.length > 0) {
      allResults.push({ ...actions[0], leadName: lead.name });
    }
  }

  // Sort by highest score globally
  allResults.sort((a, b) => b.score - a.score);
  return allResults.slice(0, limit);
}
```

**Action Logging Method:**
```typescript
async logNBAAction(leadId: string, signal: string, userId: string) {
  await this.db.insert(nbaActionLogs).values({
    id: crypto.randomUUID(),
    leadId,
    userId,
    signal
  });
}
```

*Update `LeadService.updateStage` to retroactively update `resultStageTarget` on the most recent `nbaActionLogs` entry for that lead if the transition is a positive forward movement.*

### 3. Frontend Integration

**Simulator UI:**
In `src/components/settings/NbaRulesEditor.tsx`:
- Add a debounced `useEffect` that calls a Server Action `simulateNBARulesAction(draftRules)`.
- Render the `NBAResult[]` in a simple list view ("Preview: Top Pipeline Actions").

**Action Tracking UI:**
In `src/components/lead/NextBestActionsList.tsx`:
- Modify the link click handler to fire a server action (`trackNBAActionAction(leadId, signal)`) before navigating to the target tab/page.

---

## Edge Cases

- **Simulator Performance:** The simulator must only score a small subset of leads (e.g., top 50 active leads) to avoid slow API responses during slider manipulation.
- **Attribution Window:** How long after an NBA action is a stage change attributed to it? Recommend a 14-day window. If a lead advances 6 months later, it shouldn't be attributed to that specific "no_audit" prompt.

---

## Verification

1. **Simulation:** Go to settings, move a slider (e.g., 'no_research' to 100), and verify the preview panel updates immediately to show research-related tasks at the top.
2. **Tracking:** Click an NBA link on a lead detail page. Verify a row is inserted into `nba_action_logs`. Advance the lead's stage and verify the `resultStageTarget` column is updated.
