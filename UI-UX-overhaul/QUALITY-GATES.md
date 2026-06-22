# Lead Detail Quality Gates

## Verification commands

The repository has no dedicated `typecheck` script and its `lint` script uses `next lint`, which is not a reliable Next.js 16 gate. Executors use:

| Gate | Command | Expected result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | exit 0, no errors |
| Lead/outreach services | `node --import tsx --test src/db/__tests__/lead.integration.test.ts src/db/__tests__/outreach.integration.test.ts src/db/__tests__/outreach.actions.test.ts` | all tests pass |
| Full test suite | `npm test` | all tests pass, or pre-existing failures documented before code changes |
| Production build | `npm run build` | exit 0 |

Add a real browser-level test harness only if the repository already accepts that dependency or the operator separately approves it. Until then, perform the manual matrix below and attach screenshots to the implementation report.

## Viewport matrix

- 320×800: no horizontal page scroll; no covered actions; navigation usable.
- 375×812: forms, sheets, and dialogs fit and scroll internally only when they are overlays.
- 768×1024: content becomes one column without narrow editor/sidebar pairing.
- 1280×800: page uses available width without clipping.
- 1440×900 and 1920×1080: content remains centered/readable and does not stretch prose excessively.
- Browser zoom 200% at 1280 px: reflow works without two-dimensional scrolling except version comparison where a controlled region is justified.

## Data matrix

- Very long lead name, website URL, email, task title, note, and outreach draft.
- Missing website/contact/location/industry/research/audit/score.
- 0 and many contacts, tasks, activities, and drafts.
- Draft statuses: Draft, Approved, Rejected, Sent.
- Research job: idle, queued, running, failed, cancelled, completed.
- Network/server mutation failure with retry.

## Accessibility gates

- One `h1`, logical heading sequence, semantic landmarks, and a main-content skip path at app level.
- All icon-only buttons have accessible names; decorative icons are hidden from assistive technology.
- Every form control has a visible label except controls whose accessible name is unambiguous in a recognized composite widget.
- Keyboard-only operation covers tabs, channel switcher, menus, dialogs/sheets, editor actions, filters, and confirmations.
- Focus moves into overlays, is trapped appropriately, returns to the trigger, and never disappears behind sticky UI.
- Visible `:focus-visible` treatment; no outline removal without replacement.
- Async save/generate/research/note status uses `aria-live="polite"`; critical errors use suitable alert semantics.
- Color is never the only status cue.
- Interactive target size aims for 44×44 px; no target is below WCAG 2.2’s 24×24 CSS px minimum without a valid exception.
- Text and UI contrast meet WCAG AA.
- Motion respects `prefers-reduced-motion`; remove the pulsing “System Live”/research decoration from this page’s critical workflow if it distracts or lacks a reduced variant.

## Interaction gates

- Exactly one page scrollbar in normal lead-detail use.
- No `max-h-[calc(100vh...)] overflow-y-auto` rail and no `max-h-[420px]` activity list.
- No card nested directly inside an equivalent card for ordinary sections.
- At most one primary button per local decision point.
- Destructive actions confirm or provide undo.
- Unsaved outreach edits cannot be silently lost or overwritten by refreshed props.
- Tabs and outreach channel state survive reload and browser back/forward.
- Stage is displayed and changed in one place.
- Approval explicitly states it does not send.

## Visual gates

- Body text defaults to at least 14 px; metadata may be 12 px; avoid 9–10 px operational copy.
- Prose measure is approximately 60–80 characters where possible.
- Spacing follows a consistent 4/8 px scale; section gaps are larger than internal control gaps.
- Borders and elevation communicate hierarchy; they are not applied to every nested group.
- Primary, secondary, tertiary, destructive, and disabled actions are visually distinct and consistent.
- Empty states are compact, contextual, and contain no duplicate CTA.
- Screenshots at every matrix width are compared for clipping, abrupt cutoff, nested scrollbars, and action hierarchy.

## Reference standards

- Nielsen Norman Group, 10 Usability Heuristics: https://www.nngroup.com/articles/ten-usability-heuristics/
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- WAI-ARIA Authoring Practices: https://www.w3.org/WAI/ARIA/apg/
- Vercel Web Interface Guidelines reviewed 2026-06-22: https://github.com/vercel-labs/web-interface-guidelines

