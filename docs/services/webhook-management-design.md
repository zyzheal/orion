# S13 Webhook Management 设计文档

> 模块代号: S13 | 状态: 已实现 | 最后更新: 2026-05-15

## 1. 模块概述

Webhook Management (S13) 是 Orion 平台的外部系统事件通知模块，负责管理平台级 Webhook 配置、事件分发、投递追踪与重试。该模块使外部系统能够通过 HTTP 回调接收 Orion 平台内部事件（如 Pipeline 完成、部署成功、告警触发等），实现平台与第三方系统的松耦合集成。

### 1.1 核心能力

| 能力 | 说明 |
|------|------|
| Webhook CRUD | 创建、查询、更新、删除 Webhook 配置，按租户隔离 |
| 事件过滤 | 每个 Webhook 可订阅多个事件类型，仅匹配事件触发投递 |
| 投递追踪 | 每次投递生成 DeliveryLog，记录 HTTP 状态码、响应体、重试次数 |
| 重试机制 | 指数退避策略（1s, 2s, 4s），默认最多重试 3 次 |
| HMAC 签名 | 可选的 Secret 字段用于 HMAC-SHA256 签名验证（接收端校验） |
| 手动触发 | 支持对单个 Webhook 手动触发测试，或按事件类型批量触发 |

### 1.2 技术栈

- **后端**: Node.js + TypeScript + Fastify
- **数据库**: PostgreSQL (Migration 021)
- **存储模式**: PostgreSQL Repository Pattern
- **前端**: React + Ant Design

### 1.3 与其他 Webhook 模块的边界

Orion 平台存在多个 Webhook 相关模块，职责如下：

| 模块 | 位置 | 职责 |
|------|------|------|
| **S13 Webhook Management** | `services/webhook/` | 平台级 Webhook 管理，主动向外投递事件 |
| **Code Repo Webhook** | `services/code-repo/WebhookService.ts` | 接收来自 GitLab/GitHub/Gerrit 的入站 Webhook |
| **Pipeline Webhook** | `services/pipeline/WebhookNotifier.ts` | Pipeline 运行结果通知（per-pipeline 配置） |
| **ChatOps Webhook** | `services/chatops/WebhookVerifier.ts` | ChatOps 平台 Webhook 验证 |
| **Multimodal Trigger** | `services/multi-modal-trigger/WebhookTriggerHandler.ts` | 多模态触发器中的 Webhook 注册 |

S13 是**出站 Webhook**（Orion -> 外部系统）的统一管理层，其余模块各有专攻。

## 2. 架构设计

### 2.1 分层架构

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (orion-frontend)                              │
│  /console/webhooks  - WebhookManagement 页面             │
│  api/webhook.ts     - API 客户端                         │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP
┌──────────────────────▼──────────────────────────────────┐
│  API Routes (webhook-routes.ts)                         │
│  Prefix: /api/v1/webhooks                               │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  Controller (WebhookController)                         │
│  - 参数校验、错误映射、HTTP 状态码                        │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  Service (WebhookService)                               │
│  - 业务逻辑、事件匹配、HTTP 投递、指数退避重试             │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  Repository (WebhookRepository)                         │
│  - SQL 操作、Row Mapping、Delivery 记录                   │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  PostgreSQL (Migration 021)                             │
│  - webhooks 表 / webhook_deliveries 表                   │
└─────────────────────────────────────────────────────────┘
```

### 2.2 依赖注入

```typescript
// webhook-routes.ts 中的组装
const webhookRepo = new WebhookRepository(databasePool);
const webhookService = new WebhookService(webhookRepo);
const controller = new WebhookController(webhookService);
```

各层职责明确：
- **Routes**: 路由注册、实例化依赖
- **Controller**: HTTP 层关注点（请求解析、状态码、错误响应格式）
- **Service**: 业务逻辑（校验、事件匹配、HTTP 投递、重试）
- **Repository**: 数据访问（SQL 查询、行映射）

## 3. Webhook 生命周期

```
  ┌─────────┐     ┌──────────┐     ┌───────────┐     ┌──────────┐     ┌─────────┐
  │  Create │────▶│  Trigger │────▶│  Deliver  │────▶│  Track   │────▶│  Retry  │
  │  创建    │     │  触发     │     │  投递      │     │  追踪     │     │  重试    │
  └─────────┘     └──────────┘     └───────────┘     └──────────┘     └─────────┘
       │                │                  │                  │                 │
       │  POST /webhooks│  POST /:id/trigger│  HTTP POST       │  INSERT into   │  指数退避
       │  校验参数       │  POST /trigger-event              │  webhook_deliveries│  最多3次
       │  生成记录       │  事件匹配         │  10s 超时        │  记录状态码      │  1s/2s/4s
