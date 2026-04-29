import { EventBusService, TypedEnvelope } from '../services/event-bus-service';

/**
 * Subscription rule for declarative event subscriptions.
 * Defines which subjects to listen on and which JetStream consumer to use.
 */
export interface SubscriptionRule {
  subjectPattern: string;
  streamName: string;
  durableName: string;
  eventType?: string | string[];
  maxRetries?: number;
  ackWait?: string;
}

/**
 * Typed subscription rule with a handler function.
 * The `dataType` field documents the expected event payload type.
 */
export interface TypedSubscriptionRule<T = unknown> extends SubscriptionRule {
  dataType: string;
  handler: (event: TypedEnvelope<T>) => Promise<void>;
}

/**
 * EventSubscriber - Declarative typed subscription framework.
 *
 * Supports both programmatic registration and loading from the
 * EventBusRepository (database-backed subscription definitions).
 */
export class EventSubscriber {
  private eventBus: EventBusService;
  private rules: Array<TypedSubscriptionRule> = [];
  private unsubscribeFns: Array<() => Promise<void>> = [];

  constructor(eventBus: EventBusService) {
    this.eventBus = eventBus;
  }

  /**
   * Register a typed subscription rule. Does not start immediately.
   * Call `start()` to activate all registered rules.
   */
  register<T>(rule: TypedSubscriptionRule<T>): void {
    this.rules.push(rule as TypedSubscriptionRule);
  }

  /**
   * Start all registered subscription rules by subscribing via EventBusService.
   */
  async start(): Promise<void> {
    for (const rule of this.rules) {
      const unsubscribe = await this.eventBus.subscribe(rule.subjectPattern, rule.handler, {
        streamName: rule.streamName, durableName: rule.durableName,
      });
      this.unsubscribeFns.push(unsubscribe);
    }
  }

  /**
   * Stop all active subscriptions by calling their unsubscribe functions.
   */
  async stop(): Promise<void> {
    for (const unsubscribe of this.unsubscribeFns) { await unsubscribe(); }
    this.unsubscribeFns = [];
  }

  /**
   * Load subscription rules from the EventBusRepository and start consuming.
   * Useful for dynamic/runtime-defined subscriptions stored in the database.
   */
  async startFromRegistry(): Promise<void> {
    const repo = this.eventBus.getRepositories()?.subscriptionRepo;
    if (!repo) return;
    const result = await repo.findAll({ limit: 100 });
    for (const sub of result.entities) {
      if (sub.status !== 'active') continue;
      const rule: TypedSubscriptionRule = {
        subjectPattern: sub.subjectPattern,
        streamName: (sub.metadata as any)?.streamName || 'ORION_PLATFORM',
        durableName: sub.durableName || `consumer-${sub.id}`,
        dataType: 'unknown',
        handler: async (event: TypedEnvelope) => { console.log(`[EventSubscriber] Received event: ${event.type}`); },
      };
      this.register(rule);
    }
    await this.start();
  }
}
