# 通知服务 Spec 文档

**服务目录**: `orion-notification-svc-go/`
**生成日期**: 2026-07-03
**状态**: 编写中
**成熟度**: L1（初始定义）
**对应设计文档**: `docs/services/notification/01-notification-spec.md`（平台级）

---

## 一、服务定位

### 1.1 职责

通知服务的核心职责是**统一的告警与消息分发**。它作为 Orion 平台所有模块（Pipeline、工单、监控、部署、审批等）的通知出口，将各类事件转化为面向用户的多渠道消息。

### 1.2 关键能力

| 能力 | 当前实现 | 备注 |
|------|---------|------|
| 通知发送 | ✅ CRUD + 异步投递 | POST /notifications 创建并触发 delivery |
| 通知查询 | ✅ 分页 + 按 user/status 过滤 | GET /notifications |
| 已读/未读 | ✅ 单条标记 + 未读数统计 | 无批量标记已读 |
| 广播 | ✅ 多用户批量发送 | 逐个创建，标记 in-app |
| 模板管理 | ✅ CRUD | 当前按 name 查询，无变量替换引擎 |
| 渠道配置 | ✅ CRUD | 按类型存储 JSONB config |
| 用户偏好设置 | ✅ CRUD 含默认值自动创建 | 15+ 事件类型 toggle + 免打扰 |
| 渠道订阅 | ✅ 用户订阅/退订 | ON CONFLICT upsert |
| 多渠道投递 | ⚠️ 框架就绪 | Slack + Webhook dispatcher 已实现，Email/SMS 待对接 |
| 事件发布 | ⚠️ 框架就绪 | EventPublisher interface 已定义，未绑定具体消息队列 |
| 投递重试 | ❌ 未实现 | 当前 single-shot，无重试逻辑 |
| 摘要/聚合 | ❌ 未实现 | digest_frequency 字段已存在但无定时任务 |
| 免打扰 | ⚠️ 字段已存在 | quiet_hours_start/end 已入库，未在 dispatch 中校验 |

### 1.3 与平台设计文档的差异

参考 `01-notification-spec.md`（平台级 L2→L3 设计），当前 Go 服务实现存在以下偏差：

| 项目 | 平台文档设计 | Go 服务实际实现 | 差异分析 |
|------|------------|---------------|---------|
| 通知 API 路径 | `/api/v1/notifications/send` | `POST /api/v1/notifications` | Go 服务用 POST /notifications 替代了 /send |
| 批量标记已读 | `PUT /notifications/read-all` | ❌ 未实现 | 需补充 |
| 优先级 | `priority` 字段 (P0/P1/P2) | ❌ 无 priority 字段 | 存于 metadata 或新增列 |
| 钉钉/企业微信 | 预期集成 | ❌ 未实现 | 只有 Slack/Webhook dispatcher |
| 投递重试 | 最多 3 次递增重试 | ❌ 未实现 | deliverAsync 单次尝试 |
| 通知策略 | 事件→渠道映射、频率控制 | ❌ 未实现 | Settings 只有事件 toggle |
| 频控 | 5 分钟内不重复 | ❌ 未实现 | |

---

## 二、验收标准

### 2.1 功能验收

| # | 标准 | 验证方式 | 当前状态 |
|---|------|---------|:-------:|
| S1 | 发送通知：创建记录 + 异步投递 | POST /notifications → 201 + 查库记录 | ✅ |
| S2 | 列表查询：按 tenant + user + status 过滤分页 | GET /notifications?user_id=xxx&status=sent | ✅ |
| S3 | 标记已读：更新 status='read' + read_at | POST /notifications/:id/read → 200 | ✅ |
| S4 | 未读数统计：按 user 聚合 | GET /notifications/unread-count?user_id=xxx | ✅ |
| S5 | 通知删除：按 tenant 隔离删除 | DELETE /notifications/:id → 200 | ✅ |
| S6 | 广播：批量创建通知（in-app 渠道） | POST /notifications/broadcast | ✅ |
| S7 | 模板 CRUD：创建/列表/详情/删除 | POST/GET/GET/DELETE /templates | ✅ |
| S8 | 渠道配置 CRUD：含 JSONB config | POST/GET/GET/PUT/DELETE /channels | ✅ |
| S9 | 渠道订阅：用户 subscribe/unsubscribe | POST/DELETE /subscriptions | ✅ |
| S10 | 设置 CRUD：自动创建默认值 + 部分更新 | GET/PUT /settings | ✅ |
| S11 | 租户隔离：所有查询含 tenant_id 过滤 | 代码审计 + API 测试 | ✅ |
| S12 | JWT Auth：敏感操作需 permission guard | 代码审计 | ✅ |
| S13 | Slack 投递：webhook POST 到 Slack URL | 集成测试 | ⚠️ 框架就绪 |
| S14 | Webhook 投递：generic HTTP POST | 集成测试 | ⚠️ 框架就绪 |
| S15 | 事件发布：notification.created 事件 | 集成测试 | ⚠️ 未绑定 |
| S16 | 免打扰校验：quiet_hours 不投递 | API 测试 | ❌ 未实现 |
| S17 | 批量标记已读 | API 测试 | ❌ 未实现 |

