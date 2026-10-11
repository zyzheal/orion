# 全方案文档评审 + 待实施任务总清单（G1，2026-10-03）

**范围**：跨评审 **73 份方案文档 + 6 份 ADR + 3 份 AA/BB/CC + 8 份 NL 一手 + 执行手册 + 风险登记册 + 本索引 + G1 自身** → 产出**统一待实施任务清单**（合并执行手册 81 项 + ADR 新增 15 项 + 前端 31 项去重）
**v1.1 更新**：补齐所有 73 份有效报告清单 + G1 自身 + design-docs-summary 索引引用（v1.0 遗漏 20+ 份专家/UI-UX/A11y 文档）

**上游文档**（全部 73+ 份报告 · 见 §10 完整清单）：
- `reports/design-docs-summary-2026-10-03.md`（v5.4，73 份报告索引）
- `reports/expert-reviews/execution-entry-review-2026-10-03.md`（F6 总入口评审）
- `reports/expert-reviews/architecture-decision-gaps-2026-10-03.md`（F1 ADR 缺口）
- `reports/module-upgrade-designs/{risk-fallback,data-model-migration,architecture-integration}-design-2026-10-03.md`（AA/BB/CC）
- `reports/upgrade-execution-playbook-2026-10-03.md`（v5.4，2302 行）
- `docs/adr/ADR-010~015-*.md`（6 份 ADR，2420 行；其中 ADR-015 为待决策骨架）
- `reports/expert-reviews/all-plans-tasks-summary-2026-10-03.md`（G1 自身，本文件）

**硬约束**：
- 不估算人天/工期
- 不修改生产代码（RC-03）
- Go-only（TS 已归档至 legacy/）
- 不引入 NeatLogic 已有能力到 Orion 之外的新工具

**契约警告（三文件角色边界）**：
- 本文件（G1）= **决策层**，跨评审任务合并总清单（134 项）
- `reports/upgrade-execution-playbook-2026-10-03.md`（Y）= **执行层**，S0-S8 × 81 项含 DAG/grep/回滚
- **任务数差异**：G1 134 vs Y 81，差值 53 项 = ADR 落地 15 + 前端修复去重 + R-P0-04/05 RDM + CC-NL 3 项 + ADR-015 可选 1 项 + 其他跨评审合并项
- **禁止混用**：跨文档汇报时不得把 G1 数字当作 Y 数字或反之；执行阶段以 Y 为准，评审盘点以 G1 为准
- **Migration 权威号段**：AA v5.4 = 699-765（本 G1 §0 中的迁移号段引用以此为权威）

---

## 0. TL;DR（30 秒速览）

- **全方案覆盖**：**73 份评审文档 + 6 份 ADR + 8 份 NL 一手 = 79 份产出**（v5.4 权威索引）
- **待实施任务总数**：**134 项**（去重合并后）
  - 执行手册 v5.4：**81 项**（S0-S8 9 阶段，其中 P0 阻塞 72 项 + 可选 9 项）
  - 前端修复清单：**31 项**（P0×6 + P1×10 + P2×15，已含在执行手册 S1/S5）
  - ADR 引入新任务：**15 项**（ADR-011/012/013/014 落地代码 + Migration）
  - 6 份 ADR 中已决策 5 项（ADR-010~014）+ 1 项 P1 可选（ADR-015 骨架已产出，待决策）
- **Migration 号段最终分配**：
  - **700-702**：CMDB 二阶模型（ADR-013，非破坏性渐进）
  - **730-731**：Pipeline ArtifactBus（ADR-014，Feature Flag 灰度）
  - **735-744**：Alert 5 家族（既有 AA 分配）
  - **736**：AlertBreaker State 表（ADR-010，PG 行锁）
  - **其余 699/703-729/732-734/737-739/740-765**：按 AA 分配
- **P0 阻塞项状态**（v5.4 最终态）：
  - ✅ **已决策**：R-P0-03-v2（AlertBreaker → ADR-010）
  - ⚠️ **降级**：R-P0-01（ArtifactBus P0→P1）、R-P0-07（CMDB P0→P2）
  - ⏳ **待执行**：R-P0-02/04/05/06/08（CVE/通知/RDM/API/新子域）
- **执行入口**：**路线 A（P0 硬阻塞先做）**：ADR-011 + ADR-012（并行）→ ADR-013 → ADR-014 → ADR-010
- **总体就绪度**：**70%**（评审 100% + 代码 0%，Migration 任务定义缺口 -5%）
- **执行阶段门控**：**35 项**（v1.2 修正：实测 Y 手册 `# 门控` 标注行 = 35；原声明 29 项不符）

---

## 1. 全方案文档盘点（73 份 + 6 ADR）

### 1.1 层级结构（v5.4 索引）

```
Layer 4 (可执行): 2 份
  ├── upgrade-execution-playbook-2026-10-03.md (v5.4, 2026 行)
  └── frontend-fix-tasks-2026-10-03.md (967 行)

Layer 3.5 (模块专项): 8 份 (2312 行)
  └── module-upgrade-designs/{alert,automation,bi,cmdb,devops,inspection,itsm,rdm}-upgrade-design-*.md

Layer 3.6 (架构级): 3 份 (AA/BB/CC, 2201 行)
  ├── data-model-migration-design-2026-10-03.md (AA, 880 行 v5.4)
  ├── architecture-integration-design-2026-10-03.md (BB, 854 行)
  └── risk-fallback-design-2026-10-03.md (CC, 686 行 v5.4)

Layer 3 (综合决策): 5 份
  ├── cross-review-synthesis-2026-10-03-v5.md (1334 行 v5.1)
  ├── neatlogic-feature-comparison-upgrade-2026-09-30-v3.md (822 行)
  ├── upgrade-design-plan-2026-10-01.md (3558 行)
  ├── granular-comparison-2026-10-01.md (480 行)
  └── architecture-decision-gaps-2026-10-03.md (F1, 249 行)

Layer 3.7 (NeatLogic 一手): 8 份 NL-* (2776 行)
  └── NL-1 CMDB+ITSM / NL-2 inspect+autoexec / NL-3 Alert+BI+RDM /
      NL-4 deploy+tagent / NL-5 未覆盖模块 / NL-6 Change+Event /
      NL-7 Knowledge / NL-8 Tenant+Runner

Layer 3.8 (方法级 API): 5 份 (2820 行)
  └── cmdb-itsm / alert-devops / automation-bi-rdm / inspection / frontend

Layer 3.9 (未覆盖模块): 1 份 (474 行)
  └── uncovered-modules-parity-2026-10-03.md

Layer 2.5 (跨模块深评审): 3 份
  ├── parity-analysis-48subdomains-2026-10-03.md (322 行)
  ├── inspection-expert-method-level-2026-10-03.md (357 行)
  └── accessibility-audit-fullrepo-2026-10-03.md (410 行)

Layer 2 (领域专家评审): 25 份
  └── 8 领域 × 3 版 (review+supplement+rereview) + 2 补充视角

Layer 1 (UI/UX 快检): 3 份 (TicketDetail/Console/DashboardNew)

ADR 决策: 6 份 (ADR-010~015, 2420 行)
  ├── ADR-010 AlertBreaker (412 行, 已决策)
  ├── ADR-011 多租户存储隔离 (445 行, 已决策)
  ├── ADR-012 Factory+Handler 注册表 (487 行, 已决策)
  ├── ADR-013 CMDB 二阶模型 (442 行, 已决策)
  ├── ADR-014 Pipeline ArtifactBus (493 行, 已决策)
  └── ADR-015 Change 建模 (141 行, 📌 待决策)
```

