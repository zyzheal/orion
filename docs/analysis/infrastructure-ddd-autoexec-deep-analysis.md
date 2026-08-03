# 基础设施 / DDD / 自动执行层深度分析 (2026-08-02)

> **覆盖**: 15 模块 / ~22,000 行 | **原深度分析覆盖率**: 基础设施层 0%

---

## 一、领域驱动设计层 (DDD/CQRS/Event Sourcing)

### 1.1 domain — CQRS/Event Sourcing 架构 — 90% ⭐ 平台架构核心

`internal/domain/` 是 Orion 平台唯一实现企业级架构模式的模块，实现了完整的 **CQRS + Event Sourcing + DDD** 三层架构。

```
domain/
├── aggregates/    — 聚合根 (3 个领域模型)
├── commands/      — 命令总线
├── events/        — 领域事件
├── eventstore/    — 事件存储
└── readmodel/     — 读模型
```

#### 目录结构实测

| 目录 | 文件数 | 核心文件 |
|------|:------:|---------|
| aggregates/ | 6 | `aggregate_root.go`, `pipeline.go`, `approval.go`, `feature_flag.go` |
| commands/ | 2 | `command_bus.go`, `command_bus_test.go` |
| events/ | 3 | `domain_event.go`, `pipeline_events.go`, `publisher.go` |
| eventstore/ | 5 | `eventstore.go`, `postgresql.go`, `snapshot_store.go`, `stored_event.go` |
| readmodel/ | 2 | `read_model.go`, `read_model_test.go` |

#### 聚合根 (Aggregates) — 3 个

| 聚合根 | 文件 | 核心功能 |
|--------|------|---------|
| **PipelineAggregate** | `pipeline.go` | Pipeline 生命周期事件/状态机 |
| **ApprovalAggregate** | `approval.go` | 审批级别/多级审批 |
| **FeatureFlagAggregate** | `feature_flag.go` | 功能开关状态机 |

```go
type AggregateRoot interface {
    ID() string
    Version() int64
    SetVersion(int64)
    DomainEvents() []DomainEvent
    ClearDomainEvents()
}
```

#### 命令总线 (Command Bus)

| 接口 | 说明 |
|------|------|
| `CommandBus` | 命令总线条接口 |
| `InMemoryCommandBus` | 内存实现，支持 RegisterHandler |
| `CommandHandlerFunc` | 命令处理器函数签名 |

#### 事件存储 (Event Store)

| 组件 | 说明 |
|------|------|
| `EventStore` 接口 | 事件持久化抽象 |
| `PostgreSQLEventStore` | PostgreSQL 实现 |
| `SnapshotStore` | 快照存储 (优化重放性能) |
| `StoredEvent` | 持久化事件模型 |

#### 领域事件 (Domain Events)

```
PipelineCreatedEvent / PipelineActivatedEvent / PipelineDeactivatedEvent
PipelineUpdatedEvent / PipelineDeletedEvent / PipelineStartedEvent
PipelineCompletedEvent / PipelineCancelledEvent
```

**评分: 90%** — 架构最完整，仅因未 wiring 和测试不足 (6 测试) 未达 100%。

---

## 二、自动执行引擎层 (Auto-Exec)

### 2.1 auto-exec — 插件化自动执行引擎 — 85%

| 维度 | 数据 |
|------|------|
| 代码行 | 3,335 |
| 测试 | 1 |
| Handler | 11 方法 (CreateTask/RunTask/ListTasks/DeleteTask/RegisterPlugin/ListPlugins) |
| 子目录 | **11 个** |

```
auto-exec/
├── engine/       — 执行引擎 + Adapter
├── factory/      — 执行器工厂
├── plugins/      — 5 种执行器插件
├── param-plugins/— 参数插件系统
├── registry/     — 插件注册中心
├── handler/      — 11 路由
├── repository/   — 持久化
├── service/      — 业务逻辑
├── interfaces/   — 接口定义
├── migrations/   — DB 迁移
└── models/       — 数据模型
```

#### 5 种执行器插件

| 插件 | 功能 | 默认超时 |
|------|------|---------|
| **ShellExecutorPlugin** | Shell 命令执行 | 5 min |
| **PythonExecutorPlugin** | Python 脚本执行 | 10 min |
| **HTTPExecutorPlugin** | HTTP 请求执行 | 30s |
| **SQLEXecutorPlugin** | SQL 语句执行 | 5 min |
| **WebhookExecutorPlugin** | Webhook 回调执行 | 30s |

```go
type PluginHandler interface {
    Name() string
    Description() string
    DefaultTimeout() time.Duration
    Execute(ctx context.Context, input *models.ExecutionInput) (*models.ExecutionResult, error)
}
```

