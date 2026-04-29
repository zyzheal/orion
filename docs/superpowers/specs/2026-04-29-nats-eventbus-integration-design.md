# NATS EventBus 真实集成设计文档

> 日期: 2026-04-29
> 状态: 设计阶段
> 优先级: P0
> 关联问题: P0 Review #16 (NATS Real Message Bus)
> 关联迁移: M24 (EventBus Persistence), M25 (Repository Migration)

## 1. 问题陈述

### 1.1 现状

当前 `EventBusService`（`src/services/event-bus-service.ts`）虽然具备 NATS 连接能力，但实际使用的是 **Core NATS** 的 `publish/subscribe` 模式，**未启用 JetStream**。这意味着：

1. **无持久化消息保证** — 发布消息后无 ack，消费者离线时消息丢失
2. **无 Dead Letter Queue** — 处理失败的消息仅被 `nak()`，无上限重试
3. **无 Consumer 管理** — 订阅使用基本 `queue` 组，无 durable consumer、无 replay 能力
4. **无 Schema 验证** — 事件payload无结构化校验，依赖运行时类型安全
5. **EventBusAdapter 返回结构不一致** — `PublishResult` 中 `success: true` 但 `fallback: true` 时实际未投递

现有 5 个 EventPublisher（Pipeline/Code/Deployment/Config/Incident）全部通过 `EventBusAdapter` 发布，但：
- 无统一的订阅端（消费者），事件发布后无下游响应
- `PipelineEventListener` 引用了不存在的 `@orion/event-bus` 包，无法运行

### 1.2 影响范围

| 组件 | 当前状态 | 需改动 |
|------|----------|--------|
| `EventBusService` | Core NATS publish/subscribe + 降级模式 | 升级 JetStream |
| `EventBusAdapter` | 封装层，无 JetStream 语义 | 增强 |
| 5 个 EventPublisher | 发布正常但无投递保证 | 无改动 |
| `PipelineEventListener` | 引用不存在的包 | 重写 |
| `NatsServiceRegistry` | 使用 Core NATS publish | 可选增强 |
| `eventbus-routes.ts` | 状态查询 API | 新增 JetStream 指标 |
| DB Migration 054/055b | 已有表结构 | 无需改动 |
| Config `eventBus.streams` | 仅 1 个流 | 扩展 |

### 1.3 根因

设计时预留了 JetStream 接口（`createStream()` 方法已存在），但未完整实现 JetStream 的 Streams/Consumers/DLQ 架构。

## 2. 架构决策

### 2.1 决策

**在现有 `EventBusService` 基础上升级 JetStream 集成，保持向后兼容**

### 2.2 理由

1. 已有 700+ 行的 `EventBusService` 包含完善的连接管理、降级、重试逻辑
2. PostgreSQL 持久化层（M24）已就绪，与 JetStream 互补（本地记录 vs 消息总线保证）
3. 5 个 EventPublisher + EventBusAdapter 已形成稳定发布接口
4. 最小化改动量，不破坏现有调用方

### 2.3 替代方案排除

- **方案 A（新建 JetStreamService）**: 重复现有连接管理逻辑，增加维护负担
- **方案 B（完全替换为第三方 SDK）**: 丧失已有的降级/重试/持久化逻辑

### 2.4 架构决策记录

| 编号 | 决策 | 理由 |
|------|------|------|
| NJ-001 | 使用 JetStream Pull Consumer 而非 Push Consumer | Pull 模式提供背压控制、更好的错误处理 |
| NJ-002 | 每个事件域使用独立 Stream | 隔离性、独立保留策略 |
| NJ-003 | DLQ 使用独立 Stream（非 MaxDeliver 内嵌） | 可见性、独立监控、可手动重试 |
| NJ-004 | 保留 PostgreSQL 双写 | 审计日志、离线查询、NATS 不可用时的缓冲 |
| NJ-005 | `publish()` 使用 JetStream `publish()` 而非 Core NATS | 获得 ack 保证 |

## 3. 设计规范

### 3.1 JetStream 架构

