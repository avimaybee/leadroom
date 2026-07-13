'use client';

import { toast } from 'sonner';
import { clientLog } from '@/lib/client-logger';

export function handleClientError(
  component: string,
  action: string,
  error: unknown,
  toastMessage?: string,
): void {
  const msg = error instanceof Error ? error.message : String(error);

  clientLog.error(component, `${action} failed`, error, { toastMessage });

  if (toastMessage) {
    toast.error(toastMessage, {
      description: msg.length > 120 ? msg.slice(0, 120) + '...' : msg,
      duration: 6000,
    });
  } else {
    toast.error(msg, { duration: 6000 });
  }
}

export function handleClientSuccess(
  component: string,
  action: string,
  toastMessage: string,
  data?: unknown,
): void {
  clientLog.info(component, `${action} succeeded`, data);
  toast.success(toastMessage, { duration: 3000 });
}
