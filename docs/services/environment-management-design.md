# S15 环境管理模块（Environment Management）设计文档

| 元数据 | 内容 |
|--------|------|
| **模块编号** | S15 |
| **模块名称** | Environment Management（环境管理） |
| **状态** | 已实现（~85%） |
| **最后更新** | 2026-05-15 |
| **负责人** | Platform Team |

---

## 1. 模块概述

环境管理模块负责管理平台中所有**部署目标环境**的完整生命周期。环境是项目部署的运行时上下文，定义了 Kubernetes 集群、命名空间、资源配置等关键信息，为 Pipeline 部署、金丝雀发布、配置管理等下游模块提供环境元数据。

### 1.1 核心职责

- **环境 CRUD**：创建、查询、更新、删除部署环境
- **项目作用域**：每个环境归属于特定项目，支持按项目过滤
- **类型分类**：支持 dev / testing / staging / pre-prod / prod 等环境类型
- **状态管理**：跟踪环境运行状态（active / inactive / maintenance / deprecated）
- **配置存储**：通过 JSONB 字段管理每个环境的变量和资源配置
- **环境休眠**：支持空闲环境的自动休眠与唤醒（K8s 集成）
- **TTL 管理**：支持基于 TTL 的自动休眠策略

### 1.2 设计原则

1. **项目级隔离**：环境归属于项目，不同项目环境互不干扰
2. **多租户安全**：通过 RLS 策略实现租户级数据隔离
3. **灵活配置**：config 字段采用 JSONB 存储，支持任意结构的环境变量
4. **K8s 可选集成**：休眠/唤醒功能优先使用真实 K8s API，降级为模拟模式

---

## 2. 架构设计

### 2.1 分层架构

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  orion-frontend/src/pages/Environments/index.tsx        │
│  - 列表页 / 创建弹窗 / 编辑弹窗 / 详情抽屉               │
│  - SearchFilterBar（搜索 + 过滤）                        │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP (Axios)
                       ▼