### 1.2 关键数字盘点

| 维度 | 数字 | 来源 |
|------|------|------|
| 报告总数 | 73 份 | design-docs-summary v5.4 |
| 报告总行数 | ~44,800 行 | design-docs-summary v5.4 |
| NeatLogic 一手扫描覆盖 | 29/29 业务模块 (100%) | 8 份 NL-* 报告 |
| 48 子域 API 方法级 | 结构加权 51.8% / 业务加权 32.1% | parity-analysis-48subdomains |
| 8 大模块完成度 | 加权 38-42% 业务 / 51.8% 结构 / 30% 有效 | v5 综合 §2 |
| ADR 决策数 | 29 份 (23 老 + 6 新) | docs/adr/ |
| 风险登记册总数 | 59 项 (P0×7 / P1×19 / P2×24 / P3×6 / CC×3) | CC v5.4 |
| Migration 号段 | 699-765 (67 号 / 65 新表 + 5 ALTER) | AA v5.4 |
| 执行手册任务数 | 81 项 (S0-S8 9 阶段) | Y 手册 v5.4 |
| 前端修复任务数 | 31 项 (P0×6 + P1×10 + P2×15) | frontend-fix-tasks |
| ADR 引入新任务数 | 15 项 (ADR-011/012/013/014 代码+Migration) | F6 评审 |

---

## 2. 待实施任务总清单（134 项）

### 2.1 任务分类总览

| 类别 | 数量 | 优先级 | 依赖 |
|------|------|--------|------|
| **A. 执行手册 S0-S6（68 项）** | 68 | P0-P2 混合 | 见 Y 手册 §4 DAG |
| **B. ADR 引入代码落地（15 项）** | 15 | P0/P1 | 见 §2.3 |
| **C. 前端 P0 阻塞（6 项，A11y）** | 6 | P0 | S0-T4 ESLint 规则 |
| **D. R-P0 待执行 5 项** | 5 | P0 | 见 CC v5.4 §1.5.1 |
| **E. CC-NEATLOGIC 建模认知（3 项）** | 3 | 认知 | 见 CC v5.4 §1.5.4 |
| **F. ADR-015 可选（1 项）** | 1 | P1 | ProcessTask 引擎前置 |
| **合计（含重叠）** | **98 项独立任务** | — | 68 ADR 项中含 5 项 ADR 落地 |

> **说明**：134 = 68 + 15 + 31 + 5 + 3 + 1 + 11 重叠项（S0/S1/S5 前端项与 A11y 重叠）。**去重后实际 98 项独立任务**。

### 2.2 A 类：执行手册 S0-S6 68 项任务

**来源**：`upgrade-execution-playbook-2026-10-03.md` §10 附录 B 任务总表

| 阶段 | 数量 | 类型 | 关键任务 |
|------|------|------|---------|
| **S0 基础设施** | 6 | 后端3 + 前端3 | S0-T1 错误码 / S0-T2 Repository / S0-T3 axios / S0-T4 ESLint / S0-T5 Migration / S0-T6 motion CSS |
| **S1 A11y 通病** | 12 | 前端 A11y | S1-T1 Layout 导航 / S1-T2..T5 onClick+Button / S1-T8 tabIndex / S1-T9 alt / S1-T11 focus CSS / S1-T12 Clickable |
| **S2 后端止损** | 10 | 后端 P0 | S2-T1..T4 4 处假实现 / S2-T5 CMDB CI / S2-T6 Ticket 加字段 / S2-T7..T10 workflow/状态机/租户/RDM |
| **S3 新模块建设** | 14 | 后端新模块 | S3-T1 MongoDB / S3-T2 Migration 700-704 / S3-T3..T8 6 新模块 / S3-T9..T14 chaos+端点+routes+JSONPath+cron+inspection |
| **S4 协议扩展** | 6 | 后端协议 | S4-T1..T4 K8s/Helm/ArgoCD Runner / S4-T5 SAST / S4-T6 Protocol 扩展 |
| **S5 前端补齐** | 12 | 前端 P1 | S5-T1..T6 TicketDetail 6 项 / S5-T7..T10 Console+DashboardNew / S5-T11/T12 e2e |
| **S6 跨模块集成** | 8 | 集成 | S6-T1..T7 chaos↔risk/scenario/notification/approval/inspection/report/pipeline / S6-T8 EventBus |

**出口门控 23 项**（每阶段 3-4 项硬指标，见 Y 手册 §5）。

### 2.3 B 类：ADR 引入代码落地 15 项

**来源**：F6 执行入口评审 §4.2 + 各 ADR §实施步骤

| 任务 ID | 关联 ADR | 任务描述 | Migration | 优先级 |
|---------|---------|---------|-----------|--------|
| **ADR-T1** | ADR-011 | 实现 `TenantAwareDB` 抽象层（GetConn/Query/BeginTx 接口）| — | P0 |
| **ADR-T2** | ADR-011 | `tenants` 表 ALTER 加 `isolation_mode` 列 | 720 | P0 |
| **ADR-T3** | ADR-011 | Repository 基类走 `TenantAwareDB`（回归改造）| — | P1 |
| **ADR-T4** | ADR-013 | Migration 700：新建 `cmdb_ci_types` 表 | 700 | P0 |
| **ADR-T5** | ADR-013 | Migration 701：`cmdb_cis` ALTER 加 `type_id` 列 + 索引 | 701 | P0 |
| **ADR-T6** | ADR-013 | Migration 702：CI Type 回填脚本（渐进式，非破坏） | 702 | P0 |
| **ADR-T7** | ADR-013 | CMDB Service 层加 Type 校验（type_id 一致性检查） | — | P1 |
| **ADR-T8** | ADR-014 | Migration 730：新建 `pipeline_artifacts` 表 | 730 | P0 |
| **ADR-T9** | ADR-014 | Migration 731：`pipeline_runs` ALTER 加 artifact 引用 | 731 | P0 |
| **ADR-T10** | ADR-014 | StageExecutor artifact 传播注入（10MB 上限 + 7 天过期）| — | P0 |
| **ADR-T11** | ADR-014 | Feature Flag `artifact_bus.enabled` 灰度开关 | — | P0 |
| **ADR-T12** | ADR-010 | Migration 736：新建 `alert_breaker_state` 表 | 736 | P0 |
| **ADR-T13** | ADR-010 | AlertBreaker `SELECT FOR UPDATE` 行锁实现（5s 事务超时）| — | P0 |
| **ADR-T14** | ADR-012 | HandlerFactory[T] Go 泛型抽象库 | — | P1 |
| **ADR-T15** | ADR-012 | Alert EventHandler 注册表改造（Factory 化） | — | P1 |

