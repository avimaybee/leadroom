export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

let globalRequestId: string | null = null;

export function setGlobalRequestId(id: string) {
  globalRequestId = id;
}

export function getGlobalRequestId(): string | null {
  return globalRequestId;
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
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...((error as any).cause ? { cause: String((error as any).cause) } : {}),
      };
    }
    if (typeof error === 'object' && error !== null) {
      return { message: JSON.stringify(error) };
    }
    return { message: String(error) };
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

    if (globalRequestId) {
      payload.requestId = globalRequestId;
    }

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
