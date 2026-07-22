# NATS JetStream 事件总线使用指南

> 模块：`@orion/event-bus` | 版本：1.0.0 | 基于：NATS 2.10+ JetStream

---

## 目录

- [快速开始](#快速开始)
- [核心概念](#核心概念)
- [API 参考](#api-参考)
- [使用示例](#使用示例)
- [最佳实践](#最佳实践)
- [故障排查](#故障排查)

---

## 快速开始

### 1. 安装依赖

```bash
cd orion-platform-service/packages/event-bus
npm install
```

### 2. 启动 NATS 集群

```bash
cd orion-api-gateway/infra/nats
docker-compose up -d
```

### 3. 基本使用

```typescript
import { EventBus, CloudEventBuilder } from '@orion/event-bus';

// 创建 EventBus 实例
const eventBus = new EventBus({
  servers: ['nats://localhost:4222', 'nats://localhost:4223', 'nats://localhost:4224'],
  reconnect: {
    enabled: true,
    maxRetries: -1,  // 无限重连
    interval: 2000,
  },
  retry: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    multiplier: 2,
  },
});

// 连接
await eventBus.connect();

// 创建事件流
await eventBus.createStream({
  name: 'orion-platform-stream',
  subjects: ['orion.platform.*'],
  replicas: 3,
  storage: 'file',
  retention: 'limits',
});

// 发布事件
const event = new CloudEventBuilder()
  .withType('pipeline.run.created')
  .withSource('orion-platform-service')
  .withData({ pipelineId: '123', name: 'deploy-prod' })
  .withExtensions({
    tenantId: 'tenant-1',
    userId: 'user-1',
    priority: 'high',
  })
  .build();

await eventBus.publish(event);

// 订阅事件
await eventBus.subscribe('pipeline.run.created', (event, context) => {
  console.log('Received event:', event.type, event.data);
  // 处理业务逻辑
});
```

---

## 核心概念

### CloudEvents 1.0 规范

Orion 事件总线遵循 [CloudEvents 1.0](https://cloudevents.io/) 规范，每个事件包含：

| 属性 | 说明 | 示例 |
|------|------|------|
| `specversion` | 规范版本 | `1.0` |
| `id` | 事件唯一 ID | `ts-random123` |
| `type` | 事件类型 | `pipeline.run.created` |
| `source` | 事件源 URI | `orion-platform-service` |
| `time` | 事件时间 | `2026-04-12T10:00:00Z` |
| `data` | 事件数据 | `{ pipelineId: '123' }` |
| `tenantId` | 租户 ID (扩展) | `tenant-1` |
| `priority` | 优先级 (扩展) | `high` |

### 事件等级定义

| 等级 | 投递保证 | 适用场景 |
|------|---------|---------|
| **P0** | At-Least-Once (至少一次) | 支付完成、订单创建、安全告警 |
| **P1** | At-Most-Once (最多一次) | 用户登录日志、UI 操作记录 |
| **P2** | Best-Effort (尽力而为) | 调试信息、临时通知 |

### Stream 分区策略

```
Stream 层级结构：

ORION-PLATFORM (Root)
│
├── TENANT-{id}-P0   (租户 P0 事件，R=3 副本)
├── TENANT-{id}-P1   (租户 P1 事件，R=1 副本)
└── SYSTEM-P0        (系统 P0 事件，R=3 副本)
```

---

## API 参考

### EventBus

#### 构造函数

```typescript
new EventBus(config: EventBusConfig)
```

**配置参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `servers` | `string[]` | ✅ | NATS 服务器 URL 列表 |
| `user` | `string` | ❌ | 用户名认证 |
| `pass` | `string` | ❌ | 密码认证 |
| `token` | `string` | ❌ | Token 认证 |
| `timeout` | `number` | ❌ | 连接超时 (ms)，默认 20000 |
| `reconnect` | `object` | ❌ | 重连配置 |
| `reconnect.enabled` | `boolean` | - | 是否启用重连 |
| `reconnect.maxRetries` | `number` | - | 最大重试次数，-1 为无限 |
| `reconnect.interval` | `number` | - | 重连间隔 (ms) |
| `retry` | `object` | ❌ | 事件重试配置 |
| `logging` | `object` | ❌ | 日志配置 |

#### connect()

```typescript
async connect(): Promise<void>
```

连接到 NATS JetStream 服务器。

#### createStream()

```typescript
async createStream(config: StreamConfig): Promise<void>
```

**参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `name` | `string` | 流名称 |
| `subjects` | `string[]` | 订阅主题列表 |
| `replicas` | `number` | 副本数 (1/3/5)，默认 3 |
| `storage` | `'memory' | 'file'` | 存储类型 |
| `retention` | `'limits' | 'interest' | 'workqueue'` | 保留策略 |
| `maxMsgs` | `number` | 最大消息数 |
| `maxBytes` | `number` | 最大字节数 |
| `maxAge` | `string` | 消息最大年龄 (如 `7d`, `24h`) |

#### publish()

```typescript
async publish<T>(event: CloudEvent<T>): Promise<string>
```

发布事件，返回事件序列号。

#### subscribe()

```typescript
async subscribe<T>(
  eventType: string,
  handler: EventHandler<T>,
  options?: SubscriptionOptions
): Promise<Subscription>
```

**参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `eventType` | `string` | 事件类型 |
| `handler` | `Function` | 事件处理函数 |
| `options.streamName` | `string` | 流名称 |
| `options.durableName` | `string` | 持久订阅名称 |
| `options.autoAck` | `boolean` | 是否自动确认 |
| `options.batchSize` | `number` | 批处理大小 |

**返回值**: `Subscription` 对象，包含 `unsubscribe()` 和 `drain()` 方法。

#### close()

```typescript
async close(): Promise<void>
```

关闭连接，取消所有订阅。

---

### CloudEventBuilder

链式构建器，用于创建 CloudEvent：

```typescript
const event = new CloudEventBuilder()
  .withType('pipeline.run.created')
  .withSource('my-service')
  .withData({ key: 'value' })
  .withSubject('pipeline-123')
  .withExtensions({
    tenantId: 't1',
    userId: 'u1',
    priority: 'high',
  })
  .build();
```

---

## 使用示例

### 示例 1: Pipeline 事件发布

```typescript
// src/events/PipelineEventPublisher.ts
import { EventBus, CloudEventBuilder } from '@orion/event-bus';

export class PipelineEventPublisher {
  constructor(private eventBus: EventBus) {}

  async publishPipelineCreated(pipelineId: string, data: any) {
    const event = new CloudEventBuilder()
      .withType('pipeline.run.created')
      .withSource('pipeline-service')
      .withSubject(`pipeline:${pipelineId}`)
      .withData({ pipelineId, ...data })
      .withExtensions({
        tenantId: data.tenantId,
        priority: 'high',
      })
      .build();

    await this.eventBus.publish(event);
  }

  async publishPipelineCompleted(pipelineId: string, result: any) {
    const event = new CloudEventBuilder()
      .withType('pipeline.run.completed')
      .withSource('pipeline-service')
      .withSubject(`pipeline:${pipelineId}`)
      .withData({ pipelineId, result })
      .build();

    await this.eventBus.publish(event);
  }
}
```

### 示例 2: 事件订阅处理

```typescript
// src/events/PipelineEventListener.ts
import { EventBus, CloudEvent } from '@orion/event-bus';

export class PipelineEventListener {
  constructor(private eventBus: EventBus) {}

  async startListening() {
    // 订阅 Pipeline 创建事件
    await this.eventBus.subscribe(
      'pipeline.run.created',
      async (event, context) => {
        console.log(`[Pipeline] Created: ${event.data.pipelineId}`);
        // 触发 AI Code Review
        await this.triggerAiReview(event.data);
      },
      {
        streamName: 'orion-platform-stream',
        durableName: 'pipeline-listener-created',
        autoAck: false, // 手动确认
      }
    );

    // 订阅 Pipeline 完成事件
    await this.eventBus.subscribe(
      'pipeline.run.completed',
      async (event, context) => {
        console.log(`[Pipeline] Completed: ${event.data.pipelineId}`);
        // 计算效能指标
        await this.calculateMetrics(event.data);
      },
      {
        streamName: 'orion-platform-stream',
        durableName: 'pipeline-listener-completed',
      }
    );
  }

  private async triggerAiReview(data: any) {
    // AI Code Review 逻辑
  }

  private async calculateMetrics(data: any) {
    // 效能指标计算
  }
}
```

### 示例 3: 多租户事件过滤

```typescript
// 按租户过滤订阅
const tenantId = 'tenant-123';

await eventBus.subscribe(
  'pipeline.run.created',
  async (event) => {
    // 只处理当前租户的事件
    if (event.tenantId === tenantId) {
      console.log('Processing tenant event:', event.data);
    }
  },
  {
    streamName: `TENANT-${tenantId}-P0`,
    durableName: `tenant-${tenantId}-listener`,
    filterSubject: `pipeline.run.created.${tenantId}`,
  }
);
```

### 示例 4: 死信队列处理

```typescript
import { DeadLetterQueue } from '@orion/event-bus';

// 查询死信队列
const dlq = eventBus.getDeadLetterQueue();
const failedEvents = await dlq.getEvents({
  limit: 100,
  offset: 0,
  eventType: 'pipeline.run.created',
});

// 重试死信事件
for (const failed of failedEvents) {
  try {
    await eventBus.publish(failed.event);
    await dlq.ack(failed.id);
    console.log('Retried DLQ event:', failed.event.id);
  } catch (error) {
    console.error('Retry failed:', error);
  }
}
```

---

## 最佳实践

### 1. 事件命名规范

```typescript
// 推荐：<domain>.<entity>.<action>
'pipeline.run.created'
'pipeline.stage.completed'
'deployment.rolled_back'
'incident.detected'

// 避免
'created'           // 太模糊
'pipelineCreated'   // 不符合规范
```

### 2. 合理设置副本数

```typescript
// P0 关键事件 - 3 副本
await eventBus.createStream({
  name: 'critical-stream',
  subjects: ['pipeline.run.*'],
  replicas: 3,
  storage: 'file',
});

// P1 普通事件 - 1 副本
await eventBus.createStream({
  name: 'normal-stream',
  subjects: ['user.login.*'],
  replicas: 1,
  storage: 'memory',
});
```

### 3. 幂等性处理

```typescript
const processedEvents = new Set<string>();

await eventBus.subscribe('pipeline.run.completed', async (event) => {
  // 检查是否已处理
  if (processedEvents.has(event.id)) {
    console.log('Event already processed:', event.id);
    return;
  }

  // 处理事件
  await handleEvent(event);

  // 标记已处理
  processedEvents.add(event.id);
});
```

### 4. 优雅关闭

```typescript
process.on('SIGTERM', async () => {
  console.log('Shutting down...');

  // 停止接收新事件
  await subscription.drain();

  // 等待正在处理的事件完成
  await sleep(5000);

  // 关闭连接
  await eventBus.close();

  process.exit(0);
});
```

---

## 故障排查

### 问题 1: 连接失败

```bash
# 检查 NATS 服务状态
docker ps | grep nats

# 查看 NATS 日志
docker logs nats-server-1

# 测试连接
nats sub '>' --server nats://localhost:4222
```

### 问题 2: 事件未投递

```typescript
// 启用调试日志
const eventBus = new EventBus({
  ...
  logging: {
    level: 'debug',
    logger: (level, msg, ...args) => {
      console.log(`[${level}] ${msg}`, args);
    },
  },
});

// 检查死信队列
const dlq = eventBus.getDeadLetterQueue();
const failed = await dlq.getEvents({ limit: 10 });
console.log('Failed events:', failed);
```

### 问题 3: 性能问题

```bash
# 监控 NATS 指标
curl http://localhost:8222/varz
curl http://localhost:8222/connz

# 检查 Stream 状态
nats stream info orion-platform-stream
```

---

## 相关文档

- [NATS 高可用方案设计](../../docs/event-bus/NATS 高可用方案设计.md)
- [CloudEvents 1.0 规范](https://cloudevents.io/)
- [NATS JetStream 文档](https://docs.nats.io/nats-concepts/jetstream)

---

**最后更新**: 2026-04-12 | **维护团队**: Orion Platform Team
