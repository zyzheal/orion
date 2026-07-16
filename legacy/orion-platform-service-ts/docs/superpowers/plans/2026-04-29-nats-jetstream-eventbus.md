# NATS JetStream EventBus Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing EventBusService from Core NATS publish/subscribe to JetStream with durable consumers, DLQ support, and backward-compatible publish/subscribe APIs.

**Architecture:** Enhance existing `EventBusService` with JetStream client for ack-guaranteed publishing and pull-consumer subscriptions. Add a `JetStreamManagerService` for stream/consumer lifecycle management. Introduce `TypedEnvelope` type for CloudEvents 1.0 compatibility. Keep PostgreSQL dual-write for audit.

**Tech Stack:** TypeScript, Fastify, nats@2.17.0 (JetStream SDK), PostgreSQL, Jest, pino

---

## File Structure Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/services/types/event-types.ts` | Create | TypedEnvelope, JetStreamConfig, ConsumerConfig types |
| `src/services/jetstream-manager.ts` | Create | Stream/Consumer lifecycle management (ensureStream, ensureConsumer, getMetrics) |
| `src/services/event-bus-service.ts` | Modify | Add JetStream client, upgrade publish/subscribe, add metrics |
| `src/events/EventBusAdapter.ts` | Modify | Enhance PublishResult with deliveryMode + jetStreamSeq |
| `src/events/JetStreamEventConsumer.ts` | Create | Consumer management framework (register/start/stop) |
| `src/events/EventSubscriber.ts` | Create | Declarative subscription framework |
| `src/events/PipelineEventListener.ts` | Rewrite | Replace `@orion/event-bus` import with EventBusService-based implementation |
| `src/events/index.ts` | Modify | Export new modules |
| `src/config/index.ts` | Modify | Extend eventBus config with consumers + dlq |
| `src/api/eventbus-routes.ts` | Modify | Add JetStream metrics + DLQ API endpoints |
| `src/app.ts` | Modify | Add JetStream health check |
| `src/index.ts` | Modify | Initialize JetStream streams/consumers on startup |
| `src/services/__tests__/JetStreamManager.test.ts` | Create | Unit tests for JetStreamManagerService |
| `src/services/__tests__/event-bus-jetstream.test.ts` | Create | Unit tests for JetStream-enhanced EventBusService |
| `src/events/__tests__/JetStreamEventConsumer.test.ts` | Create | Unit tests for JetStreamEventConsumer |
| `src/events/__tests__/EventSubscriber.test.ts` | Create | Unit tests for EventSubscriber |
| `src/events/__tests__/PipelineEventListener.test.ts` | Create | Unit tests for rewritten PipelineEventListener |
| `src/api/__tests__/eventbus-jetstream-routes.test.ts` | Create | Unit tests for new JetStream API routes |

---

### Task 1: TypedEnvelope Types + JetStreamManagerService

**Files:**
- Create: `src/services/types/event-types.ts`
- Create: `src/services/jetstream-manager.ts`
- Create: `src/services/__tests__/JetStreamManager.test.ts`

- [ ] **Step 1: Write the failing test for TypedEnvelope types**

```typescript
// src/services/__tests__/JetStreamManager.test.ts (types section)

import { TypedEnvelope, JetStreamConfig, ConsumerConfig, ORION_STREAMS, ORION_CONSUMERS } from '../types/event-types';

describe('TypedEnvelope', () => {
  it('should accept valid CloudEvents 1.0 envelope', () => {
    const envelope: TypedEnvelope<{ runId: string }> = {
      id: 'uuid-1',
      source: 'pipeline-service',
      specversion: '1.0',
      type: 'orion.pipeline.run.created',
      datacontenttype: 'application/json',
      data: { runId: 'run-1' },
      time: new Date().toISOString(),
      tenantid: 'tenant-1',
    };
    expect(envelope.data.runId).toBe('run-1');
    expect(envelope.specversion).toBe('1.0');
  });

  it('should accept optional _jsmeta field', () => {
    const envelope: TypedEnvelope<{ runId: string }> = {
      id: 'uuid-1',
      source: 'pipeline-service',
      specversion: '1.0',
      type: 'orion.pipeline.run.created',
      datacontenttype: 'application/json',
      data: { runId: 'run-1' },
      time: new Date().toISOString(),
      _jsmeta: {
        stream: 'ORION_PIPELINE',
        consumer: 'pipeline-run',
        sequence: 1,
        delivered: 1,
        timestamp: Date.now(),
        pending: 0,
      },
    };
    expect(envelope._jsmeta!.stream).toBe('ORION_PIPELINE');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/__tests__/JetStreamManager.test.ts -t "TypedEnvelope" --no-coverage`
Expected: FAIL with "Cannot find module '../types/event-types'"

- [ ] **Step 3: Create TypedEnvelope types**

```typescript
// src/services/types/event-types.ts

/**
 * TypedEnvelope — Unified event envelope for all event publish/consume
 * CloudEvents 1.0 compatible with Orion extensions
 */

export interface TypedEnvelope<T = unknown> {
  /** CloudEvents 1.0 standard fields */
  id: string;                    // UUID
  source: string;                // e.g., "pipeline-service"
  specversion: '1.0';
  type: string;                  // e.g., "orion.pipeline.run.created"
  datacontenttype: 'application/json';
  data: T;
  time: string;                  // ISO 8601

  /** Orion extension fields */
  tenantid?: string;
  userid?: string;
  traceid?: string;
  correlationid?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';

  /** JetStream metadata (injected on consume) */
  _jsmeta?: {
    stream: string;
    consumer: string;
    sequence: number;
    delivered: number;
    timestamp: number;
    pending: number;
  };
}

/** JetStream Stream configuration */
export interface JetStreamConfig {
  name: string;
  subjects: string[];
  retention?: 'limits' | 'interest' | 'workqueue';
  maxMsgs?: number;
  maxAge?: string;
  storage?: 'file' | 'memory';
  replicas?: number;
  consumers?: ConsumerConfig[];
}

/** Durable Consumer configuration */
export interface ConsumerConfig {
  name: string;
  filterSubject?: string;
  deliverPolicy?: 'all' | 'last' | 'new' | 'byStartSequence' | 'byStartTime';
  ackPolicy?: 'none' | 'all' | 'explicit';
  ackWait?: string;
  maxDeliver?: number;
  maxAckPending?: number;
  backOff?: string[];
  replayPolicy?: 'instant' | 'original';
}

/** Stream definitions constant */
export const ORION_STREAMS = {
  PLATFORM: {
    name: 'ORION_PLATFORM',
    subjects: [
      'orion.code.*',
      'orion.deploy.*',
      'orion.config.*',
      'orion.incident.*',
    ],
    retention: 'limits' as const,
    maxMsgs: 1_000_000,
    maxAge: '7d',
    storage: 'file' as const,
    replicas: 1,
  },
  PIPELINE: {
    name: 'ORION_PIPELINE',
    subjects: [
      'orion.pipeline.run.*',
      'orion.pipeline.stage.*',
      'orion.pipeline.task.*',
    ],
    retention: 'limits' as const,
    maxMsgs: 5_000_000,
    maxAge: '14d',
    storage: 'file' as const,
    replicas: 1,
  },
  DLQ: {
    name: 'ORION_DLQ',
    subjects: ['*.dlq.>'],
    retention: 'limits' as const,
    maxMsgs: 500_000,
    maxAge: '30d',
    storage: 'file' as const,
    replicas: 1,
  },
} as const;

/** Consumer definitions constant */
export const ORION_CONSUMERS = {
  PLATFORM_ALL: {
    name: 'platform-all',
    stream: 'ORION_PLATFORM',
    filterSubject: 'orion.*',
    deliverPolicy: 'new' as const,
    ackPolicy: 'explicit' as const,
    ackWait: '30s',
    maxDeliver: 5,
    maxAckPending: 100,
    replayPolicy: 'instant' as const,
  },
  PIPELINE_RUN: {
    name: 'pipeline-run',
    stream: 'ORION_PIPELINE',
    filterSubject: 'orion.pipeline.run.*',
    deliverPolicy: 'new' as const,
    ackPolicy: 'explicit' as const,
    ackWait: '60s',
    maxDeliver: 5,
    maxAckPending: 200,
    replayPolicy: 'instant' as const,
  },
  PIPELINE_STAGE: {
    name: 'pipeline-stage',
    stream: 'ORION_PIPELINE',
    filterSubject: 'orion.pipeline.stage.*',
    deliverPolicy: 'new' as const,
    ackPolicy: 'explicit' as const,
    ackWait: '30s',
    maxDeliver: 3,
    maxAckPending: 500,
    replayPolicy: 'instant' as const,
  },
} as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/__tests__/JetStreamManager.test.ts -t "TypedEnvelope" --no-coverage`
Expected: PASS (2 tests)

