# 中间件运维服务 Spec 文档

**生成日期**: 2026-07-03
**状态**: 编写中
**成熟度**: L1（初始定义）

---

## 一、服务定位

### 1.1 服务名称

**中间件运维服务**（Middleware Operations Service），代码目录 `orion-middleware-ops-svc-go`。

### 1.2 业务目标

提供统一的中间件实例生命周期管理与可观测性聚合能力。覆盖开发/测试/生产环境中以下场景：

- **实例注册与管理**：SQL/NoSQL/消息队列/网关等中间件的元数据注册、状态跟踪与配置管理。
- **备份管理**：中间件实例的备份记录创建与查询。
- **指标采集与聚合**：接收中间件运行时指标（连接数、延迟、吞吐量），支持按实例和指标名筛选。
- **连接池监控**：记录连接池快照，并在利用率 >= 90% 时自动生成告警。
- **消息队列积压监控**：记录队列统计信息，在积压超过阈值时自动生成告警（>10K warning / >50K critical）。
- **告警聚合**：统一展示中间件相关的告警事件，支持按严重程度和类型筛选。
- **健康总览**：按租户聚合中间件实例健康状态，计算健康评分。

### 1.3 在 Orion 体系中的位置

| 维度 | 说明 |
|------|------|
| **所属子域** | 可观测性 (Observability) — 基础设施监控 |
| **上游依赖** | API Gateway (orion-api-gateway) 路由请求至本服务 |
| **下游依赖** | PostgreSQL（持久化）、Redis（JWT 会话缓存）、go-common 公共库 |
| **前端对应** | 预计由可观测性模块下的中间件运维页面消费 |
| **平行服务** | orion-monitor-svc-go（通用监控）、orion-diagnostic-svc-go（诊断） |

### 1.4 技术栈

| 组件 | 选型 | 说明 |
|------|------|------|
| 语言 | Go 1.25 | 高性能编译型语言，适合运维类数据面服务 |
| HTTP 框架 | Gin v1.10 | 轻量高性能，Orion Go 微服务统一选型 |
| 数据库 | PostgreSQL + sqlx | 结构化数据持久化，sqlx 提供类型安全的 SQL 映射 |
| 缓存 | Redis | 存储 JWT 会话，用于认证鉴权 |
| 公共库 | `orion/go-common` | 提供 auth、database、logger、middleware、redis 等基础设施 |
| UUID | `google/uuid` | 实体主键生成 |
| 认证 | JWT + Redis + RBAC | `auth.Auth()` 全局中间件 + `auth.RequirePermission()` 细粒度 ACL |

---

## 二、验收标准

### 2.1 功能性验收

| 编号 | 标准 | 验证方式 |
|------|------|---------|
| F-01 | 支持注册 Redis / Kafka / RabbitMQ / MySQL / PostgreSQL / Elasticsearch / MongoDB / Nginx 共 8 种中间件实例 | 分别创建各类实例并验证存储 |
| F-02 | 实例支持完整的 CRUD 操作（创建/列表/详情/更新/删除），并按租户隔离 | 逐操作调用 API，验证数据隔离 |
| F-03 | 实例列表支持分页（默认 20 条/页，最大 100 条/页）、按类型和状态筛选 | 传入 page/page_size/type/status 参数验证 |
| F-04 | 实例总数查询返回正确计数 | 调用 GET /count 与列表数量对比 |
| F-05 | 备份记录创建后状态为 "running"，支持按实例 ID 查询备份列表 | 创建备份后验证状态值 |
| F-06 | 指标记录支持按 middleware_id 和 metric_name 筛选 | 传入筛选参数验证结果过滤 |
| F-07 | 连接池利用率 >= 90% 时自动生成 alert_type=connection_pool_exhaustion 的 critical 告警 | 模拟高利用率场景，验证告警生成 |
| F-08 | 消息队列积压 > 10,000 条时生成 warning 告警，> 50,000 条时生成 critical 告警 | 模拟不同积压量级，验证告警级别 |
| F-09 | 告警列表支持按 severity 和 alert_type 筛选 | 传入筛选参数验证结果过滤 |
| F-10 | 健康总览返回 6 个字段：total_instances、healthy_count、degraded_count、unhealthy_count、total_alerts、critical_alerts、health_score | 调用 GET /health-summary 验证返回结构 |
| F-11 | 健康评分公式：(healthy*100 + degraded*50) / total，空集群默认 100 | 构造已知数据验证评分计算 |
| F-12 | 所有写入操作（create/update/delete）均通过 ACL 权限校验 | 分别验证 write/delete/execute 权限拦截 |