```

### 3.1 创建阶段

1. 客户端提交 `POST /api/v1/webhooks`，携带 `tenantId`, `name`, `url`, `events`, `secret`
2. Controller 校验必填字段（`tenantId`, `name`, `url`）
3. Service 二次校验后调用 Repository
4. Repository 执行 `INSERT INTO webhooks ... RETURNING *`
5. 返回创建的 Webhook 对象（`active = true` 默认启用）

### 3.2 触发阶段

触发方式有两种：

**手动触发单个 Webhook** (`POST /webhooks/:id/trigger`):
1. 校验 Webhook 存在且 `enabled = true`
2. 创建 DeliveryLog（状态 `pending`）
3. 执行 HTTP POST 投递

**事件批量触发** (`POST /webhooks/trigger-event`):
1. 查询租户下所有 Webhook
2. 过滤 `enabled = true` 且 `events` 包含目标事件的 Webhook
3. 逐一调用 `trigger()`，单个失败不影响其他

### 3.3 投递阶段

```typescript
// WebhookService.trigger() 核心逻辑
const response = await fetch(webhook.url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ event, payload, timestamp: new Date().toISOString() }),
  signal: controller.signal,  // 10s 超时
});
```

投递载荷格式：
```json
{
  "event": "pipeline.completed",
  "payload": { "pipelineId": "xxx", "status": "success" },
  "timestamp": "2026-05-15T10:30:00.000Z"
}
```

### 3.4 追踪阶段

每次投递（含首次和重试）均写入 `webhook_deliveries` 表：
- 成功：`status = 'delivered'`, `response_code = 2xx`
- 失败：`status = 'failed'`, `response_code = 500`, `response_body` 记录错误信息

### 3.5 重试阶段

指数退避策略：

```
Attempt 1: 立即执行
Attempt 2: 等待 2^(1-1) * 1000 = 1s
Attempt 3: 等待 2^(2-1) * 1000 = 2s
```

重试间隔离 = `2^(attempt - 1) * 1000ms`，即 1s、2s、4s。

所有重试失败后，标记为 `status = 'failed'` 并记录最终错误信息。

## 4. 事件过滤与匹配

### 4.1 事件注册

创建 Webhook 时通过 `events: string[]` 字段订阅感兴趣的事件：

```json
{
  "events": ["pipeline.completed", "pipeline.failed", "deployment.success"]
}
```

### 4.2 前端预定义事件

前端 `WebhookManagement/index.tsx` 定义了可选事件列表：

```typescript
const EVENT_OPTIONS = [
  'pipeline.completed', 'pipeline.failed',
  'deployment.success', 'deployment.failed',
  'alert.triggered', 'alert.resolved',
  'selfhealing.triggered', 'cost.anomaly',
];
```

### 4.3 匹配逻辑

```typescript
// WebhookService.triggerEvent()
const matching = webhooks.filter(w => w.enabled && w.events.includes(event));
```

匹配规则：
1. Webhook 必须 `enabled = true`
2. 事件类型必须出现在 `events` 数组中（精确字符串匹配）
3. 所有匹配的 Webhook 都会被触发，单个失败不阻断其他

### 4.4 事件命名规范

采用 `<领域>.<动作>` 格式：

| 事件 | 触发时机 |
|------|---------|
| `pipeline.completed` | Pipeline 运行完成 |
| `pipeline.failed` | Pipeline 运行失败 |
| `deployment.success` | 部署成功 |
| `deployment.failed` | 部署失败 |
| `alert.triggered` | 告警触发 |
| `alert.resolved` | 告警恢复 |
| `selfhealing.triggered` | 自愈执行 |
| `cost.anomaly` | 成本异常检测 |

## 5. HMAC 签名安全

### 5.1 设计说明

Webhook 配置中的 `secret` 字段用于接收端验证请求来源的合法性。当前实现中 `secret` 存储在数据库中以明文形式保存，推荐接收端使用 HMAC-SHA256 进行签名验证。

### 5.2 推荐签名方案

```
Header: X-Orion-Signature: sha256=<hex>
算法: HMAC-SHA256(secret, request_body)
```

接收端验证流程：
1. 使用共享的 `secret` 对请求体计算 HMAC-SHA256
2. 与 `X-Orion-Signature` 头比较
3. 不匹配则拒绝请求（返回 401）

### 5.3 入站签名验证（代码仓库）

`CodeRepoWebhookService` 已实现入站 Webhook 的签名验证，支持：

| 平台 | 验证方式 | Header |
|------|---------|--------|
| GitLab | 简单 Token | `X-Gitlab-Token` |
| GitHub | HMAC-SHA256 | `X-Hub-Signature-256` |

### 5.4 IP 白名单

`CodeRepoWebhookService` 支持 IP 白名单配置，两种模式：
- `allow`: 仅允许白名单中的 IP
- `deny`: 禁止白名单中的 IP

## 6. 投递重试策略

### 6.1 策略参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| 最大重试次数 | 3 | `retries` 参数可调整 |
| 超时时间 | 10s | `AbortController` 超时 |
| 退避公式 | `2^(n-1) * 1s` | 指数退避 |
| 实际延迟序列 | 1s, 2s, 4s | - |

### 6.2 重试代码实现

```typescript
for (let attempt = 1; attempt <= retries; attempt++) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, payload, timestamp: new Date().toISOString() }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const responseBody = await response.text();
    await this.repository.markDelivered(delivery.id, response.status, responseBody);
    return delivery;
  } catch (error) {
    lastError = error;
    if (attempt < retries) {
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
    }
  }
}
```

### 6.3 当前局限与改进方向

| 局限 | 改进建议 |
|------|---------|
| 重试期间同步阻塞 | 改为异步队列重试（NATS/Redis） |
| 固定重试次数 | 支持配置化最大重试次数 |
| 无 Webhook 级重试上限 | 增加 `failureCount` 字段，超过阈值自动禁用 |
| 无投递成功回调 | 增加 `next_retry_at` 调度支持 |

## 7. API 端点

基础路径: `POST /api/v1` (由 API Gateway 代理)

### 7.1 CRUD 操作

#### 创建 Webhook

```
POST /api/v1/webhooks
```

请求体：
```json
{
  "tenantId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Slack 通知",
  "url": "https://hooks.slack.com/services/T00/B00/XXX",
  "events": ["pipeline.completed", "pipeline.failed"],
  "secret": "my-secret-key"
}
```

响应（201）：
```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-...",
    "tenant_id": "550e8400-...",
    "name": "Slack 通知",
    "url": "https://hooks.slack.com/services/T00/B00/XXX",
    "events": ["pipeline.completed", "pipeline.failed"],
    "secret": "my-secret-key",
    "enabled": true,
    "created_at": "2026-05-15T10:00:00Z",
    "updated_at": "2026-05-15T10:00:00Z"
  }
}
```

#### 查询 Webhook 列表

```
GET /api/v1/webhooks?tenantId=550e8400-e29b-41d4-a716-446655440000
```

响应（200）：
```json
{
  "success": true,
  "data": [ ... ],
  "total": 5
}
```

#### 查询单个 Webhook

```
GET /api/v1/webhooks/:id
```

#### 更新 Webhook

```
PUT /api/v1/webhooks/:id
```

请求体（部分更新）：
```json
{
  "name": "新名称",
  "enabled": false
}
```

#### 删除 Webhook

```
DELETE /api/v1/webhooks/:id
```

### 7.2 触发与投递

#### 手动触发 Webhook

```
POST /api/v1/webhooks/:id/trigger
```

请求体：
```json
{
  "event": "pipeline.completed",
  "payload": { "pipelineId": "123", "status": "success" }
}
```

响应（200）：
```json
{
  "success": true,
  "data": {
    "id": "delivery-uuid",
    "webhook_id": "a1b2c3d4-...",
    "event": "pipeline.completed",
    "payload": { "pipelineId": "123", "status": "success" },
    "status": "delivered",
    "response_code": 200,
    "attempt": 1,
    "attempted_at": "2026-05-15T10:30:00Z"
  }
}
```

#### 按事件批量触发

```
POST /api/v1/webhooks/trigger-event
```

请求体：
```json
{
  "tenantId": "550e8400-...",
  "event": "pipeline.completed",
  "payload": { "pipelineId": "123" }
}
```

响应（200）：
```json
{
  "success": true,
  "data": { "triggered": 3 }
}
```

#### 查询投递日志

```
GET /api/v1/webhooks/:id/deliveries?limit=50
```

响应（200）：
```json
{
  "success": true,
  "data": [
    {
      "id": "delivery-uuid",
      "webhook_id": "a1b2c3d4-...",
      "event": "pipeline.completed",
      "payload": { ... },
      "status": "delivered",
      "response_code": 200,
      "response_body": "ok",
      "attempt": 1,
      "attempted_at": "2026-05-15T10:30:00Z"
    }
  ],
  "total": 1
}
```

### 7.3 错误响应

| 状态码 | 场景 |
|--------|------|
| 400 | 缺少必填参数 / Webhook 已禁用 |
| 404 | Webhook 不存在 |
| 500 | 服务器内部错误 |

错误响应格式统一为：
```json
{
  "success": false,
  "error": "错误描述信息"
}
```

## 8. 数据模型

### 8.1 Webhook 表

对应 Migration 021，`webhooks` 表结构：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID (PK) | 自动生成 |
| `tenant_id` | UUID (FK -> tenants) | 租户隔离，级联删除 |
| `name` | VARCHAR(200) | Webhook 名称 |
| `url` | VARCHAR(500) | 目标 URL |
| `secret` | VARCHAR(255) | HMAC 签名密钥（可选） |
| `events` | TEXT[] | 订阅的事件类型数组 |
| `active` | BOOLEAN (default: true) | 是否启用 |
| `created_at` | TIMESTAMPTZ | 创建时间 |
| `updated_at` | TIMESTAMPTZ | 更新时间 |

索引：
- `idx_webhooks_tenant` on `tenant_id`
- `idx_webhooks_tenant_rls` on `tenant_id` (RLS 策略)

RLS 策略：
- `tenant_isolation_policy`: 租户只能访问自己的 Webhook

### 8.2 Webhook Delivery 表

`webhook_deliveries` 表结构：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID (PK) | 自动生成 |
| `webhook_id` | UUID (FK -> webhooks) | 关联 Webhook，级联删除 |
| `event_type` | VARCHAR(100) | 触发的事件类型 |
| `payload` | JSONB | 投递的载荷数据 |
| `status` | VARCHAR(20) (default: 'pending') | 投递状态 |
| `response_code` | INT | HTTP 响应状态码 |
| `response_body` | TEXT | HTTP 响应体 |
| `attempt` | INT (default: 1) | 当前重试次数 |
| `next_retry_at` | TIMESTAMPTZ | 下次重试时间（预留） |
| `created_at` | TIMESTAMPTZ | 投递时间 |

索引：
- `idx_webhook_deliveries_webhook` on `webhook_id`
- `idx_webhook_deliveries_status` on `status`

### 8.3 TypeScript 接口映射

```typescript
// WebhookRepository.ts
export interface Webhook {
  id: string;
  tenant_id: string;
  name: string;
  url: string;
  events: string[];
  secret: string | null;
  enabled: boolean;     // 映射自 DB 'active' 列
  created_at: Date;
  updated_at: Date;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event: string;        // 映射自 DB 'event_type' 列
  payload: Record<string, any>;
  status: string;
  response_code: number | null;
  response_body: string | null;
  attempt: number;
  next_retry_at: Date | null;
  attempted_at: Date;   // 映射自 DB 'created_at' 列
}
```

### 8.4 前端接口

```typescript
// api/webhook.ts
export interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  enabled: boolean;
  lastTriggeredAt?: string;   // 前端展示用
  lastStatus?: number;         // 前端展示用
  failureCount: number;        // 前端展示用
  createdAt: string;
  updatedAt: string;
}

