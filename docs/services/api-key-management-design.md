# API Key 管理模块设计 (S11 - API Key Management)

**文档版本**: v1.0
**创建日期**: 2026-05-15
**优先级**: P1
**状态**: 已实现 / 待评审
**作者**: Orion Architecture Team
**评审人**: 平台基础团队、安全与合规团队
**关联模块**: S10 (RBAC), S12 (Rate Limiting), M25 (持久化迁移)

---

## 执行摘要 (Executive Summary)

API Key Management 模块为 Orion 平台提供程序化访问认证能力，允许租户创建、管理和撤销 API Key，用于 CI/CD 流水线、第三方集成、自动化脚本等非交互式场景的身份验证。模块采用 PostgreSQL Repository 模式，所有 API Key 以租户隔离存储，支持权限范围 (Permission Scopes) 和过期时间控制。

### 设计范围

| 设计领域 | 核心内容 | 优先级 |
|---------|---------|--------|
| API Key CRUD | 创建、查询、撤销 API Key | P0 |
| 租户隔离 | 基于 tenant_id 的多租户数据隔离 | P0 |
| 密钥哈希 | SHA-256 哈希存储，明文仅返回一次 | P0 |
| 权限范围 | JSONB 存储的权限列表 (permissions) | P1 |
| 过期管理 | 可选过期时间，支持永不过期 | P1 |
| 使用追踪 | last_used_at 记录最后使用时间 | P2 |
| 速率限制 | 基于 key_hash 的端点限流计数 | P2 |
| 前端管理 | API Key 管理页面，创建/撤销/统计 | P1 |

### 预期收益量化

| 指标 | 当前状态 | API Key 管理后目标 | 改善幅度 |
|------|---------|-------------------|---------|
| 程序化访问认证 | 无统一方案 | 统一 API Key 体系 | 新建能力 |
| 密钥安全性 | 无 | SHA-256 哈希存储 | 100% 加密 |
| 租户隔离 | 无 | 数据库级 RLS 隔离 | 100% 隔离 |
| 密钥过期管理 | 无 | 自动过期控制 | 降低泄漏风险 |

---

## 一、模块概述 (Module Overview)

### 1.1 设计目的

API Key Management 模块解决以下核心问题：

1. **程序化访问认证**: 为 CI/CD 流水线、自动化脚本、第三方集成提供轻量级认证方式，无需用户 OAuth 登录流程。
2. **细粒度权限控制**: 每个 API Key 可配置独立的权限范围 (scopes/permissions)，遵循最小权限原则。
3. **租户级隔离**: API Key 严格绑定到租户，不同租户的 Key 完全隔离。
4. **生命周期管理**: 支持创建、查看、撤销、过期自动失效等完整生命周期。
5. **安全合规**: 明文 Key 仅在创建时返回一次，数据库中仅存储 SHA-256 哈希值。

### 1.2 使用场景

| 场景 | 说明 | 典型权限范围 |
|------|------|-------------|
| CI/CD 流水线 | Jenkins/GitLab CI 调用 Orion API 触发流水线 | `pipeline:read`, `pipeline:execute` |
| 监控集成 | Prometheus/Grafana 拉取指标数据 | `metrics:read` |
| 自动化脚本 | 定时任务、批量操作脚本 | `artifact:read`, `artifact:write` |
| 第三方集成 | 外部系统通过 API Key 访问受限资源 | 按需配置 |

### 1.3 技术栈

| 层级 | 技术选型 |
|------|---------|
| 后端框架 | Node.js + TypeScript + Fastify |
| 数据访问 | PostgreSQL Repository 模式 (slonik) |
| 加密算法 | Node.js `crypto` (SHA-256 + randomBytes) |
| 前端框架 | React + Vite + Ant Design |
| 数据隔离 | PostgreSQL Row Level Security (RLS) |

---

## 二、系统架构 (Architecture)

### 2.1 分层架构