### 2.2 非功能性验收

| 编号 | 标准 | 验证方式 |
|------|------|---------|
| NF-01 | 服务启动时自动执行数据库迁移 | 启动日志确认 "migrations" 执行成功 |
| NF-02 | 优雅关闭：收到 SIGINT/SIGTERM 后 5s 内完成连接关闭 | 发送终止信号，观察 shutdown 日志 |
| NF-03 | JWT 认证缺省路径 /healthz 跳过认证 | 未携带 Token 请求 /healthz 应返回 200 |
| NF-04 | 分页参数 page_size 超过 100 时自动截断为 100 | 传入 page_size=200 验证实际返回条数 |
| NF-05 | 告警创建为 "best-effort"：告警写入失败不影响主操作（连接池/MQ 记录） | 模拟告警表异常，验证主操作仍成功 |
| NF-06 | 所有列表接口返回 `{"data": [...]}` 包裹格式 | 验证响应体结构 |

### 2.3 安全验收

| 编号 | 标准 | 验证方式 |
|------|------|---------|
| S-01 | 所有 API 路径通过 tenant_id 上下文隔离数据 | 同一请求返回的数据 tenant_id 与令牌一致 |
| S-02 | 带有 RequirePermission 的路由需要对应权限码 | 无权限令牌请求应返回 403 |
| S-03 | /healthz 端点无需认证 | 直接访问返回 200 OK |
| S-04 | 输入参数通过 ShouldBindJSON 校验，无效请求返回 400 | 发送畸形 JSON 验证响应 |

---

## 三、API 设计

### 3.1 基础信息

| 属性 | 值 |
|------|-----|
| Base Path | `/api/v1/middleware` |
| 认证方式 | JWT Bearer Token + Redis 会话 |
| 全局中间件 | Recovery / RequestID / StructuredLogger / CORS / Auth |
| 响应格式 | 列表接口包裹 `{"data": [...]}`，单实体直接返回对象 |

### 3.2 端点列表

#### 实例管理 (Instance)

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/instances` | `middleware_ops:write` | 创建中间件实例 |
| GET | `/instances` | — | 列表实例（支持分页、type/status 筛选） |
| GET | `/instances/:id` | — | 获取实例详情 |
| PUT | `/instances/:id` | `middleware_ops:write` | 更新实例 |
| DELETE | `/instances/:id` | `middleware_ops:delete` | 删除实例 |
| GET | `/count` | — | 实例总数 |

**POST /instances** 请求体：
```json
{
  "name": "redis-prod",       // string, 必填
  "type": "redis",            // string, 必填 (redis/kafka/rabbitmq/mysql/postgresql/elasticsearch/mongodb/nginx)
  "version": "7.0",           // string, 可选
  "host": "10.0.0.1",        // string, 必填
  "port": 6379,              // int, 可选
  "config": {"maxmemory": "2gb"},  // object, 可选
  "labels": {"env": "prod"}        // object, 可选
}
```

**GET /instances** 查询参数：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | int | 1 | 页码 |
| page_size | int | 20 | 每页条数（最大 100） |
| type | string | — | 按中间件类型筛选 |
| status | string | — | 按状态筛选（healthy/degraded/unhealthy/unknown） |

**GET /count** 响应：
```json
{"count": 42}
```

**列表接口统一响应格式**：
```json
{"data": [...]}
```

#### 备份管理 (Backup)

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/backups` | `middleware_ops:execute` | 创建备份记录 |
| GET | `/instances/:id/backups` | — | 查询实例的备份列表 |

**POST /backups** 请求体：
```json
{
  "instance_id": "uuid-xxx"  // string, 必填
}
```

