# NATS JetStream 事件总线部署指南

> 版本：1.0.0 | 创建日期：2026-04-11 | 状态：已完成

---

## 一、快速开始

### 1.1 启动 NATS 集群

```bash
# 进入部署目录
cd orion-api-gateway/infra/nats

# 启动 3 节点集群
docker-compose up -d

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f nats-1
```

### 1.2 验证集群状态

```bash
# 连接到 NATS 服务器
docker exec -it nats-server-1 nats sub '>' --count 5

# 在另一个终端发布测试消息
docker exec -it nats-server-1 nats pub test "Hello World"
```

### 1.3 访问监控界面

- NATS Server 1: http://localhost:8222
- NATS Server 2: http://localhost:8223
- NATS Server 3: http://localhost:8224
- Prometheus Exporter: http://localhost:7777/metrics

---

## 二、配置说明

### 2.1 集群配置

| 参数 | 值 | 说明 |
|------|-----|------|
| 节点数 | 3 | 支持高可用 |
| 副本数 (R) | 3 | 数据冗余 |
| 故障切换 | < 15 秒 | 自动故障恢复 |
| 最大连接 | 10,000 | 并发连接数 |
| 最大负载 | 8MB | 单消息最大大小 |

### 2.2 存储配置

| 参数 | 值 | 说明 |
|------|-----|------|
| 最大内存存储 | 4GB | JetStream 内存限制 |
| 最大文件存储 | 100GB | JetStream 文件限制 |
| 存储目录 | /data/jetstream | 持久化路径 |

### 2.3 认证配置

| 用户 | 密码 | 权限 |
|------|------|------|
| admin | admin_secure_password_2026 | 发布/订阅所有主题 |
| service | service_secure_password_2026 | 发布/订阅 orion.> 主题 |
| readonly | readonly_secure_password_2026 | 仅订阅 |

**注意**: 生产环境请修改默认密码！

---

## 三、Event Bus SDK 使用

### 3.1 安装依赖

```bash
cd orion-platform-service/packages/event-bus
npm install
npm run build
```

### 3.2 基本使用

```typescript
import { EventBus, CloudEvent, EventPublisher, EventSubscriber } from '@orion/event-bus';

// 创建 EventBus 实例
const eventBus = new EventBus({
  servers: ['nats://localhost:4222', 'nats://localhost:4223', 'nats://localhost:4224'],
  user: 'service',
  pass: 'service_secure_password_2026',
  reconnect: {
    enabled: true,
    maxRetries: -1, // 无限重连
    interval: 2000,
  },
  logging: {
    level: 'info',
  },
});

// 连接
await eventBus.connect();

// 创建流
await eventBus.createStream({
  name: 'orion-pipeline-stream',
  subjects: ['pipeline.*'],
  replicas: 3,
  storage: 'file',
  retention: 'limits',
  maxAge: '720h', // 30 天
});

// 发布事件
const publisher = new EventPublisher(eventBus.jsClient!, 'orion-platform');

await publisher.publishPipelineEvent('created', {
  pipelineId: 'pipeline-001',
  name: 'Build and Deploy',
  createdAt: new Date().toISOString(),
}, {
  extensions: {
    tenantId: 'tenant-001',
    userId: 'user-123',
    traceId: 'trace-abc',
    priority: 'normal',
  },
});

// 订阅事件
const subscriber = new EventSubscriber(eventBus.jsClient!, publisher);

await subscriber.subscribe('pipeline.run.created', async (event, context) => {
  console.log('Received event:', event);
  console.log('Event data:', event.data);
  console.log('Context:', context);
  
  // 处理业务逻辑
  // ...
});

// 关闭连接
await eventBus.close();
```

### 3.3 完整示例

```typescript
// src/examples/pipeline-events.ts
import { EventBus, CloudEventBuilder } from '../index';

async function main() {
  const eventBus = new EventBus({
    servers: ['nats://localhost:4222'],
    user: 'service',
    pass: 'service_secure_password_2026',
  });

  try {
    await eventBus.connect();
    console.log('Connected to NATS JetStream');

    // 创建流
    await eventBus.createStream({
      name: 'orion-pipeline-stream',
      subjects: ['pipeline.*'],
      replicas: 3,
      storage: 'file',
    });

    // 发布事件
    const event = new CloudEventBuilder({
      type: 'pipeline.run.started',
      source: 'pipeline-service',
      data: {
        pipelineId: 'pipeline-001',
        runId: 'run-12345',
        stages: ['build', 'test', 'deploy'],
      },
      extensions: {
        tenantId: 'tenant-001',
        traceId: 'trace-abc-123',
      },
    }).build();

    await eventBus.publish(event);
    console.log('Event published:', event.id);

    // 订阅事件
    await eventBus.subscribe('pipeline.*', async (event, context) => {
      console.log('Event received:', {
        id: event.id,
        type: event.type,
        data: event.data,
      });
    });

    // 保持运行
    console.log('Listening for events... Press Ctrl+C to exit');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await eventBus.close();
  }
}

main();
```

