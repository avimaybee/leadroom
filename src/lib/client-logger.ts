'use client';

export type ClientLogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

interface LogEntry {
  timestamp: string;
  level: ClientLogLevel;
  component: string;
  message: string;
  data?: unknown;
  error?: { name: string; message: string; stack?: string };
}

const MAX_BUFFER = 200;
const logBuffer: LogEntry[] = [];

function formatClientLog(level: ClientLogLevel, component: string, message: string, data?: unknown, error?: unknown) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    component,
    message,
  };

  if (data !== undefined) {
    entry.data = data;
  }

  if (error) {
    if (error instanceof Error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    } else {
      entry.error = { name: 'Unknown', message: String(error) };
    }
  }

  logBuffer.push(entry);
  if (logBuffer.length > MAX_BUFFER) {
    logBuffer.shift();
  }

  const prefix = `[${entry.timestamp}] [${level}] [${component}]`;
  if (level === 'ERROR') {
    console.error(prefix, message, data ?? '', error ?? '');
  } else if (level === 'WARN') {
    console.warn(prefix, message, data ?? '');
  } else if (level === 'DEBUG') {
    console.debug(prefix, message, data ?? '');
  } else {
    console.log(prefix, message, data ?? '');
  }

  return entry;
}

function setupGlobalHandlers() {
  if (typeof window === 'undefined') return;

  window.onunhandledrejection = (event: PromiseRejectionEvent) => {
    formatClientLog('ERROR', 'Window', 'Unhandled Promise Rejection', undefined, event.reason);
  };

  const origOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    formatClientLog('ERROR', 'Window', `Runtime Error: ${message}`, { source, lineno, colno }, error);
    if (origOnError) return origOnError(message, source, lineno, colno, error);
    return false;
  };
}

let handlersSetup = false;
function ensureHandlers() {
  if (!handlersSetup) {
    handlersSetup = true;
    setupGlobalHandlers();
  }
}

export const clientLog = {
  debug(component: string, message: string, data?: unknown) {
    ensureHandlers();
    return formatClientLog('DEBUG', component, message, data);
  },

  info(component: string, message: string, data?: unknown) {
    ensureHandlers();
    return formatClientLog('INFO', component, message, data);
  },

  warn(component: string, message: string, data?: unknown) {
    ensureHandlers();
    return formatClientLog('WARN', component, message, data);
  },

  error(component: string, message: string, error?: unknown, data?: unknown) {
    ensureHandlers();
    return formatClientLog('ERROR', component, message, data, error);
  },

  getBuffer(): LogEntry[] {
    return [...logBuffer];
  },

  clearBuffer() {
    logBuffer.length = 0;
  },
};
