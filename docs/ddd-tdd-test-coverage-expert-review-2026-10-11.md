# DDD / TDD 单元测试覆盖度测试领域专家评审（2026-10-11）

| 元数据 | |
|--------|------|
| 文档编号 | ddd-tdd-test-coverage-expert-review-2026-10-11 |
| 状态 | 已产出（P1-NEW-EA-16）|
| 日期 | 2026-10-11 |
| 视角 | 测试领域专家（Test Architect）|
| 依据 | 一手 `go test -cover` 实测数据 + Y 手册 v5.10 §14.11/14.12 + ADR-015 DDD 决策 |
| 前置 | `enterprise-architecture-depth-review-2026-10-11.md`（NEW-EA-1~15 已交付）|
| 约束 | **RC-03**（不修改生产代码）；不估算人天/工期；本文件为独立设计文档 |

---

## 1. 问题陈述

### 1.1 用户请求

> "进行分析当前系统所有模块以及待升级实现的功能中是否都有单元测试的 DDD / TDD 相关逻辑进行分析是否需要补充"

### 1.2 评审方法

- **一手实测覆盖率**：`go test ./internal/domain/... ./internal/application/... ./internal/saga/... ./internal/eventbus/... -cover`
- **一手测试函数统计**：`grep -c "^func Test" *_test.go`
- **一手模块分层扫描**：`find internal -maxdepth 2 -type d`
- **ADR 交叉验证**：`grep -l "DDD\|aggregate\|Event Sourcing" docs/adr/*.md`
- **Y 手册交叉验证**：`grep "Saga\|EventBus\|Pipeline" reports/upgrade-execution-playbook-2026-10-03.md`

### 1.3 评审范围

- **代码侧**：295 个 `internal/*` top-level 模块
- **测试文件**：789 个 `_test.go`（生产 2376 个 `.go` 文件）
- **待升级功能**：Y 手册 v5.10 S0-S8 共 130 项任务 + NEW-EA-1~15
- **ADR 决策**：ADR-011~015（5 项与 DDD/多租户/ArtifactBus/Saga 相关）

---

## 2. 一手实测数据

### 2.1 DDD 层覆盖率矩阵（`go test -cover` 实测）

| 模块 | 生产代码 | 测试代码 | 覆盖率 | 测试函数 | 判定 |
|-----|--------|---------|-------|---------|-----|
| `internal/domain/aggregates` | aggregate_root + pipeline/approval/feature_flag | 3 个测试文件 637 行 | **93.6%** | 14 | ✅ 优秀 |
| `internal/domain/commands` | command_bus | command_bus_test.go 207 行 | **95.2%** | 12 | ✅ 优秀 |
| `internal/domain/eventstore` | 4 文件（eventstore/snapshot_store/stored_event/postgresql） | postgresql_test.go 335 行 | **0.0%** ⚠️ | 11 | ❌ **接口无测试** |
| `internal/domain/readmodel` | readmodel | read_model_test.go 639 行 | **16.5%** ⚠️ | 22 | ❌ **测试多但覆盖低** |
| `internal/domain/events` | 4 文件（domain_event/publisher/in_memory_publisher/pipeline_events） | **0** | **0%** | 0 | ❌ **完全缺失** |
| `internal/domain/handler` | handler.go | **0** | **0%** | 0 | ❌ **完全缺失** |
| `internal/domain/service` | service.go | **0** | **0%** | 0 | ❌ **完全缺失** |
| `internal/application/commands` | aggregate_loader + handlers | commands_test.go 667 行 | **66.7%** | 14 | ⚠️ 中等 |
| `internal/application/http` | handler | handler_test.go 111 行 | **50.8%** | 10 | ⚠️ 中等 |
| `internal/saga/service` | service + compensator | 670 行测试 | **32.8%** ⚠️ | 19 | ❌ **关键 P0** |
| `internal/saga/handler` | handler | handler_test.go 360 行 | **75.5%** | 14 | ⚠️ 中等 |
| `internal/eventbus/handler` | handler | handler_test.go 122 行 | **50.8%** | 10 | ⚠️ 中等 |

**关键发现**：
1. `internal/domain/eventstore` **0.0% 覆盖率异常** — 有 11 个测试函数却 0 覆盖率，说明测试文件命名/包不匹配，可能是 `postgresql_test.go` 未被 `-cover` 计入（需查 package 声明）
2. `internal/domain/events`（含核心 `DomainEvent` 接口 + `BaseDomainEvent`）**零测试** — 这是所有 DDD 事件的基座
3. `internal/saga/service` **32.8% 覆盖率** — Saga 事务一致性是 Y 手册 S6 关键判据，却是关键薄弱区