```
+-----------------------------------------------------------------------------+
|                           API Key Management Architecture                    |
+-----------------------------------------------------------------------------+

+-------------------+       +-------------------+       +-------------------+
|    Routes Layer    |       |   Service Layer   |       |  Repository Layer  |
|                   |       |                   |       |                    |
| api-key-routes.ts | ----> | ApiKeyService.ts  | ----> | ApiKeyRepository.ts|
|                   |       |                   |       |                    |
| - GET /api-keys   |       | - createKey()     |       | - findById()       |
| - POST /api-keys  |       | - listKeys()      |       | - findAll()        |
| - DELETE /:id     |       | - revokeKey()     |       | - create()         |
+-------------------+       +-------------------+       | - delete()         |
                                                        | - updateLastUsed() |
                                                        +--------+-----------+
                                                                 |
                                                                 v
                                                        +-------------------+
                                                        |   PostgreSQL DB   |
                                                        |                   |
                                                        | api_keys table    |
                                                        | rate_limits table |
                                                        +-------------------+
```

### 2.2 数据流

```
创建 API Key 流程:

Client               Routes                Service              Repository          PostgreSQL
  |                    |                      |                     |                   |
  |-- POST /api-keys ->|                      |                     |                   |
  |                    |-- createKey(params) ->|                     |                   |
  |                    |                      |-- randomBytes(32) --|                   |
  |                    |                      |-- SHA256(rawKey) -->|                   |
  |                    |                      |-- create(tenantId,  |                   |
  |                    |                      |   userId, name,     |                   |
  |                    |                      |   keyHash, perms) ->|                   |
  |                    |                      |                     |-- INSERT -------->|
  |                    |                      |                     |<-- Row (no hash) --|
  |                    |                      |<-- { key, rawKey } -|                   |
  |<-- { key, rawKey }-|                      |                     |                   |
  |                    |                      |                     |                   |

验证 API Key 流程 (设计态，待实现):

External Client      Auth Middleware        Service              Repository          PostgreSQL
  |                       |                    |                     |                   |
  |-- Authorization:      |                    |                     |                   |
  |   Bearer <rawKey>  -->|                    |                     |                   |
  |                       |-- SHA256(rawKey) ->|                     |                   |
  |                       |-- findByHash(hash) -------------------->|                   |
  |                       |                     |                     |-- SELECT ------->|
  |                       |                     |                     |<-- ApiKey -------|
  |                       |-- validate(expired, |--                  |                   |
  |                       |   permissions)      |                    |                   |
  |                       |<-- ApiKey + scopes --|                    |                   |
  |<-- 200 OK (access granted)                  |                    |                   |
```

### 2.3 代码文件结构

```
orion-platform-service/src/
  api/
    api-key-routes.ts              # Fastify 路由定义
  services/api-key/
    ApiKeyService.ts               # 业务逻辑层
    ApiKeyRepository.ts            # 数据访问层
    index.ts                       # 模块导出
    __tests__/
      ApiKeyService.test.ts        # 单元测试

orion-frontend/src/
  pages/platform-core/ApiKeyManagement/
    index.tsx                      # 前端管理页面
  api/
    api-key.ts                     # 前端 API 客户端
  router/
    routes.ts                      # 路由注册
```

---

## 三、API 端点定义 (API Endpoints)

### 3.1 路由注册

所有端点挂载于 `/api/v1/api-keys` 前缀下，定义于 `orion-platform-service/src/api/api-key-routes.ts`。

### 3.2 端点列表

#### 3.2.1 列出 API Key 列表

```
GET /api/v1/api-keys?tenantId={tenantId}
```

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| tenantId | string | 是 | 租户 UUID |

