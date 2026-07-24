# 流水线模板服务 Spec 文档

**生成日期**: 2026-07-03
**状态**: 编写中
**成熟度**: L1（初始定义）

---

## 一、服务定位

| 属性 | 内容 |
|------|------|
| **服务名称** | `orion-pipeline-template-svc-go` |
| **模块路径** | `orion/pipeline-template-svc-go` |
| **职责** | 流水线模板的 CRUD 管理、分类与标签体系、模板参数化、从模板实例化流水线、从已有流水线另存为模板 |
| **所属领域** | 交付（Delivery）— 流水线子域 |
| **架构模式** | 四层结构：Handler → Service → Repository → PostgreSQL |
| **实现语言** | Go 1.25（Gin 框架） |
| **端口** | `8080`（默认，可配置） |
| **健康检查** | `GET /healthz` |

### 1.1 核心能力

| # | 能力 | 说明 |
|---|------|------|
| 1 | 模板 CRUD | 创建、查询（列表+详情）、更新、删除流水线模板 |
| 2 | 多维度过滤 | 按分类（category）、标签（tag）、公开/私有（is_public）过滤列表 |
| 3 | 分页查询 | 支持 page/page_size 参数，默认 20 条/页，上限 100 条 |
| 4 | 模板计数 | 快速获取当前租户可见的模板总数 |
| 5 | 参数化声明 | 声明模板的可配置参数（名称、类型、描述、默认值、是否必填） |
| 6 | 参数替换实例化 | 传入参数值替换 YAML 中的 `${PARAM}`/`$PARAM` 占位符，生成可执行的流水线 |
| 7 | 流水线另存模板 | 读取已有流水线配置，提取 yamlDefinition 保存为新模板 |
| 8 | 内置模板预置 | 首次启动时幂等预置 5 套内置模板（Node.js/Go/Java/Docker/Frontend） |
| 9 | 版本管理 | YAML 内容变更时自动递增版本号 |
| 10 | 部分更新 | 仅更新请求中携带的非空字段，其余保持原值 |

### 1.2 服务边界

| 方向 | 边界说明 |
|------|----------|
| **负责** | 流水线模板的存储、检索、参数校验、实例化后的流水线写入 |
| **不负责** | 流水线的调度执行、运行态监控、日志收集（由 Pipeline Engine 负责） |
| **不负责** | 前端页面渲染（由 orion-frontend 负责） |

### 1.3 内置模板清单

| 名称 | 分类 | 标签 |
|------|------|------|
| Node.js Build & Test | `language` | nodejs, build, test, javascript |
| Go Build & Test | `language` | go, golang, build, test |
| Java Maven Build | `language` | java, maven, build, test |
| Docker Build & Push | `platform` | docker, container, build, push |
| Frontend Deploy | `purpose` | frontend, deploy, static, web |

---

## 二、验收标准

| # | 验收条件 | 验证方法 |
|---|----------|----------|
| AC-01 | 支持完整的模板 CRUD（创建、列表、详情、更新、删除） | `POST/GET/GET/:id/PUT/:id/DELETE/:id` 返回正确状态码与数据 |
| AC-02 | 创建模板时 YAML 内容为空返回 400 | `POST /api/v1/templates` with empty yaml_content → 400 |
| AC-03 | 列表接口支持 category/tag/is_public 过滤 | 各过滤参数单独测试，返回结果匹配 |
| AC-04 | 列表接口支持分页（page/page_size） | 不同分页参数返回对应偏移量 |
| AC-05 | 更新接口仅修改携带的字段，不重置未传字段 | PUT 携带 name 字段 → 仅 name 变化，其余不变 |
| AC-06 | YAML 内容更新时版本号自动递增 | PUT yaml_content → version+1 |
| AC-07 | 删除不存在的模板返回 404 | DELETE 不存在的 id → 404 |
| AC-08 | 从模板实例化流水线，返回新 pipeline_id | POST `/templates/:id/instantiate` → 201 + `{pipeline_id}` |
| AC-09 | 实例化时校验必填参数，缺失返回 400 | 缺参数请求 → 400 + ErrMissingParam |
| AC-10 | `${PARAM}`/`$PARAM` 占位符被用户传入值替换 | 传入 params → 结果 YAML 中包含替换后的值 |
| AC-11 | 从流水线另存为模板（SaveAsTemplate） | POST `/templates/from-pipeline/:pipelineId` → 201 |
| AC-12 | 内置模板在首次启动时幂等写入 | 多次重启 → 不产生重复数据 |
| AC-13 | Count 接口返回正确的数量 | 创建/删除后 count 同步变化 |
| AC-14 | 所有写操作受权限控制（pipeline:write / pipeline:delete） | 无权限用户调用写接口 → 403 |
| AC-15 | 多租户隔离：租户 A 看不到租户 B 的私有模板 | 分别创建后交叉查询 → 仅公有模板可见 |

