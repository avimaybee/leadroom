// TODO(21.8): Refactor this monolithic module into smaller per-provider files
// (e.g. ai/gemini.ts, ai/openai.ts, ai/anthropic.ts, ai/openrouter.ts, ai/chain.ts).

import { z } from 'zod';
import { getLogger } from './logger';
import { type Db } from '../db';
import { getChannelPrompt } from './outreach/prompts';
import { researchSnapshots } from '../db/schema/research';
import { eq, desc } from 'drizzle-orm';

const log = getLogger('AI');

export const AIResearchSchema = z.object({
  companySummary: z.string().min(1),
  productsServicesSummary: z.string().min(1),
  digitalPresenceNotes: z.string().min(1),
  websiteNotes: z.string().min(1),
  brandingNotes: z.string().min(1),
  painPointsHypotheses: z.string().min(1),
  opportunityHypotheses: z.string().min(1),
  sources: z.array(z.string()),
  confidenceLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
});

export type AIResearchOutput = z.infer<typeof AIResearchSchema>;

export const AIAuditSchema = z.object({
  keyStrengths: z.string().min(1),
  keyWeaknesses: z.string().min(1),
  recommendedImprovements: z.string().min(1),
  sources: z.array(z.string()),
});

export type AIAuditOutput = z.infer<typeof AIAuditSchema>;

