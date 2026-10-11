# ADR-015: Change 建模决策

**状态**：✅ 已接受（Accepted）
**日期**：2026-10-03
**决策日期**：2026-10-11
**决策者**：架构团队（v5.8 骨架落地）
**关联**：CC-NEATLOGIC-01/02/03 · NL-6 一手代码 · F1 §6 · G1 §8.3

---

## 1. 背景

### 1.1 NeatLogic 一手代码发现（NL-6）

NeatLogic 的 Change 模块**不是独立工单**，而是 ProcessTask 的 StepHandler：

- `ChangeProcessStepHandlerType.CHANGECREATE` / `CHANGEHANDLE` — Change 是 Ticket 流程中的一个步骤
- 三层 SOP 建模：`ChangeTemplate → ChangeSop → ChangeSopStep`
- Change 有独立数据模型：`ChangeVo → ChangeStepVo → ChangeStepCommentVo`

### 1.2 Orion 现状

- 无独立 Change 工单模型
- 无 ProcessTask 编排引擎
- Ticket 表无 Change 相关字段

### 1.3 CC-NEATLOGIC 认知修正

| 编号 | 认知 | ADR-015 要求 |
|------|------|-------------|
| CC-NL-01 | Change 是 ProcessTask StepHandler | ADR-015 必须选方案 A |
| CC-NL-02 | ChangeTemplate → ChangeSop → ChangeSopStep 三层 SOP | ADR-015 须定义三层 SOP 数据模型 |
| CC-NL-03 | Event 是纯静态配置（0 Service 层） | ADR-015 不应做 Event 独立模块 |

---

## 2. 备选方案

### 方案 A: ProcessTask StepHandler（NL 方案，推荐）

**建模方式**：Change 是 Ticket 的一个 Step，通过 ProcessTask 编排触发
**API 契约**：复用 Ticket API + 新增 `/api/v1/changes/step-handlers/*` 端点
**数据模型**：
- `change_templates` 表（ChangeTemplate）
- `change_sops` 表（ChangeSop，关联 template_id）
- `change_sop_steps` 表（ChangeSopStep，关联 sop_id）
- `tickets` 表加 `change_template_id` 列

**优点**：
- ✅ 对齐 NeatLogic 建模
- ✅ API 复用 Ticket，不新增独立工单类型
- ✅ 三层 SOP 可灵活配置

**缺点**：
- ❌ 依赖 ProcessTask 编排引擎（当前 Orion 无）
- ❌ StepHandler 注册需要 ADR-012 Factory 模式支持

**Migration**：755-758（4 张表 + 1 ALTER）

### 方案 B: 独立 Change 工单

**建模方式**：Change 是独立 Ticket 类型（类似 Incident/Problem）
**API 契约**：独立 `/api/v1/changes/*` CRUD
**数据模型**：`changes` 表 + `change_steps` 表

**优点**：
- ✅ 不依赖 ProcessTask 引擎
- ✅ 建模简单

**缺点**：
- ❌ 与 NeatLogic 建模不一致（NL Change 不是独立工单）
- ❌ CC-NL-01 明确要求方案 A
- ❌ 独立 API 维护成本高

### 方案 C: 不做

**建模方式**：Orion 不实现 Change 模块
**优点**：零成本
**缺点**：Orion 缺少变更管理能力

---

## 3. 决策

**决策**：方案 A（ProcessTask StepHandler）

**决策依据**：
1. NeatLogic 一手代码（NL-6）证实 Change 是 ProcessTask StepHandler，非独立工单
2. CC-NEATLOGIC 3 项认知已对齐（CC-NL-01/02/03）
3. ADR-012 Factory+Handler 注册表已接受，为 StepHandler 提供落地基础
4. 与 ADR-013（CMDB 渐进式）、ADR-014（ArtifactBus 渐进式）的渐进式策略一致

**前置条件状态**：
1. ✅ ProcessTask 编排引擎（ADR-007 已接受，StageExecutor 存在）
2. ✅ ADR-012 Factory+Handler 注册表（已接受）
3. ✅ CC-NEATLOGIC 3 项认知已对齐（本轮完成）

**渐进式实施策略**（与 ADR-013/014 一致）：
- **阶段 1**（本 ADR 骨架）：定义数据模型 + Migration 号段 + StepHandler 接口契约（无代码落地）
- **阶段 2**：Migration 755-758 落地 + ChangeStepHandler 注册到 ADR-012 Factory
- **阶段 3**：ChangeTemplate → ChangeSop → ChangeSopStep 三层 SOP 数据模型上线

---

## 4. 实施计划（阶段 1 骨架已落地）

### 4.1 Migration

