# S14 队列管理模块设计文档 (Queue Management)

> **模块代号**: S14 — Queue Management
> **技术栈**: Node.js + TypeScript + Fastify + PostgreSQL
> **实现状态**: 已完成 (PostgreSQL Repository 模式 + 内存降级)
> **前端页面**: `orion-frontend/src/pages/Queue/index.tsx`

---

## 1. 模块概述

队列管理模块(S14)为 Orion 平台提供通用的异步任务队列能力, 用于解耦耗时操作、削峰填谷、以及跨服务的任务调度。该模块以 PostgreSQL 为持久化存储, 支持:

- **命名队列**: 通过 `queue_name` 字段区分不同业务队列, 无需为每种任务类型单独建表
- **优先级调度**: 四级优先级(CRITICAL > HIGH > NORMAL > LOW), 同优先级内按 FIFO 顺序出队
- **租户隔离**: 每个 Job 关联 `tenant_id`, 支持按租户范围过滤和出队
- **自动重试**: 失败任务基于指数退避算法(Exponential Backoff + Jitter)自动调度重试
- **内存降级**: 数据库不可用时自动降级到内存存储, 保证基础可用性

### 1.1 与其他队列方案的关系

Orion 平台存在多个队列实现:

| 队列实现 | 位置 | 用途 | 与 S14 关系 |
|---------|------|------|------------|
| S14 QueueManagement | `services/queue/` | 通用异步任务队列 | 本文档描述的本模块 |
| PipelineExecutionQueue | `services/pipeline/` | Pipeline 执行专用队列 | 可考虑迁移到 S14 统一模型 |
| DispatchQueueManager | `services/ticketing/` | 工单分派队列 | 独立于 S14 |
| EventBus (NATS JetStream) | `packages/event-bus/` | 事件驱动消息总线 | 未来 S14 可作为事件消费者的 Job 源 |

---

## 2. 架构设计

### 2.1 分层架构

```
┌─────────────────────────────────────────────────────┐
│                   API Routes (Fastify)               │
│  orion-platform-service/src/api/queue-routes.ts      │
│  POST /api/v1/queue/:queueName/jobs                  │
│  POST /api/v1/queue/:queueName/dequeue               │
│  POST /api/v1/queue/jobs/:id/complete                │
│  POST /api/v1/queue/jobs/:id/fail                    │
│  POST /api/v1/queue/jobs/:id/retry                   │
│  GET  /api/v1/queue/jobs                             │
│  GET  /api/v1/queue/jobs/:id                         │
│  GET  /api/v1/queue/stats                            │
└──────────────────────────┬──────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────┐
│                QueueController                       │
│  orion-platform-service/src/api/controllers/        │
│                    QueueController.ts                │
│  - 参数校验 (tenantId, payload 必填)                  │
│  - 错误分类映射 (400/404/500)                        │
│  - 响应体标准化                                       │
└──────────────────────────┬──────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────┐
│                  QueueService                        │
│  orion-platform-service/src/services/queue/          │
│                    QueueService.ts                   │
│  - enqueue: 创建 Job, 生成 UUID, 设置默认值           │
│  - dequeue: 按优先级+时间获取下一个 pending Job       │
│  - completeJob: 标记完成, 记录结果和时间               │
│  - failJob: 标记失败, 判断是否需要重试                 │
│  - cancelJob: 取消 pending 状态的 Job                │
│  - requeue: 重置 failed Job 为 pending               │
│  - getQueueStats: 聚合统计 + 平均耗时计算              │
│  - 内存降级: 数据库不可用时使用 Map 存储               │
└──────────────────────────┬──────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────┐
│              JobRepository (接口)                     │
│  orion-platform-service/src/repositories/            │
│                    JobRepository.ts                  │
│  - PostgresJobRepository: PostgreSQL 实现            │
│  - create / findById / findByTenant / findPending    │
│  - findByStatus / update / delete / getStats         │
│  - FOR UPDATE SKIP LOCKED 防止并发争用               │
└──────────────────────────┬──────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────┐
│                  PostgreSQL (queue_jobs 表)          │
│  Migration: 148_create_queue_jobs_table.sql          │
│  复合索引: (status, priority DESC, created_at ASC)   │
│  WHERE status = 'pending' 的部分索引                   │
└─────────────────────────────────────────────────────┘
```

### 2.2 数据流