export const AIContactExtractionSchema = z.object({
  people: z.array(z.object({
    fullName: z.string().nullable().optional(),
    roleTitle: z.string().nullable().optional(),
    email: z.string().email().nullable().optional(),
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
  companySummary: z.string().min(1),
  productsServicesSummary: z.string().min(1),
  digitalPresenceNotes: z.string().min(1),
  websiteNotes: z.string().min(1),
  brandingNotes: z.string().min(1),
  painPointsHypotheses: z.string().min(1),
  opportunityHypotheses: z.string().min(1),
  confidenceLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  keyStrengths: z.string().min(1),
  keyWeaknesses: z.string().min(1),
  recommendedImprovements: z.string().min(1),
  contacts: AIContactExtractionSchema.nullable().optional(),
  sources: z.array(z.string()),
});

export type AIResearchAuditOutput = z.infer<typeof AIResearchAuditSchema>;

const CitedEvidenceItemSchema = z.object({
  sentence: z.string().min(1),
  evidenceQuote: z.string().min(1),
  sourceUrl: z.string().url(),
});

export const AIOutreachDraftSchema = z.object({
  drafts: z.array(z.object({
    subject: z.string().nullable().optional(),
    body: z.string().min(1),
    variationTone: z.string().optional(),
    riskFlags: z.array(z.string()).optional(),
    citedEvidence: z.array(CitedEvidenceItemSchema).optional(),
  })).min(1).max(1)
});

export type AIOutreachDraftOutput = z.infer<typeof AIOutreachDraftSchema>;

// TODO(10.12): API keys cached in-memory with 30-60s TTL.
// This is a security-risk tradeoff — cached keys could persist across request boundaries
// in long-lived runtimes. Not easily fixable in Cloudflare Workers (no persistent storage).
// Accepting the risk for now given the short TTL and Worker isolation model.

/** Simple in-memory token usage counter per provider */
export const tokenUsage: Array<{ provider: string; promptTokens: number; completionTokens: number; timestamp: number }> = [];

/** Cache for vision capability checks. Key: "provider:modelName", Value: { result: boolean, timestamp: number } */
const _visionCapabilityCache = new Map<string, { result: boolean; timestamp: number }>();
const VISION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const _providerChainCache = new Map<string, { chain: Array<{ provider: string; apiKey: string; modelName: string }>; timestamp: number }>();
const PROVIDER_CHAIN_CACHE_TTL_MS = 30_000; // 30 seconds
const PROVIDER_CHAIN_CACHE_MAX = 100;
const VISION_CACHE_MAX_ENTRIES = 50;

function evictStaleVisionCacheEntries(): void {
  const now = Date.now();
  if (_visionCapabilityCache.size <= VISION_CACHE_MAX_ENTRIES) return;
  const cutoff = now - VISION_CACHE_TTL_MS;
  for (const [key, entry] of _visionCapabilityCache) {
    if (entry.timestamp < cutoff) {
      _visionCapabilityCache.delete(key);
    }
  }
}

/**
 * Cache for active provider config, keyed by Db instance.
 * Avoids redundant DB queries when multiple AI functions are called in the same scope.
 */
const _providerConfigWeakCache = new WeakMap<object, { config: { provider: string; apiKey: string | null; modelName: string | null } | null; timestamp: number; cacheKey?: string }>();
const PROVIDER_CONFIG_CACHE_TTL_MS = 60_000; // 1 minute

import { IntegrationsService } from '../services/integrations';
import type { TaskType } from '../services/integrations';

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

const MAX_SCRAPED_CHARS = 8000;

function truncateContent(content: string | null | undefined): string | null | undefined {
  if (!content) return content;
  return content.length > MAX_SCRAPED_CHARS ? content.slice(0, MAX_SCRAPED_CHARS) + '\n[Content truncated...]' : content;
}

function sanitizeError(msg: string): string {
  return msg.replace(/([?&]key=)[^&\s]+/gi, '$1***')
            .replace(/(apiKey=)[^&\s]+/gi, '$1***')
            .replace(/(['"]?apiKey['"]?\s*:\s*['"])[^'"]+/gi, '$1***')
            .replace(/('Authorization':\s*'Bearer\s+)[^']+/gi, '$1***');
}

function getEnvApiKey(provider: string): string | undefined {
  let cfEnv: any = null;
  try {
    const { getCloudflareContext } = require('@opennextjs/cloudflare');
    cfEnv = getCloudflareContext().env;
  } catch {}

  const keyName = `${provider.toUpperCase()}_API_KEY`;
  if (cfEnv && cfEnv[keyName]) return cfEnv[keyName];

  switch (provider) {
    case 'gemini': return process.env.GEMINI_API_KEY;
    case 'openai': return process.env.OPENAI_API_KEY;
    case 'anthropic': return process.env.ANTHROPIC_API_KEY;
    case 'groq': return process.env.GROQ_API_KEY;
    case 'openrouter': return process.env.OPENROUTER_API_KEY;
    case 'nvidia': return process.env.NVIDIA_API_KEY;
    case 'aiml': return process.env.AIML_API_KEY;
    default: return undefined;
  }
}

/**
 * Resolves the active provider config for a given task type, caching the result by Db instance.
 * Subsequent calls within the same scope reuse the cached value.
 */
export async function getActiveProviderConfig(db: Db, userId?: string | null, taskType?: TaskType) {
  const cacheKey = `${userId || 'system'}:${taskType || 'default'}`;
  const cached = _providerConfigWeakCache.get(db);
  if (cached && cached.cacheKey === cacheKey && Date.now() - cached.timestamp < PROVIDER_CONFIG_CACHE_TTL_MS) {
    return cached.config;
  }

  const integrationsService = new IntegrationsService(db);

  let config: { provider: string; apiKey: string | null; modelName: string | null } | null = null;

  if (taskType) {
    const taskConfig = await integrationsService.getActiveProviderForTask(taskType, userId);
    if (taskConfig) {
      config = { provider: taskConfig.provider, apiKey: taskConfig.apiKey, modelName: taskConfig.modelName };
    }
  } else {
    // Fallback: scan all providers for any active routing flag
    for (const p of ['openrouter', 'nvidia', 'groq', 'aiml', 'gemini', 'openai', 'anthropic'] as const) {
      const pConfig = await integrationsService.getProviderConfig(p, userId);
      if (pConfig && (pConfig.isResearchActive || pConfig.isScoringActive || pConfig.isDraftingActive)) {
        config = { provider: pConfig.provider, apiKey: pConfig.apiKey, modelName: pConfig.modelName };
        break;
      }
    }
  }

  _providerConfigWeakCache.set(db, { config, timestamp: Date.now(), cacheKey });
  return config;
}

export interface FailoverEvent {
  provider: string;
  modelName: string | null;
  error: string;
}

export type FailoverCallback = (event: FailoverEvent) => void;

const DEFAULT_MODELS: Record<string, string> = {
  openrouter: 'google/gemini-2.5-flash',
  nvidia: 'meta/llama-3.1-70b-instruct',
  groq: 'llama3-70b-8192',
  aiml: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-6',
  gemini: 'gemini-2.5-flash',
};

function getDefaultModel(provider: string): string {
  return DEFAULT_MODELS[provider.toLowerCase()] || 'gemini-2.5-flash';
}

async function getProviderChain(db: Db, taskType: TaskType, userId?: string | null): Promise<Array<{ provider: string; apiKey: string; modelName: string }>> {
  const cacheKey = `${userId || 'global'}:${taskType}`;
  const cached = _providerChainCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < PROVIDER_CHAIN_CACHE_TTL_MS) {
    return cached.chain;
  }

  const integrationsService = new IntegrationsService(db);
  const allConfigs = await integrationsService.getAllProviderConfigs(userId);

  const primary = allConfigs.find(c => {
    if (taskType === 'research') return c.isResearchActive;
    if (taskType === 'scoring') return c.isScoringActive;
    if (taskType === 'drafting') return c.isDraftingActive;
    return false;
  });

  const chain: Array<{ provider: string; apiKey: string; modelName: string }> = [];

  if (primary) {
    const apiKey = primary.apiKey || getEnvApiKey(primary.provider) || '';
    if (apiKey && apiKey !== 'placeholder' && apiKey !== '') {
      chain.push({ provider: primary.provider, apiKey, modelName: primary.modelName || getDefaultModel(primary.provider) });
    }
  }

  for (const c of allConfigs) {
    if (c.id === primary?.id) continue;
    const apiKey = c.apiKey || getEnvApiKey(c.provider) || '';
    if (!apiKey || apiKey === 'placeholder' || apiKey === '') continue;
    chain.push({ provider: c.provider, apiKey, modelName: c.modelName || getDefaultModel(c.provider) });
  }

  // Last resort: Gemini from env var if not already in chain
  if (!chain.some(c => c.provider === 'gemini')) {
    const envKey = getEnvApiKey('gemini');
    if (envKey && envKey !== 'placeholder' && envKey !== '') {
      chain.push({ provider: 'gemini', apiKey: envKey, modelName: 'gemini-2.5-flash' });
    }
  }

  if (_providerChainCache.size >= PROVIDER_CHAIN_CACHE_MAX) {
    const oldest = _providerChainCache.entries().next().value?.[0];
    if (oldest) _providerChainCache.delete(oldest);
  }
  _providerChainCache.set(cacheKey, { chain, timestamp: Date.now() });
  return chain;
}

const PROVIDER_CHAIN_TOTAL_TIMEOUT_MS = 25_000; // 25s cap across all failover attempts (CF Workers 30s CPU limit)

async function callWithProviderChain<T>(
  db: Db,
  taskType: TaskType,
  userId: string | null | undefined,
  callFn: (provider: string, apiKey: string, modelName: string, signal?: AbortSignal) => Promise<T>,
  onFailover?: FailoverCallback,
  externalSignal?: AbortSignal,
): Promise<T> {
  const chain = await getProviderChain(db, taskType, userId);

  if (chain.length === 0) {
    log.warn(`No AI provider configured for ${taskType}, returning fallback.`);
    throw new Error(`No AI provider configured for ${taskType}. Please configure a provider in Settings -> Integrations.`);
  }

  let lastError: Error | null = null;

  const totalDeadline = Date.now() + PROVIDER_CHAIN_TOTAL_TIMEOUT_MS;

  for (let i = 0; i < chain.length; i++) {
    if (Date.now() >= totalDeadline) {
      throw lastError || new Error(`Provider chain timed out after ${PROVIDER_CHAIN_TOTAL_TIMEOUT_MS}ms for ${taskType}`);
    }

    const remainingMs = Math.max(0, totalDeadline - Date.now());
    const { provider, apiKey, modelName } = chain[i];

    // Build combined abort signal: fires if external signal fires OR per-attempt timeout elapses
    const attemptController = new AbortController();
    const onExternalAbort = () => attemptController.abort();
    externalSignal?.addEventListener('abort', onExternalAbort, { once: true });
    const timeoutTimer = setTimeout(() => attemptController.abort(), remainingMs);
    const combinedSignal = attemptController.signal;

    // Cleanup after attempt completes (success or fail)
    const cleanup = () => {
      clearTimeout(timeoutTimer);
      externalSignal?.removeEventListener('abort', onExternalAbort);
    };

    // Try up to 2 times per provider before failing over
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await callFn(provider, apiKey, modelName, combinedSignal);
        cleanup();
        return result;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const isRateLimit = lastError instanceof RateLimitError;

        if (attempt < 2) {
          const delay = isRateLimit
            ? Math.min(1000 * Math.pow(2, attempt), 30000)
            : Math.min(500 * Math.pow(2, i + attempt), 30000);
          const backoffMs = Math.random() * delay;
          if (isRateLimit) {
            log.warn(`Provider "${provider}" rate limited. Retrying in ${Math.round(backoffMs)}ms...`);
          } else {
            log.warn(`Provider "${provider}" (model: ${modelName}) failed for "${taskType}". Retrying (${attempt}/2)... Error: ${sanitizeError(lastError.message)}`);
          }
          await new Promise<void>(resolve => setTimeout(resolve, backoffMs));
          continue;
        }

        // Exhausted retries — fail over or bubble
        cleanup();
        if (i < chain.length - 1) {
          onFailover?.({ provider, modelName, error: lastError.message });
          log.warn(`Provider "${provider}" (model: ${modelName}) failed for task "${taskType}". Trying next provider... Error: ${sanitizeError(lastError.message)}`);
          const delay = Math.min(500 * Math.pow(2, i), 30000);
          const backoffMs = Math.random() * delay;
          await new Promise<void>(resolve => setTimeout(resolve, backoffMs));
        }
        break;
      }
    }
  }

  throw lastError || new Error(`All AI providers failed for ${taskType}`);
}

export async function generateResearch(
  db: Db,
  leadName: string,
  companyName: string | null,
  websiteUrl: string | null,
  industry: string | null,
  scrapedContent?: string | null,
  location?: string | null,
  userId?: string | null
): Promise<AIResearchOutput> {
  return callWithProviderChain(db, 'research', userId, async (provider, apiKey, modelName, signal) => {
    const name = companyName || leadName;
    const ind = industry || 'General Business';
    const web = websiteUrl || 'No website provided';

    const prompt = `Perform research on the company "${name}".
Location Context: ${location || 'Unknown location'}
Industry: ${ind}
Website: ${web}
${scrapedContent ? `\nHere is the scraped content of their website to analyze:\n--- START OF WEBSITE CONTENT ---\n${truncateContent(scrapedContent)}\n--- END OF WEBSITE CONTENT ---\n` : ''}

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
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          signal: signal ?? AbortSignal.timeout(25000),
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
      if (!response.ok) { await response.body?.cancel(); throw new Error(`Gemini API returned status ${response.status}`); }
      const data = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textResult) throw new Error('Invalid response structure from Gemini API');
      let parsed;
      try { parsed = JSON.parse(textResult); } catch (e) { throw new Error(`Failed to parse Gemini response as JSON: ${e}`); }
      try { return AIResearchSchema.parse(parsed); } catch { return { companySummary: '', productsServicesSummary: '', digitalPresenceNotes: '', websiteNotes: '', brandingNotes: '', painPointsHypotheses: '', opportunityHypotheses: '', sources: [], confidenceLevel: 'LOW' as const }; }
    }

    if (provider === 'anthropic') {
      const textResult = await callAnthropic(
        prompt, apiKey, modelName,
        'You are a senior competitive intelligence analyst. Output strictly in valid JSON matching the requested schema. No markdown code blocks, no extra text.',
        signal,
      );
      let parsed;
      try { parsed = JSON.parse(textResult); } catch (e) { throw new Error(`Failed to parse Anthropic response as JSON: ${e}`); }
      try { return AIResearchSchema.parse(parsed); } catch { return { companySummary: '', productsServicesSummary: '', digitalPresenceNotes: '', websiteNotes: '', brandingNotes: '', painPointsHypotheses: '', opportunityHypotheses: '', sources: [], confidenceLevel: 'LOW' as const }; }
    }

    // OpenAI-compatible providers (OpenRouter, NVIDIA, Groq, AIML, OpenAI)
      let textResult = await callOpenAICompatible(
        provider, prompt, apiKey, modelName,
        'You are a senior competitive intelligence analyst. Output strictly in valid JSON matching the requested schema. No markdown code blocks, no extra text.',
        RESEARCH_JSON_SCHEMA,
        signal,
      );

    let parsed: any;
    try {
      parsed = JSON.parse(textResult);
    } catch (parseError: unknown) {
      if (provider === 'nvidia') {
        log.error('Failed to parse NVIDIA JSON output, retrying with relaxed format.');
        textResult = await callOpenAICompatible(
          provider, prompt, apiKey, modelName,
          'You are a senior competitive intelligence analyst. Output strictly in valid JSON matching the requested schema. No markdown code blocks, no extra text.',
          undefined, // skip strict schema on retry
          signal,
          true,      // retryAttempt = true
        );
        try { parsed = JSON.parse(textResult); } catch (e) { throw new Error(`Failed to parse NVIDIA retry response as JSON: ${e}`); }
      } else {
        throw parseError;
      }
    }

    try { return AIResearchSchema.parse(parsed); } catch { return { companySummary: '', productsServicesSummary: '', digitalPresenceNotes: '', websiteNotes: '', brandingNotes: '', painPointsHypotheses: '', opportunityHypotheses: '', sources: [], confidenceLevel: 'LOW' as const }; }
  });
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
  location?: string | null,
  userId?: string | null
): Promise<AIResearchAuditOutput> {
  return callWithProviderChain(db, 'research', userId, async (provider, apiKey, modelName, signal) => {
    const name = companyName || leadName;
    const ind = industry || 'General Business';
    const web = websiteUrl || 'No website provided';

    const prompt = `Perform a combined company research and design/UX audit on the company "${name}".
Location Context: ${location || 'Unknown location'}
Industry: ${ind}
Website: ${web}
${scrapedContent ? `\nHere is the scraped content of their website to analyze:\n--- START OF WEBSITE CONTENT ---\n${truncateContent(scrapedContent)}\n--- END OF WEBSITE CONTENT ---\n` : ''}

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
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          signal: signal ?? AbortSignal.timeout(25000),
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
      if (!response.ok) { await response.body?.cancel(); throw new Error(`Gemini API returned status ${response.status}`); }
      const data = (await response.json()) as any;
      const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textResult) throw new Error('Invalid response structure from Gemini API');
      let parsed;
      try { parsed = JSON.parse(textResult); } catch (e) { throw new Error(`Failed to parse Gemini response as JSON: ${e}`); }
      try { return AIResearchAuditSchema.parse(parsed); } catch { return { companySummary: '', productsServicesSummary: '', digitalPresenceNotes: '', websiteNotes: '', brandingNotes: '', painPointsHypotheses: '', opportunityHypotheses: '', confidenceLevel: 'LOW' as const, keyStrengths: '', keyWeaknesses: '', recommendedImprovements: '', sources: [] }; }
    }

    if (provider === 'anthropic') {
      const textResult = await callAnthropic(
        prompt, apiKey, modelName,
        'You are a senior competitive intelligence analyst and UX/design auditor. Output strictly in valid JSON matching the requested schema.',
        signal,
      );
      let parsed;
      try { parsed = JSON.parse(textResult); } catch (e) { throw new Error(`Failed to parse Anthropic response as JSON: ${e}`); }
      try { return AIResearchAuditSchema.parse(parsed); } catch { return { companySummary: '', productsServicesSummary: '', digitalPresenceNotes: '', websiteNotes: '', brandingNotes: '', painPointsHypotheses: '', opportunityHypotheses: '', confidenceLevel: 'LOW' as const, keyStrengths: '', keyWeaknesses: '', recommendedImprovements: '', sources: [] }; }
    }

    // OpenAI-compatible providers
    const textResult = await callOpenAICompatible(
        provider, prompt, apiKey, modelName,
        'You are a senior competitive intelligence analyst and UX/design auditor. Output strictly in valid JSON matching the requested schema.',
        RESEARCH_AUDIT_JSON_SCHEMA,
        signal,
      );
    let parsed;
    try { parsed = JSON.parse(textResult); } catch (e) { throw new Error(`Failed to parse OpenAI-compatible response as JSON: ${e}`); }
    try { return AIResearchAuditSchema.parse(parsed); } catch { return { companySummary: '', productsServicesSummary: '', digitalPresenceNotes: '', websiteNotes: '', brandingNotes: '', painPointsHypotheses: '', opportunityHypotheses: '', confidenceLevel: 'LOW' as const, keyStrengths: '', keyWeaknesses: '', recommendedImprovements: '', sources: [] }; }
  });
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
  signal?: AbortSignal,
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
      signal: signal ?? AbortSignal.timeout(25000),
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: sysMsgOverride || systemMessage },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 8192,
        response_format: format,
      }),
    });
    return res;
  };

  let response: Response;

  if (provider === 'nvidia' && strictSchema && !retryAttempt) {
    // NVIDIA: try strict json_schema first (transient — retries each call)
    response = await makeRequest({
      type: 'json_schema',
      json_schema: { name: 'ai_response', schema: strictSchema, strict: true },
    });

    if (!response.ok && (response.status === 400 || response.status === 422)) {
      log.warn(`NVIDIA strict schema failed (${response.status}), falling back to json_object`);
      await response.body?.cancel();
      response = await makeRequest({ type: 'json_object' });
    }
  } else {
    response = await makeRequest({ type: 'json_object' });
  }

  if (!response.ok) {
    await response.body?.cancel();
    if (response.status === 429) {
      throw new RateLimitError(`${provider} API rate limited (429)`);
    }
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
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: signal ?? AbortSignal.timeout(25000),
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
    await response.body?.cancel();
    if (response.status === 429) {
      throw new RateLimitError(`Anthropic API rate limited (429)`);
    }
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

export async function generateAudit(
  db: Db,
  leadName: string,
  companyName: string | null,
  websiteUrl: string | null,
  industry: string | null,
  scrapedContent?: string | null,
  leadId?: string | null,
  userId?: string | null
): Promise<AIAuditOutput> {
  // Load research snapshot — used as PRIMARY context when scraping fails,
  // and as supplemental context when scraped content is available.
  let researchSnapshotContext = '';
  let hasResearchSnapshot = false;
  if (leadId) {
    try {
      
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
      log.error('Failed to fetch research snapshot in generateAudit', e);
    }
  }

  const name = companyName || leadName;
  const ind = industry || 'General Business';
  const web = websiteUrl || 'No website provided';

  // Defensively strip any accidental scrape-failure strings before sending to the LLM.
  const cleanedScrapedContent = (scrapedContent && !scrapedContent.startsWith('[Failed to scrape'))
    ? truncateContent(scrapedContent)
    : null;

  // Build the context block depending on what data is available.
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

  return callWithProviderChain(db, 'scoring', userId, async (provider, apiKey, modelName, signal) => {
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

    if (provider === 'gemini') {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          signal: signal ?? AbortSignal.timeout(25000),
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
        const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        let parsed;
        try { parsed = JSON.parse(textResult); } catch (e) { throw new Error(`Failed to parse Gemini response as JSON: ${e}`); }
        try { return AIAuditSchema.parse(parsed); } catch { return { keyStrengths: '', keyWeaknesses: '', recommendedImprovements: '', sources: [] }; }
      } else {
        await response.body?.cancel();
        throw new Error(`Gemini API returned status ${response.status}`);
      }
    }

    if (provider === 'anthropic') {
      const textResult = await callAnthropic(
        prompt, apiKey, modelName,
        'You are a senior design and UX auditor. Output strictly in valid JSON matching the requested schema.',
        signal,
      );
      let parsed;
      try { parsed = JSON.parse(textResult); } catch (e) { throw new Error(`Failed to parse Anthropic response as JSON: ${e}`); }
      try { return AIAuditSchema.parse(parsed); } catch { return { keyStrengths: '', keyWeaknesses: '', recommendedImprovements: '', sources: [] }; }
    }

    const textResult = await callOpenAICompatible(
        provider, prompt, apiKey, modelName,
        'You are a senior design and UX auditor. Output strictly in valid JSON matching the requested schema.',
        AUDIT_JSON_SCHEMA,
        signal,
      );
    let parsed;
    try { parsed = JSON.parse(textResult); } catch (e) { throw new Error(`Failed to parse OpenAI-compatible response as JSON: ${e}`); }
    try { return AIAuditSchema.parse(parsed); } catch { return { keyStrengths: '', keyWeaknesses: '', recommendedImprovements: '', sources: [] }; }
  });
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
  attachments?: Array<{ name: string; type: string; base64: string }>,
  onFailover?: FailoverCallback,
  userId?: string | null
): Promise<AIOutreachDraftOutput> {
  return callWithProviderChain(db, 'drafting', userId, async (provider, apiKey, modelName, signal) => {
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
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          signal: signal ?? AbortSignal.timeout(25000),
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
        const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const textResultTrimmed = textResult.trim();
        const cleaned = textResultTrimmed.startsWith('```json')
          ? textResultTrimmed.replace(/^```json\n/, '').replace(/\n```$/, '')
          : textResultTrimmed.startsWith('```')
            ? textResultTrimmed.replace(/^```\n/, '').replace(/\n```$/, '')
            : textResultTrimmed;
        let parsedCleaned;
        try { parsedCleaned = JSON.parse(cleaned); } catch (e) { throw new Error(`Failed to parse Gemini response as JSON: ${e}`); }
        try { return AIOutreachDraftSchema.parse(parsedCleaned); } catch { return { drafts: [{ body: '' }] }; }
      } else {
        await response.body?.cancel();
        throw new Error(`Gemini API returned status ${response.status}`);
      }
    }

    if (provider === 'anthropic') {
      let textResult = await callAnthropic(
        prompt, apiKey, modelName,
        'You are a senior creative director drafting agency outreach. Output strictly in valid JSON matching the requested schema.',
        signal,
      );
      textResult = textResult.trim();
      if (textResult.startsWith('```json')) textResult = textResult.replace(/^```json\n/, '').replace(/\n```$/, '');
      else if (textResult.startsWith('```')) textResult = textResult.replace(/^```\n/, '').replace(/\n```$/, '');
      let parsedAnthropic;
      try { parsedAnthropic = JSON.parse(textResult); } catch (e) { throw new Error(`Failed to parse Anthropic response as JSON: ${e}`); }
      try { return AIOutreachDraftSchema.parse(parsedAnthropic); } catch { return { drafts: [{ body: '' }] }; }
    }

    const url = 
      provider === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' :
      provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' :
      provider === 'nvidia' ? 'https://integrate.api.nvidia.com/v1/chat/completions' :
      provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' :
      provider === 'aiml' ? 'https://api.aimlapi.com/v1/chat/completions' :
      'https://api.openai.com/v1/chat/completions';

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
      signal: signal ?? AbortSignal.timeout(25000),
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
      let textResult = data.choices?.[0]?.message?.content || '';
      textResult = textResult.trim();
      if (textResult.startsWith('```json')) textResult = textResult.replace(/^```json\n/, '').replace(/\n```$/, '');
      else if (textResult.startsWith('```')) textResult = textResult.replace(/^```\n/, '').replace(/\n```$/, '');
      let parsedOpenAI;
      try { parsedOpenAI = JSON.parse(textResult); } catch (e) { throw new Error(`Failed to parse ${provider} response as JSON: ${e}`); }
      try { return AIOutreachDraftSchema.parse(parsedOpenAI); } catch { return { drafts: [{ body: '' }] }; }
    } else {
      await response.body?.cancel();
      throw new Error(`${provider} API returned status ${response.status}`);
    }
  }, onFailover);
}

