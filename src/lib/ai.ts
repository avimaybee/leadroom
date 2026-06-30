import { z } from 'zod';
import { Db } from '../db';
import { getChannelPrompt } from './outreach/prompts';

export const AIResearchSchema = z.object({
  companySummary: z.string(),
  productsServicesSummary: z.string(),
  digitalPresenceNotes: z.string(),
  websiteNotes: z.string(),
  brandingNotes: z.string(),
  painPointsHypotheses: z.string(),
  opportunityHypotheses: z.string(),
  sources: z.array(z.string()),
  confidenceLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
});

export type AIResearchOutput = z.infer<typeof AIResearchSchema>;

export const AIAuditSchema = z.object({
  keyStrengths: z.string(),
  keyWeaknesses: z.string(),
  recommendedImprovements: z.string(),
  sources: z.array(z.string()),
});

export type AIAuditOutput = z.infer<typeof AIAuditSchema>;

export const AIContactExtractionSchema = z.object({
  people: z.array(z.object({
    fullName: z.string().nullable().optional(),
    roleTitle: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    linkedinUrl: z.string().nullable().optional(),
  })).nullable().optional(),
  socialLinks: z.object({
    facebook: z.string().nullable().optional(),
    instagram: z.string().nullable().optional(),
    linkedin: z.string().nullable().optional(),
    twitter: z.string().nullable().optional(),
    youtube: z.string().nullable().optional(),
    tiktok: z.string().nullable().optional(),
  }).nullable().optional(),
  emails: z.array(z.string()).nullable().optional(),
  phones: z.array(z.string()).nullable().optional(),
});

export type AIContactExtractionOutput = z.infer<typeof AIContactExtractionSchema>;

export const AIResearchAuditSchema = z.object({
  companySummary: z.string(),
  productsServicesSummary: z.string(),
  digitalPresenceNotes: z.string(),
  websiteNotes: z.string(),
  brandingNotes: z.string(),
  painPointsHypotheses: z.string(),
  opportunityHypotheses: z.string(),
  confidenceLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  keyStrengths: z.string(),
  keyWeaknesses: z.string(),
  recommendedImprovements: z.string(),
  contacts: AIContactExtractionSchema.nullable().optional(),
  sources: z.array(z.string()),
});

export type AIResearchAuditOutput = z.infer<typeof AIResearchAuditSchema>;

const CitedEvidenceItemSchema = z.object({
  sentence: z.string(),
  evidenceQuote: z.string(),
  sourceUrl: z.string(),
});

export const AIOutreachDraftSchema = z.object({
  drafts: z.array(z.object({
    subject: z.string().nullable().optional(),
    body: z.string(),
    variationTone: z.string().optional(),
    riskFlags: z.array(z.string()).optional(),
    citedEvidence: z.array(CitedEvidenceItemSchema).optional(),
  })).min(1).max(1)
});

export type AIOutreachDraftOutput = z.infer<typeof AIOutreachDraftSchema>;

/** Cache for vision capability checks. Key: "provider:modelName", Value: { result: boolean, timestamp: number } */
const _visionCapabilityCache = new Map<string, { result: boolean; timestamp: number }>();
const VISION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Cache for active provider config, keyed by Db instance.
 * Avoids redundant DB queries when multiple AI functions are called in the same scope.
 */
const _providerConfigWeakCache = new WeakMap<object, { config: { provider: string; apiKey: string | null; modelName: string | null } | null; timestamp: number; cacheKey?: string }>();
const PROVIDER_CONFIG_CACHE_TTL_MS = 60_000; // 1 minute

import { IntegrationsService } from '../services/integrations';
import type { TaskType } from '../services/integrations';

function getEnvApiKey(provider: string): string | undefined {
  const env = process.env as any;
  switch (provider) {
    case 'gemini': return env.GEMINI_API_KEY;
    case 'openai': return env.OPENAI_API_KEY;
    case 'anthropic': return env.ANTHROPIC_API_KEY;
    case 'groq': return env.GROQ_API_KEY;
    case 'openrouter': return env.OPENROUTER_API_KEY;
    case 'nvidia': return env.NVIDIA_API_KEY;
    case 'aiml': return env.AIML_API_KEY;
    default: return undefined;
  }
}

/**
 * Resolves the active provider config for a given task type, caching the result by Db instance.
 * Subsequent calls within the same scope reuse the cached value.
 */
export async function getActiveProviderConfig(db: Db, taskType?: TaskType) {
  const cacheKey = `${taskType || 'default'}`;
  const cached = _providerConfigWeakCache.get(db);
  if (cached && cached.cacheKey === cacheKey && Date.now() - cached.timestamp < PROVIDER_CONFIG_CACHE_TTL_MS) {
    return cached.config;
  }

  const integrationsService = new IntegrationsService(db);

  let config: { provider: string; apiKey: string | null; modelName: string | null } | null = null;

  if (taskType) {
    const taskConfig = await integrationsService.getActiveProviderForTask(taskType);
    if (taskConfig) {
      config = { provider: taskConfig.provider, apiKey: taskConfig.apiKey, modelName: taskConfig.modelName };
    }
  } else {
    // Fallback: scan all providers for any active routing flag
    for (const p of ['openrouter', 'nvidia', 'groq', 'aiml', 'gemini', 'openai', 'anthropic'] as const) {
      const pConfig = await integrationsService.getProviderConfig(p);
      if (pConfig && (pConfig.isResearchActive || pConfig.isScoringActive || pConfig.isDraftingActive)) {
        config = { provider: pConfig.provider, apiKey: pConfig.apiKey, modelName: pConfig.modelName };
        break;
      }
    }
  }

  _providerConfigWeakCache.set(db, { config, timestamp: Date.now(), cacheKey });
  return config;
}

