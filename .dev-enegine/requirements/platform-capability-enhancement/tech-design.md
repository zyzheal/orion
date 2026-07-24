# 平台能力提升 - 技术方案

## 1. 现状分析

### 1.1 已有基础设施

| 能力 | 已有实现 | 位置 | 状态 |
|------|---------|------|------|
| 通用熔断器 | `CircuitBreaker` (3状态) + `RateLimiter` | `src/utils/rate-limit-circuit-breaker.ts` | 基础实现，未集成到业务服务 |
| AI熔断器 | `ProviderCircuitBreaker` + `CircuitBreakerManager` (双层熔断) | `src/services/ai/` | 仅 AI Gateway 专用 |
| Redis 缓存 | `RedisCache` (get/set/del/hset/lpush/pubsub) | `src/services/redis-cache.ts` | 功能完备 |
| 缓存服务 | `CacheService` (cache-aside 模式) | `src/services/cache/CacheService.ts` | 基础实现，无多级缓存 |
| 缓存监控 | `CacheMonitorService` | `src/services/cache-monitor/` | 仅构建缓存监控 |
| 事件总线 | `EventBusService` + `EventBusRepository` (PostgreSQL) | `src/services/event-bus/` | 简单订阅/发布 |
| NATS JetStream | `NatsConnectionManager` + `JetStreamEventConsumer` + 事件发布器 | `src/events/` | 基础设施已部署 |
| 数据库故障切换 | `DatabaseFailoverHandler` | `src/services/database/` | MySQL 主从延迟降级 |
| 备份恢复 | `BackupService` + `RecoveryService` + `BackupVerifier` | `src/services/backup/` | 基础功能实现 |
| Pipeline 引擎 | `PipelineEngine` + `StageExecutor` + 完整 pipeline 服务 | `src/services/pipeline/` | 功能完备 |

### 1.2 能力缺口

| 缺口 | 影响 | 优先级 |
|------|------|--------|
| 通用熔断器未服务化 | 业务服务调用外部依赖无保护 | P0 |
| 无任务队列/消息队列 | 异步任务依赖内存，无持久化/重试/死信 | P1 |
| 无多级缓存策略 | 无防穿透/击穿/雪崩能力 | P1 |
| CI/CD 无熔断/缓存 | Pipeline 外部调用无保护，无构建缓存加速 | P2 |
| 容灾设计不完整 | 无统一容灾引擎、无演练自动化 | P2 |

## 2. 技术选型与架构设计

### 2.1 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Fastify API Gateway                     │
├─────────────────────────────────────────────────────────────┤
│                      Circuit Breaker Middleware              │
│              (新增：通用服务级熔断拦截器)                      │
├─────────────────────────────────────────────────────────────┤
│  Service Layer                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ PipelineSvc  │ │  TenantSvc   │ │  ConfigSvc   │ ...    │
│  │ + CircuitBrk │ │ + CircuitBrk │ │ + CircuitBrk │        │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘        │
│         │                │                │                 │
│  ┌──────▼────────────────▼────────────────▼───────┐         │
│  │          Circuit Breaker Service (新增)          │         │
│  │  - 通用熔断器池（按依赖目标分组）                  │         │
│  │  - 状态管理（CLOSED/OPEN/HALF_OPEN）             │         │
│  │  - 指标采集 + 事件通知                           │         │
│  └──────────────┬──────────────────────────────────┘         │
│                 │                                             │
│  ┌──────────────▼──────────────────────────────────┐         │
│  │          Message Queue Service (新增)             │         │
│  │  - 任务队列（Redis-backed 持久化）                │         │
│  │  - 延迟队列 / 死信队列 / 消费者组                 │         │
│  │  - 消费确认/重试/幂等                            │         │
│  └──────────────┬──────────────────────────────────┘         │
│                 │                                             │
│  ┌──────────────▼──────────────────────────────────┐         │
│  │          Cache Strategy Service (增强)            │         │
│  │  - L1 (内存) + L2 (Redis) 多级缓存               │         │
│  │  - 防穿透(空值缓存)/防击穿(互斥锁)/防雪崩(随机TTL) │        │
│  │  - 缓存预热 / 失效策略 / 一致性                    │         │
│  └──────────────┬──────────────────────────────────┘         │
│                 │                                             │
│  ┌──────────────▼──────────────────────────────────┐         │
│  │          Disaster Recovery Service (增强)         │         │
│  │  - 统一容灾策略引擎                               │         │
│  │  - RTO/RPO 监控 + 自动演练                       │         │
│  │  - 容灾报告生成                                   │         │
│  └──────────────┬──────────────────────────────────┘         │
├─────────────────┼───────────────────────────────────────────┤
│  Data Layer     │                                             │
│  ┌──────────────▼──┐  ┌──────────┐  ┌──────────────────┐    │
│  │ PostgreSQL      │  │ Redis    │  │ NATS JetStream   │    │
│  │ (业务数据)       │  │ (缓存/MQ) │  │ (事件总线)        │    │
│  └─────────────────┘  └──────────┘  └──────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 通用熔断器设计

