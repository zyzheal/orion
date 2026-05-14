# Event Sourcing and Dead Letter Queue Design (事件溯源与死信队列设计)

> 版本：v1.0 | 创建日期：2026-04-10 | 状态：待评审 | 优先级：P2
> 所属模块：M24-事件总线 | 作者：Orion Architecture Team

---

## 执行摘要 (Executive Summary)

本设计文档详细描述 Orion 平台的事件溯源（Event Sourcing）与死信队列（Dead Letter Queue）架构方案。事件溯源提供状态重建、时间旅行调试、合规审计等关键能力，死信队列保障故障场景下的事件可靠处理。

### 设计目标

| 目标 | 描述 | 衡量指标 |
|------|------|----------|
| **状态可重建** | 从任意时间点的事件重建系统状态 | 重建成功率 ≥ 99.9% |
| **事件可回放** | 支持按时间、条件、增量方式回放事件 | 回放延迟 < 100ms/事件 |
| **故障可恢复** | 失败事件自动重试与人工介入处理 | DLQ 处理及时率 ≥ 95% |
| **变更可追溯** | 完整记录数据变更历史 | 审计覆盖率 100% |
| **存储可优化** | 事件压缩与快照机制降低存储成本 | 存储成本降低 ≥ 60% |

### 核心收益量化

| 指标 | 当前状态 | 实施后目标 | 改善幅度 |
|------|----------|-----------|---------|
| 故障数据恢复时间 | 2-4 小时（从备份恢复） | 5-10 分钟（事件回放） | 92% |
| 审计查询响应时间 | 5-10 分钟（关联查询） | < 1 秒（事件流查询） | 99% |
| 事件处理失败损失 | 人工排查，平均 30 分钟/次 | 自动重试 + 告警，<5 分钟/次 | 83% |
| 存储成本（年） | 预估 50TB 原始事件 | 15TB（压缩 + 快照） | 70% |

---

## 一、事件溯源架构 (Event Sourcing Architecture)

### 1.1 核心概念

事件溯源是一种架构模式，将系统状态建模为事件序列而非当前状态快照。

#### 1.1.1 传统 CRUD vs 事件溯源

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         传统 CRUD 模式 vs 事件溯源模式                            │
└─────────────────────────────────────────────────────────────────────────────────┘

传统 CRUD 模式 (Current State Only):
  应用层 → 数据库 (只存当前状态)
  问题：无法追溯历史、无法恢复状态

事件溯源模式 (Event Stream):
  应用层 → 事件存储 (UserCreated → NameUpdated) → 投影 (当前状态)
  优势：完整历史、可追溯、可重建、审计支持
```

#### 1.1.2 事件溯源核心术语

| 术语 | 定义 | 示例 |
|------|------|------|
| **Event** | 已发生的事实记录，不可变 | `UserCreated`, `OrderPlaced` |
| **Event Stream** | 同一聚合根的事件序列 | `user-123` 的所有事件 |
| **Aggregate** | 事件归属的业务实体 | `User`, `Order`, `Pipeline` |
| **Projection** | 从事件派生的读取模型 | `UserView`, `OrderSummary` |
| **Snapshot** | 某一时间点的状态快照 | `UserState@version=100` |
| **Replay** | 重新处理历史事件 | 重建状态、迁移数据 |
| **Upcast** | 旧事件格式转换为新格式 | `v1` → `v2` 事件迁移 |

### 1.2 事件溯源架构图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Orion 事件溯源架构                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────────┐
                                    │   应用服务层     │
                                    └────────┬────────┘
                                             │
              ┌──────────────────────────────┼──────────────────────────────┐
              │                              │                              │
              ▼                              ▼                              ▼
    ┌─────────────────┐            ┌─────────────────┐            ┌─────────────────┐
    │   命令处理器     │            │   事件处理器     │            │   查询处理器     │
    │  Command        │            │  Event          │            │  Query          │
    │  Handler        │            │  Handler        │            │  Handler        │
    └────────┬────────┘            └────────┬────────┘            └────────┬────────┘
             │                              │                              │
             │ 1. 产生事件                   │ 2. 处理事件                   │ 3. 读取投影
             ▼                              ▼                              ▼
    ┌──────────────────────────────────────────────────────────────────────────────┐
    │                          Event Bus (NATS JetStream)                          │
    └─────────────────────────────┬────────────────────────────────────────────────┘
                                  │
                  ┌───────────────┼───────────────┐
                  │               │               │
                  ▼               ▼               ▼
    ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
    │  原始事件存储    │  │   事件快照存储   │  │   投影数据存储   │
    │  Raw Event      │  │   Snapshot      │  │   Projection    │
    │  (NATS Stream)  │  │   (PostgreSQL)  │  │   (Elasticsearch)│
    └─────────────────┘  └─────────────────┘  └─────────────────┘
                  │               │               │
                  ▼               ▼               ▼
    ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
    │   事件回放服务   │  │   状态重建服务   │  │   事件审计服务   │
    └─────────────────┘  └─────────────────┘  └─────────────────┘
```

### 1.3 事件溯源适用场景

| 场景 | 适用性 | 理由 | 示例 |
|------|--------|------|------|
| **金融交易** | ✅ 强烈推荐 | 需要完整审计轨迹、对账能力 | 转账、支付、结算 |
| **订单系统** | ✅ 强烈推荐 | 状态变更频繁、需要追溯 | 电商订单、物流追踪 |
| **审批流程** | ✅ 强烈推荐 | 多步骤、可回滚、可审计 | 请假审批、采购审批 |
| **配置管理** | ✅ 推荐 | 需要版本历史、可回滚 | 应用配置、基础设施配置 |
| **用户行为** | ✅ 推荐 | 需要分析用户旅程 | 点击流、操作日志 |
| **简单 CRUD** | ⚠️ 谨慎使用 | 过度设计、增加复杂度 | 用户资料编辑 |