```
┌──────────────────────────────────────────────────────────────┐
│                    NATS Server (JetStream)                    │
│                                                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────┐ │
│  │ orion-platform  │  │ orion-pipeline  │  │  orion-dlq    │ │
│  │     Stream      │  │     Stream      │  │    Stream     │ │
│  │                 │  │                 │  │               │ │
│  │ Subjects:       │  │ Subjects:       │  │ Subjects:     │ │
│  │ orion.code.>    │  │ orion.pipeline.>│  │ *.dlq.>       │ │
│  │ orion.deploy.>  │  │                 │  │               │ │
│  │ orion.config.>  │  │ Consumers:      │  │ Consumers:    │ │
│  │ orion.incident.>│  │ pipeline-run    │  │ dlq-replay    │ │
│  │                 │  │ pipeline-stage  │  │               │ │
│  │ Consumers:      │  │ pipeline-task   │  │ MaxDeliver: ∞ │ │
│  │ platform-all    │  └─────────────────┘  └───────────────┘ │
│  └─────────────────┘                                          │
└──────────────────────────────────────────────────────────────┘

┌──────────────┐     publish (JetStream ack)     ┌──────────────┐
│ EventPublisher│ ──────────────────────────────► │ EventBusSvc  │
│ (5 instances) │                                  │              │
└──────────────┘                                  └──────┬───────┘
                                                         │
                                          ┌──────────────┴──────────────┐
                                          │  PostgreSQL (dual-write)    │
                                          │  event_bus_events table     │
                                          └─────────────────────────────┘
```

### 3.2 Stream 定义

```typescript
// Stream 配置常量
export const ORION_STREAMS = {
  PLATFORM: {
    name: 'ORION_PLATFORM',
    subjects: [
      'orion.code.*',       // PR events
      'orion.deploy.*',     // Deployment events
      'orion.config.*',     // Config drift events
      'orion.incident.*',   // Incident events
    ],
    retention: 'limits',
    maxMsgs: 1_000_000,
    maxAge: '7d',
    storage: 'file',
    replicas: 1,
  },
  PIPELINE: {
    name: 'ORION_PIPELINE',
    subjects: [
      'orion.pipeline.run.*',
      'orion.pipeline.stage.*',
      'orion.pipeline.task.*',
    ],
    retention: 'limits',
    maxMsgs: 5_000_000,
    maxAge: '14d',
    storage: 'file',
    replicas: 1,
  },
  DLQ: {
    name: 'ORION_DLQ',
    subjects: ['*.dlq.>'],
    retention: 'limits',
    maxMsgs: 500_000,
    maxAge: '30d',
    storage: 'file',
    replicas: 1,
  },
} as const;
```

### 3.3 Subject 命名规范

```
orion.{domain}.{entity}.{action}

示例:
  orion.pipeline.run.created
  orion.pipeline.run.completed
  orion.pipeline.stage.failed
  orion.code.pr.opened
  orion.deploy.started
  orion.config.drift.detected
  orion.incident.escalated

DLQ 转发:
  orion.pipeline.run.created.dlq.handler-failure
  orion.incident.escalated.dlq.max-retries
```

### 3.4 TypedEnvelope 模式

```typescript
/**
 * 统一事件信封 — 所有事件发布/消费都经过此类型
 * 提供编译期类型安全和运行时 schema 标识
 */
export interface TypedEnvelope<T = unknown> {
  /** CloudEvents 标准字段 */
  id: string;           // 事件唯一 ID (UUID)
  source: string;       // 事件源 (e.g., "pipeline-service")
  specversion: '1.0';   // CloudEvents 版本
  type: string;         // 事件类型 (e.g., "orion.pipeline.run.created")
  datacontenttype: 'application/json';
  data: T;              // 事件数据 (强类型)
  time: string;         // ISO 8601 时间戳

  /** Orion 扩展字段 */
  tenantid?: string;
  userid?: string;
  traceid?: string;
  correlationid?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';

  /** JetStream 元数据 (消费时注入) */
  _jsmeta?: {
    stream: string;
    consumer: string;
    sequence: number;
    delivered: number;
    timestamp: number;
    pending: number;
  };
}
```

### 3.5 Consumer 定义

```typescript
// Durable Consumer 配置
export const ORION_CONSUMERS = {
  // 平台级全量消费组 (广播所有平台事件)
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
  // Pipeline Run 消费组
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
  // Pipeline Stage 消费组
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

### 3.6 DLQ 策略

```
消息处理失败流程:

