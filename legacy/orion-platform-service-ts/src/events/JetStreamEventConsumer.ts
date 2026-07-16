import { EventBusService, TypedEnvelope } from '../services/event-bus-service';

/**
 * Consumer handler configuration for JetStream event consumption.
 * Each handler binds to a specific durable consumer on a stream.
 */
export interface ConsumerHandler<T = unknown> {
  streamName: string;
  durableName: string;
  eventType: string;
  handler: (event: TypedEnvelope<T>) => Promise<void>;
  maxRetries?: number;
}

/**
 * JetStreamEventConsumer - Higher-level consumer framework built on EventBusService.
 *
 * Manages registration, startup, and shutdown of multiple consumer handlers.
 * Each handler is bound to a JetStream durable consumer (stream + durable pair).
 */
export class JetStreamEventConsumer {
  private eventBus: EventBusService;
  private handlers: Map<string, ConsumerHandler<any>> = new Map();
  private unsubscribeFns: Array<() => Promise<void>> = [];

  constructor(eventBus: EventBusService) {
    this.eventBus = eventBus;
  }

  /**
   * Register a consumer handler. Does not start consuming immediately.
   * Call `start()` to activate all registered handlers.
   */
  register<T = unknown>(handler: ConsumerHandler<T>): void {
    const key = `${handler.streamName}:${handler.durableName}`;
    this.handlers.set(key, handler);
  }

  /**
   * Start all registered consumer handlers by subscribing via EventBusService.
   */
  async start(): Promise<void> {
    for (const [key, handler] of this.handlers) {
      const unsubscribe = await this.eventBus.subscribe(
        handler.eventType,
        handler.handler as any,
        { streamName: handler.streamName, durableName: handler.durableName },
      );
      this.unsubscribeFns.push(unsubscribe);
    }
  }

  /**
   * Stop all active consumer handlers by calling their unsubscribe functions.
   */
  async stop(): Promise<void> {
    for (const unsubscribe of this.unsubscribeFns) {
      await unsubscribe();
    }
    this.unsubscribeFns = [];
  }
}
