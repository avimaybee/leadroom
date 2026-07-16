export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

let _alsStore: Map<string, unknown> | null = null;

let _getStore: () => Map<string, unknown>;
let _runWithContext: <T>(fn: () => T) => T;

try {
  const ALS = (globalThis as any).AsyncLocalStorage;
  if (ALS && typeof ALS?.prototype?.getStore === 'function') {
    const als = new ALS();
    _getStore = () => als.getStore() ?? new Map();
    _runWithContext = <T>(fn: () => T): T => als.run(new Map(), fn) as T;
  } else {
    throw 0;
  }
} catch {
  _getStore = () => {
    if (!_alsStore) _alsStore = new Map();
    return _alsStore;
  };
  _runWithContext = <T>(fn: () => T): T => fn();
}

export function setGlobalRequestId(id: string) {
  _getStore().set('requestId', id);
}

export function getGlobalRequestId(): string | null {
  return (_getStore().get('requestId') as string) ?? null;
}

export function setUserId(id: string) {
  _getStore().set('userId', id);
}

export function getUserId(): string | null {
  return (_getStore().get('userId') as string) ?? null;
}

export function setCorrelationId(id: string) {
  _getStore().set('correlationId', id);
}

export function getCorrelationId(): string | null {
  return (_getStore().get('correlationId') as string) ?? null;
}

export function runWithRequestContext<T>(fn: () => T): T {
  return _runWithContext(fn);
}

const ENABLED_LEVELS: Record<string, LogLevel[]> = {
  development: ['DEBUG', 'INFO', 'WARN', 'ERROR'],
  production: ['INFO', 'WARN', 'ERROR'],
  test: ['WARN', 'ERROR'],
};

function getEnabledLevels(): LogLevel[] {
  const env = process.env.NODE_ENV || 'development';
  return ENABLED_LEVELS[env] || ENABLED_LEVELS.development;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

export class StructuredLogger {
  private startTime: number;

  constructor(private context: string) {
    this.startTime = Date.now();
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[getEnabledLevels()[0]];
  }

  private formatError(error: unknown): Record<string, unknown> {
    return error instanceof Error
      ? { message: error.message, stack: error.stack, name: error.name }
      : { message: String(error) };
  }

  private log(level: LogLevel, message: string, extra?: Record<string, unknown> | null, error?: unknown) {
    if (!this.shouldLog(level)) return;

    const elapsed = Date.now() - this.startTime;
    const payload: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      context: this.context,
      message,
      elapsed: `${elapsed}ms`,
    };

    const reqId = getGlobalRequestId();
    if (reqId) payload.requestId = reqId;

    const uid = getUserId();
    if (uid) payload.userId = uid;

    const cid = getCorrelationId();
    if (cid) payload.correlationId = cid;

    if (extra) {
      payload.extra = extra;
    }

    if (error) {
      payload.error = this.formatError(error);
    }

    const output = JSON.stringify(payload);
    if (level === 'ERROR') {
      console.error(output);
    } else if (level === 'WARN') {
      console.warn(output);
    } else if (level === 'DEBUG') {
      console.debug(output);
    } else {
      console.log(output);
    }
  }

  debug(message: string, extra?: Record<string, unknown> | null) {
    this.log('DEBUG', message, extra);
  }

  info(message: string, extra?: Record<string, unknown> | null) {
    this.log('INFO', message, extra);
  }

  warn(message: string, extra?: Record<string, unknown> | null) {
    this.log('WARN', message, extra);
  }

  error(message: string, error?: unknown, extra?: Record<string, unknown> | null) {
    this.log('ERROR', message, extra, error);
  }

  time<T>(label: string, fn: () => Promise<T>): Promise<T>;
  time<T>(label: string, fn: () => T): T;
  time<T>(label: string, fn: (() => T) | (() => Promise<T>)): T | Promise<T> {
    const start = Date.now();
    const result = fn();
    if (result instanceof Promise) {
      return result.then(
        (val) => {
          this.info(`${label} completed`, { duration: `${Date.now() - start}ms` });
          return val;
        },
        (err) => {
          this.error(`${label} failed`, err, { duration: `${Date.now() - start}ms` });
          throw err;
        },
      );
    }
    this.info(`${label} completed`, { duration: `${Date.now() - start}ms` });
    return result;
  }
}

export function getLogger(context: string): StructuredLogger {
  return new StructuredLogger(context);
}