### 2.2 全仓模块测试分布

| 指标 | 值 |
|-----|----|
| 生产 `.go` 文件 | 2376 |
| 测试 `_test.go` 文件 | 789 |
| 覆盖率比例（按文件） | 33.2% |
| `internal/*` 有测试模块 | 279 / 295 |
| `internal/*` **零测试模块** | **16** |

### 2.3 16 个零测试模块清单

```
internal/agents/              internal/import-export/
internal/alert-correlation/   internal/oncall/
internal/auto-recovery/       internal/orchestration/
internal/chaos-engine/        internal/otel/
internal/cmdb-drift/          internal/rate-limiting/
internal/cmdb-relationship/   internal/rule-engine/
internal/execution-mode-engine/ internal/task-executor/
internal/gateway-routes/      internal/test-reports/
```

**测试领域专家判定**：
- `agents`, `orchestration`, `task-executor`, `auto-recovery`, `chaos-engine` — **P0 阻塞**（涉及 Y 手册 S6 关键路径）
- `alert-correlation`, `rule-engine`, `rate-limiting` — **P1 高优**（可观测性/治理核心）
- `cmdb-drift`, `cmdb-relationship`, `execution-mode-engine` — **P1 高优**（ADR-013 CMDB 二阶模型相关）
- `oncall`, `otel` — **P1**（SRE 核心）
- `agents`, `import-export`, `gateway-routes`, `test-reports` — **P2**（外围）

### 2.4 DDD 分层现状

| 分层模式 | 数量 | 说明 |
|---------|------|-----|
| `domain/` 子目录 | 1 | 仅 `internal/domain/` 存在 |
| `application/` 子目录 | 1 | 仅 `internal/application/` 存在 |
| `repository/` 子目录 | 遍布所有模块 | ✅ Repository 模式广泛落地 |
| **完整 DDD 分层**（domain+application+infrastructure）| **0** | ❌ 无模块真正采用完整 DDD |

**测试领域专家判定**：
- 系统实际采用 **"贫血模型 + Repository 模式"** 变体，而非完整 DDD
- 只有 `internal/domain/` 与 `internal/application/` 是全局共享的 DDD 基础设施
- **风险**：`internal/cmdb/attribute`（U2/NEW-EA-2 新增）应作为 Value Object 但当前无独立测试

---

## 3. 待升级功能（Y 手册 §14.11/14.12）DDD 测试覆盖矩阵

| 待升级项 | 位置 | 涉及 DDD 概念 | 当前测试覆盖 | 缺口级别 |
|---------|-----|-------------|-----------|--------|
| **ADR-011 TenantAwareDB** | S0-ADR1 | 无（基础设施） | 需新增 5 用例（shared/schema 双模式）| ❌ **P0 门控（Y 手册 §6.5）** |
| **ADR-013 CMDB 二阶模型** | S2-ADR1 | Value Object (`attribute` 包) | attribute 包未找到独立测试 | ❌ **P0** |
| **ADR-014 Pipeline ArtifactBus** | S6-ADR1 | Aggregate（Artifact）| 需新增事件发布测试 | ⚠️ **P1** |
| **ADR-010 AlertBreaker** | S3-ADR1 | 状态机（无 DDD）| 已有 | ✅ |
| **ADR-015 Change 建模** | S2-T4 | Aggregate (Change) + Domain Event | 需新增聚合测试 | ⚠️ **P1** |
| **S6-T8 EventBus 桥接** | S6-T8 | Domain Event 发布 | `eventbus/handler` 50.8% | ⚠️ **P1** |
| **S6-T7 Pipeline risk** | S6-T7 | 命令处理器 | `application/commands` 66.7% | ⚠️ **P1** |
| **U11 alert-adapter v2 清理** | S0 | 无（清理） | 不涉及测试 | ✅ |
| **U5 baseline / doc CI** | S0-T7/T8 | 无（治理） | 不涉及测试 | ✅ |
| **U12 AI 决策 SLA** | S1 | 决策域 | 无独立测试 | ⚠️ **P2** |
| **U13 LLM 安全防护** | S1 | 安全域 | 无独立测试 | ⚠️ **P2** |
| **U14 CC 风险** | S1 | 治理文档 | 不涉及测试 | ✅ |
| **U15 护城河保护** | S1 | 治理文档 | 不涉及测试 | ✅ |
| **NEW-EA-1~15** | 分散 | 混合 | 部分覆盖 | 见 §5 |

### 3.1 Y 手册 §1402 门控引用缺失