export interface WebhookLog {
  id: string;
  webhookId: string;
  event: string;
  status: number;
  response?: string;
  error?: string;
  createdAt: string;
}
```

## 9. 前端页面结构

### 9.1 页面位置

- **路由**: `/console/webhooks`
- **文件**: `orion-frontend/src/pages/WebhookManagement/index.tsx`
- **API 客户端**: `orion-frontend/src/api/webhook.ts`
- **权限**: `admin`, `platform_admin`

### 9.2 页面布局

```
┌──────────────────────────────────────────────────────────────┐
│  Webhook 管理                                    [刷新] [新建] │
│  平台 Webhook 配置与监控                                       │
├──────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐│
│  │ URL        │ 订阅事件    │ 状态 │ 失败次数 │ 最后状态 │ 操作 ││
│  │ https://.. │ [pipeline   │ [启用]│   0    │ [200]   │ 📤👁✏️🗑││
│  │            │  .completed] │       │         │         │    ││
│  │ https://.. │ [alert      │ [禁用]│   5    │ [500]   │ 📤👁✏️🗑││
│  │            │  .triggered] │       │         │         │    ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

### 9.3 组件结构

| 组件 | 用途 |
|------|------|
| `Table` | 主列表展示，列：URL、订阅事件、状态、失败次数、最后状态、最后触发、操作 |
| `Modal` (创建/编辑) | 表单字段：URL、订阅事件（多选）、Signing Secret、启用开关 |
| `Drawer` (日志) | 投递日志列表：事件、HTTP 状态、错误信息、时间 |
| `Tag` | 事件标签（蓝色）、状态标签（成功/失败） |
| `Popconfirm` | 删除确认弹窗 |

