#!/usr/bin/env npx tsx
/**
 * SDR Smoke Test — verifies the full pivot workflow end-to-end.
 *
 * Run: npx tsx src/lib/domain/__tests__/sdr-smoke.ts
 *
 * This script tests the core deterministic domain logic (scoring, drafting,
 * learning) without requiring a database. It's the "prove it works" gate
 * before legacy code removal.
 */
import { calculateScore, applyManualOverride } from '../scoring';
import { generateDraft, checkForbiddenClaims } from '../drafting';
import { generateLearningSuggestions } from '../outcomes';
import type { IcpProfile, ExtractedSignal, ScoringInput } from '../scoring';
import type { DraftInput } from '../drafting';
import type { OutcomeEvent } from '../outcomes';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    failed++;
  }
}

function assertEqual<T>(actual: T, expected: T, label: string) {
  if (actual === expected) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

// ── Fixtures ──

const ICP: IcpProfile = {
  positiveSignals: [
    { name: 'Has Website', weight: 30, description: '' },
    { name: 'B2B SaaS', weight: 25, description: '' },
    { name: 'Tech Team', weight: 15, description: '' },
  ],
  negativeSignals: [
    { name: 'No Engineering', weight: 20, description: '' },
  ],
  disqualifiers: ['Agency', 'Enterprise'],
};

const OFFER = {
  name: 'Test Offer',
  targetPain: 'manual lead research',
  desiredOutcome: 'automated scoring',
  proofPoints: ['Helped Co increase pipeline 40%'],
  forbiddenClaims: ['guaranteed'],
};

const SIGNALS: ExtractedSignal[] = [
  { signalName: 'Has Website', matchedIcpRule: 'Has Website', matchStrength: 'strong', evidenceQuote: 'Has a website at example.com', sourceUrl: 'https://example.com' },
  { signalName: 'B2B SaaS', matchedIcpRule: 'B2B SaaS', matchStrength: 'strong', evidenceQuote: 'Sells SaaS', sourceUrl: 'https://example.com/about' },
  { signalName: 'Tech Team', matchedIcpRule: 'Tech Team', matchStrength: 'partial', evidenceQuote: 'Hiring engineers', sourceUrl: 'https://example.com/jobs' },
];

console.log('\n🔥 SDR SMOKE TEST\n');

// ── 1. Scoring ──
console.log('\n── 1. Scoring ──');

const scoreInput: ScoringInput = { icpProfile: ICP, extractedSignals: SIGNALS, researchConfidence: 85 };
const result = calculateScore(scoreInput);
assertEqual(result.fitScore, 63, 'Fit score computes deterministically');
assertEqual(result.priorityTier, 'tier2', 'Priority tier is tier2 for score 40-69');
assert(result.fitReasoning.length > 0, 'Fit reasoning is populated');
assert(result.breakdown.length === 3, 'Breakdown has 3 entries');

const disqualified = calculateScore({
  icpProfile: ICP,
  extractedSignals: [{ signalName: 'Agency', matchedIcpRule: 'Agency', matchStrength: 'strong', evidenceQuote: 'Is an agency', sourceUrl: 'https://x.com' }],
  researchConfidence: 80,
});
assertEqual(disqualified.fitScore, 0, 'Disqualified leads have fitScore 0');
assertEqual(disqualified.priorityTier, 'disqualified', 'Disqualified leads have priorityTier disqualified');

const overridden = applyManualOverride(result, { fitScore: 85, reason: 'Founder confirmed fit', userId: 'smoke-test' });
assert(overridden.isOverridden, 'Manual override sets isOverridden flag');
assertEqual(overridden.fitScore, 85, 'Manual override updates fitScore');

// ── 2. Drafting ──
console.log('\n── 2. Drafting ──');

const draftInput: DraftInput = {
  offer: OFFER,
  prospect: {
    companyName: 'Acme Corp',
    domain: 'acme.com',
    signals: SIGNALS,
    contacts: [{ fullName: 'Jane Smith', roleTitle: 'CEO', email: 'jane@acme.com' }],
  },
};
const draft = generateDraft(draftInput);
assert(draft.subjectLine.length > 0, 'Subject line is non-empty');
assert(draft.body.length > 0, 'Body is non-empty');
assert(draft.citedEvidence.length >= 1, 'Has at least 1 cited evidence');
assert(typeof draft.confidence === 'number' && draft.confidence >= 0, 'Confidence is a valid number');

const noDraft = generateDraft({ ...draftInput, prospect: { ...draftInput.prospect, contacts: [], signals: [] } });
assert(noDraft.riskFlags.length > 0, 'Draft with no evidence has risk flags');

const forbiddenFlags = checkForbiddenClaims(
  { subjectLine: 'Test', body: 'We guaranteed results instantly', citedEvidence: [], riskFlags: [], confidence: 50 },
  ['guaranteed'],
);
assert(forbiddenFlags.length === 1, 'Forbidden claim detection works');

// ── 3. Learning Loop ──
console.log('\n── 3. Learning Loop ──');

function signal(name: string): ExtractedSignal {
  return { signalName: name, matchedIcpRule: name, matchStrength: 'strong', evidenceQuote: `Found ${name}`, sourceUrl: 'https://x.com' };
}
function outcome(pid: string, type: string, signals: ExtractedSignal[]): OutcomeEvent {
  return { prospectId: pid, outcomeType: type, signals };
}

const emptySuggestions = generateLearningSuggestions('ws-1', [], ICP);
assertEqual(emptySuggestions.length, 0, 'Empty outcomes produce no suggestions');

const fewSuggestions = generateLearningSuggestions('ws-1', [
  outcome('p1', 'REPLIED', [signal('Has Website')]),
  outcome('p2', 'NOT_INTERESTED', [signal('Has Website')]),
], ICP);
assertEqual(fewSuggestions.length, 0, 'Fewer than 3 outcomes produce no suggestions');

const learningIcp: IcpProfile = {
  positiveSignals: [{ name: 'Has Website', weight: 3, description: '' }],
  negativeSignals: [],
  disqualifiers: [],
};
const manyOutcomes: OutcomeEvent[] = [];
for (let i = 0; i < 5; i++) manyOutcomes.push(outcome(`p${i}`, 'REPLIED', [signal('Has Website')]));
const learning = generateLearningSuggestions('ws-1', manyOutcomes, learningIcp);
const incSuggestions = learning.filter(s => s.suggestion.suggestedChange.type === 'increase_weight');
assert(incSuggestions.length > 0, 'Strong signal correlation produces increase_weight suggestions');

// ── Summary ──
console.log(`\n── RESULTS ──`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`  Total:  ${passed + failed}\n`);

process.exit(failed > 0 ? 1 : 0);
