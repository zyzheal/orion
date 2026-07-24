# 事件总线服务 Spec 文档

**生成日期**: 2026-07-03
**状态**: 编写中
**成熟度**: L1（初始定义）

---

## 一、服务定位

事件总线服务（Event Bus Service）是 Orion 平台的异步事件分发基础设施，提供两个核心能力：

1. **事件订阅管理（Pub/Sub）**：允许服务/模块按事件类型注册订阅，并管理订阅的启用/停用状态。
2. **事件日志记录**：记录已发布事件的元数据和负载，支持事件追溯和处理状态追踪。

**设计理念**：
- 当前实现聚焦于**事件注册与记录**层，事件的实际分发/通知机制由下游消费者自行轮询或通过集成层触发。
- 多租户隔离：所有数据按 `tenant_id` 分区，确保租户间的数据和事件完全隔离。
- 无状态服务层，水平扩展友好。

**在 Orion 架构中的位置**：
- 属于基础设施层微服务（47 个 Go 微服务之一）
- 上游：平台服务（`orion-platform-service`）、Pipeline 引擎、审批工作流等事件产生方
- 下游：诊断中心、监控中心、通知服务等事件消费方
- 定位为**被动记录型事件总线**，非实时流式消息队列（如 Kafka/Pulsar）

---

## 二、验收标准

| 编号 | 验收标准 | 优先级 | 验证方式 |
|------|---------|--------|---------|
| ACC-01 | 支持 POST /api/v1/subscriptions 创建订阅，必填字段校验（event_type, handler），返回 201 + 订阅对象 | P0 | 集成测试 |
| ACC-02 | 支持 GET /api/v1/subscriptions 列出租户下所有订阅，支持按 event_type 过滤 | P0 | 集成测试 |
| ACC-03 | 支持 GET /api/v1/subscriptions/:id 查询单个订阅详情 | P0 | 集成测试 |
| ACC-04 | 支持 PATCH /api/v1/subscriptions/:id 启用/停用订阅（enabled 字段必填） | P0 | 集成测试 |
| ACC-05 | 支持 DELETE /api/v1/subscriptions/:id 取消订阅，不存在时返回 404 | P0 | 集成测试 |
| ACC-06 | 支持 GET /api/v1/subscriptions/count 返回租户订阅总数 | P1 | 集成测试 |
| ACC-07 | 支持 POST /api/v1/events 发布事件，payload 为可选的 JSONB | P0 | 集成测试 |
| ACC-08 | 支持 GET /api/v1/events 列出事件历史，默认 limit=100，最大 500 | P0 | 集成测试 |
| ACC-09 | 支持 GET /api/v1/events/:id 查询单条事件记录 | P0 | 集成测试 |
| ACC-10 | 支持 PATCH /api/v1/events/:id/process 标记事件为已处理 | P1 | 集成测试 |
| ACC-11 | 所有写入操作（POST/PATCH/DELETE）校验 JWT 权限（event_bus:write / event_bus:delete） | P0 | 安全测试 |
| ACC-12 | 所有数据按 tenant_id 隔离，请求从 JWT claims 中提取 tenant_id | P0 | 集成测试 |
| ACC-13 | 健康检查端点 GET /healthz 返回 200 | P0 | 冒烟测试 |
| ACC-14 | 启动时自动执行 DB migration | P1 | 冒烟测试 |
| ACC-15 | 输入校验出错时返回 400 + 具体错误信息 | P1 | 集成测试 |
| ACC-16 | subscription/event 不存在时返回 404 + 语义化错误 | P1 | 集成测试 |
| ACC-17 | PaginatedRequest 分页参数默认值正确（page=1, page_size=20, max=100） | P2 | 单元测试 |
| ACC-18 | 无效 event_type（空字符串）被服务层拒绝，返回 ErrInvalidInput | P1 | 单元测试 |

---

## 三、API 设计

### 3.1 端点总览

基础路径：`/api/v1`