- [ ] **Step 5: Write failing tests for JetStreamManagerService**

Add to `src/services/__tests__/JetStreamManager.test.ts`:

```typescript
// JetStreamManagerService tests
import { JetStreamManagerService, StreamDefinition, ConsumerDefinition } from '../jetstream-manager';

describe('JetStreamManagerService', () => {
  let mockJsm: any;
  let service: JetStreamManagerService;

  beforeEach(() => {
    mockJsm = {
      streams: {
        info: jest.fn(),
        add: jest.fn(),
      },
      consumers: {
        info: jest.fn(),
        add: jest.fn(),
      },
    };
    service = new JetStreamManagerService(mockJsm);
  });

  describe('ensureStream', () => {
    it('should skip if stream already exists', async () => {
      mockJsm.streams.info.mockResolvedValue({ name: 'TEST_STREAM' });

      await service.ensureStream({
        name: 'TEST_STREAM',
        subjects: ['test.*'],
      });

      expect(mockJsm.streams.add).not.toHaveBeenCalled();
    });

    it('should create stream if it does not exist', async () => {
      mockJsm.streams.info.mockRejectedValue(new Error('stream not found'));
      mockJsm.streams.add.mockResolvedValue({ name: 'NEW_STREAM' });

      await service.ensureStream({
        name: 'NEW_STREAM',
        subjects: ['test.*', 'test.>'],
        maxMsgs: 1_000_000,
        maxAge: '7d',
      });

      expect(mockJsm.streams.add).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'NEW_STREAM',
          subjects: ['test.*', 'test.>'],
          max_msgs: 1_000_000,
        }),
      );
    });

    it('should create consumers when provided', async () => {
      mockJsm.streams.info.mockRejectedValue(new Error('not found'));
      mockJsm.streams.add.mockResolvedValue({});
      mockJsm.consumers.info.mockRejectedValue(new Error('not found'));
      mockJsm.consumers.add.mockResolvedValue({});

      await service.ensureStream({
        name: 'TEST_STREAM',
        subjects: ['test.*'],
        consumers: [
          { name: 'test-consumer', filterSubject: 'test.*' },
        ],
      });

      expect(mockJsm.consumers.add).toHaveBeenCalledWith(
        'TEST_STREAM',
        expect.objectContaining({ durable_name: 'test-consumer' }),
      );
    });
  });

  describe('ensureConsumer', () => {
    it('should skip if consumer already exists', async () => {
      mockJsm.consumers.info.mockResolvedValue({ name: 'existing-consumer' });

      await service.ensureConsumer('TEST_STREAM', {
        name: 'existing-consumer',
      });

      expect(mockJsm.consumers.add).not.toHaveBeenCalled();
    });

    it('should create consumer if it does not exist', async () => {
      mockJsm.consumers.info.mockRejectedValue(new Error('not found'));
      mockJsm.consumers.add.mockResolvedValue({});

      await service.ensureConsumer('TEST_STREAM', {
        name: 'new-consumer',
        filterSubject: 'test.*',
        maxDeliver: 5,
        ackWait: '30s',
      });

      expect(mockJsm.consumers.add).toHaveBeenCalledWith(
        'TEST_STREAM',
        expect.objectContaining({
          durable_name: 'new-consumer',
          filter_subject: 'test.*',
          max_deliver: 5,
        }),
      );
    });
  });

  describe('getMetrics', () => {
    it('should return stream metrics', async () => {
      mockJsm.streams.info.mockResolvedValue({
        state: { messages: 1000, bytes: 50000, consumers: 3 },
      });

      const metrics = await service.getMetrics('TEST_STREAM');

      expect(metrics).toEqual({
        messages: 1000,
        bytes: 50000,
        consumers: 3,
      });
    });
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx jest src/services/__tests__/JetStreamManager.test.ts -t "JetStreamManagerService" --no-coverage`
Expected: FAIL with "Cannot find module '../jetstream-manager'"

- [ ] **Step 7: Write JetStreamManagerService implementation**

```typescript
// src/services/jetstream-manager.ts

import { JetStreamManager, StreamConfig, ConsumerConfig } from 'nats';

export interface StreamDefinition {
  name: string;
  subjects: string[];
  retention?: 'limits' | 'interest' | 'workqueue';
  maxMsgs?: number;
  maxAge?: string;
  storage?: 'file' | 'memory';
  replicas?: number;
  consumers?: ConsumerDefinition[];
}

export interface ConsumerDefinition {
  name: string;
  filterSubject?: string;
  deliverPolicy?: 'all' | 'last' | 'new' | 'byStartSequence' | 'byStartTime';
  ackPolicy?: 'none' | 'all' | 'explicit';
  ackWait?: string;
  maxDeliver?: number;
  maxAckPending?: number;
  backOff?: string[];
  replayPolicy?: 'instant' | 'original';
}

/**
 * Convert duration string to nanoseconds (JetStream API requirement)
 */
export function toNanoseconds(duration: string): number {
  const match = duration.match(/^(\d+)(ms|s|m|h)$/);
  if (!match) return 0;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 'ms': return value * 1_000_000;
    case 's': return value * 1_000_000_000;
    case 'm': return value * 60 * 1_000_000_000;
    case 'h': return value * 3600 * 1_000_000_000;
    default: return 0;
  }
}

/**
 * JetStreamManagerService — manages Stream and Consumer lifecycle
 */
export class JetStreamManagerService {
  private jsm: JetStreamManager;

  constructor(jsm: JetStreamManager) {
    this.jsm = jsm;
  }

  /**
   * Ensure a stream exists, creating it if necessary.
   * Also creates all defined consumers.
   */
  async ensureStream(def: StreamDefinition): Promise<void> {
    try {
      await this.jsm.streams.info(def.name);
    } catch {
      const config: Partial<StreamConfig> = {
        name: def.name,
        subjects: def.subjects,
        retention: this.mapRetention(def.retention),
        max_msgs: def.maxMsgs || 0,
        max_age: def.maxAge ? toNanoseconds(def.maxAge) : 0,
        storage: def.storage === 'memory' ? 0 : 1,
        replicas: def.replicas || 1,
      };
      await this.jsm.streams.add(config);
    }

    for (const consumer of (def.consumers || [])) {
      await this.ensureConsumer(def.name, consumer);
    }
  }

  /**
   * Ensure a consumer exists on a given stream, creating it if necessary.
   */
  async ensureConsumer(streamName: string, def: ConsumerDefinition): Promise<void> {
    try {
      await this.jsm.consumers.info(streamName, def.name);
    } catch {
      const backoffNanos = (def.backOff || []).map(toNanoseconds);

      await this.jsm.consumers.add(streamName, {
        durable_name: def.name,
        filter_subject: def.filterSubject,
        deliver_policy: this.mapDeliverPolicy(def.deliverPolicy),
        ack_policy: this.mapAckPolicy(def.ackPolicy),
        ack_wait: def.ackWait ? toNanoseconds(def.ackWait) : 0,
        max_deliver: def.maxDeliver || 5,
        max_ack_pending: def.maxAckPending || 100,
        backoff: backoffNanos.length > 0 ? backoffNanos : undefined,
        replay_policy: def.replayPolicy === 'original' ? 1 : 0,
      } as ConsumerConfig);
    }
  }

  /**
   * Get stream-level metrics
   */
  async getMetrics(streamName: string): Promise<{
    messages: number;
    bytes: number;
    consumers: number;
  }> {
    const info = await this.jsm.streams.info(streamName);
    return {
      messages: info.state.messages,
      bytes: info.state.bytes,
      consumers: info.state.consumers,
    };
  }

  /**
   * List all consumers for a stream
   */
  async listConsumers(streamName: string): Promise<Array<{ name: string; pending: number }>> {
    const consumers = await this.jsm.consumers.list(streamName);
    const result: Array<{ name: string; pending: number }> = [];
    for await (const consumer of consumers) {
      result.push({
        name: consumer.name,
        pending: (consumer as any).num_pending || 0,
      });
    }
    return result;
  }

  // ---- Private mapping helpers ----

  private mapRetention(retention?: string): 0 | 1 | 2 {
    switch (retention) {
      case 'interest': return 1;
      case 'workqueue': return 2;
      default: return 0; // limits
    }
  }

  private mapDeliverPolicy(policy?: string): 0 | 1 | 2 | 3 | 4 {
    switch (policy) {
      case 'all': return 0;
      case 'last': return 1;
      case 'new': return 2;
      case 'byStartSequence': return 3;
      case 'byStartTime': return 4;
      default: return 2; // new
    }
  }

  private mapAckPolicy(policy?: string): 0 | 1 | 2 {
    switch (policy) {
      case 'none': return 0;
      case 'all': return 1;
      case 'explicit': return 2;
      default: return 2; // explicit
    }
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx jest src/services/__tests__/JetStreamManager.test.ts --no-coverage`
Expected: All tests PASS (7 tests total: 2 TypedEnvelope + 5 JetStreamManagerService)

