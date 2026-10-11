# Orion 架构决策缺口盘点（F1，2026-10-03）

**范围**：盘点当前 ADR 清单 vs NeatLogic 架构哲学分析 vs v5 综合报告 CC 风险 → 识别仍需要 ADR 的关键决策点
**输入**：
- `docs/adr/` 目录 23 份 ADR（0001-0013 + ADR-002 到 ADR-010）
- `reports/expert-reviews/neatlogic-architecture-philosophy-2026-10-03.md`（692 行）
- `reports/expert-reviews/cross-review-synthesis-2026-10-03-v5.md`（1334 行，v5.1 后补）
- `reports/module-upgrade-designs/risk-fallback-design-2026-10-03.md`（v5.1 后补，51 风险）

---

## 0. TL;DR

- **ADR 覆盖度**：23 份 ADR 覆盖了基础设施层 + 关键模块，**但缺失 5 类关键决策**
- **仍需要的 ADR（5 项）**：
  1. **ADR-011** 多租户存储隔离（Schema-per-tenant vs Single-schema）
  2. **ADR-012** Factory+Handler 注册表模式（NL 100+ Handler 生态 vs Orion 直接 Service）
  3. **ADR-013** CMDB 二阶模型（Type/Template/Instance/Transaction 4 层 vs 现单层 CI）
  4. **ADR-014** Pipeline ArtifactBus 跨 stage 传播
  5. **ADR-015** Change 建模（ProcessTask StepHandler vs 独立 Ticket）
- **已决策**：ADR-010 AlertBreaker 并发模型（本轮新增）
- **不再需要**：Runner 多协议（v5 撤回）、Alert 5 家族选型（Migration 735-744 已定）

---

## 1. 现有 ADR 清单（23 份）

### 1.1 基础设施层（0001-0013，13 份）

| 编号 | 主题 | 状态 | 覆盖缺口 |
|------|------|------|---------|
| 0001 | Service 架构 | ✅ 已批准 | — |
| 0002 | Repository 模式 | ✅ 已批准 | — |
| 0003 | 事件驱动架构 | ✅ 已批准 | — |
| 0004 | 多租户 | ✅ 已批准 | ⚠️ **未决策存储隔离方案**（详见 ADR-011）|
| 0005 | CQRS | ✅ 已批准 | — |
| 0006 | Saga 补偿 | ✅ 已批准 | — |
| 0007 | Pipeline Engine | ✅ 已批准 | ⚠️ **未决策 ArtifactBus 传播**（详见 ADR-014）|
| 0008 | Feature Flag | ✅ 已批准 | — |
| 0009 | Gin 中间件 | ✅ 已批准 | — |
| 0010 | API Gateway | ✅ 已批准 | — |
| 0011 | OTel 可观测 | ✅ 已批准 | — |
| 0012 | Prometheus 监控 | ✅ 已批准 | — |
| 0013 | 微前端迁移 | ✅ 已批准 | — |

### 1.2 架构专项（014-015 + ADR-002 到 ADR-010）

| 编号 | 主题 | 状态 | 覆盖缺口 |
|------|------|------|---------|
| 014 | 后端技术栈迁移 | ✅ 已批准 | — |
| 015 | Phase5 Go 迁移 | ✅ 已批准 | — |
| ADR-002 | Plugin SPI | ✅ 已批准 | ⚠️ **未涉及 Factory 注册表模式** |
| ADR-003 | 成本数据采集 | ✅ 已批准 | — |
| ADR-004 | 备份恢复策略 | ✅ 已批准 | — |
| ADR-005 | 数据库选型 | ✅ 已批准 | — |
| ADR-006 | ClickHouse 集成 | ✅ 已批准 | — |
| ADR-008 | ProductLine CRD | ✅ 已批准 | — |
| ADR-009 | 依赖追踪 | ✅ 已批准 | — |
| **ADR-010** | **AlertBreaker 并发模型** | ✅ **本轮决策** | ✅ 完成 |

### 1.3 ADR 缺失盘点

| 缺失主题 | 依据 | 优先级 |
|---------|------|--------|
| **多租户存储隔离**（ADR-011）| NL-8 一手：Schema-per-tenant + ThreadLocal；ADR-004 只覆盖"多租户概念"未定存储 | P0 |
| **Factory+Handler 注册表**（ADR-012）| NL 一手 100+ Handler + 127 ThreadLocal 工厂；Orion 无对应模式 | P1 |
| **CMDB 二阶模型**（ADR-013）| NL-1 一手：Type/Template/Instance/Transaction 4 层；R-P0-07 阻塞 | P0 |
| **Pipeline ArtifactBus**（ADR-014）| R-P0-01 阻塞；artifact 跨 stage 传播决策 | P0 |
| **Change 建模**（ADR-015）| CC-NEATLOGIC-01：NL Change 是 ProcessTask StepHandler；Orion 若做独立工单会不一致 | P1 |
| ~~Runner 多协议~~ | ❌ v5 撤回（NL-8 一手证明 NL 也 0 实现）| — |
| ~~Alert 5 家族选型~~ | ❌ Migration 735-744 已定 | — |

