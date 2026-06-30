# Plan 063: Phase 6 BYOK Experience Improvements

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat HEAD -- src/db/schema/core.ts src/services/integrations.ts src/app/(dashboard)/settings/integrations/actions.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/060-sec-credential-encryption.md
- **Category**: feature
- **Planned at**: 2026-06-30

## Why this matters
The BYOK (Bring Your Own Key) experience currently forces a single global "Active Provider" for all AI tasks, and lacks real-time verification of keys. We are improving this by introducing Task-Based Routing (allowing users to map cheap models to "Research" and premium models to "Drafting") and adding a "Test Connection" button to the UI to ensure inference works before background jobs are launched.

## Current state
- `providerConfigs` table in `src/db/schema/core.ts` has a single `isActive` boolean.
- `IntegrationsService` saves a single `isActive` boolean.
- `ProviderConfigForm` tests API keys by fetching the `/models` endpoint, which does not guarantee inference access or credit limits.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0, no errors   |
| DB Migration | `npx drizzle-kit generate && npx drizzle-kit migrate` | success |
| Tests     | `npm test`               | all pass            |

## Scope

**In scope**:
- Database schema changes to `providerConfigs` (replacing `isActive` with `isResearchActive`, `isScoringActive`, `isDraftingActive`).
- `src/services/integrations.ts` methods.
- UI components `ProviderConfigForm.tsx` and `ActiveProviderPicker.tsx` (to be repurposed as Task Router).
- Updates to backend services (`src/services/research-workflow.ts`, `src/services/outreach.ts`) to request specific task types.

**Out of scope**:
- Automatic failover. If a selected provider fails, the task should still fail gracefully and log the error.

## Git workflow
- Branch: `feature/063-byok-experience-routing`
- Commit per step. Message format: `feat: add task-based routing to provider configs`

## Steps

### Step 1: Update the Schema
Modify `src/db/schema/core.ts`:
- In `providerConfigs`, remove `isActive: integer('is_active', { mode: 'boolean' }).default(true)`.
- Add:
  ```ts
  isResearchActive: integer('is_research_active', { mode: 'boolean' }).default(false),
  isScoringActive: integer('is_scoring_active', { mode: 'boolean' }).default(false),
  isDraftingActive: integer('is_drafting_active', { mode: 'boolean' }).default(false),
  ```
- Run `npx drizzle-kit generate` to create the migration.
- Run `npx drizzle-kit migrate` to apply it.
**Verify**: Migration applies cleanly.

### Step 2: Update IntegrationsService
Modify `src/services/integrations.ts`:
- Update `saveProviderConfig` to accept an object containing `{ isResearchActive?: boolean; isScoringActive?: boolean; isDraftingActive?: boolean }` instead of a single `isActive` boolean.
- Create `getActiveProviderForTask(taskType: 'research' | 'scoring' | 'drafting')` which queries the DB for the first config where the corresponding flag is true.
**Verify**: `npx tsc --noEmit` shows errors where the old `saveProviderConfig` is called; we will fix them in the next steps.

### Step 3: Implement Task-Based Routing Actions
Modify `src/app/(dashboard)/settings/integrations/actions.ts`:
- Update `saveIntegrationConfigAction` to only save the key/model, leaving routing flags unmodified (or defaulting to false for new keys).
- Replace `setActiveProviderAndModelAction` with `setActiveProviderForTaskAction(provider: string, taskType: 'research' | 'scoring' | 'drafting')`:
  - Fetch all configs. Set the requested `taskType` flag to false for all configs.
  - Set the requested `taskType` flag to true for the selected provider.
- Implement `testIntegrationConnectionAction(provider: string, apiKey: string, modelName: string)`:
  - Import the appropriate `callX` function from `src/lib/ai.ts` or directly make a fetch call with a 1-token prompt (e.g., "Respond with exactly the word OK.").
  - Return `{ success: true }` or `{ error: string }`.
**Verify**: `npx tsc --noEmit` has fewer errors.

### Step 4: Build Task-Based Routing UI
Modify `src/components/settings/ActiveProviderPicker.tsx`:
- Change the UI to present three dropdowns for:
  - "Research Engine"
  - "Scoring Engine"
  - "Drafting Engine"
- Each dropdown should list all configured providers. Selecting an option triggers `setActiveProviderForTaskAction` immediately or via a unified "Save Routing" button.
**Verify**: Ensure no compilation errors.

### Step 5: Enhance ProviderConfigForm
Modify `src/components/settings/ProviderConfigForm.tsx`:
- Next to the "Fetch Models" button or below the API key, add a "Test Connection" button.
- On click, call `testIntegrationConnectionAction`. Show a success toast/badge or display the error message.
- Remove the "Set as active provider for AI tasks" checkbox, as routing is now handled by the ActiveProviderPicker.
- Add direct onboarding URLs (e.g., `<a href="https://console.groq.com/keys" target="_blank">Get Groq API Key</a>`) into the UI for each provider type.
**Verify**: UI compiles cleanly.

### Step 6: Wire Up Backend Services
Modify the backend services that initiate AI calls:
- `src/services/research-workflow.ts`: Replace lookups for the global active provider with `getActiveProviderForTask('research')` and `getActiveProviderForTask('scoring')`.
- `src/services/outreach.ts`: Replace lookups with `getActiveProviderForTask('drafting')`.
**Verify**: `npx tsc --noEmit` succeeds, and `npm test` passes.

## Test plan
- Run the full unit test suite `npm test`.
- Manually run a local instance: Add an invalid Groq key and click "Test Connection" -> it should fail immediately.
- Update routing settings: Map Groq to Research and Anthropic to Drafting. Trigger a test job and verify in server logs that the correct models are invoked for each phase.

## Done criteria
- [ ] Schema migrated safely.
- [ ] UI shows Task-Based Routing (3 selectors).
- [ ] UI shows "Test Connection" button.
- [ ] Background jobs use task-specific models.
- [ ] All tests pass.
- [ ] `plans/README.md` updated.

## STOP conditions
- If Drizzle migration fails due to existing data conflicts with the `boolean` defaults.
- If backend services (e.g. `lib/ai.ts`) rely heavily on a global active provider that breaks when task-types are requested.
