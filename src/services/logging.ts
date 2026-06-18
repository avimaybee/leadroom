import { Db } from '../db';
import { activities, activityMetadata } from '../db/schema/core';
import { z } from 'zod';

const metadataSchema = z.object({
  error: z.object({
    message: z.string(),
    stack: z.string().optional(),
    payload: z.any().optional(),
  }).optional(),
  batch: z.object({
    entities: z.array(z.object({
      id: z.string(),
      status: z.string(),
      error: z.string().optional(),
    })),
  }).optional(),
  // Add other standard fields as needed
}).passthrough();

export type ActivityMetadata = z.infer<typeof metadataSchema>;

export class LoggingService {
  constructor(private db: Db) {}

  async log(params: {
    leadId: string;
    type: string;
    summary: string;
    metadata?: ActivityMetadata;
  }) {
    const activityId = crypto.randomUUID();
    const now = new Date();

    await this.db.insert(activities).values({
      id: activityId,
      leadId: params.leadId,
      type: params.type,
      summary: params.summary,
      timestamp: now,
    });

    if (params.metadata) {
      // Validate metadata schema
      const validatedMetadata = metadataSchema.parse(params.metadata);
      
      // Filter out sensitive data (if any standard filtering is needed, maybe later)
      // Assuming payload filtering or anything else needed?
      
      await this.db.insert(activityMetadata).values({
        id: crypto.randomUUID(),
        activityId,
        metadata: JSON.stringify(validatedMetadata),
      });
    }

    return activityId;
  }
}
