/**
 * EventBusService - Stub event bus for agent events
 *
 * Publishes and subscribes to agent lifecycle events.
 * Currently a no-op stub; integrate with NATS/RabbitMQ later.
 */

import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface EventMetadata {
  source?: string;
  [key: string]: unknown;
}

export class EventBusService {
  async publish(type: string, data: unknown, metadata?: EventMetadata): Promise<void> {
    logger.debug({ type, data, metadata }, 'Publishing agent event (stub)');
    // TODO: integrate with NATS or similar message broker
  }

  async subscribe(type: string, handler: (data: unknown) => void): Promise<void> {
    logger.debug({ type }, 'Subscribing to agent event (stub)');
    // TODO: integrate with NATS or similar message broker
  }
}
