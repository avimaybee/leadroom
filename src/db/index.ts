import { getLogger } from '../lib/logger';
import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema';

const log = getLogger('DB');

let _cfResolved = false;
let _cfEnv: any = null;
let _localMockResolved = false;

function getCloudflareEnvOnce(): any {
  if (!_cfResolved) {
    _cfResolved = true;
    try {
      const { getCloudflareContext } = require('@opennextjs/cloudflare');
      _cfEnv = getCloudflareContext().env;
    } catch (e) {
      _cfEnv = null;
    }
  }
  return _cfEnv;
}

const _drizzleInstances = new WeakMap<object, DrizzleD1Database<typeof schema>>();

export function getDb(env?: any): DrizzleD1Database<typeof schema> {
  let DB: any = undefined;

  // 1. Use injected env if provided (production path)
  if (env?.DB) {
    DB = env.DB;
  }

  // 2. Try to get D1 from Cloudflare Context (legacy fallback) — resolved once
  if (!DB) {
    const cfEnv = getCloudflareEnvOnce();
    if (cfEnv && cfEnv.DB) {
      DB = cfEnv.DB;
    }
  }

  // 3. Fall back to process.env.DB (for standard next dev or node tests)
  if (!DB && typeof process !== 'undefined' && process.env) {
    DB = process.env.DB;
  }

  // 3. Fall back to local mock database (for local dev without wrangler) — resolved once
  if (!DB && !_localMockResolved && typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
    _localMockResolved = true;
    const req = typeof require !== 'undefined' ? require : undefined;
    if (req) {
      try {
        const { setupLocalDatabaseMock } = req('./local-mock');
        setupLocalDatabaseMock();
        if (typeof process !== 'undefined' && process.env) {
          DB = process.env.DB;
        }
      } catch (e) {
        log.error('Failed to load local database mock', e);
      }
    }
  }

  // 4. Fallback if still missing (throwing proxy to avoid crashing during build static analysis)
  if (!DB) {
    log.warn('D1 database binding "DB" is missing. Using a throwing Proxy to prevent build crash.');
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

  // Singleton: reuse drizzle instance per D1 binding object
  let instance = _drizzleInstances.get(DB);
  if (!instance) {
    instance = drizzle(DB, { schema });
    _drizzleInstances.set(DB, instance);
  }
  return instance;
}

export type Db = DrizzleD1Database<typeof schema>;