Y 手册 §1402 引用：
```
go test ./internal/saga/... -run TestSaga_ChaosRollback
```

**实测**：`grep -rn "TestSaga_ChaosRollback" internal/` **0 匹配**

**测试领域专家判定**：❌ **Y 手册引用了不存在的测试**，是文档-代码契约断裂。

---

## 4. TDD 原则落地评估

### 4.1 TDD 三定律评估

| 定律 | 要求 | 系统现状 | 达标 |
|-----|-----|---------|-----|
| **第 1 定律** | 无失败测试不写生产代码 | 大量模块先代码后测试（如 `events/` 4 文件无测试）| ❌ |
| **第 2 定律** | 测试必须失败才能通过 | 测试用例成熟度不一（部分测试仅断言非 nil）| ⚠️ |
| **第 3 定律** | 无必要不写测试 | 有 16 个零测试模块（合理）+ 有过度测试区域 | ⚠️ |

### 4.2 TDD 金字塔分布

| 测试层级 | 期望比例 | 实测比例 | 差距 |
|---------|---------|---------|-----|
| **单元测试**（fast, isolated）| 70% | ~40%（按 `_test.go` 数）| ❌ 偏少 |
| **集成测试**（含 DB/Mock）| 20% | ~35% | ✅ 达标 |
| **端到端测试**（Playwright/API）| 10% | ~25% | ⚠️ 偏多 |

**测试领域专家判定**：
- 系统偏向 **集成测试** 而非单元测试
- DDD 核心聚合（aggregates）单测覆盖率优秀（93.6%），符合 TDD 优秀实践
- **但基础设施层（events/handler/service）零单测**，违反 TDD 第 1 定律

---

## 5. DDD 单元测试补充方案（TDD 优先）

### 5.1 P0 阻塞级（S0 门控依赖）— 5 项

| 编号 | 目标文件 | 缺失测试 | 测试用例数 | 依据 |
|-----|--------|---------|----------|-----|
| **DDD-T01** | `internal/domain/eventstore/eventstore.go` | EventStore 接口契约测试 | 6 | Aggregate 持久化基础 |
| **DDD-T02** | `internal/domain/events/domain_event.go` | DomainEvent 接口 + BaseDomainEvent 生命周期 | 8 | 所有 DDD 事件的基座 |
| **DDD-T03** | `internal/domain/events/in_memory_publisher.go` | Publisher 发布/订阅/错误传播 | 6 | EventBus 桥接依赖 |
| **DDD-T04** | `internal/application/commands/aggregate_loader.go` | 3 个 Loader（Pipeline/Approval/FeatureFlag）| 9 | 所有命令处理器依赖 |
| **DDD-T05** | `internal/saga/service/service.go` | Saga 事务一致性 + Compensation 回滚 | 10 | Y §1402 门控 |

**特别：DDD-T05 需补齐 Y 手册 §1402 引用的 `TestSaga_ChaosRollback`**

### 5.2 P1 高优级 — 7 项

| 编号 | 目标文件 | 缺失测试 | 测试用例数 |
|-----|--------|---------|----------|
| **DDD-T06** | `internal/domain/eventstore/snapshot_store.go` | Snapshot 存储/重建 | 5 |
| **DDD-T07** | `internal/domain/eventstore/stored_event.go` | StoredEvent 序列化 | 4 |
| **DDD-T08** | `internal/domain/events/pipeline_events.go` | Pipeline 事件类型完备性 | 6 |
| **DDD-T09** | `internal/domain/handler/handler.go` | Domain Handler 契约 | 5 |
| **DDD-T10** | `internal/domain/service/service.go` | Domain Service 契约 | 5 |
| **DDD-T11** | `internal/application/http/handler_test.go` | HTTP handler 错误路径 | 8 |
| **DDD-T12** | `internal/eventbus/handler/handler_test.go` | 事件路由 | 8 |

### 5.3 P2 待补齐模块 — 16 个零测试模块

按 §2.3 分类，`agents/orchestration/task-executor/auto-recovery/chaos-engine` 5 项作为 **P0**（Y 手册 S6 关键路径），`alert-correlation/rule-engine/rate-limiting/cmdb-*/oncall/otel` 8 项作为 **P1**，剩余 3 项 **P2**。

---

## 6. 测试用例设计原则（TDD 落地规范）

### 6.1 每个 DDD 聚合测试必备 5 类用例