export async function generateResearch(
  db: Db,
  leadName: string,
  companyName: string | null,
  websiteUrl: string | null,
  industry: string | null,
  scrapedContent?: string | null,
  location?: string | null
): Promise<AIResearchOutput> {
  const config = await getActiveProviderConfig(db, 'research');
  let provider = config?.provider || 'gemini';
  let apiKey = config?.apiKey || getEnvApiKey(provider);
  let modelName = config?.modelName || (
    provider === 'openrouter' ? 'google/gemini-2.5-flash' : 
    provider === 'nvidia' ? 'meta/llama-3.1-70b-instruct' : 
    provider === 'groq' ? 'llama3-70b-8192' :
    provider === 'aiml' ? 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning' :
    provider === 'openai' ? 'gpt-4o' :
    provider === 'anthropic' ? 'claude-sonnet-4-6' :
    'gemini-2.5-flash'
  );

  if (!apiKey || apiKey === 'placeholder' || apiKey === '') {
    throw new Error(`API key for provider "${provider}" is not configured. Please set it in Settings -> Integrations.`);
  }

  const name = companyName || leadName;
  const ind = industry || 'General Business';
  const web = websiteUrl || 'No website provided';

  const prompt = `Perform research on the company "${name}".
Location Context: ${location || 'Unknown location'}
Industry: ${ind}
Website: ${web}
${scrapedContent ? `\nHere is the scraped content of their website to analyze:\n--- START OF WEBSITE CONTENT ---\n${scrapedContent}\n--- END OF WEBSITE CONTENT ---\n` : ''}

You are a senior competitive intelligence analyst at a creative/digital agency. You produce research that lets the team understand a prospective client's actual business — not their tagline — so they can have an informed conversation and identify real opportunities.

---

## 1. MINDSET

You are writing intelligence for your own team, not marketing copy for the lead. Every field must serve a specific purpose. Before writing each field, ask: "Does this help the account team sound knowledgeable in a first meeting? Does this reveal an angle or weakness we can use?"

Assume your reader (the account team) will read this immediately before a call. Every sentence they have to mentally skip is wasted.

---

## 2. FIELD-BY-FIELD METHODOLOGY

**companySummary** — What they actually do. Business model (B2B/B2C/marketplace/agency/etc.), target customer, revenue model if inferable. Approximate scale (small team, mid-market, enterprise). One paragraph max.

**productsServicesSummary** — Specific offerings with context, not categories. "Custom WordPress development for mid-market e-commerce brands" not "web development." If you only know the category, say so.

**digitalPresenceNotes** — Where they show up online. Social channels with follower counts if visible, review sites, directory listings, press or blog activity. Content strategy assessment. If you found nothing, state "No detectable social presence outside the website itself."

**websiteNotes** — Above-the-fold analysis: what's the first thing a user sees? CTA clarity, page load indicators, mobile behavior, information architecture, navigation complexity. Be specific about what element or behavior drives your conclusion.

**brandingNotes** — Visual identity assessment: logo quality, typography choices, color system consistency, photography style, application across touchpoints. Does it feel intentional or assembled from defaults?

**painPointsHypotheses** — Format as a markdown bullet list. Each bullet: evidence first, then the inferred pain. "Their hero section has a 47-word value proposition. Implication: visitors don't understand what they do within the critical first 3 seconds." Not just "messaging is unclear."

**opportunityHypotheses** — Concrete, specific service angles. "Redesign their checkout flow from 4 steps to 1" not "improve UX." Each bullet should read like a proposal direction the team could pursue. 3-5 bullets.

**sources** — Array of URLs you actually referenced. Always include the website URL. Include social profile URLs, press links, directory pages. If you used a search query, include the search URL.

**confidenceLevel** — LOW (inferred from industry + name only, no scraped content or website access). MEDIUM (scraped content available but limited or partial). HIGH (scraped content is rich + corroborating external sources found).

---

## 3. QUALITY RULES

- If scraped content was provided above, use it as your primary evidence source
- If only a name and industry are available, state that findings are speculative and mark confidence as LOW
- Never invent a social media presence, review profile, or press mention you haven't seen
- Prefer a specific negative over a generic positive. "The site uses Times New Roman as its primary font" is more useful than "the branding could be improved."
- If you cannot reasonably infer a field's content from available data, say "Insufficient data to assess" rather than fabricating
- The painPointsHypotheses and opportunityHypotheses fields MUST use markdown bullet formatting

---

## 4. ANTI-PATTERNS

- No generic descriptions that could apply to any business in their industry
- No corporate jargon ("synergy", "leverage", "best-in-class", "solutions")
- No value judgments about the company being "amazing", "inspiring", or "impressive" — they are a prospect, not a client
- No claims about "the data shows" when you have no data beyond scraped content
- Do not pad fields — empty or honest is better than filler

---

Provide your response strictly in JSON format matching this schema:
{
  "companySummary": "Paragraph about the company's actual business",
  "productsServicesSummary": "Description of specific offerings",
  "digitalPresenceNotes": "Assessment of digital footprint and social visibility",
  "websiteNotes": "UX, layout, CTA, mobile critique",
  "brandingNotes": "Visual identity and consistency assessment",
  "painPointsHypotheses": "- Evidence: inferred pain (markdown bullet list)",
  "opportunityHypotheses": "- Specific service angle (markdown bullet list)",
  "sources": ["URLs referenced"],
  "confidenceLevel": "LOW" | "MEDIUM" | "HIGH"
}`;

  if (provider === 'gemini') {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: 24000,
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                properties: {
                  companySummary: { type: 'STRING' },
                  productsServicesSummary: { type: 'STRING' },
                  digitalPresenceNotes: { type: 'STRING' },
                  websiteNotes: { type: 'STRING' },
                  brandingNotes: { type: 'STRING' },
                  painPointsHypotheses: { type: 'STRING' },
                  opportunityHypotheses: { type: 'STRING' },
                  sources: { type: 'ARRAY', items: { type: 'STRING' } },
                  confidenceLevel: { type: 'STRING', enum: ['LOW', 'MEDIUM', 'HIGH'] },
                },
                required: [
                  'companySummary', 'productsServicesSummary', 'digitalPresenceNotes',
                  'websiteNotes', 'brandingNotes', 'painPointsHypotheses',
                  'opportunityHypotheses', 'sources', 'confidenceLevel',
                ],
              },
            },
          }),
        }
      );
      if (!response.ok) throw new Error(`Gemini API returned status ${response.status}`);
      const data = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textResult) throw new Error('Invalid response structure from Gemini API');
      const parsed = JSON.parse(textResult);
      return AIResearchSchema.parse(parsed);
    } catch (error: unknown) {
      console.error('Gemini API call failed:', error);
      throw error;
    }
  }

  if (provider === 'anthropic') {
    try {
      const textResult = await callAnthropic(
        prompt, apiKey, modelName,
        'You are a senior competitive intelligence analyst. Output strictly in valid JSON matching the requested schema. No markdown code blocks, no extra text.',
      );
      const parsed = JSON.parse(textResult);
      return AIResearchSchema.parse(parsed);
    } catch (error: unknown) {
      console.error('Anthropic API call failed:', error);
      throw error;
    }
  }

  // OpenAI-compatible providers (OpenRouter, NVIDIA, Groq, AIML, OpenAI)
  try {
    let textResult = await callOpenAICompatible(
      provider, prompt, apiKey, modelName,
      'You are a senior competitive intelligence analyst. Output strictly in valid JSON matching the requested schema. No markdown code blocks, no extra text.',
      RESEARCH_JSON_SCHEMA,
    );

    let parsed: any;
    try {
      parsed = JSON.parse(textResult);
    } catch (parseError: unknown) {
      if (provider === 'nvidia') {
        console.error('Failed to parse NVIDIA JSON output, retrying with relaxed format.');
        textResult = await callOpenAICompatible(
          provider, prompt, apiKey, modelName,
          'You are a senior competitive intelligence analyst. Output strictly in valid JSON matching the requested schema. No markdown code blocks, no extra text.',
          undefined, // skip strict schema on retry
          true,      // retryAttempt = true
        );
        parsed = JSON.parse(textResult);
      } else {
        throw parseError;
      }
    }

    return AIResearchSchema.parse(parsed);
  } catch (error: unknown) {
    console.error(`${provider} API call failed:`, error);
    throw error;
  }
}

const RESEARCH_JSON_SCHEMA = {
  type: 'object',
  properties: {
    companySummary: { type: 'string' },
    productsServicesSummary: { type: 'string' },
    digitalPresenceNotes: { type: 'string' },
    websiteNotes: { type: 'string' },
    brandingNotes: { type: 'string' },
    painPointsHypotheses: { type: 'string' },
    opportunityHypotheses: { type: 'string' },
    sources: { type: 'array', items: { type: 'string' } },
    confidenceLevel: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
  },
  required: ['companySummary', 'productsServicesSummary', 'digitalPresenceNotes', 'websiteNotes', 'brandingNotes', 'painPointsHypotheses', 'opportunityHypotheses', 'sources', 'confidenceLevel'],
  additionalProperties: false,
};