**响应示例**:

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "tenant_id": "tenant-uuid",
      "user_id": "user-uuid",
      "name": "ci-pipeline-key",
      "key_hash": "sha256-hash-value...",
      "permissions": ["pipeline:read", "pipeline:execute"],
      "expires_at": "2026-12-31T23:59:59.000Z",
      "last_used_at": "2026-05-14T10:30:00.000Z",
      "created_at": "2026-01-15T08:00:00.000Z"
    }
  ],
  "total": 1
}
```

**错误响应**:

| HTTP 状态码 | 错误码 | 说明 |
|------------|--------|------|
| 400 | MISSING_TENANT_ID | 缺少 tenantId 参数 |
| 500 | LIST_ERROR | 查询数据库失败 |
| 503 | SERVICE_UNAVAILABLE | 数据库未连接 |

#### 3.2.2 创建 API Key

```
POST /api/v1/api-keys
```

**请求体**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| tenantId | string | 是 | 租户 UUID |
| userId | string | 是 | 创建者用户 UUID |
| name | string | 是 | Key 名称 (最大 200 字符) |
| permissions | string[] | 否 | 权限范围列表，默认空数组 |
| expiresInDays | number | 否 | 过期天数，不传表示永不过期 |

**请求示例**:

```json
{
  "tenantId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "660e8400-e29b-41d4-a716-446655440001",
  "name": "ci-pipeline-key",
  "permissions": ["pipeline:read", "pipeline:execute"],
  "expiresInDays": 90
}
```

**响应示例** (201 Created):

```json
{
  "key": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "660e8400-e29b-41d4-a716-446655440001",
    "name": "ci-pipeline-key",
    "key_hash": "sha256-hash...",
    "permissions": ["pipeline:read", "pipeline:execute"],
    "expires_at": "2026-08-13T10:30:00.000Z",
    "last_used_at": null,
    "created_at": "2026-05-15T10:30:00.000Z"
  },
  "rawKey": "a1b2c3d4e5f6...64字符十六进制"
}
```

**重要说明**: `rawKey` 仅在创建时返回一次，后续无法查询。前端在创建成功后应立即展示并提示用户保存。

#### 3.2.3 撤销 API Key

```
DELETE /api/v1/api-keys/{id}
```

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | API Key UUID |

**响应**: 204 No Content (成功) / 404 Not Found

### 3.3 前端 API 客户端

前端通过 `orion-frontend/src/api/api-key.ts` 封装调用：

```typescript
export interface ApiKey {
  id: string;
  name: string;
  key: string;
  userId: string;
  enabled: boolean;
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
}

export async function getApiKeys(): Promise<...>;
export async function createApiKey(input: ApiKeyInput): Promise<...>;
export async function revokeApiKey(id: string): Promise<void>;
export async function getApiKeyStats(): Promise<...>;
```

---

## 四、数据模型 (Data Model)

### 4.1 数据库表结构

定义于 `orion-platform-service/src/db/migrations/022_create_api_keys.sql`:

```sql
CREATE TABLE IF NOT EXISTS api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  key_hash      VARCHAR(128) NOT NULL UNIQUE,
  permissions   JSONB NOT NULL DEFAULT '{}',
  expires_at    TIMESTAMPTZ,
  last_used_at  TIMESTAMPTZ,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id);
