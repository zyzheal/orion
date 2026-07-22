# 特性开关服务 Spec 文档

**生成日期**: 2026-07-03
**状态**: 编写中
**成熟度**: L1（初始定义）

---

## 一、服务定位

特性开关服务（Feature Flag Service）为 Orion 平台提供集中化的功能特性开关管理能力。允许开发者和运维人员在不部署新代码的情况下，动态控制功能的开启/关闭、灰度发布比例以及基于用户属性的定向投放。

### 1.1 核心职责

| 职责 | 说明 |
|------|------|
| 特性开关 CRUD | 创建、读取、更新、删除特性开关定义 |
| 运行时评估 | 根据开关配置 + 请求上下文（用户、环境、属性）判定功能是否启用 |
| 灰度发布 | 支持基于百分比的渐进式 rollout，用户分桶确定性 |
| 定向投放 | 支持基于用户属性（地域、角色、订阅等）的定向规则匹配 |
| 开关审计 | 记录所有开关状态的变更历史 |

### 1.2 非职责

| 非职责 | 原因 |
|--------|------|
| 用户与租户管理 | 由 auth 服务统一管理 |
| 开关 SDK 端点缓存推送 | 当前为无状态评估，无 WebSocket/SSE 推送；后续可通过 SDK 侧缓存 |
| A/B 测试统计 | 仅提供开关判定，不负责实验结果分析 |

### 1.3 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 语言 | Go 1.25 | |
| HTTP 框架 | Gin v1.10 | 高性能路由 |
| 数据库 | PostgreSQL (sqlx) | 主存储 |
| 缓存 | Redis | JWT token 验证 |
| 认证 | JWT (go-common/pkg/auth) | 多租户隔离 |
| 中间件 | go-common/pkg/middleware | 日志、恢复、CORS、HealthCheck |
| 日志 | zap (go-common/pkg/logger) | 结构化日志 |

---

## 二、验收标准

### 2.1 特性开关 CRUD

| # | 标准 | 验证方式 |
|---|------|----------|
| C1 | 创建开关时校验 name 与 key 必填，key 在租户内唯一 | API 测试 |
| C2 | 创建成功返回 `201 Created`，重复 key 返回 `409 Conflict` | API 测试 |
| C3 | 列表支持按 status（active/inactive/archived）和 environment 过滤 | API 测试 |
| C4 | 列表支持分页（page/page_size，默认 20，最大 100） | API 测试 |
| C5 | 列表默认按 `created_at DESC` 排序 | API 测试 |
| C6 | 获取单个开关时校验 tenant_id 隔离 | API 测试 |
| C7 | 更新开关使用部分更新语义（仅修改请求体中的字段） | API 测试 |
| C8 | 更新不存在的开关返回 `404 Not Found` | API 测试 |
| C9 | 删除开关同时级联删除 toggle_history | API 测试 |
| C10 | 按关键字搜索覆盖 name / key / description 三个字段 | API 测试 |

### 2.2 开关评估

| # | 标准 | 验证方式 |
|---|------|----------|
| E1 | 按 key 评估开关，不存在的 key 返回 `enabled: false, reason: "Flag not found"` | 单元测试 |
| E2 | 非 active 状态的开关始终返回 `enabled: false` | 单元测试 |
| E3 | 指定环境不在开关的 environments 列表中时，返回 default_value | 单元测试 |
| E4 | 定向规则全部匹配（AND 逻辑）时返 `enabled: true` | 单元测试 |
| E5 | 支持 6 种算子：equals / contains / in / gt / lt / regex | 单元测试 |
| E6 | 百分比 rollout 使用确定性哈希（同一 user+key 始终得到相同结果）| 单元测试 |
| E7 | 百分比 rollout 未提供 user_id 时回退到 default_value | 单元测试 |
| E8 | 无规则、无百分比、状态下发环境匹配时，返回 default_value | 单元测试 |
| E9 | 批量评估返回与请求一一对应的结果数组 | API 测试 |

### 2.3 灰度发布