### 2.2 非功能验收

| # | 标准 | 验证方式 | 当前状态 |
|---|------|---------|:-------:|
| NF1 | 接口响应时间 < 200ms (P99) | 压测 | ❌ 未测 |
| NF2 | 异步投递不阻塞 API 响应 | 代码审计 | ✅ goroutine |
| NF3 | 数据库连接池配置 | 代码审计 | ⚠️ 依赖 go-common 默认 |
| NF4 | OpenTelemetry 追踪 | 代码审计 | ✅ otel.Tracer |
| NF5 | 结构化日志 | 代码审计 | ✅ zap logger |
| NF6 | 健康检查端点 | GET /healthz | ✅ |

---

## 三、API 设计

### 3.1 基础信息

| 属性 | 值 |
|------|-----|
| 基础路径 | `/api/v1` |
| 框架 | Gin v1.10.0 |
| 认证 | `auth.Auth` middleware（JWT + Redis session），skip `/healthz` |
| 权限 | `auth.RequirePermission("notification", "write\|delete")` |
| 中间件栈 | Recovery → RequestID → StructuredLogger → CORS → Auth |
| 端口 | 8080（通过 `PORT` 环境变量配置） |

### 3.2 端点清单

#### 3.2.1 Notifications 通知核心

| 方法 | 路径 | 认证 | 权限 | 说明 |
|------|------|------|------|------|
| POST | `/api/v1/notifications` | ✅ | notification:write | 发送通知（创建 + 投递） |
| GET | `/api/v1/notifications` | ✅ | - | 分页列表（?user_id=&status=） |
| GET | `/api/v1/notifications/count` | ✅ | - | 租户下通知总数 |
| GET | `/api/v1/notifications/unread-count` | ✅ | - | 用户未读数（?user_id= 必填） |
| GET | `/api/v1/notifications/:id` | ✅ | - | 通知详情 |
| POST | `/api/v1/notifications/:id/read` | ✅ | notification:write | 标记已读 |
| DELETE | `/api/v1/notifications/:id` | ✅ | notification:delete | 删除通知 |
| POST | `/api/v1/notifications/broadcast` | ✅ | notification:write | 广播给多用户 |

**请求/响应示例**：

```
POST /api/v1/notifications
{
  "user_id": "u-001",
  "type": "pipeline_failed",
  "title": "Pipeline #123 失败",
  "channel": "slack",
  "recipient": "#dev-alerts",
  "subject": "[Orion] Pipeline 失败通知",
  "body": "Pipeline orion-build-123 在 build 阶段失败",
  "metadata": {"pipeline_id": "pl-123", "phase": "build"}
}
→ 201 { "data": { "id": "...", "status": "sent", ... } }
```

```
GET /api/v1/notifications?user_id=u-001&status=sent&page=1&page_size=20
→ 200 { "data": [...], "total": 42, "page": 1 }
```

```
POST /api/v1/notifications/broadcast
{
  "user_ids": ["u-001", "u-002", "u-003"],
  "type": "system_alert",
  "title": "系统维护通知",
  "message": "系统将于今晚 22:00 维护"
}
→ 201 { "sent": 3 }
```

#### 3.2.2 Templates 模板管理

| 方法 | 路径 | 认证 | 权限 | 说明 |
|------|------|------|------|------|
| POST | `/api/v1/templates` | ✅ | notification:write | 创建模板 |
| GET | `/api/v1/templates` | ✅ | - | 模板列表 |
| GET | `/api/v1/templates/:id` | ✅ | - | 模板详情 |
| DELETE | `/api/v1/templates/:id` | ✅ | notification:delete | 删除模板 |

#### 3.2.3 Channels 渠道配置

