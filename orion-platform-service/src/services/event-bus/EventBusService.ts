/**
 * EventBusService - Business logic layer for Event Bus
 */
import { EventBusRepository, EventSubscription, EventLog } from './EventBusRepository';

export class EventBusServiceError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = 'EventBusServiceError'; }
}

export class EventBusService {
  private repository: EventBusRepository;
  constructor(repository: EventBusRepository) { this.repository = repository; }

  async subscribe(tenantId: string, eventType: string, handler: string): Promise<EventSubscription> {
    if (!tenantId || !eventType) throw new EventBusServiceError('Tenant ID and event type required', 'INVALID_INPUT');
    return this.repository.subscribe(tenantId, eventType, handler);
  }

  async unsubscribe(id: string): Promise<boolean> {
    return this.repository.unsubscribe(id);
  }

  async publish(tenantId: string, eventType: string, payload: Record<string, any>): Promise<EventLog> {
    return this.repository.logEvent(tenantId, eventType, payload);
  }

  async getSubscriptions(tenantId: string, eventType?: string): Promise<EventSubscription[]> {
    return this.repository.getSubscriptions(tenantId, eventType);
  }

  async getEventHistory(tenantId: string, limit?: number): Promise<EventLog[]> {
    return this.repository.getEventLogs(tenantId, limit);
  }
}