Consumer Handler Error
        │
        ▼
    msg.nak() ──┐
        │       │
        ▼       │ (redelivery, up to maxDeliver)
    Retry ──────┘
        │
        ▼ (maxDeliver exceeded)
    JetStream 自动转发到 DLQ Stream
    Subject: {original_subject}.dlq.{error_type}
        │
        ▼
    DLQ Consumer (低吞吐、手动确认)
        │
        ├── 记录到 PostgreSQL (dead_letter 状态)
        ├── 发送告警 (SRE 通知)
        └── 支持手动 replay (API 触发)
```

DLQ 自动转发配置:
```typescript
// 在 Stream 配置中设置
{
  name: 'ORION_PLATFORM',
  subjects: ['orion.code.*', 'orion.deploy.*', ...],
  // JetStream 不自动转 DLQ，需手动配置 Consumer 的 maxDeliver
  // 超过 maxDeliver 后消息不再 redeliver，需额外 DLQ 机制
}
```

DLQ 实现方案（使用 JetStream 的 `deadLetter` 功能需要 NATS 2.11+，当前使用 nats@2.17.0 已支持）:

```typescript
// Consumer 配置中设置 deadLetter
{
  name: 'platform-all',
  maxDeliver: 5,
  backOff: ['1s', '5s', '30s', '2m', '10m'],  // 指数退避
  // 注意: nats@2.17.0 的 TypeScript 类型可能不包含 deadLetter
  // 需要通过 JetStreamManager 的底层 API 设置
}
```

## 4. 代码设计

### 4.1 文件结构

```
src/
  events/
    EventBusAdapter.ts          # 已存在，增强 JetStream 语义
    PipelineEventPublisher.ts   # 无需改动
    CodeEventPublisher.ts       # 无需改动
    DeploymentEventPublisher.ts # 无需改动
    ConfigEventPublisher.ts     # 无需改动
    IncidentEventPublisher.ts   # 无需改动
    types/                      # 已存在，无需改动
    JetStreamConsumer.ts        # 【新增】JetStream 消费者管理
    EventSubscriber.ts          # 【新增】统一事件订阅框架
    PipelineEventListener.ts    # 【重写】替换旧的 @orion/event-bus 引用

  services/
    event-bus-service.ts        # 【改造】升级为 JetStream
    jetstream-manager.ts        # 【新增】JetStream 流/消费者管理

  repositories/
    EventBusRepository.ts       # 已存在，无需改动

  api/
    eventbus-routes.ts          # 【增强】添加 JetStream 指标 API
```

### 4.2 EventBusService 改造

**核心变更**: 将 `publish()` 和 `subscribe()` 从 Core NATS 升级为 JetStream。

```typescript
// src/services/event-bus-service.ts (改造要点)

export class EventBusService extends EventEmitter {
  // 现有字段保留...
  private jetStream?: JetStreamClient;      // 【新增】JetStream 客户端
  private jetStreamManager?: JetStreamManager; // 【新增】流管理器

  async connect(): Promise<void> {
    // ... 现有连接逻辑保留 ...

    // 【新增】初始化 JetStream
    if (this.natsConnection) {
      this.jetStream = this.natsConnection.jetstream();
      this.jetStreamManager = this.natsConnection.jetstreamManager();
    }
  }

  // 【改造】publish 使用 JetStream publish (获得 ack)
  async publish<T = any>(
    type: string,
    data: T,
    options?: PublishOptions,
  ): Promise<string> {
    // 1. PostgreSQL 持久化 (保留现有逻辑)
    // 2. JetStream publish (替换 Core NATS publish)
    // 3. 根据 ack 结果更新状态
  }

  // 【改造】subscribe 使用 JetStream Pull Consumer
  async subscribe<T = any>(
    eventType: string,
    handler: (event: TypedEnvelope<T>) => Promise<void>,
    options?: SubscribeOptions,
  ): Promise<() => Promise<void>> {
    // 1. 获取或创建 Durable Consumer
    // 2. 启动 Pull Consumer 循环
    // 3. 处理消息 + ack/nak
    // 4. 返回取消订阅函数
  }

  // 【新增】创建 JetStream Stream
  async ensureStream(config: StreamConfig): Promise<void> {
    if (!this.jetStreamManager) return;
    // 检查流是否存在，不存在则创建
  }

  // 【新增】创建 Durable Consumer
  async ensureConsumer(streamName: string, config: ConsumerConfig): Promise<void> {
    if (!this.jetStreamManager) return;
    // 检查消费者是否存在，不存在则创建
  }

