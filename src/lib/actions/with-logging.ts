import { getLogger, setGlobalRequestId, getGlobalRequestId } from '@/lib/logger';

const actionLoggers = new Map<string, ReturnType<typeof getLogger>>();
const MAX_ACTION_LOGGERS = 50;

function getActionLogger(name: string) {
  let logger = actionLoggers.get(name);
  if (!logger) {
    if (actionLoggers.size >= MAX_ACTION_LOGGERS) {
      const firstKey = actionLoggers.keys().next().value;
      if (firstKey) actionLoggers.delete(firstKey);
    }
    logger = getLogger(`action:${name}`);
    actionLoggers.set(name, logger);
  }
  return logger;
}

function sanitizeValue(value: unknown): unknown {
  if (value instanceof FormData) return '[FormData]';
  if (value instanceof File) return `[File: ${value.name}]`;
  if (typeof value === 'object' && value !== null) {
    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }
    const safe: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k.toLowerCase().includes('password') || k.toLowerCase().includes('token') || k.toLowerCase().includes('key') || k.toLowerCase().includes('secret') || k.toLowerCase().includes('authorization') || k.toLowerCase().includes('apikey') || k.toLowerCase().includes('api_key')) {
        safe[k] = '[REDACTED]';
      } else {
        safe[k] = sanitizeValue(v);
      }
    }
    return safe;
  }
  return value;
}

type ActionFn<TArgs extends unknown[], TReturn> = (...args: TArgs) => Promise<TReturn>;

export function withLogging<TArgs extends unknown[], TReturn>(
  name: string,
  fn: ActionFn<TArgs, TReturn>,
): ActionFn<TArgs, TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    const log = getActionLogger(name);
    const start = Date.now();

    if (!getGlobalRequestId()) {
      setGlobalRequestId(crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    }

    const sanitizedArgs = args.map(sanitizeValue);

    log.debug('enter', { args: sanitizedArgs });

    try {
      const result = await fn(...args);
      const duration = Date.now() - start;
      log.info('success', { duration: `${duration}ms`, result: sanitizeValue(result) });
      return result;
    } catch (err) {
      const duration = Date.now() - start;
      const sanitizedErr = err instanceof Error
        ? { name: err.name, message: err.message, stack: err.stack }
        : sanitizeValue(err);
      log.error('failed', err, { duration: `${duration}ms`, error: sanitizedErr });
      throw err;
    }
  };
}
