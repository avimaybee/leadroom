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
});

export type AIAuditOutput = z.infer<typeof AIAuditSchema>;

export const AITriageSchema = z.object({
  status: z.enum(['MODERN', 'OUTDATED']),
  reason: z.string(),
});

export type AITriageOutput = z.infer<typeof AITriageSchema>;

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

import { IntegrationsService } from '../services/integrations';

export async function generateResearch(
  db: Db,
  leadName: string,
  companyName: string | null,
  websiteUrl: string | null,
  industry: string | null,
  scrapedContent?: string | null,
  location?: string | null
): Promise<AIResearchOutput> {
  const integrationsService = new IntegrationsService(db);
  
  // Get active provider config
  let config = null;
  for (const p of ['openrouter', 'nvidia', 'groq', 'aiml', 'gemini']) {
    const pConfig = await integrationsService.getProviderConfig(p);
    if (pConfig && pConfig.isActive) {
      config = pConfig;
      break;
    }
  }

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

Generate a comprehensive digital presence audit and outreach opportunity hypotheses for our creative/digital agency.
For the fields "painPointsHypotheses" and "opportunityHypotheses", you MUST format the content using Markdown list items (e.g. using "- " or "* " for bullet points, and appropriate bolding or italics). Do not output a flat wall of text.

Provide your response strictly in JSON format. The response must match the following JSON schema:
{
  "companySummary": "A concise overview of the company, its scale, and main business line.",
  "productsServicesSummary": "A description of the core products and services they offer.",
  "digitalPresenceNotes": "Notes on their overall digital footprint, social media channels, and visibility.",
  "websiteNotes": "Critique of their website user experience, responsiveness, layout, and call-to-actions.",
  "brandingNotes": "Critique of their branding, typography, color palette, consistency, and professional feel.",
  "painPointsHypotheses": "Potential digital/branding bottlenecks they are facing that we can resolve (Formatted as a Markdown bulleted list).",
  "opportunityHypotheses": "Concrete hypotheses on how our agency can help them grow (e.g., website redesign, brand refresh, social templates) (Formatted as a Markdown bulleted list).",
  "sources": ["List of URLs or search queries utilized (array of strings)"],
  "confidenceLevel": "LOW", "MEDIUM", or "HIGH"
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
          ? 'You are a professional research assistant. You MUST respond with ONLY valid JSON matching the exact schema requested. Do not include markdown code blocks or any other text.' 
          : 'You are a professional research assistant. Output strictly in JSON.'
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
        content: 'You are a professional research assistant. You MUST respond with ONLY valid JSON matching the exact schema requested. Do not include markdown code blocks or any other text.'
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
        'HTTP-Referer': 'https://github.com/googlemind/draftroom',
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

export async function runTriageAI(
  db: Db,
  scrapedContent: string
): Promise<AITriageOutput> {
  const integrationsService = new IntegrationsService(db);
  
  // Get active provider config
  let config = null;
  for (const p of ['openrouter', 'nvidia', 'groq', 'aiml', 'gemini']) {
    const pConfig = await integrationsService.getProviderConfig(p);
    if (pConfig && pConfig.isActive) {
      config = pConfig;
      break;
    }
  }

  const provider = config?.provider || 'gemini';
  const apiKey = config?.apiKey || (process as any).env?.GEMINI_API_KEY;
  const modelName = config?.modelName || (
    provider === 'openrouter' ? 'google/gemini-2.5-flash' : 
    provider === 'nvidia' ? 'meta/llama-3.1-70b-instruct' : 
    provider === 'groq' ? 'llama3-70b-8192' : 
    provider === 'aiml' ? 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning' :
    'gemini-2.5-flash'
  );

  if (!apiKey || apiKey === 'placeholder' || apiKey === '') {
    return { status: 'OUTDATED', reason: 'Triage fallback (No API Key configured).' };
  }

  const prompt = `
    You are an expert digital agency auditor. Analyze the following homepage content for a local business.
    Your task is to determine if the site is MODERN or OUTDATED.
    
    Guidelines:
    - Look for signs of outdated practices: "copyright 2012", generic directory listings, flash, tables, lack of mobile keywords.
    - If it looks very simple, sparse, broken, or old -> OUTDATED
    - If it seems comprehensive and well structured -> MODERN
    
    Respond in exactly this JSON format:
    {
      "status": "MODERN" | "OUTDATED",
      "reason": "A 1-sentence explanation of why."
    }
    
    Website Content:
    ---
    ${scrapedContent}
    ---
  `;

  try {
    if (provider === 'openrouter') {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://github.com/googlemind/draftroom',
          'X-Title': 'Draftroom',
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: 'You are a professional assistant. You MUST respond with ONLY valid JSON matching the exact schema requested.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' }
        }),
      });
      if (!res.ok) throw new Error(`OpenRouter returned status ${res.status}`);
      const data = (await res.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      };
      const text = data.choices?.[0]?.message?.content?.trim();
      const parsed = JSON.parse(text || '{}');
      return AITriageSchema.parse(parsed);
    }

    if (provider === 'nvidia') {
      const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: 'You are a professional assistant. You MUST respond with ONLY valid JSON matching the exact schema requested.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' }
        }),
      });
      if (!res.ok) throw new Error(`NVIDIA returned status ${res.status}`);
      const data = (await res.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      };
      const text = data.choices?.[0]?.message?.content?.trim();
      const parsed = JSON.parse(text || '{}');
      return AITriageSchema.parse(parsed);
    }

    if (provider === 'groq') {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: 'You are a professional assistant. You MUST respond with ONLY valid JSON matching the exact schema requested.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' }
        }),
      });
      if (!res.ok) throw new Error(`Groq returned status ${res.status}`);
      const data = (await res.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      };
      const text = data.choices?.[0]?.message?.content?.trim();
      const parsed = JSON.parse(text || '{}');
      return AITriageSchema.parse(parsed);
    }

    if (provider === 'aiml') {
      const res = await fetch('https://api.aimlapi.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: 'You are a professional assistant. You MUST respond with ONLY valid JSON matching the exact schema requested.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' }
        }),
      });
      if (!res.ok) throw new Error(`AIML returned status ${res.status}`);
      const data = (await res.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      };
      const text = data.choices?.[0]?.message?.content?.trim();
      const parsed = JSON.parse(text || '{}');
      return AITriageSchema.parse(parsed);
    }

    // Gemini
    const res = await fetch(
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
                status: { type: 'STRING', enum: ['MODERN', 'OUTDATED'] },
                reason: { type: 'STRING' },
              },
              required: ['status', 'reason'],
            },
          },
        }),
      }
    );
    if (!res.ok) throw new Error(`Gemini returned status ${res.status}`);
    const data = (await res.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
          }>;
        };
      }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(text || '{}');
    return AITriageSchema.parse(parsed);

  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[Triage AI] Error running triage completion:', err);
    return { status: 'OUTDATED', reason: `Triage generation failed: ${errMsg}` };
  }
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
        content: 'You are a professional research assistant. You MUST respond with ONLY valid JSON matching the exact schema requested. Do not include markdown code blocks or any other text.'
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
        content: 'You are a professional research assistant. You MUST respond with ONLY valid JSON matching the exact schema requested. Do not include markdown code blocks or any other text.'
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
  scrapedContent?: string | null
): Promise<AIAuditOutput> {
  const integrationsService = new IntegrationsService(db);
  
  // Get active provider config
  let config = null;
  for (const p of ['openrouter', 'nvidia', 'groq', 'aiml', 'gemini']) {
    const pConfig = await integrationsService.getProviderConfig(p);
    if (pConfig && pConfig.isActive) {
      config = pConfig;
      break;
    }
  }

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

  const name = companyName || leadName;
  const ind = industry || 'General Business';
  const web = websiteUrl || 'No website provided';

  const prompt = `Perform a comprehensive digital presence, website, and branding audit on the company "${name}".
Industry: ${ind}
Website: ${web}
${scrapedContent ? `\nHere is the scraped content of their website to analyze:\n--- START OF WEBSITE CONTENT ---\n${scrapedContent}\n--- END OF WEBSITE CONTENT ---\n` : ''}

Evaluate the following categories and assign integer scores from 0 (terrible/broken) to 100 (excellent/premium):
- websiteQualityScore: Technical usability, layout, loading indicators, ease of use.
- designAestheticScore: Typography, layout design, spacing, colors, visual appeal.
- messagingClarityScore: Messaging clarity, value proposition.
- socialPresenceScore: Estimated presence (use 40-50 if no social URLs present in text).
- overallBrandingScore: Branding consistency, professional look.

Additionally, provide markdown-formatted bulleted lists for:
- keyStrengths: Strengths of their current design/branding.
- keyWeaknesses: Weaknesses and issues of their current design/branding.
- recommendedImprovements: Actionable creative and digital improvements.

Provide your response strictly in JSON format. The response must match the following JSON schema:
{
  "websiteQualityScore": 75,
  "designAestheticScore": 60,
  "messagingClarityScore": 55,
  "socialPresenceScore": 40,
  "overallBrandingScore": 60,
  "keyStrengths": "- Bullet point strength 1\\n- Bullet point strength 2",
  "keyWeaknesses": "- Bullet point weakness 1\\n- Bullet point weakness 2",
  "recommendedImprovements": "- Improvement 1\\n- Improvement 2",
  "sources": ["List of URLs checked"]
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
            { role: 'system', content: 'You are a professional digital design auditor. Output strictly JSON.' },
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
  };
}

export async function generateOutreachDraft(
  db: Db,
  leadName: string,
  companyName: string | null,
  websiteUrl: string | null,
  industry: string | null,
  channel: 'EMAIL' | 'LINKEDIN' | 'CALL' | 'MEETING',
  contactsList: any[],
  researchSnapshot: any | null,
  auditSnapshot: any | null,
  customPrompt?: string | null,
  attachments?: Array<{ name: string; type: string; base64: string }>
): Promise<AIOutreachDraftOutput> {
  const integrationsService = new IntegrationsService(db);
  
  // Get active provider config
  let config = null;
  for (const p of ['openrouter', 'nvidia', 'groq', 'aiml', 'gemini']) {
    const pConfig = await integrationsService.getProviderConfig(p);
    if (pConfig && pConfig.isActive) {
      config = pConfig;
      break;
    }
  }

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
    ? contactsList.map(c => `- ${c.name} (${c.role || 'Stakeholder'})${c.email ? `, Email: ${c.email}` : ''}`).join('\n')
    : 'No contact stakeholders found';

  const prompt = `Draft outreach prep/copy for the company "${name}".
Industry: ${ind}
Website: ${web}
Channel: ${channel} (Use EMAIL for a cold email draft, LINKEDIN for a LinkedIn message, CALL for phone call prep script/bullets, or MEETING for a meeting/visit prep guide with agenda and discovery questions).

Stakeholders:
${contactText}

${researchSnapshot ? `Research Context:\n- Company Summary: ${researchSnapshot.companySummary}\n- Pain Points: ${researchSnapshot.painPointsHypotheses}\n- Opportunity Hypotheses: ${researchSnapshot.opportunityHypotheses}\n` : ''}
${auditSnapshot ? `Website & Branding Audit Context:\n- Overall Branding Score: ${auditSnapshot.overallBrandingScore}/100\n- Design Aesthetic Score: ${auditSnapshot.designAestheticScore}/100\n- Key Weaknesses: ${auditSnapshot.keyWeaknesses}\n- Recommended Improvements: ${auditSnapshot.recommendedImprovements}\n` : ''}
${customPrompt ? `\nSPECIAL INSTRUCTIONS FROM THE OPERATOR:\n${customPrompt}\n` : ''}
${attachments && attachments.length > 0 ? `\nNote: The operator has attached ${attachments.length} files (images or PDFs) showing mockup/branding/website context. Please reference or adapt your feedback specifically incorporating visual details or document findings if vision support is active.\n` : ''}
Instructions:
1. Craft a highly personalized outreach message (or call prep script/bullets) designed to offer our creative/digital agency services (e.g. brand refresh, website redesign, UX optimization).
2. Reference specific findings (like audit scores or key weaknesses/pain points) naturally to show we did our homework.
3. Be professional, direct, non-spammy, and concise.
4. For EMAIL, specify a compelling subject line. For LINKEDIN or CALL, leave "subject" as null.
5. In "body", use plain text or simple markdown (line breaks, bullet points) for readability.

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
            { role: 'system', content: 'You are a professional outreach assistant. Output strictly JSON.' },
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
          'HTTP-Referer': 'https://github.com/googlemind/draftroom',
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
  const integrationsService = new IntegrationsService(db);
  let config = null;
  for (const p of ['openrouter', 'nvidia', 'groq', 'aiml', 'gemini']) {
    const pConfig = await integrationsService.getProviderConfig(p);
    if (pConfig && pConfig.isActive) {
      config = pConfig;
      break;
    }
  }

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