```
外部系统 / 前端
      │
      ▼  POST /api/v1/queue/pipeline-execution/jobs
  ┌────────────┐     ┌───────────────┐     ┌──────────────┐     ┌─────────────────────┐
  │ Fastify    │ ──▶ │ Controller   │ ──▶ │ QueueService │ ──▶ │ PostgresJobRepository│
  │ Router     │     │ (校验/映射)   │     │ (业务逻辑)    │     │ (SQL 操作)          │
  └────────────┘     └───────────────┘     └──────────────┘     └──────────┬──────────┘
                                                                            │
                                                                            ▼
                                                                    ┌──────────────┐
                                                                    │  queue_jobs  │
                                                                    │  (PostgreSQL)│
                                                                    └──────────────┘
```

---

## 3. 队列命名与多队列支持

### 3.1 命名约定

队列通过 `queue_name` 字段(类型 `VARCHAR(128)`, 默认值 `'default'`)标识。系统不预定义固定队列列表, 任何字符串均可作为队列名, 实现了逻辑上的多队列隔离。

### 3.2 预定义队列 (前端推荐值)

前端页面 `orion-frontend/src/pages/Queue/index.tsx` 中预置了以下推荐队列选项:

| 队列名称 | 用途 | 示例 Payload |
|---------|------|-------------|
| `pipeline-execution` | Pipeline 构建/执行任务 | `{ pipelineId: "pipe-101", action: "build" }` |
| `deployment` | 应用部署任务 | `{ appId: "orion-core", env: "staging" }` |
| `notification` | 通知发送任务 | `{ type: "email", to: "user@example.com" }` |
| `artifact-scan` | 制品扫描任务 | `{ artifactId: "scan-001", scanner: "trivy" }` |

### 3.3 队列隔离机制

- **逻辑隔离**: 所有队列共享同一张 `queue_jobs` 表, 通过 `queue_name` 字段区分
- **Dequeue 隔离**: `dequeue(queueName, limit)` 方法通过 SQL `WHERE queue = $1` 精确出队
- **索引支持**: `idx_queue_jobs_queue_name (queue_name, status)` 加速按队列名过滤

> **注意**: 当前 `QueueService.dequeue()` 方法未使用 `queueName` 参数进行过滤, 而是全局获取所有 pending Job。这是一个已知的设计不一致点, Controller 层的 `pop(queueName, limit)` 调用了 `dequeue()` 但未传递队列名到 Repository 层。

---

## 4. Job 生命周期

### 4.1 状态机

```
                    ┌─────────────┐
                    │   PENDING   │ ◀──────┐
                    └──────┬──────┘        │
                           │ dequeue()     │ requeue()
                           ▼               │
                    ┌─────────────┐        │
                    │   RUNNING   │        │
                    └──────┬──────┘        │
                           │               │
                  ┌────────┴────────┐      │
                  ▼                 ▼      │
           ┌─────────────┐   ┌─────────────┐
           │  COMPLETED  │   │   FAILED    │ ──┤ (自动判断是否重试)
           └─────────────┘   └──────┬──────┘
                                    │
                           ┌────────┴────────┐
                           ▼                 ▼
                    (attempts < max)   (attempts >= max)
                    设置 nextRetryAt   终态, 不再重试
```

### 4.2 状态转换详细说明

| 转换 | 触发方法 | 条件 | 副作用 |
|------|---------|------|--------|
| `PENDING → RUNNING` | `dequeue()` | 无 | `startedAt = NOW()`, `attempts++` |
| `RUNNING → COMPLETED` | `completeJob(id, result)` | 无 | `completedAt = NOW()`, `result` 写入 |
| `RUNNING → FAILED` | `failJob(id, error)` | 无 | 根据 `attempts < maxAttempts` 决定是否设置 `nextRetryAt` |
| `PENDING → CANCELLED` | `cancelJob(id)` | `status === 'pending'` | `completedAt = NOW()` |
| `FAILED → PENDING` | `requeue(id)` | 无 | 清除 `errorMessage`, `nextRetryAt`, 保留 `attempts` |

### 4.3 重试机制

当 `failJob()` 被调用时:

