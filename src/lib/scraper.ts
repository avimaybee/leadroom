/**
 * Web Scraping utility using Fetch-First or Cloudflare Browser Run Quick Actions.
 * Optimised for fetching and extracting website content for LLMs.
 * 
 * Two tiers:
 *   fetchSiteContent — full chain (direct → Browser Run → Jina) for deep research
 *   fetchSiteContentLight — direct fetch only, no fallbacks (for discovery enrichment)
 */

import { extractAll, type ContactExtract } from './contacts/extract';

export interface ScrapedContent {
  title: string;
  url: string;
  content: string;
  description: string;
  screenshot?: string;
  extractedContacts?: ContactExtract;
}

/**
 * Check whether the given IPv4 address (dotted decimal) is in a private range.
 */
function isPrivateIpv4(a: number, b: number, _c: number, _d: number): boolean {
  if (a === 127 || a === 10 || (a === 192 && b === 168)) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

/**
 * Converts an integer (decimal or hex) to dotted-decimal IPv4.
 * Returns null if the integer is out of IPv4 range.
 */
function integerToDotted(n: number): string | null {
  if (n < 0 || n > 0xffffffff) return null;
  return `${(n >>> 24) & 0xff}.${(n >>> 16) & 0xff}.${(n >>> 8) & 0xff}.${n & 0xff}`;
}

/**
 * Pattern-based check for private/internal IP addresses in hostnames.
 * Catches dotted-decimal, decimal, hex, and hex-per-octet encodings.
 */
function isPrivateHostname(hostname: string): boolean {
  // Normalize: strip brackets for IPv6
  const h = hostname.replace(/^\[|\]$/g, '').toLowerCase();

  // Exact matches for loopback / invalid
  if (h === 'localhost' || h === 'localhost.localdomain' || h === '0.0.0.0' || h === '[::1]' || h === '::1') {
    return true;
  }

  // IPv4 private ranges (standard dotted decimal)
  const ipv4Match = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const a = parseInt(ipv4Match[1], 10);
    const b = parseInt(ipv4Match[2], 10);
    const c = parseInt(ipv4Match[3], 10);
    const d = parseInt(ipv4Match[4], 10);
    if (a <= 255 && b <= 255 && c <= 255 && d <= 255 && isPrivateIpv4(a, b, c, d)) return true;
  }

  // Decimal integer hostname (e.g. 2130706433 = 127.0.0.1)
  if (/^\d+$/.test(h) && h.length >= 9) {
    const dotted = integerToDotted(parseInt(h, 10));
    if (dotted) {
      const parts = dotted.split('.').map(Number);
      if (isPrivateIpv4(parts[0], parts[1], parts[2], parts[3])) return true;
    }
  }

  // Hexadecimal integer hostname (e.g. 0x7f000001 = 127.0.0.1)
  if (/^0x[0-9a-f]{1,8}$/i.test(h)) {
    const dotted = integerToDotted(parseInt(h, 16));
    if (dotted) {
      const parts = dotted.split('.').map(Number);
      if (isPrivateIpv4(parts[0], parts[1], parts[2], parts[3])) return true;
    }
  }

  // Hex-per-octet dotted (e.g. 0x7f.0x00.0x00.0x01)
  const hexDottedMatch = h.match(/^0x([0-9a-f]{1,2})\.0x([0-9a-f]{1,2})\.0x([0-9a-f]{1,2})\.0x([0-9a-f]{1,2})$/i);
  if (hexDottedMatch) {
    const a = parseInt(hexDottedMatch[1], 16);
    const b = parseInt(hexDottedMatch[2], 16);
    const c = parseInt(hexDottedMatch[3], 16);
    const d = parseInt(hexDottedMatch[4], 16);
    if (isPrivateIpv4(a, b, c, d)) return true;
  }

  // RFC 3849 documentation prefix (2001:db8::/32) — reject
  if (h.startsWith('2001:db8:')) return true;

  return false;
}

/**
 * Normalises a URL to ensure it has a protocol (defaults to https://).
 * Rejects URLs pointing to private/internal IPs as an SSRF safeguard.
 */
