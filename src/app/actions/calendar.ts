'use server';

import { getDb } from '@/db';
import { getUserId } from '@/lib/auth';
import { CalendarService } from '@/services/calendar';

export async function getCalendarAuthUrlAction(): Promise<{ url?: string; error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const db = getDb();
  const service = new CalendarService(db);
  const configured = await service.isConfigured(userId);
  if (!configured) {
    return { error: 'Google Calendar is not configured. Set your credentials below.' };
  }

  const url = await service.getAuthUrl(userId);
  if (!url) return { error: 'Failed to generate auth URL' };
  return { url };
}

export async function syncCalendarAction(): Promise<{ synced: number; errors: number } | { error: string }> {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const db = getDb();
  const service = new CalendarService(db);
  return service.syncTasksToCalendar(userId);
}

export async function disconnectCalendarAction(): Promise<{ success: boolean } | { error: string }> {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const db = getDb();
  const service = new CalendarService(db);
  await service.disconnect(userId);
  return { success: true };
}

export async function getCalendarStatusAction(): Promise<{ connected: boolean; isConfigured: boolean; hasStoredCredentials: boolean }> {
  const userId = await getUserId();
  if (!userId) return { connected: false, isConfigured: false, hasStoredCredentials: false };

  const db = getDb();
  const service = new CalendarService(db);
  const status = await service.getStatus(userId);
  const configured = await service.isConfigured(userId);
  const creds = await service.getStoredCredentials(userId);
  return { connected: status.connected, isConfigured: configured, hasStoredCredentials: !!(creds?.googleClientId && creds?.googleClientSecret) };
}

export async function saveGoogleCredentialsAction(googleClientId: string, googleClientSecret: string): Promise<{ success: boolean; error?: string }> {
  const userId = await getUserId();
  if (!userId) return { success: false, error: 'Unauthorized' };

  if (!googleClientId || !googleClientSecret) {
    return { success: false, error: 'Both Client ID and Client Secret are required' };
  }

  const db = getDb();
  const service = new CalendarService(db);
  await service.saveCredentials(userId, googleClientId.trim(), googleClientSecret.trim());
  return { success: true };
}

export async function getGoogleCredentialsAction(): Promise<{ googleClientId: string | null; googleClientSecret: string | null } | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const db = getDb();
  const service = new CalendarService(db);
  return service.getStoredCredentials(userId);
}
