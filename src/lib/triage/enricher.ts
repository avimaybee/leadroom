import { fetchSiteContentLight } from '../scraper';
import { runTriageAI } from '../ai';
import type { Db } from '@/db';

export interface EnrichResult {
  triagePriority: 'HIGH' | 'MEDIUM' | 'SKIP';
  triageReason: string;
}

/**
 * Three-level enrichment for a single candidate website:
 *   1. Direct fetch (zero browser/AI cost)
 *   2. Browser Run /markdown (browser time only, no Workers AI)
 *   3. Browser Run /json (browser time + Workers AI — single call replaces scrape+AI)
 *
 * Falls back to the next level if the previous one fails.
 * Returns null only if ALL levels fail (caller should keep heuristic badge).
 */
const ENRICH_TIMEOUT_MS = 12_000; // overall timeout per candidate

export async function enrichCandidate(
  website: string,
  db: Db,
  browserBinding?: unknown,
): Promise<EnrichResult | null> {
  if (!website) {
    return { triagePriority: 'HIGH', triageReason: 'No website detected.' };
  }

  // AbortController propagates through fetch calls to cancel early.
  // Promise.race provides the hard timeout boundary — browser.quickAction
  // does not support AbortSignal, so the race ensures we return in time.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ENRICH_TIMEOUT_MS);

  try {
      return await Promise.race([
        enrichCandidateInner(website, db, browserBinding, controller.signal),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), ENRICH_TIMEOUT_MS)),
      ]);
  } finally {
    clearTimeout(timeout);
  }
}

async function enrichCandidateInner(
  website: string,
  db: Db,
  browserBinding?: unknown,
  signal?: AbortSignal,
): Promise<EnrichResult | null> {
  // ---- Level 1: Direct fetch (zero cost) ----
  if (!signal?.aborted) {
    const directContent = await fetchSiteContentLight(website, 15000, signal);
    if (directContent) {
      try {
        const triage = await runTriageAI(db, directContent);
        return {
          triagePriority: triage.status === 'MODERN' ? 'SKIP' : 'MEDIUM',
          triageReason: triage.reason,
        };
      } catch {
        // AI call failed — fall through to next level
      }
    }
  }

  // ---- Level 2: Browser Run /markdown (browser time only) ----
  if (!signal?.aborted) {
    const markdownContent = await fetchMarkdownViaBrowser(website, browserBinding);
    if (markdownContent) {
      try {
        const triage = await runTriageAI(db, markdownContent);
        return {
          triagePriority: triage.status === 'MODERN' ? 'SKIP' : 'MEDIUM',
          triageReason: triage.reason,
        };
      } catch {
        // AI call failed — fall through to next level
      }
    }
  }

  // ---- Level 3: Browser Run /json (browser time + Workers AI, one-shot) ----
  if (!signal?.aborted) {
    const jsonResult = await triageViaBrowserJson(website, browserBinding);
    if (jsonResult) {
      return jsonResult;
    }
  }

  // All levels failed or aborted
  return null;
}

/**
 * Level 2: Fetch page content as Markdown via Browser Run.
 * Only works in Cloudflare runtime with BROWSER binding.
 */
async function fetchMarkdownViaBrowser(
  url: string,
  binding: unknown,
): Promise<string | null> {
  const browser = binding as { quickAction?: (endpoint: string, opts: Record<string, unknown>) => Promise<{ markdown?: string }> } | undefined;
  if (!browser?.quickAction) return null;

  try {
    const res = await browser.quickAction('markdown', {
      url,
      gotoOptions: { waitUntil: 'networkidle2', timeout: 20000 },
    });
    if (!res || !res.markdown || res.markdown.length < 200) return null;
    return res.markdown.substring(0, 5000);
  } catch {
    return null;
  }
}

/**
 * Level 3: Use Browser Run /json to render page + AI classify in one call.
 * Uses Workers AI (Llama 3.3 70B) by default — no external API key needed.
 */
async function triageViaBrowserJson(
  url: string,
  binding: unknown,
): Promise<EnrichResult | null> {
  const browser = binding as { quickAction?: (endpoint: string, opts: Record<string, unknown>) => Promise<{ result?: { status?: string; reason?: string } }> } | undefined;
  if (!browser?.quickAction) return null;

  const schema = {
    type: 'json_schema',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['MODERN', 'OUTDATED'] },
        reason: { type: 'string' },
      },
      required: ['status', 'reason'],
    },
  };

  try {
    const res = await browser.quickAction('json', {
      url,
      prompt: `Analyze this business website. Determine if it looks MODERN or OUTDATED.
- MODERN: good design, clear messaging, professional layout, mobile-friendly
- OUTDATED: poor design, cluttered, old-looking, uses free templates, no clear value proposition
Respond with the status and a 1-sentence reason.`,
      response_format: schema,
      gotoOptions: { waitUntil: 'networkidle2', timeout: 20000 },
    });

    const result = res?.result;
    if (!result?.status) return null;

    const status = result.status as string;
    if (status !== 'MODERN' && status !== 'OUTDATED') return null;

    return {
      triagePriority: status === 'MODERN' ? 'SKIP' : 'MEDIUM',
      triageReason: result.reason || 'Assessed via Browser Run AI.',
    };
  } catch {
    return null;
  }
}