### 1.4 Orion 平台事件溯源应用清单

| 模块 | 应用场景 | 事件类型 | 优先级 |
|------|----------|----------|--------|
| **M5-Pipeline 引擎** | Pipeline 状态变更、执行历史 | `PipelineCreated`, `StageEntered`, `RunCompleted` | P0 |
| **M3-审批工作台** | 审批流程追溯、状态回滚 | `ApprovalRequested`, `Approved`, `Rejected` | P0 |
| **M16-智能部署** | 部署历史、灰度过程记录 | `DeploymentInitiated`, `CanaryProgressed`, `Rolledback` | P1 |
| **M18-安全合规** | 安全事件审计、合规追溯 | `SecurityScanCompleted`, `VulnerabilityFound` | P1 |
| **M21-审计中心** | 全平台操作审计 | `AuditLogged`, `ConfigChanged` | P0 |
| **M7-配置管理** | 配置变更历史、版本回滚 | `ConfigUpdated`, `ConfigRolledback` | P2 |

---

## 二、事件存储设计 (Event Storage Design)

### 2.1 存储分层架构

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           事件存储分层架构                                       │
└─────────────────────────────────────────────────────────────────────────────────┘

Layer 1: 热存储层 (Hot Tier) - NATS JetStream
  定位：最近 7 天事件，高频读写，低延迟访问
  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
  │ orion-events-7d │  │ orion-pipe-7d   │  │ orion-audit-7d  │
  │ MaxAge: 7 days  │  │ MaxAge: 7 days  │  │ MaxAge: 7 days  │
  │ MaxBytes: 100GB │  │ MaxBytes: 50GB  │  │ MaxBytes: 20GB  │
  │ Replicas: 3     │  │ Replicas: 3     │  │ Replicas: 3     │
  └─────────────────┘  └─────────────────┘  └─────────────────┘
                                  │
                                  │ 异步归档 (Archiver Service)
                                  ▼
Layer 2: 温存储层 (Warm Tier) - PostgreSQL
  定位：7 天 -1 年事件，中等频率访问，支持复杂查询
  ┌─────────────────────────────────────────────────────────────┐
  │ events_archive (分区表，按月分区)                            │
  │ events_archive_2026_04 │ events_archive_2026_05 │ ...       │
  │ Retention: 1 年                                              │
  └─────────────────────────────────────────────────────────────┘
                                  │
                                  │ 定期冷备 (Cold Backup Job)
                                  ▼
Layer 3: 冷存储层 (Cold Tier) - 对象存储 (S3/MinIO)
  定位：1-2 年 + 事件，低频访问，合规归档，成本最优
  ┌─────────────────────────────────────────────────────────────┐
  │ s3://orion-events-archive/                                   │
  │ 2025/04/events.parquet │ 2025/05/events.parquet │ ...       │
  │ 格式：Parquet (列式存储，压缩比 10:1)                         │
  └─────────────────────────────────────────────────────────────┘
```

### 2.2 NATS JetStream Stream 配置

| Stream 名称 | 主题模式 | 保留策略 | 最大字节 | 副本数 | 用途 |
|-------------|----------|----------|----------|--------|------|
| `orion-events-all` | `orion.>` | 7 天 | 100GB | 3 | 所有事件（主存储） |
| `orion-pipeline` | `orion.pipeline.>` | 30 天 | 50GB | 3 | Pipeline 事件 |
| `orion-approval` | `orion.approval.>` | 90 天 | 20GB | 3 | 审批事件 |
| `orion-deployment` | `orion.deployment.>` | 30 天 | 30GB | 3 | 部署事件 |
| `orion-audit` | `orion.*.audit.>` | 90 天 | 50GB | 3 | 审计事件 |
| `orion-security` | `orion.security.>` | 90 天 | 30GB | 3 | 安全事件 |

### 2.3 事件保留策略

| 事件级别 | 事件类型示例 | 热存储 (NATS) | 温存储 (PostgreSQL) | 冷存储 (S3) |
|----------|--------------|---------------|---------------------|-------------|
| **P0** | `approval.*`, `security.audit.*` | 90 天 | 2 年 | 7 年 |
| **P1** | `pipeline.*`, `deployment.*` | 30 天 | 1 年 | 2 年 |
| **P2** | `system.*`, `ai.*` | 7 天 | 6 个月 | 1 年 |
| **P3** | `system.metric.*` | 24 小时 | 不存储 | 不存储 |

### 2.4 事件存储结构图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           NATS 事件记录结构                                      │
└─────────────────────────────────────────────────────────────────────────────────┘

Subject: orion.pipeline.run.started
Headers:
  • Nats-Msg-Id: 550e8400-e29b-41d4-a716-446655440001
  • Nats-Expected-Last-Sequence: 12345
  • Nats-Time: 2026-04-10T10:00:00Z

Body (CloudEvents Format):
{
  "specversion": "1.0",
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "source": "orion/pipeline-engine/v1",
  "type": "io.orion.pipeline.run.started",
  "subject": "pipeline-run-12345",
  "time": "2026-04-10T10:00:00Z",
  "traceid": "abc123-def456-ghi789",
  "tenantid": "tenant-alpha",
  "priority": "P1",
  "aggregate": {
    "type": "PipelineRun",
    "id": "pipeline-run-12345",
    "version": 1
  },
  "data": {
    "pipelineRun": {
      "name": "pipeline-run-12345",
      "pipeline": "main-pipeline",
      "branch": "feature/orion-123",
      "commit": "abc123def",
      "trigger": { "type": "git-push", "user": "zhangsan@company.com" }
    }
  }
}
```