### 9.4 操作按钮

| 按钮 | 图标 | 行为 |
|------|------|------|
| 测试 | `SendOutlined` | 调用 `POST /webhooks/:id/test` |
| 日志 | `EyeOutlined` | 打开 Drawer 展示投递日志 |
| 编辑 | `EditOutlined` | 打开编辑 Modal |
| 删除 | `DeleteOutlined` | 确认后删除 |

### 9.5 前端 API 客户端

`api/webhook.ts` 提供的函数：

```typescript
getWebhooks()                    // GET  /v1/webhooks
getWebhook(id)                   // GET  /v1/webhooks/:id
createWebhook(input)             // POST /v1/webhooks
updateWebhook(id, input)         // PUT  /v1/webhooks/:id
deleteWebhook(id)                // DELETE /v1/webhooks/:id
testWebhook(id)                  // POST /v1/webhooks/:id/test
getWebhookLogs(id, limit?)       // GET  /v1/webhooks/:id/logs
```

### 9.6 前后端 API 路径差异说明

前端 API 客户端使用路径与后端路由存在命名差异：

| 前端 | 后端 | 差异 |
|------|------|------|
| `POST /v1/webhooks/:id/test` | `POST /webhooks/:id/trigger` | test vs trigger |
| `GET /v1/webhooks/:id/logs` | `GET /webhooks/:id/deliveries` | logs vs deliveries |