---

## 2. ADR-011：多租户存储隔离（必需，P0）

### 2.1 决策背景

- **NeatLogic 一手证据**（NL-8）：使用 **Schema-per-tenant** + ThreadLocal `TenantContext.get()`（127 处）
- **Orion 现状**：ADR-004 定义了多租户概念，但**存储层默认 Single-schema + tenant_id 过滤**
- **风险**：数据量增长后 Single-schema 会有性能瓶颈 + 强隔离租户无法满足合规

### 2.2 备选方案

| 方案 | 隔离强度 | 复杂度 | 迁移成本 |
|------|---------|--------|---------|
| **A: Schema-per-tenant**（NL 方案）| ⭐⭐⭐⭐⭐ 强 | 高 | 需重写 Repository |
| **B: Single-schema + tenant_id**（Orion 现状）| ⭐⭐⭐ 中 | 低 | 无 |
| **C: Database-per-tenant** | ⭐⭐⭐⭐⭐⭐ 最强 | 极高 | 需管理 N 个 DB |
| **D: 混合模式**（大租户 Schema，小租户 Single）| ⭐⭐⭐⭐ 高 | 中 | 中 |

### 2.3 建议（初步，需 ADR-011 深入分析）

- **默认方案 B**（保持现状，不引入额外复杂度）
- **预留方案 D**（大客户/合规敏感场景可切 Schema）
- **不做方案 C**（运维复杂度过高）

---

## 3. ADR-012：Factory+Handler 注册表模式（必需，P1）

### 3.1 决策背景

- **NeatLogic 一手证据**：100+ Handler 通过 Factory 注册表分发（AlertEventHandlerFactory 25+ handler，TaskHandlerType 等）
- **Orion 现状**：直接 Service 调用（无统一注册表），扩展需硬编码 if-else 或 switch
- **痛点**：扩展新 TaskRunner/EventHandler 需修改主代码，违反开闭原则

### 3.2 备选方案

| 方案 | 扩展性 | 复杂度 | 生态 |
|------|--------|--------|------|
| **A: 全局 Factory 注册表**（NL 方案）| ⭐⭐⭐⭐⭐ | 中 | 高 |
| **B: 依赖注入 + Provider**（Spring 风格）| ⭐⭐⭐⭐ | 中 | 高 |
| **C: 直接 Service 调用**（Orion 现状）| ⭐⭐ | 低 | 低 |
| **D: Go plugins / 反射** | ⭐⭐⭐ | 高 | 低 |

### 3.3 建议（初步）

- **推荐方案 A**（对齐 NL 生态，长期可扩展）
- **实施范围**：Alert EventHandler / TaskRunner / Notification Channel 3 大场景先落地

---

## 4. ADR-013：CMDB 二阶模型（必需，P0）

### 4.1 决策背景

- **NeatLogic 一手证据**（NL-1）：Type → Template → Instance → Transaction 4 层模型
- **Orion 现状**：单层 CI（`cmdb_cis` 表），无 Type 抽象
- **风险**：R-P0-07 阻塞——若不做二阶模型，深度 CMDB 能力无法实现

### 4.2 备选方案

| 方案 | 建模深度 | 迁移成本 | 兼容性 |
|------|---------|---------|--------|
| **A: 4 层模型**（NL 方案）| ⭐⭐⭐⭐⭐ | 高 | 破坏现有 cmdb_cis |
| **B: 3 层模型**（Type + Instance + Transaction）| ⭐⭐⭐⭐ | 中 | 部分兼容 |
| **C: 2 层模型**（Type + Instance）| ⭐⭐⭐ | 低 | 兼容 |
| **D: 单层**（Orion 现状）| ⭐⭐ | 无 | 无新能力 |

### 4.3 建议（初步）

- **推荐方案 C**（渐进式引入 Type 抽象，保持 Instance 兼容）
- **不做方案 A**（破坏面太大，Migration 704 是 P0 风险）

---

## 5. ADR-014：Pipeline ArtifactBus（必需，P0）

### 5.1 决策背景