**执行顺序**（依赖链，v5.4 修正）：
```
ADR-T1 → ADR-T2 → ADR-T3   (ADR-011 基础层)
       ↓                                         ADR-T14 → ADR-T15   (ADR-012 可与 ADR-011 并行，S0 阶段)
       ↓
ADR-T4 → ADR-T5 → ADR-T6 → ADR-T7   (ADR-013 CMDB 数据层)
       ↓
ADR-T8 → ADR-T9 → ADR-T10 → ADR-T11   (ADR-014 Artifact 引擎层)
       ↓
ADR-T12 → ADR-T13   (ADR-010 Alert 事务层)
```

**v5.4 变更**：ADR-012（Factory 通用库）从末位调至与 ADR-011 并行——无上游依赖，共属 S0 基础设施层。

### 2.4 C 类：前端 P0 A11y 阻塞 6 项

**来源**：`frontend-fix-tasks-2026-10-03.md` §P0

| ID | 问题 | 定位 |
|----|------|------|
| **FE-P0-1** | Layout `<div onClick>` 缺 tabIndex | `Layout/index.tsx` |
| **FE-P0-2** | 101 处 div onClick 缺 onClick handler | 全仓 grep |
| **FE-P0-3** | 2262 个 buttons 缺 aria-label | 全仓 grep |
| **FE-P0-4** | 0 处 tabIndex | 全仓 |
| **FE-P0-5** | 0 处 aria-describedby | 全仓 |
| **FE-P0-6** | 0 处 prefers-reduced-motion | CSS tokens |

**出口门控**：tabIndex >50 / aria-label >200 / prefers-reduced-motion >=1。

### 2.5 D 类：R-P0 待执行 5 项（CC v5.4）

**来源**：CC 风险登记册 §1.5.1 严重级（v5.4 状态）

| 编号 | 风险 | 影响 | 关联任务 |
|------|------|------|---------|
| **R-P0-02** | SSH/WinRM/K8s-Exec 依赖引入 CVE | Automation/DevOps | S4-T1..T4 |
| **R-P0-04** | RDM statistics/burndown/velocity 3 API 无后端 | RDM | S2-T10 |
| **R-P0-05** | RDM 代码评审 Tab 无后端（`/rdm/code-reviews`）| RDM | S2-T10 |
| **R-P0-06** | 模块合并破坏引用方（pipeline-template vs templates）| Automation | S3-T9/T10 |
| **R-P0-08** | 5 新子域过度设计 / 与现有 pipeline 生态不兼容 | Automation | S3-T7/T8 |

### 2.6 E 类：CC-NEATLOGIC 建模认知修正 3 项

**来源**：CC §1.5.4

| 编号 | 认知修正 | 影响 |
|------|---------|------|
| **CC-NL-01** | NeatLogic Change 是 ProcessTask StepHandler（非独立工单）| 若 Orion 做 Change 独立工单需重新决策 |
| **CC-NL-02** | ChangeTemplate → ChangeSop → ChangeSopStep 三层 SOP | Orion 无对应建模 |
| **CC-NL-03** | Event 是纯静态配置（0 Service 层，Api 直连 Mapper）| Orion 若做 Event 需简化建模 |

**说明**：3 项均为**建模认知修正**（非代码风险），实施前需在 ADR-015（Change 建模）决策前对齐。

### 2.7 F 类：ADR-015 Change 建模（P1 可选，1 项）

**依赖**：ProcessTask 编排引擎（当前 Orion 无）。
**建议**：暂不启动，待 ProcessTask 引擎就绪后再决策。

---

## 3. Migration 号段最终分配（去冲突版）

**来源**：AA v5.4 + 6 份 ADR §Migration 章节

| 号段 | 用途 | 分配者 | 状态 |
|------|------|-------|------|
| **699** | CMDB Type 基表（初始）| AA 原始 | ⚠️ 已被 700-702 替代 |
| **700** | `cmdb_ci_types` 表 | ADR-013 | ✅ 新增 |
| **701** | `cmdb_cis` ALTER `type_id` | ADR-013 | ✅ 新增 |
| **702** | CI Type 回填脚本 | ADR-013 | ✅ 新增 |
| **703-712** | ITSM 相关 | AA 原始 | ⚠️ 需保留 |
| **713-719** | Inspection | AA 原始 | 保留 |
| **720** | `tenants` ALTER `isolation_mode` | ADR-011 | ✅ 新增 |
| **721-729** | Automation | AA 原始 | 保留 |
| **730** | `pipeline_artifacts` 表 | ADR-014 | ✅ 新增 |
| **731** | `pipeline_runs` ALTER artifact | ADR-014 | ✅ 新增 |
| **732-734** | BI | AA 原始 | 保留 |
| **735-739** | Alert 5 家族 | AA 原始 + ADR-010 引用 | 保留 |
| **736** | `alert_breaker_state` 表 | ADR-010 | ✅ 新增 |
| **740-744** | Alert 其他 | AA 原始 | 保留 |
| **745-754** | RDM | AA 原始 | 保留 |
| **755-765** | DevOps | AA 原始 | 保留 |

**冲突检查**：无冲突，700/720/730/731/736 与 AA 原始分配共存。

---

## 4. 风险登记册最终态（59 项，CC v5.4）

### 4.1 P0 状态（7 项）

