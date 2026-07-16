import type { Db } from '@/db';
import { getDb } from '@/db';
import { rateLimits } from '@/db/schema/core';
import { eq, lt, sql } from 'drizzle-orm';

/**
 * In-memory rate limiter keyed by user ID.
 *
 * LOCAL-DEV ONLY: This uses an in-process Map and does not work across
 * Cloudflare Worker isolates (each isolate has its own memory).
 */
const RATE_LIMITER_STORE_MAX = 1000;

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

    // Hard cap: evict oldest entries when store exceeds max
    if (this.store.size >= RATE_LIMITER_STORE_MAX) {
      const entries = [...this.store.entries()];
      const half = Math.floor(entries.length / 2);
      for (let i = 0; i < half; i++) {
        this.store.delete(entries[i][0]);
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

/**
 * D1-based rate limiter that works across Worker isolates.
 * Uses the `rate_limits` table for distributed counting.
 */
export class D1RateLimiter {
  constructor(private db: Db) {}

  async check(
    key: string,
    limit: number = 5,
    windowMs: number = 60_000,
  ): Promise<{ allowed: boolean; remaining: number; reset: number }> {
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const windowStartDate = new Date(windowStart);
    const reset = windowStart + windowMs;

    try {
      await this.db
        .delete(rateLimits)
        .where(lt(rateLimits.windowStart, new Date(now - windowMs * 2)));

      await this.db
        .insert(rateLimits)
        .values({ key, count: 1, windowStart: windowStartDate })
        .onConflictDoUpdate({
          target: rateLimits.key,
          set: {
            count: sql`CASE WHEN ${rateLimits.windowStart} = ${windowStartDate} THEN ${rateLimits.count} + 1 ELSE 1 END`,
            windowStart: windowStartDate,
          },
        });

      const [row] = await this.db
        .select({ count: rateLimits.count })
        .from(rateLimits)
        .where(eq(rateLimits.key, key))
        .limit(1);

      const count = row?.count ?? 1;
      return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        reset,
      };
    } catch {
      return { allowed: true, remaining: 1, reset: Date.now() + windowMs };
    }
  }
}

let _d1LimiterInstance: D1RateLimiter | null = null;

function getD1Limiter(): D1RateLimiter {
  if (!_d1LimiterInstance) {
    _d1LimiterInstance = new D1RateLimiter(getDb());
  }
  return _d1LimiterInstance;
}

export async function checkRateLimit(
  key: string,
  limit?: number,
  windowMs?: number,
): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  return getD1Limiter().check(key, limit, windowMs);
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
