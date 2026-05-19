# CMDB + 运维操作统一插件化架构设计方案

> 版本：v1.0
> 日期：2026-05-19
> 状态：设计完成，待评审

---

## 一、背景与目标

### 1.1 问题陈述

Orion 平台当前存在两个独立的后端系统：

| 系统 | 技术栈 | 定位 | 状态 |
|------|--------|------|------|
| CMDB | TypeScript + Fastify | 配置管理数据库 | ✅ 完整实现 |
| 运维操作平台 | Java + Spring Boot (orion-visor) | 远程终端/批量执行/监控 | ✅ 代码完整 |

**问题**：
1. 技术栈不统一（TS + Java）
2. 两个系统独立运行，数据未串联
3. 缺乏统一的插件化治理

### 1.2 设计目标

1. **技术栈统一** — 复用 orion-platform-service TypeScript + Fastify 基础设施
2. **统一插件架构** — 复用现有插件系统设计理念
3. **数据串联** — CMDB 与运维操作平台双向数据同步
4. **可扩展性** — 插件化架构支持未来功能扩展
5. **标准模板** — 作为 Orion 平台统一插件化模块标准

### 1.3 范围

| 模块 | 功能 | 迁移策略 |
|------|------|----------|
| CMDB 核心 | CI 配置项、关系管理、拓扑、版本 | 复用现有 TS 实现 |
| CMDB 增强 | 影响分析、变更审批 | TS 新增 |
| 远程终端 | SSH/RDP/VNC 连接 | orion-visor Java 逻辑提取，TS 实现 |
| 批量执行 | 命令分发、文件传输 | orion-visor Java 逻辑提取，TS 实现 |
| 计划任务 | Cron 定时任务 | TS 新增（复用 platform cron 基础设施） |
| 系统监控 | CPU/内存/磁盘监控 | orion-visor 逻辑提取，TS 实现 |

---

## 二、架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         API Gateway (3000)                          │
│                    统一入口，统一认证，统一路由                        │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
        ┌───────────────────┐  ┌─────────────┐  ┌─────────────┐
        │   CMDB Service    │  │  Ops Service │  │ Other       │
        │   (TS Module)     │  │  (TS Module) │  │ Services    │
        └───────────────────┘  └─────────────┘  └─────────────┘
                    │                     │
        ┌───────────┴───────────┐  ┌───────┴───────┐
        │                       │  │               │
        ▼                       ▼  ▼               ▼
  ┌──────────┐            ┌──────────┐      ┌──────────┐
  │PostgreSQL│            │  Redis   │      │  Redis   │
  │ (CMDB)   │            │ (Cache)  │      │ (Session)│
  └──────────┘            └──────────┘      └──────────┘
```

### 2.2 微服务模块划分

#### orion-cmdb-service (TypeScript + Fastify)

```
orion-platform-service/src/services/cmdb/
├── index.ts                  # 入口
├── service.ts               # CI CRUD
├── repository.ts            # 数据访问 (PostgreSQL Repository)
├── types.ts                 # 类型定义
├── validator.ts             # 验证器
├── topology/
│   ├── service.ts           # 拓扑生成
│   ├── impact.ts            # 影响分析
│   └── graph.ts             # 图算法
├── relation/
│   ├── service.ts           # 关系管理
│   └── repository.ts        # 关系数据访问
├── k8s/
│   ├── watcher.ts           # K8s Watch
│   └── reconciler.ts        # 定时对账
├── audit/
│   └── logger.ts            # 审计日志
└── sync/
    └── ops.ts               # 与 Ops 服务同步
```

#### orion-ops-service (TypeScript + Fastify)

```
orion-platform-service/src/services/ops/
├── index.ts                 # 入口
├── terminal/
│   ├── ssh.ts               # SSH 连接
│   ├── rdp.ts               # RDP 连接
│   ├── vnc.ts               # VNC 连接
│   └── session.ts           # 会话管理
├── executor/
│   ├── batch.ts             # 批量执行
│   ├── result.ts            # 执行结果
│   └── collector.ts         # 结果收集
├── sftp/
│   ├── server.ts            # SFTP 服务
│   └── client.ts            # SFTP 客户端
├── scheduler/
│   ├── cron.ts              # Cron 调度
│   └── job.ts               # 任务定义
├── monitor/
│   ├── collector.ts         # 指标采集
│   ├── storage.ts           # 时序存储
│   └── alert.ts             # 告警
└── cmdb/
    └── client.ts            # CMDB 客户端（服务间调用）
