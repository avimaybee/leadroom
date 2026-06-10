import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export function getDb() {
  const env = (process as any).env;
  
  if (!env || !env.DB) {
    throw new Error('D1 database binding "DB" is not defined. Ensure you are running under Wrangler or instrumentation mock is active.');
  }

  return drizzle(env.DB, { schema }) as any;
}

export type Db = ReturnType<typeof getDb>;