| # | 标准 | 验证方式 |
|---|------|----------|
| R1 | 设置 rollout_pct 在 0-100 之间，超出返回 `400 Bad Request` | API 测试 |
| R2 | 支持 3 种策略：percentage / targeted / gradual | API 测试 |
| R3 | 覆盖率精确到整数百分比 | 单元测试 |

### 2.4 开关审计

| # | 标准 | 验证方式 |
|---|------|----------|
| H1 | 每次开关状态变更应记录到 toggle_history | 单元测试 |
| H2 | toggle_history 包含 old_value / new_value / changed_by / reason | 单元测试 |
| H3 | 查询 toggle_history 按 `changed_at DESC` 排序 | API 测试 |
| H4 | toggle_history 限制返回条目数（默认 50） | API 测试 |

### 2.5 多租户隔离

| # | 标准 | 验证方式 |
|---|------|----------|
| T1 | 所有查询强制按 tenant_id 过滤 | 代码审查 |
| T2 | 用户 A 无法看到或操作租户 B 的开关 | 集成测试 |
| T3 | Create/Update/Delete 需要 `feature_flag` 资源的 write/delete 权限 | 集成测试 |
| T4 | List/Get/Search 无需特殊权限（登录即可） | API 测试 |
| T5 | Evaluate 端点需要 write 权限（与 SDK 共享密钥保护） | API 测试 |

### 2.6 非功能性

| # | 标准 | 验证方式 |
|---|------|----------|
| P1 | 单开关评估响应时间 < 10ms（不含网络开销） | 性能测试 |
| P2 | 批量评估 100 个开关响应时间 < 100ms | 性能测试 |
| P3 | CRUD 操作响应时间 < 50ms | 性能测试 |
| S1 | 关键业务日志包含 traceId | 代码审查 |
| S2 | 所有异常返回结构化 JSON，不暴露堆栈 | 代码审查 |

---

## 三、API 设计

### 3.1 基础信息

| 属性 | 值 |
|------|-----|
| Base Path | `/api/v1/flags` |
| 认证 | JWT Bearer Token（除 `/healthz`）|
| 权限 | write/delete 操作需 `feature_flag` 资源权限 |
| Content-Type | `application/json` |

### 3.2 端列表

#### 3.2.1 创建特性开关

```
POST /api/v1/flags
```

**权限**: `feature_flag:write`

**请求体**:

```json
{
  "name": "Dark Mode",
  "key": "dark_mode",
  "description": "Enable dark mode for all users",
  "default_value": false,
  "rollout_pct": 0,
  "rollout_strategy": "percentage",
  "targeting_rules": [
    {"attribute": "region", "operator": "equals", "value": "cn"}
  ],
  "environments": ["development", "staging", "production"],
  "tags": ["ui", "experimental"]
}
```

**响应** `201 Created`:

```json
{
  "id": "uuid-...",
  "tenant_id": "t1",
  "name": "Dark Mode",
  "key": "dark_mode",
  "description": "Enable dark mode for all users",
  "status": "active",
  "default_value": false,
  "rollout_pct": 0,
  "rollout_strategy": "percentage",
  "targeting_rules": [...],
  "environments": ["development", "staging", "production"],
  "tags": ["ui", "experimental"],
  "created_by": "user-uuid",
  "updated_by": "user-uuid",
  "created_at": "2026-07-03T00:00:00Z",
  "updated_at": "2026-07-03T00:00:00Z"
}
```

**错误**:

| HTTP 状态 | 场景 |
|-----------|------|
| 400 | 请求体校验失败（name/key 缺失） |
| 409 | key 在该租户下已存在 |
| 500 | 服务端错误 |

---

#### 3.2.2 获取开关列表

```
GET /api/v1/flags
```

**权限**: 登录即可

**Query 参数**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | int | 1 | 页码 |
| page_size | int | 20 | 每页数量（最大 100） |
| status | string | - | 过滤：active / inactive / archived |
| environment | string | - | 过滤：环境名 |