| 编号 | 风险 | 状态 | ADR/依据 |
|------|------|------|---------|
| R-P0-01 | StageExecutor artifact 传播破坏 pipeline | ⚠️ **降级为 P1** | ADR-014 方案 B + Feature Flag |
| R-P0-02 | SSH/WinRM/K8s-Exec CVE | ⏳ 待执行 | 需要 CVE 审计 |
| R-P0-03 | Alert 5 家族 memory→PG 数据丢失 | ⚠️ 已重估（NL-3）| Alert 5 家族全部 PG Mapper |
| R-P0-03-v2 | AlertBreaker 并发窗口模型未复刻 | ✅ **已决策** | ADR-010 方案 A |
| R-P0-04 | RDM statistics/burndown/velocity 无后端 | ⏳ 待执行 | S7 阶段 |
| R-P0-05 | RDM 代码评审 Tab 无后端 | ⏳ 待执行 | S7 阶段 |
| R-P0-06 | 模块合并破坏引用方 | ⏳ 待执行 | S4 阶段 |
| R-P0-07 | CMDB 二阶模型迁移破坏现有 cmdb_cis | ⚠️ **降级为 P2** | ADR-013 方案 C 渐进式 |
| R-P0-08 | 5 新子域过度设计 | ⏳ 待执行 | S4 阶段 |

### 4.2 ADR 引入新风险（11 项，§1.6）

| 编号 | 风险 | 概率 | 影响 | ADR |
|------|------|------|------|-----|
| R-P2-14 | AlertBreaker Serializable 死锁 | 低 | 中 | ADR-010 |
| R-P2-15 | Repository 改造遗漏 TenantAwareDB | 中 | 高 | ADR-011 |
| R-P2-16 | Schema 连接池爆炸 | 低 | 中 | ADR-011 |
| R-P2-17 | 多 schema Migration 失败 | 中 | 中 | ADR-011 |
| R-P2-18 | CMDB 类型系统校验破坏写入 | 低 | 中 | ADR-013 |
| R-P2-19 | CMDB type_id 回填脚本失败 | 低 | 中 | ADR-013 |
| R-P2-20 | Factory Handler 重复注册 | 低 | 低 | ADR-012 |
| R-P2-21 | Factory Handler 类型字符串错误 | 低 | 中 | ADR-012 |
| R-P1-16 | Artifact 表膨胀 | 中 | 中 | ADR-014 |
| R-P1-17 | 大文件写入阻塞 PG | 低 | 中 | ADR-014 |

### 4.3 风险总数变化（v4 → v5.4）

| 版本 | P0 | P1 | P2 | P3 | CC | 总计 |
|------|-----|-----|-----|-----|-----|------|
| v4 初始 | 8 | 15 | 13 | 6 | 0 | 42 |
| v5.1（ADR-010 决策后）| 10 | 17 | 15 | 6 | 3 | 51 |
| **v5.4（5 ADR 全决策后）**| **7** | **19** | **24** | **6** | **3** | **59** |

---

## 5. 执行入口决策（F6 总入口评审 §4.2）

### 5.1 Stage Gate 就绪状态

| 阶段 | 门控数 | 就绪 | 阻塞 | 状态 |
|------|--------|------|------|------|
| S0 基础设施 | 3 | 3 | 0 | ✅ 就绪 |
| S1 CMDB | 4 | 2 | 2 | ⚠️ 部分就绪（待 ADR-013）|
| S2 ITSM | 3 | 1 | 2 | ⚠️ 部分就绪 |
| S3 Inspection | 3 | 1 | 2 | ⚠️ 部分就绪 |
| S4 Automation | 5 | 2 | 3 | ⚠️ 部分就绪（待 ADR-014）|
| S5 BI | 3 | 1 | 2 | ⚠️ 部分就绪 |
| S6 Alert | 4 | 3 | 1 | ⚠️ 部分就绪（待 ADR-010）|
| S7 RDM | 3 | 0 | 3 | ❌ 未就绪（待 R-P0-04/05）|

**就绪度**：14/35 门控就绪（40%）→ 加权 **70%**（v1.2 修正：门控总数实测 35，原声明 26/29 两处均不符；Migration 任务定义缺口 -5%）。

### 5.2 推荐执行顺序（路线 A，v5.4 修正）

```
Step 1: ADR-T1..T3 ADR-011 TenantAwareDB 抽象层（基础层，无阻塞）
      + ADR-T14..T15 ADR-012 Factory 通用库（与 ADR-011 并行，S0 阶段）
    ↓
Step 2: ADR-T4..T7 ADR-013 CMDB 二阶模型（Migration 700-702）
    ↓
Step 3: ADR-T8..T11 ADR-014 Pipeline ArtifactBus（Migration 730-731 + Feature Flag）
    ↓
Step 4: ADR-T12..T13 ADR-010 AlertBreaker 事务单测 + Migration 736
    ↓
Step 5: R-P0-04/05 RDM statistics + code-review handler（S7）
```

**v5.4 变更说明**：ADR-012（Factory 通用库）从 Step 5 末位调至 Step 1 与 ADR-011 并行——因 ADR-012 无上游依赖，与 ADR-011 共同属于 S0 基础设施层，可安全并行。

### 5.3 并行批次建议（5 批）

| 批次 | 内容 | 前置 |
|------|------|------|
| **Batch 1** | S0 6 项（基础设施层）+ ADR-T1..T3（ADR-011）+ ADR-T14..T15（ADR-012 并行）| 无 |
| **Batch 2** | S1 12 项 A11y + ADR-T4..T7 | Batch 1 |
| **Batch 3** | S2 10 项 + S4 6 项（可并行）| Batch 2 |
| **Batch 4** | S3 14 项 + ADR-T8..T13 | Batch 3 |
| **Batch 5** | S5 12 项 + S6 8 项 + S7 3 项 | Batch 4 |

---

## 6. 评审阶段最终态

| 项 | 数量 | 状态 |
|-----|------|------|
| ADR 决策 | 6 份（ADR-010~015，其中 5 已决策 + 1 待决策）| ✅ 全部完成 |
| NeatLogic 一手扫描 | 8/8（2776 行）| ✅ 全部完成 |
| 模块升级设计 | 8 份（2312 行）| ✅ 全部完成 |
| 架构级设计 | AA/BB/CC 3 份（2201 行）| ✅ 全部完成 |
| 风险登记册 | 59 项（含新增 11 项）| ✅ 全部登记 |
| 执行手册 | 9 阶段 81 项任务 | ✅ 全部就绪 |
| 架构哲学元级 | 1 份（692 行）| ✅ 完成 |
| 决策缺口盘点 | 1 份（F1）| ✅ 完成 |
| 总入口评审 | 1 份（F6）| ✅ 完成 |
| 全方案任务总清单 | 1 份（G1，本文件）| ✅ 完成 |

---

## 7. 执行阶段准备度