const RESEARCH_AUDIT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    companySummary: { type: 'string' },
    productsServicesSummary: { type: 'string' },
    digitalPresenceNotes: { type: 'string' },
    websiteNotes: { type: 'string' },
    brandingNotes: { type: 'string' },
    painPointsHypotheses: { type: 'string' },
    opportunityHypotheses: { type: 'string' },
    confidenceLevel: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
    keyStrengths: { type: 'string' },
    keyWeaknesses: { type: 'string' },
    recommendedImprovements: { type: 'string' },
    contacts: {
      type: 'object',
      properties: {
        people: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              fullName: { type: 'string' },
              roleTitle: { type: 'string' },
              email: { type: 'string' },
              phone: { type: 'string' },
              linkedinUrl: { type: 'string' }
            }
          }
        },
        socialLinks: {
          type: 'object',
          properties: {
            facebook: { type: 'string' },
            instagram: { type: 'string' },
            linkedin: { type: 'string' },
            twitter: { type: 'string' },
            youtube: { type: 'string' },
            tiktok: { type: 'string' }
          }
        },
        emails: { type: 'array', items: { type: 'string' } },
        phones: { type: 'array', items: { type: 'string' } }
      }
    },
    sources: { type: 'array', items: { type: 'string' } }
  },
  required: [
    'companySummary', 'productsServicesSummary', 'digitalPresenceNotes', 
    'websiteNotes', 'brandingNotes', 'painPointsHypotheses', 
    'opportunityHypotheses', 'confidenceLevel', 'keyStrengths', 
    'keyWeaknesses', 'recommendedImprovements', 'sources'
  ],
  additionalProperties: false,
};

export async function generateResearchAndAudit(
  db: Db,
  leadName: string,
  companyName: string | null,
  websiteUrl: string | null,
  industry: string | null,
  scrapedContent?: string | null,
  location?: string | null
): Promise<AIResearchAuditOutput> {
  const config = await getActiveProviderConfig(db, 'research');
  let provider = config?.provider || 'gemini';
  let apiKey = config?.apiKey || getEnvApiKey(provider);
  let modelName = config?.modelName || (
    provider === 'openrouter' ? 'google/gemini-2.5-flash' : 
    provider === 'nvidia' ? 'meta/llama-3.1-70b-instruct' : 
    provider === 'groq' ? 'llama3-70b-8192' :
    provider === 'aiml' ? 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning' :
    provider === 'openai' ? 'gpt-4o' :
    provider === 'anthropic' ? 'claude-sonnet-4-6' :
    'gemini-2.5-flash'
  );

  if (!apiKey || apiKey === 'placeholder' || apiKey === '') {
    throw new Error(`API key for provider "${provider}" is not configured. Please set it in Settings -> Integrations.`);
  }

  const name = companyName || leadName;
  const ind = industry || 'General Business';
  const web = websiteUrl || 'No website provided';

  const prompt = `Perform a combined company research and design/UX audit on the company "${name}".
Location Context: ${location || 'Unknown location'}
Industry: ${ind}
Website: ${web}
${scrapedContent ? `\nHere is the scraped content of their website to analyze:\n--- START OF WEBSITE CONTENT ---\n${scrapedContent}\n--- END OF WEBSITE CONTENT ---\n` : ''}

You are a senior design auditor and competitive intelligence analyst at a creative/digital agency. You will evaluate their company's core business AND perform a digital presence, website, and branding audit.

---
## 1. MINDSET
Every field must serve a specific purpose to help the account team sound knowledgeable and identify real opportunities. Be generous where deserved and ruthless where needed. 

---
## 2. FIELD METHODOLOGY
- **companySummary**: Business model, target customer, revenue model, scale. One paragraph.
- **productsServicesSummary**: Specific offerings with context, not categories.
- **digitalPresenceNotes**: Social channels, review sites, directory listings, content strategy.
- **websiteNotes**: Above-the-fold analysis, CTA clarity, page load, mobile behavior, navigation.
- **brandingNotes**: Logo quality, typography, color system consistency, photography style.
- **painPointsHypotheses**: Markdown bullet list. Evidence first, then inferred pain.
- **opportunityHypotheses**: Markdown bullet list. Specific service angles (3-5 bullets).
- **confidenceLevel**: LOW (no scraped content), MEDIUM (limited scraped content), HIGH (rich content).
- **keyStrengths**: Markdown bullet list of specific design/brand strengths.
- **keyWeaknesses**: Markdown bullet list of digital presence/UX weaknesses.
- **recommendedImprovements**: Markdown bullet list of concrete improvements ordered by impact.
- **contacts**: Extract any contact details found (people names/roles/emails/phones, social media profile links, general email/phone).
- **sources**: Array of URLs checked.

Provide your response strictly in JSON format matching this schema:
{
  "companySummary": "...",
  "productsServicesSummary": "...",
  "digitalPresenceNotes": "...",
  "websiteNotes": "...",
  "brandingNotes": "...",
  "painPointsHypotheses": "- Evidence: pain",
  "opportunityHypotheses": "- Opportunity",
  "confidenceLevel": "LOW" | "MEDIUM" | "HIGH",
  "keyStrengths": "- Strength",
  "keyWeaknesses": "- Weakness",
  "recommendedImprovements": "- Improvement",
  "contacts": {
    "people": [
      { "fullName": "...", "roleTitle": "...", "email": "...", "phone": "...", "linkedinUrl": "..." }
    ],
    "socialLinks": {
      "facebook": "...", "instagram": "...", "linkedin": "...", "twitter": "...", "youtube": "...", "tiktok": "..."
    },
    "emails": ["..."],
    "phones": ["..."]
  },
  "sources": ["..."]
}`;

  if (provider === 'gemini') {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: 24000,
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                properties: {
                  companySummary: { type: 'STRING' },
                  productsServicesSummary: { type: 'STRING' },
                  digitalPresenceNotes: { type: 'STRING' },
                  websiteNotes: { type: 'STRING' },
                  brandingNotes: { type: 'STRING' },
                  painPointsHypotheses: { type: 'STRING' },
                  opportunityHypotheses: { type: 'STRING' },
                  confidenceLevel: { type: 'STRING', enum: ['LOW', 'MEDIUM', 'HIGH'] },
                  keyStrengths: { type: 'STRING' },
                  keyWeaknesses: { type: 'STRING' },
                  recommendedImprovements: { type: 'STRING' },
                  contacts: {
                    type: 'OBJECT',
                    properties: {
                      people: {
                        type: 'ARRAY',
                        items: {
                          type: 'OBJECT',
                          properties: {
                            fullName: { type: 'STRING' },
                            roleTitle: { type: 'STRING' },
                            email: { type: 'STRING' },
                            phone: { type: 'STRING' },
                            linkedinUrl: { type: 'STRING' },
                          },
                        },
                      },
                      socialLinks: {
                        type: 'OBJECT',
                        properties: {
                          facebook: { type: 'STRING' },
                          instagram: { type: 'STRING' },
                          linkedin: { type: 'STRING' },
                          twitter: { type: 'STRING' },
                          youtube: { type: 'STRING' },
                          tiktok: { type: 'STRING' },
                        },
                      },
                      emails: { type: 'ARRAY', items: { type: 'STRING' } },
                      phones: { type: 'ARRAY', items: { type: 'STRING' } },
                    },
                  },
                  sources: { type: 'ARRAY', items: { type: 'STRING' } },
                },
                required: [
                  'companySummary', 'productsServicesSummary', 'digitalPresenceNotes',
                  'websiteNotes', 'brandingNotes', 'painPointsHypotheses',
                  'opportunityHypotheses', 'confidenceLevel', 'keyStrengths',
                  'keyWeaknesses', 'recommendedImprovements', 'sources',
                ],
              },
            },
          }),
        }
      );
      if (!response.ok) throw new Error(`Gemini API returned status ${response.status}`);
      const data = (await response.json()) as any;
      const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textResult) throw new Error('Invalid response structure from Gemini API');
      const parsed = JSON.parse(textResult);
      return AIResearchAuditSchema.parse(parsed);
    } catch (error: unknown) {
      console.error('Gemini API call failed:', error);
      throw error;
    }
  }

  if (provider === 'anthropic') {
    try {
      const textResult = await callAnthropic(
        prompt, apiKey, modelName,
        'You are a senior competitive intelligence analyst and UX/design auditor. Output strictly in valid JSON matching the requested schema.',
      );
      const parsed = JSON.parse(textResult);
      return AIResearchAuditSchema.parse(parsed);
    } catch (error: unknown) {
      console.error('Anthropic API call failed:', error);
      throw error;
    }
  }

  // OpenAI-compatible providers
  try {
    const textResult = await callOpenAICompatible(
      provider, prompt, apiKey, modelName,
      'You are a senior competitive intelligence analyst and UX/design auditor. Output strictly in valid JSON matching the requested schema.',
      RESEARCH_AUDIT_JSON_SCHEMA,
    );
    const parsed = JSON.parse(textResult);
    return AIResearchAuditSchema.parse(parsed);
  } catch (error: unknown) {
    console.error(`${provider} API call failed:`, error);
    throw error;
  }
}