**响应** `200 OK`:

```json
{
  "data": [...FeatureFlag],
  "page": 1,
  "page_size": 20
}
```

---

#### 3.2.3 搜索开关

```
GET /api/v1/flags/search?q=dark
```

**权限**: 登录即可

**Query 参数**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| q | string | - | **必填**，搜索关键字 |
| page | int | 1 | 页码 |
| page_size | int | 20 | 每页数量 |

**响应** `200 OK`:

```json
{
  "data": [...FeatureFlag]
}
```

**错误**: `400` — q 参数缺失

---

#### 3.2.4 获取开关总数

```
GET /api/v1/flags/count
```

**权限**: 登录即可

**响应** `200 OK`:

```json
{
  "count": 42
}
```

---

#### 3.2.5 获取单个开关

```
GET /api/v1/flags/:id
```

**权限**: 登录即可

**响应** `200 OK`: FeatureFlag 对象

**错误**: `404` — 开关不存在

---

#### 3.2.6 更新开关

```
PUT /api/v1/flags/:id
```

**权限**: `feature_flag:write`

**请求体**: 部分更新（字段可选）

```json
{
  "name": "Dark Mode v2",
  "description": "Updated description",
  "status": "inactive",
  "default_value": true,
  "rollout_pct": 50,
  "rollout_strategy": "gradual",
  "targeting_rules": [],
  "environments": ["production"],
  "tags": ["ui", "v2"]
}
```

**响应** `200 OK`: 更新后的 FeatureFlag 对象

**错误**:

| HTTP 状态 | 场景 |
|-----------|------|
| 400 | 请求体校验失败 |
| 404 | 开关不存在 |
| 500 | 服务端错误 |

---

#### 3.2.7 删除开关

```
DELETE /api/v1/flags/:id
```

**权限**: `feature_flag:delete`

**响应** `200 OK`:

```json
{
  "message": "deleted"
}
```

**错误**: `404` — 开关不存在

---

#### 3.2.8 设置灰度比例

```
PUT /api/v1/flags/:id/rollout
```

**权限**: `feature_flag:write`

**请求体**:

```json
{
  "percentage": 30
}
```

**响应** `200 OK`: 更新后的 FeatureFlag 对象

**错误**:

| HTTP 状态 | 场景 |
|-----------|------|
| 400 | percentage 不在 0-100 范围内 |
| 404 | 开关不存在 |

---

#### 3.2.9 评估单个开关

```
POST /api/v1/flags/evaluate
```

**权限**: `feature_flag:write`（保护评估端点）

**请求体**:

```json
{
  "flag_key": "dark_mode",
  "environment": "production",
  "user_id": "user-abc",
  "attributes": {
    "region": "cn",
    "role": "admin"
  }
}
```

**响应** `200 OK`:

```json
{
  "flag_id": "uuid-...",
  "key": "dark_mode",
  "enabled": true,
  "reason": "Targeting rules matched",
  "evaluated_at": "2026-07-03T00:00:00Z"
}
```

---

#### 3.2.10 批量评估

```
POST /api/v1/flags/evaluate/batch
```

**权限**: `feature_flag:write`

**请求体**: `[EvaluateFlagRequest, ...]`

**响应** `200 OK`:

```json
{
  "results": [...FlagEvaluationResult]
}
```

---

#### 3.2.11 获取开关变更历史

```
GET /api/v1/flags/:id/toggle-history
```

**权限**: 登录即可

**Query 参数**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| limit | int | 50 | 返回条数上限 |

**响应** `200 OK`:

```json
{
  "data": [...FlagToggleRecord]
}
```

**错误**: `404` — 开关不存在

---

### 3.3 评估流程图