  // 【新增】获取 JetStream 指标
  async getJetStreamMetrics(): Promise<JetStreamMetrics> {
    // 返回 streams/consumers/msg counts 等
  }
}
```

**Publish 改造对比**:

```typescript
// 改造前 (Core NATS — 无投递保证)
await this.natsConnection.publish(subject, new TextEncoder().encode(message));

// 改造后 (JetStream — 有 ack 保证)
const ack = await this.jetStream.publish(subject, new TextEncoder().encode(message));
// ack.seq 确认消息已持久化到 JetStream
```

**Subscribe 改造对比**:

```typescript
// 改造前 (Core NATS subscription — 无持久化、无 ack)
const subscription = this.natsConnection.subscribe(subject, { queue });
for await (const msg of subscription) {
  // ...
  msg.ack();  // Core NATS 的 ack 仅告知 server 已接收
}

// 改造后 (JetStream Pull Consumer — 显式 ack、持久化、可 replay)
const consumer = await this.jetStream.consumers.get(streamName, durableName);
const messages = await consumer.fetch({ maxMessages: 100, expiresMs: 30000 });
for await (const msg of messages) {
  try {
    await handler(typedEnvelope);
    msg.ack();  // JetStream ack 确认消息已处理
  } catch (err) {
    msg.nak();  // JetStream nak 触发 redelivery
  }
}
```

### 4.3 JetStreamManager 服务

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

export class JetStreamManagerService {
  private jsm: JetStreamManager;

  constructor(jsm: JetStreamManager) {
    this.jsm = jsm;
  }

  async ensureStream(def: StreamDefinition): Promise<void> {
    // 检查流是否存在
    try {
      await this.jsm.streams.info(def.name);
      // 已存在，跳过
    } catch {
      // 不存在，创建
      const config: Partial<StreamConfig> = {
        name: def.name,
        subjects: def.subjects,
        retention: def.retention === 'interest' ? 1 : def.retention === 'workqueue' ? 2 : 0,
        max_msgs: def.maxMsgs,
        max_age: def.maxAge ? nanoseconds(def.maxAge) : 0,
        storage: def.storage === 'memory' ? 0 : 1,
        replicas: def.replicas || 1,
      };
      await this.jsm.streams.add(config);
    }

    // 创建消费者
    for (const consumer of (def.consumers || [])) {
      await this.ensureConsumer(def.name, consumer);
    }
  }

  async ensureConsumer(streamName: string, def: ConsumerDefinition): Promise<void> {
    try {
      await this.jsm.consumers.info(streamName, def.name);
      // 已存在，跳过
    } catch {
      // 创建消费者
      await this.jsm.consumers.add(streamName, {
        durable_name: def.name,
        filter_subject: def.filterSubject,
        deliver_policy: def.deliverPolicy || 'new',
        ack_policy: def.ackPolicy || 'explicit',
        ack_wait: def.ackWait ? nanoseconds(def.ackWait) : 0,
        max_deliver: def.maxDeliver || 5,
        max_ack_pending: def.maxAckPending || 100,
        backoff: (def.backOff || []).map(b => nanoseconds(b)),
        replay_policy: def.replayPolicy || 'instant',
      });
    }
  }

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
}

// 辅助函数: 时间字符串转纳秒 (JetStream API 需要)
function nanoseconds(duration: string): number {
  // 解析 "30s" -> 30_000_000_000
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
```

### 4.4 JetStreamConsumer — 消费者管理

```typescript
// src/events/JetStreamConsumer.ts

import { EventBusService, TypedEnvelope } from '../services/event-bus-service';

export interface ConsumerHandler<T = unknown> {
  streamName: string;
  durableName: string;
  eventType: string;
  handler: (event: TypedEnvelope<T>) => Promise<void>;
  maxRetries?: number;
}

export class JetStreamEventConsumer {
  private eventBus: EventBusService;
  private handlers: Map<string, ConsumerHandler> = new Map();
  private unsubscribeFns: Array<() => Promise<void>> = [];

  constructor(eventBus: EventBusService) {
    this.eventBus = eventBus;
  }

  /**
   * 注册事件处理器
   */
  register<T = unknown>(handler: ConsumerHandler<T>): void {
    const key = `${handler.streamName}:${handler.durableName}`;
    this.handlers.set(key, handler);
  }

  /**
   * 启动所有注册的消费者
   */
  async start(): Promise<void> {
    for (const [key, handler] of this.handlers) {
      const unsubscribe = await this.eventBus.subscribe(
        handler.eventType,
        handler.handler,
        {
          streamName: handler.streamName,
          durableName: handler.durableName,
        },
      );
      this.unsubscribeFns.push(unsubscribe);
    }
  }

  /**
   * 停止所有消费者
   */
  async stop(): Promise<void> {
    for (const unsubscribe of this.unsubscribeFns) {
      await unsubscribe();
    }
    this.unsubscribeFns = [];
  }
}
```