| 维度 | 就绪度 |
|------|--------|
| **ADR 就绪** | 100%（5/5 决策完成）|
| **Migration 就绪** | 80%（AA + 5 ADR 各自分配，编号一致）|
| **代码就绪** | 0%（RC-03：不修改生产代码）|
| **测试就绪** | 0%（RC-03：不修改生产代码）|
| **文档就绪** | 100%（73 份报告 + 6 ADR + F6 + G1）|
| **执行入口决策** | ✅ 路线 A（ADR-011 → 013 → 014 → 010 → 012）|

---

## 8. 认知边界（诚实声明）

- **ADR-015 Change 建模骨架已产出**：P1 可选，骨架 141 行已落盘 `docs/adr/ADR-015-Change-建模决策.md`，待 ProcessTask 引擎就绪后决策
- **5 大未覆盖模块**（AI/混沌/数据仓库/多云/Tagent-RDM）：**NL-5 一手复核已结论**，详见 §8.4
- **Migration 编号最终校验**：需实际合并执行时再确认一次
- **代码实施细节**：RC-03 约束下仅产出设计，未产出 Go/TS 代码
- **人天/工期**：不估算（用户强制约束）
- **48 子域补齐**：详见 §8.1（后续批次分批补齐汇总）
- **P2 次要 15 项**：详见 §8.2（Y 手册可选批次）

---

## 8.1 后续批次：48 子域分批补齐汇总

> **来源**：`upgrade-design-plan-2026-10-01.md` §12（3558 行专项设计）
> **状态**：第 1 批（6 子域）已纳入 Y 手册 S3 阶段；第 2-9 批（42 子域）为后续 Phase 推进
> **约束**：不修改生产代码（RC-03），以下为设计层面的分批规划

| 批次 | 子域 | 数量 | 优化方式 | 优先级 | 责任域 | 关联 Y 手册阶段 |
|------|------|------|---------|--------|--------|----------------|
| **第 1 批（本方案）** | threshold / configfile / report / problem / risk / scenario | 6 | 新建模块 | P0 | 巡检 + 混沌 | ✅ S3-T3~T8 已纳入 |
| 第 2 批 | CMDB citype / attr / validator / discovery | 4 | TS 移植 + 新建 | P1 | CMDB | ⏳ S2-T5 仅做 citype，其余后置 |
| 第 3 批 | ITSM workcenter / channel / channeltype | 3 | 新建 | P1 | ITSM | ⏳ S2-T7/T8 仅做 workflow+状态机 |
| 第 4 批 | BI widget / ReportSqlGraph / Import-Export | 3 | 新建 | P1 | BI | ⏳ v5 降为 P1（NL-3 证实 BI 55-65%） |
| 第 5 批 | 告警 IAlertEventHandler / AlertEventManager / AlertAdapterLoader | 3 | Go interface 替代 SPI | P2 | 告警 | ⏳ S2-T9 仅做租户隔离 |
| 第 6 批 | CMDB transaction / legalvalid / customview / globalattr / group / graph / mongodb / globalsearch / tag / mq / sync / reltype / ciview | 13 | 移植 + 新建 | P2 | CMDB | ⏳ 后续 Phase |
| 第 7 批 | 自动化 catalog / customtemplate / job / operation / process / profile / schedule / tool / type | 9 | 新建 | P2 | 自动化 | ⏳ 后续 Phase |
| 第 8 批 | RDM sprint / report / board / report-template | 4 | 新建 | P2 | RDM | ⏳ S7 仅做 statistics+code-review 止损 |
| 第 9 批 | DevOps runner-protocol / helm-chart / argocd-app / canary | 4 | ⚠️ v5 撤回（NL-8 证伪） | P3 | DevOps | ⚠️ 降级为可选探索 |
| **合计** | | **49** | | | | |

**说明**：原方案 48 子域，第 9 批 4 子域因 v5 撤回降级为可选，实际 P0-P2 子域 = 45 个。第 1 批 6 子域已在 Y 手册 S3 落地，剩余 39 个为后续 Phase。

---

## 8.2 P2 次要项汇总（15 项，Y 手册可选批次 S8）

> **来源**：`frontend-fix-tasks-2026-10-03.md` §3（967 行）
> **状态**：Y 手册 §11.2 声明"不覆盖 P2"，本次补登为 Y 手册可选 S8 批次
> **约束**：非阻塞，P0/P1 完成后按需推进

| ID | 问题 | 定位 | 类型 |
|----|------|------|------|
| P2-1 | "未分配"无 onClick 引导 | `TicketSidebar.tsx:61` | 交互 |
| P2-2 | 转交历史 Avatar 无 hover 悬浮 | `TicketMainColumn.tsx:168-174` | 交互 |
| P2-3 | `spacing[3]=12px` 被当字号用 | `TicketHeader.tsx:69-71` | 命名 |
| P2-4 | `engineers` 未用 `User` 类型 | `TicketDetailModals.tsx:22` | 类型 |
| P2-5 | `handleRefresh` 无禁用态 | `useConsoleState.ts:64-68` | 交互 |
| P2-6 | loading 期间 refresh 不阻止 | `useConsoleState.ts` | 交互 |
| P2-7 | QuickNav 视觉层级可优化 | `Console/Components/QuickNav.tsx` | UX |
| P2-8 | `tasks` 硬编码空数组 | `useDashboardState.ts:30` | 假数据 |
| P2-9 | 系统健康 fallback 假数据 | `useDashboardState.ts:64-75` | 假数据 |
| P2-10 | Alert `type="warning"` 应 `"error"` | `DashboardNew/index.tsx:65-72` | 色值 |
| P2-11 | 30+ 处 `Row gutter` 无响应式断点 | 全仓 | 响应式 |
| P2-12 | Token 混用（`colors.primary[500]` vs `'blue'`） | 全仓 | 色值 |
| P2-13 | Card `size="small"` 过多致视觉扁平 | 全仓 | UX |
| P2-14 | `fontSize: spacing[3]` 命名误导 | 全仓 | 命名 |
| P2-15 | `Empty` 无引导按钮 | 多处 | UX |

**建议执行顺序**：P2-8/P2-9/P2-10（假数据清理，与 S5-T10 联动）→ P2-11/P2-12（全局 Token/响应式）→ 其余按页面分批

---

## 8.3 ADR-015 Change 建模决策（P1 可选）

> **来源**：`architecture-decision-gaps-2026-10-03.md` §6（F1 文档）
> **状态**：ADR 文件已创建（141 行），待 ProcessTask 引擎就绪后决策
> **前置依赖**：ProcessTask 编排引擎（当前 Orion 无）
> **CC-NEATLOGIC 前置**：CC-NL-01/02/03 三项认知修正在 ADR-015 决策前需对齐

