# CMDB + 运维操作统一 Go 实现方案

> 版本：v2.0（Go 统一实现）
> 日期：2026-05-19
> 状态：待评审

---

## 一、背景与目标

### 1.1 现状分析

**现有实现**：

| 系统 | 技术栈 | 代码位置 | 状态 |
|------|--------|---------|------|
| CMDB 核心 (Go) | Go + Gin + GORM | `.worktrees/cmdb-ops/orion-cmdb-service/` | ✅ 已完整实现 |
| CMDB 核心 (TS) | TypeScript + Fastify | `orion-platform-service/src/services/cmdb/` | 🔄 待废弃 |
| 运维操作 (Java) | Java + Spring Boot | `orion-visor/` | ✅ 代码完整，待提取为 Go |
| CMDB 集成服务 (TS) | TypeScript | `orion-platform-service/src/services/cmdb-integration-service.ts` | 🔄 待迁移 |

> **决策**：CMDB 及运维操作后端功能**全部使用 Go 实现**，统一技术栈。
> - 复用现有 `.worktrees/cmdb-ops/orion-cmdb-service/` 代码
> - 从 `orion-visor/` 提取 Java 逻辑，重写为 Go
> - 移除 TS 版本实现

### 1.2 待解决问题

1. **技术栈统一**：TS + Java + Go 混乱，需统一为 Go
2. **运维操作缺失**：终端/批量执行无 Go 实现
3. **数据未串联**：CMDB 主机列表 ↔ Ops 远程访问
4. **审批流程缺失**：高危操作需接入 ApprovalFlowEngine
5. **插件化治理**：缺乏统一插件系统

### 1.3 设计目标

1. **技术栈统一** — 全部使用 Go + Gin + GORM
2. **运维操作 Go 化** — 从 orion-visor (Java) 提取逻辑，重写为 Go
3. **数据串联** — CMDB 主机列表 → Ops 远程访问双向同步
4. **审批接入** — 高危操作接入 ApprovalFlowEngine
5. **插件化架构** — 支持扩展能力

### 1.4 范围

| 模块 | 功能 | 现状 | 工作内容 |
|------|------|------|---------|
| CMDB 核心 | CI 配置项、关系管理、拓扑、版本 | ✅ Go 已实现 | 无需修改 |
| CMDB 增强 | 影响分析、变更审批 + 审批接入 | 🔄 待增强 | 接入 ApprovalFlowEngine |
| 远程终端 | SSH/RDP/VNC 连接 | Java 已实现 | 提取为 Go 实现 |
| 批量执行 | 命令分发、文件传输 | Java 已实现 | 提取为 Go 实现 |
| 计划任务 | Cron 定时任务 | 🔄 待实现 | Go 新增 |
| 系统监控 | CPU/内存/磁盘监控 | Java 已实现 | 提取为 Go 实现 |

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
        │   CMDB Service    │  │  Ops Service │  │ Other Go    │
        │   (Go 微服务)     │  │  (Go 微服务)  │  │ Services    │
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

#### orion-cmdb-service (Go)

```
orion-cmdb-service/
├── cmd/cmdbd/
│   └── main.go              # 入口
├── internal/
│   ├── cmdb/
│   │   ├── service.go       # CI CRUD
│   │   ├── repository.go    # 数据访问
│   │   ├── types.go         # 类型定义
│   │   └── validator.go    # 验证器
│   ├── topology/
│   │   ├── service.go       # 拓扑生成
│   │   ├── impact.go        # 影响分析
│   │   └── graph.go         # 图算法
│   ├── relation/
│   │   ├── service.go       # 关系管理
│   │   └── repository.go    # 关系数据访问
│   ├── k8s/
│   │   ├── watcher.go       # K8s Watch
│   │   └── reconciler.go    # 定时对账
│   ├── audit/
│   │   └── logger.go        # 审计日志
│   ├── sync/
│   │   └── ops.go           # 与 Ops 服务同步
│   └── plugin/
│       ├── interface.go     # 插件接口
│       └── registry.go      # 插件注册
├── api/
│   ├── rest/                # HTTP 适配
│   └── grpc/                # gRPC 接口
└── pkg/
    └── utils/               # 工具函数
```