### 4.5 EventSubscriber — 统一订阅框架

```typescript
// src/events/EventSubscriber.ts

/**
 * 统一事件订阅框架
 * 提供声明式事件订阅，支持多消费者组、过滤、重试
 */

import { TypedEnvelope } from '../services/event-bus-service';

export interface SubscriptionRule {
  /** 订阅的 subject 模式 */
  subjectPattern: string;
  /** 对应的 JetStream 流 */
  streamName: string;
  /** Durable consumer 名称 */
  durableName: string;
  /** 事件类型过滤器 (可选，细化 subjectPattern) */
  eventType?: string | string[];
  /** 最大重试次数 (覆盖 Stream 默认值) */
  maxRetries?: number;
  /** 处理超时 (ackWait) */
  ackWait?: string;
}

export interface TypedSubscriptionRule<T = unknown> extends SubscriptionRule {
  /** 数据类型标识 (用于 schema 验证) */
  dataType: string;
  /** 处理器 */
  handler: (event: TypedEnvelope<T>) => Promise<void>;
}

export class EventSubscriber {
  /**
   * 从配置注册表启动所有订阅
   * 配置表来源: event_subscriptions PostgreSQL 表
   */
  async startFromRegistry(): Promise<void> {
    // 1. 从 EventBusRepository 读取 active 订阅
    // 2. 为每个订阅创建 Consumer
    // 3. 启动消息循环
  }

  /**
   * 声明式注册订阅
   */
  register<T>(rule: TypedSubscriptionRule<T>): void {
    // 注册到内存表，start() 时统一初始化
  }

  /**
   * 启动所有已注册的订阅
   */
  async start(): Promise<void> {
    // 批量初始化 Consumers + 启动拉取循环
  }
}
```

### 4.6 PipelineEventListener 重写

```typescript
// src/events/PipelineEventListener.ts (重写)

import { EventBusService, TypedEnvelope } from '../services/event-bus-service';
import { PipelineRunEventData } from './types';

export interface PipelineEventListenerConfig {
  eventBus: EventBusService;
  streamName: string;
  consumerGroup: string;
}

export class PipelineEventListener {
  private eventBus: EventBusService;
  private streamName: string;
  private consumerGroup: string;
  private unsubscribers: Array<() => Promise<void>> = [];

  constructor(config: PipelineEventListenerConfig) {
    this.eventBus = config.eventBus;
    this.streamName = config.streamName;
    this.consumerGroup = config.consumerGroup;
  }

  async start(): Promise<void> {
    // Pipeline Run 事件
    this.unsubscribers.push(await this.eventBus.subscribe<PipelineRunEventData>(
      'orion.pipeline.run.created',
      async (event: TypedEnvelope<PipelineRunEventData>) => {
        // 处理逻辑
      },
      { streamName: this.streamName, durableName: `${this.consumerGroup}-run` },
    ));

    // Stage 事件、Task 事件同理...
  }

  async stop(): Promise<void> {
    for (const unsub of this.unsubscribers) {
      await unsub();
    }
    this.unsubscribers = [];
  }
}
```

### 4.7 EventBusAdapter 增强

```typescript
// src/events/EventBusAdapter.ts (增强要点)

// 新增字段
interface PublishResult {
  success: boolean;
  eventId?: string;
  /** 【新增】区分 fallback (本地持久化) 和 jetstream-acked (JetStream 确认) */
  deliveryMode: 'jetstream' | 'fallback' | 'disabled';
  /** 【新增】JetStream 确认序列号 */
  jetStreamSeq?: number;
  error?: string;
}

// publish 方法改造
async publish(...): Promise<PublishResult> {
  // 如果 JetStream 可用
  if (this.eventBus?.isJetStreamAvailable()) {
    const ack = await this.eventBus.publishJetStream(...);
    return { success: true, eventId: ack.id, deliveryMode: 'jetstream', jetStreamSeq: ack.seq };
  }
  // Fallback 逻辑保留
}
```