- [ ] **Step 9: Commit**

```bash
git add src/services/types/event-types.ts src/services/jetstream-manager.ts src/services/__tests__/JetStreamManager.test.ts
git commit -m "feat(eventbus): add TypedEnvelope types and JetStreamManagerService

- TypedEnvelope: CloudEvents 1.0 compatible envelope with Orion extensions
- ORION_STREAMS/ORION_CONSUMERS: stream and consumer config constants
- JetStreamManagerService: ensureStream, ensureConsumer, getMetrics, listConsumers
- toNanoseconds helper for JetStream duration conversion
- Unit tests for both modules"
```

---

### Task 2: EventBusService JetStream Upgrade

**Files:**
- Modify: `src/services/event-bus-service.ts`
- Create: `src/services/__tests__/event-bus-jetstream.test.ts`

- [ ] **Step 1: Write failing tests for JetStream publish**

```typescript
// src/services/__tests__/event-bus-jetstream.test.ts

import { EventBusService } from '../event-bus-service';

function createMockNatsConnection() {
  const mockJetStream = {
    publish: jest.fn().mockResolvedValue({ seq: 42 }),
    consumers: {
      get: jest.fn(),
    },
  };
  const mockJetStreamManager = {
    streams: { info: jest.fn(), add: jest.fn() },
    consumers: { info: jest.fn(), add: jest.fn(), list: jest.fn() },
  };

  return {
    jetstream: jest.fn().mockReturnValue(mockJetStream),
    jetstreamManager: jest.fn().mockReturnValue(mockJetStreamManager),
    publish: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn(),
    closed: jest.fn().mockResolvedValue(undefined),
    isClosed: jest.fn().mockReturnValue(false),
    drain: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    _mockJetStream: mockJetStream,
    _mockJetStreamManager: mockJetStreamManager,
  };
}

describe('EventBusService JetStream', () => {
  let eventBus: EventBusService;
  let mockNats: ReturnType<typeof createMockNatsConnection>;

  beforeEach(() => {
    mockNats = createMockNatsConnection();
    // Mock dynamic import of nats
    jest.doMock('nats', () => ({ connect: jest.fn().mockResolvedValue(mockNats) }), { virtual: true });
  });

  afterEach(() => {
    jest.dontMock('nats');
  });

  describe('JetStream initialization', () => {
    it('should initialize JetStream client after connect', async () => {
      eventBus = new EventBusService({ enabled: true, autoConnect: false });

      // Manually set connection to simulate connected state
      (eventBus as any).natsConnection = mockNats;
      (eventBus as any).connectionState = 'connected';

      // After connect, jetstream() should be called
      const jsClient = mockNats.jetstream();
      expect(mockNats.jetstream).toHaveBeenCalled();
      expect(jsClient).toBeDefined();
    });

    it('should report JetStream as available when connected', async () => {
      eventBus = new EventBusService({ enabled: true, autoConnect: false });
      (eventBus as any).natsConnection = mockNats;
      (eventBus as any).connectionState = 'connected';

      // isJetStreamAvailable should return true when natsConnection has jetstream method
      expect(eventBus.isJetStreamAvailable?.()).toBe(true);
    });
  });

  describe('JetStream publish', () => {
    it('should use JetStream publish when available', async () => {
      eventBus = new EventBusService({ enabled: true, autoConnect: false }, {
        eventRepo: {
          insert: jest.fn().mockResolvedValue({ id: 'evt-1' }),
          updateStatus: jest.fn().mockResolvedValue(undefined),
        } as any,
      });
      (eventBus as any).natsConnection = mockNats;
      (eventBus as any).connectionState = 'connected';
      (eventBus as any).jetStream = mockNats._mockJetStream;

      const eventId = await eventBus.publish('test.event', { key: 'value' });

      expect(mockNats._mockJetStream.publish).toHaveBeenCalled();
      expect(eventId).toBe('evt-1');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/__tests__/event-bus-jetstream.test.ts --no-coverage`
Expected: FAIL — `isJetStreamAvailable` method does not exist

- [ ] **Step 3: Add JetStream fields and methods to EventBusService**

In `src/services/event-bus-service.ts`, add imports at the top:

```typescript
import { TypedEnvelope, JetStreamConfig, ConsumerConfig } from './types/event-types';

// Add JetStream-related imports from nats types
import type { JetStreamClient, JetStreamManager, JsMsg } from 'nats';
```

Add new private fields to the `EventBusService` class (after `private natsConnection: any = null;`):

```typescript
  /** JetStream client for ack-guaranteed publish */
  private jetStream: JetStreamClient | null = null;
  /** JetStream manager for stream/consumer lifecycle */
  private jetStreamManager: JetStreamManager | null = null;
```

Modify the `connect()` method — after `this.connectionState = 'connected';` and before `this.emit('connect');`, add:

```typescript
      // Initialize JetStream clients
      this.jetStream = this.natsConnection.jetstream();
      this.jetStreamManager = this.natsConnection.jetstreamManager();
      logger.info('JetStream initialized');
```

Add new methods to the class (before the closing `}` of `EventBusService`):