### 2.5 PostgreSQL 事件归档表

```sql
CREATE TABLE events_archive (
    id              UUID PRIMARY KEY,
    type            VARCHAR(256) NOT NULL,
    source          VARCHAR(256) NOT NULL,
    subject         VARCHAR(256),
    time            TIMESTAMPTZ NOT NULL,
    data            JSONB NOT NULL,
    traceid         VARCHAR(64),
    tenantid        VARCHAR(64) NOT NULL,
    aggregate_type  VARCHAR(128),
    aggregate_id    VARCHAR(128),
    aggregate_ver   INTEGER,
    priority        VARCHAR(4),
    correlationid   UUID,
    archived_at     TIMESTAMPTZ DEFAULT NOW(),
    partition_key   VARCHAR(32),
    
    INDEX idx_events_time (time DESC),
    INDEX idx_events_type (type),
    INDEX idx_events_tenant_time (tenantid, time DESC),
    INDEX idx_events_aggregate (aggregate_type, aggregate_id, time)
);

-- 按月分区
CREATE TABLE events_archive_2026_04 PARTITION OF events_archive
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
```

### 2.6 事件流组织方式 (按聚合根)

```
Aggregate: PipelineRun (id: pipeline-run-12345)
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Event Stream: orion.pipeline.pipeline-run-12345                                  │
│                                                                                  │
│ Seq#001: PipelineRunCreated { "name": "run-12345", "pipeline": "main" }         │
│ Seq#002: PipelineRunStarted   { "trigger": "git-push", "user": "alice" }        │
│ Seq#003: StageEntered         { "stage": "build", "status": "running" }         │
│ Seq#004: TaskCompleted        { "task": "compile", "result": "success" }        │
│ Seq#005: StageEntered         { "stage": "test", "status": "running" }          │
│ Seq#006: PipelineRunCompleted { "status": "success", "duration": 300 }          │
│                                                                                  │
│ Current State (Projection):                                                      │
│   { "status": "completed", "currentStage": "deploy", "duration": 300 }          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 三、事件 Schema 管理 (Event Schema Management)

### 3.1 Schema 版本化策略

```
Schema URL 格式:
https://orion.internal/schemas/{domain}/{event-type}/v{major}.{minor}.json

示例:
https://orion.internal/schemas/pipeline/pipeline-run-started/v1.0.json
https://orion.internal/schemas/pipeline/pipeline-run-started/v2.0.json

版本号语义:
• Major (主版本): 不兼容变更，需要迁移
• Minor (次版本): 向后兼容变更，可选迁移
• Patch (修订版): 文档/示例更新，不影响结构
```

### 3.2 兼容性规则

| 变更类型 | 兼容性 | 版本号 | 示例 |
|----------|--------|--------|------|
| 添加可选字段 | ✅ 向后兼容 | Minor | 新增 `metadata` 字段 |
| 添加新的枚举值 | ✅ 向后兼容 | Minor | 新增 `status: "paused"` |
| 删除字段 | ❌ 不兼容 | Major | 删除 `legacyId` 字段 |
| 修改字段类型 | ❌ 不兼容 | Major | `duration`: integer → string |
| 添加必填字段 | ❌ 不兼容 | Major | 新增必填 `userId` |

### 3.3 Schema 注册中心架构

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Schema 注册中心                                        │
└─────────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐
  │   Schema     │
  │   CLI        │
  └──────┬───────┘
         │ 发布/验证
         ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                      Schema Registry Service                             │
  │  ┌─────────────────────────────────────────────────────────────────┐   │
  │  │ Schema Store (PostgreSQL)                                        │   │
  │  │ id | type | version | schema | compatibility | deprecated_at    │   │
  │  └─────────────────────────────────────────────────────────────────┘   │
  └─────────────────────────────────────────────────────────────────────────┘
         │
         │ 验证/查询
         ▼
  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
  │   Producer   │    │   Gateway    │    │   Consumer   │
  └──────────────┘    └──────────────┘    └──────────────┘
```

### 3.4 事件 Upcast 迁移

```
Upcast 函数示例 (v1.0 → v2.0):

function upcastPipelineRunStarted_v1_to_v2(event_v1) {
  return {
    ...event_v1,
    type: 'io.orion.pipeline.run.started.v2',
    dataschema: '.../v2.0.json',
    data: {
      pipelineRun: {
        ...event_v1.data.pipelineRun,
        // 变更 1: 扁平化 submitter 字段
        user: event_v1.data.pipelineRun.trigger?.submitter || event_v1.data.user,
        // 变更 2: duration 改为 ISO8601 格式
        duration: event_v1.data.pipelineRun.duration ? `PT${duration}S` : null
      }
    },
    'x-upcast': {
      from_version: '1.0',
      to_version: '2.0',
      upcast_at: new Date().toISOString()
    }
  };
}
```

---

## 四、事件回放机制 (Event Replay Mechanism)

### 4.1 事件回放类型

| 回放类型 | 描述 | 参数 | 使用场景 |
|----------|------|------|----------|
| **时间点回放** | 从指定时间点开始回放 | `start_time`, `end_time`, `subjects` | 系统故障恢复、新服务上线 |
| **条件回放** | 根据条件筛选事件 | `filter`, `aggregate_ids`, `event_types` | 特定租户数据修复、问题排查 |
| **增量回放** | 从上次消费位置继续 | `consumer_group`, `from_sequence` | 消费者故障恢复、积压处理 |