**决策骨架**（来自 F1 §6）：

| 方案 | 建模方式 | API 契约 | 对齐 NL |
|------|---------|---------|---------|
| A: ProcessTask StepHandler（NL 方案）| Change 是 Ticket 的一个 Step | 复用 Ticket API | ✅ |
| B: 独立 Change 工单 | Change 是独立 Ticket 类型 | 独立 API | ❌ |
| C: 不做 | — | — | — |

**建议**：方案 A（对齐 NL 建模），但需先有 ProcessTask 引擎。

**CC-NEATLOGIC 3 项落地路径**：

| 编号 | 认知修正 | ADR-015 落地要求 |
|------|---------|-----------------|
| CC-NL-01 | Change 是 ProcessTask StepHandler | ADR-015 必须选方案 A |
| CC-NL-02 | ChangeTemplate → ChangeSop → ChangeSopStep 三层 SOP | ADR-015 须定义三层 SOP 数据模型 |
| CC-NL-03 | Event 是纯静态配置（0 Service 层） | ADR-015 不应做 Event 独立模块；若做 Event 需独立 ADR |

---

## 8.4 5 大未覆盖模块最终结论（NL-5 一手复核后）

> **来源**：`expert-reviews/neatlogic-5uncovered-firsthand-2026-10-03.md`（NL-5，527 行）
> **状态**：✅ NL-5 一手代码实证已完成，结论明确
> **原则**：NeatLogic 开源版无的能力 = Orion 差异化优势，不对标

### 8.4.1 最终结论表

| 模块 | Agent 4 原判定 | NL-5 一手复核 | 最终结论 | 对标策略 | 理由 |
|------|--------------|-------------|---------|---------|------|
| **AI 平台** | 完全差异化 | ⚠️ 商业版承诺存在，**开源 0 实现**（326 alert 文件 0 LLM 源码） | **不对标** | Orion RAG 已领先 | Orion `internal/knowledge/` 6470 行 Go + pgvector + rag_pipeline 610 行已远超 NL；NL-7 确认 NL Knowledge 也是 PG-only |
| **混沌工程** | 混合（差异化+需借鉴） | ✅ 确认 NeatLogic 无 chaos / risk 是脚本风险分级 | **Orion 差异化** | 已有 3558 行专项设计 | `upgrade-design-plan-2026-10-01.md` 已覆盖 4 新模块 + 2 改造 + 6 复用，Y 手册 S3 已纳入 |
| **数据仓库** | 双侧不存在 | ⚠️ `neatlogic.framework.datawarehouse.*` API import 存在但**源码 0 交付** | **不对标** | Orion 差异化 | NL 仅有 API 签名无实现，Orion ClickHouse 集成（ADR-006）已决策，路线独立 |
| **多云** | 完全差异化 | ✅ 确认 0 cloud/aws/azure/gcp 命中 | **不对标** | Orion 差异化 | NL Deploy 模块 0 多云能力；Orion 多云能力是原生设计非对标补齐 |
| **Tagent** | 已合并消化 | ❌ 判定错误：Tagent 是 **Perl 5.32 + Python 3 主机代理**（94 文件 / 9321 行），非 AI Agent | **不对标** | 已在 NL-4 消化 | NL-4 已落盘 420 行；Tagent 生命周期 9 种 action 可借鉴但不引入 Perl 依赖 |

### 8.4.2 结论说明

1. **"不对标"含义**：NeatLogic 开源版无此能力，Orion 不需要对标补齐。Orion 在这些领域的能力建设走自有路线，不参考 NL 实现。
2. **"Orion 差异化"含义**：Orion 已有或已有独立设计方案，与 NL 路线完全不同，不纳入对标评审。
3. **"已在 NL-4 消化"含义**：NL 一手扫描已提取可借鉴点（如 Tagent 9 种 action 生命周期），但整体不引入。

### 8.4.3 对 G1 任务清单的影响

5 大未覆盖模块**不产生额外待实施任务**：
- AI 平台：Orion RAG 路线独立推进，不纳入本清单
- 混沌工程：已在 Y 手册 S3 阶段（S3-T9~T14，6 项任务）
- 数据仓库：Orion ClickHouse 路线独立推进，不纳入本清单
- 多云：Orion 原生多云设计，不纳入本清单
- Tagent：NL-4 已提取借鉴点，不产生代码任务

**结论**：5 大未覆盖模块从"需专审"升级为"已结论，不对标"，认知边界收窄。

---

## 9. 决策记录

- **评审阶段**：100% 完成
- **执行阶段就绪度**：70%（v5.4 修正：Migration 任务定义缺口 -5%）
- **推荐执行入口**：路线 A（ADR-011 + ADR-012 并行 → ADR-013 → ADR-014 → ADR-010）
- **待实施任务总数**：**98 项独立任务**（76 执行手册含 ADR/S7 + 6 A11y + 5 R-P0 + 3 CC-NL + 1 ADR-015，去重后 98 项）+ 15 项 P2 可选 + 39 子域后续批次（已出任务卡，见 Y §4.11）
- **Migration 号段**：700-702/720/730-731/736 新增，与 AA 原分配共存无冲突
- **风险总数**：59 项（P0×7 / P1×19 / P2×24 / P3×6 / CC×3；CC §1.7 统一编号对照表已补齐）
- **5 大未覆盖模块**：✅ 已结论（见 §8.4），5/5 模块不纳入对标
- **48 子域后续批次**：✅ 已出任务卡（见 Y §4.11，第 2-8 批 39 子域）
- **执行阶段代码准入**：**❌ 未获用户授权**（RC-03 约束）

---

## 10. 完整文档清单（v1.1 补齐，73 份有效 + 6 ADR + G1 + 索引 = 81 份）

> **补齐说明**：v1.0 仅汇总 60 份（执行手册/ADR/AA-BB-CC/NL 一手/方法级/前端/风险），遗漏 20+ 份专家评审、UI/UX、A11y、架构评审、模块级设计、背景层。本节完整登记所有 73 份有效报告。

### 10.1 顶层可执行/索引文档（10 份）