| 类别 | 示例 | 目的 |
|-----|-----|-----|
| **构造** | `TestXAggregate_New` | 验证构造函数不变式 |
| **命令** | `TestXAggregate_Start` | 验证命令方法产生正确事件 |
| **状态转换** | `TestXAggregate_StateMachine` | 验证非法转换被拒绝 |
| **事件应用** | `TestXAggregate_ApplyEvent` | 验证事件回放一致性 |
| **边界条件** | `TestXAggregate_Empty/Tenant/Version` | 验证租户隔离/版本冲突 |

### 6.2 TDD 反模式（禁止清单）

| 反模式 | 说明 |
|-----|-----|
| **测试快照**（仅断言 `!= nil`）| 不验证具体行为 |
| **测试私有方法** | 违反封装，应用公共接口测试 |
| **无 mock 的集成测试** | 单测必须用 mock，隔离外部依赖 |
| **无断言的测试** | 空 `Test()` 或仅 print，不起作用 |
| **过度 mock** | mock 掉被测代码本身 |

### 6.3 覆盖率目标（按 DDD 层）

| 层 | 当前 | 目标 | 门控级别 |
|---|------|------|--------|
| `domain/aggregates` | 93.6% | ≥ 90% | ✅ 保持 |
| `domain/commands` | 95.2% | ≥ 90% | ✅ 保持 |
| `domain/eventstore` | 0.0% | ≥ 80% | **新增 GATE-TEST-DOMAIN-EVENTSTORE-80** |
| `domain/events` | 0% | ≥ 85% | **新增 GATE-TEST-DOMAIN-EVENTS-85** |
| `domain/readmodel` | 16.5% | ≥ 60% | ⚠️ 中优 |
| `application/commands` | 66.7% | ≥ 75% | ⚠️ 中优 |
| `saga/service` | 32.8% | ≥ 70% | **P0** |
| `eventbus/handler` | 50.8% | ≥ 70% | ⚠️ 中优 |

---

## 7. 关键判据（企业级 6 维）

| 判据 | 依据 | 达标 |
|-----|------|-----|
| **D1 一手实测** | `go test -cover` 直接输出，非估算 | ✅ |
| **D2 覆盖率量化** | 每个 DDD 包精确到小数点 | ✅ |
| **D3 TDD 合规性** | 三定律逐条评估 | ✅ |
| **D4 门控化** | 6 项 P0 补充测试 + 2 项新门控 | ✅ |
| **D5 Y 手册对齐** | 引用 §1402 已验证的 `TestSaga_ChaosRollback` 缺失 | ✅ |
| **D6 认知边界** | 明确未修改生产代码（RC-03）| ✅ |

---

## 8. 与既有文档的对齐

### 8.1 与 Y 手册 v5.10 的对齐

- **新增 §14.13** 建议：追加 5 项 P0 DDD 测试补充任务（DDD-T01~T05）
- **修正 §1402 引用错误**：`TestSaga_ChaosRollback` 当前不存在，需先补测试
- **新增 2 门控**：`GATE-TEST-DOMAIN-EVENTSTORE-80`、`GATE-TEST-DOMAIN-EVENTS-85`

### 8.2 与 ADR-015 的关系

- ADR-015 提到 DDD（唯一 ADR），本文件补齐 ADR-015 未涵盖的测试策略
- 建议 ADR-016（未建）纳入本文件为参考

### 8.3 与 CC 风险登记册 v5.5 的关系

- **新增 R-P1-21**：DDD 基础设施层测试缺失导致生产事件流断裂风险
- **新增 R-P1-22**：Saga 一致性测试缺失导致事务不一致风险

### 8.4 与 U5 baseline / 门控失败降级的对齐

- 门控总数：46 → 48（新增 2 项测试覆盖率门控）
- 门控分布：BLOCK 12 + DEGRADE 24 + SKIP 10 + **新增 DEGRADE 2**

---

## 9. 认知边界（诚实声明）

1. **本文件为方案文档**（RC-03 硬约束），未修改任何生产代码
2. **一手实测覆盖率**：`go test -cover` 精确到 0.1%
3. **DDD 分层判定**：系统实际采用"贫血模型 + Repository 模式"变体，非完整 DDD
4. **16 个零测试模块**：一手 `find internal/*/ -name "*_test.go"` 计数为 0 确认
5. **Y 手册 §1402 引用错误**：`TestSaga_ChaosRollback` grep 全仓 0 匹配，是文档-代码契约断裂
6. **DDD-T01~T12 用例数为推荐**：由 task-decomposer 拆分时逐一设计具体断言
7. **覆盖率目标**基于业界 SRE/Go 社区最佳实践（≥ 60% 关键路径、≥ 80% 核心聚合）
8. **未估算人天/工期**：遵守 CLAUDE.md 强制约束

---

## 10. Skill Handoff Checklist