```

### 4.2 TypeScript 接口

```typescript
// ApiKeyRepository.ts
export interface ApiKey {
  id: string;          // UUID 主键
  tenant_id: string;   // 租户 UUID (外键 → tenants.id)
  user_id: string;     // 创建者用户 UUID
  name: string;        // Key 名称，最大 200 字符
  key_hash: string;    // SHA-256 哈希值 (64 字符十六进制)
  permissions: string[];// 权限范围列表 (JSONB 存储)
  expires_at: Date | null;    // 过期时间，null 表示永不过期
  last_used_at: Date | null;  // 最后使用时间
  created_at: Date;    // 创建时间
}
```

### 4.3 字段详细说明

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK, 自动生成 | 全局唯一标识符 |
| `tenant_id` | UUID | NOT NULL, FK, 级联删除 | 租户隔离字段 |
| `name` | VARCHAR(200) | NOT NULL | 用户友好的 Key 名称 |
| `key_hash` | VARCHAR(128) | NOT NULL, UNIQUE | SHA-256 哈希，不可逆 |
| `permissions` | JSONB | NOT NULL, 默认 `'{}'` | 权限范围数组 |
| `expires_at` | TIMESTAMPTZ | NULLABLE | 过期时间 |
| `last_used_at` | TIMESTAMPTZ | NULLABLE | 最后使用时间 |
| `created_by` | UUID | FK, NULLABLE | 创建者用户 (外键 → users.id) |
| `created_at` | TIMESTAMPTZ | NOT NULL, 默认 now() | 创建时间 |

### 4.4 限流计数器表

```sql
CREATE TABLE IF NOT EXISTS rate_limits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash      VARCHAR(128) NOT NULL,
  endpoint      VARCHAR(200) NOT NULL,
  window_start  TIMESTAMPTZ NOT NULL,
  request_count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (key_hash, endpoint, window_start)
);
```

限流表与 API Key 通过 `key_hash` 关联，记录每个 Key 在每个端点的请求计数。

### 4.5 RLS 行级安全策略

通过 Migration 127 启用 RLS：

```sql
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON api_keys
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );
```

- 所有查询自动根据 `app.current_tenant_id` 会话变量进行租户隔离
- `FORCE ROW LEVEL SECURITY` 确保即使表所有者查询也受策略约束
- Migration 145 对 RLS 策略进行了修复和验证

---

## 五、密钥生成与哈希算法 (Key Generation & Hashing)

### 5.1 生成算法

实现于 `ApiKeyService.createKey()`:

```typescript
const rawKey = randomBytes(32).toString('hex');
// 生成 32 字节随机数，转为 64 字符十六进制字符串
// 熵值: 256 bit (32 bytes × 8 bits)
```

### 5.2 哈希算法

```typescript
const keyHash = createHash('sha256').update(rawKey).digest('hex');
// SHA-256 哈希，输出 64 字符十六进制字符串
```

### 5.3 算法特性

| 特性 | 值 | 说明 |
|------|-----|------|
| 随机源 | `crypto.randomBytes(32)` | 操作系统 CSPRNG |
| 密钥长度 | 64 字符十六进制 | 256 bit 熵 |
| 哈希算法 | SHA-256 | 单向加密哈希 |
| 碰撞概率 | ~1/2^256 | 实际上不可能碰撞 |
| 存储方式 | 仅存储哈希值 | 明文不持久化 |

### 5.4 安全设计原则

1. **明文仅返回一次**: 创建成功后返回 `rawKey`，此后仅能通过 `key_hash` 验证
2. **不可逆存储**: 数据库中只有 SHA-256 哈希值，即使数据库泄露也无法还原明文
3. **唯一约束**: `key_hash` 字段设置 UNIQUE 约束，防止重复 Key
4. **足够熵值**: 256 bit 随机性，远超暴力破解可行范围

---

## 六、权限范围系统 (Permission Scopes)

### 6.1 设计原理

权限范围 (`permissions`) 以 JSONB 数组形式存储，每个元素是一个权限标识符字符串。

```sql
-- PostgreSQL 中存储为 JSONB
permissions = '["pipeline:read", "pipeline:execute", "artifact:read"]'::jsonb
```

### 6.2 权限命名规范

采用 `<资源>:<操作>` 格式：

| 权限标识 | 说明 |
|---------|------|
| `pipeline:read` | 读取流水线信息 |
| `pipeline:execute` | 触发/执行流水线 |
| `pipeline:write` | 创建/修改流水线配置 |
| `artifact:read` | 读取制品信息 |
| `artifact:write` | 上传/修改制品 |
| `metrics:read` | 读取监控指标 |
| `config:read` | 读取配置信息 |
| `config:write` | 修改配置信息 |
| `tenant:read` | 读取租户信息 |

### 6.3 权限验证流程 (设计态)

```
1. 请求携带 API Key
2. Auth Middleware 计算 key_hash = SHA256(rawKey)
3. 查询数据库: SELECT * FROM api_keys WHERE key_hash = ?
4. 检查过期: expires_at IS NULL OR expires_at > NOW()
5. 检查权限: permissions 数组包含所需权限
6. 更新使用时间: UPDATE api_keys SET last_used_at = NOW() WHERE id = ?
7. 通过/拒绝
```

### 6.4 当前实现限制

现有 `ApiKeyService` 仅提供 CRUD 基础操作，权限验证中间件尚未实现。以下为待实现功能：

- [ ] API Key 认证中间件 (替代/补充 JWT 认证)
- [ ] 权限范围验证逻辑
- [ ] `findByHash()` 仓库方法
- [ ] `updateLastUsed()` 在验证时被调用

---

## 七、密钥生命周期 (Key Lifecycle)

### 7.1 生命周期状态机

```
                  ┌──────────┐
                  │  创建     │
                  │ (Created) │
                  └────┬─────┘
                       │ rawKey 仅此时返回
                       v
              ┌─────────────────┐
              │     活跃         │
              │    (Active)      │
              │                 │
              │ 可正常使用       │
              │ last_used_at    │
              │ 持续更新        │
              └────┬───────┬────┘
                   │       │
          过期时间到达    手动撤销
                   │       │
                   v       v
            ┌──────────┐ ┌──────────┐
            │  已过期   │ │  已撤销   │
            │ (Expired)│ │ (Revoked)│
            └──────────┘ └──────────┘
                 │            │
                 └─────┬──────┘
                       │ (物理删除)
                       v
                 ┌──────────┐
                 │  已删除   │
                 │ (Deleted) │
                 └──────────┘