- **风险登记册 R-P0-01**：StageExecutor artifact 传播破坏现有 pipeline
- **需求**：跨 stage 的中间产物传递（构建产物、测试报告等）
- **Orion 现状**：StageExecutor 只跑单个 stage，无跨 stage 通信机制

### 5.2 备选方案

| 方案 | 传播方式 | 复杂度 | 可靠性 |
|------|---------|--------|--------|
| **A: 内存 ArtifactBus** | Go channel + map | 低 | 中（重启丢） |
| **B: PG 持久化 Artifact** | DB 表 + 消息队列 | 中 | 高 |
| **C: 对象存储**（S3/MinIO）| 外部存储 + 引用 | 中 | 高 |
| **D: 保持现状（不传播）**| 无 | 无 | — |

### 5.3 建议（初步）

- **推荐方案 B**（PG 持久化 + 消息队列，兼顾可靠性与性能）
- **降级路径**：若 B 实施复杂，先做方案 A（内存版），Feature flag 控制

---

## 6. ADR-015：Change 建模（可选，P1）

### 6.1 决策背景

- **CC-NEATLOGIC-01**：NeatLogic Change 是 ProcessTask StepHandler（`ChangeProcessStepHandlerType.CHANGECREATE/CHANGEHANDLE`）
- **Orion 现状**：无独立 Change 工单
- **风险**：若做独立 Change 工单，与 NL 建模不一致

### 6.2 备选方案

| 方案 | 建模方式 | API 契约 |
|------|---------|---------|
| **A: ProcessTask StepHandler**（NL 方案）| Change 是 Ticket 的一个 Step | API 复用 Ticket |
| **B: 独立 Change 工单** | Change 是独立 Ticket 类型 | 独立 API |
| **C: 不做** | — | — |

### 6.3 建议（初步）

- **推荐方案 A**（对齐 NL 建模，API 复用）
- **前提**：需要先有 ProcessTask 编排引擎（当前无）

---

## 7. ADR 决策矩阵总览

| ADR | 主题 | 优先级 | 阻塞级别 | 建议方案 | 实施成本 |
|-----|------|--------|---------|---------|---------|
| ADR-010 | AlertBreaker 并发模型 | P0 | ✅ 已决策 | 方案 A: PG 行锁 | — |
| **ADR-011** | **多租户存储隔离** | **P0** | 阻塞 S1/S2 | 方案 D: 混合（预留 B 现状）| 中 |
| **ADR-012** | **Factory 注册表** | **P1** | 不阻塞 | 方案 A: 全局 Factory | 中 |
| **ADR-013** | **CMDB 二阶模型** | **P0** | 阻塞 S1 | 方案 C: 2 层渐进 | 高 |
| **ADR-014** | **Pipeline ArtifactBus** | **P0** | 阻塞 S4 | 方案 B: PG + MQ | 中 |
| **ADR-015** | **Change 建模** | **P1** | 不阻塞 | 方案 A: ProcessTask Step | 低-中 |

---

## 8. ADR 产出优先级

**推荐执行顺序**（依赖关系）：

```
F2: ADR-011 多租户存储隔离     ── 基础层，无依赖
    ↓
F4: ADR-013 CMDB 二阶模型       ── 数据层，依赖 ADR-011
    ↓
F3: ADR-012 Factory 注册表     ── 扩展层，可与 ADR-013 并行
    ↓
F5: ADR-014 Pipeline ArtifactBus ── 引擎层，可与 ADR-012 并行
    ↓
ADR-015 Change 建模（可选）      ── 应用层，依赖 ProcessTask 引擎（暂不做）
```

---

## 9. 与执行阶段的衔接

ADR 决策完成后：

1. **AA 数据模型设计更新**：ADR-013 会调整 Migration 699-704（CMDB 二阶模型）
2. **BB 架构融入设计更新**：ADR-012 会影响 14 新模块融入方式
3. **CC 风险登记册更新**：ADR-013/014 决策后 R-P0-07/01 降级
4. **执行手册更新**：Stage Gate 门控按 ADR 决策调整

---

## 10. 决策记录

- **本盘点**：F1（架构决策缺口盘点）
- **产出**：5 个新 ADR 需求（011-015）
- **下一步**：F2 启动 ADR-011（多租户存储隔离）

---

**文档编号**：`architecture-decision-gaps-2026-10-03.md`
**关联文档**：
- ADR 目录：`docs/adr/`（23 份 → 预期 28 份）
- v5 综合：`cross-review-synthesis-2026-10-03-v5.md` §16
- 风险登记册：`risk-fallback-design-2026-10-03.md` §1.5