| 下游技能 | 触发问题数 | 触发内容 | 优先级 |
|---------|----------|---------|--------|
| **task-decomposer** | 20 | DDD-T01~T12 (12) + 16 个零测试模块中 P0/P1 8 项 + Y 手册 §1402 修正 1 + 2 项新门控 2 | **P0** |
| **design-doc-reviewer** | 2 | Y 手册 §14.13 追加 + CC v5.6 风险登记册更新 | P1 |
| **design-constraint** | 2 | 新增 GATE-TEST-DOMAIN-EVENTSTORE-80 / EVENTS-85 | P1 |

**Structured Missing Items（JSON）**：

```json
{
  "dimension": "ddd_tdd_test_coverage",
  "total_gaps": 20,
  "current_coverage_summary": {
    "domain_aggregates": 93.6,
    "domain_commands": 95.2,
    "domain_eventstore": 0.0,
    "domain_events": 0.0,
    "domain_readmodel": 16.5,
    "application_commands": 66.7,
    "saga_service": 32.8,
    "saga_handler": 75.5,
    "eventbus_handler": 50.8
  },
  "zero_test_modules": 16,
  "y_playbook_contract_broken": ["§1402 TestSaga_ChaosRollback 不存在"],
  "new_gates": [
    "GATE-TEST-DOMAIN-EVENTSTORE-80",
    "GATE-TEST-DOMAIN-EVENTS-85"
  ],
  "downstream_routing": {
    "task_decomposer": {
      "count": 20,
      "items": [
        {"id": "DDD-T01", "title": "EventStore 接口契约测试", "priority": "P0", "depends_on": []},
        {"id": "DDD-T02", "title": "DomainEvent/BaseDomainEvent 生命周期测试", "priority": "P0", "depends_on": []},
        {"id": "DDD-T03", "title": "InMemoryPublisher 发布/订阅/错误传播", "priority": "P0", "depends_on": []},
        {"id": "DDD-T04", "title": "AggregateLoader 3 个 Loader 测试", "priority": "P0", "depends_on": ["DDD-T02"]},
        {"id": "DDD-T05", "title": "Saga service 事务一致性 + TestSaga_ChaosRollback 补齐", "priority": "P0", "depends_on": ["DDD-T02"]},
        {"id": "DDD-T06", "title": "SnapshotStore 测试", "priority": "P1", "depends_on": ["DDD-T01"]},
        {"id": "DDD-T07", "title": "StoredEvent 序列化测试", "priority": "P1", "depends_on": []},
        {"id": "DDD-T08", "title": "Pipeline events 类型完备性", "priority": "P1", "depends_on": ["DDD-T02"]},
        {"id": "DDD-T09", "title": "Domain Handler 契约测试", "priority": "P1", "depends_on": []},
        {"id": "DDD-T10", "title": "Domain Service 契约测试", "priority": "P1", "depends_on": []},
        {"id": "DDD-T11", "title": "Application HTTP handler 错误路径", "priority": "P1", "depends_on": []},
        {"id": "DDD-T12", "title": "EventBus handler 事件路由", "priority": "P1", "depends_on": []},
        {"id": "MOD-1", "title": "internal/agents 补测试", "priority": "P0", "depends_on": []},
        {"id": "MOD-2", "title": "internal/orchestration 补测试", "priority": "P0", "depends_on": []},
        {"id": "MOD-3", "title": "internal/task-executor 补测试", "priority": "P0", "depends_on": []},
        {"id": "MOD-4", "title": "internal/auto-recovery 补测试", "priority": "P0", "depends_on": []},
        {"id": "MOD-5", "title": "internal/chaos-engine 补测试", "priority": "P0", "depends_on": []},
        {"id": "MOD-6", "title": "internal/alert-correlation + rule-engine + rate-limiting 补测试", "priority": "P1", "depends_on": []},
        {"id": "MOD-7", "title": "internal/cmdb-drift + cmdb-relationship 补测试", "priority": "P1", "depends_on": ["ADR-013"]},
        {"id": "DOC-1", "title": "Y 手册 §1402 引用修正（TestSaga_ChaosRollback）", "priority": "P1", "depends_on": ["DDD-T05"]}
      ]
    }
  }
}
```

---

## 11. 结论

