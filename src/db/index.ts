import { drizzle } from 'drizzle-orm/d1';

export const db = (env: any) => drizzle(env.DB);