### 4.2 事件回放流程图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           事件回放流程                                           │
└─────────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │   用户/      │     │  Replay      │     │  Event       │     │  目标        │
  │   定时任务   │     │  Controller  │     │  Store       │     │  服务        │
  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
         │                    │                    │                    │
         │ 1. 发起回放请求     │                    │                    │
         │───────────────────▶│                    │                    │
         │                    │                    │                    │
         │                    │ 2. 创建回放任务     │                    │
         │                    │ • 生成 replay_id    │                    │
         │                    │───────────────────▶│                    │
         │                    │                    │                    │
         │                    │ 3. 流式读取事件     │                    │
         │                    │◀───────────────────│                    │
         │                    │                    │                    │
         │                    │ 4. Upcast 转换 (如有) │                    │
         │                    │                    │                    │
         │                    │ 5. 重新发布事件     │                    │
         │                    │ • 添加 replay 标记   │                    │
         │                    │─────────────────────────────────────────▶│
         │                    │                    │                    │
         │                    │                    │ 6. 幂等处理事件     │
         │                    │                    │                    │
         │ 7. 返回回放结果     │                    │                    │
         │◀───────────────────│                    │                    │
         │                    │                    │                    │
  └──────────────┘           └──────────────┘     └──────────────┘     └──────────┘
```

### 4.3 回放任务状态

```
PENDING → RUNNING → COMPLETED
               ↘
                FAILED → RETRYING → RUNNING
```

### 4.4 回放幂等性保证

**策略 1: 事件去重表**
```sql
CREATE TABLE processed_events (
    event_id      UUID NOT NULL,
    replay_id     UUID NOT NULL,
    processed_at  TIMESTAMPTZ DEFAULT NOW,
    PRIMARY KEY (event_id, replay_id)
);
```

**策略 2: 版本号检查**
```
IF current_aggregate.version != event.expected_version THEN
  SKIP  -- 版本不匹配，跳过
END IF;
```

**策略 3: 业务幂等**
```sql
INSERT INTO orders (id, user_id, total)
VALUES (?, ?, ?)
ON CONFLICT (id) DO NOTHING;  -- 已存在则忽略
```

### 4.5 回放事件标记

```json
{
  "specversion": "1.0",
  "id": "550e8400-e29b-41d4-a716-446655440001",
  ...
  "x-replay-info": {
    "replay_id": "replay-abc123",
    "initiated_at": "2026-04-10T12:00:00Z",
    "original_time": "2026-04-09T10:00:00Z",
    "is_replay": true
  }
}
```

---

## 五、状态重建 (State Rebuilding)

### 5.1 状态重建原理

```
核心公式：State(current) = State(initial) + Σ Event[i] (i = 1 to N)

重建示例 (Pipeline 状态):
事件流:
  Seq#001: PipelineRunCreated { name: "run-123", pipeline: "main" }
  Seq#002: PipelineRunStarted   { trigger: "git-push", user: "alice" }
  Seq#003: StageEntered         { stage: "build", status: "running" }
  Seq#004: TaskCompleted        { task: "compile", result: "success" }
  Seq#005: StageEntered         { stage: "test", status: "running" }
  Seq#006: PipelineRunCompleted { status: "success", duration": 300 }

重建过程:
  Step 0: {}
  Step 1: { status: "created", name: "run-123" }
  Step 2: { status: "running", trigger: "git-push" }
  Step 3: { currentStage: "build" }
  Step 4: { lastTask: "compile", result: "success" }
  Step 5: { currentStage: "test" }
  Step 6: { status: "completed", duration: 300 }

最终状态:
  { "status": "completed", "name": "run-123", "pipeline": "main", 
    "currentStage": "test", "duration": 300, "trigger": "git-push" }
```

### 5.2 状态重建时序图

```
场景：重建 PipelineRun-12345 的当前状态 (有快照)

┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Client     │     │  Rebuild     │     │  Snapshot    │     │   Event      │
│              │     │  Service     │     │  Store       │     │   Store      │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │                    │
       │ 1. 请求重建状态     │                    │                    │
       │ (aggregate_id)     │                    │                    │
       │───────────────────▶│                    │                    │
       │                    │                    │                    │
       │                    │ 2. 查询最新快照     │                    │
       │                    │───────────────────▶│                    │
       │                    │                    │                    │
       │                    │ 3. 返回快照        │                    │
       │                    │  version: 100      │                    │
       │                    │  state: {...}      │                    │
       │                    │◀───────────────────│                    │
       │                    │                    │                    │
       │                    │ 4. 查询快照后事件   │                    │
       │                    │ (version > 100)    │                    │
       │                    │─────────────────────────────────────────▶│
       │                    │                    │                    │
       │                    │ 5. 流式返回事件     │                    │
       │                    │ (Seq#101 to 150)   │                    │
       │                    │◀──────────────────────────────────────────│
       │                    │                    │                    │
       │                    │ 6. 应用事件到快照   │                    │
       │                    │ state = apply(state, event)             │
       │                    │                    │                    │
       │ 7. 返回重建后的状态 │                    │                    │
       │◀───────────────────│                    │                    │
       │                    │                    │                    │
└──────────────┘           └──────────────┘     └──────────────┘     └──────────┘

性能对比:
• 有快照：重建 150 个事件 → 只需应用 50 个事件 (快照@100) → ~100ms
• 无快照：重建 150 个事件 → 应用全部 150 个事件 → ~500ms
```

### 5.3 快照机制

```
快照触发条件:
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 策略 1: 按版本号触发 (Version-based) ← 推荐                                      │
│   触发条件：aggregate_version % snapshot_interval == 0                         │
│   配置：snapshot_interval: 100 (每 100 个事件创建一个快照)                        │
│   优点：快照间隔固定，重建性能可预测                                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 策略 2: 按时间触发 (Time-based)                                                 │
│   触发条件：当前时间 - 上次快照时间 > snapshot_interval                         │
│   配置：snapshot_interval: 1 hour                                               │
│   优点：时间维度均匀，适合按时间查询                                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 策略 3: 按事件大小触发 (Size-based)                                             │
│   触发条件：累计事件大小 > snapshot_size_threshold                             │
│   配置：snapshot_size_threshold: 1MB                                            │
│   优点：控制快照存储空间                                                        │
└─────────────────────────────────────────────────────────────────────────────────┘

Orion 快照配置:
  PipelineRun: snapshot_interval: 50,   snapshot_retention: 10
  Approval:    snapshot_interval: 20,   snapshot_retention: 5
  Order:       snapshot_interval: 100,  snapshot_retention: 20
```

### 5.4 快照存储结构

```sql
CREATE TABLE aggregate_snapshots (
    snapshot_id       UUID PRIMARY KEY,
    aggregate_type    VARCHAR(128) NOT NULL,
    aggregate_id      VARCHAR(128) NOT NULL,
    aggregate_version INTEGER NOT NULL,
    snapshot_data     JSONB NOT NULL,
    event_ids         JSONB NOT NULL,
    created_at        TIMESTAMPTZ DEFAULT NOW,
    expires_at        TIMESTAMPTZ,
    
    UNIQUE (aggregate_type, aggregate_id, aggregate_version),
    INDEX idx_aggregate_lookup (aggregate_type, aggregate_id, aggregate_version DESC)
);
```

---

## 六、死信队列架构 (Dead Letter Queue Architecture)

### 6.1 DLQ 整体架构

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           死信队列架构                                           │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌───────────────┐
                                    │   Producer    │
                                    └───────┬───────┘
                                            │
                                            ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                              NATS JetStream                                  │
  │  ┌───────────────────────────────────────────────────────────────────────┐  │
  │  │                        Main Queue                                      │  │
  │  │  orion.pipeline.run.started                                            │  │
  │  │  orion.approval.request.created                                        │  │
  │  └───────────────────────────────────────────────────────────────────────┘  │
  │                              │                                              │
  │                              │ 消费失败 (重试 N 次后)                          │
  │                              ▼                                              │
  │  ┌───────────────────────────────────────────────────────────────────────┐  │
  │  │                        Dead Letter Queue                               │  │
  │  │  orion.dlq.pipeline.run.started                                        │  │
  │  │  orion.dlq.approval.request.created                                    │  │
  │  └───────────────────────────────────────────────────────────────────────┘  │
  └─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │     DLQ Processing Service    │
              │  ┌─────────┐  ┌─────────────┐│
              │  │ 告警通知 │  │ 人工处理台  ││
              │  └─────────┘  └─────────────┘│
              └───────────────────────────────┘
```

### 6.2 DLQ Stream 配置

| DLQ Stream | 对应主队列 | 保留策略 | 最大字节 | 用途 |
|------------|------------|----------|----------|------|
| `orion-dlq-pipeline` | `orion-pipeline` | 30 天 | 10GB | Pipeline 失败事件 |
| `orion-dlq-approval` | `orion-approval` | 30 天 | 5GB | 审批失败事件 |
| `orion-dlq-deployment` | `orion-deployment` | 30 天 | 10GB | 部署失败事件 |
| `orion-dlq-audit` | `orion-audit` | 90 天 | 20GB | 审计失败事件 |

### 6.3 失败处理流程图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           失败处理流程                                           │
└─────────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐
  │   Consumer   │
  └──────┬───────┘
         │
         │ 1. 接收事件
         ▼
  ┌──────────────┐
  │   业务处理   │
  └──────┬───────┘
         │
    ┌────┴────┐
    │         │
  成功       失败
    │         │
    ▼         ▼
  Ack    ┌───────────────┐
         │  重试决策     │
         │               │
         │ retry_count < │
         │ max_retries?  │
         └───────┬───────┘
                 │
       ┌─────────┴─────────┐
       │                   │
      是                   否
       │                   │
       ▼                   ▼
 ┌───────────┐       ┌───────────┐
 │ 指数退避  │       │ 转入 DLQ  │
 │ 1s,2s,4s  │       │ • 保留    │
 │ ...       │       │   原始消息│
 └───────────┘       │ • 附加    │
                     │   失败信息│
                     └──────┬────┘
                            │
                            ▼
                     ┌───────────┐
                     │ 触发告警  │
                     │ • P1 告警  │
                     │ • 通知    │
                     │   负责人  │
                     └───────────┘
```

### 6.4 重试策略

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `max_retries` | 10 | 最大重试次数 |
| `initial_interval` | 1s | 初始重试间隔 |
| `max_interval` | 300s | 最大重试间隔 |
| `multiplier` | 2.0 | 退避倍数 |
| `randomization` | 0.1 | 随机因子（避免雪崩） |

**重试间隔序列**: 1s → 2s → 4s → 8s → 16s → 32s → 64s → 128s → 256s → 300s

### 6.5 DLQ 处理策略

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DLQ 处理策略                                           │
└─────────────────────────────────────────────────────────────────────────────────┘

处理方式:
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 1. 自动重试 (Auto Retry)                                                        │
│    适用：临时故障（网络抖动、服务重启）                                          │
│    策略：定时将 DLQ 事件重新投递回主队列                                          │
│    配置：retry_interval: 5min, max_auto_retries: 3                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 2. 人工处理 (Manual Review)                                                     │
│    适用：业务逻辑错误、数据问题                                                  │
│    流程：DLQ → 管理后台 → 人工分析 → 手动重试/丢弃                               │
│    工具：DLQ 查询界面、事件详情查看、手动重试按钮                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 3. 批量处理 (Batch Processing)                                                  │
│    适用：同类错误批量修复                                                        │
│    策略：按事件类型/错误码分组 → 批量重试/批量丢弃                               │
│    场景：Schema 升级后批量重试、数据修复后批量处理                                │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 七、事件审计 (Event Auditing)

### 7.1 事件审计数据流图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           事件审计数据流                                         │
└─────────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │  业务模块    │     │  事件网关    │     │  审计服务    │     │  审计存储    │
  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
         │                    │                    │                    │
         │ 1. 业务操作        │                    │                    │
         │───────────────────▶│                    │                    │
         │                    │                    │                    │
         │                    │ 2. 事件标准化      │                    │
         │                    │ • CloudEvents 格式  │                    │
         │                    │ • 添加审计字段      │                    │
         │                    │───────────────────▶│                    │
         │                    │                    │                    │
         │                    │                    │ 3. 审计日志写入     │
         │                    │                    │───────────────────▶│
         │                    │                    │                    │
         │                    │                    │ 4. 异步归档        │
         │                    │                    │───────────────────▶│
         │                    │                    │                    │
         │                    │ 5. 发布到审计主题   │                    │
         │                    │─────────────────────────────────────────▶│
         │                    │                    │                    │

审计字段:
  • actor_id: 操作人 ID
  • action: 操作类型 (CREATE/UPDATE/DELETE)
  • resource_type: 资源类型
  • resource_id: 资源 ID
  • before: 变更前数据 (UPDATE/DELETE)
  • after: 变更后数据 (CREATE/UPDATE)
  • client_ip: 客户端 IP
  • user_agent: 用户代理
  • timestamp: 操作时间
```

### 7.2 审计查询场景

| 查询场景 | 查询条件 | 输出 |
|----------|----------|------|
| **用户操作历史** | `actor_id = "user-123"` | 该用户的所有操作 |
| **资源变更历史** | `resource_type = "Pipeline", resource_id = "pipe-456"` | Pipeline 的完整变更链 |
| **时间范围审计** | `timestamp BETWEEN '2026-04-01' AND '2026-04-30'` | 指定时间段内所有操作 |
| **敏感操作审计** | `action = "DELETE" OR action = "EXPORT"` | 删除/导出等敏感操作 |
| **合规审计** | `resource_type = "Approval" AND status = "APPROVED"` | 审批合规检查 |

---

## 八、事件压缩策略 (Event Compression)

### 8.1 事件压缩策略图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           事件压缩策略                                           │
└─────────────────────────────────────────────────────────────────────────────────┘

压缩策略对比:
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 策略 1: 状态快照 (State Snapshot)                                                │
│ ┌─────────────────────────────────────────────────────────────────────────────┐│
│ │ 原始事件流 (100 个事件) → 状态快照@100 → 删除前 100 个事件                      ││
│ │                                                                              ││
│ │ 适用：状态明确、事件量大的聚合根                                             ││
│ │ 压缩比：100:1 (100 个事件 → 1 个快照)                                           ││
│ └─────────────────────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────────────────┤
│ 策略 2: 事件合并 (Event Merging)                                                │
│ ┌─────────────────────────────────────────────────────────────────────────────┐│
│ │ 原始事件：StageUpdated(x=1), StageUpdated(x=2), ..., StageUpdated(x=10)      ││
│ │ 合并后：StageUpdatedBatch(x=1..10)                                          ││
│ │                                                                              ││
│ │ 适用：高频更新、中间状态不重要的场景                                         ││
│ │ 压缩比：10:1                                                                  ││
│ └─────────────────────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────────────────┤
│ 策略 3: 增量编码 (Delta Encoding)                                               │
│ ┌─────────────────────────────────────────────────────────────────────────────┐│
│ │ 原始事件：{version:1, status:"a"}, {version:2, status:"b"}, {version:3, status:"c"} ││
│ │ 增量编码：{version:1, status:"a"} + {Δv:1, Δs:"b"}, {Δv:1, Δs:"c"}          ││
│ │                                                                              ││
│ │ 适用：事件间差异小的场景                                                     ││
│ │ 压缩比：3:1                                                                   ││
│ └─────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘

存储优化效果:
  原始事件：50TB/年
  快照 + 压缩：15TB/年 (节省 70%)
```

---

## 九、监控指标 (Monitoring Metrics)

### 9.1 核心监控指标

| 指标名称 | 类型 | 说明 | 告警阈值 |
|----------|------|------|----------|
| `event_latency_seconds` | Histogram | 事件从发布到消费的延迟 | P99 > 1s |
| `event_replay_duration_seconds` | Histogram | 事件回放耗时 | P99 > 5min |
| `event_dlq_size` | Gauge | 死信队列积压消息数 | > 100 |
| `event_dlq_rate` | Counter | 死信队列进入速率 | > 10/min |
| `event_rebuild_success_rate` | Gauge | 状态重建成功率 | < 99% |
| `event_snapshot_age_seconds` | Gauge | 最新快照的年龄 | > 1 hour |
| `event_archive_lag_seconds` | Gauge | 归档延迟 | > 5min |
| `event_schema_compatibility_errors` | Counter | Schema 兼容性错误数 | > 0 |

### 9.2 监控面板

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        Orion Event Bus Dashboard                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐              │
│  │   事件吞吐量 (events/s)      │  │   事件处理延迟 (P50/P95/P99) │              │
│  │         [折线图]            │  │         [折线图]            │              │
│  └─────────────────────────────┘  └─────────────────────────────┘              │
│                                                                                 │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐              │
│  │   DLQ 积压 (messages)         │  │   回放成功率 (%)           │              │
│  │         [柱状图]            │  │         [仪表盘]           │              │
│  └─────────────────────────────┘  └─────────────────────────────┘              │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        事件类型分布 (Top 10)                             │   │
│  │                           [条形图]                                      │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 9.3 告警规则

```yaml
alert_groups:
  - name: event-sourcing-alerts
    rules:
      - alert: HighDLQSize
        expr: event_dlq_size > 100
        for: 5m
        severity: P1
        annotations:
          summary: "DLQ 积压超过阈值"
          
      - alert: HighEventLatency
        expr: histogram_quantile(0.99, event_latency_seconds) > 1
        for: 5m
        severity: P2
        annotations:
          summary: "事件处理延迟过高"
          
      - alert: LowRebuildSuccessRate
        expr: event_rebuild_success_rate < 0.99
        for: 10m
        severity: P2
        annotations:
          summary: "状态重建成功率低于 99%"
          
      - alert: ArchiveLagHigh
        expr: event_archive_lag_seconds > 300
        for: 5m
        severity: P3
        annotations:
          summary: "事件归档延迟超过 5 分钟"
```

---

## 十、附录 (Appendix)

### 10.1 术语表

| 术语 | 定义 |
|------|------|
| **Event Sourcing** | 将系统状态建模为事件序列的架构模式 |
| **CQRS** | 命令查询职责分离，常与事件溯源配合使用 |
| **Aggregate** | 一组相关对象的领域概念，作为事件的归属 |
| **Projection** | 从事件流派生的读取模型 |
| **Upcast** | 将旧版本事件转换为新版本的迁移过程 |
| **DLQ** | Dead Letter Queue，死信队列，存储处理失败的消息 |
| **Idempotency** | 幂等性，同一操作执行多次结果相同 |

### 10.2 参考文档

- [CloudEvents Specification v1.0](https://github.com/cloudevents/spec/blob/v1.0/spec.md)
- [NATS JetStream Documentation](https://docs.nats.io/nats-concepts/jetstream)
- [Martin Fowler - Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html)
- [NATS 事件总线功能设计](./NATS 事件总线功能设计.md)

### 10.3 变更历史

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| v1.0 | 2026-04-10 | Orion Architecture Team | 初始版本 |

---

## 十一、实施路线图 (Implementation Roadmap)

### 11.1 实施阶段划分

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           事件溯源实施路线图                                     │
│                      Event Sourcing Implementation Roadmap                       │
└─────────────────────────────────────────────────────────────────────────────────┘

Phase 1: 基础建设 (Week 1-4)
├── Week 1-2: NATS JetStream 集群部署
│   ├── 部署 3 节点 NATS JetStream 集群
│   ├── 配置 Stream 和 Consumer
│   └── 验证集群高可用性
├── Week 3-4: 事件存储层开发
│   ├── 实现事件追加写入
│   ├── 实现事件查询 API
│   └── 集成 CloudEvents 格式
│
Phase 2: 核心功能 (Week 5-8)
├── Week 5-6: 事件回放服务
│   ├── 时间点回放实现
│   ├── 条件回放实现
│   └── 幂等性保证机制
├── Week 7-8: 状态重建服务
│   ├── 快照机制实现
│   ├── 状态重建算法
│   └── 投影更新逻辑
│
Phase 3: DLQ 与监控 (Week 9-12)
├── Week 9-10: 死信队列系统
│   ├── DLQ Stream 配置
│   ├── 重试策略实现
│   └── 管理后台开发
├── Week 11-12: 监控告警
│   ├── Prometheus 指标暴露
│   ├── Grafana Dashboard 配置
│   └── 告警规则配置
│
Phase 4: 试点上线 (Week 13-16)
├── Week 13-14: Pipeline 模块试点
│   ├── Pipeline 事件迁移
│   ├── 灰度发布验证
│   └── 性能基准测试
├── Week 15-16: 审批模块上线
│   ├── 审批事件迁移
│   ├── 全量发布
│   └── 运维培训
```

### 11.2 各阶段验收标准

| 阶段 | 验收项 | 验收方法 | 通过标准 |
|------|--------|----------|----------|
| **Phase 1** | NATS 集群高可用 | 故障演练 | 单节点故障<30s 恢复 |
| **Phase 1** | 事件写入延迟 | 压测 | P99 < 50ms |
| **Phase 2** | 事件回放正确性 | 回放测试 | 100% 事件正确重放 |
| **Phase 2** | 状态重建准确性 | 对比测试 | 重建状态与当前状态一致 |
| **Phase 3** | DLQ 捕获率 | 故障注入 | 100% 失败事件进入 DLQ |
| **Phase 3** | 告警准确率 | 告警演练 | 无误报、无漏报 |
| **Phase 4** | Pipeline 试点 | 灰度验证 | 零故障运行 7 天 |
| **Phase 4** | 审批模块上线 | 全量验证 | 零故障运行 14 天 |

### 11.3 风险评估与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| **数据一致性** | 高 | 中 | 双写过渡期 + 对账任务 |
| **性能下降** | 中 | 中 | 基准测试 + 缓存优化 |
| **学习曲线** | 中 | 高 | 培训 + 示例代码 |
| **存储成本** | 低 | 中 | 压缩 + 分层存储 |
| **运维复杂度** | 中 | 中 | 自动化部署 + 监控完善 |

---

## 十二、最佳实践 (Best Practices)

### 12.1 事件设计原则

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           事件设计最佳实践                                       │
└─────────────────────────────────────────────────────────────────────────────────┘

✅ DO - 推荐做法:
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 1. 使用过去时态命名事件                                                         │
│    • UserCreated (正确) vs CreateUser (错误)                                   │
│    • OrderPlaced (正确) vs PlaceOrder (错误)                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 2. 事件名应反映业务含义                                                         │
│    • PaymentCompleted (好) vs StatusChanged (模糊)                              │
│    • ApprovalRejected (好) vs DecisionMade (模糊)                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 3. 事件应包含完整的上下文信息                                                    │
│    {                                                                             │
│      "userId": "u-123",         // 谁                                           │
│      "action": "approve",       // 做了什么                                      │
│      "resource": "order-456",   // 对什么                                       │
│      "reason": "budget-ok",     // 为什么                                       │
│      "timestamp": "..."         // 何时                                         │
│    }                                                                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 4. 事件应该是不可变的                                                            │
│    • 发布后永不修改                                                              │
│    • 需要修正时发布新事件 (如：OrderCancelled 修正 OrderCreated)                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 5. 使用有意义的聚合根 ID                                                         │
│    • order-order-123 (好) vs id-123 (差)                                       │
│    • 便于追踪和调试                                                              │
└─────────────────────────────────────────────────────────────────────────────────┘

❌ DON'T - 避免做法:
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 1. 不要在事件中包含敏感数据                                                      │
│    • 密码、信用卡号、身份证号                                                    │
│    • 如需要，使用引用或加密                                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 2. 不要设计过大的事件                                                            │
│    • 单一职责，一个事件只做一件事                                                 │
│    • 大事件拆分为多个小事件                                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 3. 不要依赖事件的顺序处理 (除非必要)                                              │
│    • 使用版本号或条件检查                                                        │
│    • 避免严格的时序依赖                                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 4. 不要在事件中存储计算结果                                                      │
│    • 计算结果应存储在投影中                                                      │
│    • 事件只记录原始事实                                                          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 12.2 故障排查 Checklist

```
事件溯源故障排查清单:

问题 1: 事件丢失
□ 检查 NATS Stream 保留策略
□ 检查消费者 Ack 模式
□ 查看 NATS 服务器日志
□ 验证事件 ID 唯一性

问题 2: 状态不一致
□ 检查事件处理顺序
□ 验证幂等性实现
□ 查看是否有重复事件
□ 执行状态重建验证

问题 3: 回放失败
□ 检查 Schema 兼容性
□ 验证 Upcast 函数
□ 查看目标服务状态
□ 检查消费者健康状态

问题 4: DLQ 积压
□ 分析 DLQ 事件错误类型
□ 检查消费者日志
□ 验证业务逻辑
□ 执行批量重试或人工处理

问题 5: 性能下降
□ 检查事件存储大小
□ 验证快照策略
□ 查看消费者并发度
□ 优化查询索引
```

### 12.3 常见问题解答 (FAQ)

**Q1: 事件溯源适合所有场景吗？**

A: 不适合。事件溯源适合以下场景：
- 需要完整审计轨迹（金融、医疗）
- 需要状态回溯能力（审批、配置）
- 需要复杂业务分析（用户行为）

简单 CRUD 场景建议使用传统方式。

**Q2: 如何处理事件 Schema 的 Breaking Change？**

A: 三种策略：
1. 提供 Upcast 函数，在回放时转换
2. 并行支持多版本，逐步迁移
3. 提前通知，设置废弃时间表

**Q3: 快照应该多久创建一次？**

A: 取决于：
- 事件量：事件越多，快照越频繁
- 重建性能要求：要求越高，快照越频繁
- 存储成本：快照占用存储，需平衡

推荐：每 50-100 个事件或每小时创建一次。

**Q4: 如何保证事件处理的顺序？**

A: NATS JetStream 保证：
- 同一 Subject 内消息顺序
- 使用 FIFOObservable 消费者

跨 Subject 不保证顺序，需要业务层处理。

**Q5: 事件溯源的存储成本有多高？**

A: 取决于事件频率和保留策略：
- 原始事件：~1KB/事件
- 年事件量：1000 万 × 1KB = 10GB
- 压缩后：约 3-5GB/年

通过分层存储和压缩可降低成本 70% 以上。

---

## 十三、评审检查清单 (Review Checklist)

### 13.1 架构评审

| 检查项 | 状态 | 备注 |
|--------|------|------|
| 事件溯源适用场景分析 | □ | |
| 存储分层设计合理性 | □ | |
| 快照策略可行性 | □ | |
| DLQ 设计完整性 | □ | |
| 监控指标覆盖度 | □ | |

### 13.2 技术评审

| 检查项 | 状态 | 备注 |
|--------|------|------|
| NATS Stream 配置优化 | □ | |
| Schema 版本化设计 | □ | |
| Upcast 迁移方案 | □ | |
| 幂等性保证机制 | □ | |
| 重试策略合理性 | □ | |

### 13.3 运维评审

| 检查项 | 状态 | 备注 |
|--------|------|------|
| 部署方案可行性 | □ | |
| 监控告警完整性 | □ | |
| 故障恢复流程 | □ | |
| 备份恢复策略 | □ | |
| 容量规划合理性 | □ | |

---

_文档版本：v1.0 | 创建日期：2026-04-10 | 状态：待评审 | 维护团队：Orion Platform Team_