export function normalizeUrl(url: string): string {
  let cleaned = url.trim();
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }

  try {
    const parsed = new URL(cleaned);
    if (isPrivateHostname(parsed.hostname)) {
      throw new Error(`URL rejected: hostname "${parsed.hostname}" is a private/internal address`);
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith('URL rejected')) throw err;
    throw new Error(`Invalid URL: "${url}" could not be parsed`);
  }

  return cleaned;
}

// Helpers for Fetch-First
async function fetchDirectly(url: string, timeoutMs: number, signal?: AbortSignal): Promise<string | null> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  // Link external signal (e.g. enrichment timeout) to our controller
  const onAbort = () => { clearTimeout(id); controller.abort(); };
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'error',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });
    clearTimeout(id);
    signal?.removeEventListener('abort', onAbort);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return null;
    }
    return await res.text();
  } catch {
    clearTimeout(id);
    signal?.removeEventListener('abort', onAbort);
    return null;
  }
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim() : '';
}

function extractDescription(html: string): string {
  const match = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i) ||
                html.match(/<meta[^>]*content="([^"]*)"[^>]*name="description"/i);
  return match ? match[1].trim() : '';
}

function cleanHtml(html: string): string {
  let text = html;
  text = text.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '');
  text = text.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '');
  text = text.replace(/<svg[^>]*>([\s\S]*?)<\/svg>/gi, '');
  text = text.replace(/<noscript[^>]*>([\s\S]*?)<\/noscript>/gi, '');
  text = text.replace(/<\/?[^>]+(>|$)/g, ' ');
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

function isLikelySPAOrEmpty(html: string, cleanedText: string): boolean {
  if (cleanedText.length < 600) return true;
  const lowerText = cleanedText.toLowerCase();
  const lowerHtml = html.toLowerCase();
  if (lowerText.includes('enable javascript') || lowerText.includes('need javascript to run')) {
    return true;
  }
  if (lowerHtml.includes('<div id="app"></div>') && !lowerHtml.includes('</a>') && !lowerHtml.includes('</p>')) {
    return true;
  }
  if (lowerHtml.includes('<div id="root"></div>') && !lowerHtml.includes('</a>') && !lowerHtml.includes('</p>')) {
    return true;
  }
  return false;
}

/**
 * Truncates content to a maximum character limit with a truncation notice.
 */
function truncateContent(content: string, maxChars: number = 15000): string {
  if (content.length <= maxChars) return content;
  return content.substring(0, maxChars) + '\n\n[Content truncated due to length limitations]';
}

/**
 * Fetches website content via Cloudflare Browser Run Quick Action /snapshot.
 */
export async function scrapeWithBrowserRun(url: string, browserBinding: any, timeoutMs: number = 30000): Promise<ScrapedContent> {
  const normalized = normalizeUrl(url);
  try {
    if (!browserBinding || typeof browserBinding.quickAction !== 'function') {
      throw new Error("Browser binding does not support quickAction");
    }

    const snapshot = await browserBinding.quickAction("snapshot", {
      url: normalized,
      formats: ["markdown", "screenshot", "content"],
    }) as { markdown?: string; screenshot?: string; content?: string };

    if (!snapshot) {
      throw new Error("Failed to capture snapshot from Browser Run");
    }

    const content = snapshot.markdown || "";
    const html = snapshot.content || "";
    const title = html ? extractTitle(html) : "";
    const description = html ? extractDescription(html) : "";
    const screenshot = snapshot.screenshot || undefined;

    return {
      title,
      url: normalized,
      content: truncateContent(content),
      description,
      screenshot,
      extractedContacts: html ? extractAll(html) : undefined,
    };
  } catch (error: any) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`Browser Run quickAction failed for ${normalized}:`, error);

    // Identify 429 / limit exceeded error
    if (
      errMsg.includes("429") ||
      errMsg.toLowerCase().includes("rate limit") ||
      errMsg.toLowerCase().includes("limit exceeded") ||
      errMsg.toLowerCase().includes("time limit exceeded") ||
      (error.status && error.status === 429)
    ) {
      const limitError = new Error(`429: Cloudflare Browser Run limits exceeded: ${errMsg}`);
      (limitError as any).status = 429;
      throw limitError;
    }
    throw error;
  }
}