```

### 2.3 插件化架构

#### 2.3.1 插件系统设计理念

**复用现有 Orion 插件系统设计**，扩展为统一插件平台：

| 现有能力 | 扩展内容 |
|----------|---------|
| PluginRegistry | + CMDB/Ops 插件注册 |
| PluginLifecycleManager | + 专属生命周期钩子 |
| PluginSandbox | + 网络权限（SSH/SFTP） |
| PluginCapability | + CMDB_OPS 能力枚举 |

#### 2.3.2 插件接口定义

```typescript
// src/services/cmdb/plugin/interface.ts

// PluginCapability 插件能力枚举
type PluginCapability =
  | 'CMDB_PROVIDER'
  | 'CI_TYPE'
  | 'TOPOLOGY'
  | 'IMPACT_ANALYSIS'
  | 'TERMINAL'
  | 'BATCH_EXECUTOR'
  | 'FILE_TRANSFER'
  | 'SCHEDULER'
  | 'MONITOR';

// Plugin 插件接口
interface Plugin {
    // Manifest 返回插件元信息
    manifest(): PluginManifest;

    // Initialize 初始化插件
    initialize(config: Record<string, unknown>): Promise<void>;

    // Start 启动插件
    start(): Promise<void>;

    // Stop 停止插件
    stop(): Promise<void>;

    // GetCapabilities 返回插件能力
    getCapabilities(): PluginCapability[];
}

// CMDBPlugin CMDB 插件接口
interface CMDBPlugin extends Plugin {
    // GetCITypes 返回支持的 CI 类型
    getCITypes(): CiType[];

    // OnCICreated CI 创建回调
    onCICreated(ci: CI): Promise<void>;

    // OnCIUpdated CI 更新回调
    onCIUpdated(oldCI: CI, newCI: CI): Promise<void>;

    // OnCIDeleted CI 删除回调
    OnCIDeleted(ctx context.Context, ci *CI) error
}

// OpsPlugin 运维操作插件接口
type OpsPlugin interface {
    Plugin

    // GetConnectionTypes 返回支持的连接类型
    GetConnectionTypes() []ConnectionType

    // OnExecutionResult 执行结果回调
    OnExecutionResult(ctx context.Context, result *ExecutionResult) error

    // ValidatePermission 权限验证
    ValidatePermission(ctx context.Context, userID, resource string) error
}
```

#### 2.3.3 插件生命周期

```
              ┌─────────────┐
              │  REGISTERED │
              └──────┬──────┘
                     │ enable
                     ▼
              ┌─────────────┐
         ┌───▶│   ENABLED   │◀───┐
         │    └──────┬──────┘    │
         │           │           │
         │    disable│     disable
         │           ▼           │
         │    ┌─────────────┐    │
         │    │  DISABLED   │────┘
         │    └─────────────┘
         │           │
         │    uninstall
         │           ▼
    ┌────┴─────────────┐
    │   UNINSTALLED    │
    └──────────────────┘
```

---

## 三、数据模型

### 3.1 CMDB 核心表

```sql
-- 配置项表
CREATE TABLE cmdb_ci (
    id              UUID PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    ci_id           VARCHAR(255) NOT NULL,
    ci_type         VARCHAR(50) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    status          VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    environment     VARCHAR(50),
    tags            JSONB DEFAULT '[]',
    attributes      JSONB DEFAULT '{}',
    version         INT NOT NULL DEFAULT 1,
    created_by      VARCHAR(255),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMP,
    UNIQUE(tenant_id, ci_id)
);