#### 订阅管理

| 方法 | 路径 | 功能说明 | 请求参数 | 响应 | 权限 |
|------|------|---------|---------|------|------|
| POST | `/subscriptions` | 创建新订阅 | Body: `{event_type, handler}` | 201: `EventSubscription` | `event_bus:write` |
| GET | `/subscriptions` | 列出租户的所有订阅 | Query: `?event_type=` | 200: `{data: [EventSubscription]}` | 认证 |
| GET | `/subscriptions/count` | 获取订阅总数 | - | 200: `{count: number}` | 认证 |
| GET | `/subscriptions/:id` | 获取单个订阅详情 | Path: `id` | 200: `EventSubscription` | 认证 |
| PATCH | `/subscriptions/:id` | 启用/停用订阅 | Body: `{enabled: bool}`, Path: `id` | 200: `EventSubscription` | `event_bus:write` |
| DELETE | `/subscriptions/:id` | 取消订阅 | Path: `id` | 200: `{message: "unsubscribed"}` | `event_bus:delete` |

#### 事件管理

| 方法 | 路径 | 功能说明 | 请求参数 | 响应 | 权限 |
|------|------|---------|---------|------|------|
| POST | `/events` | 发布事件 | Body: `{event_type, payload?}` | 201: `EventLog` | `event_bus:write` |
| GET | `/events` | 列出事件历史 | Query: `?limit=` (default 100, max 500) | 200: `{data: [EventLog]}` | 认证 |
| GET | `/events/:id` | 获取单条事件记录 | Path: `id` | 200: `EventLog` | 认证 |
| PATCH | `/events/:id/process` | 标记事件已处理 | Path: `id` | 200: `{message: "marked as processed"}` | `event_bus:write` |

#### 系统

| 方法 | 路径 | 功能说明 | 权限 |
|------|------|---------|------|
| GET | `/healthz` | 健康检查 | 无 |

### 3.2 请求/响应示例

**创建订阅**：
```bash
curl -X POST /api/v1/subscriptions \
  -H "Authorization: Bearer <jwt>" \
  -d '{"event_type": "pipeline.completed", "handler": "webhook://notify"}'
```

响应 (201)：
```json
{
  "id": "a1b2c3d4-...",
  "tenant_id": "t-123",
  "event_type": "pipeline.completed",
  "handler": "webhook://notify",
  "enabled": true,
  "created_at": "2026-07-03T10:00:00Z"
}
```

**发布事件**：
```bash
curl -X POST /api/v1/events \
  -H "Authorization: Bearer <jwt>" \
  -d '{"event_type": "deploy.started", "payload": {"env": "prod", "version": "v2.1"}}'
```

响应 (201)：
```json
{
  "id": "e5f6g7h8-...",
  "tenant_id": "t-123",
  "event_type": "deploy.started",
  "payload": {"env": "prod", "version": "v2.1"},
  "processed": false,
  "created_at": "2026-07-03T10:01:00Z"
}
```

**错误响应格式**：
```json
// 400 Bad Request
{"error": "invalid input: tenant_id and event_type are required"}

// 404 Not Found
{"error": "subscription not found"}
```

---

## 四、数据模型

### 4.1 EventSubscription

| 字段 | 类型 | 数据库列 | 说明 |
|------|------|---------|------|
| ID | `string (UUID)` | `id` | 主键，由 `gen_random_uuid()` 自动生成 |
| TenantID | `string` | `tenant_id` | 租户标识（必填），多租户隔离键 |
| EventType | `string` | `event_type` | 事件类型标识，如 `pipeline.completed` |
| Handler | `string` | `handler` | 事件处理方标识（URL、服务名等） |
| Enabled | `bool` | `enabled` | 是否启用，默认为 `true` |
| CreatedAt | `time.Time` | `created_at` | 创建时间戳（带时区） |

### 4.2 EventLog