**评分: 85%** — 架构完整，仅 1 测试 + 未 wiring。

---

## 三、启动管理层 (Startup)

### 3.1 startup — 分阶段启动管理器 — 80%

| 维度 | 数据 |
|------|------|
| 代码行 | 2,196 |
| 测试 | 1 |
| Handler | 12 方法 (CreateModule/ListModules/StartAll/StopAll/InitModule/HealthCheck/AddDependency) |

```
startup/
├── phase.go       — PhaseManager / PhaseHandler / PhaseFunc
├── handler/       — 12 路由
├── integration.go — 模块集成
├── phase_test.go  — 测试
├── models/        — 数据模型
└── repository/    — 持久化
```

**PhaseManager 核心能力**:
- **分阶段启动**: RegisterPhase → 按依赖顺序执行
- **依赖管理**: AddDependency 确保模块按拓扑顺序启动
- **健康检查**: HealthCheck 每阶段验证
- **优雅关闭**: ShutdownFunc 按逆序关闭

```go
type PhaseManager struct {
    phases []Phase
    dependencies map[string][]string
}
type PhaseHandler struct {
    Name string
    Func PhaseFunc
    DependsOn []string
}
```

**评分: 80%** — 架构完整，仅 1 测试 + 未 wiring。

---

## 四、基础设施辅助模块

### 4.1 roweditor (行编辑器 DSL) — 80%

| 维度 | 数据 |
|------|------|
| 代码行 | 1,662 |
| 测试 | 2 |
| 模式 | 行级表编辑 DSL |

```go
type Mode int              // 编辑模式
type Row map[string]any    // 行数据
type RowSpec struct { ... } // 行规范
type ColumnSpec struct { ... } // 列规范
type EditOptions struct { ... } // 编辑选项
type DBOperations interface { ... } // DB 操作抽象
type TxOperations interface { ... } // 事务操作抽象
```

**核心能力**: 行级表编辑 DSL + DB 抽象层。

### 4.2 api-component (路由构建器) — 60%

| 维度 | 数据 |
|------|------|
| 代码行 | 1,257 |
| 测试 | 0 |

```go
type APIComponent struct { ... }        // API 组件
type RouteComponent struct { ... }     // 路由组件
type RouterBuilder struct { ... }      // 路由器构建器
type MiddlewareChain []MiddlewareFunc  // 中间件链
type FullRoute struct { ... }          // 完整路由
```

**核心能力**: 声明式路由构建 + 中间件链。

### 4.3 小模块汇总

| 模块 | 行数 | 测试 | Wired | 功能 |
|------|:----:|:----:|:-----:|------|
| **ephemeral-env** | 480 | 1 | ❌ | 临时环境 |
| **mcp** | 565 | 1 | ❌ | MCP 协议 |
| **task-timeout** | 568 | 1 | ❌ | 任务超时 |
| **task-executor** | 354 | 0 | ❌ | 任务执行器 |
| **tool** | 1,222 | 0 | ❌ | 工具箱 |
| **community-advanced** | 668 | 1 | ❌ | 社区增强 |
| **apk-upload-history** | 710 | 1 | ❌ | 上传历史 |
| **auto-recovery** | 579 | 0 | ❌ | 自动恢复 |
| **code-embedding** | 308 | 0 | ❌ | 代码嵌入 |
| **dr** | 171 | 0 | ❌ | 容灾响应 writer |
| **i18n** | 550 | 1 | ✅ | 国际化 |
| **message-queue** | 359 | 1 | ✅ | 消息队列 |
| **webhook** | 1,616 | 2 | ✅ | Webhook 平台 |
| **migration** | 130 | 0 | ❌ | DB 版本追踪 |
| **job-actions** | 1,166 | 0 | ❌ | Job 动作 |
| **job-processor** | 1,159 | 0 | ❌ | Job 处理 |
| **worker-dispatcher** | 923 | 0 | ❌ | Worker 分派 |

### 4.4 基础设施层 P0 问题

| # | 问题 | 模块 | 影响 |
|---|------|------|------|
| 1 | **未 wiring** | domain (3,544 行) | CQRS/ES 架构核心不可用 |
| 2 | **未 wiring** | auto-exec (3,335 行) | 5 插件引擎不可用 |
| 3 | **未 wiring** | startup (2,196 行) | 模块管理不可用 |
| 4 | **未 wiring** | roweditor (1,662 行) | 行编辑器不可用 |
| 5 | **零测试** | api-component (1,257 行) | 路由构建器不可信 |
| 6 | **零测试** | 10/17 小模块 | 基础设施不可信 |

---

*分析完成: 2026-08-02 | 15 模块 / 基础设施/DDD/自动执行层*