这些路径差异需要 API Gateway 层做路由映射，或统一前后端命名。

## 10. 集成点

### 10.1 代码仓库 Webhook 入站集成

`CodeRepoWebhookService` 接收来自代码仓库的入站 Webhook，处理后通过 EventBus 发布标准化事件：

```
GitLab/GitHub/Gerrit ──Webhook──▶ CodeRepoWebhookService ──publish──▶ EventBus
```

支持的事件类型：
- `code.pr.opened` / `code.pr.updated` / `code.pr.merged` / `code.pr.closed` / `code.pr.reviewed`
- `code.push`
- `code.branch.created` / `code.branch.deleted`

这些事件可以被 S13 Webhook 订阅，实现代码事件向第三方系统的转发。

### 10.2 EventBus 集成（缺失）

**当前状态**: `WebhookService` 未与 EventBus 集成。事件触发由调用方显式调用 `triggerEvent()` 实现。

**设计意图**: 理想架构下，平台内部事件（Pipeline、Deployment、Alert 等）通过 EventBus 发布，`WebhookService` 作为 EventBus 的订阅者，自动匹配并投递到注册的 Webhook。

**当前替代方案**: 各业务模块在事件发生时手动调用 `POST /webhooks/trigger-event`。

### 10.3 Pipeline 触发集成

`pipeline_triggers` 表（Migration 134）支持 Webhook 类型的 Pipeline 触发器：

```
外部系统 ──Webhook──▶ Orion API ──匹配 trigger──▶ 启动 Pipeline
```