function generateMockResearchAndAudit(
  leadName: string,
  companyName: string | null,
  websiteUrl: string | null,
  industry: string | null
): AIResearchAuditOutput {
  const name = companyName || leadName;
  const web = websiteUrl || '';
  const ind = (industry || 'General Business').toLowerCase();
  const mockWeb = web || `https://${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;

  return {
    companySummary: `${name} is an established company in the ${ind} industry.`,
    productsServicesSummary: `Offers specialized services/products tailored to their customer base.`,
    digitalPresenceNotes: `Limited social media activity with minimal detectable online footprint.`,
    websiteNotes: `Website is functional but uses standard templates with room for UX and performance improvement.`,
    brandingNotes: `Branding appears functional but lacks a cohesive visual identity system.`,
    painPointsHypotheses: `- Digital presence is underutilized for lead generation\n- Website may not reflect current brand positioning`,
    opportunityHypotheses: `- Modernize website with responsive design and clear CTAs\n- Refresh brand identity for consistency across channels`,
    confidenceLevel: 'LOW',
    keyStrengths: `- Clean baseline layout with core sections\n- Contact information is visible on the page`,
    keyWeaknesses: `- Lacks modern mobile-responsive grid layout\n- Outdated typography and default browser styling`,
    recommendedImprovements: `- Redesign with responsive grid system\n- Apply cohesive visual style guide\n- Simplify contact/booking flow`,
    sources: [mockWeb].filter(Boolean),
    contacts: {
      people: [],
      socialLinks: {},
      emails: [],
      phones: [],
    },
  };
}

const AUDIT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    keyStrengths: { type: 'string' },
    keyWeaknesses: { type: 'string' },
    recommendedImprovements: { type: 'string' },
    sources: { type: 'array', items: { type: 'string' } },
  },
  required: ['keyStrengths', 'keyWeaknesses', 'recommendedImprovements', 'sources'],
  additionalProperties: false,
};

const OPENAI_URLS: Record<string, string> = {
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  nvidia: 'https://integrate.api.nvidia.com/v1/chat/completions',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  aiml: 'https://api.aimlapi.com/v1/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
};

const OPENAI_EXTRA_HEADERS: Record<string, Record<string, string>> = {
  openrouter: { 'HTTP-Referer': 'https://github.com/googlemind/leadroom', 'X-Title': 'Leadroom' },
};

/**
 * Generic OpenAI-compatible API caller.
 * Handles NVIDIA's strict json_schema → json_object fallback + parse-failure retry.
 * Returns the raw text response string; caller does JSON.parse + Zod validation.
 */
async function callOpenAICompatible(
  provider: string,
  prompt: string,
  apiKey: string,
  modelName: string,
  systemMessage: string,
  strictSchema?: object,
  retryAttempt?: boolean,
): Promise<string> {
  const url = OPENAI_URLS[provider];
  if (!url) throw new Error(`Unsupported provider: ${provider}`);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    ...(OPENAI_EXTRA_HEADERS[provider] || {}),
  };

  const makeRequest = async (format: unknown, sysMsgOverride?: string) => {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: sysMsgOverride || systemMessage },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 4096,
        response_format: format,
      }),
    });
    return res;
  };

  let response: Response;

  if (provider === 'nvidia' && strictSchema && !retryAttempt) {
    // NVIDIA: try strict json_schema first
    response = await makeRequest({
      type: 'json_schema',
      json_schema: { name: 'ai_response', schema: strictSchema, strict: true },
    });

    if (!response.ok && (response.status === 400 || response.status === 422)) {
      console.warn(`NVIDIA strict schema failed (${response.status}), falling back to json_object`);
      response = await makeRequest({ type: 'json_object' });
    }
  } else {
    response = await makeRequest({ type: 'json_object' });
  }

  if (!response.ok) {
    throw new Error(`${provider} API returned status ${response.status}`);
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  let text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`Invalid response structure from ${provider} API`);

  text = text.trim();
  if (text.startsWith('```json')) text = text.replace(/^```json\n/, '').replace(/\n```$/, '');
  else if (text.startsWith('```')) text = text.replace(/^```\n/, '').replace(/\n```$/, '');

  return text;
}

/**
 * Anthropic Messages API caller.
 * Anthropic uses a different request format than OpenAI-compatible APIs.
 * Returns the raw text response string; caller does JSON.parse + Zod validation.
 */
async function callAnthropic(
  prompt: string,
  apiKey: string,
  modelName: string,
  systemMessage: string,
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: modelName,
      max_tokens: 8192,
      system: systemMessage,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API returned status ${response.status}`);
  }

  const data = (await response.json()) as { content?: Array<{ text?: string }> };
  let text = data.content?.[0]?.text;
  if (!text) throw new Error('Invalid response structure from Anthropic API');

  text = text.trim();
  if (text.startsWith('```json')) text = text.replace(/^```json\n/, '').replace(/\n```$/, '');
  else if (text.startsWith('```')) text = text.replace(/^```\n/, '').replace(/\n```$/, '');

  return text;
}