#### 指标 (Metrics)

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/metrics` | `middleware_ops:write` | 记录指标 |
| GET | `/metrics` | — | 列表指标（支持分页、middleware_id/metric_name 筛选） |

**POST /metrics** 请求体：
```json
{
  "middleware_id": "uuid-xxx",  // string, 必填
  "metric_name": "cpu_usage",   // string, 必填
  "value": 85.5,               // float64, 必填
  "unit": "percent"             // string, 必填
}
```

#### 连接池 (Connection Pool)

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/connection-pools` | `middleware_ops:write` | 记录连接池快照，>= 90% 自动告警 |
| GET | `/connection-pools` | — | 列表连接池（支持分页、middleware_id 筛选） |

**POST /connection-pools** 请求体：
```json
{
  "middleware_id": "uuid-xxx",  // string, 必填
  "pool_name": "main-pool",    // string, 必填
  "active": 90,                // int, 必填
  "idle": 5,                   // int, 可选
  "max": 100,                  // int, 必填
  "waiting": 2                 // int, 可选
}
```

#### 消息队列统计 (MQ Stats)

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/mq-stats` | `middleware_ops:write` | 记录消息队列统计，积压 >10K 自动告警 |
| GET | `/mq-stats` | — | 列表 MQ 统计（支持分页、middleware_id 筛选） |

**POST /mq-stats** 请求体：
```json
{
  "middleware_id": "uuid-xxx",   // string, 必填
  "queue_name": "orders.queue", // string, 必填
  "message_count": 15000,       // int64, 可选
  "consumer_count": 3,          // int, 可选
  "messages_per_second": 120.5, // float64, 可选
  "avg_latency_ms": 45.2,       // float64, 可选
  "dead_letter_count": 5        // int64, 可选
}
```

#### 告警 (Alert)

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/alerts` | — | 列表告警（支持分页、severity/alert_type 筛选） |
| DELETE | `/alerts/:id` | `middleware_ops:delete` | 删除告警 |

#### 健康总览 (Health Summary)

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/health-summary` | — | 返回租户下中间件健康总览 |

**响应体**：
```json
{
  "total_instances": 10,
  "healthy_count": 7,
  "degraded_count": 2,
  "unhealthy_count": 1,
  "total_alerts": 5,
  "critical_alerts": 2,
  "health_score": 80
}
```

### 3.3 公共端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/healthz` | 健康检查，返回 `{"status": "ok"}` |

---

## 四、数据模型

### 4.1 实体关系图（文字描述）

```
MiddlewareInstance (1) ──── (N) BackupRecord
MiddlewareInstance (1) ──── (N) MiddlewareMetric
MiddlewareInstance (1) ──── (N) ConnectionPool
MiddlewareInstance (1) ──── (N) MessageQueueStats
MiddlewareInstance (1) ──── (N) MiddlewareAlert
```

所有实体均包含 `tenant_id` 字段，数据按租户隔离。

### 4.2 表结构

#### middleware_instances

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | 主键 |
| tenant_id | VARCHAR(64) | NOT NULL | 租户 ID |
| name | VARCHAR(255) | NOT NULL | 实例名称 |
| type | VARCHAR(64) | NOT NULL | 中间件类型（redis/kafka/rabbitmq/mysql/postgresql/elasticsearch/mongodb/nginx） |
| version | VARCHAR(64) | — | 版本号 |
| host | VARCHAR(255) | NOT NULL | 主机地址 |
| port | INTEGER | — | 端口 |
| status | VARCHAR(32) | NOT NULL, DEFAULT 'healthy' | 运行状态（healthy/degraded/unhealthy/unknown） |
| config | JSONB | — | 配置信息 |
| labels | JSONB | — | 标签 |
| created_at | TIMESTAMPTZ | NOT NULL | 创建时间 |
| updated_at | TIMESTAMPTZ | NOT NULL | 更新时间 |

#### backup_records

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | 主键 |
| tenant_id | VARCHAR(64) | NOT NULL | 租户 ID |
| instance_id | UUID | NOT NULL, FK → middleware_instances.id | 关联实例 |
| status | VARCHAR(32) | NOT NULL | 备份状态（running/completed/failed） |
| size_bytes | BIGINT | — | 备份文件大小 |
| location | VARCHAR(512) | — | 存储位置（如 S3 路径） |
| started_at | TIMESTAMPTZ | NOT NULL | 备份开始时间 |
| completed_at | TIMESTAMPTZ | — | 备份完成时间 |

