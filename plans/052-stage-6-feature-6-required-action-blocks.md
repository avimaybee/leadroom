# [052] Stage 6 Enhancement — Required Action Blocks (Hard Guardrails)

**Category:** Core Feature / Data Integrity
**Effort:** M (Medium)
**Impact:** Enforces strict operational minimums so that un-researched or un-audited leads cannot pollute the bottom of the funnel.

---

## Context

In Stage 6, we implemented "Transition Guardrails" which optionally enforce that a lead must pass through intermediate stages sequentially, and warns users when moving a lead backwards. However, simply entering a stage doesn't mean the required *work* was done. An operator could move a lead to "Ready to Send" without ever generating a research snapshot or an outreach draft. This compromises the integrity of the pipeline.

## Goal

Expand pipeline configuration to allow *Required Artifacts* (Hard Guardrails) before a stage transition is permitted.

---

## Design

**Configuration:**
Extend the existing `pipeline_config` to define requirements for entering specific stages.
For example:
- Entering `Auditing` requires: `has_research_snapshot: true`
- Entering `Ready to Send` requires: `has_outreach_draft: true`
- Entering `Meeting` requires: `has_contact_info: true`

**Enforcement:**
When `LeadService.updateStage` or a Bulk Action attempts to transition a lead to a protected stage, the system verifies the conditions. If conditions are not met, the transition is blocked, and an explicit error is returned to the UI.

**UI Feedback:**
If a transition is blocked, the frontend displays a clear validation error (e.g., "Cannot move to 'Ready to Send': This lead requires an Outreach Draft first.") rather than a generic server error.

---

## Implementation

### 1. Database Schema

Extend the `pipeline_config` table (introduced in Wi2) to store stage requirements.

```typescript
// Add to src/db/schema/core.ts in pipeline_config:
stageRequirements: text('stage_requirements', { mode: 'json' }).$type<Record<string, string[]>>().default({}),
```

*Example structure for `stageRequirements`:*
```json
{
  "Auditing": ["require_research"],
  "Ready to Send": ["require_draft"],
  "Outreach Sent": ["require_contact_email"]
}
```

### 2. Service Layer Updates

Add requirement verification logic to `LeadService.ts`:

```typescript
private async verifyStageRequirements(leadId: string, targetStage: string): Promise<string | null> {
  const [config] = await this.db.select().from(pipelineConfig).limit(1);
  const requirements = config?.stageRequirements?.[targetStage];
  
  if (!requirements || requirements.length === 0) return null; // No requirements

  for (const req of requirements) {
    if (req === 'require_research') {
      const [res] = await this.db.select({ count: count() }).from(researchSnapshots).where(eq(researchSnapshots.leadId, leadId));
      if (res.count === 0) return 'A Research Snapshot is required to enter this stage.';
    }
    if (req === 'require_draft') {
      const [res] = await this.db.select({ count: count() }).from(outreachDrafts).where(eq(outreachDrafts.leadId, leadId));
      if (res.count === 0) return 'An Outreach Draft is required to enter this stage.';
    }
    if (req === 'require_contact_email') {
      // Assuming contact structure exists, or checking lead fields directly
      const lead = await this.getLead(leadId);
      if (!lead?.email) return 'An email address is required to enter this stage.';
    }
  }

  return null; // All good
}
```

Modify `updateStage(leadId, newStage)`:
```typescript
const errorMessage = await this.verifyStageRequirements(leadId, newStage);
if (errorMessage) {
  throw new Error(`Stage Transition Blocked: ${errorMessage}`);
}
```

### 3. Frontend Integration

**Stage Dropdown (Lead Details):**
- Catch the specific error thrown by `updateStage` and display it in a red Sonner toast or an inline Alert component below the dropdown.
- Revert the dropdown selection to the original stage on failure.

**Bulk Action Bar:**
- `bulkAdvanceStageAction` should gracefully catch these specific errors and categorize them in the results.
- Toast output: "Advanced 2 leads. Skipped 3 leads due to missing requirements (e.g., missing Research Snapshot)."

**Settings UI:**
In `/settings/pipeline`, add a section for "Stage Requirements".
- Dropdowns for each stage to select optional required blockers.

---

## Edge Cases

- **Retroactive Requirements:** If requirements change, leads *already* in that stage are not kicked out. The check only occurs upon *entry*.
- **Admin Overrides:** Should Admins be able to bypass? For simplicity in an internal-first tool, no. The rules apply to everyone. If a bypass is needed, the requirement must be temporarily disabled in settings.

---

## Verification

1. **Service Tests:** 
   - Attempt to move a blank lead to a stage requiring a draft. Assert error is thrown.
   - Attach a draft to the lead and attempt the move again. Assert success.
2. **Bulk Actions Test:**
   - Select multiple leads (some with drafts, some without). Bulk advance to a protected stage. Assert only the compliant leads transition.
3. **UI Test:** Manually change the stage dropdown on the frontend for an unqualified lead and observe the resulting toast/error message.
