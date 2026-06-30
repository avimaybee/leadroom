import { test } from 'node:test';
import assert from 'node:assert';
import { checkForbiddenClaims } from '../drafting';
import type { DraftOutput } from '../drafting';

function makeDraft(overrides?: Partial<DraftOutput>): DraftOutput {
  return {
    subjectLine: 'Quick question regarding manual lead research, Jane',
    body: 'Hi Jane,\n\nI was looking at Acme Corp and noticed acme provides saas solutions.\n\nMany teams dealing with manual lead research find that automated prospect scoring makes all the difference.\n\nWould you be open to a brief chat?',
    citedEvidence: [],
    riskFlags: [],
    confidence: 70,
    ...overrides,
  };
}

test('checkForbiddenClaims', async (t) => {
  await t.test('detects forbidden claim in body', () => {
    const draft = makeDraft({ body: 'We guarantee guaranteed results for your business' });
    const flags = checkForbiddenClaims(draft, ['guaranteed results']);
    assert.strictEqual(flags.length, 1);
    assert.ok(flags[0].includes('guaranteed results'));
  });

  await t.test('returns empty when no forbidden claims match', () => {
    const draft = makeDraft();
    const flags = checkForbiddenClaims(draft, ['magic bullet']);
    assert.strictEqual(flags.length, 0);
  });

  await t.test('detects forbidden claim in subject line', () => {
    const draft = makeDraft({ subjectLine: 'Guaranteed results for you' });
    const flags = checkForbiddenClaims(draft, ['guaranteed']);
    assert.strictEqual(flags.length, 1);
  });

  await t.test('is case insensitive', () => {
    const draft = makeDraft({ body: 'GUARANTEED results' });
    const flags = checkForbiddenClaims(draft, ['Guaranteed']);
    assert.strictEqual(flags.length, 1);
  });
});
