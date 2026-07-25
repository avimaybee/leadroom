import { getLogger } from '../lib/logger';
import { type Db } from '../db';

const log = getLogger('CalendarService');

export class CalendarService {
  constructor(private db: Db, private encryptionKey?: string) {}

  async getClientId(_userId?: string): Promise<string | null> { return null; }
  async getClientSecret(_userId?: string): Promise<string | null> { return null; }
  getRedirectUri(): string { return ''; }
  async isConfigured(_userId?: string): Promise<boolean> { return false; }
  async getAuthUrl(_userId: string): Promise<string | null> { return null; }
  async exchangeCode(_code: string, _state: string): Promise<{ userId: string; error?: string }> { return { userId: '', error: 'Calendar is disabled' }; }
  async saveCredentials(_userId: string, _googleClientId: string, _googleClientSecret: string) {}
  async getStoredCredentials(_userId: string) { return null; }
  private async getValidToken(_userId: string): Promise<string | null> { return null; }
  private async refreshAccessToken(_refreshToken: string, _userId: string): Promise<string | null> { return null; }
  async syncTasksToCalendar(_userId: string): Promise<{ synced: number; errors: number }> { return { synced: 0, errors: 0 }; }
  async disconnect(_userId: string) {}
  async getStatus(_userId: string): Promise<{ connected: boolean; email?: string }> { return { connected: false } }
}
