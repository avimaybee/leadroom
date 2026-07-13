'use client';

import { useEffect, useRef } from 'react';
import { clientLog } from '@/lib/client-logger';

/**
 * Invisible component mounted in the root layout.
 * Captures window-level errors, navigation events, and unhandled rejections.
 */
export function AppLogger() {
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    clientLog.info('AppLogger', 'App mounted', { timestamp: new Date().toISOString() });

    const handleError = (event: ErrorEvent) => {
      clientLog.error('AppLogger', `Window error: ${event.message}`, event.error, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      clientLog.error('AppLogger', 'Unhandled promise rejection', event.reason);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      const lifetime = Date.now() - mountedAt.current;
      clientLog.info('AppLogger', 'App unmounted', { lifetime: `${lifetime}ms` });
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return null;
}