**设计决策**：复用 `src/utils/rate-limit-circuit-breaker.ts` 中的 `CircuitBreaker` 类作为基础，在其之上构建 `CircuitBreakerService` 服务层。

```
CircuitBreakerService
├── CircuitBreakerRegistry (按依赖目标注册熔断器)
│   ├── key: "github:api" → CircuitBreaker
│   ├── key: "docker:registry" → CircuitBreaker
│   └── key: "slack:notify" → CircuitBreaker
├── CircuitBreakerMiddleware (Fastify preHandler 拦截)
├── CircuitBreakerMonitor (状态查询 + 指标导出)
└── CircuitBreakerEvents (状态变更事件 → NATS)
```

**关键设计点**：
- 熔断器实例按**依赖目标**（而非服务）注册，例如 `github:api`、`docker:registry`
- 支持配置热更新（通过 `UnifiedConfigService`）
- 与现有 `ProviderCircuitBreaker` 共享状态机逻辑，但通用化
- 通过 Fastify decorator 注入到所有路由处理中

### 2.3 消息队列设计

**设计决策**：基于现有 Redis 基础设施 + `PipelineExecutionQueue` 经验，构建通用 `MessageQueueService`。

```
MessageQueueService
├── TaskQueue (普通任务队列)
│   ├── enqueue(task) → Redis LPUSH + PostgreSQL 持久化
│   ├── dequeue() → Redis RPOP + ACK 机制
│   └── retry(task, backoff) → 指数退避重试
├── DelayQueue (延迟队列)
│   ├── schedule(task, delayMs) → Redis ZADD (score = 执行时间)
│   └── poll() → 定时扫描 ZRANGEBYSCORE
├── DeadLetterQueue (死信队列)
│   ├── moveToDLQ(task, reason) → 超限任务移入 DLQ
│   └── replay(taskId) → 死信任务重新入队
├── ConsumerGroup (消费者组)
│   ├── register(consumerId, handler) → 注册消费者
│   └── dispatch() → 轮询分发 + 消费确认
└── EventBridge (与 NATS JetStream 集成)
    └── publishEvent(event) → NATS + Redis 双写
```

### 2.4 缓存策略设计

**设计决策**：增强现有 `CacheService`，在其之上构建 `CacheStrategyService`。

```
CacheStrategyService
├── MultiLevelCache
│   ├── L1: In-Memory (Map + TTL) → 本地热点数据
│   ├── L2: Redis (existing RedisCache) → 分布式缓存
│   └── 读取策略: L1 → L2 → DB (cache-aside)
├── AntiPenetration (防穿透)
│   └── 空值缓存: DB 查询结果为 null 时缓存短 TTL 空标记
├── AntiBreakdown (防击穿)
│   └── 互斥锁: 同一 key 仅一个请求加载，其余等待
├── AntiAvalanche (防雪崩)
│   └── 随机 TTL: 基础 TTL ± 随机偏移
├── CacheWarming (预热)
│   └── 启动时预加载关键数据到 L1/L2
└── Consistency (一致性)
    └── Write-through / Write-behind 策略
```

### 2.5 CI/CD 增强设计

**设计决策**：在现有 Pipeline 服务中集成熔断器和缓存策略。

```
PipelineEnhancements
├── PipelineCircuitBreaker
│   └── 外部调用（SCM、镜像仓库、通知服务）通过熔断器
├── PipelineCache
│   └── Pipeline 模板/配置/参数缓存加速
├── PipelineEventOrchestration
│   └── 跨 Pipeline 事件驱动编排（基于 MessageQueue）
└── PipelineDisasterAware
    └── Pipeline 执行感知容灾状态（降级模式跳过非关键步骤）
```

### 2.6 容灾设计完善

**设计决策**：在现有 `DatabaseFailoverHandler` + `RecoveryService` + `BackupService` 基础上构建统一的 `DisasterRecoveryService`。

```
DisasterRecoveryService
├── DRPolicyEngine (容灾策略引擎)
│   ├── 评估各组件容灾能力（DB、Redis、NATS、文件系统）
│   └── 计算整体 RTO/RPO
├── DrillOrchestrator (演练编排器)
│   ├── 定期自动执行容灾演练
│   ├── 验证备份可恢复性
│   └── 生成演练报告
├── RTOTracking (RTO/RPO 监控)
│   ├── 实时跟踪 RTO/RPO 达标率
│   └── 超标告警
└── DRAwareness (容灾感知)
    └── 平台各服务感知容灾状态，自动降级
```

## 3. 数据模型变更

### 3.1 新增表

