export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export class StructuredLogger {
  constructor(private context: string) {}

  private log(level: LogLevel, message: string, extra?: Record<string, unknown> | null, error?: unknown) {
    const payload: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      context: this.context,
      message,
    };

    if (extra) {
      payload.extra = extra;
    }

    if (error) {
      if (error instanceof Error) {
        payload.error = {
          name: error.name,
          message: error.message,
          stack: error.stack,
        };
      } else {
        payload.error = {
          message: String(error),
        };
      }
    }

    const output = JSON.stringify(payload);
    if (level === 'ERROR') {
      console.error(output);
    } else if (level === 'WARN') {
      console.warn(output);
    } else {
      console.log(output);
    }
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
}

export function getLogger(context: string): StructuredLogger {
  return new StructuredLogger(context);
}