```
接收评估请求 (flag_key + context)
        │
        ▼
  按 key 查数据库
        │
        ├── 不存在 → 返回 { enabled: false, reason: "Flag not found" }
        │
        ▼
  Status == "active" ?
        │
        ├── 否 → 返回 { enabled: false, reason: "Flag is inactive/archived" }
        │
        ▼
  指定 environment?
        │
        ├── 是且不在 environments 中 → 返回 default_value
        │
        ▼
  有 targeting_rules?
        │
        ├── 是且全部匹配 → 返回 { enabled: true, reason: "Targeting rules matched" }
        │
        ▼
  策略为 percentage 且有 user_id?
        │
        ├── 是 → 确定性哈希 → 按 rollout_pct 判定
        │
        ▼
  返回 default_value
```

---

## 四、数据模型

### 4.1 feature_flags 表

主表，按租户隔离存储所有特性开关定义。

```sql
CREATE TABLE IF NOT EXISTS feature_flags (
    id              UUID PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    name            VARCHAR(256) NOT NULL,
    key             VARCHAR(128) NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    default_value   BOOLEAN NOT NULL DEFAULT false,
    rollout_pct     INT NOT NULL DEFAULT 100,
    rollout_strategy VARCHAR(20) NOT NULL DEFAULT 'percentage',
    targeting_rules JSONB NOT NULL DEFAULT '[]',
    environments    JSONB NOT NULL DEFAULT '["production"]',
    tags            JSONB NOT NULL DEFAULT '[]',
    created_by      VARCHAR(128) NOT NULL DEFAULT '',
    updated_by      VARCHAR(128) NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feature_flags_tenant ON feature_flags(tenant_id);
CREATE UNIQUE INDEX idx_feature_flags_key ON feature_flags(tenant_id, key);
CREATE INDEX idx_feature_flags_status ON feature_flags(tenant_id, status);
```

**字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| tenant_id | VARCHAR(64) | 租户 ID，所有查询强制过滤 |
| name | VARCHAR(256) | 开关名称（人类可读）|
| key | VARCHAR(128) | 开关键名（代码中引用），租户内唯一 |
| description | TEXT | 描述 |
| status | VARCHAR(20) | 状态: active / inactive / archived |
| default_value | BOOLEAN | 默认返回值 |
| rollout_pct | INT | 灰度百分比 0-100 |
| rollout_strategy | VARCHAR(20) | 策略: percentage / targeted / gradual |
| targeting_rules | JSONB | 定向规则数组 |
| environments | JSONB | 启用环境列表（字符串数组）|
| tags | JSONB | 标签列表（字符串数组）|
| created_by | VARCHAR(128) | 创建者用户 ID |
| updated_by | VARCHAR(128) | 最后更新者用户 ID |
| created_at | TIMESTAMPTZ | 创建时间 |
| updated_at | TIMESTAMPTZ | 更新时间 |

### 4.2 flag_toggle_history 表

变更审计表，记录每次开关状态变更。

```sql
CREATE TABLE IF NOT EXISTS flag_toggle_history (
    id          UUID PRIMARY KEY,
    flag_id     UUID NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE,
    old_value   BOOLEAN NOT NULL,
    new_value   BOOLEAN NOT NULL,
    changed_by  VARCHAR(128) NOT NULL DEFAULT '',
    reason      TEXT NOT NULL DEFAULT '',
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_flag_toggle_history_flag ON flag_toggle_history(flag_id);
```

**字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| flag_id | UUID | 关联开关 ID（级联删除）|
| old_value | BOOLEAN | 变更前的值 |
| new_value | BOOLEAN | 变更后的值 |
| changed_by | VARCHAR(128) | 操作人 |
| reason | TEXT | 变更原因 |
| changed_at | TIMESTAMPTZ | 变更时间 |

### 4.3 枚举值

**FeatureFlagStatus**:

| 值 | 说明 |
|----|------|
| `active` | 开关激活，参与评估 |
| `inactive` | 开关关闭，评估返回 disabled |
| `archived` | 归档，不再使用 |

**RolloutStrategy**:

| 值 | 说明 |
|----|------|
| `percentage` | 按百分比灰度（确定性哈希）|
| `targeted` | 仅通过定向规则控制 |
| `gradual` | 渐进式发布（逐步增加百分比）|