### 4.8 初始化流程改造

```typescript
// src/index.ts (改造要点)

// 3. 初始化事件总线
if (config.eventBus.enabled) {
  eventBus = new EventBusService({ ... });
  await eventBus.connect();

  // 【新增】使用 JetStreamManager 确保所有流和消费者存在
  const jsm = eventBus.getJetStreamManager();
  if (jsm) {
    const jsmService = new JetStreamManagerService(jsm);

    // 创建/验证所有 Stream 和 Consumer
    for (const stream of config.eventBus.streams) {
      await jsmService.ensureStream({
        name: stream.name,
        subjects: stream.subjects,
        ...stream.options,
        consumers: stream.consumers,  // 【新增】consumer 定义
      });
    }
  }

  // 创建默认事件流 (保留现有逻辑)
  for (const stream of config.eventBus.streams) {
    await eventBus.createStream(stream.name, stream.subjects);
  }

  // 【新增】启动 EventSubscriber
  const subscriber = new EventSubscriber(eventBus);
  await subscriber.startFromRegistry();
}
```

### 4.9 配置扩展

```typescript
// src/config/index.ts (扩展)

export interface AppConfig {
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
    // 【新增】DLQ 配置
    dlq?: {
      enabled: boolean;
      streamName: string;
      maxRetries: number;
      alertOnDeadLetter: boolean;
    };
  };
}

// 默认配置扩展
const defaultConfig = {
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
};
```

### 4.10 API 路由增强

```typescript
// src/api/eventbus-routes.ts (新增端点)

// GET /eventbus/jetstream/metrics - JetStream 指标
app.get('/jetstream/metrics', async (_request, reply) => {
  const metrics = await service.getJetStreamMetrics();
  return reply.send({ metrics });
});

// GET /eventbus/jetstream/streams/:name/info - Stream 详情
app.get('/jetstream/streams/:name/info', async (request, reply) => {
  const info = await service.getStreamInfo(request.params.name);
  return reply.send({ info });
});

// GET /eventbus/jetstream/streams/:name/consumers - Stream 下所有消费者
app.get('/jetstream/streams/:name/consumers', async (request, reply) => {
  const consumers = await service.listConsumers(request.params.name);
  return reply.send({ consumers });
});

// POST /eventbus/dlq/replay - 手动重放 DLQ 消息
app.post('/dlq/replay', async (request, reply) => {
  const { eventId, targetSubject } = request.body as { eventId: string; targetSubject: string };
  const result = await service.replayDeadLetter(eventId, targetSubject);
  return reply.send({ result });
});

// GET /eventbus/dlq - 查询 DLQ 消息
app.get('/dlq', async (request, reply) => {
  const { limit } = request.query as { limit?: string };
  const deadLetters = await service.getDeadLetters({ limit: parseInt(limit || '50', 10) });
  return reply.send({ deadLetters });
});
```

## 5. 数据库 Schema

### 5.1 现有表结构 (无需改动)

Migration 054 已创建以下表，满足需求：

| 表名 | 用途 | 关键字段 |
|------|------|----------|
| `event_bus_config` | NATS 连接配置 | config_key, config_value |
| `event_subscriptions` | 订阅注册表 | subject_pattern, durable_name, queue_group |
| `event_bus_events` | 事件历史 | event_type, subject, status, retry_count |

### 5.2 status 枚举值 (已覆盖)

Migration 055b 已添加 `pending_published` 状态，当前支持：

| Status | 含义 |
|--------|------|
| `published` | 已发布（旧状态，保留兼容） |
| `pending_fallback` | NATS 不可用，等待重试 |
| `pending_published` | 已写入 DB，等待 NATS 投递 |
| `delivered` | JetStream ack 确认投递 |
| `failed` | 发布失败（不可恢复） |
| `dead_letter` | 超过最大重试次数 |

**无需新增 migration**。

## 6. 集成方案

### 6.1 与现有 EventPublisher 的集成

5 个 EventPublisher **无需任何代码改动**。它们通过 `EventBusAdapter` 调用 `EventBusService.publish()`，该方法在内部自动切换为 JetStream 模式。