| 方法 | 路径 | 认证 | 权限 | 说明 |
|------|------|------|------|------|
| POST | `/api/v1/channels` | ✅ | notification:write | 创建渠道配置 |
| GET | `/api/v1/channels` | ✅ | - | 渠道列表 |
| GET | `/api/v1/channels/:id` | ✅ | - | 渠道详情 |
| PUT | `/api/v1/channels/:id` | ✅ | notification:write | 更新渠道 |
| DELETE | `/api/v1/channels/:id` | ✅ | notification:delete | 删除渠道 |

**请求/响应示例**：

```
POST /api/v1/channels
{
  "name": "生产环境 Slack",
  "type": "slack",
  "config": {
    "webhook_url": "https://hooks.slack.com/services/xxx"
  },
  "enabled": true
}
→ 201 { "data": { "id": "...", ... } }
```

#### 3.2.4 Settings 用户偏好

| 方法 | 路径 | 认证 | 权限 | 说明 |
|------|------|------|------|------|
| GET | `/api/v1/settings` | ✅ | - | 获取设置（?user_id= 必填），无记录时自动创建默认值 |
| PUT | `/api/v1/settings` | ✅ | notification:write | 更新设置（部分更新，指针字段仅非 nil 时覆盖） |

**事件类型配置项**（15 个 toggle 字段）：

| 字段 | 说明 | 默认值 |
|------|------|:------:|
| `pipeline_completed` | Pipeline 完成 | `true` |
| `pipeline_failed` | Pipeline 失败 | `true` |
| `ticket_assigned` | 工单分配 | `true` |
| `ticket_escalated` | 工单升级 | `true` |
| `sla_warning` | SLA 预警 | `true` |
| `sla_breached` | SLA 违反 | `true` |
| `alert_triggered` | 告警触发 | `true` |
| `deployment_success` | 部署成功 | `true` |
| `deployment_failed` | 部署失败 | `true` |
| `system_alert` | 系统告警 | `true` |
| `comment_mention` | @提及 | `true` |
| `transfer_request` | 转交请求 | `true` |
| `digest_enabled` | 摘要开关 | `false` |
| `digest_frequency` | 摘要频率 | `daily` |
| `quiet_hours_start/end` | 免打扰时段 | `nil` |

#### 3.2.5 Subscriptions 渠道订阅

| 方法 | 路径 | 认证 | 权限 | 说明 |
|------|------|------|------|------|
| GET | `/api/v1/subscriptions` | ✅ | - | 用户订阅列表（?user_id= 必填） |
| POST | `/api/v1/subscriptions` | ✅ | notification:write | 订阅渠道 |
| DELETE | `/api/v1/subscriptions/:channel` | ✅ | notification:delete | 退订渠道 |

### 3.3 分页规范

| 参数 | 类型 | 默认 | 最大 | 说明 |
|------|------|:----:|:---:|------|
| `page` | int | 1 | - | 页码 |
| `page_size` | int | 20 | 100 | 每页条数 |

响应返回 `data`（数组）+ `total`（总数）+ `page`（当前页）。

### 3.4 错误响应格式

所有错误响应使用统一格式：

```json
{
  "error": "描述性错误信息"
}
```

| HTTP 状态码 | 场景 |
|:----------:|------|
| 201 | 创建成功 |
| 200 | 查询/更新/删除成功 |
| 400 | 参数校验失败（ShouldBindJSON/ShouldBindQuery 错误） |
| 404 | 资源不存在 |
| 500 | 内部服务错误 |

---

## 四、数据模型

### 4.1 数据库

| 属性 | 值 |
|------|-----|
| 数据库 | PostgreSQL（通过 `orion/go-common/pkg/database` 连接） |
| ORM | `jmoiron/sqlx` — 手写 SQL + struct scan |
| 迁移工具 | 启动时自动执行 `migrations/` 目录的 SQL 文件 |
| 迁移文件 | 2 个：`001_create_notification_tables.sql` + `002_extend_notification_tables.sql` |

### 4.2 表结构