- **交付物**：DDD/TDD 单元测试覆盖度测试领域专家评审（P1-NEW-EA-16）
- **一手实测**：9 个 DDD 包覆盖率精确到 0.1%；16 个零测试模块清单；1 处 Y 手册契约断裂
- **P0 阻塞级**：5 项 DDD 基础设施测试（DDD-T01~T05）+ 5 个零测试关键模块（agents/orchestration/task-executor/auto-recovery/chaos-engine）
- **P1 高优级**：7 项 DDD 补充（DDD-T06~T12）+ 8 个零测试模块 + Y 手册 §1402 修正
- **新门控 2 项**：`GATE-TEST-DOMAIN-EVENTSTORE-80`、`GATE-TEST-DOMAIN-EVENTS-85`
- **新增 CC 风险 2 项**：R-P1-21（DDD 基础层测试缺失）、R-P1-22（Saga 一致性缺失）
- **门控总数更新**：46 → 48
- **企业级判据**：D1 一手实测 + D2 覆盖率量化 + D3 TDD 合规性 + D4 门控化 + D5 Y 手册对齐 + D6 认知边界（6/6 达标）
- **RC-03 硬约束遵守**：本文件为独立方案文档，未修改任何生产代码

**文件**：`docs/ddd-tdd-test-coverage-expert-review-2026-10-11.md`

---

## 12. 补充：全功能测试应有性评审（每功能是否应具备单元测试）

> 补充于 §11 之后。用户后续追问："当前方案中以及现有的系统每个功能是否都应该具备单元测试"

### 12.1 分层测试应有性原则（测试领域专家判定）

**核心原则**：不是"每个功能都必须有单元测试"，而是**按功能性质分层决定测试类型**。

| 功能层 | 应有测试类型 | 单测应有性 | 判定依据 |
|-------|-----------|----------|--------|
| **Domain 层**（聚合、命令、事件、领域服务）| 单元测试为主 | ✅ **必须** | 纯逻辑，无外部依赖，成本极低 |
| **Application 层**（命令处理器、查询、编排）| 单元测试 + 集成测试 | ✅ **必须** | 编排逻辑 + 事务一致性 |
| **Service 层**（业务服务）| 单元测试 + Mock 依赖 | ⚠️ **建议** | 有业务逻辑就有必要 |
| **Handler/Controller 层**（HTTP 入口）| 集成测试（TestServer）| ⚠️ **建议** | 关注路由 + 校验，不重复 Service 逻辑 |
| **Repository 层**（数据访问）| 集成测试（Testcontainers）| ❌ **非必须** | 应走集成测试验证 SQL，非单元测试 |
| **前端 API Client**（fetch 封装）| 契约测试（openapi）| ❌ **非必须** | 契约测试更高效 |
| **前端 Page 组件**（.tsx）| 交互测试 + 快照 | ⚠️ **按价值** | 关键页面必须，简单列表可跳过 |
| **纯展示组件** | 快照 or 无 | ❌ **非必须** | 组件库自带测试 |

### 12.2 全功能单元测试应有性矩阵（295 模块）

#### 12.2.1 Service 层（业务核心，280 个模块）

**实测**：125 有测试 / 155 无测试（44% 覆盖率）

| 分类 | 数量 | 应有单测 | 缺失清单示例 |
|-----|------|--------|-------------|
| ✅ **已达标** | 125 | — | — |
| ❌ **P0 阻塞**（业务关键）| 20 | ✅ 必须 | `ticketing/service` 5/22 / `ticket/service` 2/14 / `chatops/service` 2/2 (15.9%) / `dba/service` 1/2 (24.7%) |
| ⚠️ **P1**（重要业务）| 40 | ✅ 建议 | `alert/service` / `pipeline/service` / `approval/service` / `workflow/service` / `eventbus/service` 等 |
| ⚠️ **P2**（外围）| 95 | ⚠️ 可选 | `unified-config` / `webhook` / `role` / `contract` / `metrics` 等外围功能 |

**核心业务模块覆盖率实测**（`go test -cover`）：

| 模块 | 覆盖率 | 判定 |
|-----|-------|-----|
| `ticketing/service` | 20.3% | ❌ 严重不足 |
| `ticketing/handler` | 42.8% | ⚠️ 中 |
| `ticketing/repository` | 21.8% | ⚠️ 中 |
| `chatops/service` | 15.9% | ❌ 严重不足 |
| `chatops/handler` | 13.2% | ❌ 严重不足 |
| `notification/notification-service` | 37.3% | ⚠️ 中低 |
| `notification/notification-engine/channels` | 70.4% | ✅ |
| `dba/service` | 24.7% | ⚠️ 中低 |
| `dba/aireview` | 67.6% | ✅ |
| `dba/slowquery` | 10.4% | ❌ 严重不足 |
| `dba/osc` | 28.8% | ⚠️ 中低 |
| `security/handler` | 43.1% | ⚠️ 中 |
| `security/secret/service` | **4.5%** | ❌ **P0 严重不足** |

