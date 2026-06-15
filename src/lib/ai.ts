import { z } from 'zod';
import { Db } from '../db';

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
  websiteQualityScore: z.number().int().min(0).max(100),
  designAestheticScore: z.number().int().min(0).max(100),
  messagingClarityScore: z.number().int().min(0).max(100),
  socialPresenceScore: z.number().int().min(0).max(100),
  overallBrandingScore: z.number().int().min(0).max(100),
  keyStrengths: z.string(),
  keyWeaknesses: z.string(),
  recommendedImprovements: z.string(),
  sources: z.array(z.string()),
  isModern: z.boolean(),
  triageReason: z.string(),
});

export type AIAuditOutput = z.infer<typeof AIAuditSchema>;

export const AIOutreachDraftSchema = z.object({
  drafts: z.array(z.object({
    subject: z.string().nullable().optional(),
    body: z.string(),
    variationTone: z.string().optional()
  })).min(1).max(2)
});

export type AIOutreachDraftOutput = z.infer<typeof AIOutreachDraftSchema>;

/** Cache for vision capability checks. Key: "provider:modelName", Value: { result: boolean, timestamp: number } */
const _visionCapabilityCache = new Map<string, { result: boolean; timestamp: number }>();
const VISION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Cache for active provider config, keyed by Db instance.
 * Avoids redundant DB queries when multiple AI functions are called in the same scope.
 */
const _providerConfigWeakCache = new WeakMap<object, { config: { provider: string; apiKey: string | null; modelName: string | null } | null; timestamp: number }>();
const PROVIDER_CONFIG_CACHE_TTL_MS = 60_000; // 1 minute

import { IntegrationsService } from '../services/integrations';

/**
 * Resolves the active provider config once, caching the result by Db instance.
 * Subsequent calls within the same scope reuse the cached value.
 */
async function getActiveProviderConfig(db: Db) {
  const cached = _providerConfigWeakCache.get(db);
  if (cached && Date.now() - cached.timestamp < PROVIDER_CONFIG_CACHE_TTL_MS) {
    return cached.config;
  }

  const integrationsService = new IntegrationsService(db);
  let config: { provider: string; apiKey: string | null; modelName: string | null } | null = null;
  for (const p of ['openrouter', 'nvidia', 'groq', 'aiml', 'gemini'] as const) {
    const pConfig = await integrationsService.getProviderConfig(p);
    if (pConfig && pConfig.isActive) {
      config = { provider: pConfig.provider, apiKey: pConfig.apiKey, modelName: pConfig.modelName };
      break;
    }
  }

  _providerConfigWeakCache.set(db, { config, timestamp: Date.now() });
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
  const config = await getActiveProviderConfig(db);
  let provider = config?.provider || 'gemini';
  let apiKey = config?.apiKey || (process as any).env?.GEMINI_API_KEY;
  let modelName = config?.modelName || (
    provider === 'openrouter' ? 'google/gemini-2.5-flash' : 
    provider === 'nvidia' ? 'meta/llama-3.1-70b-instruct' : 
    provider === 'groq' ? 'llama3-70b-8192' :
    provider === 'aiml' ? 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning' :
    'gemini-2.5-flash'
  );

  if (!apiKey || apiKey === 'placeholder' || apiKey === '') {
    return generateMockResearch(leadName, companyName, websiteUrl, industry);
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

  if (provider === 'openrouter') {
    return callOpenRouterAPI(apiKey, modelName, prompt, leadName, companyName, websiteUrl, industry);
  }

  if (provider === 'nvidia') {
    return callNvidiaAPI(apiKey, modelName, prompt, leadName, companyName, websiteUrl, industry);
  }

  if (provider === 'groq') {
    return callGroqAPI(apiKey, modelName, prompt, leadName, companyName, websiteUrl, industry);
  }

  if (provider === 'aiml') {
    return callAimlAPI(apiKey, modelName, prompt, leadName, companyName, websiteUrl, industry);
  }

  // Gemini implementation
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
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
                sources: {
                  type: 'ARRAY',
                  items: { type: 'STRING' },
                },
                confidenceLevel: {
                  type: 'STRING',
                  enum: ['LOW', 'MEDIUM', 'HIGH'],
                },
              },
              required: [
                'companySummary',
                'productsServicesSummary',
                'digitalPresenceNotes',
                'websiteNotes',
                'brandingNotes',
                'painPointsHypotheses',
                'opportunityHypotheses',
                'sources',
                'confidenceLevel',
              ],
            },
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API returned status ${response.status}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
          }>;
        };
      }>;
    };
    const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResult) {
      throw new Error('Invalid response structure from Gemini API');
    }

    const parsed = JSON.parse(textResult);
    return AIResearchSchema.parse(parsed);
  } catch (error: unknown) {
    console.error('Gemini API call failed, falling back to mock generator:', error);
    return generateMockResearch(leadName, companyName, websiteUrl, industry);
  }
}