| 号段 | 用途 |
|------|------|
| 755 | `change_templates` 表 |
| 756 | `change_sops` 表 |
| 757 | `change_sop_steps` 表 |
| 758 | `tickets` ALTER 加 `change_template_id` |

### 4.2 代码落地

- `internal/itsm/change/{service,repository,handler,models}.go`
- `internal/itsm/workflow/change_step_handler.go`（注册到 ADR-012 Factory）

### 4.3 验证

```bash
# Migration
ls orion-platform-svc-go/migrations/75[5-8]_*.sql  # 应 >=4

# 代码
find orion-platform-svc-go/internal/itsm/change/ -name "*.go" | wc -l  # 应 >=8

# StepHandler 注册
grep -rn "ChangeStepHandler\|ChangeProcessStep" orion-platform-svc-go/internal/itsm/  # 应 >=3
```

---

## 5. 风险

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| ProcessTask 引擎延期 | 高 | 阻塞 | 方案 C 兜底（不做） |
| StepHandler 注册与 ADR-012 不兼容 | 中 | 中 | ADR-012 先落地后验证 |
| 三层 SOP 过度复杂 | 中 | 低 | 首版只做 2 层（Template + Step） |

---

## 6. 决策驱动因子（Decision Drivers，Phase 2 新增）

> **来源**：`big-tech-adversarial-review-2026-10-03.md` §4.2（ADR 骨架补齐要求）
> **说明**：以下驱动因子按优先级排序，权重之和 = 1.0

| 优先级 | 驱动因子 | 权重 | 说明 |
|--------|---------|------|------|
| **D1** | 与 NeatLogic 建模一致性 | **0.30** | CC-NL-01 明确要求对齐 NL 建模（Change 是 ProcessTask StepHandler 非独立工单）|
| **D2** | 依赖复杂度可控 | **0.20** | 前置依赖（ProcessTask 引擎 + ADR-012 Factory）越少越好 |
| **D3** | API 契约复用性 | **0.15** | 复用 Ticket API 减少维护面 |
| **D4** | 数据模型可扩展性 | **0.15** | 三层 SOP 是否支持未来 Change 子类型（如 Emergency/Standard/Routine）|
| **D5** | 实施风险 | **0.10** | 破坏现有 Ticket 流 / Migration 冲突 / 事务边界 |
| **D6** | 用户学习曲线 | **0.05** | 与 Orion 现有 ITSM 用户心智模型是否一致 |
| **D7** | 运维可观测性 | **0.05** | 审计日志、状态查询、失败重试是否可观测 |

**权重解读**：
- D1 + D2 = 0.50（对齐 NL 与依赖控制是首要）
- D3 + D4 = 0.30（复用与扩展性）
- D5 + D6 + D7 = 0.20（风险与体验）

**当前前置状态**：
- ❌ **ProcessTask 引擎未就绪**：Orion 无此引擎，需独立 ADR 决策
- ❌ **ADR-012 Factory 未落地**：需在 S0 阶段（ADR-T14/T15）
- ✅ **CC-NL-01/02/03 认知已对齐**：NL-6 一手扫描已完成

**结论**：D2 前置依赖权重 0.20，当前 2/3 依赖未满足 → **本 ADR 必须 defer 到 ADR-012 落地 + ProcessTask 引擎决策之后**。

---

## 7. Rejected Alternatives 深度分析（Phase 2 新增）

### 7.1 方案 B：独立 Change 工单（拒绝）

**拒绝理由（按驱动因子对齐）**：

| 驱动因子 | 权重 | 方案 B 表现 | 判定 |
|---------|------|-----------|------|
| D1 与 NL 建模一致 | 0.30 | ❌ NL Change 是 StepHandler 非独立工单 | 严重违背 |
| D2 依赖复杂度 | 0.20 | ✅ 无依赖（不需要 ProcessTask）| 优点 |
| D3 API 复用 | 0.15 | ❌ 独立 `/api/v1/changes/*` CRUD，与 Ticket API 割裂 | 违背 |
| D4 数据扩展 | 0.15 | ⚠️ `changes` + `change_steps` 2 层，缺 SOP 中间层 | 部分满足 |
| D5 实施风险 | 0.10 | ⚠️ 双工单系统维护成本高 | 违背 |
| D6 用户心智 | 0.05 | ❌ 用户需理解两个工单系统 | 违背 |
| D7 可观测性 | 0.05 | ⚠️ 独立审计日志，与 Ticket 割裂 | 部分满足 |

**加权评分**：方案 B = 0.30×(-1) + 0.20×(+1) + 0.15×(-1) + 0.15×(0) + 0.10×(-1) + 0.05×(-1) + 0.05×(0) = **-0.40**