/**
 * Fetches website content via Jina Reader.
 */
async function fetchSiteContentViaJina(url: string, timeoutMs: number = 15000): Promise<ScrapedContent> {
  const normalized = normalizeUrl(url);
  const targetUrl = `https://r.jina.ai/${normalized}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const headers: HeadersInit = {
    'Accept': 'application/json',
  };

  const jinaKey = (process as any).env?.JINA_API_KEY;
  if (jinaKey && jinaKey !== 'placeholder') {
    headers['Authorization'] = `Bearer ${jinaKey}`;
  }

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error('External scraper returned an error response');
    }

    const json = (await response.json()) as {
      data?: {
        title?: string;
        content?: string;
        description?: string;
      };
    };
    if (json && json.data) {
      const data = json.data;
      const title = data.title || '';
      const content = data.content || '';
      const description = data.description || '';

      return {
        title,
        url: normalized,
        content: truncateContent(content),
        description,
      };
    } else {
      throw new Error('Invalid response structure from Jina Reader API');
    }
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Scraping request timed out after ${timeoutMs / 1000} seconds.`);
    }
    throw error;
  }
}

/**
 * Coordinated scraper that tries a direct HTML fetch first (zero Browser Run limit usage),
 * and if that fails or returns dynamic/SPA indicators, falls back to Browser Run / Jina.
 */
export async function fetchSiteContent(url: string, timeoutMs: number = 20000): Promise<ScrapedContent> {
  const normalized = normalizeUrl(url);

  // 1. Try Fetch-First (Direct static fetch)
  try {
    console.log(`Attempting Fetch-First direct fetch for ${normalized}`);
    const html = await fetchDirectly(normalized, timeoutMs);
    if (html) {
      const title = extractTitle(html);
      const description = extractDescription(html);
      const cleaned = cleanHtml(html);
      
      if (!isLikelySPAOrEmpty(html, cleaned)) {
        console.log(`Fetch-First successful for ${normalized} (${cleaned.length} chars)`);
        return {
          title,
          url: normalized,
          content: truncateContent(cleaned),
          description,
          extractedContacts: extractAll(html),
        };
      } else {
        console.log(`Fetch-First returned sparse content or SPA indicator. Falling back to browser/Jina.`);
      }
    }
  } catch (err) {
    console.warn(`Fetch-First direct fetch failed for ${normalized}:`, err);
  }

  // 2. Fallback to Browser Run (if present) or Jina
  const browserBinding = (process as any).env?.BROWSER;
  
  if (browserBinding) {
    console.log(`Attempting Browser Run edge scraping for ${normalized}`);
    try {
      return await scrapeWithBrowserRun(normalized, browserBinding, timeoutMs + 10000);
    } catch (error: unknown) {
      if (error instanceof Error && (error as any).status === 429) {
        throw error; // Propagate limits to workflow
      }
      console.warn(`Browser Run scraping failed for ${normalized}, falling back to Jina Reader:`, error);
      return await fetchSiteContentViaJina(normalized, timeoutMs);
    }
  } else {
    console.log(`Browser Run binding not found. Using Jina Reader for ${normalized}`);
    return await fetchSiteContentViaJina(normalized, timeoutMs);
  }
}

/**
 * Lightweight direct-fetch-only scraper for discovery enrichment.
 * No Browser Run or Jina fallbacks — just raw HTML extraction.
 * Returns null if fetch fails, returns SPA, or content is too thin.
 */
export async function fetchSiteContentLight(url: string, timeoutMs: number = 15000, signal?: AbortSignal): Promise<string | null> {
  const normalized = normalizeUrl(url);
  try {
    const html = await fetchDirectly(normalized, timeoutMs, signal);
    if (!html) return null;
    const cleaned = cleanHtml(html);
    if (cleaned.length < 600 || isLikelySPAOrEmpty(html, cleaned)) return null;
    return cleaned.substring(0, 5000);
  } catch {
    return null;
  }
}
