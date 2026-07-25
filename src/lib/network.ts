import { getLogger } from './logger';

const log = getLogger('Network');

/**
 * Check whether the given hostname is a private/internal IP or loopback address.
 */
export function isPrivateHostname(hostname: string): boolean {
  // Normalize
  const h = hostname.replace(/^\[|\]$/g, '').toLowerCase().trim();

  if (h === 'localhost' || h === 'localhost.localdomain' || h === '0.0.0.0' || h === '[::1]' || h === '::1') {
    return true;
  }

  // IPv4 dotted-decimal check
  const ipv4Match = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const parts = ipv4Match.slice(1).map(Number);
    if (parts.some(p => p < 0 || p > 255)) return false;
    const [a, b, c, d] = parts;
    
    // 127.x.x.x (Loopback)
    if (a === 127) return true;
    // 10.x.x.x (Private)
    if (a === 10) return true;
    // 172.16.x.x - 172.31.x.x (Private)
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.x.x (Private)
    if (a === 192 && b === 168) return true;
    // 169.254.x.x (Link-local)
    if (a === 169 && b === 254) return true;
    // 0.x.x.x (Broadcast/local)
    if (a === 0) return true;
    // 100.64.x.x - 100.127.x.x (Carrier-grade NAT 100.64.0.0/10)
    if (a === 100 && b >= 64 && b <= 127) return true;
  }

  // Decimal representation check (e.g. 2130706433 = 127.0.0.1)
  if (/^\d+$/.test(h) && h.length >= 9) {
    const val = parseInt(h, 10);
    const dotted = integerToDotted(val);
    if (dotted && isPrivateHostname(dotted)) return true;
  }

  // Hexadecimal check (e.g. 0x7f000001 = 127.0.0.1)
  if (/^0x[0-9a-f]{1,8}$/i.test(h)) {
    const val = parseInt(h, 16);
    const dotted = integerToDotted(val);
    if (dotted && isPrivateHostname(dotted)) return true;
  }

  // Hex-per-octet dotted (e.g. 0x7f.0x00.0x00.0x01)
  const hexDottedMatch = h.match(/^0x([0-9a-f]{1,2})\.0x([0-9a-f]{1,2})\.0x([0-9a-f]{1,2})\.0x([0-9a-f]{1,2})$/i);
  if (hexDottedMatch) {
    const parts = hexDottedMatch.slice(1).map(x => parseInt(x, 16));
    const dotted = parts.join('.');
    if (isPrivateHostname(dotted)) return true;
  }

  // RFC 3849 documentation prefix (2001:db8::/32)
  if (h.startsWith('2001:db8:')) return true;

  // IPv6 Unique Local Address (fc00::/7 -> starts with fc or fd)
  if (h.startsWith('fc') || h.startsWith('fd')) {
    const ipv6Regex = /^[0-9a-f:]+$/;
    if (ipv6Regex.test(h.replace(/:/g, ''))) return true;
  }

  // IPv6 Link-Local Address (fe80::/10 -> starts with fe8, fe9, fea, feb)
  if (/^fe[89ab]/i.test(h)) {
    const ipv6Regex = /^[0-9a-f:]+$/;
    if (ipv6Regex.test(h.replace(/:/g, ''))) return true;
  }

  return false;
}

function integerToDotted(n: number): string | null {
  if (n < 0 || n > 0xffffffff) return null;
  return `${(n >>> 24) & 0xff}.${(n >>> 16) & 0xff}.${(n >>> 8) & 0xff}.${n & 0xff}`;
}

export function isPrivateHost(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return isPrivateHostname(url.hostname);
  } catch {
    log.error('Failed to parse URL, blocking as private', { url: urlString });
    return true;
  }
}

export function isValidPublicUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }
    return !isPrivateHostname(url.hostname);
  } catch {
    return false;
  }
}
