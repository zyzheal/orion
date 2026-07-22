/**
 * @orion/event-bus stub for orion-efficiency-svc
 *
 * Minimal CloudEvent, EventContext, EventBus, EventHandler stubs.
 * In production these come from the shared @orion/event-bus package.
 */

/** Minimal CloudEvent implementation */
export class CloudEvent<T = unknown> {
  id: string;
  type: string;
  source: string;
  data: T;
  time: Date;
  tenantId?: string;
  extensions: Record<string, unknown>;

  constructor(params: {
    type: string;
    source: string;
    data: T;
    time?: Date;
    id?: string;
    extensions?: Record<string, unknown>;
  }) {
    this.id = params.id || `ce-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.type = params.type;
    this.source = params.source;
    this.data = params.data;
    this.time = params.time || new Date();
    this.tenantId = (params.extensions as any)?.tenantId;
    this.extensions = params.extensions || {};
  }
}

/** Event processing context */
export interface EventContext {
  eventId: string;
  eventType: string;
  timestamp: Date;
  ack: () => Promise<void>;
  nack: (reason?: string) => Promise<void>;
}

/** Event subscription options */
export interface SubscriptionOptions {
  streamName?: string;
  durableName?: string;
  autoAck?: boolean;
}

/** Event bus interface */
export interface EventBus {
  publish<T>(event: CloudEvent<T>): Promise<void>;
  subscribe<T>(eventType: string, handler: (event: CloudEvent<T>, context: EventContext) => Promise<void>, options?: SubscriptionOptions): Promise<{ unsubscribe: () => Promise<void> }>;
}

/** Event handler interface */
export interface EventHandler {
  eventType: string;
  handle(event: CloudEvent, context: EventContext): Promise<void>;
}