#### orion-ops-service (Go)

```
orion-ops-service/
├── cmd/opsd/
│   └── main.go
├── internal/
│   ├── terminal/
│   │   ├── ssh.go           # SSH 连接
│   │   ├── rdp.go           # RDP 连接
│   │   ├── vnc.go           # VNC 连接
│   │   └── session.go       # 会话管理
│   ├── executor/
│   │   ├── batch.go         # 批量执行
│   │   ├── result.go        # 执行结果
│   │   └── collector.go     # 结果收集
│   ├── sftp/
│   │   ├── server.go        # SFTP 服务端
│   │   └── client.go        # SFTP 客户端
│   ├── scheduler/
│   │   ├── cron.go          # Cron 调度
│   │   └── job.go           # 任务定义
│   ├── monitor/
│   │   ├── collector.go     # 指标采集
│   │   ├── storage.go       # 时序存储
│   │   └── alert.go         # 告警
│   └── cmdb/
│       └── client.go        # CMDB 客户端
├── api/
│   ├── rest/
│   └── grpc/
└── pkg/
    └── plugin/
        ├── interface.go
        └── registry.go
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

```go
// pkg/plugin/interface.go

// PluginCapability 插件能力枚举
type PluginCapability string

const (
    // CMDB 相关
    CapabilityCMDBProvider  PluginCapability = "CMDB_PROVIDER"
    CapabilityCIType        PluginCapability = "CI_TYPE"
    CapabilityTopology      PluginCapability = "TOPOLOGY"
    CapabilityImpactAnalysis PluginCapability = "IMPACT_ANALYSIS"

    // 运维操作相关
    CapabilityTerminal      PluginCapability = "TERMINAL"
    CapabilityBatchExecutor PluginCapability = "BATCH_EXECUTOR"
    CapabilityFileTransfer  PluginCapability = "FILE_TRANSFER"
    CapabilityScheduler     PluginCapability = "SCHEDULER"
    CapabilityMonitor       PluginCapability = "MONITOR"
)

// Plugin 插件接口
type Plugin interface {
    // Manifest 返回插件元信息
    Manifest() *PluginManifest

    // Initialize 初始化插件
    Initialize(ctx context.Context, config map[string]interface{}) error

    // Start 启动插件
    Start(ctx context.Context) error

    // Stop 停止插件
    Stop(ctx context.Context) error

    // GetCapabilities 返回插件能力
    GetCapabilities() []PluginCapability
}

// CMDBPlugin CMDB 插件接口
type CMDBPlugin interface {
    Plugin

    // GetCITypes 返回支持的 CI 类型
    GetCITypes() []CiType

    // OnCICreated CI 创建回调
    OnCICreated(ctx context.Context, ci *CI) error

    // OnCIUpdated CI 更新回调
    OnCIUpdated(ctx context.Context, oldCI, newCI *CI) error
}
```

---

## 三、数据库设计

### 3.1 CMDB 核心表

```sql
-- 配置项表
CREATE TABLE cmdb_ci (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64) NOT NULL,
    ci_type         VARCHAR(100) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    attributes      JSONB NOT NULL DEFAULT '{}',
    version         INT NOT NULL DEFAULT 1,
    created_by      VARCHAR(255),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMP,
    UNIQUE(tenant_id, ci_type, name)
);

CREATE INDEX idx_cmdb_ci_type ON cmdb_ci(ci_type, tenant_id);
CREATE INDEX idx_cmdb_ci_attributes ON cmdb_ci USING GIN(attributes);

-- 关系表
CREATE TABLE cmdb_relation (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64) NOT NULL,
    source_ci_id    UUID NOT NULL REFERENCES cmdb_ci(id),
    target_ci_id    UUID NOT NULL REFERENCES cmdb_ci(id),
    relation_type   VARCHAR(100) NOT NULL,
    attributes      JSONB DEFAULT '{}',
    created_by      VARCHAR(255),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, source_ci_id, target_ci_id, relation_type)
);

