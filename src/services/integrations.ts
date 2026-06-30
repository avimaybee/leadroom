import { Db } from '../db';
import { eq, and } from 'drizzle-orm';
import { providerConfigs } from '../db/schema/core';
import { encrypt, decrypt } from '@/lib/crypto';

function getEncryptionSecret(): string {
  return process.env.DB_ENCRYPTION_KEY || 'fallback_key_dev';
}

export type TaskType = 'research' | 'scoring' | 'drafting';

const TASK_TYPE_TO_COLUMN: Record<TaskType, keyof typeof providerConfigs> = {
  research: 'isResearchActive',
  scoring: 'isScoringActive',
  drafting: 'isDraftingActive',
};

export class IntegrationsService {
  constructor(private db: Db) {}

  async getProviderConfig(provider: string) {
    const [config] = await this.db.select()
      .from(providerConfigs)
      .where(eq(providerConfigs.provider, provider))
      .limit(1);
    
    if (!config) return null;

    const secret = getEncryptionSecret();
    return {
      ...config,
      apiKey: await decrypt(config.apiKey, secret),
    };
  }

  async getAllProviderConfigs() {
    const configs = await this.db.select().from(providerConfigs);
    const secret = getEncryptionSecret();
    const decrypted = await Promise.all(
      configs.map(async (c) => ({
        ...c,
        apiKey: await decrypt(c.apiKey, secret),
      }))
    );
    return decrypted;
  }

  async getActiveProviderForTask(taskType: TaskType) {
    const column = TASK_TYPE_TO_COLUMN[taskType] as 'isResearchActive' | 'isScoringActive' | 'isDraftingActive';
    const [config] = await this.db.select()
      .from(providerConfigs)
      .where(eq(providerConfigs[column] as any, true))
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
      .where(eq(providerConfigs.provider, provider))
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
        .where(eq(providerConfigs.provider, provider));
    } else {
      await this.db.insert(providerConfigs).values({
        id,
        provider,
        apiKey: encryptedKey,
        modelName,
        isResearchActive: routing?.isResearchActive ?? false,
        isScoringActive: routing?.isScoringActive ?? false,
        isDraftingActive: routing?.isDraftingActive ?? false,
        createdAt: now,
        updatedAt: now,
      });
    }

    return this.getProviderConfig(provider);
  }

  async setActiveForTask(provider: string, taskType: TaskType) {
    const column = TASK_TYPE_TO_COLUMN[taskType] as 'isResearchActive' | 'isScoringActive' | 'isDraftingActive';

    // Deactivate this task type for all providers
    await this.db.update(providerConfigs)
      .set({ [column]: false } as any)
      .where(eq(providerConfigs[column] as any, true));

    // Activate for the selected provider
    await this.db.update(providerConfigs)
      .set({ [column]: true } as any)
      .where(eq(providerConfigs.provider, provider));
  }

  async deleteProviderConfig(provider: string) {
    await this.db.delete(providerConfigs)
      .where(eq(providerConfigs.provider, provider));
  }
}