function generateMockResearch(
  leadName: string,
  companyName: string | null,
  websiteUrl: string | null,
  industry: string | null
): AIResearchOutput {
  const name = companyName || leadName;
  const web = websiteUrl || '';
  const ind = (industry || 'General Business').toLowerCase();

  return {
    companySummary: `${name} is an established company in the ${ind} industry.`,
    productsServicesSummary: `Offers specialized services/products tailored to their customer base.`,
    digitalPresenceNotes: `Limited social media activity with minimal detectable online footprint.`,
    websiteNotes: `Website is functional but uses standard templates with room for UX and performance improvement.`,
    brandingNotes: `Branding appears functional but lacks a cohesive visual identity system.`,
    painPointsHypotheses: `- Digital presence is underutilized for lead generation\n- Website may not reflect current brand positioning`,
    opportunityHypotheses: `- Modernize website with responsive design and clear CTAs\n- Refresh brand identity for consistency across channels`,
    sources: [web || `https://${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`].filter(Boolean),
    confidenceLevel: 'LOW',
  };
}



export async function generateAudit(
  db: Db,
  leadName: string,
  companyName: string | null,
  websiteUrl: string | null,
  industry: string | null,
  scrapedContent?: string | null,
  leadId?: string | null
): Promise<AIAuditOutput> {
  const config = await getActiveProviderConfig(db, 'scoring');
  let provider = config?.provider || 'gemini';
  let apiKey = config?.apiKey || getEnvApiKey(provider);
  let modelName = config?.modelName || (
    provider === 'openrouter' ? 'google/gemini-2.5-flash' : 
    provider === 'nvidia' ? 'meta/llama-3.1-70b-instruct' : 
    provider === 'groq' ? 'llama3-70b-8192' :
    provider === 'aiml' ? 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning' :
    provider === 'openai' ? 'gpt-4o' :
    provider === 'anthropic' ? 'claude-sonnet-4-6' :
    'gemini-2.5-flash'
  );

  if (!apiKey || apiKey === 'placeholder' || apiKey === '') {
    throw new Error(`API key for provider "${provider}" is not configured. Please set it in Settings -> Integrations.`);
  }

  // Load research snapshot — used as PRIMARY context when scraping fails,
  // and as supplemental context when scraped content is available.
  let researchSnapshotContext = '';
  let hasResearchSnapshot = false;
  if (leadId) {
    try {
      const { researchSnapshots } = await import('../db/schema/research');
      const { eq, desc } = await import('drizzle-orm');
      
      const [snapshot] = await db.select()
        .from(researchSnapshots)
        .where(eq(researchSnapshots.leadId, leadId))
        .orderBy(desc(researchSnapshots.createdAt))
        .limit(1);

      if (snapshot) {
        hasResearchSnapshot = true;
        researchSnapshotContext = [
          snapshot.companySummary   ? `Company Overview: ${snapshot.companySummary}` : '',
          snapshot.websiteNotes     ? `Website Observations: ${snapshot.websiteNotes}` : '',
          snapshot.brandingNotes    ? `Branding & Visual Identity: ${snapshot.brandingNotes}` : '',
          snapshot.digitalPresenceNotes ? `Digital Presence & Social Footprint: ${snapshot.digitalPresenceNotes}` : '',
          snapshot.painPointsHypotheses ? `Pain Points: ${snapshot.painPointsHypotheses}` : '',
        ].filter(Boolean).join('\n');
      }
    } catch (e) {
      console.error('Failed to fetch research snapshot in generateAudit:', e);
    }
  }

  const name = companyName || leadName;
  const ind = industry || 'General Business';
  const web = websiteUrl || 'No website provided';

  // Defensively strip any accidental scrape-failure strings before sending to the LLM.
  // These would cause the model to score the site as inaccessible even if research data is available.
  const cleanedScrapedContent = (scrapedContent && !scrapedContent.startsWith('[Failed to scrape'))
    ? scrapedContent
    : null;

  // Build the context block depending on what data is available.
  // When scraping fails but a research snapshot exists, the snapshot becomes the PRIMARY source.
  let contextBlock = '';
  if (cleanedScrapedContent && hasResearchSnapshot) {
    contextBlock = `
The following is the raw scraped content from their website:
--- START OF WEBSITE CONTENT ---
${cleanedScrapedContent}
--- END OF WEBSITE CONTENT ---

The following is additional research gathered about this business (use this to enrich and validate the audit):
--- RESEARCH OBSERVATIONS ---
${researchSnapshotContext}
--- END OF RESEARCH OBSERVATIONS ---`;
  } else if (cleanedScrapedContent) {
    contextBlock = `
The following is the raw scraped content from their website:
--- START OF WEBSITE CONTENT ---
${cleanedScrapedContent}
--- END OF WEBSITE CONTENT ---`;
  } else if (hasResearchSnapshot) {
    contextBlock = `
Direct website scraping was not available. Use the following research observations as your PRIMARY source for scoring and analysis:
--- PRIMARY RESEARCH OBSERVATIONS ---
${researchSnapshotContext}
--- END OF RESEARCH OBSERVATIONS ---`;
  }

  const prompt = `Perform a comprehensive digital presence, website, and branding audit on the company "${name}".
Industry: ${ind}
Website: ${web}
${contextBlock}

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
}`;

  try {
    let textResult = '';

    if (provider === 'gemini') {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: 24000,
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                properties: {
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
                ],
              },
            },
          }),
        }
      );
      if (response.ok) {
        const data = (await response.json()) as any;
        textResult = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else {
        throw new Error(`Gemini API returned status ${response.status}`);
      }
    } else if (provider === 'anthropic') {
      textResult = await callAnthropic(
        prompt, apiKey, modelName,
        'You are a senior design and UX auditor. Output strictly in valid JSON matching the requested schema.',
      );
    } else {
      textResult = await callOpenAICompatible(
        provider, prompt, apiKey, modelName,
        'You are a senior design and UX auditor. Output strictly in valid JSON matching the requested schema.',
        AUDIT_JSON_SCHEMA,
      );
    }

    const parsed = JSON.parse(textResult);
    return AIAuditSchema.parse(parsed);
  } catch (error: unknown) {
    console.error(`generateAudit API call failed for ${provider}:`, error);
    throw error;
  }
}

function generateMockAudit(
  leadName: string,
  companyName: string | null,
  websiteUrl: string | null,
  industry: string | null
): AIAuditOutput {
  const name = companyName || leadName;
  return {
    keyStrengths: `- Clean baseline layout with core sections\n- Contact information is visible on the page`,
    keyWeaknesses: `- Lacks modern mobile-responsive grid layout\n- Outdated typography and default browser styling`,
    recommendedImprovements: `- Redesign with responsive grid system\n- Apply cohesive visual style guide\n- Simplify contact/booking flow`,
    sources: websiteUrl ? [websiteUrl] : [`https://${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`],
  };
}

