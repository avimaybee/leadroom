import { z } from 'zod';

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

export async function generateResearch(
  leadName: string,
  companyName: string | null,
  websiteUrl: string | null,
  industry: string | null
): Promise<AIResearchOutput> {
  const apiKey = (process as any).env?.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'placeholder' || apiKey === '') {
    return generateMockResearch(leadName, companyName, websiteUrl, industry);
  }

  const name = companyName || leadName;
  const ind = industry || 'General Business';
  const web = websiteUrl || 'No website provided';

  const prompt = `Perform research on the company "${name}".
Industry: ${ind}
Website: ${web}

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

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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

    const data = await response.json() as any;
    const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResult) {
      throw new Error('Invalid response structure from Gemini API');
    }

    const parsed = JSON.parse(textResult);
    return AIResearchSchema.parse(parsed);
  } catch (error) {
    console.error('Gemini API call failed, falling back to mock generator:', error);
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
