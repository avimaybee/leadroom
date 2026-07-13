import { getLogger, setGlobalRequestId, getGlobalRequestId } from '@/lib/logger';

const actionLoggers = new Map<string, ReturnType<typeof getLogger>>();

function getActionLogger(name: string) {
  if (!actionLoggers.has(name)) {
    actionLoggers.set(name, getLogger(`action:${name}`));
  }
  return actionLoggers.get(name)!;
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

    const sanitizedArgs = args.map((arg) => {
      if (arg instanceof FormData) return '[FormData]';
      if (arg instanceof File) return `[File: ${arg.name}]`;
      if (typeof arg === 'object' && arg !== null) {
        const safe: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(arg as Record<string, unknown>)) {
          if (k.toLowerCase().includes('password') || k.toLowerCase().includes('token') || k.toLowerCase().includes('key') || k.toLowerCase().includes('secret')) {
            safe[k] = '[REDACTED]';
          } else {
            safe[k] = v;
          }
        }
        return safe;
      }
      return arg;
    });

    log.debug('enter', { args: sanitizedArgs });

    try {
      const result = await fn(...args);
      const duration = Date.now() - start;
      log.info('success', { duration: `${duration}ms` });
      return result;
    } catch (err) {
      const duration = Date.now() - start;
      log.error('failed', err, { duration: `${duration}ms` });
      throw err;
    }
  };
}