export async function generateOutreachDraft(
  db: Db,
  leadName: string,
  companyName: string | null,
  websiteUrl: string | null,
  industry: string | null,
  leadCity: string | null,
  leadRegion: string | null,
  channel: 'EMAIL' | 'LINKEDIN' | 'CALL' | 'MEETING',
  contactsList: any[],
  researchSnapshot: any | null,
  auditSnapshot: any | null,
  customPrompt?: string | null,
  attachments?: Array<{ name: string; type: string; base64: string }>
): Promise<AIOutreachDraftOutput> {
  const config = await getActiveProviderConfig(db, 'drafting');
  let provider = config?.provider || 'gemini';
  let apiKey = config?.apiKey || getEnvApiKey(provider);
  let modelName = config?.modelName || (
    provider === 'openrouter' ? 'google/gemini-2.5-flash' : 
    provider === 'nvidia' ? 'meta/llama-3.1-70b-instruct' : 
    provider === 'groq' ? 'llama3-70b-8192' :
    provider === 'aiml' ? 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning' :
    provider === 'openai' ? 'gpt-4o' :
    provider === 'anthropic' ? 'claude-sonnet-4-6' :
    'gemini-2.5-flash'
  );

  if (!apiKey || apiKey === 'placeholder' || apiKey === '') {
    throw new Error(`API key for provider "${provider}" is not configured. Please set it in Settings -> Integrations.`);
  }

  const name = companyName || leadName;
  const ind = industry || 'General Business';
  const web = websiteUrl || 'No website provided';
  const contactText = contactsList && contactsList.length > 0 
    ? contactsList.map(c => {
        const parts = [`- ${c.name || c.fullName || 'Stakeholder'} (${c.role || c.roleTitle || 'Stakeholder'})`];
        if (c.email) parts.push(`Email: ${c.email}`);
        if (c.phone) parts.push(`Phone: ${c.phone}`);
        if (c.linkedinUrl) parts.push(`LinkedIn: ${c.linkedinUrl}`);
        if (c.isPrimary) parts.push('(Primary contact)');
        return parts.join(', ');
      }).join('\n')
    : 'No contact stakeholders found';

  const locationText = [leadCity, leadRegion].filter(Boolean).join(', ') || 'Unknown location';

  const prompt = `Draft outreach prep/copy for "${name}".
Industry: ${ind}
Location: ${locationText}
Website: ${web}
Channel: ${channel} (Use EMAIL for a cold email draft, LINKEDIN for a LinkedIn message, CALL for phone call prep script/bullets, or MEETING for a meeting/visit prep guide with agenda and discovery questions).

Stakeholders:
${contactText}

${researchSnapshot ? `Research Context:\n- Company Summary: ${researchSnapshot.companySummary || ''}\n- Products/Services: ${researchSnapshot.productsServicesSummary || 'N/A'}\n- Digital Presence: ${researchSnapshot.digitalPresenceNotes || 'N/A'}\n- Website Observations: ${researchSnapshot.websiteNotes || 'N/A'}\n- Branding Notes: ${researchSnapshot.brandingNotes || 'N/A'}\n- Pain Points: ${researchSnapshot.painPointsHypotheses || ''}\n- Opportunity Hypotheses: ${researchSnapshot.opportunityHypotheses || ''}\n` : ''}
${auditSnapshot ? `Website & Branding Audit Context:\n- Key Strengths: ${auditSnapshot.keyStrengths || 'N/A'}\n- Key Weaknesses: ${auditSnapshot.keyWeaknesses || 'N/A'}\n- Recommended Improvements: ${auditSnapshot.recommendedImprovements || 'N/A'}\n` : ''}
${customPrompt ? `\nSPECIAL INSTRUCTIONS FROM THE OPERATOR:\n${customPrompt}\n` : ''}
${attachments && attachments.length > 0 ? `\nNote: The operator has attached ${attachments.length} files (images or PDFs) showing mockup/branding/website context. Please reference or adapt your feedback specifically incorporating visual details or document findings if vision support is active.\n` : ''}
${getChannelPrompt(channel)}

Generate a **strict evidence-backed** draft that any human reviewer can verify. Every claim about the prospect must reference a specific piece of evidence.

**riskFlags** — An array of warning strings. Flag any of the following:
- If the draft makes a claim that isn't directly supported by the provided research/audit context
- If contact info is unavailable (e.g., no named contact)
- If the tone might come across as presumptuous
- If any assertion about the prospect's business is speculative
- If personalization is weak or generic
- If the channel-specific instructions indicate common risks (e.g., cold email deliverability, LinkedIn connection limits)

**citedEvidence** — An array of objects linking draft sentences to their sources. Each item must have:
- sentence: the exact sentence from the body (or a very close paraphrase)
- evidenceQuote: the exact quote or data point from the research/audit context that supports this sentence
- sourceUrl: the URL where this evidence was found (use the prospect's website URL, or a specific page if known)

Rules:
- Every substantive claim in the body must have a corresponding citedEvidence entry
- If the research context lacks evidence for a claim, add a riskFlag instead of fabricating an evidence citation
- The citedEvidence array must have at least 1 entry

Provide your response strictly in JSON format. The response must match the following JSON schema:
{
  "drafts": [
    {
      "subject": "Compelling subject line (string or null)",
      "body": "The drafted message body or call prep guide (string)",
      "variationTone": "e.g. Direct/Value-led or Conversational/Soft",
      "riskFlags": ["Warning about unsupported claim", "Missing contact info"],
      "citedEvidence": [
        {
          "sentence": "I noticed your team focuses on X.",
          "evidenceQuote": "Description from website scraped content about X",
          "sourceUrl": "https://example.com/about"
        }
      ]
    }
  ]
}`;

  try {
    let textResult = '';

    if (provider === 'gemini') {
      const parts: any[] = [{ text: prompt }];
      if (attachments && attachments.length > 0) {
        for (const file of attachments) {
          parts.push({
            inlineData: {
              mimeType: file.type,
              data: file.base64
            }
          });
        }
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              maxOutputTokens: 24000,
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                properties: {
                  drafts: {
                    type: 'ARRAY',
                    minItems: 1,
                    maxItems: 1,
                    items: {
                      type: 'OBJECT',
                      properties: {
                        subject: { type: 'STRING' },
                        body: { type: 'STRING' },
                        variationTone: { type: 'STRING' },
                        riskFlags: { type: 'ARRAY', items: { type: 'STRING' } },
                        citedEvidence: {
                          type: 'ARRAY',
                          items: {
                            type: 'OBJECT',
                            properties: {
                              sentence: { type: 'STRING' },
                              evidenceQuote: { type: 'STRING' },
                              sourceUrl: { type: 'STRING' },
                            },
                            required: ['sentence', 'evidenceQuote', 'sourceUrl'],
                          },
                        },
                      },
                      required: ['body'],
                    },
                  },
                },
                required: ['drafts'],
              },
            },
          }),
        }
      );
      if (response.ok) {
        const data = (await response.json()) as any;
        textResult = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else {
        throw new Error(`Gemini API returned status ${response.status}`);
      }
    } else if (provider === 'anthropic') {
      textResult = await callAnthropic(
        prompt, apiKey, modelName,
        'You are a senior creative director drafting agency outreach. Output strictly in valid JSON matching the requested schema.',
      );
    } else {
      const url = 
        provider === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' :
        provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' :
        provider === 'nvidia' ? 'https://integrate.api.nvidia.com/v1/chat/completions' :
        provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' :
        provider === 'aiml' ? 'https://api.aimlapi.com/v1/chat/completions' :
        'https://api.openai.com/v1/chat/completions';

      // Setup payload content structure for potential multimodal input
      let userMessageContent: any = prompt;
      const modelHasVision = await checkModelVisionCapability(provider, modelName, apiKey);
      if (attachments && attachments.length > 0 && modelHasVision) {
        userMessageContent = [{ type: 'text', text: prompt }];
        for (const file of attachments) {
          if (file.type.startsWith('image/')) {
            userMessageContent.push({
              type: 'image_url',
              image_url: {
                url: `data:${file.type};base64,${file.base64}`
              }
            });
          }
        }
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: 'You are a senior growth strategist at a creative agency. Output strictly in valid JSON matching the requested schema.' },
            { role: 'user', content: userMessageContent }
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' }
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as any;
        textResult = data.choices?.[0]?.message?.content || '';
      } else {
        throw new Error(`${provider} API returned status ${response.status}`);
      }
    }

    textResult = textResult.trim();
    if (textResult.startsWith('```json')) {
      textResult = textResult.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (textResult.startsWith('```')) {
      textResult = textResult.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    const parsed = JSON.parse(textResult);
    return AIOutreachDraftSchema.parse(parsed);
  } catch (error: unknown) {
    console.error(`generateOutreachDraft API call failed for ${provider}:`, error);
    throw error;
  }
}