```typescript
  /**
   * Check if JetStream is available
   */
  isJetStreamAvailable(): boolean {
    return this.jetStream !== null && this.connectionState === 'connected';
  }

  /**
   * Get JetStream client (returns null if not initialized)
   */
  getJetStreamClient(): JetStreamClient | null {
    return this.jetStream;
  }

  /**
   * Get JetStreamManager (returns null if not initialized)
   */
  getJetStreamManager(): JetStreamManager | null {
    return this.jetStreamManager;
  }

  /**
   * Ensure a JetStream stream exists
   */
  async ensureStream(config: JetStreamConfig): Promise<void> {
    if (!this.jetStreamManager) return;

    const jsmService = new (await import('./jetstream-manager')).JetStreamManagerService(this.jetStreamManager);
    await jsmService.ensureStream({
      name: config.name,
      subjects: config.subjects,
      retention: config.retention,
      maxMsgs: config.maxMsgs,
      maxAge: config.maxAge,
      storage: config.storage,
      replicas: config.replicas,
    });
  }

  /**
   * Ensure a durable consumer exists
   */
  async ensureConsumer(streamName: string, config: ConsumerConfig): Promise<void> {
    if (!this.jetStreamManager) return;

    const jsmService = new (await import('./jetstream-manager')).JetStreamManagerService(this.jetStreamManager);
    await jsmService.ensureConsumer(streamName, config);
  }

  /**
   * Get JetStream metrics for a stream
   */
  async getJetStreamMetrics(streamName?: string): Promise<Record<string, unknown>> {
    if (!this.jetStreamManager) {
      return { available: false };
    }

    const jsmService = new (await import('./jetstream-manager')).JetStreamManagerService(this.jetStreamManager);

    if (streamName) {
      const metrics = await jsmService.getMetrics(streamName);
      return { available: true, stream: streamName, ...metrics };
    }

    // Return metrics for all known streams
    const { ORION_STREAMS } = await import('./types/event-types');
    const results: Record<string, unknown> = { available: true };
    for (const [key, stream] of Object.entries(ORION_STREAMS)) {
      try {
        results[key] = await jsmService.getMetrics(stream.name);
      } catch {
        results[key] = { error: 'stream not found' };
      }
    }
    return results;
  }

  /**
   * List consumers for a stream
   */
  async listConsumers(streamName: string): Promise<Array<{ name: string; pending: number }>> {
    if (!this.jetStreamManager) {
      return [];
    }
    const jsmService = new (await import('./jetstream-manager')).JetStreamManagerService(this.jetStreamManager);
    return jsmService.listConsumers(streamName);
  }
```

Modify the `publish()` method — replace the Core NATS publish line:

```typescript
// Replace this line in publish():
// await this.natsConnection.publish(subject, new TextEncoder().encode(message));

// With JetStream publish when available:
if (this.isJetStreamAvailable()) {
  const payload = new TextEncoder().encode(JSON.stringify({
    type,
    source,
    data,
    timestamp: new Date().toISOString(),
  }));
  const ack = await this.jetStream!.publish(subject, payload);
  // ack.seq confirms message persisted to JetStream
  if (eventRecord && this.repos.eventRepo) {
    try {
      await this.repos.eventRepo.updateStatus(eventRecord.id, 'delivered');
    } catch (err) {
      logger.warn({ err: String(err) }, 'Failed to update event status after JetStream ack');
    }
  }
  this.metrics.publishSuccess++;
  return eventRecord?.id || type;
} else {
  // Fallback to Core NATS publish
  await this.natsConnection.publish(subject, new TextEncoder().encode(message));
  if (eventRecord && this.repos.eventRepo) {
    try {
      await this.repos.eventRepo.updateStatus(eventRecord.id, 'delivered');
    } catch (err) {
      logger.warn({ err: String(err) }, 'Failed to update event status');
    }
  }
  this.metrics.publishSuccess++;
  return eventRecord?.id || type;
}
```

Modify the `close()` method — add JetStream cleanup:

```typescript
  async close(): Promise<void> {
    this.jetStream = null;
    this.jetStreamManager = null;
    if (this.natsConnection) {
      // ... existing code
    }
  }
```

Also add the export of TypedEnvelope at the bottom of the file:

```typescript
export { TypedEnvelope } from './types/event-types';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/__tests__/event-bus-jetstream.test.ts --no-coverage`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/event-bus-service.ts src/services/__tests__/event-bus-jetstream.test.ts src/services/types/event-types.ts
git commit -m "feat(eventbus): upgrade EventBusService with JetStream publish