| 字段 | 类型 | 数据库列 | 说明 |
|------|------|---------|------|
| ID | `string (UUID)` | `id` | 主键，由 `gen_random_uuid()` 自动生成 |
| TenantID | `string` | `tenant_id` | 租户标识（必填） |
| EventType | `string` | `event_type` | 事件类型标识 |
| Payload | `JSONB` | `payload` | 事件负载 JSON，默认为 `{}` |
| Processed | `bool` | `processed` | 是否已被消费方处理，默认为 `false` |
| CreatedAt | `time.Time` | `created_at` | 发布时间戳（带时区） |

### 4.3 请求模型

| 模型 | 字段 | 约束 |
|------|------|------|
| `CreateSubscriptionRequest` | `event_type` | 必填 |
| | `handler` | 必填 |
| `PublishEventRequest` | `event_type` | 必填 |
| | `payload` | 可选，JSONB |
| `UpdateSubscriptionRequest` | `enabled` | 必填，`*bool` |
| `PaginatedRequest` | `page`（query）| 默认 1 |
| | `page_size`（query）| 默认 20，最大 100，可通过 `Offset()` / `Limit()` 方法计算 |

### 4.4 数据库 Schema

```sql
-- 事件订阅表
CREATE TABLE IF NOT EXISTS event_subscriptions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  VARCHAR(64) NOT NULL,
    event_type VARCHAR(128) NOT NULL,
    handler    VARCHAR(256) NOT NULL,
    enabled    BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_subscriptions_tenant ON event_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_subscriptions_type ON event_subscriptions(tenant_id, event_type);

-- 事件日志表
CREATE TABLE IF NOT EXISTS event_logs (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  VARCHAR(64) NOT NULL,
    event_type VARCHAR(128) NOT NULL,
    payload    JSONB NOT NULL DEFAULT '{}',
    processed  BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_logs_tenant ON event_logs(tenant_id, created_at DESC);
```

### 4.5 辅助类型

- **JSONB**：`map[string]interface{}` 的别名，实现了 `sql.Scanner` 和 `driver.Valuer`，支持 PostgreSQL JSONB 列的自动序列化/反序列化。`nil` 映射为 SQL `NULL`。

---

## 五、依赖与集成

### 5.1 基础设施依赖

| 依赖项 | 用途 | 必需 | 版本/配置 |
|--------|------|------|----------|
| PostgreSQL | 持久化事件订阅和日志数据 | 是 | `orion_event_bus` 数据库，端口默认 5432 |
| Redis | JWT session 校验缓存 | 是 | `localhost:6379` 默认 |
| `orion/go-common` | 共享库（auth, database, logger, middleware, redis） | 是 | 本地 replace 到 `../orion-go-common` |

### 5.2 外部包依赖

| 包 | 用途 | 版本 |
|----|------|------|
| `github.com/gin-gonic/gin` | HTTP 路由框架 | v1.10.0 |
| `github.com/jmoiron/sqlx` | SQL 扩展（命名参数、StructScan） | v1.4.0 |
| `github.com/google/uuid` | UUID 生成（扩展预留） | v1.6.0 |
| `github.com/lib/pq` | PostgreSQL 驱动 | 间接依赖 |

### 5.3 集成关系

| 方向 | 集成方 | 交互方式 | 说明 |
|------|--------|---------|------|
| 上游 | `orion-platform-service` | REST API | 平台服务调用 POST /events 发布流水线/审批等事件 |
| 上游 | Pipeline Engine | REST API | 通过 POST /events 发布 pipeline.started/completed/failed 事件 |
| 下游 | 诊断/监控/通知服务 | REST API（轮询） | 消费方通过 GET /events 拉取未处理事件（processed=false） |
| 同级 | Redis | 网络连接 | 用于 Auth middleware 的 JWT token 校验 |