async function callNvidiaAPI(
  apiKey: string,
  modelName: string,
  prompt: string,
  leadName: string,
  companyName: string | null,
  websiteUrl: string | null,
  industry: string | null
): Promise<AIResearchOutput> {
  const jsonSchema = {
    type: 'object',
    properties: {
      companySummary: { type: 'string' },
      productsServicesSummary: { type: 'string' },
      digitalPresenceNotes: { type: 'string' },
      websiteNotes: { type: 'string' },
      brandingNotes: { type: 'string' },
      painPointsHypotheses: { type: 'string' },
      opportunityHypotheses: { type: 'string' },
      sources: {
        type: 'array',
        items: { type: 'string' },
      },
      confidenceLevel: {
        type: 'string',
        enum: ['LOW', 'MEDIUM', 'HIGH'],
      },
    },
    required: [
      'companySummary',
      'productsServicesSummary',
      'digitalPresenceNotes',
      'websiteNotes',
      'brandingNotes',
      'painPointsHypotheses',
      'opportunityHypotheses',
      'sources',
      'confidenceLevel',
    ],
    additionalProperties: false,
  };

  const makeRequest = async (format: { type: string; [key: string]: unknown }, isFallback: boolean = false) => {
    const messages = [
      {
        role: 'system',
        content: isFallback 
          ? 'You are a senior competitive intelligence analyst. Output strictly in valid JSON matching the requested schema. No markdown code blocks, no extra text.' 
          : 'You are a senior competitive intelligence analyst. Output strictly in JSON.'
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        max_tokens: 1024,
        temperature: 0.2,
        response_format: format,
      }),
    });

    return response;
  };

  try {
    // 1. Try strict JSON schema
    let response = await makeRequest({
      type: 'json_schema',
      json_schema: {
        name: 'ai_research',
        schema: jsonSchema,
        strict: true
      }
    });

    // 2. Catch API errors (e.g. 400/422 unsupported parameter) and fallback
    if (!response.ok && (response.status === 400 || response.status === 422)) {
      console.warn(`NVIDIA API strict schema failed (${response.status}), falling back to json_object`);
      response = await makeRequest({ type: 'json_object' }, true);
    }

    if (!response.ok) {
      throw new Error(`NVIDIA API returned status ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };
    let textResult = data.choices?.[0]?.message?.content;
    
    if (!textResult) {
      throw new Error('Invalid response structure from NVIDIA API');
    }

    // Defensive parsing: Strip markdown if present
    textResult = textResult.trim();
    if (textResult.startsWith('```json')) {
      textResult = textResult.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (textResult.startsWith('```')) {
      textResult = textResult.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    let parsed;
    try {
      parsed = JSON.parse(textResult);
    } catch (parseError: unknown) {
      console.error('Failed to parse NVIDIA JSON output on first attempt. Retrying with reinforced prompt.');
      // 3. Retry once with a reinforced prompt
      const retryResponse = await makeRequest({ type: 'json_object' }, true);
      if (!retryResponse.ok) throw new Error('Retry failed');
      const retryData = (await retryResponse.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      };
      let retryText = retryData.choices?.[0]?.message?.content || '';
      retryText = retryText.trim().replace(/^```json\n/, '').replace(/\n```$/, '');
      parsed = JSON.parse(retryText);
    }

    // 4. Validate schema conformance via Zod
    return AIResearchSchema.parse(parsed);
  } catch (error: unknown) {
    console.error('NVIDIA API call failed, falling back to mock generator:', error);
    return generateMockResearch(leadName, companyName, websiteUrl, industry);
  }
}

function generateMockResearch(
  leadName: string,
  companyName: string | null,
  websiteUrl: string | null,
  industry: string | null
): AIResearchOutput {
  const name = companyName || leadName;
  const ind = (industry || 'General Business').toLowerCase();
  const web = websiteUrl || '';

  let companySummary = `${name} is an established company operating in the ${ind} industry, focusing on expanding their market presence.`;
  let productsServicesSummary = `They offer a range of specialized services and products tailored to their customer base.`;
  let digitalPresenceNotes = `Lacks cohesive social media activity. Only a placeholder LinkedIn profile was discovered with low updates.`;
  let websiteNotes = `Their website design is functional but outdated, using old responsive practices. Mobile loading time is slow, and there is no clear call to action on the landing page.`;
  let brandingNotes = `Typography is inconsistent across pages, using default web fonts. The color scheme is muted and lacks the premium visual hierarchy expected in modern branding.`;
  let painPointsHypotheses = `Struggling to convert website visitors due to friction in user experience and slow page loads. Weak online authority due to minimal social presence.`;
  let opportunityHypotheses = `We can design a modern, high-conversion landing page, refresh their branding to look premium, and create custom social media template systems.`;
  const sources = [web || `https://${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`, `https://www.google.com/search?q=${encodeURIComponent(name)}`].filter(Boolean);

  if (ind.includes('tech') || ind.includes('software') || ind.includes('digital')) {
    companySummary = `${name} is a fast-growing technology firm specializing in digital solutions, cloud systems, or software engineering.`;
    productsServicesSummary = `They sell software-as-a-service platforms or tech consulting services to business clients.`;
    digitalPresenceNotes = `Has an active LinkedIn profile but lacks high-quality content or developer-focused marketing assets. Minimal GitHub activity or technical content marketing.`;
    websiteNotes = `The website utilizes standard templates which look generic and dry. User onboarding steps are not visually guided, causing potential drop-off.`;
    brandingNotes = `Modern tech aesthetic but lacks personality. The color palette is generic blue/gray and feels indistinguishable from competitors.`;
    painPointsHypotheses = `Lacks premium interactive demos on their website. Hard to stand out in a saturated software market with template-based branding.`;
    opportunityHypotheses = `We can develop interactive landing page demos, create a high-fidelity visual identity refresh, and produce tech-focused visual assets.`;
  } else if (ind.includes('retail') || ind.includes('shop') || ind.includes('commerce') || ind.includes('brand')) {
    companySummary = `${name} is a consumer brand focusing on retail or direct-to-consumer e-commerce sales.`;
    productsServicesSummary = `They sell physical products, apparel, or consumer goods online.`;
    digitalPresenceNotes = `Active Instagram presence but lacks visually consistent grid styling. Brand voice in captions is generic.`;
    websiteNotes = `The shopping cart checkout flow is multi-stage and clunky. Loading product images is delayed. Product detail pages lack interactive elements or video previews.`;
    brandingNotes = `Logo is basic text and colors don't reflect the warmth or luxury of their product line. Lacks premium packaging/unboxing visual branding.`;
    painPointsHypotheses = `High checkout abandonment rate. Inability to command premium pricing due to a standard e-commerce visual presence.`;
    opportunityHypotheses = `We can redesign their Shopify/commerce layout for single-page checkout UX, rebuild product detail templates, and establish a high-end editorial branding system.`;
  }

  return {
    companySummary,
    productsServicesSummary,
    digitalPresenceNotes,
    websiteNotes,
    brandingNotes,
    painPointsHypotheses,
    opportunityHypotheses,
    sources,
    confidenceLevel: 'MEDIUM',
  };
}

async function callOpenRouterAPI(
  apiKey: string,
  modelName: string,
  prompt: string,
  leadName: string,
  companyName: string | null,
  websiteUrl: string | null,
  industry: string | null
): Promise<AIResearchOutput> {
  const makeRequest = async () => {
    const messages = [
      {
        role: 'system',
        content: 'You are a senior competitive intelligence analyst. Output strictly in valid JSON matching the requested schema. No markdown code blocks, no extra text.'
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://github.com/googlemind/leadroom',
        'X-Title': 'Draftroom',
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        temperature: 0.2,
        response_format: { type: 'json_object' }
      }),
    });

    return response;
  };

  try {
    const response = await makeRequest();
    if (!response.ok) {
      throw new Error(`OpenRouter API returned status ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };
    let textResult = data.choices?.[0]?.message?.content;
    
    if (!textResult) {
      throw new Error('Invalid response structure from OpenRouter API');
    }

    textResult = textResult.trim();
    if (textResult.startsWith('```json')) {
      textResult = textResult.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (textResult.startsWith('```')) {
      textResult = textResult.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    const parsed = JSON.parse(textResult);
    return AIResearchSchema.parse(parsed);
  } catch (error: unknown) {
    console.error('OpenRouter API call failed, falling back to mock generator:', error);
    return generateMockResearch(leadName, companyName, websiteUrl, industry);
  }
}

/**
 * Lightweight heuristic triage — replaces the removed AI-based runTriageAI.
 * Analyzes raw HTML/text content for telltale signals of modernity.
 * Returns { isModern, reason } that maps to the old MODERN/OUTDATED scheme.
 */
export type HeuristicTriageResult = { isModern: boolean; reason: string };

export function heuristicSiteTriage(scrapedContent: string): HeuristicTriageResult {
  const lower = scrapedContent.toLowerCase();

  // Positive signals (modern)
  const hasViewport = /viewport|meta\s*name\s*=\s*["']viewport["']/i.test(lower);
  const hasModernFramework = /next\.js|tailwind|react\.js|vue\.js|nuxt|gatsby|remix|vite|chakra|shadcn|bootstrap\s*5/i.test(lower);
  const hasWebFont = /@font-face|googleapis\.com\/css|fonts\.googleapis|font\.awesome|typekit|netdna\.bootstrapcdn/i.test(lower);
  const hasRecentCopyright = /copyright\s*(?:©|\(c\))?\s*(202[3-9]|202[0-9]|20[2-9]\d)/i.test(lower);
  const hasDynamicYear = /\$currentYear|new\s*Date\(\)\.getFullYear|date\.now\s*\(\s*\)|{\s*year\s*}/i.test(lower);

  // Negative signals (outdated)
  const hasOldCopyright = /copyright\s*(?:©|\(c\))?\s*(19\d{2}|200\d|201[0-7])/i.test(lower);
  const hasTableLayout = /<table\s*(?:border|width|cellpadding|cells?pacing)/i.test(lower) && /<tr>|<\/tr>/i.test(lower);
  const hasFlashOrObject = /<object\s|classid\s*=|flash|\.swf|embed\s*src/i.test(lower);
  const hasFontTag = /<font\s+(?:size|face|color)/i.test(lower);
  const hasSpacerGif = /spacer\.gif|pixel\.gif|1x1\.gif|blank\.gif/i.test(lower);
  const hasAncientCMS = /powered\s+by\s+(?:oscommerce|zen\s*cart|mambo|joomla\s*1|drupal\s*[45]|phpbb|vbulletin)/i.test(lower);
  const hasUnderConstruction = /under\s*construction|coming\s*soon|site\s*unavailable/i.test(lower);
  const noViewport = !hasViewport;
  const verySparse = scrapedContent.length < 300 && !hasModernFramework;

  // Scoring: count signals
  let modernScore = 0;
  let outdatedScore = 0;

  if (hasViewport) modernScore += 2;
  if (hasModernFramework) modernScore += 3;
  if (hasWebFont) modernScore += 2;
  if (hasRecentCopyright || hasDynamicYear) modernScore += 2;

  if (hasOldCopyright) outdatedScore += 3;
  if (hasTableLayout) outdatedScore += 3;
  if (hasFlashOrObject) outdatedScore += 4;
  if (hasFontTag) outdatedScore += 2;
  if (hasSpacerGif) outdatedScore += 3;
  if (hasAncientCMS) outdatedScore += 3;
  if (hasUnderConstruction) outdatedScore += 4;
  if (noViewport) outdatedScore += 2;
  if (verySparse) outdatedScore += 2;

  // Evidence list for the reason
  const evidence: string[] = [];
  if (hasViewport) evidence.push('viewport meta present');
  if (hasModernFramework) evidence.push('modern framework detected');
  if (hasOldCopyright) evidence.push('older copyright detected');
  if (hasTableLayout) evidence.push('table-based layout detected');
  if (hasFlashOrObject) evidence.push('Flash/object tags present');
  if (hasUnderConstruction) evidence.push('page is under construction');
  if (noViewport) evidence.push('missing viewport meta (not mobile-responsive)');
  if (verySparse) evidence.push('very sparse content');

  const isModern = modernScore >= outdatedScore && modernScore >= 2;
  const fallbackReason = scrapedContent.length < 100
    ? 'Content too sparse to assess.'
    : 'No strong signals either way — defaulting to modern (treat as viable prospect).';

  const reason = evidence.length > 0
    ? `Site appears ${isModern ? 'modern' : 'outdated'}: ${evidence.join(', ')}.`
    : fallbackReason;

  return { isModern, reason };
}

async function callGroqAPI(
  apiKey: string,
  modelName: string,
  prompt: string,
  leadName: string,
  companyName: string | null,
  websiteUrl: string | null,
  industry: string | null
): Promise<AIResearchOutput> {
  const makeRequest = async () => {
    const messages = [
      {
        role: 'system',
        content: 'You are a senior competitive intelligence analyst. Output strictly in valid JSON matching the requested schema. No markdown code blocks, no extra text.'
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        temperature: 0.2,
        response_format: { type: 'json_object' }
      }),
    });

    return response;
  };

  try {
    const response = await makeRequest();
    if (!response.ok) {
      throw new Error(`Groq API returned status ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };
    let textResult = data.choices?.[0]?.message?.content;
    
    if (!textResult) {
      throw new Error('Invalid response structure from Groq API');
    }

    textResult = textResult.trim();
    if (textResult.startsWith('```json')) {
      textResult = textResult.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (textResult.startsWith('```')) {
      textResult = textResult.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    const parsed = JSON.parse(textResult);
    return AIResearchSchema.parse(parsed);
  } catch (error: unknown) {
    console.error('Groq API call failed, falling back to mock generator:', error);
    return generateMockResearch(leadName, companyName, websiteUrl, industry);
  }
}

async function callAimlAPI(
  apiKey: string,
  modelName: string,
  prompt: string,
  leadName: string,
  companyName: string | null,
  websiteUrl: string | null,
  industry: string | null
): Promise<AIResearchOutput> {
  const makeRequest = async () => {
    const messages = [
      {
        role: 'system',
        content: 'You are a senior competitive intelligence analyst. Output strictly in valid JSON matching the requested schema. No markdown code blocks, no extra text.'
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    const response = await fetch('https://api.aimlapi.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        temperature: 0.2,
        response_format: { type: 'json_object' }
      }),
    });

    return response;
  };

  try {
    const response = await makeRequest();
    if (!response.ok) {
      throw new Error(`AIML API returned status ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };
    let textResult = data.choices?.[0]?.message?.content;
    
    if (!textResult) {
      throw new Error('Invalid response structure from AIML API');
    }

    textResult = textResult.trim();
    if (textResult.startsWith('```json')) {
      textResult = textResult.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (textResult.startsWith('```')) {
      textResult = textResult.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    const parsed = JSON.parse(textResult);
    return AIResearchSchema.parse(parsed);
  } catch (error: unknown) {
    console.error('AIML API call failed, falling back to mock generator:', error);
    return generateMockResearch(leadName, companyName, websiteUrl, industry);
  }
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
  const config = await getActiveProviderConfig(db);
  let provider = config?.provider || 'gemini';
  let apiKey = config?.apiKey || (process as any).env?.GEMINI_API_KEY;
  let modelName = config?.modelName || (
    provider === 'openrouter' ? 'google/gemini-2.5-flash' : 
    provider === 'nvidia' ? 'meta/llama-3.1-70b-instruct' : 
    provider === 'groq' ? 'llama3-70b-8192' :
    provider === 'aiml' ? 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning' :
    'gemini-2.5-flash'
  );

  if (!apiKey || apiKey === 'placeholder' || apiKey === '') {
    return generateMockAudit(leadName, companyName, websiteUrl, industry);
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

You are a senior design and UX auditor at a creative/digital agency. Your job is to produce a structured, evidence-based evaluation of a lead's digital presence — scoring their website, design, messaging, and social footprint — so the account team knows exactly where to focus and what to pitch.

---

## 1. MINDSET

You are the agency's expert witness. Your scores and commentary will be used to:
- Decide whether a lead is worth pursuing at all
- Frame the first conversation around specific, undeniable weaknesses
- Support the proposal with credible, third-party-feeling evidence

Be generous where deserved and ruthless where needed. A lead who gets a 90 across the board probably doesn't need the agency's help — flag that honestly. A lead who gets a 30 everywhere is neglected but may be a high-conversion opportunity.

You do not exist to flatter or to sell. You exist to tell the truth clearly enough that the account team can sell against it.

---

## 2. SCORING METHODOLOGY

Each score is 0-100. The scale is calibrated to real-world competitive standards within the lead's industry, not absolute perfection.

**websiteQualityScore:**
- 80-100: Fast, responsive, well-structured, logical IA, clear CTAs, professional polish
- 60-79: Functional but has friction — slow load indicators, unclear navigation, weak CTA placement
- 40-59: Dated layout, poor mobile behavior, cluttered UI, missing key pages
- 0-39: Broken, inaccessible, table-based, no viewport config, placeholder content

**designAestheticScore:**
- 80-100: Intentional typography system, custom palette, generous whitespace, cohesive visual language
- 60-79: Decent baseline but uses templates or default components visibly
- 40-59: Inconsistent spacing, mismatched fonts, default browser styling, no design system
- 0-39: Looks untouched or assembled from conflicting sources

**messagingClarityScore:**
- 80-100: Value proposition is clear within 3 seconds of landing. Headline + subheadline + supporting evidence
- 60-79: Messaging exists but buried in paragraphs or jargon
- 40-59: Generic or vague ("we provide solutions"), no differentiation from competitors
- 0-39: No clear messaging, just lists of services or product names

**socialPresenceScore:**
- Base this ONLY on evidence you have. If contextBlock contains research with social links, evaluate them.
- If the context says "No detectable social presence", score 15-25
- If no social data is available at all, score 40-50 as a neutral default
- Do not fabricate a score based on assumptions about their industry

**overallBrandingScore:**
- A weighted composite feel of all the above plus brand consistency across what you can see
- Key question: Does this brand look like someone invested in how they're perceived?

---

## 3. TEXT FIELD INSTRUCTIONS

**keyStrengths** — Format as a markdown bullet list. Each bullet must reference a specific, observable element. "Clean navigation with 4 clear categories" not "good layout."

**keyWeaknesses** — Format as a markdown bullet list. These are your leverage points. Each weakness should read like something the account team could open a conversation with. "The hero section has no headline — just a logo and a menu" is actionable.

**recommendedImprovements** — Format as a markdown bullet list. Concrete, specific, and ordered by impact. "Replace the 47-word value proposition with a 3-word headline and 10-word subheadline" is better than "improve messaging." These are mini-proposal items.

**sources** — URL array of what you actually examined. Always include the website URL.

**isModern** — Set to true if websiteQualityScore >= 60 (the site looks credible and maintained). Set to false if below 60 (the site needs significant work and is a viable prospect for agency services).

**triageReason** — A 1-sentence summary that explains the isModern classification, referencing the most decisive score or specific observation.

---

## 4. CONTEXT HANDLING RULES

- If the contextBlock includes scraped website content, use it as your primary scoring source
- If the contextBlock includes research observations but no scraped content, base scores on those observations and note uncertainty in your text fields
- If the contextBlock is empty, state that scoring is speculative due to no available data
- Never penalize for things you cannot see. If you have no social data, the socialPresenceScore should be neutral (40-50), not 0

---

## 5. ANTI-PATTERNS

- Do not give every lead the same scores — differentiate based on evidence
- Do not assign a 0 to any category unless the site is genuinely broken or missing entirely
- Do not assign a 100 to any category — nothing is perfect
- Do not write strengths that sound like faint praise ("the logo exists")
- Do not write weaknesses that are unsupported by evidence in the context block
- Do not use the word "good", "nice", "decent", "solid" without a specific reason

---

Provide your response strictly in JSON format matching this schema:
{
  "websiteQualityScore": 75,
  "designAestheticScore": 60,
  "messagingClarityScore": 55,
  "socialPresenceScore": 40,
  "overallBrandingScore": 60,
  "keyStrengths": "- Specific strength 1\\n- Specific strength 2",
  "keyWeaknesses": "- Specific weakness 1\\n- Specific weakness 2",
  "recommendedImprovements": "- Improvement 1\\n- Improvement 2",
  "sources": ["URLs checked"],
  "isModern": true,
  "triageReason": "The site has a modern responsive layout with clear messaging but weak social presence."
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
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                properties: {
                  websiteQualityScore: { type: 'INTEGER' },
                  designAestheticScore: { type: 'INTEGER' },
                  messagingClarityScore: { type: 'INTEGER' },
                  socialPresenceScore: { type: 'INTEGER' },
                  overallBrandingScore: { type: 'INTEGER' },
                  keyStrengths: { type: 'STRING' },
                  keyWeaknesses: { type: 'STRING' },
                  recommendedImprovements: { type: 'STRING' },
                  sources: { type: 'ARRAY', items: { type: 'STRING' } },
                  isModern: { type: 'BOOLEAN' },
                  triageReason: { type: 'STRING' },
                },
                required: [
                  'websiteQualityScore',
                  'designAestheticScore',
                  'messagingClarityScore',
                  'socialPresenceScore',
                  'overallBrandingScore',
                  'keyStrengths',
                  'keyWeaknesses',
                  'recommendedImprovements',
                  'sources',
                  'isModern',
                  'triageReason',
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
    } else {
      // OpenAI compatible endpoints (OpenRouter, Groq, Nvidia, AIML)
      const url = 
        provider === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' :
        provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' :
        provider === 'nvidia' ? 'https://integrate.api.nvidia.com/v1/chat/completions' :
        'https://api.aimlapi.com/v1/chat/completions';

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: 'You are a senior design and UX auditor. Output strictly in valid JSON matching the requested schema.' },
            { role: 'user', content: prompt }
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
    return AIAuditSchema.parse(parsed);
  } catch (error: unknown) {
    console.error(`generateAudit API call failed for ${provider}, falling back to mock:`, error);
    return generateMockAudit(leadName, companyName, websiteUrl, industry);
  }
}

function generateMockAudit(
  leadName: string,
  companyName: string | null,
  websiteUrl: string | null,
  industry: string | null
): AIAuditOutput {
  const name = companyName || leadName;
  const ind = (industry || 'General Business').toLowerCase();
  
  let websiteQualityScore = 65;
  let designAestheticScore = 55;
  let messagingClarityScore = 60;
  let socialPresenceScore = 40;
  let overallBrandingScore = 55;

  let keyStrengths = `- Clean baseline layout and core sections\n- Direct contact information is visible in the header`;
  let keyWeaknesses = `- Lacks a modern mobile-responsive grid layout\n- Slow asset loading times for heavy images\n- Outdated default browser typography is used`;
  let recommendedImprovements = `- Redesign website layout with a modern, responsive grid system (Next.js/Tailwind)\n- Apply a cohesive visual style guide with Outfit or Inter fonts\n- Simplify contact flow into a single-step booking form`;

  if (ind.includes('tech') || ind.includes('software') || ind.includes('digital')) {
    websiteQualityScore = 70;
    designAestheticScore = 60;
    messagingClarityScore = 50;
    socialPresenceScore = 55;
    overallBrandingScore = 58;

    keyStrengths = `- Uses a standard modern dark-mode template\n- Key features list is easy to read`;
    keyWeaknesses = `- Generic visual identity that looks identical to standard SaaS competitors\n- Vague messaging ("innovative solutions") with no direct value proposition\n- Checkout or product signup flow is overly complex`;
    recommendedImprovements = `- Rewrite the value proposition to be immediately clear and distinct\n- Build high-end custom interactive mockups of the dashboard app\n- Refresh the brand color palette to a harmonized, premium HSL palette`;
  }

  return {
    websiteQualityScore,
    designAestheticScore,
    messagingClarityScore,
    socialPresenceScore,
    overallBrandingScore,
    keyStrengths,
    keyWeaknesses,
    recommendedImprovements,
    sources: websiteUrl ? [websiteUrl] : [`https://${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`],
    isModern: websiteQualityScore >= 60,
    triageReason: websiteQualityScore >= 60
      ? `Website quality score of ${websiteQualityScore} indicates a functional and maintained site.`
      : `Website quality score of ${websiteQualityScore} indicates significant room for improvement.`,
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
  const config = await getActiveProviderConfig(db);
  let provider = config?.provider || 'gemini';
  let apiKey = config?.apiKey || (process as any).env?.GEMINI_API_KEY;
  let modelName = config?.modelName || (
    provider === 'openrouter' ? 'google/gemini-2.5-flash' : 
    provider === 'nvidia' ? 'meta/llama-3.1-70b-instruct' : 
    provider === 'groq' ? 'llama3-70b-8192' :
    provider === 'aiml' ? 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning' :
    'gemini-2.5-flash'
  );

  if (!apiKey || apiKey === 'placeholder' || apiKey === '') {
    return generateMockOutreachDraft(leadName, companyName, websiteUrl, industry, channel, contactsList, researchSnapshot, auditSnapshot);
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
${auditSnapshot ? `Website & Branding Audit Context:\n- Website Quality Score: ${auditSnapshot.websiteQualityScore}/100\n- Design Aesthetic Score: ${auditSnapshot.designAestheticScore}/100\n- Messaging Clarity: ${auditSnapshot.messagingClarityScore}/100\n- Social Presence: ${auditSnapshot.socialPresenceScore}/100\n- Overall Branding Score: ${auditSnapshot.overallBrandingScore}/100\n- Key Strengths: ${auditSnapshot.keyStrengths || 'N/A'}\n- Key Weaknesses: ${auditSnapshot.keyWeaknesses || ''}\n- Recommended Improvements: ${auditSnapshot.recommendedImprovements || ''}\n` : ''}
${customPrompt ? `\nSPECIAL INSTRUCTIONS FROM THE OPERATOR:\n${customPrompt}\n` : ''}
${attachments && attachments.length > 0 ? `\nNote: The operator has attached ${attachments.length} files (images or PDFs) showing mockup/branding/website context. Please reference or adapt your feedback specifically incorporating visual details or document findings if vision support is active.\n` : ''}
You are a senior growth strategist at a creative/digital agency. Your function is to produce outreach that feels like a peer-level consultant offering a specific, valuable observation — not a vendor fishing for a meeting.

---

## 1. MINDSET & PERSONA

You are not a salesperson. You are someone who noticed something specific about their business and took the time to articulate it. The lead should think: "They actually looked at our site. They get what we're doing. This is worth 5 minutes."

Tone rules:
- Assume the reader is intelligent, busy, and has been pitched 50+ times this month
- Your email is competing for attention against their actual work
- The goal is not to close a deal — the goal is to get a reply that says "interesting, tell me more"
- Every sentence must either: demonstrate understanding, provoke curiosity, or offer a specific observation

---

## 2. PSYCHOLOGICAL PRINCIPLES (use naturally, never mechanically)

**Reciprocity** — Give genuine value before asking for anything. Your specific observation about their website/brand IS the gift. It shows you invested time.

**Specificity = Credibility** — Vague praise is noise. Specific critique is proof of work. "Your hero section has a 47-word value proposition" lands harder than "your messaging could be clearer."

**Pattern Interrupt** — Open with something that breaks the "another sales email" pattern. Examples:
- A one-word observation about their site
- A question about a specific design choice
- A reference to a recent change or news about their company

**Loss Aversion** — Frame improvements around what they're leaving on the table (lost leads, competitor advantage), not what's broken. "Your site is doing X well, but Y is likely costing you Z conversions" is stronger than "your site needs fixing."

**Social Proof (implied)** — Never name clients. Instead: "We've helped similar [industry] companies improve [metric] by [approach]." The specific industry match does the proof work.

**Commitment & Consistency** — Ask for small, easy agreements first. "Would it be useful if I sent you a 3-point UX audit?" is easier to say yes to than "can we schedule a call?" The small yes leads to the larger one.

**Curiosity Gap** — Leave something unexplained that they have to reply to resolve. "I noticed something unusual about your mobile menu behavior" creates a gap they want closed.

---

## 3. CHANNEL-SPECIFIC ARCHITECTURE

### EMAIL

Subject line:
- Must be specific to them: "[Company name] · [observation]" or "[Observation] on your [industry] site"
- Never: "Let's connect", "Partnership opportunity", "Quick question"
- Use sentence case, not Title Case
- 4-7 words max
- If the contact has a LinkedIn, reference something from their profile in subject

Body structure (3-4 paragraphs, never more):
1. **Credibility opener** (1 sentence) — Reference something specific you observed. Not their name. Not "hope you're well." Start with substance.
2. **Observation + implication** (2-3 sentences) — What you noticed + why it matters to their business. Connect the observation to a business outcome (leads, conversions, trust, engagement).
3. **Value hypothesis** (1-2 sentences) — A concrete way you'd approach fixing or improving it. This is your proof of expertise.
4. **Soft CTA** (1 sentence) — Specific and low-friction. Examples:
   - "If that resonates, I can send a few thoughts."
   - "Would a 5-minute walkthrough of how [competitor in same space] handles this be useful?"
   - "Happy to share a quick audit if you're curious."

Never end with:
- "Let me know if you're interested"
- "Looking forward to hearing from you"
- "Hope to connect soon"
- Any form of "let's hop on a call"

Signature: First name only. No title, no company name, no phone number.

### LINKEDIN

- No subject
- First line must reference something from their profile (a post, a job change, a company milestone) — prove you looked at their profile
- Second line: your observation about their site/brand (1 sentence max)
- Third line: a specific, low-friction offer (1 sentence)
- Never include links in the first message
- Never pitch in the connection request note — save it for after they accept
- Character count: under 300

### CALL (prep script)

Structure:

**Opening (memorized, not read):**
"Hi [name], I'm [your name]. I was looking at [company]'s website earlier and noticed [specific observation]. I've got about 90 seconds — if that's a bad time I can send a quick email instead."

This does three things: proves homework, respects their time, gives an escape route (disarms pressure).

**Discovery questions (3-5, escalating from general to specific):**
- Round 1: "How are you currently handling [area related to observation]?"
- Round 2: "What's the biggest bottleneck you're seeing with [specific weakness]?"
- Round 3: "If you could wave a wand and change one thing about [area], what would it be?"
- Round 4: "Have you looked at [competitor or industry reference]'s approach?"
- Round 5: "What would need to be true for you to consider making a change here?"

**Value anchors (drop these naturally into the conversation):**
- "We've typically seen [specific improvement] for companies with similar [pain point]"
- "One approach that's worked in your space is [specific tactic]"
- "The data usually shows that [metric] improves by [rough range] when [approach] is done"

**Objection handling (pre-written):**
- "We're happy with our current setup" → "That's fair. Out of curiosity, what was the last thing you tested or changed on the site?"
- "We don't have budget right now" → "Understood. What would the trigger be for that to change — a specific growth target or something else?"
- "Send me some information" → Send a specific, short, personalized document — not a brochure.

**Close:**
Summarize what you heard + propose one specific next step. "Based on what you've said, the highest-impact move would be [specific action]. I can put together a rough proposal by [day] if that's useful."

### MEETING / VISIT PREP

**Agenda items (4-6, each with):**
- Topic
- 2-3 discovery questions specific to this topic
- What to bring or reference (screenshots, competitor examples, audit findings)
- Desired outcome (what you want to learn or confirm by the end of this agenda item)

Example agenda item (in your output, use plain markdown):
Topic: Current customer acquisition funnel
Questions: What are the top 2 channels driving leads today? Where in the funnel do you see the most drop-off? How are you currently tracking conversion rates?
Bring: Screenshots of current analytics + their primary landing page
Outcome: Identify the weakest stage in their funnel for the proposal focus

---

## 4. LANGUAGE PATTERNS

**Instead of "I think..."** → Use "Our experience with similar [industry] companies shows..."
(Authority framing — you've done this before)

**Instead of "You should..."** → Use "One approach that's been effective in similar situations is..."
(Implication of possibility, not prescription)

**Instead of "We can help you..."** → Use "Companies in your space typically see X when they address Y"
(Third-party evidence, removes sales pressure)

**Instead of "I wanted to reach out..."** → Delete this phrase entirely. It's filler. Start with your observation.

**Instead of "Does this sound interesting?"** → Use "Does this match what you're seeing?"
(Assumptive — you're validating, not pitching)

**Instead of "I'd love to..."** → Use what you'd actually do. "I can send a..." not "I'd love to send a..."

**Opening hook templates:**
- "Noticed your site does X well, but Y is probably costing you Z leads/month."
- "Your [specific page] has an interesting approach to [topic]. Have you tested [alternative]?"
- "Looked at [company]'s site. The [specific element] caught my attention — here's why."
- "Quick observation on your [industry] site: [specific finding]. Relevant?"

---

## 5. ANTI-PATTERNS (never do these)

- Never use the word "synergy," "leverage," "circle back," "touch base," "solution," "ecosystem," "holistic," "paradigm," "game-changer," or "best-in-class"
- Never open with "I hope this email finds you well" or any variant
- Never apologize for reaching out ("sorry to bother you", "I know you're busy")
- Never use exclamation marks in EMAIL or LINKEDIN
- Never make claims you can't support with the data you have
- Never reference "our agency" more than once
- Never use the lead's name more than once (greeting only)
- Never mention pricing, discounts, packages, or "bundles"
- Never attach files to cold email
- Never write more than 4 paragraphs in EMAIL or 3 sentences in LINKEDIN first message
- Never end with a question that can be answered "no" — end with a low-friction offer or an observation that invites a reply

Provide your response strictly in JSON format. The response must match the following JSON schema:
{
  "drafts": [
    {
      "subject": "Compelling subject line (string or null)",
      "body": "The drafted message body or call prep guide (string)",
      "variationTone": "e.g. Direct/Value-led or Conversational/Soft"
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
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                properties: {
                  drafts: {
                    type: 'ARRAY',
                    items: {
                      type: 'OBJECT',
                      properties: {
                        subject: { type: 'STRING' },
                        body: { type: 'STRING' },
                        variationTone: { type: 'STRING' }
                      },
                      required: ['body']
                    }
                  }
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
    } else {
      const url = 
        provider === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' :
        provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' :
        provider === 'nvidia' ? 'https://integrate.api.nvidia.com/v1/chat/completions' :
        'https://api.aimlapi.com/v1/chat/completions';

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
    console.error(`generateOutreachDraft API call failed for ${provider}, falling back to mock:`, error);
    return generateMockOutreachDraft(leadName, companyName, websiteUrl, industry, channel, contactsList, researchSnapshot, auditSnapshot);
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
          'X-Title': 'Draftroom',
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

  const visionKeywords = ['vision', 'llava', 'pixtral', 'gemini', 'claude-3', 'gpt-4o', 'gpt-4-vision', 'llama-3.2-11b', 'llama-3.2-90b'];
  const fallbackResult = visionKeywords.some(keyword => m.includes(keyword)) && !m.includes('embedding');
  _visionCapabilityCache.set(cacheKey, { result: fallbackResult, timestamp: Date.now() });
  return fallbackResult;
}

export async function getModelInfo(db: Db): Promise<{ provider: string; modelName: string; hasVision: boolean }> {
  const config = await getActiveProviderConfig(db);
  const provider = config?.provider || 'gemini';
  const apiKey = config?.apiKey || (process as any).env?.GEMINI_API_KEY;
  const modelName = config?.modelName || (
    provider === 'openrouter' ? 'google/gemini-2.5-flash' : 
    provider === 'nvidia' ? 'meta/llama-3.1-70b-instruct' : 
    provider === 'groq' ? 'llama3-70b-8192' :
    provider === 'aiml' ? 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning' :
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
  const score = auditSnapshot ? auditSnapshot.overallBrandingScore : 50;

  if (channel === 'EMAIL') {
    const subject = `Question about ${name}'s digital presence`;
    const body = `Hi ${contactName},\n\nI was looking at ${name}'s website (${websiteUrl || 'your website'}) and noticed a few opportunities to improve your brand presence and user flow. Our digital agency ran a quick assessment and identified that while you have great strengths, there are key areas we can help with, particularly:\n\n${auditSnapshot?.keyWeaknesses || '- Outdated mobile responsive layout\n- Slow loading speed'}\n\nWe typically recommend:\n${auditSnapshot?.recommendedImprovements || '- Modernizing the design aesthetic\n- Simplifying call-to-actions'}\n\nDo you have 10 minutes for a quick chat next week to discuss how we can help you grow?\n\nBest,\n[Your Name]`;
    return { drafts: [{ subject, body, variationTone: 'Direct' }] };
  } else if (channel === 'LINKEDIN') {
    const body = `Hi ${contactName}, I came across ${name} and really liked your business. I noticed a few quick areas of improvement on your digital presence/website that could help with conversions (specifically website responsiveness and layout). Would love to connect and share some quick thoughts!`;
    return { drafts: [{ subject: null, body, variationTone: 'Conversational' }] };
  } else if (channel === 'CALL') {
    const body = `CALL PREP GUIDE FOR ${name.toUpperCase()}\n\nPrimary Stakeholder: ${contactName} (${primaryContact?.role || 'Decision Maker'})\nPhone: ${primaryContact?.phone || 'No phone listed'}\nWebsite Audit Score: ${score}/100\n\nIntro Hook:\n"Hi ${contactName}, this is [Your Name] from [Agency]. I'm calling because I was reviewing ${name}'s digital presence and wanted to share two quick opportunities we identified for your website."\n\nKey Talking Points:\n1. Mention the audit score of ${score}/100.\n2. Note specific pain point: ${researchSnapshot?.painPointsHypotheses ? 'Pain points found in research.' : 'Inconsistent branding and user UX.'}\n3. Suggest specific value: ${auditSnapshot?.recommendedImprovements ? 'Recommended improvements.' : 'Redesigning the landing page to simplify checkout/contact.'}\n\nCall Goal: Book a 10-minute discovery call.`;
    return { drafts: [{ subject: null, body, variationTone: 'Direct' }] };
  } else {
    const body = `MEETING PREP GUIDE & AGENDA FOR ${name.toUpperCase()}\n\nMeeting Stakeholder: ${contactName} (${primaryContact?.role || 'Decision Maker'})\nWebsite Audit Score: ${score}/100\n\nProposed Agenda:\n1. Introductions & Agency Capabilities\n2. ${name}'s Current Digital Presence Review (Audit Score: ${score}/100)\n3. Key Opportunities: Website redesign & brand refresh\n4. Next Steps & Q&A\n\nDiscovery Questions to Ask:\n- What are the main conversion challenges on your website today?\n- How does your current brand identity align with your future goals?\n- What digital improvements would have the biggest impact on your sales?`;
    return { drafts: [{ subject: null, body, variationTone: 'Direct' }] };
  }
}



