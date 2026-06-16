const fs = require('fs');
let content = fs.readFileSync('src/lib/ai.ts', 'utf8');

// 1. Update AIAuditSchema
content = content.replace(
/export const AIAuditSchema = z\.object\(\{[\s\S]*?\}\);/,
`export const AIAuditSchema = z.object({
  keyStrengths: z.string(),
  keyWeaknesses: z.string(),
  recommendedImprovements: z.string(),
  sources: z.array(z.string()),
});`
);

// 2. Update AUDIT_JSON_SCHEMA
content = content.replace(
/const AUDIT_JSON_SCHEMA = \{[\s\S]*?additionalProperties: false,\n\};/,
`const AUDIT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    keyStrengths: { type: 'string' },
    keyWeaknesses: { type: 'string' },
    recommendedImprovements: { type: 'string' },
    sources: { type: 'array', items: { type: 'string' } },
  },
  required: ['keyStrengths', 'keyWeaknesses', 'recommendedImprovements', 'sources'],
  additionalProperties: false,
};`
);

// 3. Update max_tokens in callOpenAICompatible
content = content.replace(/max_tokens: 1024,/g, 'max_tokens: 24000,');

// 4. Update heuristicSiteTriage (remove it)
content = content.replace(
/\/\*\*[\s\S]*?export function heuristicSiteTriage[\s\S]*?return \{ isModern, reason \};\n\}/,
''
);
// remove export type HeuristicTriageResult
content = content.replace(/export type HeuristicTriageResult = \{ isModern: boolean; reason: string \};\n*/, '');

// 5. Update generateAudit prompt
const oldPromptStart = 'const prompt = `Perform a comprehensive digital presence';
const oldPromptEnd = '  "triageReason": "The site has a modern responsive layout with clear messaging but weak social presence."\n}`';
const escapedStart = oldPromptStart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const escapedEnd = oldPromptEnd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
content = content.replace(
  new RegExp(escapedStart + '[\\s\\S]*?' + escapedEnd),
`const prompt = \`Perform a comprehensive digital presence, website, and branding audit on the company "\${name}".
Industry: \${ind}
Website: \${web}
\${contextBlock}

You are a senior design and UX auditor at a creative/digital agency. Your job is to produce a structured, evidence-based evaluation of a lead's digital presence — critiquing their website, design, messaging, and social footprint — so the account team knows exactly where to focus and what to pitch.

---

## 1. MINDSET

You are the agency's expert witness. Your commentary will be used to:
- Decide whether a lead is worth pursuing at all
- Frame the first conversation around specific, undeniable weaknesses
- Support the proposal with credible, third-party-feeling evidence

Be generous where deserved and ruthless where needed. A lead who gets high praise across the board probably doesn't need the agency's help — flag that honestly. A lead with terrible design is neglected but may be a high-conversion opportunity.

You do not exist to flatter or to sell. You exist to tell the truth clearly enough that the account team can sell against it.

---

## 2. TEXT FIELD INSTRUCTIONS

**keyStrengths** — Format as a markdown bullet list. Each bullet must reference a specific, observable element. "Clean navigation with 4 clear categories" not "good layout."

**keyWeaknesses** — Format as a markdown bullet list. These are your leverage points. Each weakness should read like something the account team could open a conversation with. "The hero section has no headline — just a logo and a menu" is actionable.

**recommendedImprovements** — Format as a markdown bullet list. Concrete, specific, and ordered by impact. "Replace the 47-word value proposition with a 3-word headline and 10-word subheadline" is better than "improve messaging." These are mini-proposal items.

**sources** — URL array of what you actually examined. Always include the website URL.

---

## 3. CONTEXT HANDLING RULES

- If the contextBlock includes scraped website content, use it as your primary source
- If the contextBlock includes research observations but no scraped content, base your critique on those observations and note uncertainty
- If the contextBlock is empty, state that the audit is speculative due to no available data

---

## 4. ANTI-PATTERNS

- Do not write strengths that sound like faint praise ("the logo exists")
- Do not write weaknesses that are unsupported by evidence in the context block
- Do not use the word "good", "nice", "decent", "solid" without a specific reason

---

Provide your response strictly in JSON format matching this schema:
{
  "keyStrengths": "- Specific strength 1\\n- Specific strength 2",
  "keyWeaknesses": "- Specific weakness 1\\n- Specific weakness 2",
  "recommendedImprovements": "- Improvement 1\\n- Improvement 2",
  "sources": ["URLs checked"]
}\``);