**TargetingRuleOperator**:

| 值 | 说明 | 示例 |
|----|------|------|
| `equals` | 字符串相等 | region == "cn" |
| `contains` | 字符串包含 | email contains "@acme.com" |
| `in` | 值在列表中 | role in ["admin", "superadmin"] |
| `gt` | 数值大于 | age > 18 |
| `lt` | 数值小于 | level < 5 |
| `regex` | 正则匹配 | email matches ".*@acme\.com$" |

### 4.4 Go 代码模型

```go
// FeatureFlag 核心领域模型
type FeatureFlag struct {
    ID              string            `db:"id" json:"id"`
    TenantID        string            `db:"tenant_id" json:"tenant_id"`
    Name            string            `db:"name" json:"name"`
    Key             string            `db:"key" json:"key"`
    Description     string            `db:"description" json:"description"`
    Status          FeatureFlagStatus `db:"status" json:"status"`
    DefaultValue    bool              `db:"default_value" json:"default_value"`
    RolloutPct      int               `db:"rollout_pct" json:"rollout_pct"`
    RolloutStrategy RolloutStrategy   `db:"rollout_strategy" json:"rollout_strategy"`
    TargetingRules  JSONArray         `db:"targeting_rules" json:"targeting_rules"`
    Environments    StringArray       `db:"environments" json:"environments"`
    Tags            StringArray       `db:"tags" json:"tags"`
    CreatedBy       string            `db:"created_by" json:"created_by"`
    UpdatedBy       string            `db:"updated_by" json:"updated_by"`
    CreatedAt       time.Time         `db:"created_at" json:"created_at"`
    UpdatedAt       time.Time         `db:"updated_at" json:"updated_at"`
}

// FlagEvaluationResult 评估结果
type FlagEvaluationResult struct {
    FlagID      string    `json:"flag_id"`
    Key         string    `json:"key"`
    Enabled     bool      `json:"enabled"`
    Reason      string    `json:"reason"`
    EvaluatedAt time.Time `json:"evaluated_at"`
}

// FlagToggleRecord 变更审计记录
type FlagToggleRecord struct {
    ID        string    `db:"id" json:"id"`
    FlagID    string    `db:"flag_id" json:"flag_id"`
    OldValue  bool      `db:"old_value" json:"old_value"`
    NewValue  bool      `db:"new_value" json:"new_value"`
    ChangedBy string    `db:"changed_by" json:"changed_by"`
    Reason    string    `db:"reason" json:"reason"`
    ChangedAt time.Time `db:"changed_at" json:"changed_at"`
}
```

---

## 五、依赖与集成

### 5.1 内部依赖

| 依赖 | 路径 | 用途 |
|------|------|------|
| go-common/pkg/auth | `../orion-go-common/pkg/auth` | JWT 认证 + RBAC 权限校验 + Redis token 验证 |
| go-common/pkg/database | `../orion-go-common/pkg/database` | PostgreSQL 连接管理与迁移执行 |
| go-common/pkg/logger | `../orion-go-common/pkg/logger` | 基于 zap 的结构化日志 |
| go-common/pkg/middleware | `../orion-go-common/pkg/middleware` | 通用 Gin 中间件（Recovery/RequestID/StructuredLogger/CORS/HealthCheck）|
| go-common/pkg/redis | `../orion-go-common/pkg/redis` | Redis 客户端 |

### 5.2 外部依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| github.com/gin-gonic/gin | v1.10.0 | HTTP 路由器 |
| github.com/jmoiron/sqlx | v1.4.0 | SQL 查询扩展 |
| github.com/google/uuid | v1.6.0 | UUID 生成 |
| github.com/lib/pq | v1.10.9 | PostgreSQL 驱动 |

### 5.3 基础设施依赖

| 组件 | 配置 | 说明 |
|------|------|------|
| PostgreSQL | DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME / DB_SSLMODE | 主数据存储 |
| Redis | REDIS_ADDR | JWT token 黑名单验证 |
| 无固定端口 | 默认 8080 | HTTP 服务端口 |

