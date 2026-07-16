import { type Db } from '../db';
import { activities, activityMetadata } from '../db/schema/core';
import { z } from 'zod';

const metadataSchema = z.object({
  error: z.object({
    message: z.string(),
    stack: z.string().optional(),
    payload: z.any().optional(),
  }).optional(),
  batch: z.object({
    entities: z.array(z.object({
      id: z.string(),
      status: z.string(),
      error: z.string().optional(),
    })),
  }).optional(),
}).passthrough();

export type ActivityMetadata = z.infer<typeof metadataSchema>;

interface LogEntry {
  leadId: string;
  type: string;
  summary: string;
  requestId?: string;
  userId?: string;
  correlationId?: string;
  metadata?: ActivityMetadata;
}

const _logBuffer: LogEntry[] = [];
const _logBufferDb = new WeakMap<Db, true>();
const BUFFER_FLUSH_THRESHOLD = 20;
const BUFFER_FLUSH_INTERVAL_MS = 5000;
let _flushTimer: ReturnType<typeof setTimeout> | null = null;
let _waitUntil: ((p: Promise<unknown>) => void) | null = null;

function scheduleFlush(db: Db): void {
  if (_flushTimer) return;
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    const promise = flushLogBuffer(db);
    promise.catch(() => {});
    _waitUntil?.(promise);
  }, BUFFER_FLUSH_INTERVAL_MS);
}

export function setLogWaitUntil(fn: (p: Promise<unknown>) => void): void {
  _waitUntil = fn;
}

async function flushLogBuffer(db: Db): Promise<void> {
  if (_logBuffer.length === 0) return;
  const batch = _logBuffer.splice(0);
  const now = new Date();
  const queries: any[] = [];
  for (const entry of batch) {
    const activityId = crypto.randomUUID();
    queries.push(
      db.insert(activities).values({
        id: activityId,
        leadId: entry.leadId,
        type: entry.type,
        summary: entry.summary,
        timestamp: now,
      })
    );
    if (entry.metadata) {
      const validated = metadataSchema.parse(entry.metadata);
      queries.push(
        db.insert(activityMetadata).values({
          id: crypto.randomUUID(),
          activityId,
          metadata: JSON.stringify(validated),
        })
      );
    }
  }
  if (queries.length > 0) {
    await db.batch(queries as any);
  }
}

export class LoggingService {
  constructor(private db: Db) {}

  async log(params: {
    leadId: string;
    type: string;
    summary: string;
    metadata?: ActivityMetadata;
  }) {
    _logBuffer.push(params);
    if (_logBuffer.length > 200) {
      const overflow = _logBuffer.length - 200;
      _logBuffer.splice(0, overflow);
    }
    scheduleFlush(this.db);
    if (_logBuffer.length >= BUFFER_FLUSH_THRESHOLD) {
      await flushLogBuffer(this.db);
    }
  }

  async flush(): Promise<void> {
    await flushLogBuffer(this.db);
  }
}
