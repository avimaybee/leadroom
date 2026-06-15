export interface HeuristicInput {
  website: string | null;
  phone: string | null;
}

export interface HeuristicResult {
  triagePriority: 'HIGH' | 'MEDIUM' | 'UNASSESSED';
  triageReason: string | null;
}

const FREE_SUBDOMAIN_PATTERNS = [
  '.wixsite.com',
  '.squarespace.com',
  '.weebly.com',
  '.wordpress.com',
  '.blogspot.com',
  '.yolasite.com',
  '.webflow.io',
  '.godaddysites.com',
  '.myshopify.com',
  '.business.site',
  '.strikingly.com',
  '.jimdo.com',
  '.simplebooklet.com',
  '.carrd.co',
  '.wix.com',
  '.squarespace',
];

export function heuristicTriage(input: HeuristicInput): HeuristicResult {
  const url = (input.website || '').toLowerCase().trim();

  // No website — biggest opportunity
  if (!input.website) {
    return {
      triagePriority: 'HIGH',
      triageReason: 'No website detected — likely needs digital presence.',
    };
  }

  // Free/DIY subdomain — strong signal of unprofessional presence
  if (FREE_SUBDOMAIN_PATTERNS.some((d) => url.includes(d))) {
    return {
      triagePriority: 'HIGH',
      triageReason: `Uses free website builder${url.includes('wix') ? ' (Wix)' : url.includes('squarespace') ? ' (Squarespace)' : ''} — likely outdated DIY site.`,
    };
  }

  // Has website but no phone — hard to reach
  if (!input.phone) {
    return {
      triagePriority: 'MEDIUM',
      triageReason: 'Has website but no direct phone contact available.',
    };
  }

  // Has both website and phone — needs deeper AI assessment
  return {
    triagePriority: 'UNASSESSED',
    triageReason: null,
  };
}