┌─────────────────────────────────────────────────────────┐
│               API Client Layer                           │
│  orion-frontend/src/api/environments.ts                 │
│  - getEnvironments / createEnvironment / ...            │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP /api/v1/environments/*
                       ▼
┌─────────────────────────────────────────────────────────┐
│              API Routes (Fastify)                        │
│  orion-platform-service/src/api/environment-routes.ts   │
│  - POST /environments                                    │
│  - GET  /environments                                    │
│  - GET  /environments/:id                                │
│  - PUT  /environments/:id                                │
│  - DELETE /environments/:id                              │
│  - POST /environments/:id/status                         │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Controller Layer                            │
│  orion-platform-service/src/api/controllers/            │
│    EnvironmentController.ts                              │
│  - 请求参数校验 → 调用 Service → HTTP 响应映射           │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Service Layer                               │
│  orion-platform-service/src/services/environment/       │
│    EnvironmentService.ts                                 │
│  - 业务规则校验（类型白名单、状态白名单）                │
│    EnvironmentExecutorService.ts                         │
│  - 休眠/唤醒、TTL 检查、K8s 扩缩容                       │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Repository Layer                            │
│  EnvironmentRepository.ts                                │
│  - PostgreSQL 直接查询（SQL 参数化）                     │
│  - In-Memory Map 降级（开发/测试模式）                   │
│  EnvironmentExecutorRepository.ts                        │
│  - 继承 BaseRepository，管理休眠状态持久化               │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              PostgreSQL Database                         │
│  - environments 表（核心环境定义）                       │
│  - environment_executor_states 表（休眠状态）            │
│  - environment_templates 表（环境模板）                  │
│  - environment_hibernation_log 表（休眠日志）            │
│  - environment_ttl_config 表（TTL 配置）                 │
│  - ephemeral_environments 表（临时环境）                 │
└─────────────────────────────────────────────────────────┘
```

### 2.2 数据流

```
用户操作 → Frontend → API Client → Fastify Route → Controller
  → Service（业务逻辑 + 校验） → Repository（SQL 查询）
  → PostgreSQL → 响应数据逐层返回
```

---

## 3. 环境类型与生命周期

### 3.1 环境类型（Environment Type）

| 类型值 | 中文标签 | 用途说明 | 默认副本数 |
|--------|---------|---------|-----------|
| `dev` / `development` | 开发 | 开发者本地联调环境 | 1 |
| `testing` | 测试 | 自动化测试 / QA 验证 | 1 |
| `staging` | 预发 | 上线前验证，数据接近生产 | 2 |
| `pre-prod` | 预生产 | 生产前最终验证 | 2 |
| `prod` / `production` | 生产 | 线上正式环境 | 3+ |

**校验逻辑**：Service 层通过 `VALID_ENV_TYPES` 常量白名单校验，非白名单类型将抛出 `INVALID_INPUT` 错误。

### 3.2 环境状态（Status）

| 状态值 | 中文标签 | 说明 | 可迁移至 |
|--------|---------|------|---------|
| `active` | 运行中 | 环境正常运行 | maintenance, inactive, deprecated |
| `inactive` | 已停用 | 环境已停用，资源保留 | active |
| `maintenance` | 维护中 | 环境正在维护/升级 | active, inactive |
| `deprecated` | 已废弃 | 环境标记废弃，计划删除 | - |

**休眠状态**（Executor 层独立管理）：

| 状态值 | 说明 |
|--------|------|
| `active` | 活跃运行 |
| `hibernating` | 休眠中（缩容进行中） |
| `hibernated` | 已休眠（副本数为 0） |
| `waking` | 唤醒中（扩容进行中） |
| `error` | 异常状态 |

### 3.3 状态转换图

```
                    ┌──────────┐
                    │  active  │◄──────────────┐
                    └────┬─────┘               │
              ┌──────────┼──────────┐          │
              ▼          ▼          ▼          │
         inactive   maintenance  hibernating   │
              │          │          │          │
              │          ▼          ▼          │
              │     ┌────────┐  ┌──────────┐   │
              │     │ active │  │hibernated│───┘
              │     └────────┘  └────┬─────┘  (wake)
              │                      ▼
              │                 waking ──► error
              ▼
          deprecated
```

---

## 4. 项目作用域与租户隔离

### 4.1 项目作用域（Project Scoping）

- 每个环境通过 `project_id`（UUID）关联到特定项目
- `project_id` 是创建环境的必填字段
- 查询支持 `?projectId=` 参数按项目过滤
- 删除项目时，环境的 `project_id` 被设为 NULL（`ON DELETE SET NULL`）

### 4.2 租户隔离（Tenant Isolation）

- `tenant_id` 为 UUID 类型，关联 `tenants` 表
- 通过 PostgreSQL RLS（Row Level Security）实现租户级数据隔离
- RLS 策略：`tenant_isolation_environments`，使用 `current_setting('app.current_tenant_id')` 进行过滤
- `UNIQUE(tenant_id, name)` 约束确保同一租户下环境名称唯一
- 外键 `REFERENCES tenants(id) ON DELETE CASCADE`：删除租户时级联删除环境

### 4.3 数据库索引

```sql
idx_environments_tenant   -- tenant_id（RLS 过滤）
idx_environments_project  -- project_id（按项目查询）
```

---

## 5. 变量管理

### 5.1 配置结构

环境配置通过 `config` 字段（JSONB 类型）存储，支持任意结构的键值对。典型结构：

```json
{
  "replicas": 3,
  "resources": {
    "cpu": "500m",
    "memory": "1Gi"
  },
  "variables": {
    "NODE_ENV": "production",
    "LOG_LEVEL": "info",
    "FEATURE_FLAG_NEW_UI": "false"
  },
  "ingress": {
    "host": "api.prod.example.com",
    "tls": true
  }
}
```

### 5.2 环境变量模板（规划中）

`environment_templates` 表已创建，支持：

- 定义标准化的环境模板（standard / development / staging / production / testing）
- 模板包含资源定义（CPU、内存、存储）、变量模板、网络配置
- 创建环境时可从模板实例化，自动填充默认变量

### 5.3 TTL 配置

`environment_ttl_config` 表支持：

| 字段 | 说明 | 默认值 |
|------|------|--------|
| `max_lifetime_hours` | 最大存活时间 | 24h |
| `auto_hibernate` | 是否自动休眠 | true |
| `hibernate_after_hours` | 空闲后自动休眠时间 | 8h |
| `auto_delete` | 是否自动删除 | false |
| `notification_hours` | 提前通知时间（数组） | [2, 1]h |

---

## 6. API 端点

### 6.1 基础路径

```
/api/v1/environments
```

### 6.2 端点列表

#### 6.2.1 创建环境

```
POST /api/v1/environments
Content-Type: application/json

// 请求体
{
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "staging-us",
  "type": "staging",
  "cluster": "k8s-staging-01",
  "namespace": "staging-us",
  "config": {
    "replicas": 2,
    "variables": { "NODE_ENV": "staging" }
  }
}

// 响应 201 Created
{
  "id": "env-1716200000000-abc1234",
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "staging-us",
  "type": "staging",
  "cluster": "k8s-staging-01",
  "namespace": "staging-us",
  "config": { "replicas": 2, "variables": { "NODE_ENV": "staging" } },
  "status": "active",
  "created_at": "2026-05-15T10:00:00Z",
  "updated_at": "2026-05-15T10:00:00Z"
}
```

#### 6.2.2 列出环境

```
GET /api/v1/environments?projectId=550e8400-e29b-41d4-a716-446655440000

// 响应 200 OK
[
  {
    "id": "env-...",
    "project_id": "550e8400-...",
    "name": "staging-us",
    "type": "staging",
    "cluster": "k8s-staging-01",
    "namespace": "staging-us",
    "config": { ... },
    "status": "active",
    "created_at": "...",
    "updated_at": "..."
  }
]
```

#### 6.2.3 获取环境详情

```
GET /api/v1/environments/:id

// 响应 200 OK（同创建响应格式）
// 404 Not Found：{ "error": "NOT_FOUND", "message": "..." }
```

#### 6.2.4 更新环境

```
PUT /api/v1/environments/:id
Content-Type: application/json

// 请求体（所有字段可选）
{
  "name": "staging-us-east",
  "cluster": "k8s-staging-02",
  "config": { "replicas": 3 }
}

// 响应 200 OK（更新后的完整环境对象）
```

#### 6.2.5 删除环境

```
DELETE /api/v1/environments/:id

// 响应 204 No Content
// 404 Not Found：环境不存在
```

#### 6.2.6 更新环境状态

```
POST /api/v1/environments/:id/status
Content-Type: application/json

// 请求体
{ "status": "maintenance" }

// 响应 200 OK（返回更新后的环境对象，仅含 id, project_id, name, type, status, updated_at）
```

### 6.3 错误码

| HTTP 状态码 | 错误码 | 说明 |
|-------------|--------|------|
| 400 | `VALIDATION_ERROR` | 参数校验失败（缺少必填字段、非法类型/状态值） |
| 404 | `NOT_FOUND` | 环境不存在 |
| 500 | `INTERNAL_ERROR` | 内部服务器错误 |
| 500 | `DELETE_FAILED` | 删除操作失败 |

---

## 7. 数据模型

### 7.1 environments 表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | 主键 |
| `tenant_id` | UUID | NOT NULL, FK → tenants(id), ON DELETE CASCADE | 租户 ID |
| `project_id` | UUID | FK → projects(id), ON DELETE SET NULL | 项目 ID |
| `name` | VARCHAR(200) | NOT NULL | 环境名称 |
| `type` | VARCHAR(50) | NOT NULL | 环境类型 |
| `cluster` | VARCHAR(200) | NULL | K8s 集群名称 |
| `namespace` | VARCHAR(200) | NULL | K8s 命名空间 |
| `config` | JSONB | NOT NULL, DEFAULT '{}' | 环境配置（变量、资源等） |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'active' | 运行状态 |
| `template_id` | UUID | FK → environment_templates(id), ON DELETE SET NULL | 环境模板 ID |
| `ttl_config_id` | UUID | FK → environment_ttl_config(id), ON DELETE SET NULL | TTL 配置 ID |
| `hibernation_status` | VARCHAR(20) | NOT NULL, DEFAULT 'active' | 休眠状态 |
| `last_hibernated_at` | TIMESTAMPTZ | NULL | 最后休眠时间 |
| `last_woken_at` | TIMESTAMPTZ | NULL | 最后唤醒时间 |
| `resource_usage` | JSONB | NOT NULL, DEFAULT '{}' | 资源使用记录 |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | 创建时间 |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | 更新时间 |

**约束**：`UNIQUE(tenant_id, name)`

### 7.2 TypeScript 接口

```typescript
// Repository 层（数据库原生格式）
interface Environment {
  id: string;
  tenant_id: string;
  project_id: string;
  name: string;
  type: string;
  cluster?: string;
  namespace?: string;
  config: Record<string, any>;
  status: string;
  created_at?: Date;
  updated_at?: Date;
}

// Frontend 层（驼峰命名 + 类型安全）
type EnvironmentType = 'dev' | 'staging' | 'prod' | 'testing' | 'pre-prod' | 'production' | 'development';
type EnvironmentStatus = 'active' | 'inactive' | 'maintenance' | 'deprecated';

interface Environment {
  id: string;
  project_id: string;
  name: string;
  type: EnvironmentType;
  cluster?: string;
  namespace?: string;
  config?: Record<string, any>;
  status: EnvironmentStatus;
  created_at?: string;
  updated_at?: string;
}
```

### 7.3 关联表

| 表名 | 用途 | 关联 |
|------|------|------|
| `environment_templates` | 环境模板定义 | tenant_id 隔离 |
| `environment_hibernation_log` | 休眠/唤醒操作日志 | FK → environments(id) |
| `environment_ttl_config` | TTL 自动休眠策略 | FK → environments(id) |
| `environment_executor_states` | Executor 休眠状态 | tenant_id + env_id 联合唯一 |
| `ephemeral_environments` | PR 临时环境 | namespace UNIQUE |

---

## 8. 前端页面结构

### 8.1 页面文件

```
orion-frontend/src/pages/Environments/
├── index.tsx          # 主页面组件（EnvironmentManagement）
└── __tests__/
    └── index.test.tsx # 单元测试
```

### 8.2 页面布局

```
┌─────────────────────────────────────────────────────┐
│  环境管理                              [刷新] [创建环境] │
│  管理项目的部署环境（开发、测试、预发、生产）            │
├─────────────────────────────────────────────────────┤
│  [搜索框: 搜索环境名称、集群、命名空间...]              │
│  [环境类型 ▼] [状态 ▼]                                │
├─────────────────────────────────────────────────────┤
│  环境名称      │ 类型   │ 状态    │ 集群   │ 命名空间  │ 操作 │
│  ─────────────────────────────────────────────────  │
│  dev-default   │ [开发]  │ [运行中] │ k8s... │ default  │ 详情 编辑 维护 停用 删除 │
│  production    │ [生产]  │ [运行中] │ k8s... │ production│ 详情 编辑 维护 停用 删除 │
└─────────────────────────────────────────────────────┘
```

### 8.3 交互组件

| 组件 | 用途 | 实现 |
|------|------|------|
| **主表格** | 环境列表展示 | 自定义 `<Table>` 组件，支持排序、斑马纹 |
| **SearchFilterBar** | 搜索 + 类型/状态过滤 | 自定义组件，支持组合过滤 |
| **创建弹窗** | 新建环境表单 | Ant Design `<Modal>` + `<Form>` |
| **编辑弹窗** | 编辑环境信息 | 同上，预填当前值 |
| **详情抽屉** | 环境详细信息 | Ant Design `<Drawer>` + `<Descriptions>` |
| **状态操作** | 快捷状态切换 | 表格行内按钮（维护/恢复/停用） |
| **删除确认** | 二次确认删除 | Ant Design `<Popconfirm>` |

### 8.4 前端 API 客户端

文件：`orion-frontend/src/api/environments.ts`

```typescript
// 导出函数
getEnvironments(params?: { projectId?: string })   → GET  /v1/environments
getEnvironment(id: string)                          → GET  /v1/environments/:id
createEnvironment(data: CreateEnvironmentInput)     → POST /v1/environments
updateEnvironment(id: string, data: UpdateEnvInput) → PUT  /v1/environments/:id
deleteEnvironment(id: string)                       → DELETE /v1/environments/:id
updateEnvironmentStatus(id, data)                   → POST /v1/environments/:id/status
```

---

## 9. 集成点

### 9.1 与 Pipeline 引擎集成

- Pipeline 部署阶段通过 `project_id` + `type` 查询目标环境
- 环境定义了部署的 Kubernetes 集群和命名空间
- `config` 中的变量可注入到 Pipeline 运行时环境变量中
- Migration 137 已在 `pipeline_runs` 表中添加 `environment_id` 字段，关联部署记录

### 9.2 与部署服务集成

- Deploy Service 使用环境的 `cluster` + `namespace` 作为 K8s 部署目标
- 环境的 `config` 提供部署所需的副本数、资源限制等参数
- `status` 为 `inactive` / `maintenance` 的环境应拒绝部署请求

### 9.3 环境休眠（Environment Executor）

`EnvironmentExecutorService` 提供：

| 方法 | 功能 |
|------|------|
| `hibernateEnvironment()` | 休眠环境（K8s 缩容至 0 副本） |
| `wakeEnvironment()` | 唤醒环境（恢复至休眠前副本数） |
| `checkTTLAndHibernate()` | 定时检查 TTL，自动休眠空闲环境 |
| `setEnvironmentTTL()` | 设置环境的 TTL 策略 |
| `configureK8s()` | 配置环境的 K8s 关联信息 |
| `recordActivity()` | 记录活动，重置空闲计时器 |
| `getK8sScaleInfo()` | 查询 K8s 扩缩容历史 |

**K8s 集成策略**：
- 优先使用 `@kubernetes/client-node` 进行真实的 Deployment/StatefulSet 扩缩容
- K8s 不可用时降级为模拟模式（仅更新状态，不操作 K8s 资源）
- 休眠时记录 `previousReplicas`，唤醒时自动恢复

### 9.4 临时环境（Ephemeral Environments）

`ephemeral_environments` 表支持 PR 级别的临时预览环境：

- 与 PR（Pull Request）关联，自动创建和销毁
- 独立的命名空间（`namespace` UNIQUE 约束）
- 生命周期：provisioning → active → idle → auto-destroy
- 与标准环境的区别：临时环境不与 `project_id` 关联，而是与 `pr_id` + `repo_id` 关联

### 9.5 与配置管理集成

- 环境的 `config` JSONB 字段可存储任意配置数据
- 与 Secrets Service 配合，环境变量中引用密钥
- 未来可与 ConfigMap / Secret 资源同步

---

## 10. 未来增强

### 10.1 环境晋升（Environment Promotion）

**目标**：支持代码/制品在不同环境间的自动晋升。

```
dev → testing → staging → prod
```

- 定义晋升规则（自动 / 手动审批）
- 记录晋升历史
- 晋升时自动验证目标环境状态

### 10.2 环境级审批门（Approval Gates）

- 为每个环境类型配置审批策略
- `prod` 环境部署前需要指定数量的审批人
- 与 Approval Service 集成，支持审批回调

### 10.3 环境比较与差异

- 对比两个环境的配置差异（config JSONB diff）
- 环境模板与实际配置的偏差报告
- 生产环境漂移检测

### 10.4 环境健康检查

- 定期探测环境可用性（HTTP health check）
- 自动标记不健康环境为 `maintenance` 状态
- 与 Prometheus 集成，展示环境级监控指标

### 10.5 环境成本分析

- 统计每个环境的资源消耗和成本
- 休眠环境节省成本的量化报告
- 按环境类型 / 项目汇总 FinOps 数据

### 10.6 环境快照与回滚

- 创建环境配置快照
- 回滚到历史配置版本
- 支持环境克隆（从现有环境快速创建新环境）

### 10.7 GitOps 集成

- 环境配置与 Git 仓库同步
- ArgoCD / Flux 集成，环境变更自动触发同步
- 环境漂移检测与自动修正

---

## 11. 文件清单

### 后端

| 文件路径 | 说明 |
|----------|------|
| `orion-platform-service/src/api/environment-routes.ts` | Fastify 路由注册 |
| `orion-platform-service/src/api/controllers/EnvironmentController.ts` | HTTP 请求处理 |
| `orion-platform-service/src/services/environment/EnvironmentService.ts` | 业务逻辑层 |
| `orion-platform-service/src/services/environment/EnvironmentRepository.ts` | PostgreSQL 数据访问 |
| `orion-platform-service/src/services/environment/EnvironmentExecutorService.ts` | 休眠/唤醒/TTL 管理 |
| `orion-platform-service/src/services/environment/index.ts` | 模块导出 |
| `orion-platform-service/src/repositories/EnvironmentExecutorRepository.ts` | Executor 状态持久化 |
| `orion-platform-service/src/services/environment/__tests__/EnvironmentService.test.ts` | Service 单元测试 |
| `orion-platform-service/src/services/environment/__tests__/EnvironmentRepository.test.ts` | Repository 单元测试 |

### 数据库迁移

| 文件路径 | 说明 |
|----------|------|
| `orion-platform-service/src/db/migrations/008_create_environments.sql` | environments 主表 |
| `orion-platform-service/src/db/migrations/025_create_ephemeral_env_tables.sql` | 临时环境表 |
| `orion-platform-service/src/db/migrations/066_create_ephemeral_environments.sql` | PR 临时环境表 |
| `orion-platform-service/src/db/migrations/089_environment_management.sql` | 模板/休眠日志/TTL/RLS |
| `orion-platform-service/src/db/migrations/135_create_pipeline_environments.sql` | Pipeline 环境关联 |
| `orion-platform-service/src/db/migrations/137_add_environment_to_pipeline_runs.sql` | pipeline_runs 关联 |
| `orion-platform-service/src/db/migrations/145_fix_rls_policies.sql` | RLS 策略修复 |

### 前端

| 文件路径 | 说明 |
|----------|------|
| `orion-frontend/src/pages/Environments/index.tsx` | 环境管理主页面（~665 行） |
| `orion-frontend/src/pages/Environments/__tests__/index.test.tsx` | 页面单元测试 |
| `orion-frontend/src/api/environments.ts` | API 客户端（类型定义 + CRUD 函数） |

---

## 12. 已知限制与待改进项

| 编号 | 问题 | 优先级 | 说明 |
|------|------|--------|------|
| GAP-1 | `EnvironmentRepository.isDbAvailable()` 硬编码返回 true | 中 | 应检测实际数据库连接状态 |
| GAP-2 | 创建环境时 `tenant_id` 在 Repository 层硬编码为 `mock-tenant` | 高 | 应从认证上下文或请求头获取 |
| GAP-3 | 缺少按模板创建环境的功能 | 中 | `environment_templates` 表已创建但未集成 |
| GAP-4 | 前端创建表单中 `projectId` 为手动输入 | 中 | 应改为项目选择器下拉 |
| GAP-5 | 缺少环境批量操作 | 低 | 批量删除、批量状态变更 |
| GAP-6 | `EnvironmentExecutorService` 未通过路由暴露 API | 中 | 休眠/唤醒/TTL 功能缺少 HTTP 接口 |
| GAP-7 | 缺少环境变量版本历史 | 低 | config 变更无审计追踪 |