---

## 四、可靠性配置

### 4.1 ACK 确认

```typescript
// 显式 ACK
await subscriber.subscribe('pipeline.run.created', async (event, context) => {
  try {
    // 处理事件
    await processEvent(event);
    // 自动 ACK（如果 autoAck: true）
  } catch (error) {
    // 触发重试或发送到 DLQ
    throw error;
  }
}, {
  autoAck: false, // 手动 ACK
  maxAckPending: 100,
});
```

### 4.2 重试配置

```typescript
const eventBus = new EventBus({
  servers: ['nats://localhost:4222'],
  retry: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    multiplier: 2, // 指数退避
  },
});
```

### 4.3 死信队列

```typescript
// DLQ 自动处理
// 当消息重试 3 次后自动发送到死信队列
await eventBus.subscribe('pipeline.run.failed', async (event, context) => {
  // 可能失败的处理逻辑
}, {
  durableName: 'pipeline-failed-processor',
});

// 订阅 DLQ 进行人工处理
await eventBus.deadLetterQueue?.subscribe(async (entry) => {
  console.log('DLQ entry:', {
    eventId: entry.event.id,
    error: entry.error,
    retryCount: entry.retryCount,
  });
  // 人工处理逻辑
});
```

---

## 五、监控与告警

### 5.1 Prometheus 指标

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'nats'
    static_configs:
      - targets: ['nats-exporter:7777']
```

### 5.2 关键指标

- `nats_conn_total`: 连接总数
- `nats_sub_total`: 订阅总数
- `nats_js_api_total`: JetStream API 调用
- `nats_js_consumer_pending`: 消费者待处理消息

### 5.3 Grafana 看板

导入 NATS 官方 Dashboard:
- ID: 10466
- URL: https://grafana.com/grafana/dashboards/10466

---

## 六、故障排查

### 6.1 连接问题

```bash
# 检查 NATS 服务状态
docker-compose ps

# 查看日志
docker-compose logs nats-1

# 测试连接
nats sub '>' --server nats://localhost:4222 --count 1
```

### 6.2 集群问题

```bash
# 查看集群状态
docker exec -it nats-server-1 nats server info

# 查看节点信息
docker exec -it nats-server-1 nats server info nats://nats-2:6222
```

### 6.3 JetStream 问题

```bash
# 查看流信息
docker exec -it nats-server-1 nats stream info orion-pipeline-stream

# 查看消费者
docker exec -it nats-server-1 nats consumer ls orion-pipeline-stream

# 查看消费者详情
docker exec -it nats-server-1 nats consumer info orion-pipeline-stream orion-sub-pipeline
```

---

## 七、性能优化

### 7.1 批量处理

```typescript
await subscriber.subscribe('pipeline.*', async (events) => {
  // 批量处理
  await processBatch(events);
}, {
  batchSize: 50,
  maxAckPending: 500,
});
```

### 7.2 流式处理

```typescript
// 使用异步迭代器
const consumer = await jsClient.consumers.get('orion-pipeline-stream', {
  durable_name: 'stream-processor',
});

for await (const message of await consumer.consume()) {
  await processMessage(message);
  message.ack();
}
```

---

## 八、生产部署建议

### 8.1 资源限制

```yaml
# docker-compose.yml
deploy:
  resources:
    limits:
      cpus: '4'
      memory: 4G
    reservations:
      cpus: '2'
      memory: 2G
```

### 8.2 持久化

```yaml
volumes:
  nats-data-1:
    driver: local
    name: nats-data-1
```

### 8.3 健康检查

```yaml
healthcheck:
  test: ["CMD", "nats-server", "-sl", "ldm=/var/run/nats/nats.pid"]
  interval: 10s
  timeout: 5s
  retries: 3
```

---

_文档维护：Orion 平台团队 | 最后更新：2026-04-11_
