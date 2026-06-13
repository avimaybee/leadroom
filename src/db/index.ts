import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema';

export function getDb(): DrizzleD1Database<typeof schema> {
  const env = (typeof process !== 'undefined' ? process.env : undefined) as any;
  
  if (!env || !env.DB) {
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

  return drizzle(env.DB, { schema });
}

export type Db = DrizzleD1Database<typeof schema>;
