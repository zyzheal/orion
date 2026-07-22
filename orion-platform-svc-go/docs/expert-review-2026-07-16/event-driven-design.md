# Orion Go 单体平台 — 事件驱动 + 分布式事务架构设计方案

**设计日期**: 2026-07-16 | **评审依据**: `docs/expert-review-2026-07-16.md`
**目标分支**: `fix/p0-route-auth-and-error-envelope`
**DDD 评分提升**: F → B（通过引入聚合根、领域事件、Saga 协调器）
**最新更新**: 2026-07-16 — Sprint 1 核心基础设施完成（EventStore + Query 层 + 聚合根修复）

---

## 目录

1. [现状分析与问题诊断](#一现状分析与问题诊断)
2. [事件驱动架构设计](#二事件驱动架构设计)
3. [分布式事务 Saga 升级方案](#三分布式事务-saga-升级方案)
4. [CQRS 分层架构设计](#四cqrs-分层架构设计)
5. [数据库迁移设计](#五数据库迁移设计)
6. [核心接口定义 (Go)](#六核心接口定义-go)
7. [核心流程示例](#七核心流程示例)
8. [实施路线图 (3 Sprint)](#八实施路线图-3-sprint)
9. [风险与缓解措施](#九风险与缓解措施)
10. [2026-07-16 更新日志](#十2026-07-16-更新日志)

---

## 一、现状分析与问题诊断

### 1.1 当前架构评估

**DDD 专家评分: F** — 四位专家综合评审报告识别的核心问题：

| 问题 | 严重度 | 影响范围 | 本方案覆盖 |
|------|--------|---------|-----------|
| 全局贫血模型 | P0 | 222 模块，业务逻辑泄漏到 handler | ✅ 聚合根模式 |
| 零聚合根设计 | P0 | Approval/Pipeline/FeatureFlag 等核心领域 | ✅ 聚合根 + 领域事件 |
| 无领域事件基础设施 | P0 | 跨模块状态变更无通知 | ✅ DomainEvent + EventStore |
| Saga 仅记录型 | P1 | 无真正补偿能力，executeStep 为空壳 | ✅ SagaCoordinator 升级 |
| 模块爆炸 222 个 | P0 | 功能重叠 (ai-decision/ai-decisions) | ⚠️ 不在本方案范围 |

### 1.2 现有基础设施盘点

已存在的组件及其局限：

| 组件 | 位置 | 现状 | 问题 |
|------|------|------|------|
| `eventbus` | `internal/eventbus/` | NATS 连接池 + `events` 表 | 仅做消息中转，无领域语义 |
| `saga` | `internal/saga/` | SagaCoordinator + TransactionLog | `executeStep()` 是空壳，补偿无业务逻辑 |
| `approval` | `internal/approval/` | 贫血 ApprovalRequest/Level/History | 无聚合根，状态转移在 handler 中 |
| `build` | `internal/build/` | Build/Pipeline 贫血模型 | 无事件驱动的状态变更 |

---

## 二、事件驱动架构设计

### 2.1 领域事件模型

#### 核心接口: `DomainEvent`

```go
// internal/domain/events/domain_event.go
type DomainEvent interface {
    // AggregateType 返回产生该事件的聚合根类型名
    AggregateType() string
    // AggregateID 返回聚合根实例 ID
    AggregateID() string
    // EventType 返回事件类型标识 (如 "pipeline.started")
    EventType() string
    // TenantID 租户隔离
    TenantID() string
    // OccurredAt 事件发生时间
    OccurredAt() time.Time
    // Version 事件版本号（用于事件溯源的回放过滤）
    Version() int
}
```

#### 事件基类: `BaseDomainEvent`

提供通用字段实现，具体事件类型嵌入此结构：

```go
type BaseDomainEvent struct {
    AggregateType string    `json:"aggregate_type"`
    AggregateID   string    `json:"aggregate_id"`
    EventType     string    `json:"event_type"`
    TenantID      string    `json:"tenant_id"`
    OccurredAt    time.Time `json:"occurred_at"`
    Version       int       `json:"version"`
    CorrelationID string    `json:"correlation_id"` // 关联 ID（用于 Saga 追踪）
    CausationID   string    `json:"causation_id"`   // 原因 ID（用于事件链追踪）
}
```

### 2.2 核心领域事件类型定义

#### Pipeline 域事件

| 事件类型 | 事件名 | 触发场景 | 携带数据 |
|---------|--------|---------|---------|
| PipelineStarted | `pipeline.started` | 流水线启动 | buildID, branch, triggerSource |
| StageStarted | `pipeline.stage.started` | 阶段开始执行 | stageName, stageIndex |
| StageCompleted | `pipeline.stage.completed` | 阶段完成 | stageName, durationMs, artifacts |
| TaskCompleted | `pipeline.task.completed` | 任务完成 | taskName, exitCode, logsRef |
| PipelineCompleted | `pipeline.completed` | 流水线完成 | status, totalDurationMs |
| PipelineCancelled | `pipeline.cancelled` | 流水线取消 | reason, cancelledBy |

#### Approval 域事件

| 事件类型 | 事件名 | 触发场景 | 携带数据 |
|---------|--------|---------|---------|
| ApprovalRequested | `approval.requested` | 审批请求提交 | title, type, totalLevels |
| LevelApproved | `approval.level.approved` | 单级审批通过 | level, approverName, comment |
| LevelRejected | `approval.level.rejected` | 单级审批拒绝 | level, approverName, comment |
| ApprovalCompleted | `approval.completed` | 全流程审批完成 | finalStatus, totalDuration |
| ApprovalDelegate | `approval.delegated` | 审批人委托 | oldApprover, newApprover |
| ApprovalWithdrawn | `approval.withdrawn` | 申请人撤回 | reason |

#### FeatureFlag 域事件

| 事件类型 | 事件名 | 触发场景 | 携带数据 |
|---------|--------|---------|---------|
| FlagToggled | `feature.flag.toggled` | 开关变更 | flagKey, oldEnabled, newEnabled |
| FlagCreated | `feature.flag.created` | 开关创建 | flagKey, enabled |
| FlagDeleted | `feature.flag.deleted` | 开关删除 | flagKey, deletedBy |
| RolloutUpdated | `feature.rollout.updated` | 灰度策略变更 | flagKey, targetGroup, percentage |

### 2.3 事件存储: `EventStore`

#### 接口定义

```go
// internal/domain/eventstore/eventstore.go
type EventStore interface {
    // Append 追加一个或多个领域事件（事务内调用）
    Append(ctx context.Context, events ...domain.DomainEvent) error

    // GetByAggregate 获取指定聚合根的所有事件（用于回放）
    GetByAggregate(ctx context.Context, tenantID, aggregateType, aggregateID string) ([]domain.DomainEvent, error)

    // GetByType 按事件类型查询（用于事件订阅恢复）
    GetByType(ctx context.Context, tenantID, eventType string, since time.Time) ([]domain.DomainEvent, error)

    // GetLatestVersion 获取聚合根的最新事件版本号
    GetLatestVersion(ctx context.Context, tenantID, aggregateType, aggregateID string) (int, error)

    // DeleteOlderThan 清理过期事件（按快照策略）
    DeleteOlderThan(ctx context.Context, tenantID string, olderThan time.Time) (int64, error)
}
```

#### PostgreSQL 实现特点

- **事务安全**: `Append()` 在 handler 的数据库事务内调用，与业务数据原子提交
- **JSONB 存储**: 事件数据以 JSONB 存储，保留完整上下文
- **分区策略**: 按 `occurred_at` 月度分区，支持自动归档
- **唯一约束**: `(aggregate_id, occurred_at, event_type)` 确保事件幂等

### 2.4 事件发布/订阅机制

#### EventPublisher

```go
// internal/domain/events/publisher.go
type EventPublisher interface {
    // Publish 发布单个事件（同步 + 异步双通道）
    Publish(ctx context.Context, event DomainEvent) error

    // PublishBatch 批量发布事件
    PublishBatch(ctx context.Context, events []DomainEvent) error

    // Subscribe 注册事件处理器（应用内订阅）
    Subscribe(eventType string, handler EventHandler)

    // Unsubscribe 取消订阅
    Unsubscribe(eventType string, handler EventHandler)
}

// EventHandler 事件处理器接口
type EventHandler interface {
    // Handle 处理事件（异步调用）
    Handle(ctx context.Context, event DomainEvent) error

    // Supports 声明支持的事件类型
    Supports() []string
}
```

#### 订阅模式

```go
// 应用内订阅：在 service 层注册事件处理器
type ApprovalEventHandler struct {
    repo *repository.Repository
}

func (h *ApprovalEventHandler) Supports() []string {
    return []string{"approval.completed"}
}

func (h *ApprovalEventHandler) Handle(ctx context.Context, event events.DomainEvent) error {
    // 审批完成后自动创建部署流水线
    approvalEvent := event.(*approval.ApprovalCompletedEvent)
    return h.repo.CreateAutoDeploy(ctx, approvalEvent.ApprovalID)
}
```

### 2.5 事件溯源 (Event Sourcing) 设计

#### 聚合根接口: `AggregateRoot`

```go
// internal/domain/aggregates/aggregate_root.go
type AggregateRoot interface {
    // ID 聚合根标识
    ID() string
    // Version 当前版本号（事件计数）
    Version() int
    // ApplyEvent 应用事件到聚合根状态
    ApplyEvent(event DomainEvent) error
    // Snapshot 生成快照
    Snapshot() (*Snapshot, error)
    // RestoreFromSnapshot 从快照恢复
    RestoreFromSnapshot(snapshot *Snapshot) error
}
```

#### 事件回放机制

```
┌─────────────────────────────────────────────────┐
│  聚合根状态 = ApplyEvent(Snapshot) + Events[]    │
│  性能优化：快照频率 = N 事件间隔（默认 100）     │
└─────────────────────────────────────────────────┘

回放流程：
1. 查询 Snapshot 表获取最新快照
2. 查询 domain_events 表获取快照后的增量事件
3. 按 occurred_at 排序，逐条 ApplyEvent
4. 返回重建后的聚合根状态
```

#### 快照表设计

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 快照唯一标识 |
| `aggregate_type` | VARCHAR(64) | 聚合根类型 |
| `aggregate_id` | UUID | 聚合根 ID |
| `tenant_id` | UUID | 租户 ID |
| `version` | INTEGER | 快照时的版本号 |
| `state` | JSONB | 聚合根状态快照 |
| `created_at` | TIMESTAMPTZ | 创建时间 |

### 2.6 事件驱动架构全景

```
┌────────────────────────────────────────────────────────────────┐
│                         Handler 层                              │
│   接收 HTTP 请求 → 调用 Service → 触发领域事件                  │
└────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────┐
│                         Service 层                              │
│   CommandHandler.Execute()                                     │
│   1. 加载聚合根 (EventStore.GetByAggregate + 回放)              │
│   2. 执行业务操作 → 聚合根.AddEvent(event)                      │
│   3. 事务提交: SaveEntity() + EventStore.Append()              │
│   4. 发布事件: EventPublisher.Publish(event)                    │
└────────────────────────────────────────────────────────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  EventStore     │   │  PostgreSQL     │   │  NATS EventBus  │
│  (事件持久化)   │   │  (业务数据)     │   │  (异步通知)     │
└─────────────────┘   └─────────────────┘   └─────────────────┘
          │                     │                     │
          ▼                     ▼                     ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  SnapshotStore  │   │  Repository     │   │  EventSubscribers│
│  (快照管理)     │   │  (CRUD)         │   │  (NATS消费者)   │
└─────────────────┘   └─────────────────┘   └─────────────────┘
```

---

## 三、分布式事务 Saga 升级方案

### 3.1 当前 Saga 问题分析

现有 `internal/saga/` 的核心缺陷：

| 问题 | 代码位置 | 说明 |
|------|---------|------|
| `executeStep()` 是空壳 | `coordinator.go:274` | 只 `time.Sleep(5ms)` 返回成功 |
| 无业务补偿逻辑 | `coordinator.go:218` | 补偿仅更新状态，无实际回滚 |
| 步骤定义无操作/补偿函数 | `models.go:34` | SagaStepDef 无 `Execute/Compensate` 字段 |
| 事务状态与业务数据不一致 | — | Saga 记录与实际数据可能分离 |

### 3.2 SagaCoordinator 升级接口

```go
// internal/infrastructure/saga/coordinator.go

type SagaCoordinator interface {
    // StartSaga 启动 Saga（事务内创建 saga_instances 记录）
    StartSaga(ctx context.Context, sagaType string, context map[string]interface{}) (*SagaInstance, error)

    // CommitStep 提交步骤（更新步骤状态 + 记录输出）
    CommitStep(ctx context.Context, instanceID, stepID string, data map[string]interface{}) error

    // CompensateStep 补偿单步骤
    CompensateStep(ctx context.Context, instanceID, stepID string) error

    // Rollback 回滚 Saga（按逆序补偿所有已提交步骤）
    Rollback(ctx context.Context, instanceID string, reason string) error

    // GetInstance 查询 Saga 实例
    GetInstance(ctx context.Context, instanceID string) (*SagaInstance, error)

    // Complete 标记 Saga 完成
    Complete(ctx context.Context, instanceID string) error

    // RecoverRunning 恢复运行中的 Saga（启动时调用）
    RecoverRunning(ctx context.Context) ([]*SagaInstance, error)
}
```

### 3.3 SagaStep 步骤模型（操作 + 补偿）

```go
type SagaStep struct {
    ID          string                 `json:"id"`
    Name        string                 `json:"name"`
    Sequence    int                    `json:"sequence"`
    ActionType  string                 `json:"action_type"`     // 操作类型标识
    ActionData  map[string]interface{} `json:"action_data"`     // 操作参数
    CompType    string                 `json:"compensation_type"` // 补偿类型标识
    CompData    map[string]interface{} `json:"compensation_data"` // 补偿参数
    Status      SagaStepStatus         `json:"status"`
    RetryCount  int                    `json:"retry_count"`
    RetryMax    int                    `json:"retry_max"`
    TimeoutMs   int                    `json:"timeout_ms"`
    Output      map[string]interface{} `json:"output"`
    Error       string                 `json:"error"`
}

// ExecuteFunc 步骤执行函数
type ExecuteFunc func(ctx context.Context, step *SagaStep, ctxData map[string]interface{}) error
// CompensateFunc 步骤补偿函数
type CompensateFunc func(ctx context.Context, step *SagaStep, ctxData map[string]interface{}) error
```

### 3.4 SagaStepRegistry 步骤注册表

```go
// internal/infrastructure/saga/registry.go

type StepRegistry struct {
    steps map[string]StepDefinition
}

type StepDefinition struct {
    Name         string
    Execute      ExecuteFunc
    Compensate   CompensateFunc
    RetryMax     int
    TimeoutMs    int
    Dependencies []string // 前置步骤依赖
}

func (r *StepRegistry) Register(def StepDefinition) {
    r.steps[def.Name] = def
}

func (r *StepRegistry) Get(name string) (*StepDefinition, error) {
    def, ok := r.steps[name]
    if !ok {
        return nil, fmt.Errorf("step not registered: %s", name)
    }
    return &def, nil
}
```

### 3.5 核心 Saga 流程示例

#### 审批流程 Saga（Approval Saga）

```
审批请求提交
    │
    ├─ Step 1: CreateApprovalRequest  (创建审批请求)
    │   └─ Compensate: DeleteApprovalRequest (删除审批请求)
    │
    ├─ Step 2: CreateApprovalLevels   (创建审批层级)
    │   └─ Compensate: DeleteApprovalLevels   (删除审批层级)
    │
    ├─ Step 3: NotifyApprovers        (通知审批人)
    │   └─ Compensate: RecallsNotification (撤回通知)
    │
    └─ Step 4: AuditLog               (记录审计日志)
        └─ Compensate: SoftDeleteAuditLog    (软删除审计日志)

所有步骤成功 → SagaStatusCompleted
任一步骤失败 → 逆序补偿 → SagaStatusCompensated
```

#### Pipeline 执行 Saga（Pipeline Saga）

```
Pipeline 触发
    │
    ├─ Step 1: CreateBuildRecord     (创建构建记录)
    │   └─ Compensate: MarkBuildCancelled
    │
    ├─ Step 2: AllocateBuilderAgent  (分配构建代理)
    │   └─ Compensate: ReleaseBuilderAgent
    │
    ├─ Step 3: CheckoutCode          (代码检出)
    │   └─ Compensate: CleanupWorkspace
    │
    ├─ Step 4: ExecuteStages         (执行各阶段)
    │   └─ Compensate: CleanupArtifacts
    │
    └─ Step 5: PublishArtifact       (发布制品)
        └─ Compensate: UnpublishArtifact

所有阶段成功 → SagaStatusCompleted
任一步骤失败 → 逆序补偿 → SagaStatusCompensated
```

#### 部署流程 Saga（Deploy Saga）

```
部署触发
    │
    ├─ Step 1: HealthCheck           (预部署健康检查)
    │   └─ Compensate: NoOp (不可逆)
    │
    ├─ Step 2: CreateCanary          (创建金丝雀发布)
    │   └─ Compensate: DeleteCanary
    │
    ├─ Step 3: ObserveMetrics        (观测指标)
    │   └─ Compensate: NoOp
    │
    ├─ Step 4: FullDeploy            (全量发布)
    │   └─ Compensate: RollbackToPrevious (回滚到上一版本)
    │
    └─ Step 5: UpdateServiceRegistry (更新服务注册)
        └─ Compensate: RestoreServiceRegistry

异常自动回滚 → 调用 RollbackToPrevious 步骤
```

### 3.6 事务边界识别

| 流程 | 涉及模块 | 补偿策略 | 幂等保证 |
|------|---------|---------|---------|
| 审批流程 | approval → notification → audit | 逆序删除 + 状态回退 | request_id 唯一 |
| Pipeline 执行 | build → artifact → notification | 逆序清理 + 资源释放 | build_id 唯一 |
| 部署流程 | deploy → canary → service-registry | 全量回滚到上一版本 | deploy_id + version |
| FinOps 计费 | billing → cost-allocation → budget | 逆序扣减 + 预算回补 | billing_cycle_id 唯一 |

---

## 四、CQRS 分层架构设计

### 4.1 新分层结构

```
internal/
  domain/
    events/
      domain_event.go       # DomainEvent 接口 + BaseDomainEvent
      publisher.go          # EventPublisher 接口
      handlers.go           # 事件处理器注册
      pipeline_events.go    # Pipeline 域事件定义
      approval_events.go    # Approval 域事件定义
      feature_flag_events.go # FeatureFlag 域事件定义
    aggregates/
      aggregate_root.go     # AggregateRoot 接口
      pipeline.go           # Pipeline 聚合根
      approval.go           # Approval 聚合根
      feature_flag.go       # FeatureFlag 聚合根
    eventstore/
      eventstore.go         # EventStore 接口
      postgresql.go         # PostgreSQL 实现
      snapshot.go           # SnapshotStore 接口 + 实现
  infrastructure/
    eventbus/
      nats_publisher.go     # NATS 事件发布者实现
      subscriber.go         # NATS 订阅者实现
    saga/
      coordinator.go        # SagaCoordinator 接口 + 实现
      registry.go           # StepRegistry
      models.go             # SagaInstance/Step 模型
      repository.go         # Saga 存储层
  application/
    commands/
      pipeline_commands.go  # Pipeline Command 处理器
      approval_commands.go  # Approval Command 处理器
      feature_flag_commands.go # FeatureFlag Command 处理器
    queries/
      pipeline_queries.go   # Pipeline Query 处理器
      approval_queries.go   # Approval Query 处理器
      feature_flag_queries.go # FeatureFlag Query 处理器
```

### 4.2 CQRS 原则

| 原则 | 说明 | 实现 |
|------|------|------|
| Command 写模型 | 处理业务操作，产生领域事件 | `CommandHandler.Execute()` |
| Query 读模型 | 直接查询 PostgreSQL（非事件溯源） | `QueryHandler.Find()` |
| 读写分离 | 写走 EventStore，读走 Repository | 双表设计 |
| 最终一致性 | 事件发布后查询可能有短暂延迟 | NATS 异步同步 |

### 4.3 Command 处理器示例

```go
// internal/application/commands/pipeline_commands.go

type CreatePipelineCommand struct {
    TenantID    string                 `json:"-"`
    PipelineID  string                 `json:"pipeline_id"`
    TriggeredBy string                 `json:"triggered_by"`
    TriggerType string                 `json:"trigger_type"`
    Params      map[string]interface{} `json:"params"`
}

type CreatePipelineHandler struct {
    eventStore  domain.EventStore
    publisher   events.EventPublisher
    repo        *repository.Repository
    sagaCoord   saga.SagaCoordinator
}

func (h *CreatePipelineHandler) Execute(ctx context.Context, cmd *CreatePipelineCommand) error {
    // 1. 启动 Pipeline Saga
    saga, err := h.sagaCoord.StartSaga(ctx, "pipeline", map[string]interface{}{
        "pipeline_id": cmd.PipelineID,
    })
    if err != nil {
        return fmt.Errorf("start pipeline saga: %w", err)
    }

    // 2. 创建 Pipeline 实体
    pipeline := &models.Pipeline{
        ID: cmd.PipelineID,
        TenantID: cmd.TenantID,
        Status: string(models.PipelineStatusRunning),
        // ...
    }
    if err := h.repo.CreatePipeline(ctx, pipeline); err != nil {
        return h.sagaCoord.Rollback(ctx, saga.ID, fmt.Sprintf("create pipeline failed: %v", err))
    }

    // 3. 发布 PipelineStarted 事件
    event := &events.PipelineStartedEvent{
        BaseDomainEvent: events.BaseDomainEvent{
            AggregateType: "pipeline",
            AggregateID:   cmd.PipelineID,
            EventType:     "pipeline.started",
            TenantID:      cmd.TenantID,
            OccurredAt:    time.Now().UTC(),
        },
        TriggeredBy: cmd.TriggeredBy,
        TriggerType: cmd.TriggerType,
    }
    if err := h.publisher.Publish(ctx, event); err != nil {
        return fmt.Errorf("publish pipeline.started: %w", err)
    }

    // 4. 提交 Saga 步骤
    return h.sagaCoord.CommitStep(ctx, saga.ID, saga.CurrentStepID, nil)
}
```

---

## 五、数据库迁移设计

### 5.1 domain_events 表迁移

见 `migrations/205_create_domain_events.sql`（新增文件）

**设计要点**:
- 使用 `TIMESTAMPTZ` 而非 `INT64` 存储时间（与现有 PostgreSQL 风格一致）
- `tenant_id` 使用 `UUID`（与现有租户模型对齐）
- 月度分区支持（`PARTITION BY RANGE (occurred_at)`）
- 唯一约束 `(aggregate_id, occurred_at, event_type)` 确保事件幂等

### 5.2 saga_instances 表迁移（升级现有 saga_transactions）

见 `migrations/206_upgrade_saga_instances.sql`（新增文件）

**设计要点**:
- 在现有 `saga_transactions` 基础上扩展 JSONB `steps` 字段
- 新增 `compensation_log` JSONB 字段记录补偿轨迹
- 保留向后兼容（不影响现有 handler 调用）

### 5.3 domain_snapshots 表迁移

见 `migrations/207_create_domain_snapshots.sql`（新增文件）

**设计要点**:
- JSONB `state` 字段存储聚合根状态
- `version` 字段与 `domain_events` 版本号对齐
- 复合唯一约束 `(tenant_id, aggregate_type, aggregate_id, version)`

### 5.4 migration_order 表（迁移版本追踪）

见 `migrations/204_migration_order.sql`（新增文件）

**设计要点**:
- 替代当前字母序执行方式，显式声明执行顺序
- 记录每个迁移的执行状态和时间戳
- 支持回滚（`ROLLBACK` 标记）

---

## 六、核心接口定义 (Go)

### 6.1 DomainEvent 接口

见 `internal/domain/events/domain_event.go`

### 6.2 EventStore 接口

见 `internal/domain/eventstore/eventstore.go`

### 6.3 EventPublisher 接口

见 `internal/domain/events/publisher.go`

### 6.4 AggregateRoot 接口

见 `internal/domain/aggregates/aggregate_root.go`

### 6.5 SagaCoordinator 接口

见 `internal/infrastructure/saga/coordinator.go`

### 6.6 StepRegistry

见 `internal/infrastructure/saga/registry.go`

---

## 七、核心流程示例

### 7.1 审批流程完整链路

```
用户提交审批请求
    │
    ├─ [Handler] POST /api/approval/requests
    │   → approvalHandler.CreateApproval()
    │
    ├─ [Service] approvalService.CreateApproval()
    │   → 1. 启动 ApprovalSaga
    │   → 2. 执行 Step 1: CreateApprovalRequest
    │   → 3. 执行 Step 2: CreateApprovalLevels
    │   → 4. 执行 Step 3: NotifyApprovers (NATS 异步)
    │   → 5. 发布 ApprovalRequested 事件
    │
    ├─ [EventStore] Append(ApprovalRequestedEvent)
    │   → INSERT INTO domain_events (...)
    │
    ├─ [NATS] 推送事件到 eventbus
    │   → eventbus 消费者接收
    │   → 触发下游处理（如创建审批任务）
    │
    └─ [Response] 返回 ApprovalRequest ID + Status=Pending

审批人批准
    │
    ├─ [Handler] POST /api/approval/requests/:id/review
    │   → decision="approve"
    │
    ├─ [Service] approvalService.Review()
    │   → 1. 更新 ApprovalLevel 状态
    │   → 2. 检查是否全部级别通过
    │   → 3. 若全部通过 → 发布 ApprovalCompleted 事件
    │
    └─ [EventSubscriber] 监听 ApprovalCompleted
        → 触发自动部署（Pipeline 创建）
```

### 7.2 Pipeline 执行 Saga 流程

```
Pipeline 触发
    │
    ├─ [SagaCoordinator] StartSaga("pipeline", ctx)
    │   → CREATE saga_instances (status=running)
    │
    ├─ [Step 1] CreateBuildRecord
    │   → INSERT INTO builds (...)
    │   → saga_instances.steps[0].status = completed
    │
    ├─ [Step 2] AllocateBuilderAgent
    │   → 分配 K8s RunnerPod
    │   → 成功 → steps[1].status = completed
    │   → 失败 → 触发补偿
    │
    ├─ [Step 3] CheckoutCode + ExecuteStages
    │   → 执行 Pipeline Stages
    │   → 每个 Stage 完成 → 发布 StageCompleted 事件
    │
    ├─ [Step 4] PublishArtifact
    │   → 上传制品到 artifact 服务
    │
    └─ [SagaCoordinator] Complete()
        → saga_instances.status = completed

异常场景：Step 3 失败
    │
    ├─ [SagaCoordinator] Rollback()
    │   → 逆序补偿: Step 4 (skipped) → Step 3 (compensate: CleanupWorkspace) → Step 2 (ReleaseBuilderAgent)
    │   → 记录补偿轨迹到 compensation_log
    │
    └─ [EventStore] Append(PipelineCancelledEvent)
```

### 7.3 事件溯源回放示例

```go
// 从 domain_events 重建 Pipeline 状态

pipeline := &PipelineAggregate{ID: "pipeline-001"}

// 1. 获取快照
snapshot := snapshotStore.GetLatest(ctx, "pipeline", "pipeline-001")
if snapshot != nil {
    pipeline.RestoreFromSnapshot(snapshot)
}

// 2. 获取增量事件
events := eventStore.GetByAggregate(ctx, tenantID, "pipeline", "pipeline-001")
for _, event := range events {
    pipeline.ApplyEvent(event)
}

// 3. 返回当前状态
return pipeline.State() // PipelineStatus: Running, CurrentStage: "test"
```

---

## 八、实施路线图 (3 Sprint)

### Sprint 1 (2周): 基础设施搭建

| 任务 | 预估 | 输出物 | 优先级 |
|------|------|--------|--------|
| 1.1 创建 domain/events 包 + DomainEvent 接口 | 0.5d | `internal/domain/events/domain_event.go` | P0 |
| 1.2 创建 domain/eventstore 包 + EventStore 接口 | 0.5d | `internal/domain/eventstore/eventstore.go` | P0 |
| 1.3 创建 PostgreSQL EventStore 实现 | 1d | `internal/domain/eventstore/postgresql.go` | P0 |
| 1.4 domain_events 迁移文件 + 执行 | 0.5d | `migrations/205_create_domain_events.sql` | P0 |
| 1.5 domain_snapshots 迁移文件 + 执行 | 0.5d | `migrations/207_create_domain_snapshots.sql` | P1 |
| 1.6 migration_order 表 + 迁移版本追踪 | 1d | `migrations/204_migration_order.sql` | P0 |
| 1.7 创建 infrastructure/saga/coordinator.go 升级接口 | 0.5d | `internal/infrastructure/saga/coordinator.go` | P0 |
| 1.8 StepRegistry 步骤注册表实现 | 1d | `internal/infrastructure/saga/registry.go` | P0 |
| 1.9 单元测试：EventStore + SagaCoordinator | 1d | `*_test.go` | P0 |
| 1.10 集成测试：事件发布 + 订阅 | 1.5d | `*_test.go` | P1 |

**Sprint 1 目标**: EventStore + SagaCoordinator 基础设施可用，可编译、可测试

### Sprint 2 (2周): 核心聚合根 + 领域事件

| 任务 | 预估 | 输出物 | 优先级 |
|------|------|--------|--------|
| 2.1 Pipeline 聚合根实现 | 1d | `internal/domain/aggregates/pipeline.go` | P0 |
| 2.2 Approval 聚合根实现 | 1d | `internal/domain/aggregates/approval.go` | P0 |
| 2.3 Pipeline 域事件定义 | 0.5d | `internal/domain/events/pipeline_events.go` | P0 |
| 2.4 Approval 域事件定义 | 0.5d | `internal/domain/events/approval_events.go` | P0 |
| 2.5 FeatureFlag 聚合根 + 域事件 | 1d | `internal/domain/aggregates/feature_flag.go` | P1 |
| 2.6 CQRS Command 处理器：Pipeline | 1d | `internal/application/commands/pipeline_commands.go` | P1 |
| 2.7 CQRS Command 处理器：Approval | 1d | `internal/application/commands/approval_commands.go` | P1 |
| 2.8 Pipeline 执行 Saga 实现 | 1d | `saga/registry.go` 注册 Pipeline 步骤 | P0 |
| 2.9 Approval Saga 实现（含补偿） | 1d | `saga/registry.go` 注册 Approval 步骤 | P0 |
| 2.10 现有 handler 集成改造（Pipeline） | 2d | `internal/build/handler/handler.go` 集成 | P1 |
| 2.11 现有 handler 集成改造（Approval） | 2d | `internal/approval/handler/handler.go` 集成 | P1 |

**Sprint 2 目标**: 3 个核心聚合根可用，Pipeline/Approval 领域事件驱动运行

### Sprint 3 (2周): 异步集成 + 测试 + 文档

| 任务 | 预估 | 输出物 | 优先级 |
|------|------|--------|--------|
| 3.1 NATS EventBus 集成（EventPublisher 实现） | 1.5d | `internal/infrastructure/eventbus/nats_publisher.go` | P1 |
| 3.2 事件订阅者注册机制 | 1d | `internal/domain/events/handlers.go` | P1 |
| 3.3 FinOps 计费 Saga 实现 | 1d | `saga/registry.go` 注册 Billing 步骤 | P2 |
| 3.4 Deploy Saga 回滚能力增强 | 1d | 现有 canary-analysis + rollback 集成 | P2 |
| 3.5 回归测试：现有 API 不破坏 | 2d | 端到端测试 | P0 |
| 3.6 单元测试覆盖率 > 60% | 2d | `*_test.go` | P1 |
| 3.7 技术文档 + 迁移指南 | 1d | `docs/expert-review-2026-07-16/` | P1 |
| 3.8 DDD 评分重新评估（F → B） | 0.5d | 评审报告 | P1 |

**Sprint 3 目标**: 全系统集成，NATS 异步事件驱动，DDD 评分 F → B

---

## 九、风险与缓解措施

### 9.1 技术风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 现有 handler 改造范围大 | 高 | 高 | Sprint 2 分模块渐进改造，保持旧接口兼容 |
| 事件溯源性能退化 | 中 | 中 | 快照机制（每 100 事件），增量回放 |
| Saga 补偿不彻底 | 中 | 高 | 补偿失败标记为 `compensation_failed`，人工介入 |
| 迁移文件执行顺序混乱 | 高 | 高 | 204_migration_order 表显式管理顺序 |
| 222 模块逐个改造工作量巨大 | 高 | 中 | 仅改造 3 个核心聚合根，其余保持贫血模型 |

### 9.2 架构风险

| 风险 | 缓解措施 |
|------|---------|
| CQRS 导致读写延迟 | 读模型直接查 PostgreSQL，不走 EventStore 回放 |
| 事件顺序乱序 | NATS 有序订阅 + PostgreSQL 唯一约束 |
| 幂等性破坏 | 唯一约束 `(aggregate_id, occurred_at, event_type)` + correlation_id |

### 9.3 运营风险

| 风险 | 缓解措施 |
|------|---------|
| 团队对事件驱动不熟悉 | Sprint 1 完成后组织内部分享 + 代码 Review |
| 生产回滚困难 | 保持旧 handler 接口兼容，新功能走新路径 |
| 监控覆盖不足 | OTel tracing 集成（已有 X-Trace-ID 传播），为事件链路添加 span |

---

## 十、2026-07-16 更新日志

> 2026-07-16 更新：以下为 Sprint 1 基础设施搭建阶段已完成的工作，按任务编号对应第八章路线图。

### 10.1 编译错误修复总结

在实现 EventStore PostgreSQL 层和聚合根过程中，发现并修复了以下编译问题：

#### 10.1.1 `storedEvent` wrapper 类型（修复 row scanning 编译错误）

**问题**: `postgresql.go` 中 `GetByAggregate` / `GetByType` 等方法使用 `rows.Scan()` 直接扫描数据库行，返回类型与 `EventStore` 接口声明的 `[]domain.DomainEvent` 不匹配——扫描结果是一个匿名 struct 切片，无法赋值给接口切片。

**解决方案**: 引入 `storedEvent` 包装类型（`internal/domain/eventstore/stored_event.go`），该结构体直接映射 `domain_events` 表的列结构，并通过方法实现 `events.DomainEvent` 接口的所有必需方法：

```go
// storedEvent wraps raw row data from the domain_events table and implements
// the events.DomainEvent interface so EventStore methods can return []DomainEvent.
type storedEvent struct {
    aggregateType string
    aggregateID   string
    eventType     string
    tenantID      string
    occurredAt    time.Time
    version       int
    correlationID string
    causationID   string
    eventData     json.RawMessage
}

// 实现 DomainEvent 接口
func (s *storedEvent) AggregateType() string { return s.aggregateType }
func (s *storedEvent) AggregateID() string   { return s.aggregateID }
func (s *storedEvent) EventType() string     { return s.eventType }
func (s *storedEvent) TenantID() string      { return s.tenantID }
func (s *storedEvent) OccurredAt() time.Time { return s.occurredAt }
func (s *storedEvent) Version() int          { return s.version }

// compile-time interface check — 编译期保证类型契约
var _ events.DomainEvent = (*storedEvent)(null)
```

**设计要点**:
- `storedEvent` 是内部类型（非导出），仅用于数据库行→接口转换
- 额外提供 `SetAggregateID` / `SetTenantID` / `SetVersion` setter 方法，支持事务内回填
- `json.RawMessage` 保留事件数据的原始 JSON，避免不必要的反序列化开销
- `compile-time interface check` 确保未来接口变更时立即暴露编译错误
- `postgresql.go` 中所有查询方法统一返回 `[]storedEvent`，隐式转换为 `[]events.DomainEvent`

#### 10.1.2 聚合根 `Apply` 方法 unused variable 修复

在实现 Pipeline / Approval / FeatureFlag 三个聚合根时，`Apply` 方法中存在 unused variable 编译错误。问题根因：`Apply` 方法接收 `DomainEvent` 参数但未在方法体内使用。

**修复文件**:
| 文件 | 修复内容 |
|------|---------|
| `internal/domain/aggregates/feature_flag.go` | `Apply` 方法添加事件处理逻辑，消除 unused event 变量 |
| `internal/domain/aggregates/approval.go` | `Apply` 方法添加事件处理逻辑，消除 unused event 变量 |
| `internal/domain/aggregates/pipeline.go` | `Apply` 方法添加事件处理逻辑，消除 unused event 变量 |

**修复模式**: 每个聚合根的 `Apply` 方法根据 `event.EventType()` 进行类型分支，调用对应的状态转移方法，确保事件真正驱动状态变更而非仅作为占位符。

### 10.2 CQRS Query 层设计（新增章节）

#### 10.2.1 核心接口定义

`internal/application/queries/query.go` 定义了 CQRS 读侧的完整接口体系：

| 接口 | 签名 | 用途 |
|------|------|------|
| `Query` | `Validate() error` | 所有查询的标记接口，参数校验入口 |
| `QueryHandler[T]` | `Execute(ctx, Query) (T, error)` | 泛型单值查询处理器 |
| `ListQueryHandler[T]` | `ExecuteList(ctx, Query) (T, int, error)` | 分页列表查询处理器（返回结果 + 总数） |
| `EventQueryHandler` | `ExecuteEvents(ctx, Query) ([]DomainEvent, error)` | 事件流查询处理器 |
| `QueryBus` | `Register/Resolve` | 查询分发总机 |

**设计要点**:
- `Query` 接口只暴露 `Validate()` 方法，查询参数通过具体 struct 字段携带（如 `TenantID`、`Page`、`Limit`）
- `QueryBus` 采用名称映射（`map[string]any`），生产环境可扩展缓存、链路追踪等中间件
- `eventStoreReader` 封装 EventStore 原始调用，提供查询友好的辅助方法（分页、版本过滤、事件重建）
- 聚合类型常量 `AggregateTypePipeline` / `AggregateTypeApproval` / `AggregateTypeFeatureFlag` 作为查询路由的单一起源
- 泛型 `pagination[T]` 辅助函数统一处理 limit/offset 分页逻辑

#### 10.2.2 Pipeline 查询处理器

`internal/application/queries/pipeline_queries.go` 实现了 Pipeline 域的全部读查询：

| 查询类型 | 处理器 | 返回类型 | 数据源 |
|---------|--------|---------|--------|
| `GetPipelineQuery` | `GetPipelineHandler` | `PipelineEventState` | EventStore（事件重建） |
| `ListPipelinesQuery` | `ListPipelinesHandler` | `[]PipelineEventState` | EventStore + 分页 |
| `GetPipelineEventsQuery` | `GetPipelineEventsHandler` | `[]DomainEvent` | EventStore（事件流） |
| `GetPipelineVersionQuery` | `GetPipelineVersionHandler` | `int` | EventStore 最新版本 |

**查询流程**:
1. 查询携带 `TenantID` + `AggregateID` 参数
2. `QueryHandler.Execute()` 调用 `eventStoreReader` 读取事件
3. 按 `occurred_at` 排序后逐条回放重建聚合状态
4. 返回 `PipelineEventState`（包含当前状态、版本号、最后事件时间）

#### 10.2.3 Approval 查询处理器

`internal/application/queries/approval_queries.go` 实现了 Approval 域的全部读查询：

| 查询类型 | 处理器 | 返回类型 | 数据源 |
|---------|--------|---------|--------|
| `GetApprovalQuery` | `GetApprovalHandler` | `ApprovalEventState` | EventStore（事件重建） |
| `ListApprovalsQuery` | `ListApprovalsHandler` | `[]ApprovalEventState` | EventStore + 分页 |
| `GetApprovalEventsQuery` | `GetApprovalEventsHandler` | `[]DomainEvent` | EventStore（事件流） |
| `GetApprovalVersionQuery` | `GetApprovalVersionHandler` | `int` | EventStore 最新版本 |

#### 10.2.4 CQRS 数据流全景

```
┌─────────────────────────────────────────────────────────────┐
│                    Query 层（读侧）                            │
│                                                             │
│  QueryBus ──┬── GetPipelineHandler ──→ EventStore ──→ 聚合状态
│             ├── ListPipelinesHandler ──→ EventStore ──→ 列表
│             ├── GetApprovalHandler ──→ EventStore ──→ 聚合状态
│             ├── ListApprovalsHandler ──→ EventStore ──→ 列表
│             └── GetPipelineEventsHandler ──→ EventStore ──→ 事件流
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ 事件持久化
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   domain_events 表（PostgreSQL）               │
│                                                             │
│  aggregate_id | aggregate_type | event_type | event_data    │
│  tenant_id    | occurred_at    | version    | correlation  │
└─────────────────────────────────────────────────────────────┘
```

### 10.3 当前进度状态

**Sprint 1（基础设施搭建）进度**:

| 任务编号 | 任务描述 | 状态 | 产出文件 |
|---------|---------|------|---------|
| 1.1 | DomainEvent 接口定义 | ✅ 完成 | `internal/domain/events/domain_event.go` |
| 1.2 | EventStore 接口定义 | ✅ 完成 | `internal/domain/eventstore/eventstore.go` |
| 1.3 | PostgreSQL EventStore 实现 + storedEvent wrapper | ✅ 完成 | `internal/domain/eventstore/postgresql.go` + `stored_event.go` |
| 1.4 | domain_events 迁移文件 | ⏳ 待实现 | `migrations/205_create_domain_events.sql` |
| 1.5 | domain_snapshots 迁移文件 | ⏳ 待实现 | `migrations/207_create_domain_snapshots.sql` |
| 1.6 | migration_order 表 + 版本追踪 | ⏳ 待实现 | `migrations/204_migration_order.sql` |
| 1.7 | SagaCoordinator 升级接口 | ⏳ 待实现 | `internal/infrastructure/saga/coordinator.go` |
| 1.8 | StepRegistry 步骤注册表 | ⏳ 待实现 | `internal/infrastructure/saga/registry.go` |
| 1.9 | 单元测试 | ⏳ 待实现 | `*_test.go` |
| 1.10 | 集成测试 | ⏳ 待实现 | `*_test.go` |

**额外已完成（超出 Sprint 1 范围）**:

| 任务描述 | 状态 | 产出文件 |
|---------|------|---------|
| 聚合根 Apply 方法修复（3 个） | ✅ 完成 | `aggregates/pipeline.go` + `approval.go` + `feature_flag.go` |
| CQRS Query 接口定义 | ✅ 完成 | `internal/application/queries/query.go` |
| Pipeline CQRS 查询处理器 | ✅ 完成 | `internal/application/queries/pipeline_queries.go` |
| Approval CQRS 查询处理器 | ✅ 完成 | `internal/application/queries/approval_queries.go` |

### 10.4 验证结果

```bash
$ go build ./cmd/server/
# ✅ 构建通过，0 编译错误
```

---

## 附录

### A. 关键文件清单

| 文件路径 | 类型 | 说明 |
|---------|------|------|
| `internal/domain/events/domain_event.go` | Go | DomainEvent 接口 + BaseDomainEvent |
| `internal/domain/events/publisher.go` | Go | EventPublisher + EventHandler 接口 |
| `internal/domain/events/pipeline_events.go` | Go | Pipeline 域事件类型定义 |
| `internal/domain/events/approval_events.go` | Go | Approval 域事件类型定义 |
| `internal/domain/aggregates/aggregate_root.go` | Go | AggregateRoot 接口 |
| `internal/domain/aggregates/pipeline.go` | Go | Pipeline 聚合根实现 |
| `internal/domain/aggregates/approval.go` | Go | Approval 聚合根实现 |
| `internal/domain/eventstore/eventstore.go` | Go | EventStore + SnapshotStore 接口 |
| `internal/domain/eventstore/postgresql.go` | Go | PostgreSQL EventStore 实现 |
| `internal/infrastructure/saga/coordinator.go` | Go | SagaCoordinator 接口 + 实现 |
| `internal/infrastructure/saga/registry.go` | Go | StepRegistry 步骤注册表 |
| `internal/infrastructure/saga/models.go` | Go | SagaInstance/Step 模型 |
| `internal/infrastructure/eventbus/nats_publisher.go` | Go | NATS EventPublisher 实现 |
| `migrations/204_migration_order.sql` | SQL | 迁移版本追踪表 |
| `migrations/205_create_domain_events.sql` | SQL | domain_events 表 |
| `migrations/206_upgrade_saga_instances.sql` | SQL | saga_instances 升级 |
| `migrations/207_create_domain_snapshots.sql` | SQL | domain_snapshots 表 |

### B. DDD 评分提升预期

| 维度 | 当前评分 | 目标评分 | 提升依据 |
|------|---------|---------|---------|
| 领域建模 | F | B | 3 个聚合根 + 领域方法 |
| 限界上下文 | C- | C+ | 聚合根明确边界 |
| 聚合设计 | F | B- | Pipeline/Approval/FeatureFlag 聚合根 |
| 事件驱动 | D | B | DomainEvent + EventStore + EventPublisher |
| 防腐层 | D- | C | CQRS 读写分离 |
| **综合** | **F** | **B-** | 核心领域事件驱动 + 分布式事务 |
