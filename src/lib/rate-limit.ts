/**
 * In-memory rate limiter keyed by user ID.
 *
 * LOCAL-DEV ONLY: This uses an in-process Map and does not work across
 * Cloudflare Worker isolates (each isolate has its own memory). For
 * production on Cloudflare, replace with Cloudflare's built-in Rate
 * Limiting rules or a Durable Object-based counter.
 *
 * Stale keys are evicted periodically (~every 50 checks) to prevent
 * unbounded memory growth.
 */
export class RateLimiter {
  private store = new Map<string, number[]>();
  private windowMs: number;
  private maxRequests: number;
  private checkCount = 0;

  constructor(windowMs: number, maxRequests: number) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  check(key: string): boolean {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    // Periodic stale-key eviction (every 50th call)
    this.checkCount++;
    if (this.checkCount % 50 === 0) {
      for (const [k, timestamps] of this.store) {
        const valid = timestamps.filter(t => t > cutoff);
        if (valid.length === 0) {
          this.store.delete(k);
        } else {
          this.store.set(k, valid);
        }
      }
    }

    let timestamps = this.store.get(key);
    if (!timestamps) {
      timestamps = [];
      this.store.set(key, timestamps);
    }

    const valid = timestamps.filter(t => t > cutoff);
    this.store.set(key, valid);

    if (valid.length >= this.maxRequests) {
      return false;
    }

    valid.push(now);
    return true;
  }
}

function getEnvInt(key: string, defaultVal: number): number {
  const raw = (typeof process !== 'undefined' && process.env ? process.env[key] : undefined) ?? '';
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : defaultVal;
}

// Default: 5 requests per minute. Override via env: RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS
const rateLimitWindow = getEnvInt('RATE_LIMIT_WINDOW_MS', 60_000);
const rateLimitMax = getEnvInt('RATE_LIMIT_MAX', 5);

export const discoverySearchLimiter = new RateLimiter(rateLimitWindow, rateLimitMax);
