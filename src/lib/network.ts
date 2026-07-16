export function isPrivateHost(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname;

    // IPv6 localhost
    if (hostname === '::1' || hostname === '0:0:0:0:0:0:0:1') return true;

    // IPv4 check
    const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      const parts = ipv4Match.slice(1).map(Number);
      if (parts.some(p => p < 0 || p > 255)) return false; // invalid IP, not private
      const [a, b] = parts;
      // 10.0.0.0/8
      if (a === 10) return true;
      // 127.0.0.0/8
      if (a === 127) return true;
      // 172.16.0.0/12
      if (a === 172 && b >= 16 && b <= 31) return true;
      // 192.168.0.0/16
      if (a === 192 && b === 168) return true;
    }

    // Reserved hostnames
    const lower = hostname.toLowerCase();
    if (lower === 'localhost' || lower.endsWith('.localhost')) return true;
    if (lower === '[::1]') return true;

    return false;
  } catch {
    return false;
  }
}