CREATE INDEX idx_cmdb_relation_source ON cmdb_relation(source_ci_id);
CREATE INDEX idx_cmdb_relation_target ON cmdb_relation(target_ci_id);

-- 拓扑快照表
CREATE TABLE cmdb_topology_snapshot (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64) NOT NULL,
    snapshot_data   JSONB NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cmdb_topology_snapshot_tenant ON cmdb_topology_snapshot(tenant_id, created_at DESC);
```

### 3.2 Ops 表

```sql
-- 终端会话表
CREATE TABLE ops_session (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64) NOT NULL,
    user_id         VARCHAR(255) NOT NULL,
    host_id         UUID REFERENCES cmdb_ci(id),
    protocol        VARCHAR(20) NOT NULL,  -- ssh/rdp/vnc
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    closed_at       TIMESTAMP
);

-- 执行任务表
CREATE TABLE ops_task (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64) NOT NULL,
    user_id         VARCHAR(255) NOT NULL,
    command         TEXT NOT NULL,
    target_hosts    JSONB NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    result          JSONB,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMP
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

### 4.1 gRPC 接口定义

#### CMDB Service

```protobuf
// api/cmdb/v1/cmdb.proto

syntax = "proto3";

package cmdb.v1;

service CMDBService {
    // CI 管理
    rpc CreateCI(CreateCIRequest) returns (CI);
    rpc GetCI(GetCIRequest) returns (CI);
    rpc UpdateCI(UpdateCIRequest) returns (CI);
    rpc DeleteCI(DeleteCIRequest) returns (Empty);
    rpc ListCIs(ListCIsRequest) returns (ListCIsResponse);

    // 关系管理
    rpc CreateRelation(CreateRelationRequest) returns (Relation);
    rpc DeleteRelation(DeleteRelationRequest) returns (Empty);
    rpc GetRelations(GetRelationsRequest) returns (ListRelationsResponse);

    // 拓扑与影响分析
    rpc GetTopology(GetTopologyRequest) returns (Topology);
    rpc AnalyzeImpact(AnalyzeImpactRequest) returns (ImpactAnalysis);

    // 主机同步
    rpc SyncHosts(SyncHostsRequest) returns (SyncHostsResponse);
}
```

#### Ops Service

```protobuf
// api/ops/v1/ops.proto

syntax = "proto3";

package ops.v1;

service OpsService {
    // 终端管理
    rpc CreateSession(CreateSessionRequest) returns (Session);
    rpc GetSession(GetSessionRequest) returns (Session);
    rpc CloseSession(CloseSessionRequest) returns (Empty);

    // 批量执行
    rpc ExecuteBatch(ExecuteBatchRequest) returns (Task);
    rpc GetTask(GetTaskRequest) returns (Task);
    rpc GetTaskResults(GetTaskResultsRequest) returns (ListTaskResultsResponse);

    // 文件传输
    rpc UploadFile(UploadFileRequest) returns (UploadResponse);
    rpc DownloadFile(DownloadFileRequest) returns (stream Chunk);

    // 计划任务
    rpc CreateCronJob(CreateCronJobRequest) returns (CronJob);
    rpc UpdateCronJob(UpdateCronJobRequest) returns (CronJob);
    rpc DeleteCronJob(DeleteCronJobRequest) returns (Empty);
    rpc ListCronJobs(ListCronJobsRequest) returns (ListCronJobsResponse);
}
```

### 4.2 数据同步策略

| 同步场景 | 方向 | 策略 | 触发时机 |
|----------|------|------|----------|
| 主机列表 | CMDB → Ops | 定时同步 + 事件触发 | 每 5 分钟 + CI 变更时 |
| 执行状态 | Ops → CMDB | 事件驱动 | 执行完成时 |
| 依赖关系 | CMDB → Ops | 定时同步 | 每 10 分钟 |
| 影响分析请求 | Ops → CMDB | 实时 gRPC 调用 | 批量执行前 |

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
| POST | /api/v1/ops/cron | 创建计划任务 |
| PUT | /api/v1/ops/cron/:id | 更新计划任务 |
| DELETE | /api/v1/ops/cron/:id | 删除计划任务 |
| GET | /api/v1/ops/cron | 计划任务列表 |