1. 检查 `attempts < maxAttempts` (默认 3 次)
2. 若仍有重试机会, 计算退避时间: `baseMs * 2^attempt + jitter`
   - 基准延迟: 1000ms
   - Jitter: +/- 20% 随机偏移, 防止重试风暴
   - 第 1 次重试: ~1000ms (800-1200ms)
   - 第 2 次重试: ~2000ms (1600-2400ms)
   - 第 3 次重试: ~4000ms (3200-4800ms)
3. 设置 `nextRetryAt = NOW() + backoff`, 状态保持 `failed`
4. `findPending()` 查询时会排除 `nextRetryAt > NOW()` 的 Job

> **注意**: `findPending()` 中的过滤条件为 `status = 'pending' AND (next_retry_at IS NULL OR next_retry_at <= NOW())`, 但 `failJob()` 设置的是 `status = 'failed'` + `nextRetryAt`。这意味着自动重试的 Job 不会被 `findPending()` 拾取, 需要通过 `QueueRepository.getRetryableJobs()` 或定时调度器来处理。当前代码中 `getRetryableJobs()` 查询条件为 `status = 'pending' AND next_retry_at IS NOT NULL`, 与 `failJob()` 设置的状态不匹配。这是一个已知的设计缺陷。

---

## 5. 优先级与 FIFO 语义

### 5.1 优先级级别

```typescript
enum JobPriority {
  LOW      = -1,   // 低优先级, 最后处理
  NORMAL   = 0,    // 默认优先级
  HIGH     = 1,    // 高优先级, 优先处理
  CRITICAL = 2,    // 紧急, 最优先处理
}
```

### 5.2 调度策略

出队时采用 **优先级降序 + 创建时间升序** 的复合排序:

```sql
ORDER BY priority DESC, created_at ASC
```

语义:
1. 优先级高的 Job 先出队
2. 相同优先级的 Job 按创建时间 FIFO(先进先出)

### 5.3 并发安全

`findPending()` 使用 `FOR UPDATE SKIP LOCKED` 行级锁:

```sql
SELECT * FROM queue_jobs
WHERE status = 'pending'
  AND (next_retry_at IS NULL OR next_retry_at <= NOW())
ORDER BY priority DESC, created_at ASC
LIMIT $1
FOR UPDATE SKIP LOCKED
```

这确保:
- 多个消费者并发出队时不会拾取同一个 Job
- 已被其他事务锁定的 Job 会被跳过, 而非阻塞等待
- 适合多 Worker 分布式消费场景

### 5.4 部分索引优化

数据库针对高频查询路径创建了部分索引:

```sql
-- 优先级出队索引 (仅索引 pending 状态, 减小索引体积)
CREATE INDEX idx_queue_jobs_dequeue
  ON queue_jobs (status, priority DESC, created_at ASC)
  WHERE status = 'pending';
```

---

## 6. API 端点

所有端点挂载于 `/api/v1/queue` 前缀下。

### 6.1 任务入队

```
POST /api/v1/queue/:queueName/jobs
```

**请求体**:
```json
{
  "tenantId": "tenant-1",
  "payload": { "pipelineId": "pipe-101", "action": "build" },
  "priority": 1,
  "maxAttempts": 5
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "job": {
      "id": "a1b2c3d4-...",
      "tenantId": "tenant-1",
      "queueName": "pipeline-execution",
      "jobType": "default",
      "payload": { "pipelineId": "pipe-101", "action": "build" },
      "status": "pending",
      "priority": 1,
      "maxAttempts": 5,
      "attempts": 0,
      "createdAt": "2024-03-20T10:30:00Z",
      "updatedAt": "2024-03-20T10:30:00Z"
    }
  }
}
```

**校验规则**:
- `tenantId` 必填
- `payload` 必填, 类型为 JSON 对象

### 6.2 任务出队

```
POST /api/v1/queue/:queueName/dequeue
```

**请求体**:
```json
{
  "limit": 5
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "jobs": [
      {
        "id": "a1b2c3d4-...",
        "status": "processing",
        "attempts": 1,
        "queue": "pipeline-execution",
        "payload": { "pipelineId": "pipe-101" }
      }
    ],
    "count": 1
  }
}
```

### 6.3 标记任务完成

```
POST /api/v1/queue/jobs/:id/complete
```

**响应** (200 OK):
```json
{
  "success": true,
  "message": "Job a1b2c3d4-... marked as completed"
}
```

### 6.4 标记任务失败

```
POST /api/v1/queue/jobs/:id/fail
```