```
PipelineEventPublisher.publishRunCreated()
  → EventBusAdapter.publish('pipeline.run.created', data, options)
    → EventBusService.publish('pipeline.run.created', data, { source, tenantId, ... })
      → [内部] PostgreSQL INSERT (status='pending_published')
      → [内部] JetStream.publish('orion.pipeline.run.created', payload)
      → [内部] 收到 ack → UPDATE status='delivered'
```

### 6.2 与 NatsServiceRegistry 的集成

`NatsServiceRegistry` 当前使用 Core NATS publish 进行服务注册/心跳。可选升级：

- **短期**: 保持 Core NATS publish（服务注册消息允许丢失）
- **长期**: 迁移到 JetStream，确保服务注册事件不丢失

本次设计**不改动** NatsServiceRegistry。

### 6.3 与 Saga 系统的集成

当前 `DeploySaga` 和 `SelfHealingSaga` 使用内存 Map 跟踪状态。可通过订阅 JetStream 事件实现：

```typescript
// Saga 监听 Pipeline 事件自动触发下一步
eventBus.subscribe('orion.pipeline.run.completed', async (event) => {
  const sagaState = sagaTracker.get(event.data.runId);
  if (sagaState?.nextStep === 'deploy') {
    await deployService.trigger(sagaState.deploymentId);
  }
});
```

本次设计**提供基础设施**，Saga 集成作为后续任务。

## 7. 实施计划

### Phase 1: JetStream 核心升级 (3-5 天)

| 步骤 | 文件 | 改动 |
|------|------|------|
| 1.1 | `src/services/event-bus-service.ts` | 添加 JetStream client 初始化，改造 `publish()` 使用 JetStream ack |
| 1.2 | `src/services/event-bus-service.ts` | 改造 `subscribe()` 使用 JetStream Pull Consumer |
| 1.3 | `src/services/jetstream-manager.ts` | 【新建】Stream/Consumer 生命周期管理 |
| 1.4 | `src/services/event-bus-service.ts` | 添加 `ensureStream()` 和 `ensureConsumer()` |
| 1.5 | `src/events/EventBusAdapter.ts` | 增强 `PublishResult` 添加 `deliveryMode` 字段 |

**验收标准**:
- `npm run test` 全绿
- `npm run test:coverage` EventBusService coverage >= 85%
- 手动验证: 发布消息后 NATS JetStream 中可见

### Phase 2: Consumer 框架 + DLQ (2-3 天)

| 步骤 | 文件 | 改动 |
|------|------|------|
| 2.1 | `src/events/JetStreamConsumer.ts` | 【新建】消费者管理 |
| 2.2 | `src/events/EventSubscriber.ts` | 【新建】声明式订阅框架 |
| 2.3 | `src/events/PipelineEventListener.ts` | 【重写】移除 `@orion/event-bus` 引用 |
| 2.4 | `src/services/event-bus-service.ts` | 添加 DLQ 转发逻辑 |

**验收标准**:
- PipelineEventListener 可正常启动/停止
- 模拟 handler 失败，验证 nak + redelivery
- 超过 maxDeliver 后消息进入 dead_letter 状态

### Phase 3: 初始化 + API + 配置 (2 天)

| 步骤 | 文件 | 改动 |
|------|------|------|
| 3.1 | `src/index.ts` | 启动时初始化 JetStream Streams/Consumers |
| 3.2 | `src/config/index.ts` | 扩展 eventBus 配置 (consumers, dlq) |
| 3.3 | `src/api/eventbus-routes.ts` | 新增 JetStream metrics / DLQ API |
| 3.4 | `src/app.ts` | 健康检查增加 JetStream 状态 |

**验收标准**:
- 服务启动时自动创建所有 Stream 和 Consumer
- `/api/v1/eventbus/jetstream/metrics` 返回有效数据
- `/api/v1/eventbus/dlq` 返回 DLQ 消息列表

### Phase 4: 集成测试 + 文档 (1-2 天)

| 步骤 | 改动 |
|------|------|
| 4.1 | 编写 JetStream 集成测试 (使用 nats-server-test 容器) |
| 4.2 | 更新 EventBusService 单元测试 |
| 4.3 | 编写事件发布/消费端到端测试 |

**验收标准**:
- 集成测试覆盖率 >= 80%
- 无 TypeScript 编译错误
- `npm run type-check` 通过