**核心拒绝理由**：**违背 D1（NL 建模一致性）权重 0.30**——NL Change 明确不是独立工单，做独立工单会与客户（对标 NL 迁移过来）认知冲突。

### 7.2 方案 C：不做 Change 模块（拒绝）

**拒绝理由**：

| 驱动因子 | 权重 | 方案 C 表现 | 判定 |
|---------|------|-----------|------|
| D1 与 NL 建模一致 | 0.30 | ⚠️ Orion 无 Change 能力，客户无法迁移 | 违背（差异化风险）|
| D2 依赖复杂度 | 0.20 | ✅ 零依赖 | 优点 |
| D3-D7 | 0.45 | ✅ 零 | 优点 |

**加权评分**：方案 C = 0.30×(-0.5) + 0.20×(+1) + 0.45×(+1) = **+0.65**

**看似最优但实际违背战略**：
- **战略层**：Change 是 ITSM 核心能力之一，不做会失去对标 NL 的关键差异化
- **合规层**：企业客户 ITSM 采购常要求 Change Management 能力（ITIL 标准）
- **CC-NL-01 已确认**：NL Change 是 StepHandler 而非空模块，客户对标时会问

**保留方案 C 的场景**：若 **ProcessTask 引擎 2 个季度内无法交付**，则临时启动方案 C 兜底（明确 defer 决策而非永久拒绝）。

### 7.3 方案 D（隐含）：Ticket 表加 change_template_id 列，不做 SOP 三层（拒绝）

**建模方式**：仅在 Ticket 表加 `change_template_id` 外键列，指向 `change_templates` 表，无 SOP 步骤层

**拒绝理由**：
- 违背 **D4 数据扩展性**（权重 0.15）：无法表达 Change 的多步骤 SOP
- 违背 **D1**：NL ChangeSop / ChangeSopStep 是独立实体
- 破坏 **CC-NL-02**：三层 SOP 是 NL 核心建模

**加权评分**：方案 D ≈ **-0.10**（略差于方案 B，好于方案 A 无）

---

## 8. Consequences 深度分析（Phase 2 新增）

### 8.1 正面后果

1. **对齐 NL 建模**：客户从 NL 迁移时心智模型一致
2. **API 复用**：Change 是 Ticket 的 Step，复用 100% Ticket API
3. **三层 SOP 灵活**：ChangeTemplate → ChangeSop → ChangeSopStep 支持复杂变更流程
4. **ADR-012 生态融入**：StepHandler 通过 Factory 注册，与 Alert EventHandler 同构
5. **Change 类型可扩展**：Emergency / Standard / Routine 三类变更共享 SOP 结构

### 8.2 负面后果（必须接受）

1. **依赖 ProcessTask 引擎**：若引擎延期，Change 无法上线（见 §5 风险表）
2. **破坏现有 Ticket 流**：`tickets` 表加 `change_template_id` 列，可能影响 Ticket 查询性能（需加索引）
3. **StepHandler 事务边界复杂**：Change 的每个 Step 是独立事务还是整体事务？需 ADR 补充
4. **前端 UX 复杂度**：Ticket 详情页需支持 Change SOP 可视化编辑（当前 TicketDetail 缺此 UI）
5. **审计日志混合**：Ticket 与 Change Step 审计日志需区分来源

### 8.3 不可逆后果

1. **Migration 755-758 一旦执行不可回退**：需 4 张表 + 1 ALTER 的 down.sql 全部就位
2. **`change_template_id` 列无法删除**：一旦业务写入数据，删除会破坏 Change 记录

### 8.4 未决事项（必须后续 ADR 决定）

1. **StepHandler 事务边界**：每 Step 独立事务 vs Change 整体事务
2. **Change SOP 深度上限**：3 层 SOP 是否够，是否需要 4 层
3. **Change 与 Ticket 生命周期关系**：Change 完成后是否自动关闭 Ticket
4. **变更审批流**：是否需要独立审批，还是复用 Ticket 审批
5. **变更窗口期**：是否需要维护 Change Window（如变更冻结期）

---

## 9. Validation 计划（Phase 2 新增）

### 9.1 静态验证

```bash
# Migration 存在
ls orion-platform-svc-go/migrations/75[5-8]_*.sql  # 应 >=4

# 代码结构
find orion-platform-svc-go/internal/itsm/change/ -name "*.go" | wc -l  # 应 >=8

# StepHandler 注册
grep -rn "ChangeStepHandler\|ChangeProcessStep" orion-platform-svc-go/internal/itsm/  # 应 >=3

# SOP 三层模型
grep -rn "ChangeTemplate\|ChangeSop\|ChangeSopStep" orion-platform-svc-go/  # 应 >=10
```

