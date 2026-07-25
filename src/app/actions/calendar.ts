'use server';

import { getUserId } from '@/lib/auth';

export async function getCalendarAuthUrlAction(): Promise<{ url?: string; error?: string }> {
  return { error: 'Calendar is disabled' };
}

export async function syncCalendarAction(): Promise<{ synced: number; errors: number } | { error: string }> {
  return { error: 'Calendar is disabled' };
}

export async function disconnectCalendarAction(): Promise<{ success: boolean } | { error: string }> {
  return { error: 'Calendar is disabled' };
}

export async function getCalendarStatusAction(): Promise<{ connected: boolean; isConfigured: boolean; hasStoredCredentials: boolean }> {
  return { connected: false, isConfigured: false, hasStoredCredentials: false };
}

export async function saveGoogleCredentialsAction(_googleClientId: string, _googleClientSecret: string): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: 'Calendar is disabled' };
}

export async function getGoogleCredentialsAction(): Promise<null> {
  return null;
}