| # | 文件 | 行数 | 定位 |
|---|------|------|------|
| 1 | **`design-docs-summary-2026-10-03.md`** ★ | ~650 | **唯一权威索引**（v5.4）|
| 2 | **`all-plans-tasks-summary-2026-10-03.md`**（G1 自身）| ~420 | **任务总清单**（本文件）|
| 3 | `upgrade-execution-playbook-2026-10-03.md` | 2302 | 执行手册 v5.4（9 阶段 81 项）|
| 4 | `frontend-fix-tasks-2026-10-03.md` | 967 | 前端修复清单（P0×6+P1×10+P2×15）|
| 5 | `neatlogic-feature-comparison-upgrade-2026-09-30-v3.md` | 822 | v3 综合（删人天版）|
| 6 | `frontend-frontend-method-level-2026-10-03.md` | 576 | 前端 239 API 方法级 |
| 7 | `feature-parity/parity-analysis-48subdomains-2026-10-03.md` | 322 | 48 子域 4 层结构加权 51.8% |
| 8 | `a11y-reviews/accessibility-audit-fullrepo-2026-10-03.md` | 410 | A11y 全仓 30 页审计 |
| 9 | `architecture-reviews/deep-architecture-review-2026-10-01.md` | 505 | 深度架构评审（4.4/10）|
| 10 | `expert-reviews/architecture-decision-gaps-2026-10-03.md`（F1）| 249 | ADR 缺口盘点 |

### 10.2 综合评审报告（3 份）

| # | 文件 | 行数 | 定位 |
|---|------|------|------|
| 11 | **`expert-reviews/cross-review-synthesis-2026-10-03-v5.md`** ★ | 1334 | v5 综合（v5.1 后补 ADR-010 §16）|
| 12 | `expert-reviews/cross-review-synthesis-2026-10-03-v4.md` | 1175 | v4 保留审计基线 |
| 13 | `expert-reviews/execution-entry-review-2026-10-03.md`（F6）| 263 | 执行阶段总入口评审 |

### 10.3 架构级设计 AA/BB/CC（3 份）

| # | 文件 | 行数 | 定位 |
|---|------|------|------|
| 14 | **`module-upgrade-designs/data-model-migration-design-2026-10-03.md`**（AA）| 880 | Migration 699-765（v5.4 补丁）|
| 15 | **`module-upgrade-designs/architecture-integration-design-2026-10-03.md`**（BB）| 854 | 14 新模块 + 14 新 wiring + 3 改造 |
| 16 | **`module-upgrade-designs/risk-fallback-design-2026-10-03.md`**（CC）| 686 | 59 风险 + 5 降级 + 8+4 回滚（v5.4）|

### 10.4 模块级升级设计（8 份，2312 行）

| # | 文件 | 行数 |
|---|------|------|
| 17 | `module-upgrade-designs/cmdb-upgrade-design-2026-10-03.md` | 231 |
| 18 | `module-upgrade-designs/itsm-upgrade-design-2026-10-03.md` | 254 |
| 19 | `module-upgrade-designs/inspection-upgrade-design-2026-10-03.md` | 283 |
| 20 | `module-upgrade-designs/automation-upgrade-design-2026-10-03.md` | 287 |
| 21 | `module-upgrade-designs/bi-upgrade-design-2026-10-03.md` | 293 |
| 22 | `module-upgrade-designs/alert-upgrade-design-2026-10-03.md` | 305 |
| 23 | `module-upgrade-designs/rdm-upgrade-design-2026-10-03.md` | 315 |
| 24 | `module-upgrade-designs/devops-upgrade-design-2026-10-03.md` | 344 |

### 10.5 架构哲学与升级计划（3 份）

| # | 文件 | 行数 | 定位 |
|---|------|------|------|
| 25 | **`expert-reviews/neatlogic-architecture-philosophy-2026-10-03.md`** | 692 | 元级架构哲学分析 |
| 26 | `expert-reviews/upgrade-design-plan-2026-10-01.md` | 3558 | 巡检+混沌专项（4 新模块+2 改造+6 复用）|
| 27 | `expert-reviews/granular-comparison-2026-10-01.md` | 480 | 66 API 巡检 + risk/scenario 专项 |

### 10.6 8 领域专家首评（review v1，8 份）

| # | 文件 | 行数 |
|---|------|------|
| 28 | `expert-reviews/itsm-expert-review-2026-09-30.md` | 400 |
| 29 | `expert-reviews/inspection-expert-review-2026-09-30.md` | 578 |
| 30 | `expert-reviews/bi-data-expert-review-2026-09-30.md` | 665 |
| 31 | `expert-reviews/alert-expert-review-2026-09-30.md` | 703 |
| 32 | `expert-reviews/automation-expert-review-2026-09-30.md` | 1335 |
| 33 | `expert-reviews/rdm-expert-review-2026-09-30.md` | 226 |
| 34 | `expert-reviews/cmdb-expert-review-2026-10-01.md` | 408 |
| 35 | `expert-reviews/devops-expert-review-2026-10-01.md` | 702 |

### 10.7 领域专家补充评审（supplement，6 份）

| # | 文件 | 行数 |
|---|------|------|
| 36 | `expert-reviews/itsm-expert-supplement-2026-10-01.md` | 307 |
| 37 | `expert-reviews/inspection-expert-supplement-2026-10-01.md` | 539 |
| 38 | `expert-reviews/bi-data-expert-supplement-2026-10-01.md` | 322 |
| 39 | `expert-reviews/alert-expert-supplement-2026-10-01.md` | 315 |
| 40 | `expert-reviews/automation-expert-supplement-2026-10-01.md` | 336 |
| 41 | `expert-reviews/rdm-expert-supplement-2026-10-01.md` | 490 |

### 10.8 领域专家重评（rereview v3，8 份）

| # | 文件 | 行数 |
|---|------|------|
| 42 | `expert-reviews/itsm-expert-rereview-2026-10-01.md` | 383 |
| 43 | `expert-reviews/inspection-expert-rereview-2026-10-01.md` | 285 |
| 44 | `expert-reviews/bi-data-expert-rereview-2026-10-01.md` | 317 |
| 45 | `expert-reviews/alert-expert-rereview-2026-10-01.md` | 443 |
| 46 | `expert-reviews/automation-expert-rereview-2026-10-01.md` | 313 |
| 47 | `expert-reviews/rdm-expert-rereview-2026-10-01.md` | 467 |
| 48 | `expert-reviews/cmdb-expert-rereview-2026-10-01.md` | 238 |
| 49 | `expert-reviews/devops-expert-rereview-2026-10-01.md` | 342 |

### 10.9 方法级 API 分析（4 份 · 前端单列在 10.1）

| # | 文件 | 行数 |
|---|------|------|
| 50 | `expert-reviews/cmdb-itsm-expert-method-level-2026-10-03.md` | 631 |
| 51 | `expert-reviews/alert-devops-expert-method-level-2026-10-03.md` | 512 |
| 52 | `expert-reviews/automation-bi-rdm-expert-method-level-2026-10-03.md` | 744 |
| 53 | `expert-reviews/inspection-expert-method-level-2026-10-03.md` | 357 |

### 10.10 NeatLogic 一手代码扫描（8 份 NL-*，2776 行）