| 表名 | 说明 | 关键字段 |
|------|------|---------|
| `circuit_breaker_configs` | 熔断器配置 | id, target_key, failure_threshold, recovery_timeout_ms, state, created_at |
| `circuit_breaker_events` | 熔断器事件日志 | id, target_key, event_type, old_state, new_state, created_at |
| `message_queue_tasks` | 消息队列表 | id, queue_name, payload, status, retry_count, max_retries, scheduled_at, dlq_reason |
| `message_queue_consumers` | 消费者注册表 | id, consumer_group, consumer_id, handler_url, status |
| `drill_executions` | 容灾演练执行记录 | id, drill_type, status, rto_actual_ms, rpo_actual_ms, started_at, completed_at |
| `cache_warmup_configs` | 缓存预热配置 | id, cache_key_pattern, source_type, schedule, enabled |

### 3.2 迁移文件

- `0208_circuit_breaker_tables.sql`
- `0209_message_queue_tables.sql`
- `0210_drill_tables.sql`
- `0211_cache_warmup_tables.sql`

## 4. API 设计

### 4.1 熔断器 API

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/v1/circuit-breakers` | 列出所有熔断器 |
| GET | `/api/v1/circuit-breakers/:targetKey` | 获取指定熔断器状态 |
| POST | `/api/v1/circuit-breakers/:targetKey/reset` | 手动重置熔断器 |
| POST | `/api/v1/circuit-breakers/:targetKey/trip` | 手动触发熔断 |
| PUT | `/api/v1/circuit-breakers/:targetKey/config` | 更新熔断器配置 |
| GET | `/api/v1/circuit-breakers/stats` | 获取熔断器统计 |

### 4.2 消息队列 API

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/v1/message-queue/enqueue` | 入队任务 |
| POST | `/api/v1/message-queue/dequeue` | 消费任务 |
| POST | `/api/v1/message-queue/:taskId/ack` | 确认消费 |
| POST | `/api/v1/message-queue/:taskId/retry` | 重试任务 |
| POST | `/api/v1/message-queue/schedule` | 延迟入队 |
| GET | `/api/v1/message-queue/dead-letter` | 查看死信队列 |
| POST | `/api/v1/message-queue/dead-letter/:taskId/replay` | 死信重放 |
| GET | `/api/v1/message-queue/stats` | 队列统计 |

### 4.3 缓存管理 API

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/v1/cache/stats` | 缓存统计 |
| POST | `/api/v1/cache/warmup` | 触发缓存预热 |
| POST | `/api/v1/cache/invalidate` | 批量失效缓存 |
| GET | `/api/v1/cache/health` | 缓存健康检查 |

### 4.4 容灾管理 API

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/v1/disaster-recovery/status` | 容灾状态 |
| GET | `/api/v1/disaster-recovery/rto-rpo` | RTO/RPO 统计 |
| POST | `/api/v1/disaster-recovery/drill` | 触发容灾演练 |
| GET | `/api/v1/disaster-recovery/drills` | 演练历史 |
| GET | `/api/v1/disaster-recovery/report` | 容灾报告 |

## 5. 前端页面变更

### 5.1 新增页面

| 页面 | 路由 | 说明 |
|------|------|------|
| CircuitBreakerDashboard | `/circuit-breaker` | 熔断器状态面板 |
| MessageQueueDashboard | `/message-queue` | 消息队列监控面板 |
| DisasterRecoveryDashboard | `/disaster-recovery` | 容灾管理面板 |

### 5.2 增强页面

| 页面 | 变更 | 说明 |
|------|------|------|
| PipelineList | 增加熔断器状态列 | 显示 Pipeline 外部依赖的熔断状态 |
| CacheMonitor | 增加多级缓存统计 | 显示 L1/L2 命中率、穿透/击穿事件 |
| BackupManagement | 增加容灾演练入口 | 触发/查看容灾演练 |

## 6. 风险点和注意事项

1. **熔断器误判风险**：需要合理配置失败阈值，避免短暂网络抖动导致大规模熔断。建议初始配置：失败率 30%、连续 5 次失败、恢复超时 60s。

2. **消息队列持久化性能**：Redis + PostgreSQL 双写可能影响入队性能。建议使用 Redis 为主存储，PostgreSQL 异步落盘。

3. **缓存一致性**：多级缓存需要处理一致性问题。写操作建议 Write-through（同步写 L1+L2），或 Write-behind（异步写 L2）。

4. **容灾演练影响**：自动容灾演练可能影响生产数据。建议演练在隔离环境或使用影子数据。

5. **向后兼容**：所有新增 API 使用 `/api/v1/` 前缀，不影响现有 API。熔断器默认处于 CLOSED 状态，不影响现有服务调用。

6. **测试策略**：每个服务需要编写单元测试 + 集成测试。熔断器测试需模拟各种故障场景。消息队列测试需验证幂等性和重试逻辑。