```

### 7.2 各阶段说明

| 阶段 | 触发条件 | 数据变化 | 说明 |
|------|---------|---------|------|
| 创建 | POST /api-keys | INSERT 新记录 | rawKey 仅返回一次 |
| 活跃 | 自动 | last_used_at 更新 | 正常可用状态 |
| 过期 | expires_at 到达 | 无数据变化 | 验证时检查过期时间 |
| 撤销 | DELETE /api-keys/:id | DELETE 记录 | 物理删除 |
| 删除 | 同撤销 | DELETE 记录 | 不可恢复 |

### 7.3 过期处理

当前实现中，过期检查在验证时进行（设计态）：

```typescript
// 验证时应检查
if (key.expires_at && key.expires_at < new Date()) {
  throw new Error('API_KEY_EXPIRED');
}
```

前端在列表展示时通过 `dayjs` 判断过期状态并以红色 Tag 标记。

### 7.4 密钥轮换 (Key Rotation)

当前版本不支持自动轮换。推荐的轮换策略：

1. **手动轮换**: 创建新 Key → 更新所有使用方 → 撤销旧 Key
2. **定期轮换**: 设置 `expiresInDays` 强制过期，到期前创建新 Key
3. **紧急轮换**: 发现泄漏时立即撤销 (DELETE) 受影响 Key

---

## 八、前端页面结构 (Frontend)

### 8.1 页面路由

- **路径**: `/console/api-keys`
- **组件**: `orion-frontend/src/pages/platform-core/ApiKeyManagement/index.tsx`
- **访问控制**: `admin`, `platform_admin` 角色

### 8.2 页面布局

```
+-----------------------------------------------------------------------+
|  API Key 管理                                              [刷新] [新建]|
|  API Key Management                                                    |
+-----------------------------------------------------------------------+

+-------------------+  +-------------------+  +-------------------+
|  总数: 12          |  |  活跃: 10          |  |  已过期: 2        |
|  [MetricCard]     |  |  [MetricCard]     |  |  [MetricCard]    |
+-------------------+  +-------------------+  +-------------------+

+-----------------------------------------------------------------------+
|  名称         | Key              | 状态  | 过期时间  | 最后使用 | 操作  |
|--------------|-----------------|-------|----------|---------|------|
| ci-pipeline  | a1b2...3f4e [复制]| 活跃  | 2026-08-13| 05-14 10:30| [撤销]|
| monitoring   | b2c3...4g5h [复制]| 活跃  | 永不过期 | 从未使用  | [撤销]|
| old-script   | c3d4...5h6i [复制]| 已撤销 | 2026-01-01| 01-15 08:00|  --  |
+-----------------------------------------------------------------------+
```

### 8.3 创建 Key 弹窗流程

```
1. 点击 [新建 Key] → 打开 Modal
2. 填写表单:
   - 名称 (必填): 输入框
   - 过期时间 (可选): 日期选择器
3. 点击 [创建] → 调用 createApiKey API
4. 创建成功 → 展示 rawKey (带复制按钮) + 警告提示
   "请妥善保存此 API Key，关闭后将无法再次查看"
5. 点击 [完成] → 关闭弹窗，刷新列表
```

### 8.4 组件依赖

| 组件 | 来源 | 用途 |
|------|------|------|
| Table | @/components/Table | 数据表格展示 |
| MetricCard | @/components/MetricCard | 统计卡片 |
| DataState | @/components/DataState | 加载/空/错误状态 |
| Modal, Form, Input | antd | 创建弹窗 |
| DatePicker | antd + dayjs | 过期时间选择 |
| Tag, Tooltip, Popconfirm | antd | 状态标签和确认 |

### 8.5 前端数据流

```
ApiKeyManagement (组件)
  |
  |-- loadData()
  |    |-- getApiKeys()        → GET /v1/api-keys
  |    |-- getApiKeyStats()    → GET /v1/api-keys/stats
  |
  |-- handleCreate(values)
  |    |-- createApiKey(values) → POST /v1/api-keys
  |
  |-- handleRevoke(id)
       |-- revokeApiKey(id)     → DELETE /v1/api-keys/:id