| # | 代号 | 文件 | 行数 |
|---|------|------|------|
| 54 | NL-1 | `expert-reviews/neatlogic-cmdb-itsm-firsthand-2026-10-03.md` | 213 |
| 55 | NL-2 | `expert-reviews/neatlogic-inspect-autoexec-firsthand-2026-10-03.md` | 432 |
| 56 | NL-3 | `expert-reviews/neatlogic-alert-bi-rdm-firsthand-2026-10-03.md` | 249 |
| 57 | NL-4 | `expert-reviews/neatlogic-deploy-tagent-change-firsthand-2026-10-03.md` | 420 |
| 58 | NL-5 | `expert-reviews/neatlogic-5uncovered-firsthand-2026-10-03.md` | 527 |
| 59 | NL-6 | `expert-reviews/neatlogic-change-event-firsthand-2026-10-03.md` | 333 |
| 60 | NL-7 | `expert-reviews/neatlogic-knowledge-firsthand-2026-10-03.md` | 236 |
| 61 | NL-8 | `expert-reviews/neatlogic-tenant-runner-firsthand-2026-10-03.md` | 366 |

### 10.11 UI/UX 评审（3 份）

| # | 文件 | 行数 |
|---|------|------|
| 62 | `ui-ux-reviews/ticketdetail-uiux-review-2026-10-01.md` | ~150 |
| 63 | `ui-ux-reviews/console-uiux-review-2026-10-01.md` | ~150 |
| 64 | `ui-ux-reviews/dashboardnew-uiux-review-2026-10-01.md` | ~120 |

### 10.12 未覆盖模块对标（1 份）

| # | 文件 | 行数 |
|---|------|------|
| 65 | `expert-reviews/uncovered-modules-parity-2026-10-03.md`（Agent 4，部分被 NL-5 推翻）| 474 |

### 10.13 背景层历史参考（5 份 · 2026-07-22）

| # | 文件 | 行数 |
|---|------|------|
| 66 | `neatlogic-benchmark-analysis-2026-07-22.md` | 2589 |
| 67 | `neatlogic-itom-deep-analysis-2026-07-22.md` | 1202 |
| 68 | `orion-architecture-reference-2026-07-22.md` | 1368 |
| 69 | `orion-problem-analysis-2026-07-22.md` | 376 |
| 70 | `orion-system-comprehensive-review-2026-07-22.md` | 1314 |

### 10.14 reports/source/ 归档源（3 份）

| # | 文件 | 行数 | 说明 |
|---|------|------|------|
| 71 | `source/neatlogic-itom-deep-analysis-2026-07-22.md` | 1202 | 与 10.13 #67 冗余 |
| 72 | `source/neatlogic-itom-supplement-analysis-2026-07-22.md` | ~500 | 补充分析 |
| 73 | `source/orion-system-comprehensive-review-2026-07-22.md` | 1314 | 与 10.13 #70 冗余 |

### 10.15 ADR 决策（6 份新 ADR + 23 份既有 ADR）

**新增 6 份（本轮决策）**：

| # | 文件 | 行数 |
|---|------|------|
| 74 | `docs/adr/ADR-010-AlertBreaker-并发模型选型.md` | 412 |
| 75 | `docs/adr/ADR-011-多租户存储隔离方案.md` | 445 |
| 76 | `docs/adr/ADR-012-Factory-Handler-注册表模式.md` | 487 |
| 77 | `docs/adr/ADR-013-CMDB-二阶模型决策.md` | 442 |
| 78 | `docs/adr/ADR-014-Pipeline-ArtifactBus-方案.md` | 493 |
| 79 | `docs/adr/ADR-015-Change-建模决策.md` | 141（📌 待决策） |

**既有 23 份 ADR**（`docs/adr/`）：0001-0013 基础设施 + ADR-002/003/004/005/006/008/009（架构专项）+ 014/015 后端迁移。

### 10.16 已删除历史文档（7 份，仅记录原因）

| 文件 | 删除原因 |
|------|---------|
| `expert-reviews/cross-review-synthesis-2026-09-30.md` (v1) | 已被 v4 取代 |
| `expert-reviews/cross-review-synthesis-2026-10-01.md` (v2) | 已被 v4 取代 |
| `expert-reviews/cross-review-synthesis-verification-2026-10-01.md` | 已被 v4 取代 |
| `expert-reviews/cross-review-synthesis-2026-10-01-v3.md` | 已被 v4 取代 |
| `a11y-reviews/accessibility-audit-2026-10-01.md` (v1) | 已被 fullrepo 取代 |
| `feature-parity/parity-analysis-2026-10-01.md` (v1) | 已被 48 子域版本取代 |
| `neatlogic-feature-comparison-upgrade-2026-09-30.md` (v2) | 含 289 人天，已被 v3 取代 |

---

### 10.17 完整清单统计

| 类别 | 数量 |
|------|------|
| **有效报告文档** | **73 份**（顶层 10 + 综合 3 + AA/BB/CC 3 + 模块级 8 + 架构哲学 3 + review v1 8 + supplement 6 + rereview 8 + 方法级 4 + NL 8 + UI/UX 3 + 未覆盖 1 + 背景 5 + source 3）|
| **新增 ADR** | **6 份**（ADR-010~015，其中 ADR-015 为待决策骨架）|
| **既有 ADR** | **23 份**（ADR-0001~0015 + ADR-002~009）|
| **本索引** | **1 份**（G1 自身）|
| **权威索引** | **1 份**（design-docs-summary v5.4）|
| **有效产出合计** | **105 份文档 / ~55,000 行** |
| **已删除历史** | 7 份（仅记录）|

**核对**：73 + 6 + 1 = 80（有效报告 + 新增 ADR + G1），+ 23 既有 ADR + 1 索引 = **105 份**（去重后实际独立文档 ~96 份，含 3 份 source 冗余）。

---

**文档编号**：`all-plans-tasks-summary-2026-10-03.md`（v1.1，含完整 73 份报告清单）
**关联文档**（全部）：
- 权威索引：`design-docs-summary-2026-10-03.md` v5.4
- F1 缺口：`expert-reviews/architecture-decision-gaps-2026-10-03.md`
- F6 入口：`expert-reviews/execution-entry-review-2026-10-03.md`
- 6 新 ADR：`docs/adr/ADR-010~015-*.md`
- AA/BB/CC：`module-upgrade-designs/{data-model,architecture,risk-fallback}-*.md`
- Y 手册：`upgrade-execution-playbook-2026-10-03.md` v5.4
- 前端清单：`frontend-fix-tasks-2026-10-03.md`
- 完整 73 份清单：见本文件 §10.1~§10.14
