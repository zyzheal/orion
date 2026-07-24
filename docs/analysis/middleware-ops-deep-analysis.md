# Middleware-Ops 模块深度分析

**生成日期**: 2026-07-02  
**分析范围**: `orion-platform-service/src/services/middleware-ops/MiddlewareOpsService.ts` + `src/api/middleware-ops-routes.ts`  
**模块标签**: Phase 4, 中间件运维, 连接池, 消息队列

---

## 一、现状概述

### 模块定位

Middleware-Ops 模块提供中间件（Redis/Kafka/RabbitMQ/MySQL/PostgreSQL/Elasticsearch/MongoDB/Nginx）的健康监控、连接池管理和消息队列跟踪能力。属于 Phase 4 中间件运维域。

### 文件结构

| 文件 | 行数 | 职责 |
|------|------|------|
| `services/middleware-ops/MiddlewareOpsService.ts` | 485 | 实例 CRUD、指标记录、连接池管理、MQ 统计、告警、健康汇总 |
| `services/middleware-ops/index.ts` | barrel 导出 |
| `api/middleware-ops-routes.ts` | ~120 | 路由注册 |

### 核心数据模型

- **MiddlewareInstance**: id, name, type (8 种中间件), host, port, status (healthy/degraded/unhealthy/unknown)
- **MiddlewareMetric**: metricName, value, unit, timestamp
- **ConnectionPool**: active, idle, max, waiting, utilization（仅内存，不持久化）
- **MessageQueueStats**: messageCount, consumerCount, messagesPerSecond, avgLatencyMs, deadLetterCount（仅内存，不持久化）
- **MiddlewareAlert**: alertType (connection_pool_exhaustion/high_latency/queue_backlog/node_down/replication_lag), severity

### 持久化方式

✅ PostgreSQL Repository 模式（`MiddlewareOpsRepository`）：
- 实例和告警持久化到 PostgreSQL
- **连接池和 MQ 统计为 ephemeral（仅内存，不持久化）**
- **写策略**：fire-and-forget 异步写入 PostgreSQL，始终先更新内存 Map
- **读策略**：优先 DB，失败时降级到内存
- 启动时从 DB 加载所有实例到内存

---

## 二、功能矩阵

| 功能点 | 状态 | 说明 |
|--------|------|------|
| 实例创建 | ✅ | 支持 8 种中间件类型，fire-and-forget 持久化 |
| 实例列表 | ✅ | 支持按 type/status 过滤 |
| 实例详情 | ✅ | 通过 ID 查询（仅内存） |
| 实例更新 | ✅ | 直接更新内存，异步持久化 |
| 实例删除 | ✅ | 内存+DB 同步删除 |
| 指标记录 | ✅ | 记录任意 metricName/value/unit |
| 指标查询 | ✅ | 按 middlewareId/metricName 过滤 |
| 连接池记录 | ⚠️ | **仅内存**，不持久化，90% 利用率自动告警 |
| 连接池查询 | ⚠️ | 仅内存查询 |
| MQ 统计记录 | ⚠️ | **仅内存**，不持久化，>10K 积压自动告警 |
| MQ 统计查询 | ⚠️ | 仅内存查询 |
| 告警创建 | ✅ | 自动检测连接池耗尽和 MQ 积压 |
| 告警列表 | ✅ | 支持按 severity/alertType 过滤 |
| 告警删除 | ✅ | 内存+DB 同步删除 |
| 健康汇总 | ✅ | 计算 healthScore（healthy×100 + degraded×50）/ total |

---

## 三、API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/middleware/instances` | 创建实例 |
| GET | `/middleware/instances` | 列表 |
| GET | `/middleware/instances/:id` | 详情 |
| PUT | `/middleware/instances/:id` | 更新 |
| DELETE | `/middleware/instances/:id` | 删除 |
| POST | `/middleware/instances/:id/metrics` | 记录指标 |
| GET | `/middleware/metrics` | 指标列表 |
| GET | `/middleware/instances/:id/connection-pools` | 连接池 |
| GET | `/middleware/instances/:id/mq-stats` | MQ 统计 |
| GET | `/middleware/alerts` | 告警列表 |
| DELETE | `/middleware/alerts/:id` | 删除告警 |
| GET | `/middleware/health-summary` | 健康汇总 |

### 路由注册

✅ 所有路由通过 `authenticateUser` + `requirePermission` 中间件，资源名 `middleware`。

### ⚠️ 路由 Bug

与 serverless 路由相同的**死代码 Bug**（`middleware-ops-routes.ts`）：

```typescript
// GET /:id
return handleError(reply, new NotFoundError('NOT_FOUND'));
return reply.send({ success: true, data: instance });

// PUT /:id
return handleError(reply, new NotFoundError('NOT_FOUND'));
return reply.send({ success: true, data: instance });
```

**影响**：`GET /middleware/instances/:id` 和 `PUT /middleware/instances/:id` 总是返回 404。

---

## 四、依赖关系

### 内部依赖

- `MiddlewareOpsService` → `MiddlewareOpsRepository`

### 外部依赖

- `uuid`（ID 生成）
- `utils/logger.ts`（结构化日志）
- `errors.ts`（`NotFoundError`, `handleError`）
- 数据模型定义内联在 Service 文件中

### 测试覆盖

✅ 测试文件:
- `__tests__/MiddlewareOpsService.test.ts`

---

## 五、风险与改进建议

| 风险 | 级别 | 建议 |
|------|------|------|
| **路由死代码 Bug**：GET/PUT /instances/:id 总是返回 404 | **P0** | 删除无条件的 `handleError` 调用 |
| **连接池和 MQ 统计不持久化**：仅内存存储，服务重启后丢失 | **P1** | 增加 PostgreSQL 持久化，或使用 Redis TimeSeries |
| **Fire-and-forget 写入可能丢数据**：异步 catch 只记 warn，不重试 | **P1** | 增加重试队列和写入确认机制 |
| **启动加载全量数据**：`loadFromDb()` 无 tenantId 过滤，加载所有租户数据 | **P2** | 改为按需加载或分片加载 |
| **实例详情仅走内存**：`getInstance(id)` 不从 DB 读取 | **P2** | 增加 DB 回退查询逻辑 |
| **无真实中间件探活**：status 字段由用户设置，无自动健康检查 | **P2** | 集成 TCP ping / Redis PING / MySQL 连接检测 |
| **构造函数中 `options.database` 未使用**：路由中 `void options.database` 然后 `new MiddlewareOpsService()` 无 DB | **P2** | 传递 database 到 MiddlewareOpsService 构造函数 |

---

## 六、总结

Middleware-Ops 模块提供了中间件运维管理的完整 API 骨架，覆盖了实例管理、指标、连接池、MQ 统计和告警。fire-and-forget 持久化策略是一种合理的设计权衡（性能优先）。

**主要问题**：两个路由因死代码 Bug 无法工作（P0），连接池和 MQ 统计不持久化（P1），路由中未传递 database 参数导致始终无 DB 初始化（P2）。这些修复成本较低，修复后可以达到可用状态。