#### middleware_metrics

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | 主键 |
| tenant_id | VARCHAR(64) | NOT NULL | 租户 ID |
| middleware_id | UUID | NOT NULL | 关联实例 ID |
| metric_name | VARCHAR(128) | NOT NULL | 指标名称（如 cpu_usage, memory_usage, connections） |
| value | DOUBLE PRECISION | NOT NULL | 指标值 |
| unit | VARCHAR(64) | NOT NULL | 单位（如 percent, bytes, count, ms） |
| timestamp | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 采集时间 |

#### connection_pools

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | 主键 |
| tenant_id | VARCHAR(64) | NOT NULL | 租户 ID |
| middleware_id | UUID | NOT NULL | 关联实例 ID |
| pool_name | VARCHAR(255) | NOT NULL | 连接池名称 |
| active | INTEGER | NOT NULL | 活跃连接数 |
| idle | INTEGER | — | 空闲连接数 |
| max_conn | INTEGER | NOT NULL | 最大连接数 |
| waiting | INTEGER | — | 等待连接数 |
| total_created | BIGINT | — | 累计创建连接数 |
| total_closed | BIGINT | — | 累计关闭连接数 |
| timestamp | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 采集时间 |

#### message_queue_stats

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | 主键 |
| tenant_id | VARCHAR(64) | NOT NULL | 租户 ID |
| middleware_id | UUID | NOT NULL | 关联实例 ID |
| queue_name | VARCHAR(255) | NOT NULL | 队列名称 |
| message_count | BIGINT | — | 消息积压数 |
| consumer_count | INTEGER | — | 消费者数量 |
| messages_per_second | DOUBLE PRECISION | — | 每秒处理消息数 |
| avg_latency_ms | DOUBLE PRECISION | — | 平均延迟（毫秒） |
| dead_letter_count | BIGINT | — | 死信数量 |
| timestamp | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 采集时间 |

#### middleware_alerts

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | 主键 |
| tenant_id | VARCHAR(64) | NOT NULL | 租户 ID |
| middleware_id | UUID | NOT NULL | 关联实例 ID |
| middleware_name | VARCHAR(255) | — | 实例名称（冗余，便于展示） |
| alert_type | VARCHAR(64) | NOT NULL | 告警类型（connection_pool_exhaustion/high_latency/queue_backlog/node_down/replication_lag） |
| severity | VARCHAR(32) | NOT NULL | 严重程度（info/warning/critical） |
| message | TEXT | — | 告警消息 |
| value | DOUBLE PRECISION | — | 触发值 |
| threshold | DOUBLE PRECISION | — | 阈值 |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 创建时间 |

### 4.3 常量定义

| 名称 | 值 | 说明 |
|------|-----|------|
| 实例状态 | healthy / degraded / unhealthy / unknown | 中间件实例健康状态 |
| 告警类型 | connection_pool_exhaustion / high_latency / queue_backlog / node_down / replication_lag | 告警分类 |
| 告警级别 | info / warning / critical | 严重程度 |
| 中间件类型 | redis / kafka / rabbitmq / mysql / postgresql / elasticsearch / mongodb / nginx | 支持的 8 种中间件 |

### 4.4 自动告警规则

#### 连接池耗尽 (池使用率 >= 90%)

- **告警类型**: `connection_pool_exhaustion`
- **严重程度**: `critical`
- **触发条件**: `active / max * 100 >= 90`
- **创建方式**: RecordConnectionPool 业务逻辑中自动触发（best-effort，不阻塞主流程）

#### 消息队列积压

| 消息数 | 严重程度 |
|--------|---------|
| > 10,000 | warning |
| > 50,000 | critical |

- **告警类型**: `queue_backlog`
- **创建方式**: RecordMqStats 业务逻辑中自动触发（best-effort）

### 4.5 健康评分算法

```
healthScore = (healthy * 100 + degraded * 50) / total
```

- 当 `total = 0` 时，`healthScore = 100`（空集群默认满分）
- healthy: 100 分
- degraded: 50 分
- unhealthy: 0 分

---

## 五、依赖与集成

### 5.1 内部依赖