**请求体**:
```json
{
  "error": "Connection timeout after 30s"
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "attempts": 1,
    "maxAttempts": 3
  },
  "message": "Job a1b2c3d4-... marked as failed, will retry"
}
```

### 6.5 重试失败任务

```
POST /api/v1/queue/jobs/:id/retry
```

**请求体**:
```json
{
  "delaySeconds": 60
}
```

### 6.6 查询任务列表

```
GET /api/v1/queue/jobs?status=pending&queue=pipeline-execution&tenantId=tenant-1
```

**查询参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `status` | string | 按状态过滤: pending/processing/completed/failed |
| `queue` | string | 按队列名过滤 |
| `tenantId` | string | 按租户过滤 |

### 6.7 查询任务详情

```
GET /api/v1/queue/jobs/:id
```

### 6.8 队列统计

```
GET /api/v1/queue/stats
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "stats": {
      "total": 100,
      "pending": 20,
      "running": 5,
      "completed": 70,
      "failed": 4,
      "cancelled": 1,
      "avgWaitTime": 500,
      "avgExecutionTime": 2000
    }
  }
}
```

---

## 7. 数据模型

### 7.1 queue_jobs 表结构

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK, 默认 gen_random_uuid() | 任务唯一标识 |
| `tenant_id` | VARCHAR(64) | 可空 | 租户 ID, 多租户隔离 |
| `queue_name` | VARCHAR(128) | NOT NULL, 默认 'default' | 队列名称 |
| `job_type` | VARCHAR(128) | NOT NULL | 任务类型标识符 |
| `payload` | JSONB | NOT NULL, 默认 '{}' | 任务负载数据 |
| `status` | VARCHAR(32) | NOT NULL, 默认 'pending' | 当前状态 |
| `priority` | INTEGER | NOT NULL, 默认 0 | 优先级 (-1~2) |
| `result` | JSONB | 可空 | 执行结果 |
| `error_message` | TEXT | 可空 | 失败原因 |
| `max_attempts` | INTEGER | NOT NULL, 默认 3 | 最大重试次数 |
| `attempts` | INTEGER | NOT NULL, 默认 0 | 已重试次数 |
| `next_retry_at` | TIMESTAMPTZ | 可空 | 下次重试时间 |
| `started_at` | TIMESTAMPTZ | 可空 | 开始处理时间 |
| `completed_at` | TIMESTAMPTZ | 可空 | 完成时间 |
| `created_at` | TIMESTAMPTZ | 默认 NOW() | 创建时间 |
| `updated_at` | TIMESTAMPTZ | 默认 NOW() | 更新时间 |

### 7.2 索引清单

| 索引名 | 列 | 类型 | 用途 |
|--------|-----|------|------|
| `idx_queue_jobs_dequeue` | `(status, priority DESC, created_at ASC)` | 部分索引 (WHERE status='pending') | 优先级出队 |
| `idx_queue_jobs_retry` | `(status, next_retry_at)` | 部分索引 (WHERE status='failed') | 重试调度 |
| `idx_queue_jobs_tenant` | `(tenant_id, status, created_at DESC)` | B-tree | 租户范围查询 |
| `idx_queue_jobs_queue_name` | `(queue_name, status)` | B-tree | 按队列名过滤 |

### 7.3 TypeScript 类型映射

