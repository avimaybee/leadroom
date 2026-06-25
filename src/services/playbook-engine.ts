import { type Db } from '../db';
import { playbooks } from '../db/schema/playbooks';
import { eq } from 'drizzle-orm';

export class PlaybookEngine {
  constructor(private db: Db) {}

  async getPlaybooksForStage(stage: string) {
    return this.db.select().from(playbooks).where(eq(playbooks.triggerStage, stage));
  }
}
