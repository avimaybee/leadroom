# Plan 025: Mock outbound network requests in test suites

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 168c15f..HEAD -- src/lib/scraper.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `168c15f`, 2026-06-16

## Why this matters

The test suite takes over 30 seconds to run because it triggers asynchronous simulations of research workflows that execute real outbound HTTP calls to websites (e.g. `stripe.com`, `example.com`, `austinsmiles.com`) using Jina Reader or direct fetch. This creates dynamic dependency on external servers, runs risk of rate limits (e.g., getting 429s from Jina/Browser Run), makes testing slow, and breaks when working offline. Mocking these fetches will make the tests faster, offline-friendly, and completely deterministic.

## Current state

- The scraper code is defined in `src/lib/scraper.ts`.
- The fetching helpers:
  - `fetchDirectly` (uses `fetch`)
  - `fetchSiteContentViaJina` (uses `fetch`)
  - `scrapeWithBrowserRun` (uses `browserBinding.quickAction("snapshot")`)

Exemplar of test run showing outbound requests:
```
Attempting Fetch-First direct fetch for https://austinsmiles.com
Browser Run binding not found. Using Jina Reader for https://austinsmiles.com
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests   | `npm run test` | all pass, faster execution |

## Scope

**In scope**:
- `src/lib/scraper.ts`
- `src/lib/__tests__/scraper.test.ts` (if needed, to adapt test assertions to mock data)

**Out of scope**:
- Changing the Jina API payload logic outside of test checks.

## Steps

### Step 1: Add a test environment override inside scraper.ts
Modify `fetchDirectly` and `fetchSiteContentViaJina` in `src/lib/scraper.ts` to return mock HTML/content if `process.env.NODE_ENV === 'test'` and we are targetting external domains.

For example, mock content mapping:
- `https://stripe.com` -> returning a mock HTML page with Stripe-related text.
- `https://austinsmiles.com` -> returning mock HTML for Austin Smiles.
- `https://example.com` -> returning placeholder static HTML.

### Step 2: Validate mock responses in tests
Ensure that `npm run test` still passes successfully and that no live outbound socket connections are initiated for these domains during the test runs.

## Done criteria

- [ ] All outbound fetching logic checks `NODE_ENV === 'test'` and returns static mock results for test hosts.
- [ ] No real HTTP fetches are made during standard test execution.
- [ ] The overall execution duration of `npm run test` drops (target: <10 seconds).