```

---

## 九、集成点 (Integration Points)

### 9.1 认证中间件集成 (设计态)

API Key 认证应与现有 JWT 认证并存：

```
请求进入
  |
  v
Auth Middleware
  |
  |-- 检查 Authorization header
  |     |
  |     |-- 格式: "Bearer <token>" → JWT 验证路径
  |     |-- 格式: "Bearer <rawKey>" → API Key 验证路径
  |           |
  |           v
  |     SHA256(rawKey) → 查询 api_keys WHERE key_hash = ?
  |           |
  |           |-- 未找到 → 401 Unauthorized
  |           |-- 已过期 → 401 Unauthorized (API_KEY_EXPIRED)
  |           |-- 租户不匹配 → 403 Forbidden
  |           |-- 验证通过 → 设置 request.user, request.tenantId
  |           |              UPDATE last_used_at
  v
下游业务处理
```

### 9.2 与 RBAC 系统集成

| 集成点 | 说明 |
|--------|------|
| 租户隔离 | API Key 绑定 tenant_id，只能访问所属租户资源 |
| 权限范围 | `permissions` 字段定义了该 Key 的操作权限子集 |
| 角色继承 | API Key 权限不继承创建者的角色权限，完全由 `permissions` 控制 |

### 9.3 与 JWT 认证的关系

| 特性 | JWT (用户认证) | API Key (程序化认证) |
|------|---------------|---------------------|
| 适用场景 | 用户交互式登录 | 脚本/CI/CD/集成 |
| 凭证形式 | JWT Token (短期) | API Key (长期) |
| 过期机制 | 短期过期 (小时级) | 可选长期/自定义 |
| 权限来源 | 用户角色 + RBAC | permissions 数组 |
| 刷新机制 | Refresh Token | 手动轮换 |

### 9.4 数据库依赖

| 表 | 关系 |
|----|------|
| `tenants` | `api_keys.tenant_id` → `tenants.id` (ON DELETE CASCADE) |
| `users` | `api_keys.created_by` → `users.id` (可选) |

---

## 十、安全考量 (Security Considerations)

### 10.1 密钥安全

| 安全措施 | 实现方式 | 说明 |
|---------|---------|------|
| 哈希存储 | SHA-256 | 数据库中仅存哈希值 |
| 随机生成 | `crypto.randomBytes(32)` | CSPRNG 256-bit 熵 |
| 单次返回 | 创建时返回 rawKey | 后续无法查询明文 |
| 唯一约束 | `key_hash UNIQUE` | 防止 Key 重复 |
| 不可逆 | SHA-256 单向哈希 | 即使数据库泄露也无法还原 |

### 10.2 传输安全

| 要求 | 说明 |
|------|------|
| HTTPS 强制 | 所有 API Key 相关请求必须通过 HTTPS |
| Header 传输 | Key 通过 `Authorization: Bearer <key>` 传输，避免 URL 泄漏 |
| 日志脱敏 | 日志中不应记录完整 Key，建议记录前 8 位 + 后 4 位 |

### 10.3 租户隔离

| 层级 | 机制 |
|------|------|
| 应用层 | 路由层强制要求 `tenantId` 参数 |
| 数据库层 | RLS 策略通过 `app.current_tenant_id` 自动过滤 |
| 外键约束 | `ON DELETE CASCADE` 确保租户删除时级联清理 |

### 10.4 审计追踪

| 审计字段 | 用途 |
|---------|------|
| `created_at` | 记录创建时间，用于合规审计 |
| `created_by` | 追溯 Key 创建者 |
| `last_used_at` | 追踪 Key 使用情况，识别闲置 Key |
| 前端操作日志 | 创建、撤销操作通过前端埋点记录 |

### 10.5 安全建议

1. **最小权限原则**: 创建 Key 时仅授予必需的 permissions
2. **设置过期时间**: 避免永不过期的 Key，定期轮换
3. **监控使用模式**: 通过 `last_used_at` 识别长期未使用的 Key
4. **泄漏应急响应**: 发现 Key 泄漏时立即撤销并创建新 Key
5. **环境隔离**: 生产环境和测试环境使用不同的 Key

### 10.6 当前安全缺口

| 缺口 | 严重性 | 建议修复 |
|------|--------|---------|
| 无 API Key 认证中间件 | 高 | 实现 Key 验证中间件 |
| 无 `findByHash()` 方法 | 高 | 仓库层添加按哈希查询 |
| 撤销为物理删除 | 中 | 考虑软删除 (revoked_at) 保留审计 |
| 无速率限制实现 | 中 | 利用 rate_limits 表实现限流 |
| 前端 stats 端点未实现 | 低 | 添加 GET /api-keys/stats 路由 |

---

## 十一、测试策略 (Testing Strategy)

### 11.1 单元测试

覆盖于 `orion-platform-service/src/services/api-key/__tests__/ApiKeyService.test.ts`：

| 测试用例 | 覆盖方法 | 说明 |
|---------|---------|------|
| 创建 Key 返回 rawKey | `createKey` | 验证 rawKey 正确返回 |
| 带过期时间创建 | `createKey` | 验证 expires_at 计算正确 |
| 缺少 tenantId 抛异常 | `createKey` | 验证输入校验 |
| 缺少 name 抛异常 | `createKey` | 验证输入校验 |
| 按租户列出 Key | `listKeys` | 验证租户隔离查询 |
| 空列表返回 | `listKeys` | 验证边界情况 |
| 撤销存在的 Key | `revokeKey` | 验证删除成功 |
| 撤销不存在的 Key | `revokeKey` | 验证返回 false |
| Repository CRUD | 全部 | 验证 SQL 正确性 |

### 11.2 集成测试 (待实现)

- [ ] 端到端创建-查询-撤销流程
- [ ] RLS 租户隔离验证
- [ ] 过期 Key 验证被拒绝
- [ ] 并发创建 Key 唯一性验证

### 11.3 前端测试

覆盖于 `orion-frontend/src/pages/ApiKeyManagement/__tests__/index.test.tsx` 和 `orion-frontend/src/api/__tests__/api-key.test.ts`。

---

## 十二、未来演进路线 (Roadmap)

| 阶段 | 功能 | 优先级 |
|------|------|--------|
| P1 (当前) | 基础 CRUD + 前端管理页面 | 已完成 |
| P2 (近期) | API Key 认证中间件 | 高 |
| P2 (近期) | `findByHash()` 仓库方法 | 高 |
| P2 (近期) | 权限范围验证 | 高 |
| P3 (中期) | 软删除 (revoked_at) + 审计日志 | 中 |
| P3 (中期) | 速率限制实现 | 中 |
| P3 (中期) | Key 使用统计 API | 中 |
| P4 (远期) | 自动轮换策略 | 低 |
| P4 (远期) | IP 白名单绑定 | 低 |
| P4 (远期) | 密钥泄漏检测 | 低 |

---

## 附录 A：相关文件索引

| 文件 | 路径 |
|------|------|
| 路由定义 | `orion-platform-service/src/api/api-key-routes.ts` |
| 服务层 | `orion-platform-service/src/services/api-key/ApiKeyService.ts` |
| 仓库层 | `orion-platform-service/src/services/api-key/ApiKeyRepository.ts` |
| 模块导出 | `orion-platform-service/src/services/api-key/index.ts` |
| 单元测试 | `orion-platform-service/src/services/api-key/__tests__/ApiKeyService.test.ts` |
| 数据库迁移 | `orion-platform-service/src/db/migrations/022_create_api_keys.sql` |
| RLS 启用 | `orion-platform-service/src/db/migrations/127_enable_rls_remaining_tables.sql` |
| RLS 修复 | `orion-platform-service/src/db/migrations/145_fix_rls_policies.sql` |
| 前端页面 | `orion-frontend/src/pages/platform-core/ApiKeyManagement/index.tsx` |
| 前端 API | `orion-frontend/src/api/api-key.ts` |
| 前端路由 | `orion-frontend/src/router/routes.ts` |
| 前端测试 | `orion-frontend/src/pages/ApiKeyManagement/__tests__/index.test.tsx` |

## 附录 B：数据库 ER 关系

```
tenants (1) ──────< api_keys (N) >────── users (1) [created_by]
                        |
                        | key_hash
                        v
                  rate_limits (N)
```
