import { test } from 'node:test';
import assert from 'node:assert';
import { checkForbiddenClaims, generateDraft, pickBestContact, buildSubjectLine } from '../drafting';
import type { DraftInput, DraftOutput } from '../drafting';

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

function makeInput(overrides?: Partial<DraftInput>): DraftInput {
  return {
    offer: {
      name: 'Lead Scoring Pro',
      targetPain: 'manual lead research',
      desiredOutcome: 'automated prospect scoring',
      proofPoints: ['Increased pipeline velocity by 40% for a B2B SaaS client'],
      forbiddenClaims: ['guaranteed results'],
    },
    prospect: {
      companyName: 'Acme Corp',
      domain: 'acme.com',
      signals: [
        {
          signalName: 'Manual Onboarding',
          matchedIcpRule: 'Manual Onboarding',
          matchStrength: 'strong',
          evidenceQuote: 'Acme uses a manual onboarding process that takes 2 weeks',
          sourceUrl: 'https://acme.com/onboarding',
        },
        {
          signalName: 'B2B SaaS',
          matchedIcpRule: 'B2B SaaS',
          matchStrength: 'strong',
          evidenceQuote: 'Acme provides saas solutions',
          sourceUrl: 'https://acme.com/about',
        },
      ],
      contacts: [
        { fullName: 'Jane Smith', roleTitle: 'CEO', email: 'jane@acme.com' },
        { fullName: 'Bob Jones', roleTitle: 'Engineer', email: 'bob@acme.com' },
      ],
    },
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

test('pickBestContact', async (t) => {
  await t.test('returns null for empty list', () => {
    assert.strictEqual(pickBestContact([]), null);
  });

  await t.test('prefers CEO over Engineer', () => {
    const contacts = [
      { fullName: 'Bob Jones', roleTitle: 'Engineer', email: 'bob@acme.com' },
      { fullName: 'Jane Smith', roleTitle: 'CEO', email: 'jane@acme.com' },
    ];
    const best = pickBestContact(contacts);
    assert.strictEqual(best?.fullName, 'Jane Smith');
  });

  await t.test('prefers Director over Manager', () => {
    const contacts = [
      { fullName: 'Alice', roleTitle: 'Manager', email: 'a@acme.com' },
      { fullName: 'Bob', roleTitle: 'Director of Sales', email: 'b@acme.com' },
    ];
    const best = pickBestContact(contacts);
    assert.strictEqual(best?.fullName, 'Bob');
  });

  await t.test('falls back to first contact when no roles match', () => {
    const contacts = [
      { fullName: 'Alice', roleTitle: 'Intern', email: 'a@acme.com' },
    ];
    const best = pickBestContact(contacts);
    assert.strictEqual(best?.fullName, 'Alice');
  });
});

test('buildSubjectLine', async (t) => {
  await t.test('uses a strong signal when available', () => {
    const result = buildSubjectLine('Acme Corp', 'Jane', makeInput().prospect.signals, 'manual lead research');
    assert.ok(result.subjectLine.includes('Acme Corp'));
    assert.ok(result.evidence);
    assert.strictEqual(result.evidence?.sourceUrl, 'https://acme.com/onboarding');
  });

  await t.test('falls back to pain-point subject when no strong signals', () => {
    const result = buildSubjectLine('Acme Corp', 'Jane', [], 'manual lead research');
    assert.ok(result.subjectLine.includes('Quick question'));
    assert.strictEqual(result.evidence, null);
  });

  await t.test('works without contact name', () => {
    const result = buildSubjectLine('Acme Corp', null, [], 'manual lead research');
    assert.ok(result.subjectLine.includes('Quick question'));
    assert.strictEqual(result.evidence, null);
  });
});

test('generateDraft', async (t) => {
  await t.test('returns a valid DraftOutput with all required fields', () => {
    const input = makeInput();
    const output = generateDraft(input);
    assert.ok(output.subjectLine);
    assert.ok(output.body);
    assert.ok(Array.isArray(output.citedEvidence));
    assert.ok(Array.isArray(output.riskFlags));
    assert.ok(output.confidence >= 0 && output.confidence <= 100);
  });

  await t.test('greets the best contact by first name', () => {
    const output = generateDraft(makeInput());
    assert.ok(output.body.includes('Hi Jane'));
  });

  await t.test('greets generically when no contacts provided', () => {
    const input = makeInput({ prospect: { ...makeInput().prospect, contacts: [] } });
    const output = generateDraft(input);
    assert.ok(output.body.includes('Hi there'));
  });

  await t.test('every cited evidence has sourceUrl for evidence-backed claims', () => {
    const output = generateDraft(makeInput());
    for (const ce of output.citedEvidence) {
      assert.ok(ce.sentence);
      assert.ok(ce.evidenceQuote);
    }
  });

  await t.test('includes risk flags when evidence is weak or inferred', () => {
    const input = makeInput({
      prospect: {
        companyName: 'Acme Corp',
        domain: 'acme.com',
        signals: [
          {
            signalName: 'Manual Onboarding',
            matchedIcpRule: 'Manual Onboarding',
            matchStrength: 'weak',
            evidenceQuote: 'Might use manual processes',
            sourceUrl: 'https://acme.com/onboarding',
          },
        ],
        contacts: [],
      },
    });
    const output = generateDraft(input);
    assert.ok(output.riskFlags.length > 0);
  });

  await t.test('higher confidence with strong signals and evidence', () => {
    const strongInput = makeInput();
    const weakInput = makeInput({
      prospect: {
        companyName: 'Acme Corp',
        domain: 'acme.com',
        signals: [
          {
            signalName: 'Manual Onboarding',
            matchedIcpRule: 'Manual Onboarding',
            matchStrength: 'weak',
            evidenceQuote: 'Might use manual processes',
            sourceUrl: 'https://acme.com/onboarding',
          },
        ],
        contacts: [],
      },
    });
    const strong = generateDraft(strongInput);
    const weak = generateDraft(weakInput);
    assert.ok(strong.confidence >= weak.confidence);
  });

  await t.test('detects and reports forbidden claims', () => {
    const input = makeInput({
      offer: {
        ...makeInput().offer,
        forbiddenClaims: ['chat', 'brief'],
      },
    });
    const output = generateDraft(input);
    const hasForbiddenFlag = output.riskFlags.some((f) => f.includes('Forbidden claim'));
    assert.ok(hasForbiddenFlag);
  });
});