export async function checkModelVisionCapability(provider: string, modelName: string, apiKey?: string): Promise<boolean> {
  const cacheKey = `${provider}:${modelName}`;
  const cached = _visionCapabilityCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < VISION_CACHE_TTL_MS) {
    return cached.result;
  }
  evictStaleVisionCacheEntries();

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
        signal: AbortSignal.timeout(10000),
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
      log.error('Error fetching OpenRouter models', e);
    }
  }

  // Dynamic Gemini check
  if (p === 'gemini') {
    try {
      const formattedModel = modelName.startsWith('models/') ? modelName : `models/${modelName}`;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${formattedModel}`, { headers: { 'x-goog-api-key': apiKey }, signal: AbortSignal.timeout(10000) });
      if (response.ok) {
        const data = (await response.json()) as any;
        const result = data.name?.includes('gemini') && !data.name?.includes('embedding');
        _visionCapabilityCache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      }
    } catch (e) {
      log.error('Error fetching Gemini model metadata', e);
    }
  }

  // Dynamic OpenAI check
  if (p === 'openai') {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        signal: AbortSignal.timeout(10000),
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
      log.error('Error fetching OpenAI models', e);
    }
  }

  // Dynamic Groq / Nvidia / AIML checks
  if (['groq', 'nvidia', 'aiml'].includes(p)) {
    try {
      const url = p === 'groq' ? 'https://api.groq.com/openai/v1/models' :
                  p === 'nvidia' ? 'https://integrate.api.nvidia.com/v1/models' :
                  'https://api.aimlapi.com/v1/models';
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000),
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
      log.error(`Error fetching models for ${p}`, e);
    }
  }

  const visionKeywords = ['vision', 'llava', 'pixtral', 'gemini', 'claude-3', 'claude-opus', 'claude-sonnet', 'gpt-4o', 'gpt-4-vision', 'gpt-5', 'llama-3.2-11b', 'llama-3.2-90b'];
  const fallbackResult = visionKeywords.some(keyword => m.includes(keyword)) && !m.includes('embedding');
  _visionCapabilityCache.set(cacheKey, { result: fallbackResult, timestamp: Date.now() });
  return fallbackResult;
}

export async function getModelInfo(db: Db, userId?: string | null): Promise<{ provider: string; modelName: string; hasVision: boolean }> {
  const config = await getActiveProviderConfig(db, userId);
  const provider = config?.provider || 'gemini';
  const apiKey = config?.apiKey || getEnvApiKey(provider);
  const modelName = config?.modelName || getDefaultModel(provider);

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
  userId?: string | null
): Promise<AIContactExtractionOutput> {
  try {
    return await callWithProviderChain(db, 'research', userId, async (provider, apiKey, modelName, signal) => {
      const name = companyName || leadName;

      const prompt = `Extract contact information from the website of "${name}".

Here is the scraped content of their website:
--- START OF WEBSITE CONTENT ---
${truncateContent(scrapedContent) || 'No website content available.'}
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
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            signal: signal ?? AbortSignal.timeout(25000),
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
        if (!response.ok) { await response.body?.cancel(); throw new Error(`Gemini API returned status ${response.status}`); }
        const data = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
        const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textResult) throw new Error('Invalid response structure from Gemini API');
        let parsed;
        try { parsed = JSON.parse(textResult); } catch (e) { throw new Error(`Failed to parse Gemini response as JSON: ${e}`); }
        try { return AIContactExtractionSchema.parse(parsed); } catch { return { people: null, socialLinks: null, emails: null, phones: null }; }
      }

      if (provider === 'anthropic') {
        const textResult = await callAnthropic(
          prompt, apiKey, modelName,
          'Extract contact information from business website content. Output strictly in valid JSON.',
          signal,
        );
        let parsed;
        try { parsed = JSON.parse(textResult); } catch (e) { throw new Error(`Failed to parse Anthropic response as JSON: ${e}`); }
        try { return AIContactExtractionSchema.parse(parsed); } catch { return { people: null, socialLinks: null, emails: null, phones: null }; }
      }

      // OpenAI-compatible providers
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
        signal: signal ?? AbortSignal.timeout(25000),
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

      if (!response.ok) { await response.body?.cancel(); throw new Error(`${provider} API returned status ${response.status}`); }
      const result = (await response.json()) as any;
      let textResult = result.choices?.[0]?.message?.content;
      if (!textResult) throw new Error('Invalid response structure');

      textResult = textResult.trim().replace(/^```json?\n?/, '').replace(/\n```$/, '');
      let parsed;
      try { parsed = JSON.parse(textResult); } catch (e) { throw new Error(`Failed to parse ${provider} response as JSON: ${e}`); }
      try { return AIContactExtractionSchema.parse(parsed); } catch { return { people: null, socialLinks: null, emails: null, phones: null }; }
    });
  } catch (e) {
    log.error('Contact extraction failed, returning empty', e);
    return { people: null, socialLinks: null, emails: null, phones: null };
  }
}

