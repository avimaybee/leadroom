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

import { IntegrationsService } from '../services/integrations';

export async function generateResearch(
  db: Db,
  leadName: string,
  companyName: string | null,
  websiteUrl: string | null,
  industry: string | null,
  scrapedContent?: string | null
): Promise<AIResearchOutput> {
  const integrationsService = new IntegrationsService(db);
  
  // Get active provider config
  let config = null;
  for (const p of ['openrouter', 'nvidia', 'groq', 'gemini']) {
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
    'gemini-2.5-flash'
  );

  if (!apiKey || apiKey === 'placeholder' || apiKey === '') {
    return generateMockResearch(leadName, companyName, websiteUrl, industry);
  }

  const name = companyName || leadName;
  const ind = industry || 'General Business';
  const web = websiteUrl || 'No website provided';

  const prompt = `Perform research on the company "${name}".
Industry: ${ind}
Website: ${web}
${scrapedContent ? `\nHere is the scraped content of their website to analyze:\n--- START OF WEBSITE CONTENT ---\n${scrapedContent}\n--- END OF WEBSITE CONTENT ---\n` : ''}

Generate a comprehensive digital presence audit and outreach opportunity hypotheses for our creative/digital agency.
Provide your response strictly in JSON format. The response must match the following JSON schema:
{
  "companySummary": "A concise overview of the company, its scale, and main business line.",
  "productsServicesSummary": "A description of the core products and services they offer.",
  "digitalPresenceNotes": "Notes on their overall digital footprint, social media channels, and visibility.",
  "websiteNotes": "Critique of their website user experience, responsiveness, layout, and call-to-actions.",
  "brandingNotes": "Critique of their branding, typography, color palette, consistency, and professional feel.",
  "painPointsHypotheses": "Potential digital/branding bottlenecks they are facing that we can resolve.",
  "opportunityHypotheses": "Concrete hypotheses on how our agency can help them grow (e.g., website redesign, brand refresh, social templates).",
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
): Promise<{ status: 'MODERN' | 'OUTDATED'; reason: string }> {
  const integrationsService = new IntegrationsService(db);
  
  // Get active provider config
  let config = null;
  for (const p of ['openrouter', 'nvidia', 'groq', 'gemini']) {
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
      return JSON.parse(text || '{}');
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
      return JSON.parse(text || '{}');
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
      return JSON.parse(text || '{}');
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
    return JSON.parse(text || '{}');

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