export async function checkModelVisionCapability(provider: string, modelName: string, apiKey?: string): Promise<boolean> {
  const cacheKey = `${provider}:${modelName}`;
  const cached = _visionCapabilityCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < VISION_CACHE_TTL_MS) {
    return cached.result;
  }

  const p = provider.toLowerCase();
  const m = modelName.toLowerCase();

  if (!apiKey || apiKey === 'placeholder' || apiKey === '') {
    const result = true; // mockup fallback
    _visionCapabilityCache.set(cacheKey, { result, timestamp: Date.now() });
    return result;
  }

  // Dynamic OpenRouter check
  if (p === 'openrouter') {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'HTTP-Referer': 'https://github.com/googlemind/leadroom',
          'X-Title': 'Leadroom',
        }
      });
      if (response.ok) {
        const data = (await response.json()) as any;
        const modelObj = data.data?.find((x: any) => x.id === modelName);
        if (modelObj?.architecture?.input_modalities) {
          const result = modelObj.architecture.input_modalities.includes('image');
          _visionCapabilityCache.set(cacheKey, { result, timestamp: Date.now() });
          return result;
        }
      }
    } catch (e) {
      console.error('Error fetching OpenRouter models:', e);
    }
  }

  // Dynamic Gemini check
  if (p === 'gemini') {
    try {
      const formattedModel = modelName.startsWith('models/') ? modelName : `models/${modelName}`;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${formattedModel}?key=${apiKey}`);
      if (response.ok) {
        const data = (await response.json()) as any;
        const result = data.name?.includes('gemini') && !data.name?.includes('embedding');
        _visionCapabilityCache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      }
    } catch (e) {
      console.error('Error fetching Gemini model metadata:', e);
    }
  }

  // Dynamic OpenAI check
  if (p === 'openai') {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (response.ok) {
        const data = (await response.json()) as any;
        const modelObj = data.data?.find((x: any) => x.id === modelName);
        if (modelObj) {
          const id = modelObj.id.toLowerCase();
          const result = id.includes('vision') || id.includes('gpt-4o') || id.includes('gpt-4-vision') || id.includes('o3') || id.includes('o4');
          _visionCapabilityCache.set(cacheKey, { result, timestamp: Date.now() });
          return result;
        }
      }
    } catch (e) {
      console.error('Error fetching OpenAI models:', e);
    }
  }

  // Dynamic Groq / Nvidia / AIML checks
  if (['groq', 'nvidia', 'aiml'].includes(p)) {
    try {
      const url = p === 'groq' ? 'https://api.groq.com/openai/v1/models' :
                  p === 'nvidia' ? 'https://integrate.api.nvidia.com/v1/models' :
                  'https://api.aimlapi.com/v1/models';
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      if (response.ok) {
        const data = (await response.json()) as any;
        const modelObj = data.data?.find((x: any) => x.id === modelName);
        if (modelObj) {
          const id = modelObj.id.toLowerCase();
          const result = id.includes('vision') || id.includes('llava') || id.includes('pixtral') || (id.includes('llama-3.2') && (id.includes('11b') || id.includes('90b')));
          _visionCapabilityCache.set(cacheKey, { result, timestamp: Date.now() });
          return result;
        }
      }
    } catch (e) {
      console.error(`Error fetching models for ${p}:`, e);
    }
  }

  const visionKeywords = ['vision', 'llava', 'pixtral', 'gemini', 'claude-3', 'claude-opus', 'claude-sonnet', 'gpt-4o', 'gpt-4-vision', 'gpt-5', 'llama-3.2-11b', 'llama-3.2-90b'];
  const fallbackResult = visionKeywords.some(keyword => m.includes(keyword)) && !m.includes('embedding');
  _visionCapabilityCache.set(cacheKey, { result: fallbackResult, timestamp: Date.now() });
  return fallbackResult;
}

export async function getModelInfo(db: Db): Promise<{ provider: string; modelName: string; hasVision: boolean }> {
  const config = await getActiveProviderConfig(db);
  const provider = config?.provider || 'gemini';
  const apiKey = config?.apiKey || getEnvApiKey(provider);
  const modelName = config?.modelName || (
    provider === 'openrouter' ? 'google/gemini-2.5-flash' : 
    provider === 'nvidia' ? 'meta/llama-3.1-70b-instruct' : 
    provider === 'groq' ? 'llama3-70b-8192' :
    provider === 'aiml' ? 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning' :
    provider === 'openai' ? 'gpt-4o' :
    provider === 'anthropic' ? 'claude-sonnet-4-6' :
    'gemini-2.5-flash'
  );

  const hasApiKey = !!(apiKey && apiKey !== 'placeholder' && apiKey !== '');
  const hasVision = hasApiKey ? await checkModelVisionCapability(provider, modelName, apiKey) : true;

  return {
    provider,
    modelName,
    hasVision,
  };
}

/**
 * AI-powered contact extraction from scraped website text.
 * Used as a fallback when regex extraction finds too few contacts.
 * Follows the same Gemini + OpenAI-compatible provider pattern as generateResearch.
 */
export async function generateContactExtraction(
  db: Db,
  leadName: string,
  companyName: string | null,
  scrapedContent?: string | null,
): Promise<AIContactExtractionOutput> {
  const config = await getActiveProviderConfig(db, 'research');
  let provider = config?.provider || 'gemini';
  let apiKey = config?.apiKey || getEnvApiKey(provider);
  let modelName = config?.modelName || (
    provider === 'openrouter' ? 'google/gemini-2.5-flash' : 
    provider === 'nvidia' ? 'meta/llama-3.1-70b-instruct' : 
    provider === 'groq' ? 'llama3-70b-8192' :
    provider === 'aiml' ? 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning' :
    provider === 'openai' ? 'gpt-4o' :
    provider === 'anthropic' ? 'claude-sonnet-4-6' :
    'gemini-2.5-flash'
  );

  if (!apiKey || apiKey === 'placeholder' || apiKey === '') {
    throw new Error(`API key for provider "${provider}" is not configured. Please set it in Settings -> Integrations.`);
  }

  const name = companyName || leadName;

  const prompt = `Extract contact information from the website of "${name}".

Here is the scraped content of their website:
--- START OF WEBSITE CONTENT ---
${scrapedContent || 'No website content available.'}
--- END OF WEBSITE CONTENT ---

You are a research assistant extracting contact details from a business website. Extract any contact information you can find.

Respond with a JSON object containing:
- "people": Array of people mentioned with their full name, role/title, email, phone, and LinkedIn URL (all nullable). Only include people clearly mentioned on the site.
- "socialLinks": Object with social media profile URLs for facebook, instagram, linkedin, twitter, youtube, tiktok. Only include links you actually see.
- "emails": Array of email addresses found on the site.
- "phones": Array of phone numbers found on the site.

Rules:
- Only extract information that is explicitly visible in the content
- Do not invent emails, phones, or social profiles
- If you find nothing useful, return null for that field
- Be thorough — check headers, footers, team sections, contact info blocks`;

  if (provider === 'gemini') {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: 24000,
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                properties: {
                  people: {
                    type: 'ARRAY',
                    items: {
                      type: 'OBJECT',
                      properties: {
                        fullName: { type: 'STRING' },
                        roleTitle: { type: 'STRING' },
                        email: { type: 'STRING' },
                        phone: { type: 'STRING' },
                        linkedinUrl: { type: 'STRING' },
                      },
                    },
                  },
                  socialLinks: {
                    type: 'OBJECT',
                    properties: {
                      facebook: { type: 'STRING' },
                      instagram: { type: 'STRING' },
                      linkedin: { type: 'STRING' },
                      twitter: { type: 'STRING' },
                      youtube: { type: 'STRING' },
                      tiktok: { type: 'STRING' },
                    },
                  },
                  emails: { type: 'ARRAY', items: { type: 'STRING' } },
                  phones: { type: 'ARRAY', items: { type: 'STRING' } },
                },
              },
            },
          }),
        }
      );
      if (!response.ok) throw new Error(`Gemini API returned status ${response.status}`);
      const data = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textResult) throw new Error('Invalid response structure from Gemini API');
      const parsed = JSON.parse(textResult);
      return AIContactExtractionSchema.parse(parsed);
    } catch (error: unknown) {
      console.error('Gemini contact extraction failed:', error);
      return { people: null, socialLinks: null, emails: null, phones: null };
    }
  }

  if (provider === 'anthropic') {
    try {
      const textResult = await callAnthropic(
        prompt, apiKey, modelName,
        'Extract contact information from business website content. Output strictly in valid JSON.',
      );
      const parsed = JSON.parse(textResult);
      return AIContactExtractionSchema.parse(parsed);
    } catch (error: unknown) {
      console.error('Anthropic contact extraction failed:', error);
      return { people: null, socialLinks: null, emails: null, phones: null };
    }
  }

  // OpenAI-compatible providers
  try {
    const url = 
      provider === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' :
      provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' :
      provider === 'nvidia' ? 'https://integrate.api.nvidia.com/v1/chat/completions' :
      provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' :
      provider === 'aiml' ? 'https://api.aimlapi.com/v1/chat/completions' :
      'https://api.openai.com/v1/chat/completions';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: 'Extract contact information from business website content. Output strictly in valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) throw new Error(`${provider} API returned status ${response.status}`);
    const result = (await response.json()) as any;
    let textResult = result.choices?.[0]?.message?.content;
    if (!textResult) throw new Error('Invalid response structure');

    textResult = textResult.trim().replace(/^```json?\n?/, '').replace(/\n```$/, '');
    const parsed = JSON.parse(textResult);
    return AIContactExtractionSchema.parse(parsed);
  } catch (error: unknown) {
    console.error(`${provider} contact extraction failed:`, error);
    return { people: null, socialLinks: null, emails: null, phones: null };
  }
}

export function generateMockOutreachDraft(
  leadName: string,
  companyName: string | null,
  websiteUrl: string | null,
  industry: string | null,
  channel: 'EMAIL' | 'LINKEDIN' | 'CALL' | 'MEETING',
  contactsList: any[],
  researchSnapshot: any | null,
  auditSnapshot: any | null
): AIOutreachDraftOutput {
  const name = companyName || leadName;
  const primaryContact = contactsList.find(c => c.isPrimary) || contactsList[0];
  const contactName = primaryContact ? primaryContact.name : 'there';
  const fallbackPrefix = '[Fallback — AI not configured. Edit before using.]\n\n';

  if (channel === 'EMAIL') {
    return { drafts: [{
      subject: `Question about ${name}'s digital presence`,
      body: `${fallbackPrefix}Hi ${contactName},\n\nI was looking at ${name}'s website and noticed opportunities to improve the brand presence and user flow. Happy to share a few specific thoughts if you're open to it.\n\nBest,\n[Your Name]`,
      variationTone: 'Direct',
    }]};
  } else if (channel === 'LINKEDIN') {
    return { drafts: [{
      subject: null,
      body: `${fallbackPrefix}Hi ${contactName}, I came across ${name} and noticed some opportunities on the website that could improve conversions. Would love to connect and share a quick thought.`,
      variationTone: 'Conversational',
    }]};
  } else if (channel === 'CALL') {
    return { drafts: [{
      subject: null,
      body: `${fallbackPrefix}CALL PREP FOR ${name.toUpperCase()}\n\nContact: ${contactName} (${primaryContact?.role || 'Stakeholder'})\n\nOpening:\n"Hi ${contactName}, I was reviewing ${name}'s digital presence and noticed a few opportunities I'd like to share."\n\nQuestions:\n- How are you currently handling website updates?\n- What's the biggest challenge with your current site?\n- What would success look like for a redesign?\n\nGoal: Schedule a discovery call.`,
      variationTone: 'Direct',
    }]};
  } else {
    return { drafts: [{
      subject: null,
      body: `${fallbackPrefix}MEETING PREP GUIDE FOR ${name.toUpperCase()}\n\nAttendee: ${contactName} (${primaryContact?.role || 'Decision Maker'})\n\nAgenda:\n1. Introductions and context\n2. ${name}'s current digital presence review\n3. Key opportunities identified\n4. Next steps\n\nQuestions:\n- What are your main conversion challenges?\n- How does your brand identity align with future goals?\n- What digital improvements would have the biggest impact?`,
      variationTone: 'Direct',
    }]};
  }
}

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
  const config = await getActiveProviderConfig(db, 'scoring');
  let provider = config?.provider || 'gemini';
  let apiKey = config?.apiKey || getEnvApiKey(provider);
  let modelName = config?.modelName || 'gemini-2.5-flash';

  if (!apiKey || apiKey === 'placeholder' || apiKey === '') {
    throw new Error(`API key for provider "${provider}" is not configured. Please set it in Settings -> Integrations.`);
  }

  const prompt = `Evaluate the following lead and assign a priority score from 0 to 100.
Lead Name: ${leadName}

--- RESEARCH SNAPSHOT ---
${JSON.stringify(researchSnapshot || {}, null, 2)}

--- DESIGN AUDIT ---
${JSON.stringify(auditSnapshot || {}, null, 2)}

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
}`;

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
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: 24000,
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
        const data = await response.json() as any;
        textResult = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else {
        throw new Error(`Gemini API returned status ${response.status}`);
      }
    } else if (provider === 'anthropic') {
      textResult = await callAnthropic(
        prompt, apiKey, modelName,
        'You are a lead scoring evaluator. Output strictly valid JSON.',
      );
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
    throw error;
  }
}