#### `notifications` — 通知记录

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | 客户端生成（uuid.New()） |
| tenant_id | VARCHAR(64) | NOT NULL | 租户 ID |
| user_id | VARCHAR(64) | NOT NULL DEFAULT '' | 目标用户（002 迁移添加） |
| type | VARCHAR(64) | NOT NULL DEFAULT 'system' | 事件类型（002 迁移添加） |
| title | VARCHAR(512) | NOT NULL DEFAULT '' | 通知标题（002 迁移添加） |
| channel | VARCHAR(32) | NOT NULL | 投递渠道：email/slack/webhook/in-app |
| recipient | VARCHAR(256) | NOT NULL | 收件地址 / Slack channel / user ID |
| subject | VARCHAR(512) | NOT NULL DEFAULT '' | 主题 |
| body | TEXT | NOT NULL DEFAULT '' | 正文 |
| status | VARCHAR(32) | NOT NULL DEFAULT 'pending' | `pending`/`sent`/`failed`/`read` |
| metadata | JSONB | NOT NULL DEFAULT '{}' | 扩展数据 |
| sent_at | TIMESTAMPTZ | - | 发送时间（002 迁移添加） |
| read_at | TIMESTAMPTZ | - | 阅读时间（002 迁移添加） |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | 创建时间 |

索引：`idx_notifications_tenant(tenant_id, created_at)`、`idx_notifications_user(user_id, status)`

#### `notification_templates` — 通知模板

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| tenant_id | VARCHAR(64) | NOT NULL | |
| name | VARCHAR(256) | NOT NULL | 模板名称 |
| channel | VARCHAR(32) | NOT NULL | 适用渠道 |
| subject | VARCHAR(512) | NOT NULL DEFAULT '' | 主题模板 |
| body | TEXT | NOT NULL DEFAULT '' | 正文模板 |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

索引：`idx_templates_tenant(tenant_id)`

#### `notification_channels` — 渠道配置

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| tenant_id | VARCHAR(64) | NOT NULL | |
| name | VARCHAR(256) | NOT NULL | 渠道名称 |
| type | VARCHAR(32) | NOT NULL | `email`/`slack`/`webhook`/`in-app` |
| config | JSONB | NOT NULL DEFAULT '{}' | 渠道配置（如 webhook_url） |
| enabled | BOOLEAN | NOT NULL DEFAULT true | 启用状态 |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

索引：`idx_channels_tenant(tenant_id)`

#### `notification_settings` — 用户偏好设置

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK DEFAULT gen_random_uuid() | |
| user_id | VARCHAR(64) | NOT NULL | 联合唯一 |
| tenant_id | VARCHAR(64) | NOT NULL | 联合唯一 |
| email_enabled | BOOLEAN | NOT NULL DEFAULT true | |
| slack_enabled | BOOLEAN | NOT NULL DEFAULT false | |
| webhook_enabled | BOOLEAN | NOT NULL DEFAULT false | |
| webhook_url | VARCHAR(1024) | - | |
| pipeline_completed ~ transfer_request | BOOLEAN | NOT NULL DEFAULT true | 13 个事件类型开关（见 3.2.4） |
| digest_enabled | BOOLEAN | NOT NULL DEFAULT false | |
| digest_frequency | VARCHAR(32) | NOT NULL DEFAULT 'daily' | |
| quiet_hours_start | VARCHAR(8) | - | HH:MM 格式 |
| quiet_hours_end | VARCHAR(8) | - | HH:MM 格式 |
| created_at / updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

唯一约束：`UNIQUE(user_id, tenant_id)`

#### `notification_subscriptions` — 渠道订阅

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK DEFAULT gen_random_uuid() | |
| tenant_id | VARCHAR(64) | NOT NULL | 联合唯一 |
| user_id | VARCHAR(64) | NOT NULL | 联合唯一 |
| channel | VARCHAR(64) | NOT NULL | 联合唯一 |
| enabled | BOOLEAN | NOT NULL DEFAULT true | |
| created_at / updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

唯一约束：`UNIQUE(tenant_id, user_id, channel)`

### 4.3 Go 模型（`internal/models/models.go`）

| 结构体 | 对应表 | 特殊处理 |
|--------|--------|---------|
| `Notification` | notifications | `JSONB` 自定义类型实现 `driver.Valuer` / `sql.Scanner` |
| `NotificationTemplate` | notification_templates | 无 |
| `NotificationChannel` | notification_channels | `Config` 字段为 `JSONB` |
| `NotificationSettings` | notification_settings | 含 20+ 配置字段 |
| `NotificationSubscription` | notification_subscriptions | 无 |
| `CreateNotificationRequest` | - | `binding:"required"` 校验 |
| `BroadcastRequest` | - | `UserIDs` 最小 1 人 |
| `UpdateSettingsRequest` | - | 全部指针字段，仅非 nil 时更新 |
| `SubscribeRequest` | - | `Channel` 必填 |
| `PaginatedRequest` | - | 含 `Offset()` / `Limit()` helper |
| `ListNotificationsQuery` | - | 嵌入 `PaginatedRequest` + `UserID` / `Status` |