### 5.4 与 Orion 平台的集成点

| 集成点 | 方向 | 说明 |
|--------|------|------|
| API Gateway | 前端 → 网关 → 服务 | 前端通过 API Gateway 路由到此服务 |
| go-common 认证 | 服务 → 共享库 | 使用 go-common 的统一 JWT 认证和权限模型 |
| 迁移执行 | 服务启动时自动 | `main.go` 自动执行 `migrations/` 目录下的 SQL 迁移 |
| 健康检查 | 外部探针 | `GET /healthz` 返回服务存活状态 |

---

## 六、注意事项

### 6.1 已知限制

| # | 限制 | 说明 | 后续改进方向 |
|---|------|------|------------|
| L1 | 无 SDK 缓存 | 每次评估都走数据库查询 | 增加本地缓存 + Redis 缓存层，减少 DB 压力 |
| L2 | 无 WebSocket/SSE 推送 | 开关变更后客户端需轮询 | 实现实时推送通道 |
| L3 | 无版本管理 | 开关被修改后无法回滚 | 增加 flag 版本号 + 回滚 API |
| L4 | 无分段灰度 | 当前仅支持全局百分比 | 增加基于标签/地域的可控分段 |
| L5 | regex 评估性能 | 每次评估编译正则 | 预编译 TargetingRule 中的 regex 表达式 |
| L6 | 测试覆盖率低 | 仅 2 个基础测试文件，16 行测试代码 | 补充完整单元测试和集成测试 |

### 6.2 安全注意事项

| # | 注意项 | 处理方式 |
|---|--------|----------|
| S1 | 评估端点暴露 | evaluate/batch 端点需 write 权限保护，防止未授权遍历开关 |
| S2 | tenant_id 注入 | 所有 handler 通过 JWT 获取 tenant_id，不接受请求体或 URL 参数 |
| S3 | JWT Secret 生产更换 | 默认 `change-me-in-production` 必须在生产环境替换 |
| S4 | key 的 SQL 注入 | repository 层使用参数化查询，key 不拼接在 SQL 中 |

### 6.3 性能注意事项

| # | 注意项 | 建议 |
|---|--------|------|
| P1 | ListByEnvironment 全量返回 | 生产环境做 SDK 评估时可能返回大量开关，考虑增加分页 |
| P2 | Search 使用 LIKE 前后通配 | `%keyword%` 无法走索引，数据量大时需迁移到全文检索（tsvector）|
| P3 | ToggleHistory 无过期 | toggle_history 会持续增长，需增加数据归档或 TTL 策略 |

### 6.4 缺失能力

| # | 缺失能力 | 优先级 | 说明 |
|---|---------|--------|------|
| G1 | 开关值类型支持（字符串/数字/JSON） | P2 | 当前仅支持 bool，不支持多值开关 |
| G2 | 开关导入/导出 | P2 | 支持批量迁移开关配置 |
| G3 | 开关依赖（依赖其他开关） | P3 | A 开关打开时 B 开关自动失效 |
| G4 | 定时开关（时间计划） | P3 | 如 "每晚 22:00 到 06:00 开启" |
| G5 | 开关标签自动化 | P3 | 基于 Git 分支/Commit 自动关联开关 |

### 6.5 配置项摘要

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| PORT | 8080 | HTTP 服务端口 |
| DB_HOST | localhost | PostgreSQL 主机 |
| DB_PORT | 5432 | PostgreSQL 端口 |
| DB_USER | **必填** | PostgreSQL 用户 |
| DB_PASSWORD | **必填** | PostgreSQL 密码 |
| DB_NAME | orion_feature_flag | 数据库名 |
| DB_SSLMODE | disable | SSL 模式 |
| JWT_SECRET | change-me-in-production | JWT 密钥 |
| REDIS_ADDR | localhost:6379 | Redis 地址 |

---

_文档版本: v1.0 | 生成日期: 2026-07-03 | 状态: 编写中_