export const AILeadScoreSchema = z.object({
  score: z.number().int().min(0).max(100),
  rationaleSummary: z.string().min(1),
  factors: z.array(z.string()),
});

export type AILeadScoreOutput = z.infer<typeof AILeadScoreSchema>;

export async function generateLeadScore(
  db: Db,
  leadName: string,
  researchSnapshot: any | null,
  auditSnapshot: any | null,
  userId?: string | null
): Promise<AILeadScoreOutput> {
  return callWithProviderChain(db, 'scoring', userId, async (provider, apiKey, modelName, signal) => {
    const prompt = `Evaluate the following lead and assign a priority score from 0 to 100.
Lead Name: ${leadName}

--- RESEARCH SNAPSHOT ---
${JSON.stringify(researchSnapshot || {})}

--- DESIGN AUDIT ---
${JSON.stringify(auditSnapshot || {})}

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

    if (provider === 'gemini') {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          signal: signal ?? AbortSignal.timeout(25000),
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
        const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        let parsed;
        try { parsed = JSON.parse(textResult); } catch (e) { throw new Error(`Failed to parse Gemini response as JSON: ${e}`); }
        try { return AILeadScoreSchema.parse(parsed); } catch { return { score: 0, rationaleSummary: '', factors: [] }; }
      } else {
        await response.body?.cancel();
        throw new Error(`Gemini API returned status ${response.status}`);
      }
    }

    if (provider === 'anthropic') {
      const textResult = await callAnthropic(
        prompt, apiKey, modelName,
        'You are a lead scoring evaluator. Output strictly valid JSON.',
        signal,
      );
      let parsed;
      try { parsed = JSON.parse(textResult); } catch (e) { throw new Error(`Failed to parse Anthropic response as JSON: ${e}`); }
      try { return AILeadScoreSchema.parse(parsed); } catch { return { score: 0, rationaleSummary: '', factors: [] }; }
    }

    const textResult = await callOpenAICompatible(
        provider, prompt, apiKey, modelName,
        'You are a lead scoring evaluator. Output strictly valid JSON.',
        SCORE_JSON_SCHEMA,
        signal,
      );
    let parsed;
    try { parsed = JSON.parse(textResult); } catch (e) { throw new Error(`Failed to parse OpenAI-compatible response as JSON: ${e}`); }
    try { return AILeadScoreSchema.parse(parsed); } catch { return { score: 0, rationaleSummary: '', factors: [] }; }
  });
}

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

export const AIExtractedSignalsSchema = z.object({
  signals: z.array(z.object({
    signalName: z.string().min(1),
    matchedIcpRule: z.string().min(1),
    matchStrength: z.enum(['strong', 'partial', 'weak']),
    evidenceQuote: z.string().min(1),
    sourceUrl: z.string().url(),
  }))
});

export type AIExtractedSignalsOutput = z.infer<typeof AIExtractedSignalsSchema>;

export async function extractICPSignals(
  db: Db,
  companyName: string,
  websiteUrl: string | null,
  scrapedContent: string | null,
  icpProfile: any,
  userId?: string | null
): Promise<any[]> {
  const posCount = icpProfile.positiveSignals?.length || 0;
  const negCount = icpProfile.negativeSignals?.length || 0;
  const disqCount = icpProfile.disqualifiers?.length || 0;
  if (posCount === 0 && negCount === 0 && disqCount === 0) {
    return [];
  }

  const positiveText = (icpProfile.positiveSignals || []).map((s: any) => `- Positive Signal: "${s.name}" (Description: ${s.description})`).join('\n');
  const negativeText = (icpProfile.negativeSignals || []).map((s: any) => `- Negative Signal: "${s.name}" (Description: ${s.description})`).join('\n');
  const disqualifiersText = (icpProfile.disqualifiers || []).map((d: any) => `- Disqualifier: "${d}"`).join('\n');

  const prompt = `Evaluate the company "${companyName}" (website: ${websiteUrl || 'Unknown'}) against our Ideal Customer Profile (ICP) criteria.
Analyze the scraped website content below to identify matches with any positive signals, negative signals, or disqualifiers.

ICP CRITERIA TO LOOK FOR:
--- Positive Signals ---
${positiveText || 'None defined'}

--- Negative Signals ---
${negativeText || 'None defined'}

--- Disqualifiers ---
${disqualifiersText || 'None defined'}

Here is the scraped content of their website:
--- START OF WEBSITE CONTENT ---
${truncateContent(scrapedContent) || '[No content scraped]'}
--- END OF WEBSITE CONTENT ---

For each matched criteria (positive signal, negative signal, or disqualifier):
1. Determine if it is present. If it is NOT present, do not include it.
2. If it is present, evaluate the match strength (strong, partial, weak). Disqualifiers should always have 'strong' match strength.
3. Cite the exact sentence/phrase from the website content as 'evidenceQuote'.
4. Provide the 'sourceUrl' (use the company website URL ${websiteUrl || ''}).
5. 'signalName' and 'matchedIcpRule' should be set to the EXACT name of the positive signal, negative signal, or disqualifier as defined in the ICP criteria.

Provide your response strictly in JSON format matching this schema:
{
  "signals": [
    {
      "signalName": "EXACT_NAME_OF_SIGNAL_OR_DISQUALIFIER",
      "matchedIcpRule": "EXACT_NAME_OF_SIGNAL_OR_DISQUALIFIER",
      "matchStrength": "strong" | "partial" | "weak",
      "evidenceQuote": "exact quote from scraped content showing the match",
      "sourceUrl": "..."
    }
  ]
}`;

  const schemaJson = {
    type: 'object',
    properties: {
      signals: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            signalName: { type: 'string' },
            matchedIcpRule: { type: 'string' },
            matchStrength: { type: 'string', enum: ['strong', 'partial', 'weak'] },
            evidenceQuote: { type: 'string' },
            sourceUrl: { type: 'string' },
          },
          required: ['signalName', 'matchedIcpRule', 'matchStrength', 'evidenceQuote', 'sourceUrl'],
        }
      }
    },
    required: ['signals']
  };

  try {
    return await callWithProviderChain(db, 'research', userId, async (provider, apiKey, modelName, signal) => {
      if (provider === 'gemini') {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            signal: signal ?? AbortSignal.timeout(25000),
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                maxOutputTokens: 10000,
                responseMimeType: 'application/json',
                responseSchema: {
                  type: 'OBJECT',
                  properties: {
                    signals: {
                      type: 'ARRAY',
                      items: {
                        type: 'OBJECT',
                        properties: {
                          signalName: { type: 'STRING' },
                          matchedIcpRule: { type: 'STRING' },
                          matchStrength: { type: 'STRING', enum: ['strong', 'partial', 'weak'] },
                          evidenceQuote: { type: 'STRING' },
                          sourceUrl: { type: 'STRING' },
                        },
                        required: ['signalName', 'matchedIcpRule', 'matchStrength', 'evidenceQuote', 'sourceUrl'],
                      }
                    }
                  },
                  required: ['signals']
                },
              },
            }),
          }
        );
        if (!response.ok) { await response.body?.cancel(); throw new Error(`Gemini API returned status ${response.status}`); }
        const data = (await response.json()) as any;
        const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textResult) throw new Error('Invalid response structure from Gemini API');
        let parsed;
        try { parsed = JSON.parse(textResult); } catch (e) { throw new Error(`Failed to parse Gemini response as JSON: ${e}`); }
        try { return AIExtractedSignalsSchema.parse(parsed).signals; } catch { return []; }
      }

      if (provider === 'anthropic') {
        const textResult = await callAnthropic(
          prompt, apiKey, modelName,
          'You are a competitive intelligence analyst. Output strictly in valid JSON matching the requested schema.',
          signal,
        );
        let parsed;
        try { parsed = JSON.parse(textResult); } catch (e) { throw new Error(`Failed to parse Anthropic response as JSON: ${e}`); }
        try { return AIExtractedSignalsSchema.parse(parsed).signals; } catch { return []; }
      }

      // OpenAI-compatible providers
      const textResult = await callOpenAICompatible(
        provider, prompt, apiKey, modelName,
        'You are a competitive intelligence analyst. Output strictly in valid JSON matching the requested schema.',
        schemaJson,
        signal,
      );
      let parsed;
      try { parsed = JSON.parse(textResult); } catch (e) { throw new Error(`Failed to parse OpenAI-compatible response as JSON: ${e}`); }
      try { return AIExtractedSignalsSchema.parse(parsed).signals; } catch { return []; }
    });
  } catch (err) {
    log.error('Failed to run AI signal extraction, falling back to empty', err);
    return [];
  }
}

export const AIGeneratedStrategySchema = z.object({
  offer: z.object({
    name: z.string().min(1),
    targetPain: z.string().min(1),
    desiredOutcome: z.string().min(1),
    proofPoints: z.array(z.string()),
    forbiddenClaims: z.array(z.string()),
  }),
  icp: z.object({
    name: z.string().min(1),
    positiveSignals: z.array(z.object({
      name: z.string().min(1),
      weight: z.number().int().min(1).max(10),
      description: z.string().min(1),
    })),
    negativeSignals: z.array(z.object({
      name: z.string().min(1),
      weight: z.number().int().min(1).max(10),
      description: z.string().min(1),
    })),
    disqualifiers: z.array(z.string()),
  })
});

export type AIGeneratedStrategyOutput = z.infer<typeof AIGeneratedStrategySchema>;

// ── SDR Parallel Schemas (coexist alongside legacy schemas) ──

export const SDRPainSignalSchema = z.object({
  signal: z.string().min(1),
  evidenceQuote: z.string().min(1),
  sourceUrl: z.string(),
});

export const SDRWebsiteAnalysisSchema = z.object({
  companyName: z.string().min(1),
  websiteSummary: z.string().min(1).max(500),
  productsServices: z.array(z.string().min(1)).min(1),
  targetAudience: z.string().min(1),
  painSignalsFound: z.array(SDRPainSignalSchema),
  confidence: z.number().int().min(0).max(100),
});

export const SDRICPSignalMatchSchema = z.object({
  signalName: z.string().min(1),
  evidenceQuote: z.string().min(1),
  sourceUrl: z.string(),
  matchStrength: z.enum(['strong', 'partial', 'weak']),
});

export const SDRICPFitSchema = z.object({
  matchedPositiveSignals: z.array(SDRICPSignalMatchSchema),
  matchedNegativeSignals: z.array(SDRICPSignalMatchSchema),
  disqualifiersTriggered: z.array(z.string()),
  overallAssessment: z.string().min(1).max(1000),
  confidence: z.number().int().min(0).max(100),
});

export const SDRPainExtractorSchema = z.object({
  painSignals: z.array(SDRPainSignalSchema),
  confidence: z.number().int().min(0).max(100),
});

export type SDRWebsiteAnalysisOutput = z.infer<typeof SDRWebsiteAnalysisSchema>;
export type SDRICPFitOutput = z.infer<typeof SDRICPFitSchema>;
export type SDRPainExtractorOutput = z.infer<typeof SDRPainExtractorSchema>;

export async function generateSDRWebsiteAnalysis(
  db: Db,
  companyName: string,
  websiteUrl: string | null,
  scrapedContent: string | null,
  userId?: string | null
): Promise<SDRWebsiteAnalysisOutput> {
  const web = websiteUrl || 'No website provided';
  const fallback: SDRWebsiteAnalysisOutput = {
    companyName,
    websiteSummary: 'Analysis unavailable — no scraped content.',
    productsServices: ['Unknown'],
    targetAudience: 'Unknown',
    painSignalsFound: [],
    confidence: 0,
  };
  if (!scrapedContent || scrapedContent.startsWith('[Failed to scrape')) {
    return fallback;
  }

  return callWithProviderChain(db, 'research', userId, async (provider, apiKey, modelName, signal) => {
    const prompt = `Analyze the company "${companyName}" based on the scraped content from their website (${web}).

Here is the scraped content:
--- START OF WEBSITE CONTENT ---
${truncateContent(scrapedContent)}
--- END OF WEBSITE CONTENT ---

Extract the following structured information:
1. companyName: The company's name (use "${companyName}" if not found in content)
2. websiteSummary: A 1-2 sentence summary of what the company does
3. productsServices: A list of specific products or services offered (at least 1)
4. targetAudience: Who they seem to target (B2B, B2C, industry, company size, etc.)
5. painSignalsFound: Any pain points or problems evident from their website content. Each must include the signal name, an exact quote as evidence, and the source URL.
6. confidence: How confident you are in this analysis (0-100). Use LOW if scraped content is sparse or generic.

Provide your response strictly in JSON format matching this schema:
{
  "companyName": "string",
  "websiteSummary": "1-2 sentence summary",
  "productsServices": ["product1", "product2"],
  "targetAudience": "description of target audience",
  "painSignalsFound": [
    { "signal": "pain point name", "evidenceQuote": "exact quote", "sourceUrl": "url" }
  ],
  "confidence": 0-100
}`;

    const geminiSchemaDef = {
      type: 'OBJECT',
      properties: {
        companyName: { type: 'STRING' },
        websiteSummary: { type: 'STRING' },
        productsServices: { type: 'ARRAY', items: { type: 'STRING' } },
        targetAudience: { type: 'STRING' },
        painSignalsFound: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              signal: { type: 'STRING' },
              evidenceQuote: { type: 'STRING' },
              sourceUrl: { type: 'STRING' },
            },
            required: ['signal', 'evidenceQuote', 'sourceUrl'],
          },
        },
        confidence: { type: 'INTEGER' },
      },
      required: ['companyName', 'websiteSummary', 'productsServices', 'targetAudience', 'painSignalsFound', 'confidence'],
    };

    const openAiSchema = {
      type: 'object',
      properties: {
        companyName: { type: 'string' },
        websiteSummary: { type: 'string' },
        productsServices: { type: 'array', items: { type: 'string' } },
        targetAudience: { type: 'string' },
        painSignalsFound: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              signal: { type: 'string' },
              evidenceQuote: { type: 'string' },
              sourceUrl: { type: 'string' },
            },
            required: ['signal', 'evidenceQuote', 'sourceUrl'],
          },
        },
        confidence: { type: 'integer' },
      },
      required: ['companyName', 'websiteSummary', 'productsServices', 'targetAudience', 'painSignalsFound', 'confidence'],
      additionalProperties: false,
    };

    if (provider === 'gemini') {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          signal: signal ?? AbortSignal.timeout(25000),
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: 10000,
              responseMimeType: 'application/json',
              responseSchema: geminiSchemaDef,
            },
          }),
        }
      );
      if (!response.ok) { await response.body?.cancel(); throw new Error(`Gemini API returned status ${response.status}`); }
      const data = (await response.json()) as any;
      const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textResult) throw new Error('Invalid response structure from Gemini API');
      let parsed;
      try { parsed = JSON.parse(textResult); } catch { return fallback; }
      try { return SDRWebsiteAnalysisSchema.parse(parsed); } catch { return fallback; }
    }

    if (provider === 'anthropic') {
      const textResult = await callAnthropic(
        prompt, apiKey, modelName,
        'You are a senior market research analyst. Output strictly in valid JSON matching the requested schema.',
        signal,
      );
      let parsed;
      try { parsed = JSON.parse(textResult); } catch { return fallback; }
      try { return SDRWebsiteAnalysisSchema.parse(parsed); } catch { return fallback; }
    }

    const textResult = await callOpenAICompatible(
        provider, prompt, apiKey, modelName,
        'You are a senior market research analyst. Output strictly in valid JSON matching the requested schema.',
        openAiSchema,
        signal,
      );
      let parsed;
      try { parsed = JSON.parse(textResult); } catch { return fallback; }
      try { return SDRWebsiteAnalysisSchema.parse(parsed); } catch { return fallback; }
  });
}

export async function generateSDRICPFit(
  db: Db,
  companyName: string,
  websiteUrl: string | null,
  scrapedContent: string | null,
  icpProfile: { positiveSignals: Array<{ name: string; weight: number; description: string }>; negativeSignals: Array<{ name: string; weight: number; description: string }>; disqualifiers: string[] },
  userId?: string | null
): Promise<SDRICPFitOutput> {
  const posText = (icpProfile.positiveSignals || []).map(s => `- "${s.name}" (weight ${s.weight}): ${s.description}`).join('\n');
  const negText = (icpProfile.negativeSignals || []).map(s => `- "${s.name}" (weight ${s.weight}): ${s.description}`).join('\n');
  const disqText = (icpProfile.disqualifiers || []).map(d => `- "${d}"`).join('\n');

  const web = websiteUrl || 'Unknown';
  const icpFallback: SDRICPFitOutput = { matchedPositiveSignals: [], matchedNegativeSignals: [], disqualifiersTriggered: [], overallAssessment: '', confidence: 0 };

  return callWithProviderChain(db, 'research', userId, async (provider, apiKey, modelName, signal) => {
    const prompt = `Evaluate the company "${companyName}" (website: ${web}) against our Ideal Customer Profile (ICP) criteria.
Analyze the scraped website content below to identify matches.

ICP CRITERIA:
--- Positive Signals (good fit indicators) ---
${posText || 'None defined'}

--- Negative Signals (weak fit indicators) ---
${negText || 'None defined'}

--- Disqualifiers (instant reject) ---
${disqText || 'None defined'}

Here is the scraped content:
--- START OF WEBSITE CONTENT ---
${truncateContent(scrapedContent) || '[No content scraped]'}
--- END OF WEBSITE CONTENT ---

For each matched criteria:
1. Only include it if there is clear evidence in the scraped content.
2. 'signalName' and any per-signal name fields must use the EXACT name from the ICP criteria above.
3. 'matchStrength': strong (explicit match), partial (implied or partial match), weak (vague or inferred).
4. Disqualifiers should always be 'strong' when matched.
5. Cite the exact sentence/phrase as 'evidenceQuote'.
6. Use the company website URL as 'sourceUrl'.

Then provide:
- overallAssessment: A paragraph summarizing the fit, key findings, and any caveats.
- confidence: 0-100 score indicating how reliable this assessment is.

Provide your response strictly in JSON format matching this schema:
{
  "matchedPositiveSignals": [
    { "signalName": "EXACT_NAME", "evidenceQuote": "quote", "sourceUrl": "...", "matchStrength": "strong|partial|weak" }
  ],
  "matchedNegativeSignals": [],
  "disqualifiersTriggered": [],
  "overallAssessment": "Summary paragraph...",
  "confidence": 85
}`;

    const geminiSchemaDef = {
      type: 'OBJECT',
      properties: {
        matchedPositiveSignals: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              signalName: { type: 'STRING' },
              evidenceQuote: { type: 'STRING' },
              sourceUrl: { type: 'STRING' },
              matchStrength: { type: 'STRING', enum: ['strong', 'partial', 'weak'] },
            },
            required: ['signalName', 'evidenceQuote', 'sourceUrl', 'matchStrength'],
          },
        },
        matchedNegativeSignals: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              signalName: { type: 'STRING' },
              evidenceQuote: { type: 'STRING' },
              sourceUrl: { type: 'STRING' },
              matchStrength: { type: 'STRING', enum: ['strong', 'partial', 'weak'] },
            },
            required: ['signalName', 'evidenceQuote', 'sourceUrl', 'matchStrength'],
          },
        },
        disqualifiersTriggered: { type: 'ARRAY', items: { type: 'STRING' } },
        overallAssessment: { type: 'STRING' },
        confidence: { type: 'INTEGER' },
      },
      required: ['matchedPositiveSignals', 'matchedNegativeSignals', 'disqualifiersTriggered', 'overallAssessment', 'confidence'],
    };

    const openAiSchema = {
      type: 'object',
      properties: {
        matchedPositiveSignals: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              signalName: { type: 'string' },
              evidenceQuote: { type: 'string' },
              sourceUrl: { type: 'string' },
              matchStrength: { type: 'string', enum: ['strong', 'partial', 'weak'] },
            },
            required: ['signalName', 'evidenceQuote', 'sourceUrl', 'matchStrength'],
          },
        },
        matchedNegativeSignals: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              signalName: { type: 'string' },
              evidenceQuote: { type: 'string' },
              sourceUrl: { type: 'string' },
              matchStrength: { type: 'string', enum: ['strong', 'partial', 'weak'] },
            },
            required: ['signalName', 'evidenceQuote', 'sourceUrl', 'matchStrength'],
          },
        },
        disqualifiersTriggered: { type: 'array', items: { type: 'string' } },
        overallAssessment: { type: 'string' },
        confidence: { type: 'integer' },
      },
      required: ['matchedPositiveSignals', 'matchedNegativeSignals', 'disqualifiersTriggered', 'overallAssessment', 'confidence'],
      additionalProperties: false,
    };

    if (provider === 'gemini') {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          signal: signal ?? AbortSignal.timeout(25000),
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: 10000,
              responseMimeType: 'application/json',
              responseSchema: geminiSchemaDef,
            },
          }),
        }
      );
      if (!response.ok) { await response.body?.cancel(); throw new Error(`Gemini API returned status ${response.status}`); }
      const data = (await response.json()) as any;
      const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textResult) throw new Error('Invalid response structure from Gemini API');
      let parsed;
      try { parsed = JSON.parse(textResult); } catch { return icpFallback; }
      try { return SDRICPFitSchema.parse(parsed); } catch { return icpFallback; }
    }

    if (provider === 'anthropic') {
      const textResult = await callAnthropic(
        prompt, apiKey, modelName,
        'You are a competitive intelligence analyst. Output strictly in valid JSON matching the requested schema.',
        signal,
      );
      let parsed;
      try { parsed = JSON.parse(textResult); } catch { return icpFallback; }
      try { return SDRICPFitSchema.parse(parsed); } catch { return icpFallback; }
    }

    const textResult = await callOpenAICompatible(
        provider, prompt, apiKey, modelName,
        'You are a competitive intelligence analyst. Output strictly in valid JSON matching the requested schema.',
        openAiSchema,
        signal,
      );
      let parsed;
      try { parsed = JSON.parse(textResult); } catch { return icpFallback; }
      try { return SDRICPFitSchema.parse(parsed); } catch { return icpFallback; }
  });
}

export async function generateOfferAndICPFromDescription(
  db: Db,
  marketName: string,
  offerDescription: string,
  icpDescription: string,
  userId?: string | null
): Promise<AIGeneratedStrategyOutput> {
  const strategyFallback: AIGeneratedStrategyOutput = { offer: { name: '', targetPain: '', desiredOutcome: '', proofPoints: [], forbiddenClaims: [] }, icp: { name: '', positiveSignals: [], negativeSignals: [], disqualifiers: [] } };
  const prompt = `You are a world-class growth strategist and B2B copywriter.
A user wants to configure a target market campaign in their sales intelligence system.
Based on the following informal descriptions, generate a structured Offer profile and an Ideal Customer Profile (ICP).

Market / Campaign Name: "${marketName}"
Offer Description (what they sell): "${offerDescription}"
ICP Description (who they target / who they want to avoid): "${icpDescription}"

Your goal is to parse these informal descriptions into a strict structured configuration.

For the Offer:
- targetPain: What specific pain points does the offer solve?
- desiredOutcome: What is the primary business outcome or transformation?
- proofPoints: Generate 3 realistic, high-impact proof points or case studies typical for this kind of offer.
- forbiddenClaims: Generate 2-3 claims or buzzwords they should avoid (e.g. "best in the world", "guaranteed leads").

For the ICP Profile:
- positiveSignals: Extract 3-5 positive characteristics or triggers that indicate a strong fit client. For each, give a short descriptive name, a weight from 1-10 (high fit = higher weight), and a clear definition/description of what to look for on their website.
- negativeSignals: Extract 2-3 characteristics that indicate a weak fit but aren't complete disqualifiers. For each, give a short descriptive name, a weight from 1-10 (higher weight = worse fit/more negative), and a description.
- disqualifiers: Extract 2-3 clear disqualifying criteria (e.g. "Agencies", "No custom software", "Fewer than 10 employees") where if they match, we should instantly reject them.

Provide your response strictly in JSON format matching this schema:
{
  "offer": {
    "name": "${marketName} Offer",
    "targetPain": "...",
    "desiredOutcome": "...",
    "proofPoints": ["...", "..."],
    "forbiddenClaims": ["...", "..."]
  },
  "icp": {
    "name": "${marketName} ICP",
    "positiveSignals": [
      { "name": "...", "weight": 5, "description": "..." }
    ],
    "negativeSignals": [
      { "name": "...", "weight": 3, "description": "..." }
    ],
    "disqualifiers": ["...", "..."]
  }
}`;

  const geminiSchema = {
    type: 'OBJECT',
    properties: {
      offer: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          targetPain: { type: 'STRING' },
          desiredOutcome: { type: 'STRING' },
          proofPoints: { type: 'ARRAY', items: { type: 'STRING' } },
          forbiddenClaims: { type: 'ARRAY', items: { type: 'STRING' } }
        },
        required: ['name', 'targetPain', 'desiredOutcome', 'proofPoints', 'forbiddenClaims']
      },
      icp: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          positiveSignals: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING' },
                weight: { type: 'INTEGER' },
                description: { type: 'STRING' }
              },
              required: ['name', 'weight', 'description']
            }
          },
          negativeSignals: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING' },
                weight: { type: 'INTEGER' },
                description: { type: 'STRING' }
              },
              required: ['name', 'weight', 'description']
            }
          },
          disqualifiers: { type: 'ARRAY', items: { type: 'STRING' } }
        },
        required: ['name', 'positiveSignals', 'negativeSignals', 'disqualifiers']
      }
    },
    required: ['offer', 'icp']
  };

  const openAiSchema = {
    type: 'object',
    properties: {
      offer: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          targetPain: { type: 'string' },
          desiredOutcome: { type: 'string' },
          proofPoints: { type: 'array', items: { type: 'string' } },
          forbiddenClaims: { type: 'array', items: { type: 'string' } }
        },
        required: ['name', 'targetPain', 'desiredOutcome', 'proofPoints', 'forbiddenClaims']
      },
      icp: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          positiveSignals: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                weight: { type: 'integer' },
                description: { type: 'string' }
              },
              required: ['name', 'weight', 'description']
            }
          },
          negativeSignals: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                weight: { type: 'integer' },
                description: { type: 'string' }
              },
              required: ['name', 'weight', 'description']
            }
          },
          disqualifiers: { type: 'array', items: { type: 'string' } }
        },
        required: ['name', 'positiveSignals', 'negativeSignals', 'disqualifiers']
      }
    },
    required: ['offer', 'icp']
  };

  return callWithProviderChain(db, 'scoring', userId, async (provider, apiKey, modelName, signal) => {
    if (provider === 'gemini') {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          signal: signal ?? AbortSignal.timeout(25000),
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: 5000,
              responseMimeType: 'application/json',
              responseSchema: geminiSchema,
            }
          })
        }
      );
      if (!response.ok) { await response.body?.cancel(); throw new Error(`Gemini API returned status ${response.status}`); }
      const data = (await response.json()) as any;
      const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textResult) throw new Error('Invalid response from Gemini API');
      let parsed;
      try { parsed = JSON.parse(textResult); } catch { return strategyFallback; }
      try { return AIGeneratedStrategySchema.parse(parsed); } catch { return strategyFallback; }
    }

    if (provider === 'anthropic') {
      const textResult = await callAnthropic(
        prompt, apiKey, modelName,
        'You are a world-class growth strategist. Output strictly in valid JSON matching the requested schema.',
        signal,
      );
      let parsed;
      try { parsed = JSON.parse(textResult); } catch { return strategyFallback; }
      try { return AIGeneratedStrategySchema.parse(parsed); } catch { return strategyFallback; }
    }

    const textResult = await callOpenAICompatible(
        provider, prompt, apiKey, modelName,
        'You are a world-class growth strategist. Output strictly in valid JSON matching the requested schema.',
        openAiSchema,
        signal,
      );
      let parsed;
      try { parsed = JSON.parse(textResult); } catch { return strategyFallback; }
      try { return AIGeneratedStrategySchema.parse(parsed); } catch { return strategyFallback; }
  });
}