**生命周期枚举**（`NotificationStatus`）：
```
pending → sent → read
       ↘ failed
```

**渠道类型枚举**（`ChannelType`）：
```
email | slack | webhook | in-app
```

---

## 五、依赖与集成

### 5.1 外部依赖（Go module）

| 依赖 | 用途 | 版本 |
|------|------|------|
| `github.com/gin-gonic/gin` | HTTP 框架 | v1.10.0 |
| `github.com/google/uuid` | UUID 生成 | v1.6.0 |
| `github.com/jmoiron/sqlx` | SQL 扩展 | v1.4.0 |
| `github.com/lib/pq` | PostgreSQL driver | v1.10.9（间接） |
| `orion/go-common` | 共享库（database/auth/logger/middleware/otel/redis） | local replace → `../orion-go-common` |

### 5.2 内部模块

| 层 | 目录 | 职责 |
|----|------|------|
| 入口 | `cmd/server/main.go` | 启动服务、加载配置、初始化依赖、注册路由 |
| 配置 | `internal/config/config.go` | 环境变量读取（PORT/DB_*/JWT_SECRET/REDIS_ADDR） |
| 处理器 | `internal/handler/handler.go` | HTTP 请求解析 + 响应组装（20 个 handler） |
| 服务 | `internal/service/notification_service.go` | 业务逻辑 + ChannelDispatcher 接口 + 内置 dispatcher 实现 |
| 仓储 | `internal/repository/notification_repository.go` | SQL CRUD（12 组操作） |
| 模型 | `internal/models/models.go` | 数据模型 + DTO + 枚举 + JSONB 类型 |
| 中间件 | `internal/middleware/` | 当前为空（中间件由 go-common 提供） |
| 迁移 | `migrations/` | 2 个 SQL 迁移文件 |
| 测试 | `tests/` + `internal/service/service_test.go` | 少量 |

### 5.3 架构分层

```
┌─────────────┐     Gin Router + Auth Middleware
│   Handler    │ ←── (orion/go-common/pkg/auth + middleware)
├─────────────┤
│   Service    │ ←── EventPublisher (interface) → Kafka/NATS/EventBus
│              │ ←── ChannelDispatcher (interface) → Slack/Webhook/Email
├─────────────┤
│  Repository  │ ←── sqlx.DB → PostgreSQL
├─────────────┤
│   Models     │     Data structs + JSONB + DTOs
└─────────────┘
```

**依赖方向**：Handler → Service → Repository → DB

**扩展点**：
1. `EventPublisher` 接口：当前 `nil`，绑定消息队列后可发布 `notification.created`、`notification.broadcast` 事件
2. `ChannelDispatcher` 接口：已实现 Slack + Webhook dispatcher，可扩展 Email、SMS、钉钉、企微
3. `MultiChannelDispatcher` 组合模式：按 `ChannelType` 路由到具体 dispatcher

### 5.4 外部集成

| 集成点 | 状态 | 说明 |
|--------|:----:|------|
| PostgreSQL | ✅ | 核心数据存储 |
| Redis | ✅ | JWT session 管理（auth middleware 使用） |
| Slack Webhook | ⚠️ | Dispatcher 已实现，需要实际 webhook URL |
| Generic Webhook | ⚠️ | Dispatcher 已实现 |
| Event Bus (Kafka/NATS) | ❌ | EventPublisher interface 已定义，未绑定 |
| SMTP Email | ❌ | 未实现 |
| 钉钉机器人 | ❌ | 未实现 |
| 企业微信机器人 | ❌ | 未实现 |
| SMS (阿里云/腾讯云) | ❌ | 未实现 |

### 5.5 配置清单

| 环境变量 | 默认值 | 必填 | 说明 |
|----------|:------:|:----:|------|
| `PORT` | 8080 | 否 | HTTP 监听端口 |
| `DB_HOST` | localhost | 否 | 数据库主机 |
| `DB_PORT` | 5432 | 否 | 数据库端口 |
| `DB_USER` | - | **是** | 数据库用户 |
| `DB_PASSWORD` | - | **是** | 数据库密码 |
| `DB_NAME` | orion_notification | 否 | 数据库名 |
| `DB_SSLMODE` | disable | 否 | SSL 模式 |
| `JWT_SECRET` | change-me-in-production | 否 | JWT 密钥 |
| `REDIS_ADDR` | localhost:6379 | 否 | Redis 地址 |