### 5.4 环境变量配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `PORT` | `8080` | 服务监听端口 |
| `DB_HOST` | `localhost` | 数据库主机 |
| `DB_PORT` | `5432` | 数据库端口 |
| `DB_USER` | **必填** | 数据库用户 |
| `DB_PASSWORD` | **必填** | 数据库密码 |
| `DB_NAME` | `orion_event_bus` | 数据库名 |
| `DB_SSLMODE` | `disable` | PostgreSQL SSL 模式 |
| `JWT_SECRET` | `change-me-in-production` | JWT 密钥 |
| `REDIS_ADDR` | `localhost:6379` | Redis 地址 |

### 5.5 中间件链

请求经过的中间件按顺序：
1. `middleware.Recovery` — panic 恢复
2. `middleware.RequestID` — 注入请求 ID
3. `middleware.StructuredLogger` — 结构化请求日志（zap）
4. `middleware.CORS` — 跨域配置
5. `auth.Auth` — JWT + Redis session 验证（`/healthz` 跳过）
6. `auth.RequirePermission` — 按路由配置的细粒度权限控制（仅写入类操作）

---

## 六、注意事项

### 6.1 已知问题

1. **`service_test.go` 引用无效符号**：测试文件 `internal/service/service_test.go` 引用了 `ErrEventTopicNotFound`，但实际 service 层定义的错误变量为 `ErrEventLogNotFound`。该测试会编译失败或运行时崩溃，需修复。

2. **当前仅为记录型事件总线**：此服务不具备实时推送能力（无 WebSocket、SSE、消息队列集成）。事件消费者需通过轮询 GET /events 并标记 processed=true 的方式消费。后续可考虑：
   - 集成 Redis Pub/Sub 实现实时通知
   - 基于 `handler` 字段实现自动回调（webhook 推送）
   - 对接外部消息队列（Kafka/RabbitMQ）实现高吞吐事件流

3. **无 payload 结构约束**：`payload` 字段为自由格式 JSONB，不要求符合特定 Schema。建议在消费方文档中约定常见事件类型的 payload 结构。

4. **缺乏事件重试机制**：当前 `processed` 标记为二值状态（true/false），无重试次数、失败原因等字段。若需可靠事件处理，建议扩展 `EventLog` 增加 `retry_count`、`last_error`、`next_retry_at` 等字段。

5. **无事件 TTL/清理策略**：事件日志会无限增长。建议补充定期清理策略（如：已处理且超过 30 天的记录自动归档或删除）。

6. **`PaginatedRequest` 虽已定义但未在 handler 中实际使用**：`ListSubscriptions` 和 `ListEvents` 当前未使用分页参数（`page`/`page_size`），`/events` 仅使用 `limit` 查询参数。分页能力为预留扩展。

7. **中间件顺序**：`CORS` 中间件在 `Auth` 之前，符合安全最佳实践。但 `/healthz` 在 router 级别注册（绕过 group 中间件），需确保健康检查不受 CORS 影响。

### 6.2 安全考量

- 所有写操作路径均需 `auth.RequirePermission("event_bus", "write")` 或 `delete` 权限
- `tenant_id` 从 JWT claims 中提取而非用户请求体，防止跨租户数据篡改
- SQL 全部使用参数化查询（`$1`, `$2`），无拼接风险
- JWT Secret 在 `config.go` 中有默认值 `"change-me-in-production"`，生产环境必须替换

### 6.3 扩展方向

| 方向 | 说明 | 优先级 |
|------|------|--------|
| 事件类型注册与校验 | 建立事件类型白名单，防止无效事件类型注入 | P1 |
| Webhook 自动回调 | 根据 subscription 的 handler 字段自动 POST 回调 | P1 |
| 死信队列 | 标记超过重试次数的事件为死信 | P2 |
| 事件订阅过滤器 | 支持基于 payload 内容的过滤条件 | P2 |
| 实时推送（SSE/WS） | 为前端提供实时事件推送能力 | P2 |
| 指标暴露 | 集成 Prometheus 指标（事件发布速率、订阅数等）| P2 |