触发类型：`git`, `webhook`, `schedule`, `manual`

### 10.4 Pipeline 出站通知集成

`pipeline_webhook_configs` 表（Migration 136）支持 per-pipeline 的出站 Webhook 配置：

```
Pipeline 完成 ──▶ PipelineWebhookNotifier ──▶ 目标 Webhook URL
```

这是独立于 S13 的另一条 Webhook 链路，专注于 Pipeline 场景。

### 10.5 多模态触发器集成

`webhook_registrations` 表（Migration 105）支持多模态触发器的 Webhook 注册：

```
Trigger 触发 ──▶ WebhookTriggerHandler ──▶ 注册的 Webhook 端点
```

触发类型：`webhook`, `schedule`, `event`, `manual`, `metric`, `code_change`

### 10.6 集成关系图

```
                         ┌─────────────────────┐
                         │    EventBus (NATS)   │
                         │   (未集成，规划中)     │
                         └──────────┬──────────┘
                                    │ 发布事件
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
  ┌─────▼──────┐          ┌────────▼─────────┐         ┌───────▼───────┐
  │ Code Repo  │          │   Pipeline       │         │   Alert/      │
  │ Webhook    │          │   Events         │         │   SelfHealing │
  │ (入站)      │          │   (内部)          │         │   (内部)       │
  └────────────┘          └──────────────────┘         └───────────────┘
                                                        │
                                    ┌───────────────────▼───────────────┐
                                    │     S13 Webhook Management        │
                                    │     (出站 Webhook 统一管理层)       │
                                    └───────────────────┬───────────────┘
                                                        │
                   ┌──────────────────────┬─────────────┼──────────────┐
                   │                      │             │              │
            ┌──────▼──────┐     ┌────────▼─────┐ ┌─────▼──────┐ ┌────▼─────┐
            │   Slack     │     │   自建系统    │ │  Monitoring │ │  Custom  │
            │   Webhook   │     │   API        │ │  (Prometheus)│ │  HTTP   │
            └─────────────┘     └──────────────┘ └────────────┘ └──────────┘
```

## 11. 安全考虑

### 11.1 租户隔离

- 数据库层：RLS 策略 `tenant_isolation_policy` 确保租户只能访问自己的数据
- 应用层：所有查询都以 `tenant_id` 为过滤条件

### 11.2 Secret 存储

- 当前 `secret` 字段以明文存储在数据库中
- 建议：使用加密存储或接入 KMS/SecretManager

### 11.3 出站请求安全

- 当前出站请求不携带签名头
- 建议：投递时自动附加 `X-Orion-Signature` 头（HMAC-SHA256）

### 11.4 URL 校验

- 当前仅做基本的 `type: 'url'` 校验
- 建议：增加 SSRF 防护（禁止内网地址、限制协议为 `https://`）

## 12. 已知限制与改进方向

### 12.1 当前限制

| 限制 | 影响 |
|------|------|
| 无 EventBus 集成 | 需要手动调用 triggerEvent，无法自动响应平台事件 |
| 同步重试阻塞 | 重试期间占用请求线程，不适合大量 Webhook |
| 无投递失败告警 | 失败后仅记录日志，无主动告警机制 |
| secret 明文存储 | 存在泄露风险 |
| 无速率限制 | 高频事件可能导致目标系统被压垮 |
| 前后端路径不一致 | `/test` vs `/trigger`、`/logs` vs `/deliveries` |

### 12.2 改进方向

| 改进 | 优先级 | 说明 |
|------|--------|------|
| EventBus 集成 | P0 | 订阅平台事件，自动触发匹配 Webhook |
| 异步投递队列 | P1 | 使用 NATS/Redis 队列解耦投递，支持定时重试 |
| HMAC 自动签名 | P1 | 投递时自动附加 `X-Orion-Signature` 头 |
| Secret 加密 | P1 | 接入 KMS 或使用 pgcrypto 加密存储 |
| 失败告警 | P2 | 连续 N 次失败后发送告警通知 |
| 速率限制 | P2 | 同一 Webhook 单位时间内最大投递次数 |
| 失败统计字段 | P2 | 增加 `failure_count` 列，支持自动禁用 |
| 路径统一 | P2 | 统一前后端 API 路径命名 |