---

## 六、注意事项

### 6.1 已知问题

| # | 问题 | 影响 | 建议修复 |
|---|------|------|---------|
| 1 | `service.go` 中 `deliverAsync` 的 HTTP request body 未实际写入 | Slack/Webhook 投递发空请求 | `req.Body` 需设置为 `io.NopCloser(bytes.NewReader(jsonPayload))` |
| 2 | `strPtr` helper 在 `handler.go` 中未使用 | 死代码 | 考虑移除或用于分页默认值 |
| 3 | 无批量标记已读端点 | 前端批量操作需循环调用 | 新增 `POST /notifications/read-all`（body: `{user_ids: []}`） |
| 4 | 无通知策略引擎 | 事件→渠道映射在 Service 层硬编码 | 按 `01-notification-spec.md` 设计实现策略表 |
| 5 | `go.mod` 中 `go 1.25.0` 非标准版本号 | 可能引起工具链兼容问题 | 确认 Go 工具链版本后修正 |
| 6 | `tests/` 和 `api/` 目录为空 | 无集成测试 | 补充 |
| 7 | `migrations/` 目录不存在时静默跳过（main.go L41-45） | 初始化时可能遗漏迁移 | 日志应输出 warning 而非静默 |
| 8 | `JWT_SECRET` 默认值 `"change-me-in-production"` | 生产环境有安全风险 | 建议改为 `requireEnv` 或启动时检查 |

### 6.2 待实现功能

| 优先级 | 功能 | 参考设计 |
|:------:|------|---------|
| P0 | 修复 Slack/Webhook dispatcher body 未发送 bug | 当前发空请求，需设置 `req.Body` |
| P0 | 补充批量标记已读 API | 01-spec §3.1 |
| P1 | 投递重试机制（3 次递增） | 01-spec §2.1 N6 |
| P1 | 免打扰校验（dispatch 前检查 quiet_hours） | 01-spec §2.2 P4 |
| P1 | Email dispatcher 实现（SMTP） | 01-spec §2.1 N1 |
| P2 | EventPublisher 绑定 Kafka/NATS | - |
| P2 | 摘要通知定时任务（digest_frequency） | - |
| P2 | 钉钉/企微机器人 dispatcher | 01-spec §2.1 N3/N4 |
| P2 | 通知优先级字段 + 调度 | 01-spec §2.2 P2 |
| P3 | 频率控制（同一事件 5 分钟内不重复） | 01-spec §2.2 P3 |
| P3 | 批量通知删除 | - |

### 6.3 设计决策记录

| # | 决策 | 理由 |
|---|------|------|
| D1 | UUID 由客户端生成而非数据库 auto-generate | 001 迁移使用 `UUID PRIMARY KEY` 无 default，Service 层调用 `uuid.New().String()`。002 迁移新增表使用 `gen_random_uuid()` 作为 default |
| D2 | status 用 varchar 而非 enum | 简化迁移，约束在代码层 |
| D3 | 设置使用 `UNIQUE(user_id, tenant_id)` 而非独立 id 为主键 | 确保每个 tenant 下每个用户只有一条设置记录，Upsert 语义清晰 |
| D4 | dispatcher 异步 goroutine 执行 | 不阻塞 API 响应，使用 `context.WithTimeout` 30s 防止 goroutine 泄漏 |
| D5 | 渠道配置存储为 JSONB | 不同渠道（Slack/Email/Webhook）配置字段差异大，JSONB 灵活且可索引 |
| D6 | 默认设置自动创建（首次 GET /settings） | 避免首次使用时 404，默认打开所有事件类型 |
| D7 | 中间件由 go-common 提供而非本地实现 | 与平台其他 Go 服务复用相同的 Recovery/RequestID/Logger/CORS/Auth |

### 6.4 与现有平台的的关系

- **当前部署形态**：Go 微服务蓝图，独立可编译，但当前 Orion 平台的通知功能由 `orion-platform-service` 提供（TypeScript 实现）
- **迁移策略**：此 Go 服务可作为通知能力独立部署的候选，需完成 P0/P1 修复后达到 L2 成熟度
- **API 兼容性**：当前 API 路径与 `01-notification-spec.md` §3 平台设计略有不同（见 §1.3），需在集成前端时对齐

---

_文档版本: v1.0 | 生成日期: 2026-07-03 | 成熟度: L1（初始定义）_