---

## 三、API 设计

### 3.1 路由概览

基础路径：`/api/v1/templates`

| 方法 | 路径 | 说明 | 认证 | 权限 |
|------|------|------|------|------|
| `POST` | `/api/v1/templates` | 创建模板 | JWT | pipeline:write |
| `GET` | `/api/v1/templates` | 列表模板 | JWT | — |
| `GET` | `/api/v1/templates/count` | 模板计数 | JWT | — |
| `GET` | `/api/v1/templates/:id` | 获取模板详情 | JWT | — |
| `PUT` | `/api/v1/templates/:id` | 更新模板 | JWT | pipeline:write |
| `DELETE` | `/api/v1/templates/:id` | 删除模板 | JWT | pipeline:delete |
| `POST` | `/api/v1/templates/:id/instantiate` | 实例化流水线 | JWT | pipeline:write |
| `POST` | `/api/v1/templates/from-pipeline/:pipelineId` | 另存为模板 | JWT | pipeline:write |

> 健康检查：`GET /healthz`（无认证）

### 3.2 请求 / 响应详情

#### 3.2.1 创建模板

```
POST /api/v1/templates
```

**Request Body**:
```json
{
  "name": "My Template",
  "description": "Description",
  "category": "custom",
  "yaml_content": "apiVersion: orion/v1\nkind: Pipeline\n...",
  "parameters": [
    {"name": "nodeVersion", "type": "string", "description": "Node version", "default_value": "18", "required": false}
  ],
  "is_public": false,
  "tags": ["nodejs", "build"]
}
```

**Response** `201 Created`:
```json
{
  "id": "uuid-string",
  "tenant_id": "t1",
  "name": "My Template",
  "description": "Description",
  "category": "custom",
  "yaml_content": "...",
  "parameters": [...],
  "version": 1,
  "is_public": false,
  "tags": [...],
  "usage_count": 0,
  "created_by": "user-id",
  "created_at": "2026-07-03T00:00:00Z",
  "updated_at": "2026-07-03T00:00:00Z"
}
```

**Error** `400`:
- `yaml_content` 为空 → `{"error": "yaml definition is required"}`
- `name` 缺失（binding required）→ `{"error": "Key: 'Name' Error:..."}`
- 无效 JSON 体 → `{"error": "invalid JSON"}`

#### 3.2.2 列表模板

```
GET /api/v1/templates?category=language&tag=nodejs&is_public=true&page=1&page_size=20
```

**Query Parameters**:

| 参数 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| `category` | string | 否 | — | 按分类过滤 |
| `tag` | string | 否 | — | 按标签过滤（JSONB array contains） |
| `is_public` | bool | 否 | — | 按公开/私有过滤 |
| `page` | int | 否 | 1 | 页码 |
| `page_size` | int | 否 | 20 | 每页条数（max 100） |