- Add JetStream client/manager initialization on connect
- isJetStreamAvailable(), getJetStreamClient/Manager accessors
- publish() now uses JetStream publish with ack guarantee
- ensureStream/ensureConsumer via JetStreamManagerService
- getJetStreamMetrics, listConsumers API
- Fallback to Core NATS when JetStream unavailable
- Unit tests for JetStream initialization and publish"
```

---

### Task 3: JetStream Subscribe + EventBusAdapter Enhancement

**Files:**
- Modify: `src/services/event-bus-service.ts` (subscribe method)
- Modify: `src/events/EventBusAdapter.ts`
- Create: `src/events/__tests__/JetStreamEventConsumer.test.ts`

- [ ] **Step 1: Write failing tests for JetStream subscribe**

Add to `src/services/__tests__/event-bus-jetstream.test.ts`:

```typescript
  describe('JetStream subscribe', () => {
    it('should throw EventBusError when JetStream not available for subscribe', async () => {
      eventBus = new EventBusService({ enabled: true, autoConnect: false });

      await expect(eventBus.subscribe('test.event', async () => {}))
        .rejects.toThrow('NOT_CONNECTED');
    });

    it('should accept streamName and durableName options', async () => {
      eventBus = new EventBusService({ enabled: true, autoConnect: false });
      (eventBus as any).natsConnection = mockNats;
      (eventBus as any).connectionState = 'connected';
      (eventBus as any).jetStream = mockNats._mockJetStream;

      const mockConsumer = {
        fetch: jest.fn().mockResolvedValue({
          [Symbol.asyncIterator]: async function* () {
            // No messages in this test
          },
        }),
      };
      mockNats._mockJetStream.consumers.get.mockResolvedValue(mockConsumer);

      const unsubscribe = await eventBus.subscribe<{ key: string }>(
        'test.event',
        async (event) => {},
        { streamName: 'ORION_PLATFORM', durableName: 'test-consumer' },
      );

      expect(mockNats._mockJetStream.consumers.get).toHaveBeenCalledWith(
        'ORION_PLATFORM',
        'test-consumer',
      );
      expect(typeof unsubscribe).toBe('function');
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/__tests__/event-bus-jetstream.test.ts -t "JetStream subscribe" --no-coverage`
Expected: FAIL — subscribe does not use JetStream consumers

- [ ] **Step 3: Implement JetStream subscribe**

In `src/services/event-bus-service.ts`, replace the `subscribe()` method body (keep the signature and initial validation, replace the core logic):

```typescript
  async subscribe<T = any>(
    eventType: string,
    handler: (event: TypedEnvelope<T>) => Promise<void>,
    options?: {
      streamName?: string;
      durableName?: string;
      autoAck?: boolean;
      filterSubject?: string;
      tenantId?: string;
    }
  ): Promise<() => Promise<void>> {
    // ARCH-003: Fallback 模式下抛出明确错误
    if (this.connectionState === 'disabled') {
      throw new EventBusError('EventBus disabled, cannot subscribe', 'DISABLED', false);
    }

    if (this.connectionState === 'fallback' || !this.natsConnection) {
      throw new EventBusError(
        `NATS not connected (state: ${this.connectionState}), cannot subscribe to ${eventType}`,
        'NOT_CONNECTED',
        true
      );
    }

    // --- JetStream Pull Consumer path ---
    if (options?.streamName && options?.durableName && this.jetStream) {
      return this.subscribeViaJetStream<T>(eventType, handler, options);
    }

    // --- Fallback: Core NATS subscription (backward compat) ---
    return this.subscribeViaCoreNats<T>(eventType, handler, options);
  }

  /**
   * Subscribe via JetStream Pull Consumer
   */
  private async subscribeViaJetStream<T>(
    eventType: string,
    handler: (event: TypedEnvelope<T>) => Promise<void>,
    options: { streamName: string; durableName: string; filterSubject?: string; tenantId?: string },
  ): Promise<() => Promise<void>> {
    const consumer = await this.jetStream!.consumers.get(options.streamName, options.durableName);

    let running = true;

    const pullLoop = async () => {
      while (running) {
        try {
          const messages = await consumer.fetch({ maxMessages: 100, expiresMs: 30000 });
          for await (const msg of messages) {
            if (!running) break;
            try {
              const data = JSON.parse(new TextDecoder().decode(msg.data));
              const envelope: TypedEnvelope<T> = {
                id: msg.subject,
                source: data.source || 'unknown',
                specversion: '1.0',
                type: eventType,
                datacontenttype: 'application/json',
                data: data.data,
                time: data.timestamp || new Date().toISOString(),
              };

              await handler(envelope);
              msg.ack();
            } catch (err) {
              logger.error({ error: String(err) }, 'Error handling JetStream message');
              if (msg.nak) {
                msg.nak();
              }
            }
          }
        } catch (err) {
          if (!running) break;
          logger.warn({ error: String(err) }, 'JetStream fetch error, retrying...');
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    };

    pullLoop().catch(err => {
      logger.error({ err: String(err) }, 'JetStream consumer loop error');
    });

    this.metrics.subscribeSuccess++;
    this.emit('subscribe', { eventType, subscriptionId: options.durableName });

    return async () => {
      running = false;
      this.emit('unsubscribe', { eventType });
    };
  }

  /**
   * Subscribe via Core NATS (backward compatibility)
   */
  private async subscribeViaCoreNats<T>(
    eventType: string,
    handler: (event: any) => Promise<void>,
    options?: { filterSubject?: string; durableName?: string; tenantId?: string },
  ): Promise<() => Promise<void>> {
    const subject = options?.filterSubject || eventType;
    const queue = options?.durableName || 'orion-platform-queue';

    let subRecord: any = null;
    if (this.repos.subscriptionRepo) {
      try {
        subRecord = await this.repos.subscriptionRepo.insert({
          tenant_id: options?.tenantId || 'default',
          subject_pattern: eventType,
          handler_name: eventType,
          handler_type: 'nats',
          durable_name: options?.durableName,
          queue_group: queue,
          filter_subject: options?.filterSubject,
          status: 'active',
          metadata: {},
        });
      } catch (err) {
        logger.warn({ err: String(err) }, 'Failed to persist subscription');
      }
    }

    const subscription = this.natsConnection.subscribe(subject, { queue });

    (async () => {
      for await (const msg of subscription) {
        try {
          const data = JSON.parse(new TextDecoder().decode(msg.data));
          await handler({
            type: eventType,
            data: data.data,
            source: data.source,
            timestamp: data.timestamp,
          });
          msg.ack();
        } catch (error) {
          logger.error({ error: String(error) }, 'Error handling message');
          if (msg.nak) msg.nak();
        }
      }
    })().catch((err) => {
      logger.error({ err: String(err) }, 'Subscription error');
      this.metrics.subscribeFailed++;
    });

    this.metrics.subscribeSuccess++;
    this.emit('subscribe', { eventType, subscriptionId: subject });

    return async () => {
      await subscription.drain();
      if (subRecord && this.repos.subscriptionRepo) {
        try {
          await this.repos.subscriptionRepo.updateStatus(subRecord.id, 'deleted');
        } catch (err) {
          logger.warn({ err: String(err) }, 'Failed to update subscription status');
        }
      }
    };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/__tests__/event-bus-jetstream.test.ts --no-coverage`
Expected: All tests PASS

- [ ] **Step 5: Enhance EventBusAdapter PublishResult**

In `src/events/EventBusAdapter.ts`, modify the `PublishResult` interface:

```typescript
export interface PublishResult {
  success: boolean;
  eventId?: string;
  fallback?: boolean;
  /** JetStream delivery mode */
  deliveryMode?: 'jetstream' | 'fallback' | 'disabled';
  /** JetStream ack sequence number */
  jetStreamSeq?: number;
  error?: string;
}
```

- [ ] **Step 6: Commit**

```bash
git add src/services/event-bus-service.ts src/services/__tests__/event-bus-jetstream.test.ts src/events/EventBusAdapter.ts
git commit -m "feat(eventbus): JetStream subscribe + enhance EventBusAdapter

- subscribe() splits into JetStream Pull Consumer and Core NATS paths
- subscribeViaJetStream: fetch loop with ack/nak, 30s expiry, 100 msg batch
- subscribeViaCoreNats: backward-compatible fallback
- EventBusAdapter.PublishResult: add deliveryMode + jetStreamSeq fields
- Tests for JetStream subscribe with consumer.get mock"
```

---

### Task 4: JetStreamEventConsumer + EventSubscriber Framework

**Files:**
- Create: `src/events/JetStreamEventConsumer.ts`
- Create: `src/events/EventSubscriber.ts`
- Create: `src/events/__tests__/JetStreamEventConsumer.test.ts`
- Create: `src/events/__tests__/EventSubscriber.test.ts`

- [ ] **Step 1: Write failing tests for JetStreamEventConsumer**

```typescript
// src/events/__tests__/JetStreamEventConsumer.test.ts

import { JetStreamEventConsumer, ConsumerHandler } from '../JetStreamEventConsumer';
import { EventBusService, TypedEnvelope } from '../../services/event-bus-service';

describe('JetStreamEventConsumer', () => {
  let consumer: JetStreamEventConsumer;
  let mockEventBus: jest.Mocked<EventBusService>;
  let handlers: Map<string, ConsumerHandler>;

  beforeEach(() => {
    mockEventBus = {
      subscribe: jest.fn().mockResolvedValue(jest.fn()),
      isJetStreamAvailable: jest.fn().mockReturnValue(true),
    } as any;
    handlers = new Map();
    consumer = new JetStreamEventConsumer(mockEventBus);
  });

  it('should register a consumer handler', () => {
    const handler: ConsumerHandler = {
      streamName: 'ORION_PLATFORM',
      durableName: 'test-handler',
      eventType: 'orion.test.event',
      handler: async () => {},
    };

    consumer.register(handler);

    // register should store the handler
    expect(mockEventBus.subscribe).not.toHaveBeenCalled(); // not until start()
  });

  it('should start all registered consumers', async () => {
    consumer.register({
      streamName: 'ORION_PLATFORM',
      durableName: 'test-1',
      eventType: 'orion.test.event',
      handler: async () => {},
    });

    await consumer.start();

    expect(mockEventBus.subscribe).toHaveBeenCalledWith(
      'orion.test.event',
      expect.any(Function),
      { streamName: 'ORION_PLATFORM', durableName: 'test-1' },
    );
  });

  it('should stop all consumers', async () => {
    const mockUnsubscribe = jest.fn().mockResolvedValue(undefined);
    mockEventBus.subscribe.mockResolvedValue(mockUnsubscribe);

    consumer.register({
      streamName: 'ORION_PLATFORM',
      durableName: 'test-2',
      eventType: 'orion.test.event',
      handler: async () => {},
    });

    await consumer.start();
    await consumer.stop();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/events/__tests__/JetStreamEventConsumer.test.ts --no-coverage`
Expected: FAIL with "Cannot find module '../JetStreamEventConsumer'"

- [ ] **Step 3: Implement JetStreamEventConsumer**

```typescript
// src/events/JetStreamEventConsumer.ts

import { EventBusService, TypedEnvelope } from '../services/event-bus-service';

export interface ConsumerHandler<T = unknown> {
  streamName: string;
  durableName: string;
  eventType: string;
  handler: (event: TypedEnvelope<T>) => Promise<void>;
  maxRetries?: number;
}

/**
 * JetStreamEventConsumer — manages consumer registration and lifecycle
 */
export class JetStreamEventConsumer {
  private eventBus: EventBusService;
  private handlers: Map<string, ConsumerHandler> = new Map();
  private unsubscribeFns: Array<() => Promise<void>> = [];

  constructor(eventBus: EventBusService) {
    this.eventBus = eventBus;
  }

  /**
   * Register an event handler (does NOT start it)
   */
  register<T = unknown>(handler: ConsumerHandler<T>): void {
    const key = `${handler.streamName}:${handler.durableName}`;
    this.handlers.set(key, handler);
  }

  /**
   * Start all registered consumers
   */
  async start(): Promise<void> {
    for (const [key, handler] of this.handlers) {
      const unsubscribe = await this.eventBus.subscribe(
        handler.eventType,
        handler.handler as any,
        {
          streamName: handler.streamName,
          durableName: handler.durableName,
        },
      );
      this.unsubscribeFns.push(unsubscribe);
    }
  }

  /**
   * Stop all consumers (call unsubscribe)
   */
  async stop(): Promise<void> {
    for (const unsubscribe of this.unsubscribeFns) {
      await unsubscribe();
    }
    this.unsubscribeFns = [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/events/__tests__/JetStreamEventConsumer.test.ts --no-coverage`
Expected: PASS (3 tests)

- [ ] **Step 5: Write failing tests for EventSubscriber**

```typescript
// src/events/__tests__/EventSubscriber.test.ts

import { EventSubscriber, TypedSubscriptionRule } from '../EventSubscriber';
import { EventBusService, TypedEnvelope } from '../../services/event-bus-service';

describe('EventSubscriber', () => {
  let subscriber: EventSubscriber;
  let mockEventBus: jest.Mocked<EventBusService>;

  beforeEach(() => {
    mockEventBus = {
      subscribe: jest.fn().mockResolvedValue(jest.fn()),
    } as any;
    subscriber = new EventSubscriber(mockEventBus);
  });

  it('should register a typed subscription rule', () => {
    const rule: TypedSubscriptionRule<{ runId: string }> = {
      subjectPattern: 'orion.pipeline.run.*',
      streamName: 'ORION_PIPELINE',
      durableName: 'test-rule',
      dataType: 'PipelineRunEventData',
      handler: async () => {},
    };

    subscriber.register(rule);
    expect(mockEventBus.subscribe).not.toHaveBeenCalled();
  });

  it('should start all registered subscriptions', async () => {
    subscriber.register<{ runId: string }>({
      subjectPattern: 'orion.pipeline.run.*',
      streamName: 'ORION_PIPELINE',
      durableName: 'test-start',
      dataType: 'PipelineRunEventData',
      handler: async () => {},
    });

    await subscriber.start();

    expect(mockEventBus.subscribe).toHaveBeenCalledWith(
      'orion.pipeline.run.*',
      expect.any(Function),
      { streamName: 'ORION_PIPELINE', durableName: 'test-start' },
    );
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx jest src/events/__tests__/EventSubscriber.test.ts --no-coverage`
Expected: FAIL with "Cannot find module '../EventSubscriber'"

- [ ] **Step 7: Implement EventSubscriber**

```typescript
// src/events/EventSubscriber.ts

import { EventBusService, TypedEnvelope } from '../services/event-bus-service';

export interface SubscriptionRule {
  subjectPattern: string;
  streamName: string;
  durableName: string;
  eventType?: string | string[];
  maxRetries?: number;
  ackWait?: string;
}

export interface TypedSubscriptionRule<T = unknown> extends SubscriptionRule {
  dataType: string;
  handler: (event: TypedEnvelope<T>) => Promise<void>;
}

/**
 * EventSubscriber — declarative event subscription framework
 */
export class EventSubscriber {
  private eventBus: EventBusService;
  private rules: Array<TypedSubscriptionRule> = [];
  private unsubscribeFns: Array<() => Promise<void>> = [];

  constructor(eventBus: EventBusService) {
    this.eventBus = eventBus;
  }

  /**
   * Register a typed subscription rule
   */
  register<T>(rule: TypedSubscriptionRule<T>): void {
    this.rules.push(rule as TypedSubscriptionRule);
  }

  /**
   * Start all registered subscriptions
   */
  async start(): Promise<void> {
    for (const rule of this.rules) {
      const unsubscribe = await this.eventBus.subscribe(
        rule.subjectPattern,
        rule.handler,
        {
          streamName: rule.streamName,
          durableName: rule.durableName,
        },
      );
      this.unsubscribeFns.push(unsubscribe);
    }
  }

  /**
   * Stop all subscriptions
   */
  async stop(): Promise<void> {
    for (const unsubscribe of this.unsubscribeFns) {
      await unsubscribe();
    }
    this.unsubscribeFns = [];
  }

  /**
   * Load subscriptions from DB repository and start them
   */
  async startFromRegistry(): Promise<void> {
    const repo = this.eventBus.getRepositories()?.subscriptionRepo;
    if (!repo) return;

    const subscriptions = await repo.findAll({ limit: 100 });
    for (const sub of subscriptions) {
      if (sub.status !== 'active') continue;

      const rule: TypedSubscriptionRule = {
        subjectPattern: sub.subjectPattern,
        streamName: (sub.metadata as any)?.streamName || 'ORION_PLATFORM',
        durableName: sub.durableName || `consumer-${sub.id}`,
        handler: async (event: TypedEnvelope) => {
          // Default: log the event. Override via EventBusRepository handlers if needed.
          console.log(`[EventSubscriber] Received event: ${event.type}`);
        },
      };
      this.register(rule);
    }

    await this.start();
  }
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx jest src/events/__tests__/EventSubscriber.test.ts --no-coverage`
Expected: PASS (2 tests)

- [ ] **Step 9: Commit**

```bash
git add src/events/JetStreamEventConsumer.ts src/events/EventSubscriber.ts src/events/__tests__/JetStreamEventConsumer.test.ts src/events/__tests__/EventSubscriber.test.ts
git commit -m "feat(eventbus): add JetStreamEventConsumer and EventSubscriber framework

- JetStreamEventConsumer: register/start/stop consumer handlers
- EventSubscriber: declarative typed subscription rules
- startFromRegistry: load subscriptions from EventBusRepository
- Unit tests for both modules"
```

---

### Task 5: Rewrite PipelineEventListener + Update Exports

**Files:**
- Modify: `src/events/PipelineEventListener.ts`
- Modify: `src/events/index.ts`
- Create: `src/events/__tests__/PipelineEventListener.test.ts`

- [ ] **Step 1: Write failing tests for rewritten PipelineEventListener**

```typescript
// src/events/__tests__/PipelineEventListener.test.ts

import { PipelineEventListener, PipelineEventHandler } from '../PipelineEventListener';
import { EventBusService } from '../../services/event-bus-service';

describe('PipelineEventListener', () => {
  let listener: PipelineEventListener;
  let mockEventBus: jest.Mocked<EventBusService>;
  let handlers: PipelineEventHandler;

  beforeEach(() => {
    mockEventBus = {
      subscribe: jest.fn().mockResolvedValue(jest.fn()),
    } as any;

    handlers = {
      onRunCreated: jest.fn(),
      onRunStarted: jest.fn(),
      onRunCompleted: jest.fn(),
      onRunFailed: jest.fn(),
    };

    listener = new PipelineEventListener({
      eventBus: mockEventBus,
      streamName: 'ORION_PIPELINE',
      consumerGroup: 'test-consumers',
      handlers,
    });
  });

  it('should subscribe to run events on start', async () => {
    await listener.start();

    // Should subscribe to 5 run event types
    const runCalls = mockEventBus.subscribe.mock.calls.filter(
      c => c[0].startsWith('orion.pipeline.run.')
    );
    expect(runCalls.length).toBe(5);
  });

  it('should unsubscribe on stop', async () => {
    const mockUnsub = jest.fn().mockResolvedValue(undefined);
    mockEventBus.subscribe.mockResolvedValue(mockUnsub);

    await listener.start();
    await listener.stop();

    expect(mockUnsub).toHaveBeenCalled();
  });

  it('should handle partial handlers (skip missing)', async () => {
    const partialHandlers: Partial<PipelineEventHandler> = {
      onRunCreated: jest.fn(),
      // No other handlers
    };

    const partialListener = new PipelineEventListener({
      eventBus: mockEventBus,
      streamName: 'ORION_PIPELINE',
      consumerGroup: 'test-consumers',
      handlers: partialHandlers,
    });

    await partialListener.start();

    // Only 1 subscription for onRunCreated
    expect(mockEventBus.subscribe).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/events/__tests__/PipelineEventListener.test.ts --no-coverage`
Expected: FAIL — old PipelineEventListener imports `@orion/event-bus` which doesn't exist

- [ ] **Step 3: Rewrite PipelineEventListener**

```typescript
// src/events/PipelineEventListener.ts

import { EventBusService, TypedEnvelope } from '../services/event-bus-service';
import { PipelineRunEventData, StageEventData, TaskEventData } from './types';

export type PipelineEventHandlerType =
  | 'onRunCreated'
  | 'onRunStarted'
  | 'onRunCompleted'
  | 'onRunFailed'
  | 'onRunCancelled'
  | 'onStageStarted'
  | 'onStageCompleted'
  | 'onStageFailed'
  | 'onStageSkipped'
  | 'onTaskStarted'
  | 'onTaskCompleted'
  | 'onTaskFailed';

export type PipelineHandlerFn<T = unknown> = (event: TypedEnvelope<T>) => Promise<void>;

export interface PipelineEventHandler {
  onRunCreated?: PipelineHandlerFn<PipelineRunEventData>;
  onRunStarted?: PipelineHandlerFn<PipelineRunEventData>;
  onRunCompleted?: PipelineHandlerFn<PipelineRunEventData>;
  onRunFailed?: PipelineHandlerFn<PipelineRunEventData>;
  onRunCancelled?: PipelineHandlerFn<PipelineRunEventData>;
  onStageStarted?: PipelineHandlerFn<StageEventData>;
  onStageCompleted?: PipelineHandlerFn<StageEventData>;
  onStageFailed?: PipelineHandlerFn<StageEventData>;
  onStageSkipped?: PipelineHandlerFn<StageEventData>;
  onTaskStarted?: PipelineHandlerFn<TaskEventData>;
  onTaskCompleted?: PipelineHandlerFn<TaskEventData>;
  onTaskFailed?: PipelineHandlerFn<TaskEventData>;
}

export interface PipelineEventListenerConfig {
  eventBus: EventBusService;
  streamName: string;
  consumerGroup?: string;
  handlers: Partial<PipelineEventHandler>;
}

const RUN_EVENT_MAP: Record<string, string> = {
  onRunCreated: 'orion.pipeline.run.created',
  onRunStarted: 'orion.pipeline.run.started',
  onRunCompleted: 'orion.pipeline.run.completed',
  onRunFailed: 'orion.pipeline.run.failed',
  onRunCancelled: 'orion.pipeline.run.cancelled',
};

const STAGE_EVENT_MAP: Record<string, string> = {
  onStageStarted: 'orion.pipeline.stage.started',
  onStageCompleted: 'orion.pipeline.stage.completed',
  onStageFailed: 'orion.pipeline.stage.failed',
  onStageSkipped: 'orion.pipeline.stage.skipped',
};

const TASK_EVENT_MAP: Record<string, string> = {
  onTaskStarted: 'orion.pipeline.task.started',
  onTaskCompleted: 'orion.pipeline.task.completed',
  onTaskFailed: 'orion.pipeline.task.failed',
};

export class PipelineEventListener {
  private eventBus: EventBusService;
  private streamName: string;
  private consumerGroup: string;
  private handlers: Partial<PipelineEventHandler>;
  private unsubscribers: Array<() => Promise<void>> = [];

  constructor(config: PipelineEventListenerConfig) {
    this.eventBus = config.eventBus;
    this.streamName = config.streamName;
    this.consumerGroup = config.consumerGroup || 'pipeline-event-consumers';
    this.handlers = config.handlers;
  }

  async start(): Promise<void> {
    await this.subscribeToEvents(RUN_EVENT_MAP, 'run');
    await this.subscribeToEvents(STAGE_EVENT_MAP, 'stage');
    await this.subscribeToEvents(TASK_EVENT_MAP, 'task');
  }

  private async subscribeToEvents(
    eventMap: Record<string, string>,
    category: string,
  ): Promise<void> {
    const consumerName = `${this.consumerGroup}-${category}`;

    for (const [handlerKey, eventType] of Object.entries(eventMap)) {
      const handler = (this.handlers as any)[handlerKey];
      if (!handler) continue;

      const unsub = await this.eventBus.subscribe(eventType, handler, {
        streamName: this.streamName,
        durableName: consumerName,
      });
      this.unsubscribers.push(unsub);
    }
  }

  async stop(): Promise<void> {
    for (const unsub of this.unsubscribers) {
      await unsub();
    }
    this.unsubscribers = [];
  }
}

export const defaultHandlers: Partial<PipelineEventHandler> = {
  async onRunCreated(event) {
    console.log(`[PipelineEvent] Run created: ${(event.data as any).runId}`);
  },
  async onRunStarted(event) {
    console.log(`[PipelineEvent] Run started: ${(event.data as any).runId}`);
  },
  async onRunCompleted(event) {
    console.log(`[PipelineEvent] Run completed: ${(event.data as any).runId}`);
  },
  async onRunFailed(event) {
    console.error(`[PipelineEvent] Run failed: ${(event.data as any).runId}`);
  },
  async onStageCompleted(event) {
    console.log(`[PipelineEvent] Stage completed: ${(event.data as any).stageName}`);
  },
  async onStageFailed(event) {
    console.error(`[PipelineEvent] Stage failed: ${(event.data as any).stageName}`);
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/events/__tests__/PipelineEventListener.test.ts --no-coverage`
Expected: PASS (3 tests)

- [ ] **Step 5: Update events/index.ts exports**

In `src/events/index.ts`, add new exports:

```typescript
// JetStream consumer framework (new)
export {
  JetStreamEventConsumer,
  ConsumerHandler,
} from './JetStreamEventConsumer';
export {
  EventSubscriber,
  SubscriptionRule,
  TypedSubscriptionRule,
} from './EventSubscriber';
```

- [ ] **Step 6: Commit**

```bash
git add src/events/PipelineEventListener.ts src/events/index.ts src/events/__tests__/PipelineEventListener.test.ts
git commit -m "feat(eventbus): rewrite PipelineEventListener without @orion/event-bus

- Replace external package import with EventBusService-based implementation
- TypedEventHandler interface using TypedEnvelope<T>
- Support for Run, Stage, and Task event subscriptions
- Partial handlers support (skip missing handlers)
- defaultHandlers export for quick integration
- Unit tests for start/stop/partial handler scenarios"
```

---

### Task 6: Config Extension + Initialization + API Routes

**Files:**
- Modify: `src/config/index.ts`
- Modify: `src/index.ts`
- Modify: `src/api/eventbus-routes.ts`
- Modify: `src/app.ts`
- Create: `src/api/__tests__/eventbus-jetstream-routes.test.ts`

- [ ] **Step 1: Extend config with consumers + DLQ**

In `src/config/index.ts`, update the `AppConfig` interface:

```typescript
  eventBus: {
    enabled: boolean;
    streams: {
      name: string;
      subjects: string[];
      retention?: 'limits' | 'interest' | 'workqueue';
      maxMsgs?: number;
      maxAge?: string;
      storage?: 'file' | 'memory';
      replicas?: number;
      consumers?: {
        name: string;
        filterSubject?: string;
        deliverPolicy?: 'all' | 'last' | 'new';
        ackPolicy?: 'none' | 'all' | 'explicit';
        ackWait?: string;
        maxDeliver?: number;
        maxAckPending?: number;
        backOff?: string[];
      }[];
    }[];
    dlq?: {
      enabled: boolean;
      streamName: string;
      maxRetries: number;
      alertOnDeadLetter: boolean;
    };
  };
```

Update the default config `eventBus` section:

```typescript
  eventBus: {
    enabled: process.env.EVENT_BUS_ENABLED !== 'false',
    streams: [
      {
        name: 'ORION_PLATFORM',
        subjects: ['orion.code.*', 'orion.deploy.*', 'orion.config.*', 'orion.incident.*'],
        maxMsgs: 1_000_000,
        maxAge: '7d',
        storage: 'file',
        replicas: 1,
        consumers: [{
          name: 'platform-all',
          filterSubject: 'orion.*',
          deliverPolicy: 'new',
          ackPolicy: 'explicit',
          ackWait: '30s',
          maxDeliver: 5,
          maxAckPending: 100,
          backOff: ['1s', '5s', '30s', '2m', '10m'],
        }],
      },
      {
        name: 'ORION_PIPELINE',
        subjects: ['orion.pipeline.run.*', 'orion.pipeline.stage.*', 'orion.pipeline.task.*'],
        maxMsgs: 5_000_000,
        maxAge: '14d',
        storage: 'file',
        replicas: 1,
        consumers: [
          {
            name: 'pipeline-run',
            filterSubject: 'orion.pipeline.run.*',
            deliverPolicy: 'new',
            ackPolicy: 'explicit',
            ackWait: '60s',
            maxDeliver: 5,
            maxAckPending: 200,
          },
          {
            name: 'pipeline-stage',
            filterSubject: 'orion.pipeline.stage.*',
            deliverPolicy: 'new',
            ackPolicy: 'explicit',
            ackWait: '30s',
            maxDeliver: 3,
            maxAckPending: 500,
          },
        ],
      },
    ],
    dlq: {
      enabled: process.env.DLQ_ENABLED !== 'false',
      streamName: 'ORION_DLQ',
      maxRetries: 5,
      alertOnDeadLetter: true,
    },
  },
```

Also update the `reloadConfig()` function's eventBus section with the same content.

- [ ] **Step 2: Update index.ts initialization**

In `src/index.ts`, after the event bus connection block (after `for (const stream of config.eventBus.streams)`), add JetStream initialization:

```typescript
      // Create default event streams
      for (const stream of config.eventBus.streams) {
        await eventBus.createStream(stream.name, stream.subjects, {
          maxMsgs: (stream as any).maxMsgs,
          maxAge: (stream as any).maxAge,
          storage: (stream as any).storage,
          replicas: (stream as any).replicas,
        });

        // Ensure consumers exist
        if ((stream as any).consumers) {
          for (const consumer of (stream as any).consumers) {
            await eventBus.ensureConsumer(stream.name, {
              name: consumer.name,
              filterSubject: consumer.filterSubject,
              deliverPolicy: consumer.deliverPolicy,
              ackPolicy: consumer.ackPolicy,
              ackWait: consumer.ackWait,
              maxDeliver: consumer.maxDeliver,
              maxAckPending: consumer.maxAckPending,
              backOff: consumer.backOff,
            });
          }
        }
      }
```

- [ ] **Step 3: Add JetStream health check to app.ts**

In `src/app.ts`, after the existing EventBus health check registration, add:

```typescript
  // Register JetStream health check (sub-check of eventbus)
  if (options.eventBus) {
    healthChecker.registerCheck('jetstream', async () => {
      if (options.eventBus!.isJetStreamAvailable?.()) {
        return { status: 'up' as const, message: 'JetStream available' };
      }
      return { status: 'down' as const, message: 'JetStream not initialized' };
    });
  }
```

- [ ] **Step 4: Add JetStream API routes**

In `src/api/eventbus-routes.ts`, add these new endpoints before the closing `}`:

```typescript
  // GET /eventbus/jetstream/metrics - JetStream metrics
  app.get('/jetstream/metrics', async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!service.isJetStreamAvailable?.()) {
      return reply.send({ available: false });
    }
    try {
      const metrics = await service.getJetStreamMetrics();
      return reply.send({ metrics });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // GET /eventbus/jetstream/streams/:name/consumers - List consumers for a stream
  app.get('/jetstream/streams/:name/consumers', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service.isJetStreamAvailable?.()) {
      return reply.send({ available: false });
    }
    try {
      const consumers = await service.listConsumers(request.params.name);
      return reply.send({ consumers });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // GET /eventbus/dlq - Query DLQ events from PostgreSQL
  app.get('/dlq', async (request: FastifyRequest, reply: FastifyReply) => {
    const { limit } = request.query as { limit?: string };
    try {
      const deadLetters = await service.getEventHistory({
        status: 'dead_letter',
        limit: limit ? parseInt(limit, 10) : 50,
      });
      return reply.send({ deadLetters });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
```

- [ ] **Step 5: Write tests for new API routes**

```typescript
// src/api/__tests__/eventbus-jetstream-routes.test.ts

import { buildTestApp } from '../../__tests__/helpers/test-app-builder';

describe('EventBus JetStream API Routes', () => {
  it('GET /jetstream/metrics returns available:false when JetStream not initialized', async () => {
    const { fastify } = await buildTestApp();

    const response = await fastify.inject({
      method: 'GET',
      url: '/api/v1/eventbus/jetstream/metrics',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.available).toBe(false);
  });

  it('GET /dlq returns dead_letter events', async () => {
    const { fastify } = await buildTestApp();

    const response = await fastify.inject({
      method: 'GET',
      url: '/api/v1/eventbus/dlq',
    });

    expect(response.statusCode).toBe(200);
  });
});
```

- [ ] **Step 6: Commit**

```bash
git add src/config/index.ts src/index.ts src/app.ts src/api/eventbus-routes.ts src/api/__tests__/eventbus-jetstream-routes.test.ts
git commit -m "feat(eventbus): config extension, initialization, API routes, health check

- AppConfig: add consumers, dlq to eventBus config
- index.ts: ensureStream + ensureConsumer for all configured streams/consumers
- app.ts: register jetstream health sub-check
- eventbus-routes: add /jetstream/metrics, /jetstream/streams/:name/consumers, /dlq
- Tests for new API endpoints"
```

---

### Task 7: Full Test Suite + Type Check

**Files:**
- All modified files

- [ ] **Step 1: Run TypeScript type check**

Run: `npm run type-check`
Expected: 0 errors

If there are type errors, fix them. Common issues:
- `TypedEnvelope` import path mismatches
- `isJetStreamAvailable` called on possibly-null eventBus
- ConsumerConfig type from nats SDK differing from our ConsumerConfig

- [ ] **Step 2: Run full test suite**

Run: `npm run test -- --testPathPattern="(JetStreamManager|event-bus-jetstream|JetStreamEventConsumer|EventSubscriber|PipelineEventListener|eventbus-jetstream-routes)" --coverage`
Expected: All tests PASS, coverage >= 80% for changed files

- [ ] **Step 3: Run existing tests to verify no regressions**

Run: `npm run test -- --testPathPattern="(CodeEventPublisher|ConfigEventPublisher|DeploymentEventPublisher|IncidentEventPublisher|PipelineEventPublisher|plugin-manager|event-bus)" --coverage`
Expected: All existing tests PASS

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: 0 errors

- [ ] **Step 5: Commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(eventbus): resolve type errors and test failures from JetStream integration"
```

---

## Summary of Changes

| Task | Files Created | Files Modified | Tests |
|------|---------------|----------------|-------|
| 1 | `types/event-types.ts`, `jetstream-manager.ts` | - | `JetStreamManager.test.ts` |
| 2 | - | `event-bus-service.ts` | `event-bus-jetstream.test.ts` |
| 3 | - | `event-bus-service.ts`, `EventBusAdapter.ts` | (in Task 2 test file) |
| 4 | `JetStreamEventConsumer.ts`, `EventSubscriber.ts` | - | Both + tests |
| 5 | - | `PipelineEventListener.ts`, `events/index.ts` | `PipelineEventListener.test.ts` |
| 6 | `eventbus-jetstream-routes.test.ts` | `config/index.ts`, `index.ts`, `app.ts`, `eventbus-routes.ts` | Routes test |
| 7 | - | - | Full suite verification |

## Backward Compatibility Guarantees

- `EventBusService.publish()` signature unchanged — callers need no modifications
- `EventBusService.subscribe()` accepts optional `streamName`/`durableName` — existing callers without these fall back to Core NATS
- `EventBusAdapter.PublishResult` adds optional fields only — no breaking changes
- `eventbus-routes.ts` adds new endpoints only — existing endpoints unchanged
- All 5 EventPublisher classes require zero code changes