-- 关系表
CREATE TABLE cmdb_relation (
    id              UUID PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    from_ci_id      VARCHAR(255) NOT NULL,
    to_ci_id        VARCHAR(255) NOT NULL,
    relation_type   VARCHAR(50) NOT NULL,
    description     TEXT,
    created_by      VARCHAR(255),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMP,
    UNIQUE(tenant_id, from_ci_id, to_ci_id, relation_type)
);

-- 版本表
CREATE TABLE cmdb_ci_version (
    id              UUID PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    ci_id           VARCHAR(255) NOT NULL,
    version         INT NOT NULL,
    changes         TEXT,
    data            JSONB NOT NULL,
    created_by      VARCHAR(255),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(ci_id, version)
);

-- 主机扩展表（关联运维）
CREATE TABLE cmdb_host (
    id              UUID PRIMARY KEY,
    ci_id           VARCHAR(255) NOT NULL REFERENCES cmdb_ci(ci_id),
    tenant_id       VARCHAR(64) NOT NULL,
    ip_address      VARCHAR(50) NOT NULL,
    ssh_port        INT DEFAULT 22,
    ssh_user        VARCHAR(100),
    ssh_key_id      UUID,
    os_type         VARCHAR(50),
    os_version      VARCHAR(100),
    cpu_cores       INT,
    memory_mb       INT,
    disk_gb         INT,
    status          VARCHAR(50) NOT NULL DEFAULT 'OFFLINE',
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 3.2 运维操作核心表

```sql
-- 终端会话表
CREATE TABLE ops_session (
    id              UUID PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    user_id         VARCHAR(255) NOT NULL,
    host_id         UUID NOT NULL,
    session_type    VARCHAR(20) NOT NULL, -- SSH, RDP, VNC
    status          VARCHAR(20) NOT NULL, -- CONNECTING, ACTIVE, CLOSED
    started_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    closed_at       TIMESTAMP,
    metadata        JSONB DEFAULT '{}'
);

-- 执行任务表
CREATE TABLE ops_task (
    id              UUID PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    command         TEXT NOT NULL,
    target_hosts    JSONB NOT NULL,
    status          VARCHAR(20) NOT NULL, -- PENDING, RUNNING, SUCCESS, FAILED
    created_by      VARCHAR(255),
    started_at      TIMESTAMP,
    finished_at     TIMESTAMP,
    result          JSONB,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 执行结果表
CREATE TABLE ops_task_result (
    id              UUID PRIMARY KEY,
    task_id         UUID NOT NULL REFERENCES ops_task(id),
    host_id         UUID NOT NULL,
    exit_code       INT,
    stdout          TEXT,
    stderr          TEXT,
    executed_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 计划任务表
CREATE TABLE ops_cron_job (
    id              UUID PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    command         TEXT NOT NULL,
    cron_expr       VARCHAR(100) NOT NULL,
    target_hosts    JSONB NOT NULL,
    enabled         BOOLEAN DEFAULT true,
    last_run_at     TIMESTAMP,
    next_run_at     TIMESTAMP,
    created_by      VARCHAR(255),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

## 四、服务间通信

### 4.1 服务间通信接口（Fastify 内部路由）

#### CMDB Service (内部 API)

```typescript
// src/services/cmdb/types.ts — 内部 API 接口定义

// CMDB 服务接口
interface CMDBService {
    createCI(request: CreateCIRequest): Promise<CI>;
    getCI(request: GetCIRequest): Promise<CI>;
    updateCI(request: UpdateCIRequest): Promise<CI>;
    deleteCI(request: DeleteCIRequest): Promise<void>;
    listCIs(request: ListCIsRequest): Promise<ListCIsResponse>;

    // 关系管理
    createRelation(request: CreateRelationRequest): Promise<Relation>;
    deleteRelation(request: DeleteRelationRequest): Promise<void>;
    getRelations(request: GetRelationsRequest): Promise<ListRelationsResponse>;

    // 拓扑与影响分析
    getTopology(request: GetTopologyRequest): Promise<Topology>;
    analyzeImpact(request: AnalyzeImpactRequest): Promise<ImpactAnalysis>;

    // 主机同步
    syncHosts(request: SyncHostsRequest): Promise<SyncHostsResponse>;
}

// Ops 服务接口
interface OpsService {
    // 终端管理
    createSession(request: CreateSessionRequest): Promise<Session>;
    getSession(request: GetSessionRequest): Promise<Session>;
    closeSession(request: CloseSessionRequest): Promise<void>;

    // 批量执行
    executeBatch(request: ExecuteBatchRequest): Promise<Task>;
    getTask(request: GetTaskRequest): Promise<Task>;
    getTaskResults(request: GetTaskResultsRequest): Promise<ListTaskResultsResponse>;

    // 文件传输
    uploadFile(request: UploadFileRequest): Promise<UploadResponse>;
    downloadFile(request: DownloadFileRequest): Promise<ReadableStream>;

    // 计划任务
    createCronJob(request: CreateCronJobRequest): Promise<CronJob>;
    updateCronJob(request: UpdateCronJobRequest): Promise<CronJob>;
    deleteCronJob(request: DeleteCronJobRequest): Promise<void>;
    listCronJobs(request: ListCronJobsRequest): Promise<ListCronJobsResponse>;
}
```

### 4.2 数据同步策略

| 同步场景 | 方向 | 策略 | 触发时机 |
|----------|------|------|----------|
| 主机列表 | CMDB → Ops | 定时同步 + 事件触发 | 每 5 分钟 + CI 变更时 |
| 执行状态 | Ops → CMDB | 事件驱动 | 执行完成时 |
| 依赖关系 | CMDB → Ops | 定时同步 | 每 10 分钟 |
| 影响分析请求 | Ops → CMDB | 实时 API 调用 | 批量执行前 |

---

## 四.5 与平台基础设施集成

### 4.5.1 权限控制

- **RBAC 中间件**：复用 `orion-platform-service` 的 `authenticateUser` 和 `requirePermission` 中间件
- **Capability 检查**：高危操作（如批量删除、敏感命令执行）使用 `requireCapability` 中间件进行二次校验
- **能力域映射**：
  - CMDB 删除操作 → `infrastructure_operations` 能力域
  - Ops 批量执行 → `script_operations` 能力域
  - 计划任务修改 → `cron_operations` 能力域

### 4.5.2 审批流程

- 高危 CMDB 操作（如删除核心 CI）接入 `ApprovalFlowEngine`（V3 系统级通用审批流程引擎）
- Ops 批量执行生产环境命令时触发审批流
- 复用现有 `MultiLevelApprovalService` 实现串行/并行审批

### 4.5.3 租户隔离

- 所有数据库表使用 `tenant_id VARCHAR(64)`，与平台 `ApprovalEntity.tenantId` 类型一致
- 查询时通过中间件自动注入 `tenantId` 过滤条件
- Repository 层统一使用 `RepositoryFactory` 获取数据访问实例

---

## 五、API 设计

### 5.1 CMDB API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/cmdb/cis | 创建 CI |
| GET | /api/v1/cmdb/cis | 列表查询 |
| GET | /api/v1/cmdb/cis/:id | 获取详情 |
| PUT | /api/v1/cmdb/cis/:id | 更新 CI |
| DELETE | /api/v1/cmdb/cis/:id | 删除 CI |
| GET | /api/v1/cmdb/cis/:id/relations | 获取关联关系 |
| GET | /api/v1/cmdb/cis/:id/versions | 获取版本历史 |
| GET | /api/v1/cmdb/topology | 获取拓扑图 |
| GET | /api/v1/cmdb/impact/:id | 影响分析 |
| POST | /api/v1/cmdb/sync/hosts | 同步主机到 Ops |

### 5.2 Ops API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/ops/sessions | 创建终端会话 |
| GET | /api/v1/ops/sessions/:id | 获取会话状态 |
| DELETE | /api/v1/ops/sessions/:id | 关闭会话 |
| POST | /api/v1/ops/tasks | 创建执行任务 |
| GET | /api/v1/ops/tasks/:id | 获取任务状态 |
| GET | /api/v1/ops/tasks/:id/results | 获取执行结果 |
| POST | /api/v1/ops/files/upload | 文件上传 |
| POST | /api/v1/ops/files/download | 文件下载 |
| POST | /api/v1/ops/cron | 创建计划任务 |
| GET | /api/v1/ops/cron | 列表计划任务 |
| PUT | /api/v1/ops/cron/:id | 更新计划任务 |
| DELETE | /api/v1/ops/cron/:id | 删除计划任务 |

### 5.3 统一网关路由

```yaml
# API Gateway 路由配置
routes:
  - path: /api/v1/cmdb/*
    upstream: orion-cmdb-service:8081
    auth: required

  - path: /api/v1/ops/*
    upstream: orion-ops-service:8082
    auth: required

  - path: /api/v1/plugins/*
    upstream: orion-cmdb-service:8081
    auth: required
```

---

## 六、安全设计

### 6.1 认证与授权

| 层级 | 机制 |
|------|------|
| 认证 | JWT + SSO (Keycloak) |
| 授权 | RBAC + ABAC (复用现有) |
| 审计 | 完整操作日志 |

### 6.2 网络权限控制

```go
// 插件沙箱网络权限配置
type NetworkPolicy struct {
    AllowedHosts    []string  // 允许访问的主机
    AllowedPorts    []int     // 允许访问的端口
    AllowedProtocols []string // 允许的协议 (tcp, udp)
    RateLimit       int       // 速率限制 (请求/秒)
}
```

### 6.3 敏感操作审批

| 操作类型 | 审批要求 |
|----------|----------|
| 生产环境批量执行 | 需要审批 |
| 删除核心 CI | 需要审批 |
| 修改关系 | 记录日志 |
| 敏感命令执行 | 需要审批 |

---

## 七、实施计划

### 7.1 阶段划分

| 阶段 | 工作内容 | 工期 | 产出 |
|------|----------|------|------|
| **Phase 1** | 基础框架搭建 | 1 周 | TS 项目结构、路由注册 |
| **Phase 2** | CMDB 增强 | 2 周 | 影响分析/变更审批 API |
| **Phase 3** | 运维操作 | 3 周 | Terminal/Executor/Scheduler |
| **Phase 4** | 插件化改造 | 2 周 | 统一插件接口 |
| **Phase 5** | 数据串联 | 1 周 | CMDB ↔ Ops 同步 |
| **Phase 6** | 前端集成 | 2 周 | 统一前端页面 |
| **Phase 7** | 测试与优化 | 1 周 | 完整测试报告 |

**总工期**：约 12 周

### 7.2 里程碑

```
Month 1: Phase 1 + Phase 2 (基础框架 + CMDB 增强)
Month 2: Phase 2 (完成) + Phase 3 (运维操作)
Month 3: Phase 3 (完成) + Phase 4 (插件化) + Phase 5 (串联)
Month 4: Phase 6 (前端集成) + Phase 7 (测试)
```

### 7.3 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| orion-visor 逻辑提取 | 中 | 中 | 逐模块分析，核心逻辑 TS 重写 |
| 服务间通信延迟 | 低 | 中 | 本地缓存 + 异步处理 |
| 数据同步一致性 | 中 | 高 | 事件驱动 + 定时对账 |

---

## 八、附录

### 8.1 技术选型

| 组件 | 技术 | 版本 |
|------|------|------|
| Web 框架 | Fastify | v4+ |
| 语言 | TypeScript | v5+ |
| ORM | Knex + 自定义 Repository | — |
| 配置 | dotenv + convict | — |
| 日志 | pino | v8+ |
| 测试 | Jest | v29+ |
| SSH 连接 | ssh2 | v1.14+ |
| Cron 调度 | node-cron | v3+ |

### 8.2 参考资料

- [orion-visor 源码](https://github.com/dromara/orion-visor)
- [Orion 现有插件系统](./plugin-spi/)
- [CMDB 模块设计](../services/cmdb/CMDB模块设计.md)

---

_文档版本：v1.0_
_创建日期：2026-05-19_