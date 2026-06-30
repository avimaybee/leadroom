import { Db } from '../db';
import { googleCalendarTokens, tasks, reminders } from '../db/schema/core';
import { eq, and, or, isNull, ne } from 'drizzle-orm';
import { prospects as leads } from '../db/schema/core';
import { encrypt, decrypt } from '@/lib/crypto';

function getEncryptionSecret(): string {
  return process.env.DB_ENCRYPTION_KEY || 'fallback_key_dev';
}

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export class CalendarService {
  constructor(private db: Db) {}

  async getClientId(userId?: string): Promise<string | null> {
    if (userId) {
      const creds = await this.getStoredCredentials(userId);
      if (creds?.googleClientId) return creds.googleClientId;
    }
    return process.env.GOOGLE_CLIENT_ID || null;
  }

  async getClientSecret(userId?: string): Promise<string | null> {
    if (userId) {
      const creds = await this.getStoredCredentials(userId);
      if (creds?.googleClientSecret) return creds.googleClientSecret;
    }
    return process.env.GOOGLE_CLIENT_SECRET || null;
  }

  getRedirectUri(): string {
    return `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/calendar/callback`;
  }

  async isConfigured(userId?: string): Promise<boolean> {
    const clientId = await this.getClientId(userId);
    const clientSecret = await this.getClientSecret(userId);
    return !!(clientId && clientSecret);
  }

  async getAuthUrl(userId: string): Promise<string | null> {
    const clientId = await this.getClientId(userId);
    if (!clientId) return null;
    const redirectUri = this.getRedirectUri();
    const scope = 'https://www.googleapis.com/auth/calendar.events';
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
    return `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;
  }

  async exchangeCode(code: string, state: string): Promise<{ userId: string; error?: string }> {
    let userId: string;
    try {
      const parsed = JSON.parse(Buffer.from(state, 'base64').toString());
      userId = parsed.userId;
    } catch {
      return { userId: '', error: 'Invalid state parameter' };
    }

    const clientId = await this.getClientId(userId);
    const clientSecret = await this.getClientSecret(userId);
    if (!clientId || !clientSecret) return { userId, error: 'Google Calendar not configured' };

    const resp = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: this.getRedirectUri(),
        grant_type: 'authorization_code',
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      return { userId, error: `Token exchange failed: ${body}` };
    }

    const data = await resp.json() as any;
    const expiryDate = new Date(Date.now() + (data.expires_in || 3600) * 1000);
    const secret = getEncryptionSecret();
    const encryptedAccessToken = await encrypt(data.access_token, secret);
    const encryptedRefreshToken = data.refresh_token ? await encrypt(data.refresh_token, secret) : null;

    const existing = await this.db.select({ id: googleCalendarTokens.id }).from(googleCalendarTokens).where(eq(googleCalendarTokens.userId, userId)).limit(1);
    if (existing.length > 0) {
      await this.db.update(googleCalendarTokens).set({
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken ?? undefined,
        scope: data.scope,
        expiryDate,
        updatedAt: new Date(),
      }).where(eq(googleCalendarTokens.userId, userId));
    } else {
      await this.db.insert(googleCalendarTokens).values({
        id: crypto.randomUUID(),
        userId,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        scope: data.scope,
        expiryDate,
      });
    }

    return { userId };
  }

  async saveCredentials(userId: string, googleClientId: string, googleClientSecret: string) {
    const secret = getEncryptionSecret();
    const encryptedClientSecret = await encrypt(googleClientSecret, secret);
    const existing = await this.db.select({ id: googleCalendarTokens.id }).from(googleCalendarTokens).where(eq(googleCalendarTokens.userId, userId)).limit(1);
    if (existing.length > 0) {
      await this.db.update(googleCalendarTokens).set({
        googleClientId,
        googleClientSecret: encryptedClientSecret,
        updatedAt: new Date(),
      }).where(eq(googleCalendarTokens.userId, userId));
    } else {
      await this.db.insert(googleCalendarTokens).values({
        id: crypto.randomUUID(),
        userId,
        accessToken: '',
        googleClientId,
        googleClientSecret: encryptedClientSecret,
      });
    }
  }

  async getStoredCredentials(userId: string) {
    const [row] = await this.db.select({
      googleClientId: googleCalendarTokens.googleClientId,
      googleClientSecret: googleCalendarTokens.googleClientSecret,
    }).from(googleCalendarTokens).where(eq(googleCalendarTokens.userId, userId)).limit(1);
    if (!row) return null;
    const secret = getEncryptionSecret();
    return {
      ...row,
      googleClientSecret: row.googleClientSecret ? await decrypt(row.googleClientSecret, secret) : null,
    };
  }

  private async getValidToken(userId: string): Promise<string | null> {
    const [row] = await this.db.select().from(googleCalendarTokens).where(eq(googleCalendarTokens.userId, userId)).limit(1);
    if (!row) return null;

    const secret = getEncryptionSecret();
    const accessToken = row.accessToken ? await decrypt(row.accessToken, secret) : null;
    const refreshToken = row.refreshToken ? await decrypt(row.refreshToken, secret) : null;

    if (!accessToken) return null;

    if (row.expiryDate && new Date(row.expiryDate) <= new Date()) {
      if (!refreshToken) return null;
      const refreshed = await this.refreshAccessToken(refreshToken, userId);
      return refreshed;
    }

    return accessToken;
  }

  private async refreshAccessToken(refreshToken: string, userId: string): Promise<string | null> {
    const clientId = await this.getClientId(userId);
    const clientSecret = await this.getClientSecret(userId);
    if (!clientId || !clientSecret) return null;

    const resp = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
      }),
    });

    if (!resp.ok) return null;
    const data = await resp.json() as any;
    const expiryDate = new Date(Date.now() + (data.expires_in || 3600) * 1000);
    const secret = getEncryptionSecret();
    const encryptedAccessToken = await encrypt(data.access_token, secret);

    await this.db.update(googleCalendarTokens).set({
      accessToken: encryptedAccessToken,
      expiryDate,
      updatedAt: new Date(),
    }).where(eq(googleCalendarTokens.userId, userId));

    return data.access_token;
  }

  async syncTasksToCalendar(userId: string): Promise<{ synced: number; errors: number }> {
    const token = await this.getValidToken(userId);
    if (!token) return { synced: 0, errors: 0 };

    const openTasks = await this.db
      .select({
        id: tasks.id,
        title: tasks.title,
        dueDate: tasks.dueDate,
        leadId: tasks.leadId,
        leadName: leads.name,
      })
      .from(tasks)
      .leftJoin(leads, eq(tasks.leadId, leads.id))
      .where(and(
        eq(tasks.assigneeId, userId),
        eq(tasks.status, 'Open'),
        or(isNull(tasks.googleCalendarSyncStatus), ne(tasks.googleCalendarSyncStatus, 'Synced'))
      ));

    let synced = 0;
    let errors = 0;

    for (const task of openTasks) {
      if (!task.dueDate) continue;

      const startDate = new Date(task.dueDate);
      const endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + 1);

      const eventBody = {
        summary: `[Leadroom] ${task.title}`,
        description: `Lead: ${task.leadName || task.leadId}\nView: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/leads/${task.leadId}`,
        start: { dateTime: startDate.toISOString(), timeZone: 'UTC' },
        end: { dateTime: endDate.toISOString(), timeZone: 'UTC' },
      };

      try {
        const resp = await fetch(GOOGLE_CALENDAR_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventBody),
        });

        if (!resp.ok) {
          const errBody = await resp.text();
          console.error(`Failed to sync task ${task.id}: ${errBody}`);
          await this.db.update(tasks).set({
            googleCalendarSyncStatus: 'Error',
            googleCalendarSyncError: errBody.substring(0, 255),
            updatedAt: new Date(),
          }).where(eq(tasks.id, task.id));
          errors++;
        } else {
          const data = await resp.json() as any;
          await this.db.update(tasks).set({
            googleCalendarEventId: data.id,
            googleCalendarSyncStatus: 'Synced',
            googleCalendarSyncError: null,
            updatedAt: new Date(),
          }).where(eq(tasks.id, task.id));
          synced++;
        }
      } catch (err: any) {
        console.error(`Network error syncing task ${task.id}:`, err);
        await this.db.update(tasks).set({
          googleCalendarSyncStatus: 'Error',
          googleCalendarSyncError: err?.message || 'Network error',
          updatedAt: new Date(),
        }).where(eq(tasks.id, task.id));
        errors++;
      }
    }

    return { synced, errors };
  }

  async disconnect(userId: string) {
    await this.db.delete(googleCalendarTokens).where(eq(googleCalendarTokens.userId, userId));
  }

  async getStatus(userId: string): Promise<{ connected: boolean; email?: string }> {
    const [row] = await this.db.select().from(googleCalendarTokens).where(eq(googleCalendarTokens.userId, userId)).limit(1);
    if (!row) return { connected: false };
    return { connected: true };
  }
}
