

export type EventPayload = {
  'research.completed': { leadId: string, jobId: string, userId: string | null };
  'audit.completed': { leadId: string, jobId: string, userId: string | null };
};

export type EventType = keyof EventPayload;
export type EventHandler<K extends EventType> = (payload: EventPayload[K], db: any) => Promise<void>;

class EventBus {
  private handlers: Map<EventType, EventHandler<any>[]> = new Map();

  subscribe<K extends EventType>(event: K, handler: EventHandler<K>) {
    const existing = this.handlers.get(event) || [];
    this.handlers.set(event, [...existing, handler]);
  }

  async emit<K extends EventType>(event: K, payload: EventPayload[K], db: any) {
    const handlers = this.handlers.get(event) || [];
    // Run handlers concurrently
    await Promise.allSettled(handlers.map(h => h(payload, db).catch(err => console.error(`Error in event handler for ${event}:`, err))));
  }
}

export const eventBus = new EventBus();

// Initialize subscribers
import { setupTaskAutomationSubscribers } from './task-automation';

let initialized = false;
export function initEventSubscribers() {
  if (initialized) return;
  setupTaskAutomationSubscribers(eventBus);
  initialized = true;
}

export async function emitEvent<K extends EventType>(event: K, payload: EventPayload[K], db: any) {
  initEventSubscribers();
  await eventBus.emit(event, payload, db);
}
