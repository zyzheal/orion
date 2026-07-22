/**
 * @orion/event-bus stub types
 *
 * Minimal types for CloudEvent, EventContext, and Subscription
 * used by risk assessment and event subscriber services.
 * In production these come from the shared @orion/event-bus package.
 */

export interface EventContext {
  eventId: string;
  eventType: string;
  source: string;
  timestamp: string;
  tenantId?: string;
  [key: string]: unknown;
}

export interface CloudEventOptions<T> {
  type: string;
  source: string;
  data: T;
  extensions?: Record<string, unknown>;
}

export class CloudEvent<T = unknown> {
  id: string;
  type: string;
  source: string;
  data: T;
  timestamp: string;
  tenantId?: string;
  extensions?: Record<string, unknown>;

  constructor(options: CloudEventOptions<T>) {
    this.id = `ce-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    this.type = options.type;
    this.source = options.source;
    this.data = options.data;
    this.timestamp = new Date().toISOString();
    this.extensions = options.extensions;
    if (options.extensions?.tenantId) {
      this.tenantId = options.extensions.tenantId as string;
    }
  }
}

export interface Subscription {
  unsubscribe(): Promise<void>;
}
