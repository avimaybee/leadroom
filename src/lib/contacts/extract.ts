export interface ContactExtract {
  emails: string[];
  phones: string[];
  socialLinks: Record<string, string>;
  contactPageUrls: string[];
}

/**
 * Extract email addresses from raw HTML text.
 * Finds mailto: links and inline email patterns.
 */
export function extractEmails(text: string): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  // mailto: links
  const mailtoRegex = /href=["']mailto:([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = mailtoRegex.exec(text)) !== null) {
    const email = match[1].trim().toLowerCase();
    if (email && !seen.has(email)) {
      seen.add(email);
      results.push(email);
    }
  }

  // Inline email patterns
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  while ((match = emailRegex.exec(text)) !== null) {
    const email = match[0].toLowerCase();
    if (!seen.has(email)) {
      seen.add(email);
      results.push(email);
    }
  }

  return results;
}

/**
 * Extract phone numbers from raw HTML text.
 * Matches common international and US phone formats.
 */
export function extractPhones(text: string): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  const phoneRegex = /(?:(?:\+|00)\d{1,3}[-.\s]?)?(?:\(?\d{1,4}\)?[-.\s]?)?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g;
  let match: RegExpExecArray | null;
  while ((match = phoneRegex.exec(text)) !== null) {
    const phone = match[0].trim();
    if (phone.length >= 7 && phone.length <= 20 && /\d{4,}/.test(phone)) {
      if (!seen.has(phone)) {
        seen.add(phone);
        results.push(phone);
      }
    }
  }

  return results;
}

/**
 * Extract social media profile links from raw HTML.
 * Checks href attributes for known social domains.
 */
export function extractSocialLinks(html: string): Record<string, string> {
  const socialDomains: Record<string, RegExp> = {
    facebook: /facebook\.com\/([^"'\s?>\/]+)/i,
    instagram: /instagram\.com\/([^"'\s?>\/]+)/i,
    linkedin: /linkedin\.com\/(company|in)\/[^"'\s?>\/]+/i,
    twitter: /(?:twitter\.com|x\.com)\/([^"'\s?>\/]+)/i,
    youtube: /youtube\.com\/(@?[^"'\s?>\/]+)/i,
    tiktok: /tiktok\.com\/@?([^"'\s?>\/]+)/i,
  };

  const results: Record<string, string> = {};
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let hrefMatch: RegExpExecArray | null;

  while ((hrefMatch = hrefRegex.exec(html)) !== null) {
    const url = hrefMatch[1].toLowerCase();
    for (const [platform, pattern] of Object.entries(socialDomains)) {
      if (pattern.test(url) && !results[platform]) {
        results[platform] = hrefMatch[1];
      }
    }
  }

  return results;
}

/**
 * Extract URLs for contact, about, and team pages.
 */
export function extractContactPages(html: string): string[] {
  const results = new Set<string>();
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = hrefRegex.exec(html)) !== null) {
    const url = match[1].toLowerCase();
    if (/^\/(contact|about|team|get-in-touch|support)(?:\/|$|[?#])/.test(url) || /^https?:\/\/[^\/]+\/(contact|about|team)(?:\/|$|[?#])/i.test(url)) {
      results.add(match[1]);
    }
  }

  return Array.from(results);
}

/**
 * Run all extraction functions on raw HTML.
 * This is the main entry point — call this once with the raw HTML string.
 */
export function extractAll(html: string): ContactExtract {
  return {
    emails: extractEmails(html),
    phones: extractPhones(html),
    socialLinks: extractSocialLinks(html),
    contactPageUrls: extractContactPages(html),
  };
}