**Response** `200 OK`:
```json
{
  "data": [
    {
      "id": "uuid",
      "tenant_id": "t1",
      "name": "Node.js Build & Test",
      "description": "Standard Node.js CI pipeline",
      "category": "language",
      "yaml_content": "...",
      "parameters": [...],
      "version": 1,
      "is_public": true,
      "tags": ["nodejs", "build"],
      "usage_count": 3,
      "created_by": null,
      "created_at": "2026-07-03T00:00:00Z",
      "updated_at": "2026-07-03T00:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

#### 3.2.3 模板计数

```
GET /api/v1/templates/count
```

**Response** `200 OK`:
```json
{
  "count": 5
}
```

> 计数逻辑：`WHERE tenant_id=$1 OR is_public=true`

#### 3.2.4 获取模板详情

```
GET /api/v1/templates/:id
```

**Response** `200 OK`: 同创建返回的完整 `PipelineTemplate` 对象。

**Error** `404`:
- 模板不存在或不属于该租户 → `{"error": "template not found"}`

#### 3.2.5 更新模板

```
PUT /api/v1/templates/:id
```

**Request Body**（所有字段可选，仅更新非空字段）:
```json
{
  "name": "Updated Name",
  "yaml_content": "apiVersion: orion/v1\n..."
}
```

**Response** `200 OK`: 返回更新后的完整 `PipelineTemplate` 对象。

**规则**：
- 仅携带 JSON 中的非 `nil` 字段会被更新（`name`/`description`/`category` 为 `*string`，`null` 表示不更新）
- `parameters`/`tags` 为 `JSONB` 类型，`null` 表示不更新，空数组 `[]` 表示清空
- `yaml_content` 更新时版本号自动 +1

**Error** `404`:
- 模板不存在 → `{"error": "template not found"}`

#### 3.2.6 删除模板

```
DELETE /api/v1/templates/:id
```

**Response** `200 OK`:
```json
{
  "message": "deleted"
}
```

**Error** `404`:
- 模板不存在 → `{"error": "template not found"}`

#### 3.2.7 实例化流水线

```
POST /api/v1/templates/:id/instantiate
```

**Request Body**:
```json
{
  "name": "My Pipeline from Template",
  "project_id": "proj-123",
  "params": {
    "nodeVersion": "20",
    "testCommand": "npm run test:ci"
  }
}
```

**Response** `201 Created`:
```json
{
  "pipeline_id": "uuid-string",
  "name": "My Pipeline from Template",
  "version": 1
}
```

**实例化流程**：
1. 查询模板（当前租户范围）
2. 读取模板 YAML 内容
3. 遍历 `params`，将 `${PARAM}` 和 `$PARAM` 占位符替换为用户传入值
4. 校验模板声明的必填参数是否都已提供（无默认值且无传入值 → 400）
5. 写入 `pipelines` 表，返回新流水线 ID

**Error**:
- 模板不存在 → `404` `{"error": "template not found"}`
- 必填参数缺失 → `400` `{"error": "required parameter missing: <name>"}`
- 无效请求体 → `400`

#### 3.2.8 另存为模板

```
POST /api/v1/templates/from-pipeline/:pipelineId
```

**Request Body**（同创建模板，含 name/yaml_content 等但 yaml_content 会被覆盖）:
```json
{
  "name": "Saved from Pipeline",
  "description": "Auto-saved from pipeline xyz",
  "category": "custom",
  "tags": ["auto-saved"]
}
```

> 说明：`yaml_content` 字段在此接口中由系统自动从流水线配置中提取，请求体中的 `yaml_content` 被忽略。系统从 `pipelines.config` JSONB 中提取 `yamlDefinition` 字段作为模板内容。

**Response** `201 Created`: 同创建模板响应。

**Error**:
- 流水线不存在 → `404` `{"error": "pipeline not found"}`
- 流水线配置中无有效 YAML → `400` `{"error": "yaml definition is required"}`

### 3.3 通用错误码

| HTTP 状态码 | 场景 | 响应体 |
|-------------|------|--------|
| 400 | 请求体解析失败 / 参数校验不通过 | `{"error": "<具体错误>"}` |
| 401 | JWT 缺失或过期 | 由 auth middleware 返回 |
| 403 | 权限不足 | 由 auth middleware 返回 |
| 404 | 资源不存在 | `{"error": "template not found"}` / `{"error": "pipeline not found"}` |
| 500 | 服务端错误（DB 异常等） | `{"error": "<内部错误>"}` |

---

## 四、数据模型

### 4.1 实体关系图

```
ORM Entity: PipelineTemplate
├── 1 : N → TemplateParameter (embedded JSONB, not separate table)
└── M : 1 → Tenant (by tenant_id field)