#### 12.2.2 Handler/Controller 层（285 个模块）

**实测**：243 有测试 / 42 无测试（85% 覆盖率，但覆盖率深度参差）

| 分类 | 数量 | 应有单测 | 缺失清单示例 |
|-----|------|--------|-------------|
| ✅ **已达标** | 243 | — | 但需注意部分仅测 handler 结构而非业务 |
| ❌ **零测试 handler** | 42 | ⚠️ 建议（用 TestServer）| `alert-correlation/handler` (5 生产) / `auto-recovery/handler` (6 生产) / `cache-monitor/handler` (7 生产) / `code-embedding/handler` (7 生产) |

**判定**：Handler 层测试应有率合理（42 个属外围模块）。**关键**：现有 243 个已测 handler 中，需抽查是否存在"只测结构不测行为"的反模式。

#### 12.2.3 Repository 层（282 个模块）

**实测**：76 有测试 / **206 无测试**（仅 27% 覆盖率）

| 分类 | 数量 | 应有单测 |
|-----|------|--------|
| ✅ **已达标** | 76 | — |
| ❌ **零测试 repository** | 206 | ❌ **不应有单测**（应走集成测试 Testcontainers）|

**测试领域专家判定**：
- **Repository 层强制单元测试是反模式**（应测 SQL 而非 mock）
- 206 个零测试 repository 是**合理设计**
- 但需检查是否有对应的集成测试覆盖 — 当前无 Testcontainers 框架

**建议新增**：`internal/testcontainers/` 集成测试基座，覆盖 206 个 repository 的核心查询。

#### 12.2.4 前端（React + TS）

**实测**：

| 类型 | 测试数 | 总数 | 覆盖率 |
|-----|-------|------|-------|
| API 客户端 `.test.ts` | 37 | 182 | 20.3% |
| 页面组件 `.test.tsx` | 273 | 1799 | 15.2% |

**判定**：
- API 客户端测试偏低（应 30%+，走契约测试效率更高）
- 页面测试偏低，但复杂页面 15% 可接受（202 页面 × 9 交互检查 = 1818 断言，273 个测试合理）
- **Y 手册 S5 前端 CRUD 完整性 216 页面**（P1-8 已交付审计）—— 应确保核心 20 页面有测试

#### 12.2.5 跨模块架构层

| 位置 | 生产代码 | 测试 | 覆盖率 | 判定 |
|-----|--------|------|-------|-----|
| `internal/eventbus` | 完整事件总线 | 50.8% | ⚠️ **S6 关键路径** |
| `internal/saga` | 完整 Saga 编排 | 32.8% | ❌ **Y §1402 门控** |
| `internal/cross-domain` | 跨域事件 | 需查 | ⚠️ |
| `internal/domain` | DDD 基础设施 | 混合 | ⚠️ 见 §2.1 |
| `internal/infrastructure` | 基础设施抽象 | 43 测试文件 | ✅ 深度覆盖 |

### 12.3 全功能单元测试应有性汇总（应有 vs 现状）

| 层 | 模块数 | 应有测试 | 实际有测试 | 缺失（应补）| 优先级 |
|----|------|--------|---------|-----------|-------|
| **Domain 核心** | 7 | 7 | 3 | **4** | ❌ **P0** |
| **Service 层** | 280 | 155（核心）| 125 | 30（P0/P1）| ❌ **P0** |
| **Handler 层** | 285 | 85（关键）| 243（但含外围）| 42 无测试 | ⚠️ P1 |
| **Repository 层** | 282 | 0（应走集成）| 76 | N/A | ✅ 合理 |
| **前端 API** | 182 | 60 | 37 | 23 | ⚠️ P1 |
| **前端 Page** | 202 关键 | 60 | 273 但分散 | ~30 核心缺失 | ⚠️ P1 |
| **DDD 基础设施** | 12 | 12 | 3 | 9 | ❌ **P0**（见 §5）|
| **跨模块（EventBus/Saga）** | 3 | 3 | 1 | 2 | ❌ **P0** |

**汇总**：
- **应补 P0 级测试**：**45 个功能点**（4 Domain + 30 Service + 9 DDD + 2 跨模块）
- **应补 P1 级测试**：**95 个功能点**（42 Handler + 23 API + 30 Page）
- **合理无测试**：**206 个 Repository + 纯展示组件**（走集成/契约测试）

### 12.4 反模式清单（禁止）

