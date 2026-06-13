import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema';

export function getDb(): DrizzleD1Database<typeof schema> {
  let DB: any = undefined;

  // 1. Try to get D1 from Cloudflare Context (for OpenNext Worker environment)
  try {
    const { getCloudflareContext } = require('@opennextjs/cloudflare');
    const cf = getCloudflareContext();
    if (cf && cf.env && cf.env.DB) {
      DB = cf.env.DB;
    }
  } catch (e) {
    // getCloudflareContext might not be available or throw in Node/tests environment
  }

  // 2. Fall back to process.env.DB (for standard next dev or node tests)
  if (!DB && typeof process !== 'undefined' && process.env) {
    DB = (process.env as any).DB;
  }

  // 3. Fall back to local mock database (for local dev without wrangler)
  if (!DB) {
    const req = typeof require !== 'undefined' ? require : undefined;
    if (req) {
      try {
        const { setupLocalDatabaseMock } = req('./local-mock');
        setupLocalDatabaseMock();
        if (typeof process !== 'undefined' && process.env) {
          DB = (process.env as any).DB;
        }
      } catch (e) {
        console.error('Failed to load local database mock:', e);
      }
    }
  }

  // 4. Fallback if still missing (throwing proxy to avoid crashing during build static analysis)
  if (!DB) {
    console.warn('WARNING: D1 database binding "DB" is missing. Using a throwing Proxy to prevent build crash.');
    const proxyHandler = {
      get: function(_target: any, prop: string) {
        if (prop === 'then') return undefined; 
        return function() {
          throw new Error('D1 database binding "DB" is not configured. Please add the D1 binding in Cloudflare.');
        };
      }
    };
    return new Proxy({} as any, proxyHandler);
  }

  return drizzle(DB, { schema });
}

export type Db = DrizzleD1Database<typeof schema>;

