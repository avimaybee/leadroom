import { type Db } from '../db';
import { eq, and } from 'drizzle-orm';
import { providerConfigs } from '../db/schema/core';
import { encrypt, decrypt } from '@/lib/crypto';

// Defer encryption key validation to runtime (via getEncryptionSecret) to allow build-time static evaluation of routes.


function getEncryptionSecret(): string {
  let key = process.env.DB_ENCRYPTION_KEY;
  if (!key) {
    try {
      const { getCloudflareContext } = require('@opennextjs/cloudflare');
      key = getCloudflareContext().env?.DB_ENCRYPTION_KEY;
    } catch {}
  }
  if (!key) {
    throw new Error('DB_ENCRYPTION_KEY is required. Set it in your environment or .env file.');
  }
  return key;
}

export type TaskType = 'research' | 'scoring' | 'drafting';

const TASK_TYPE_TO_COLUMN: Record<TaskType, keyof typeof providerConfigs> = {
  research: 'isResearchActive',
  scoring: 'isScoringActive',
  drafting: 'isDraftingActive',
};

export class IntegrationsService {
  constructor(private db: Db) {}

  async getProviderConfig(provider: string, userId?: string | null) {
    if (!userId) return null;
    const [config] = await this.db.select()
      .from(providerConfigs)
      .where(and(eq(providerConfigs.provider, provider), eq(providerConfigs.userId, userId)))
      .limit(1);
    
    if (!config) return null;

    const secret = getEncryptionSecret();
    return {
      ...config,
      apiKey: await decrypt(config.apiKey, secret),
    };
  }

  async getAllProviderConfigs(userId?: string | null) {
    if (!userId) return [];
    const configs = await this.db.select()
      .from(providerConfigs)
      .where(eq(providerConfigs.userId, userId));
    const secret = getEncryptionSecret();
    const decrypted = await Promise.all(
      configs.map(async (c) => ({
        ...c,
        apiKey: await decrypt(c.apiKey, secret),
      }))
    );
    return decrypted;
  }

  async getActiveProviderForTask(taskType: TaskType, userId?: string | null) {
    if (!userId) return null;
    const column = TASK_TYPE_TO_COLUMN[taskType] as 'isResearchActive' | 'isScoringActive' | 'isDraftingActive';
    const [config] = await this.db.select()
      .from(providerConfigs)
      .where(and(eq(providerConfigs[column] as any, true), eq(providerConfigs.userId, userId)))
      .limit(1);

    if (!config) return null;

    const secret = getEncryptionSecret();
    return {
      ...config,
      apiKey: await decrypt(config.apiKey, secret),
    };
  }

  async saveProviderConfig(
    provider: string,
    apiKey: string,
    modelName: string,
    userId: string,
    routing?: {
      isResearchActive?: boolean;
      isScoringActive?: boolean;
      isDraftingActive?: boolean;
    }
  ) {
    const id = crypto.randomUUID();
    const now = new Date();
    const secret = getEncryptionSecret();
    const encryptedKey = await encrypt(apiKey, secret);

    const existing = await this.db.select()
      .from(providerConfigs)
      .where(and(eq(providerConfigs.provider, provider), eq(providerConfigs.userId, userId)))
      .limit(1);

    if (existing.length > 0) {
      await this.db.update(providerConfigs)
        .set({
          apiKey: encryptedKey,
          modelName,
          ...(routing?.isResearchActive !== undefined && { isResearchActive: routing.isResearchActive }),
          ...(routing?.isScoringActive !== undefined && { isScoringActive: routing.isScoringActive }),
          ...(routing?.isDraftingActive !== undefined && { isDraftingActive: routing.isDraftingActive }),
          updatedAt: now,
        })
        .where(and(eq(providerConfigs.provider, provider), eq(providerConfigs.userId, userId)));
    } else {
      await this.db.insert(providerConfigs).values({
        id,
        provider,
        apiKey: encryptedKey,
        modelName,
        userId,
        isResearchActive: routing?.isResearchActive ?? false,
        isScoringActive: routing?.isScoringActive ?? false,
        isDraftingActive: routing?.isDraftingActive ?? false,
        createdAt: now,
        updatedAt: now,
      });
    }

    return this.getProviderConfig(provider, userId);
  }

  async setActiveForTask(provider: string, taskType: TaskType, userId: string) {
    const column = TASK_TYPE_TO_COLUMN[taskType] as 'isResearchActive' | 'isScoringActive' | 'isDraftingActive';

    // Deactivate this task type for all providers of this user
    await this.db.update(providerConfigs)
      .set({ [column]: false } as any)
      .where(and(eq(providerConfigs[column] as any, true), eq(providerConfigs.userId, userId)));

    // Activate for the selected provider of this user
    await this.db.update(providerConfigs)
      .set({ [column]: true } as any)
      .where(and(eq(providerConfigs.provider, provider), eq(providerConfigs.userId, userId)));
  }

  async deleteProviderConfig(provider: string, userId: string) {
    await this.db.delete(providerConfigs)
      .where(and(eq(providerConfigs.provider, provider), eq(providerConfigs.userId, userId)));
  }
}