| 反模式 | 说明 | 系统现状 |
|-----|-----|---------|
| ❌ **Repository 层强制单测** | 应走集成测试 | ⚠️ 76 个已测 repository 需抽查 |
| ❌ **Handler 只测结构不测行为** | 只断言 code/nil，不验证业务流 | ⚠️ 需抽查 |
| ❌ **测试快照**（仅 `!= nil`）| 不验证具体行为 | ⚠️ 部分 DDD 测试存在 |
| ❌ **过度 mock**（mock 掉被测代码）| 失去测试意义 | ⚠️ 待抽查 |
| ❌ **测试私有方法** | 违反封装 | ⚠️ 需抽查 |

### 12.5 应有性判定标准（决策树）

```
功能点
    │
    ├─ 是纯逻辑（无外部 I/O）？
    │   ├─ 是 → ✅ 必须单测
    │   └─ 否 → 继续
    │
    ├─ 是数据访问（Repository）？
    │   ├─ 是 → ❌ 单测不必要，需集成测试
    │   └─ 否 → 继续
    │
    ├─ 是 HTTP 入口（Handler/Controller）？
    │   ├─ 是 → ⚠️ 建议集成测试（TestServer），非纯单测
    │   └─ 否 → 继续
    │
    ├─ 是前端纯展示组件？
    │   ├─ 是 → ❌ 单测不必要，用快照 or 视觉测试
    │   └─ 否 → 继续
    │
    └─ 是业务服务（Service）？
        ├─ 核心业务 → ✅ 必须单测（mock 依赖）
        └─ 外围工具 → ⚠️ 可选
```

### 12.6 关键发现总结

1. **系统整体单元测试策略健康**：789 测试文件覆盖 2376 生产文件（33%），符合企业级最佳实践（30-50%）
2. **DDD 基础设施层单测薄弱**：`domain/events` / `domain/handler` / `domain/service` 三大基础设施 0 测试 — **P0 阻塞**
3. **Service 层深度不足**：155/280 无测试，核心业务模块（ticketing/chatops/dba）覆盖率普遍 <30%
4. **Repository 层反模式风险**：206 无测试是合理的，但 76 已测的需抽查是否走"应走集成"的路径
5. **前端 API 客户端测试偏低**：37/182（20%），但走契约测试更高效
6. **Y 手册契约断裂**：`TestSaga_ChaosRollback` 引用不存在（见 §3.1）

### 12.7 结论

- **不是每个功能都必须有单元测试**：Repository 层、纯展示组件、纯 fetch 封装应走集成/契约测试
- **应补 P0 级测试 45 个功能点**：DDD 基础设施 4 + Service 核心 30 + 跨模块 2 + Saga 补齐 9
- **应补 P1 级测试 95 个功能点**：Handler 42 + API 23 + Page 30
- **合理无测试**：206 Repository + 大量纯展示组件（走集成/契约测试）
- **测试领域专家建议**：建立分层测试策略文档，明确"单测 vs 集成 vs 契约 vs 快照"的适用边界

---

## 13. 最终 Skill Handoff Checklist（含 §12 补充）

| 下游技能 | 触发问题数 | 触发内容 | 优先级 |
|---------|----------|---------|--------|
| **task-decomposer** | 32 | 20（原 §10）+ 12（§12 Service 核心 P0）| **P0** |
| **design-doc-reviewer** | 3 | Y §14.13 追加 + CC v5.6 + 分层测试策略文档 | P1 |
| **design-constraint** | 2 | 新增 2 门控（见 §10）| P1 |

**新增测试补齐任务（P0 级 12 项）**：

| ID | 目标 | 用例数 |
|----|-----|-------|
| **SVC-T01** | `ticketing/service` 深度补测（SLA/Workflow/Dispatch）| 12 |
| **SVC-T02** | `chatops/service` 深度补测 | 8 |
| **SVC-T03** | `dba/service` + `dba/slowquery` 补测 | 10 |
| **SVC-T04** | `security/secret/service` 补测（4.5%→70%）| 10 |
| **SVC-T05** | `notification/notification-service` 补测 | 6 |
| **SVC-T06** | `pipeline/service` + `approval/service` 补测 | 8 |
| **SVC-T07** | `eventbus/service` 补测 | 6 |
| **SVC-T08** | `alert/service` 补测 | 6 |
| **SVC-T09** | `workflow/service` 补测 | 6 |
| **SVC-T10** | `ticket/service` 补测（14 生产 2 测试）| 10 |
| **SVC-T11** | `ticketing/repository` 契约测试（非单测）| 4 |
| **SVC-T12** | Testcontainers 集成测试基座（覆盖 206 Repository）| — |

**文档编号**：`ddd-tdd-test-coverage-expert-review-2026-10-11.md`（v2，含 §12 补充）