// 6. Update generateAudit Gemini API call schema
content = content.replace(
/properties: \{\s+websiteQualityScore: \{ type: 'INTEGER' \},[\s\S]*?required: \[[\s\S]*?'triageReason',\n\s+\],/,
`properties: {
                  keyStrengths: { type: 'STRING' },
                  keyWeaknesses: { type: 'STRING' },
                  recommendedImprovements: { type: 'STRING' },
                  sources: { type: 'ARRAY', items: { type: 'STRING' } },
                },
                required: [
                  'keyStrengths',
                  'keyWeaknesses',
                  'recommendedImprovements',
                  'sources',
                ],`);

// 7. Update generateMockAudit
content = content.replace(
/function generateMockAudit\([\s\S]*?return \{\n\s+\.\.\.scores,[\s\S]*?\};\n\}/,
`function generateMockAudit(
  leadName: string,
  companyName: string | null,
  websiteUrl: string | null,
  industry: string | null
): AIAuditOutput {
  const name = companyName || leadName;
  return {
    keyStrengths: \`- Clean baseline layout with core sections\\n- Contact information is visible on the page\`,
    keyWeaknesses: \`- Lacks modern mobile-responsive grid layout\\n- Outdated typography and default browser styling\`,
    recommendedImprovements: \`- Redesign with responsive grid system\\n- Apply cohesive visual style guide\\n- Simplify contact/booking flow\`,
    sources: websiteUrl ? [websiteUrl] : [\`https://\${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com\`],
  };
}`);

// 8. Add generateLeadScore
const generateLeadScoreCode = `
export const AILeadScoreSchema = z.object({
  score: z.number().int().min(0).max(100),
  rationaleSummary: z.string(),
  factors: z.array(z.string()),
});
export type AILeadScoreOutput = z.infer<typeof AILeadScoreSchema>;

export async function generateLeadScore(
  db: Db,
  leadName: string,
  researchSnapshot: any | null,
  auditSnapshot: any | null
): Promise<AILeadScoreOutput> {
  const config = await getActiveProviderConfig(db);
  let provider = config?.provider || 'gemini';
  let apiKey = config?.apiKey || (process as any).env?.GEMINI_API_KEY;
  let modelName = config?.modelName || 'gemini-2.5-flash';

  if (!apiKey || apiKey === 'placeholder' || apiKey === '') {
    return { score: 50, rationaleSummary: 'Default score due to missing AI config.', factors: ['Missing AI configuration'] };
  }

  const prompt = \`Evaluate the following lead and assign a priority score from 0 to 100.
Lead Name: \${leadName}

--- RESEARCH SNAPSHOT ---
\${JSON.stringify(researchSnapshot || {}, null, 2)}

--- DESIGN AUDIT ---
\${JSON.stringify(auditSnapshot || {}, null, 2)}

You are evaluating how good of an opportunity this lead is for a creative/digital agency.
Score Criteria:
0-30: Terrible opportunity (e.g., no website, no budget, completely broken business, completely un-contactable).
31-60: Weak opportunity (e.g., okay website but hard to improve, small local business with no obvious growth vector).
61-80: Solid opportunity (e.g., outdated website, clear messaging gaps, active business that needs professionalization).
81-100: Prime opportunity (e.g., high-ticket services, terrible current digital presence, obvious ways an agency can add massive ROI).

Provide a single JSON response with:
- score (0-100)
- rationaleSummary (1-2 sentences explaining why this score was given)
- factors (an array of 3-5 specific bullet points justifying the score)

Provide your response strictly in JSON format matching this schema:
{
  "score": 75,
  "rationaleSummary": "Strong opportunity because...",
  "factors": ["Factor 1", "Factor 2"]
}\`;

  const SCORE_JSON_SCHEMA = {
    type: 'object',
    properties: {
      score: { type: 'integer' },
      rationaleSummary: { type: 'string' },
      factors: { type: 'array', items: { type: 'string' } }
    },
    required: ['score', 'rationaleSummary', 'factors'],
    additionalProperties: false,
  };

  try {
    let textResult = '';
    if (provider === 'gemini') {
      const response = await fetch(
        \`https://generativelanguage.googleapis.com/v1beta/models/\${modelName}:generateContent?key=\${apiKey}\`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                properties: {
                  score: { type: 'INTEGER' },
                  rationaleSummary: { type: 'STRING' },
                  factors: { type: 'ARRAY', items: { type: 'STRING' } }
                },
                required: ['score', 'rationaleSummary', 'factors']
              }
            }
          })
        }
      );
      if (response.ok) {
        const data = await response.json();
        textResult = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else {
        throw new Error(\`Gemini API returned status \${response.status}\`);
      }
    } else {
      textResult = await callOpenAICompatible(
        provider, prompt, apiKey, modelName,
        'You are a lead scoring evaluator. Output strictly valid JSON.',
        SCORE_JSON_SCHEMA
      );
    }
    return AILeadScoreSchema.parse(JSON.parse(textResult));
  } catch (error) {
    console.error('Lead scoring failed:', error);
    return { score: 50, rationaleSummary: 'Scoring failed.', factors: ['Error during generation'] };
  }
}
\`;

content = content + '\n' + generateLeadScoreCode;

fs.writeFileSync('src/lib/ai.ts', content);
console.log('AI logic updated successfully.');