## 8. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| NATS 服务不可用时 JetStream 初始化失败 | 服务启动延迟 | 保持 fallback 模式，不阻塞启动 |
| JetStream publish 超时 | 事件丢失 | PostgreSQL 双写保底，retryPendingEvents 补偿 |
| Consumer 处理慢导致消息堆积 | 延迟增大 | maxAckPending 限制 + 监控告警 |
| DLQ 消息积压 | 运维负担 | 定期清理策略 + 告警通知 |
| nats@2.17.0 类型与 JetStream API 不完全匹配 | 编译错误 | 使用 `as any` 绕过不兼容类型，提交 PR 给 nats.deno |

## 9. 监控与可观测性

### 9.1 Prometheus 指标

```
# JetStream 相关
nats_jetstream_publish_total{stream, subject}
nats_jetstream_publish_ack_latency_ms{stream}
nats_jetstream_consumer_delivery_total{stream, consumer}
nats_jetstream_consumer_nak_total{stream, consumer}
nats_jetstream_consumer_redelivery_total{stream, consumer}
nats_jetstream_dead_letter_total{stream, consumer}

# 现有指标 (保持不变)
eventbus_publish_success_total
eventbus_publish_failed_total
eventbus_subscribe_success_total
eventbus_subscribe_failed_total
```

### 9.2 告警规则

```yaml
# JetStream publish ack 延迟 > 500ms
- alert: JetStreamPublishHighLatency
  expr: histogram_quantile(0.99, nats_jetstream_publish_ack_latency_ms) > 500
  for: 5m

# DLQ 消息数量 > 10
- alert: DeadLetterQueueGrowing
  expr: nats_jetstream_dead_letter_total > 10
  for: 10m

# Consumer 消息堆积 (pending > maxAckPending * 0.8)
- alert: ConsumerMessageBacklog
  expr: nats_jetstream_consumer_pending > 80
  for: 5m
```

## 10. 向后兼容性

| 改动 | 兼容性 | 说明 |
|------|--------|------|
| `EventBusService.publish()` 签名 | 向后兼容 | 参数不变，内部切换 JetStream |
| `EventBusService.subscribe()` 签名 | 向后兼容 | `options.streamName` 和 `options.durableName` 变为必填 |
| `EventBusAdapter.PublishResult` | 向后兼容 | 新增 `deliveryMode` 和 `jetStreamSeq` 字段 |
| `eventbus-routes.ts` | 向后兼容 | 仅新增端点，原有端点不变 |
| PostgreSQL 表结构 | 无需改动 | 现有字段已覆盖所有需求 |
| Config 格式 | 向后兼容 | 新增 `consumers` 和 `dlq` 为可选 |

## 11. 关键文件路径

| 文件 | 类型 | 说明 |
|------|------|------|
| `/Users/heal/orion-design/orion-platform-service/src/services/event-bus-service.ts` | 改造 | 核心 EventBus 服务，升级为 JetStream |
| `/Users/heal/orion-design/orion-platform-service/src/services/jetstream-manager.ts` | 新建 | JetStream 流/消费者生命周期管理 |
| `/Users/heal/orion-design/orion-platform-service/src/events/EventBusAdapter.ts` | 增强 | 增强 PublishResult |
| `/Users/heal/orion-design/orion-platform-service/src/events/JetStreamConsumer.ts` | 新建 | 消费者管理框架 |
| `/Users/heal/orion-design/orion-platform-service/src/events/EventSubscriber.ts` | 新建 | 声明式订阅框架 |
| `/Users/heal/orion-design/orion-platform-service/src/events/PipelineEventListener.ts` | 重写 | 修复 @orion/event-bus 引用 |
| `/Users/heal/orion-design/orion-platform-service/src/config/index.ts` | 扩展 | 添加 consumers/DLQ 配置 |
| `/Users/heal/orion-design/orion-platform-service/src/api/eventbus-routes.ts` | 增强 | 添加 JetStream/DLQ API |
| `/Users/heal/orion-design/orion-platform-service/src/index.ts` | 改造 | 初始化流程增加 JetStream |
| `/Users/heal/orion-design/orion-platform-service/src/repositories/EventBusRepository.ts` | 无需改动 | 已有的 PostgreSQL 持久化层 |
| `/Users/heal/orion-design/orion-platform-service/src/db/migrations/054_create_event_bus_tables.sql` | 无需改动 | 已有的表结构 |