---

## 六、与平台基础设施集成

### 6.1 权限控制

- **RBAC 中间件**：复用 API Gateway 的 `authMiddleware`
- **Capability 检查**：高危操作使用 `requireCapability` 进行二次校验
- **能力域映射**：
  - CMDB 删除操作 → `infrastructure_operations` 能力域
  - Ops 批量执行 → `script_operations` 能力域
  - 计划任务修改 → `cron_operations` 能力域

### 6.2 审批流程

- 高危 CMDB 操作（如删除核心 CI）通过 gRPC 调用 `ApprovalFlowEngine`
- Ops 批量执行生产环境命令时触发审批流
- 复用平台 `MultiLevelApprovalService` 实现串行/并行审批

### 6.3 租户隔离

- 所有数据库表使用 `tenant_id VARCHAR(64)`
- gRPC 元数据传递 tenant_id
- Repository 层按 tenant_id 过滤

### 6.4 日志与审计

- 使用 `zap` 日志库，结构化日志输出
- 所有敏感操作记录审计日志到 `audit_logs` 表
- 日志推送到 ELK/Grafana Loki

---

## 七、实施计划

### 7.1 阶段划分

| 阶段 | 工作内容 | 工期 | 产出 |
|------|----------|------|------|
| **Phase 1** | 基础框架完善 | 1 周 | 完善 Go CMDB 项目结构、依赖 |
| **Phase 2** | CMDB 增强 | 2 周 | 影响分析/变更审批 + 审批接入 |
| **Phase 3** | Ops 终端 | 3 周 | SSH/RDP/VNC 终端实现 |
| **Phase 4** | Ops 批量执行 | 2 周 | 命令分发、结果收集 |
| **Phase 5** | 计划任务 | 1 周 | Cron 调度实现 |
| **Phase 6** | 系统监控 | 2 周 | 指标采集、存储、告警 |
| **Phase 7** | 数据串联 | 1 周 | CMDB ↔ Ops 同步 |
| **Phase 8** | 测试与优化 | 1 周 | 完整测试报告 |

**总工期**：约 13 周

### 7.2 里程碑

```
Month 1: Phase 1 + Phase 2 (基础框架 + CMDB 增强)
Month 2: Phase 3 (终端) + Phase 4 (批量执行)
Month 3: Phase 5 (计划任务) + Phase 6 (监控) + Phase 7 (串联)
Month 4: Phase 8 (测试) + 上线
```

### 7.3 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| orion-visor Java 逻辑提取 | 中 | 中 | 逐模块分析，核心逻辑 Go 重写 |
| 服务间通信延迟 | 低 | 中 | 本地缓存 + 异步处理 |
| 数据同步一致性 | 中 | 高 | 事件驱动 + 定时对账 |

---

## 八、附录

### 8.1 技术选型

| 组件 | 技术 | 版本 |
|------|------|------|
| Web 框架 | Gin | v1.9+ |
| gRPC | grpc-go | v1.60+ |
| ORM | GORM | v1.25+ |
| 配置 | Viper | v1.18+ |
| 日志 | Zap | v1.24+ |
| CLI | Cobra | v1.7+ |
| 测试 | testify | v1.9+ |
| SSH 连接 | golang.org/x/crypto/ssh | v0.17+ |

### 8.2 参考资料

- [orion-cmdb-service 源码](.worktrees/cmdb-ops/orion-cmdb-service/)
- [orion-visor 源码](https://github.com/dromara/orion-visor)
- [Orion 现有插件系统](./plugin-spi/)
- [CMDB 模块设计](../services/cmdb/CMDB模块设计.md)

---

_文档版本：v2.0_
_创建日期：2026-05-19_
_技术栈：Go + Gin + GORM + gRPC_