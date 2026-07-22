/**
 * EventBus Service stub
 *
 * Provides a minimal event bus implementation for the security service.
 * In production, this would integrate with NATS or another message broker.
 */

export type EventHandler = (eventType: string, data: Record<string, unknown>) => Promise<void>;

export class EventBusService {
  private handlers: Map<string, EventHandler[]> = new Map();

  async publish(eventType: string, data: Record<string, unknown>): Promise<void> {
    const handlers = this.handlers.get(eventType) || [];
    for (const handler of handlers) {
      try {
        await handler(eventType, data);
      } catch (error) {
        console.error(`[EventBusService] Error handling event ${eventType}:`, error);
      }
    }
  }

  subscribe(eventType: string, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);
  }

  unsubscribe(eventType: string, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType) || [];
    const idx = handlers.indexOf(handler);
    if (idx >= 0) {
      handlers.splice(idx, 1);
      this.handlers.set(eventType, handlers);
    }
  }
}

export default EventBusService;