```typescript
// 前端 API 层 (简化视图)
interface QueueJob {
  id: string;
  tenant_id: string;
  queue: string;
  payload: Record<string, any>;
  status: JobStatus;
  attempts: number;
  created_at: string;
}

// 后端模型层 (完整实体)
interface Job {
  id: string;
  tenantId: string | null;
  queueName: string;
  jobType: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  priority: number;
  result: Record<string, unknown> | null;
  errorMessage: string | null;
  maxAttempts: number;
  attempts: number;
  nextRetryAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 8. 前端页面结构

### 8.1 页面布局

```
┌──────────────────────────────────────────────────────────┐
│  队列管理                          [刷新] [出队] [入队]    │
│  管理异步任务队列，监控任务执行状态                         │
├──────────────────────────────────────────────────────────┤
│  统计面板                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ 等待中:20 │ │ 处理中:5 │ │ 已完成:70│ │ 已失败:4 │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
├──────────────────────────────────────────────────────────┤
│  筛选: [状态: 全部 ▼]  [队列: 全部 ▼]                      │
├──────────────────────────────────────────────────────────┤
│  任务列表 (Ant Design Table)                               │
│  ┌─────┬──────────┬──────┬─────┬─────────┬──────┬───────┐│
│  │ID   │ 队列名称  │ 状态  │重试  │Payload  │时间  │ 操作  ││
│  ├─────┼──────────┼──────┼─────┼─────────┼──────┼───────┤│
│  │job-1│ pipeline │ 处理中 │ 1  │{...}    │2h ago│[详情] ││
│  │job-2│ deploy   │ 等待中 │ 0  │{...}    │1h ago│[详情] ││
│  └─────┴──────────┴──────┴─────┴─────────┴──────┴───────┘│
│  共 99 个任务                               [1] [2] [3]   │
└──────────────────────────────────────────────────────────┘
```

### 8.2 组件清单

| 组件 | 类型 | 功能 |
|------|------|------|
| 统计面板 | `Card` + `Statistic` | 展示各状态 Job 数量 |
| 筛选栏 | `Select` | 按状态、队列名过滤 |
| 任务表格 | `AntTable` | 分页展示 Job 列表 |
| 入队弹窗 | `Modal` + `Form` | 输入队列名、租户 ID、Payload(JSON) |
| 出队弹窗 | `Modal` + `Form` | 选择队列名、出队数量 |
| 详情抽屉 | `Drawer` + `Descriptions` | 展示 Job 完整信息, 含操作按钮 |

### 8.3 交互流程

1. **页面加载**: 调用 `listJobs()` + `getQueueStats()` 获取初始数据
2. **筛选变更**: `statusFilter` 或 `queueFilter` 变化时自动重新加载
3. **入队操作**: 弹窗表单验证 → 调用 `enqueueJob()` → 成功提示 → 刷新列表
4. **出队操作**: 选择队列和数量 → 调用 `dequeueJob()` → 显示获取任务数 → 刷新
5. **任务操作**: 处理中任务可"标记完成"或"标记失败", 失败任务可"重试"
6. **详情查看**: 点击详情打开 Drawer, 展示完整 Payload (格式化 JSON)

---

## 9. 集成点

### 9.1 Pipeline 执行

Pipeline 引擎可以将阶段任务推入 `pipeline-execution` 队列:

```
PipelineEngine → StageExecutor → QueueService.enqueue({
  queueName: 'pipeline-execution',
  jobType: 'stage-execution',
  payload: { pipelineId, stageId, stageConfig }
})
```

### 9.2 构建任务

CI 构建可将编译、测试、镜像构建等操作排队执行:

```
BuildService → QueueService.enqueue({
  queueName: 'pipeline-execution',
  jobType: 'build',
  payload: { commitId, branch, projectId }
})
```

### 9.3 事件处理

EventBus 消费者可将事件处理转化为异步 Job:

```
EventBus Consumer → QueueService.enqueue({
  queueName: 'notification',
  jobType: 'event-notification',
  payload: { eventType, eventPayload, targets }
})
```

### 9.4 制品扫描

安全扫描任务可排队等待执行:

```
SecurityService → QueueService.enqueue({
  queueName: 'artifact-scan',
  jobType: 'trivy-scan',
  payload: { artifactId, registry, tag }
})
```

---

## 10. 已知问题与改进方向

### 10.1 当前已知问题

| 问题 | 严重度 | 说明 |
|------|--------|------|
| QueueName 过滤缺失 | 中 | `QueueService.dequeue()` 未按 `queueName` 参数过滤, 全局出队 |
| 自动重试状态不匹配 | 中 | `failJob()` 设置 `status='failed'` + `nextRetryAt`, 但 `findPending()` 只查 `status='pending'` |
| Repository 层字段名不一致 | 低 | `QueueRepository` 使用 `queue` 字段, 但数据库列名为 `queue_name` |
| Controller 层 push/pop 别名 | 低 | `QueueService` 使用 `push()`/`pop()` 兼容方法名, 增加了理解成本 |

### 10.2 未来增强方向

#### A. Redis-backed Queue

**动机**: PostgreSQL 作为队列存储适合持久化和查询, 但在高吞吐场景下不如 Redis 的 List/Stream 结构高效。

**方案**:
- 使用 Redis `BRPOPLPUSH` 或 Redis Streams 作为热队列
- PostgreSQL 作为归档存储(已完成/失败的 Job 异步同步)
- `QueueService` 增加 `RedisJobRepository` 实现, 通过配置切换

#### B. 分布式 Worker

**动机**: 当前消费逻辑是拉取模式(主动 dequeue), 需要一个常驻 Worker 进程持续消费。

**方案**:
- 实现 `QueueWorker` 类: 循环 `dequeue()` → 执行 handler → `completeJob()` / `failJob()`
- 支持按 `jobType` 注册处理器: `worker.register('build', buildHandler)`
- Worker 水平扩展时依靠 `FOR UPDATE SKIP LOCKED` 保证任务不重复消费

#### C. 速率限制 (Rate Limiting)

**动机**: 防止某个租户或队列过快消耗系统资源。

**方案**:
- 基于令牌桶算法, 在 `enqueue()` 前检查速率
- 支持按 `tenantId` + `queueName` 维度配置限流策略
- 超限后返回 429 或延迟入队(设置 `next_retry_at`)

#### D. 定时任务 / 延迟队列

**动机**: 当前 `next_retry_at` 机制可用于重试, 但未提供通用的延迟执行能力。

**方案**:
- `enqueue()` 支持 `scheduledAt` 参数
- `findPending()` 已支持 `next_retry_at <= NOW()` 过滤, 可直接复用
- 需增加调度器定期扫描待执行任务

#### E. 死信队列 (DLQ)

**动机**: 达到 `maxAttempts` 后的 Job 直接进入终态, 缺乏后续处理机制。

**方案**:
- 达到最大重试次数时, 将 Job 复制/移动到 `queue_jobs_dlq` 表
- 提供 DLQ 管理 API: 查看、手动重试、永久删除
- 支持 DLQ 告警通知

#### F. 批量操作

**动机**: 当前 `completeJob()` / `failJob()` 均为单 Job 操作, 批量确认场景下效率低。

**方案**:
- 新增 `POST /api/v1/queue/jobs/batch/complete` 端点
- 使用 `WHERE id IN (...)` 批量更新
- 返回成功/失败分项结果

---

## 11. 文件清单

### 后端

| 文件 | 职责 |
|------|------|
| `orion-platform-service/src/api/queue-routes.ts` | Fastify 路由注册, 挂载 8 个端点 |
| `orion-platform-service/src/api/controllers/QueueController.ts` | 请求处理、参数校验、错误映射 |
| `orion-platform-service/src/services/queue/QueueService.ts` | 核心业务逻辑(607 行) |
| `orion-platform-service/src/services/queue/QueueRepository.ts` | 轻量 Repository (直接使用 pool.query) |
| `orion-platform-service/src/services/queue/__tests__/QueueService.test.ts` | 单元测试, 覆盖全部核心路径 |
| `orion-platform-service/src/models/Job.ts` | 类型定义: Job, JobInput, QueueStats, JobPriority |
| `orion-platform-service/src/repositories/JobRepository.ts` | JobRepository 接口 + PostgresJobRepository 实现 (284 行) |
| `orion-platform-service/src/db/migrations/148_create_queue_jobs_table.sql` | 数据库建表迁移 + 4 个索引 |
| `orion-platform-service/src/db/migrations/148_rollback_queue_jobs_table.sql` | 回滚迁移 |

### 前端

| 文件 | 职责 |
|------|------|
| `orion-frontend/src/pages/Queue/index.tsx` | 队列管理主页面 (653 行) |
| `orion-frontend/src/api/queue.ts` | 前端 API 客户端封装 |
| `orion-frontend/src/pages/Queue/__tests__/index.test.tsx` | 页面单元测试 |
| `orion-frontend/src/router/routes.ts` | 路由注册 (Queue 页面) |

---

## 附录: 术语表

| 术语 | 英文 | 说明 |
|------|------|------|
| 入队 | Enqueue | 将任务添加到队列等待处理 |
| 出队 | Dequeue | 从队列中取出任务进行消费 |
| 退避 | Backoff | 重试时的延迟策略, 避免重试风暴 |
| 抖动 | Jitter | 在退避基础上加入随机偏移 |
| 死信队列 | DLQ (Dead Letter Queue) | 存放无法处理的消息 |
| 部分索引 | Partial Index | 仅对满足条件的行建立索引 |
| SKIP LOCKED | FOR UPDATE SKIP LOCKED | PostgreSQL 行锁特性, 跳过已锁定行 |