Related: pipelines (referenced by Instantiate & SaveAsTemplate)
```

### 4.2 pipeline_templates 表

```sql
CREATE TABLE IF NOT EXISTS pipeline_templates (
    id          UUID PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL,
    name        VARCHAR(256) NOT NULL,
    description TEXT,
    category    VARCHAR(64) NOT NULL DEFAULT 'custom',
    yaml_content TEXT NOT NULL,
    parameters  JSONB NOT NULL DEFAULT '[]',
    version     INT NOT NULL DEFAULT 1,
    is_public   BOOLEAN NOT NULL DEFAULT false,
    tags        JSONB NOT NULL DEFAULT '[]',
    usage_count INT NOT NULL DEFAULT 0,
    created_by  VARCHAR(128),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pipeline_templates_tenant ON pipeline_templates(tenant_id, created_at);
CREATE INDEX idx_pipeline_templates_category ON pipeline_templates(category);
CREATE INDEX idx_pipeline_templates_tags ON pipeline_templates USING GIN(tags);
```

### 4.3 pipelines 表（外部引用）

```sql
CREATE TABLE IF NOT EXISTS pipelines (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    VARCHAR(64) NOT NULL,
    project_id   VARCHAR(64),
    name         VARCHAR(256) NOT NULL,
    trigger_type VARCHAR(32) NOT NULL DEFAULT 'manual',
    config       JSONB NOT NULL DEFAULT '{}',
    created_by   VARCHAR(128),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

> 说明：`pipelines` 表不属于本服务维护，本服务仅引用（Insert + GetConfig）。实际隶属 Pipeline Execution 服务。

### 4.4 数据模型结构体

#### PipelineTemplate

| 字段 | Go 类型 | 数据库类型 | JSON key | 说明 |
|------|---------|-----------|----------|------|
| ID | `string` | UUID | `id` | 主键 |
| TenantID | `string` | VARCHAR(64) | `tenant_id` | 租户隔离 |
| Name | `string` | VARCHAR(256) | `name` | 模板名称 |
| Description | `string` | TEXT | `description` | 描述（可选） |
| Category | `string` | VARCHAR(64) | `category` | 分类（默认 "custom"） |
| YAMLContent | `string` | TEXT | `yaml_content` | 流水线 YAML 定义 |
| Parameters | `JSONB` | JSONB | `parameters` | 参数声明数组 |
| Version | `int` | INT | `version` | 版本号（YAML 更新时递增） |
| IsPublic | `bool` | BOOLEAN | `is_public` | 是否公开（跨租户可见） |
| Tags | `JSONB` | JSONB | `tags` | 标签数组 |
| UsageCount | `int` | INT | `usage_count` | 引用计数 |
| CreatedBy | `*string` | VARCHAR(128) | `created_by` | 创建者 |
| CreatedAt | `time.Time` | TIMESTAMPTZ | `created_at` | 创建时间 |
| UpdatedAt | `time.Time` | TIMESTAMPTZ | `updated_at` | 更新时间 |

#### TemplateParameter（embedded in JSONB）

| 字段 | Go 类型 | JSON key | 说明 |
|------|---------|----------|------|
| Name | `string` | `name` | 参数名称 |
| Type | `string` | `type` | 参数类型：string \| number \| boolean \| array |
| Description | `string` | `description` | 参数说明 |
| DefaultValue | `interface{}` | `default_value` | 默认值（可选） |
| Required | `bool` | `required` | 是否必填 |

### 4.5 DTO 定义

#### CreatePipelineTemplateRequest

| 字段 | 类型 | 必填 | JSON key | 说明 |
|------|------|------|----------|------|
| Name | `string` | ✅ | `name` | 模板名称 |
| Description | `string` | ❌ | `description` | 描述 |
| Category | `string` | ❌ | `category` | 分类（为空时默认 "custom"） |
| YAMLContent | `string` | ✅ | `yaml_content` | YAML 定义 |
| Parameters | `JSONB` | ❌ | `parameters` | 参数声明（为空时默认 `[]`） |
| IsPublic | `bool` | ❌ | `is_public` | 是否公开 |
| Tags | `JSONB` | ❌ | `tags` | 标签（为空时默认 `[]`） |

#### UpdatePipelineTemplateRequest

所有字段为指针类型，`null` = 不更新，非 `null` = 更新。

| 字段 | 类型 | JSON key | 说明 |
|------|------|----------|------|
| Name | `*string` | `name` | 更新名称 |
| Description | `*string` | `description` | 更新描述 |
| Category | `*string` | `category` | 更新分类 |
| YAMLContent | `*string` | `yaml_content` | 更新 YAML（同时版本号+1） |
| Parameters | `JSONB` | `parameters` | 更新参数（nil=跳过, `[]`=清空） |
| IsPublic | `*bool` | `is_public` | 更新公开状态 |
| Tags | `JSONB` | `tags` | 更新标签（nil=跳过, `[]`=清空） |

#### InstantiateTemplateRequest

| 字段 | 类型 | 必填 | JSON key | 说明 |
|------|------|------|----------|------|
| Name | `string` | ✅ | `name` | 新流水线名称 |
| ProjectID | `string` | ❌ | `project_id` | 所属项目 ID |
| Params | `map[string]interface{}` | ❌ | `params` | 参数值映射 |

#### ListResult

| 字段 | 类型 | 说明 |
|------|------|------|
| Data | `[]PipelineTemplate` | 当前页数据 |
| Total | `int` | 满足过滤条件的总数 |
| Page | `int` | 当前页码 |
| Limit | `int` | 每页条数 |

#### InstantiateResult

| 字段 | 类型 | 说明 |
|------|------|------|
| PipelineID | `string` | 新创建的流水线 ID |
| Name | `string` | 流水线名称 |
| Version | `int` | 初始版本 1 |

### 4.6 JSONB 自定义类型

本服务定义自定义 `JSONB` 类型（`json.RawMessage` 包装），实现：

- `driver.Valuer` + `sql.Scanner` → 支持 PostgreSQL JSONB 列的读写
- `json.Marshaler` + `json.Unmarshaler` → 支持 Gin 的 JSON 序列化/反序列化
- 支持 `nil` 值（SQL NULL → Go nil）

---

## 五、依赖与集成

### 5.1 内部依赖

| 依赖 | 用途 | 模块路径 |
|------|------|----------|
| `orion/go-common` | 公共基础设施 | `orion/go-common`（local replace） |
| ├─ `auth` | JWT 认证 + 权限校验 (`RequirePermission`) | `orion/go-common/pkg/auth` |
| ├─ `database` | PostgreSQL 连接管理 + 迁移 | `orion/go-common/pkg/database` |
| ├─ `logger` | 结构化日志（基于 zap） | `orion/go-common/pkg/logger` |
| └─ `middleware` | Recovery / RequestID / StructuredLogger / CORS / HealthCheck | `orion/go-common/pkg/middleware` |
| `orion/go-common/pkg/redis` | Redis 客户端（JWT session 验证） | `orion/go-common/pkg/redis` |

### 5.2 外部依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| `github.com/gin-gonic/gin` | v1.10.0 | HTTP 路由框架 |
| `github.com/google/uuid` | v1.6.0 | UUID 生成 |
| `github.com/jmoiron/sqlx` | v1.4.0 | PostgreSQL 扩展查询（命名参数、StructScan） |
| `github.com/lib/pq` | v1.10.9 | PostgreSQL 驱动 |
| `go.uber.org/zap` | (由 go-common 传递) | 高性能结构化日志 |

### 5.3 基础设施依赖

| 组件 | 用途 | 默认连接 |
|------|------|----------|
| PostgreSQL | 持久化模板数据 | `orion_pipeline_template` DB, `localhost:5432` |
| Redis | JWT session 缓存（认证） | `localhost:6379` |

### 5.4 集成接口

| 上游系统 | 交互方式 | 说明 |
|----------|----------|------|
| API Gateway | HTTP 反向代理 | 外部请求经 Gateway → pipeline-template-svc |
| Pipeline Engine | DB 共享 | 实例化时写入 `pipelines` 表，由引擎调度执行 |
| orion-frontend | REST API | 前端通过 API Gateway 调用模板管理页面 |

### 5.5 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `PORT` | ❌ | `8080` | HTTP 监听端口 |
| `DB_HOST` | ❌ | `localhost` | PostgreSQL 主机 |
| `DB_PORT` | ❌ | `5432` | PostgreSQL 端口 |
| `DB_USER` | ✅ | — | PostgreSQL 用户 |
| `DB_PASSWORD` | ✅ | — | PostgreSQL 密码 |
| `DB_NAME` | ❌ | `orion_pipeline_template` | 数据库名 |
| `DB_SSLMODE` | ❌ | `disable` | SSL 模式 |
| `JWT_SECRET` | ❌ | `change-me-in-production` | JWT 签名密钥 |
| `REDIS_ADDR` | ❌ | `localhost:6379` | Redis 地址 |

### 5.6 中间件链（请求处理顺序）

```
gin.Recovery() → RequestID() → StructuredLogger() → CORS() → [Group: /api/v1] → Auth(JWT) → [Group: /templates] → handler
```

写操作额外经过 `auth.RequirePermission("pipeline", "write"|"delete")`。

---

## 六、注意事项

### 6.1 多租户隔离策略

| 查询类型 | 租户过滤逻辑 |
|----------|--------------|
| GetByID | `WHERE id=$1 AND tenant_id=$2` — 严格隔离 |
| List | `WHERE (tenant_id=$1 OR is_public=true)` — 租户私有 + 全局公开 |
| Count | `WHERE tenant_id=$1 OR is_public=true` |
| Delete | `WHERE id=$1 AND tenant_id=$2` — 严格隔离 |
| Update | `WHERE id=$1 AND tenant_id=$2` — 严格隔离 |

> 系统内置模板的 `tenant_id` 为 `"system"`，`is_public=true`，对所有租户可见。

### 6.2 参数替换规则

- 支持 `${PARAM}` 和 `$PARAM` 两种占位符语法
- 替换时同时尝试大小写保留 key 和全大写 key（`${key}` 和 `${KEY}`）
- 仅替换模板自声明参数中的必填项做严格校验；非必填参数无默认值且未传入时留空
- 替换仅对 YAML 内容做字符串替换，不涉及 YAML 结构化解析

### 6.3 安全注意事项

| # | 注意项 | 说明 |
|---|--------|------|
| 1 | JWT_SECRET 默认值 | 默认 `change-me-in-production`，生产环境必须修改 |
| 2 | SQL 注入防护 | 参数值通过 `$N` 占位符绑定，无字符串拼接 |
| 3 | 权限校验 | 写操作必须通过 `auth.RequirePermission` 检查 |
| 4 | YAML 注入 | 参数替换后插入的 `yaml_content` 当前无校验，需确保传入值不含恶意内容 |
| 5 | DB_USER/DB_PASSWORD | 强制要求环境变量注入，代码中无硬编码 |

### 6.4 已知限制

| # | 限制 | 说明 |
|---|------|------|
| 1 | 标签过滤为精确匹配 | `ANY(tags)` 要求标签值完全一致，不支持模糊/前缀匹配 |
| 2 | 参数替换为纯文本替换 | 不解析 YAML 节点，可能在注释或字符串中产生意外替换 |
| 3 | usage_count 未自动递增 | 当前 `usage_count` 仅在 Create 时初始化，实例化后未自动 +1 |
| 4 | 无模板导入/导出 | 不支持批量导入/导出模板定义 |
| 5 | 无版本历史 | 更新后旧版本 YAML 被覆盖，不支持回滚 |
| 6 | 无软删除 | Delete 直接物理删除，不支持回收站 |

### 6.5 演进建议

| 优先级 | 建议 | 说明 |
|--------|------|------|
| P0 | usage_count 自动递增 | 实例化成功后 `UPDATE usage_count = usage_count + 1` |
| P1 | 模板版本历史 | 增加版本快照表，支持回滚和版本对比 |
| P1 | 标签模糊搜索 | 添加 `ILIKE` 或全文索引支持 |
| P2 | 批量导入/导出 | YAML 或 JSON 格式批量操作 |
| P2 | 模板预览 | 提供渲染后的 YAML 预览端点（参数替换后但未持久化） |
| P2 | 软删除 | 增加 `deleted_at` 字段，保留数据一段时间 |

### 6.6 已实现测试

| 测试文件 | 测试内容 | 断言 |
|----------|----------|------|
| `internal/models/models_test.go` | PipelineTemplate 字段赋值 | TenantID = "t1" |
| `internal/models/models_test.go` | PaginatedRequest 默认值 | Limit = 20 |
| `internal/service/service_test.go` | 哨兵错误别名兼容性 | ErrPipelineTemplateNotFound 消息 = "template not found" |

> 当前测试覆盖度较低，建议补充完整的 Service 层单元测试和 Handler 层集成测试。