| 依赖 | 用途 | 关键函数/组件 |
|------|------|-------------|
| `orion/go-common/pkg/auth` | JWT 认证 + RBAC | `auth.Auth()`, `auth.RequirePermission()`, `auth.AuthConfig{JWTSecret, RedisClient}` |
| `orion/go-common/pkg/database` | PostgreSQL 连接管理 | `database.Connect()`, `database.RunMigrations()`, `database.DefaultConfig()` |
| `orion/go-common/pkg/redis` | Redis 客户端 | `orionredis.NewClient()`, `orionredis.Config{Addr}` |
| `orion/go-common/pkg/logger` | 结构化日志 | `orionlog.DefaultConfig()`, `orionlog.Must()` |
| `orion/go-common/pkg/middleware` | HTTP 中间件 | `Recovery()`, `RequestID()`, `StructuredLogger()`, `CORS()` |

### 5.2 外部依赖

| 依赖 | 用途 | 版本 |
|------|------|------|
| PostgreSQL | 持久化存储 | >= 14 |
| Redis | JWT 会话缓存 | >= 6.x |
| Gin | HTTP 框架 | v1.10.0 |
| sqlx | SQL 扩展 | v1.4.0 |
| google/uuid | UUID 生成 | v1.6.0 |

### 5.3 集成场景

| 场景 | 说明 |
|------|------|
| 前端页面 | 预期由可观测性模块下的中间件运维管理页面消费 |
| 告警通知 | 告警数据可供告警通知服务消费（当前告警只存储在表中，未集成通知推送） |
| API Gateway | 请求通过 API Gateway 代理至本服务（标准 Orion 微服务模式） |
| 指标聚合 | MiddlewareMetric 表可作为 Prometheus 等外部监控系统的补充数据源 |

### 5.4 迁移与 DB 操作

- 启动时自动执行 `migrations/` 目录下的 SQL 迁移文件
- 迁移由 `go-common/pkg/database.RunMigrations()` 执行

---

## 六、注意事项

### 6.1 已知限制

1. **告警仅存储，不推送**：告警被写入 `middleware_alerts` 表，但当前版本未集成通知推送（邮件/IM/Webhook）。如需告警分发，需对接 Orion 的通知服务。
2. **指标无过期策略**：`middleware_metrics` 表数据持续增长，当前无自动清理（TTL/归档）机制，生产环境需补充定时清理任务。
3. **备份为记录型而非执行型**：`backup_records` 仅记录备份元数据（谁、什么时间、备份了哪个实例），不包含实际的备份执行逻辑（dump/upload）。实际备份操作应由外部编排工具（如 CronJob）执行后调用 API 记录结果。
4. **无缓存层**：所有列表查询直接查询 PostgreSQL，高频访问场景可能需要引入缓存。
5. **健康评分仅含实例健康**：当前评分只计算实例状态，未纳入告警数量、MTTR 等维度。

### 6.2 安全注意事项

1. **JWT_SECRET 默认值**：`config.go` 中默认值为 `"change-me-in-production"`，**生产环境必须通过环境变量覆盖**。
2. **ACL 粒度**：当前使用 `middleware_ops:{write,delete,execute}` 三级权限。实际部署时需与 RBAC 系统对齐。

### 6.3 运维建议

1. **配置文件**：所有配置通过环境变量注入，无需配置文件。
2. **监控**：建议对以下指标进行监控：
   - 请求延迟（P50/P95/P99）
   - 告警写入成功率（当前为 best-effort，需追踪失败次数）
   - 实例总数及健康分布变化趋势
3. **资源估算**：指标/连接池/MQ 统计表按时间序列增长，建议根据采集频率估算存储量，并配置定期归档策略。
4. **连接池配置**：数据库连接池参数（最大连接数、超时）在 `database.DefaultConfig()` 中管理，需根据并发量调整。

### 6.4 后续规划建议

| 优先级 | 建议项 | 说明 |
|--------|--------|------|
| P0 | 指标表 TTL 策略 | 避免 `middleware_metrics` 无限增长 |
| P0 | 生产环境密钥轮换 | JWT_SECRET 和数据库密码管理 |
| P1 | 告警通知集成 | 对接 Orion 通知服务实现主动推送 |
| P1 | 备份执行能力 | 集成实际的备份 dump/upload/restore 逻辑 |
| P2 | 指标聚合/降采样 | 对历史指标进行聚合降采样，支持长时间范围查询 |
| P2 | 前端页面 | 开发中间件运维管理 UI |
| P3 | 多维度健康评分 | 引入告警、延迟、可用性等多维度的综合评分 |