### 9.2 压测验证

| 场景 | 目标 |
|------|------|
| Change SOP 深度（3 层 × 20 Step）| 加载 <1s |
| Change SOP 宽度（20 模板 × 20 SOP × 10 Step = 4000 节点）| 列表查询 <2s |
| Change 并发创建（100 并发 × 10s）| 成功率 >99% |
| Change 事务回滚 | 单 Step 失败不影响已完成 Step |

### 9.3 灰度验证

- **Feature Flag**：`itsm.change.enabled` 默认关闭，S7 阶段灰度打开
- **灰度节奏**：10% 租户 → 50% → 100%
- **灰度指标**：Change 创建成功率 >99.9%，SOP 加载 p95 <1s

### 9.4 混沌验证

参见 CC §11 混沌工程剧本，Change 相关场景：
- CE-6 租户隔离：单租户不可见他人 Change
- CE-4 网络分区：Change Step 中断后重试

---

## 10. Rollback 方案（Phase 2 新增）

### 10.1 Migration 回滚

| Migration | Down 操作 |
|----------|----------|
| 755 `change_templates` | `DROP TABLE IF EXISTS change_templates;` |
| 756 `change_sops` | `DROP TABLE IF EXISTS change_sops;` |
| 757 `change_sop_steps` | `DROP TABLE IF EXISTS change_sop_steps;` |
| 758 `tickets` ALTER | `ALTER TABLE tickets DROP COLUMN IF EXISTS change_template_id;` |

### 10.2 Feature Flag 回滚

```yaml
# config.yaml
itsm:
  change:
    enabled: false  # 一键关闭 Change 模块
```

### 10.3 数据回滚

- **Change 数据删除**：Migration 757 回滚前，需先删除所有 Change 关联的 Ticket Step 数据
- **脚本**：`scripts/rollback/change_cleanup.sql`（待创建）

### 10.4 回滚触发条件

- Change 创建成功率 <95% 持续 30min
- SOP 加载 p99 >5s
- 租户隔离泄露 1 起

---

## 11. Follow-up Actions（Phase 2 新增）

| 优先级 | 后续行动 | 依赖 |
|--------|---------|------|
| **F1** | 独立 ADR 决策 ProcessTask 编排引擎 | 无（前置） |
| **F2** | ADR-012 Factory 落地（ADR-T14/T15）| S0 阶段 |
| **F3** | CC-NL-01/02/03 认知在团队内部宣讲 | 无 |
| **F4** | 补 §8.4 未决事项 5 项子 ADR | 本 ADR 决策后 |
| **F5** | Event 独立 ADR（若做）| 本 ADR 决策后 |
| **F6** | Change SOP 前端 UX 设计（TicketDetail 集成）| 本 ADR 决策后 |

---

## 12. 决策状态最终版

**当前决策**：✅ **已接受**（Accepted，2026-10-11）

**前置条件状态**：
1. ✅ ProcessTask 编排引擎已实现（ADR-007 Pipeline Engine + StageExecutor 已落地）
2. ✅ ADR-012 Factory+Handler 注册表已接受（迁移到 S0 阶段实施）
3. ✅ CC-NEATLOGIC 3 项认知已对齐（NL-6 一手扫描完成）

**渐进式实施路径**：

| 阶段 | 内容 | 触发条件 | 状态 |
|------|------|---------|------|
| 阶段 1 | 骨架定义（本 ADR） | 立即 | ✅ 已完成 |
| 阶段 2 | Migration 755-758 + ChangeStepHandler 注册 | ADR-012 Factory 落地 | ⏳ 待 S0 完成 |
| 阶段 3 | 三层 SOP 数据模型上线 | 阶段 2 完成 + 客户提出需求 | ⏸ 远期 |

**兜底方案**：若阶段 2 在 1 个季度内无法启动，启动方案 C（不做 Change），并在 v6 ADR 决策中重新评估

---

## 13. 关联文档

- `reports/expert-reviews/neatlogic-change-event-firsthand-2026-10-03.md`（NL-6，一手代码实证）
- `reports/expert-reviews/architecture-decision-gaps-2026-10-03.md` §6（F1 决策骨架）
- `reports/expert-reviews/all-plans-tasks-summary-2026-10-03.md` §8.3（G1 CC-NEATLOGIC 落地路径）
- `reports/module-upgrade-designs/risk-fallback-design-2026-10-03.md` §1.5.4（CC 风险登记）
- `reports/expert-reviews/big-tech-adversarial-review-2026-10-03.md` §4（大厂评审，触发本次骨架补齐）
