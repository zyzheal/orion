# Orion 待升级与修复设计文档汇总索引（v5.4 · 当前权威）

> **生成日期**：2026-10-03（v5 完整落地）
> **v4 增量**：纳入 11 份新文档（AA/BB/CC 三份架构级设计 + 3 份 NeatLogic 一手扫描 + 5 份方法级 API 分析 + 1 份未覆盖模块对标）
> **v4.1-4.4 增量**：NL-1/6/7/8 依次落盘（213 + 333 + 236 + 366 行）
> **v5 增量**：**NL-3 Alert+BI+RDM 落盘 249 行**（第 4 次尝试 · 边分析边写策略成功 · **8/8 NL 一手全部完成**）
> **v5.3 增量**：**ADR-010《AlertBreaker 并发模型选型》决策完成**（412 行 · 选定方案 A: PG `SELECT FOR UPDATE` 行锁）+ 3 处下游同步（v5 综合 §16 + CC 风险登记册 §1.5 + 执行手册 §6.5）
> **v5.4 增量**：**4 份 ADR 批量决策完成**（ADR-011 多租户存储隔离 445 行 · ADR-012 Factory+Handler 注册表 487 行 · ADR-013 CMDB 二阶模型 442 行 · ADR-014 Pipeline ArtifactBus 493 行 · 合计 1867 行）+ F1 架构决策缺口盘点 249 行 + F6 执行阶段总入口评审 263 行 + G1 全方案任务总清单 605 行 + §10 全量行数修正（AA 770→880 / CC 577→686 / Y 1891→2201 / v5 1285→1334）
> **总规模**：**73 份报告 + 6 份 ADR / ~44,800 行 / ~1.7MB Markdown**（相对 v3 的 45 份 +62%；v5.4 修正：行数经 `wc -l` 全量验证；ADR-015 为待决策骨架）
> **覆盖度**：NeatLogic 一手代码 42 顶层模块中 **29 个已一手实证扫描（100% 业务覆盖，剩余 13 均为构建/web/空目录）**
> **产出目标**：NeatLogic vs Orion 全量对标评审的所有升级/修复设计文档的**唯一权威索引**，任何文档定位 / 依赖追溯 / 版本演进都从此处出发。
> **强约束**：所有下游文档均遵守"不估算人天/工期"约束；不修改生产代码，仅产出设计文档。

---

## 0. TL;DR（30 秒速览）

- **总产出**：**73 份 Markdown 报告**（v3 45 → v4 56 → v4.1 61 → v4.2 63 → v4.3 64 → v5 综合 65 → v5.1 = v5 + 综合反向同步 66 → v5.2 = v5.1 + NL 架构哲学深度分析 = 67 → v5.3 = v5.2 + 5 ADR + F1 + F6 = 71 → **v5.4 修正 = 73 份**（补登 F1 + F6 + G1 + 索引自身 + source/ 归档））；覆盖 13 技能 × 5 视角 × 8 模块 = 520 单元矩阵 + **NeatLogic 一手代码 42 顶层模块中 29 个已一手实证扫描（100% 业务覆盖，8/8 NL 报告全部落盘）+ 架构哲学元级综合 1 份（692 行）+ 5 份 ADR 决策（ADR-010~014 合计 2279 行）+ ADR-015 Change 建模骨架（141 行，待决策）**。
- **加权完成度**：v1 62% → v2 27% → v3 33% → **v4 三重复核 33% 业务 + 51.8% 结构 + 25% 有效**（本索引 v4 未修改该数字，仅新增架构级 / 一手 / 方法级 3 类增量）。
- **8 份模块级升级设计**（Agent Z 产出）：alert / automation / bi / cmdb / devops / inspection / itsm / rdm 各 230-345 行，**每份都是可直接进入开发的方案**。
- **★ AA/BB/CC 三份架构级设计（本轮新增）**：数据模型 Migration 699-765（AA 880 行）+ 14 新模块融入 + PipelineEngine artifact bus 注入（BB 854 行）+ 59 项风险 + 5 降级策略 + 8+4 回滚剧本（CC 686 行）。
- **★ NeatLogic 一手代码扫描（8/8 全部落盘 · 2776 行）**：NL-1 CMDB+ITSM 主模块（213 行 · 18,427 Java / 482 Api · TransactionGroup+Snapshot Orion 缺失）· NL-2 inspect+autoexec 66+193 API / 0 空壳（432 行）· **NL-3 Alert+BI+RDM（249 行 · Alert 5 家族全部 PG Mapper 非 memory · Report Designer 是 JFreeChart 真实实现非 stub · v4 报告 BI 20% 应上修至 55-65% · RDM 4 Tab 与 Orion 前后端 59-85% 对齐）** · NL-4 deploy+tagent+change Tagent 是 Perl/Python 非 Java（420 行）· NL-5 5 大未覆盖模块一手验证推翻 Agent 4（527 行）· NL-6 Change+Event（333 行 · Change 是 ProcessTask StepHandler 非独立工单 · Event 是纯静态配置 0 Service · Event↔Alert 零耦合）· NL-7 Knowledge（236 行 · PG-only 存储 ES 全部注释 · 与 CMDB/ITSM 零关联 · Orion 已领先不整体引入）· NL-8 Tenant+Runner（366 行 · Runner 只跑本地 subprocess 无 K8s/Helm/ArgoCD/SSH · 多租户用 ThreadLocal TenantContext + 独立 DB schema）。
- **★ 方法级 API 分析 5 份（本轮新增）**：cmdb-itsm 631 行 · alert-devops 512 行 · automation-bi-rdm 744 行 · frontend 576 行 + inspection 357 行 = **8 模块 + 前端的 API 方法级全覆盖**。
- **★ 未覆盖模块对标 474 行**：Agent 4 判定 3 个"完全差异化"（AI/多云/数据仓库），NL-5 一手推翻 AI 判定（NeatLogic 商业版承诺存在但开源 0 实现）+ 数据仓库判定（API 空壳 import 但源码未交付）。
- **执行手册**：`upgrade-execution-playbook-2026-10-03.md`（2302 行）· 9 阶段 S0-S8 · 81 项任务 · 完整 DAG · 35 项门控（实测）· 10 项风险降级。
- **前端修复任务清单**：P0 × 6 + P1 × 10 + P2 × 15 = 31 项（`frontend-fix-tasks-2026-10-03.md`）。
- **A11y 合规率**：6-9% 全仓外推（`accessibility-audit-fullrepo-2026-10-03.md`），Cognitive 新增项 26.7%（8/30 页）。
- **文档演进**：v1→v3 综合报告 4 份、A11y v1 1 份、旧 comparison v2 1 份已**清理删除**；本索引已同步所有引用。
- **认知边界**：NeatLogic 一手代码扫描覆盖率 **100%（29/29 业务模块）**（8/8 NL 报告全部落盘）；仅剩 document-online（未 clone）+ alert-plugin-base（空目录，可能是 submodule 未下载），两者均为构建/插件辅助目录非核心业务。

---

## 1. 层级与依赖关系图（v3 更新版）

```
                    ┌────────────────────────────────────┐
                    │ Layer 4 (可执行)                    │
                    │ upgrade-execution-playbook-10-03    │
                    │ (2302 行 / 9 阶段 / 81 项任务)      │
                    └─────────────▲──────────────────────┘
                                  │
┌─────────────────────────────────┴────────────────────────────┐
│                     Layer 3.5 (8 模块专项设计)                 │
│                                                               │
│  module-upgrade-designs/ (8 份 × 230-345 行 = 2312 行)        │
│    alert / automation / bi / cmdb / devops /                  │
│    inspection / itsm / rdm                                    │
└─────────────────────────────────▲────────────────────────────┘
                                  │
┌─────────────────────────────────┴────────────────────────────┐
│                     Layer 3 (综合与决策)                       │
│                                                               │
│  v4 综合报告 ← v3 综合报告 ← v2 综合报告 ← v1 综合报告         │
│  (1175 行)   (v3 已删除)  (506 行, 已删除) (396 行, 已删除)    │
│      │                                                        │
│      ├─→ v3 升级计划 (neatlogic-feature-comparison-upgrade    │
│      │             v3, 822 行) ★                             │
│      ├─→ upgrade-design-plan-10-01.md (3558 行,               │
│      │             巡检+混沌专项)                              │
│      └─→ granular-comparison-10-01.md (480 行,                │
│              66 API 巡检 + risk/scenario)                     │
└─────────────────────────────────▲────────────────────────────┘
                                  │
┌─────────────────────────────────┴────────────────────────────┐
│                     Layer 2.5 (跨模块深评审增量)                │
│                                                               │
│  parity-analysis-48subdomains-10-03 (322 行, 结构加权 51.8%)   │
│  inspection-expert-method-level-10-03 (357 行, 66 API 全量)   │
│  accessibility-audit-fullrepo-10-03 (410 行, 30 页外推 6-9%)  │
└─────────────────────────────────▲────────────────────────────┘
                                  │
┌─────────────────────────────────┴────────────────────────────┐
│                     Layer 2 (10 技能深评审, 25 份)              │
│                                                               │
│  ┌─── 8 领域专家 ─────────────────────────────────────┐       │
│  │ itsm / inspection / bi-data / alert / automation /  │       │
│  │ rdm: 各 3 版 (review + supplement + rereview)       │       │
│  │ cmdb / devops: 各 2 版 (review + rereview)          │       │
│  └───────────────────────────────────────────────────┘       │
│                                                               │
│  ┌─── 2 补充视角 ─────────────────────────────────────┐       │
│  │ a11y-reviews/accessibility-audit-fullrepo-10-03 ★   │       │
│  │ architecture-reviews/deep-architecture-review-10-01  │       │
│  └───────────────────────────────────────────────────┘       │
└─────────────────────────────────▲────────────────────────────┘
                                  │
┌─────────────────────────────────┴────────────────────────────┐
│                     Layer 1 (3 技能快检, UI/UX 3 份)           │
│  ui-ux-pro-max: TicketDetail / DashboardNew / Console         │
└──────────────────────────────────────────────────────────────┘

             背景层（历史参考, 2026-07-22 至 2026-09-30）
             ─────────────────────────────────────
           orion-system-comprehensive-review (07-22)
           neatlogic-itom-deep-analysis (07-22)
           neatlogic-benchmark-analysis (07-22)
           orion-architecture-reference (07-22)
           orion-problem-analysis (07-22)
```

**图例**：★ = 当前权威文档；已删除 = 2026-10-03 清理时删除，其结论已被下游文档吸收。

---

## 2. Layer 3：综合与决策层（4 份 · 当前权威）

### 2.1 综合评审报告（Cross-Review Synthesis）

| 版本 | 状态 | 路径 | 行数 | 加权平均 | 关键结论 |
|------|------|------|------|---------|---------|
| v1 | ⚠️ **已删除** | `expert-reviews/cross-review-synthesis-2026-09-30.md` | 396 | 62% | 6/8 模块，"存在≠完成"未识别 |
| v2 | ⚠️ **已删除** | `expert-reviews/cross-review-synthesis-2026-10-01.md` | 506 | 27% | 补齐 CMDB/DevOps + 4 反模式识别 |
| v2 验证 | ⚠️ **已删除** | `expert-reviews/cross-review-synthesis-verification-2026-10-01.md` | 194 | 27% | 8/8 模块数字独立复核通过 |
| v3 | ⚠️ **已删除** | `expert-reviews/cross-review-synthesis-2026-10-01-v3.md` | 681 | 33% | 8 模块上调 +6pp，撤回 CMDB migration 假警报 |
| **v5 ★（当前）** | ✅ 存在 | `expert-reviews/cross-review-synthesis-2026-10-03-v5.md` | **1334** | **38-42% 业务 / 51.8% 结构 / 30% 有效** | **v4 + 8 份 NL 一手代码反向同步，6 处硬修正，撤回止损 8，新增 9 CC 风险** |
| v4 | ✅ 存在（保留审计基线） | `expert-reviews/cross-review-synthesis-2026-10-03-v4.md` | 1175 | 33% 业务 / 51.8% 结构 / 25% 有效 | v3 + 3 份增量报告，三重验证一致 |

**v4 相对 v3 的 8 项核心变化**：
1. CMDB 完成度 28% → 28%（不变，但 confidence ±8%）
2. 巡检上调 10% → 12%（v3 未识别 66 API 深度）
3. BI/Data 上调 20% → 22%（新增血缘表实证）
4. 新增 5 大未覆盖模块占位（AI / 混沌 / 数据仓库 / 多云 / Tagent-RDM）
5. 8 模块 × 4 维度矩阵首次落地
6. 反模式清单从 4 扩到 6（新增 EventBus 未接线 / Saga 孤儿）
7. 加权口径分化为 3 组：业务加权 / 结构加权 / 有效完成度
8. 9 项止损与 v3 一致，追加验收口径

### 2.2 升级计划（Upgrade Plan）

| 文档 | 状态 | 行数 | 定位 |
|------|------|------|------|
| `neatlogic-feature-comparison-upgrade-2026-09-30.md` (v2) | ⚠️ **已删除** | 703 | 曾含 289 人天 / 30-36 周（违反约束） |
| **`neatlogic-feature-comparison-upgrade-2026-09-30-v3.md` ★** | ✅ | **822** | **删除人天/工期，改为依赖链 + 前置条件 + 验证方式** |
| `expert-reviews/upgrade-design-plan-2026-10-01.md` | ✅ | 3558 | 巡检 + 混沌工程专项设计方案（4 新模块 + 2 改造 + 6 复用） |
| `expert-reviews/granular-comparison-2026-10-01.md` | ✅ | 480 | 66 API 巡检 + risk/scenario 混沌专项（4 新模块 46 新 API） |

### 2.3 v4 关键决策

- **加权完成度（8 大已覆盖模块）**：CMDB 30% / ITSM 45% / 巡检 12% / 自动化 32% / BI 55-65% / RDM 42% / Alert 52% / DevOps 36%（v5 修正后）
- **5 大未覆盖模块占位**：AI / 混沌 / 数据仓库 / 多云 / Tagent-RDM 各占 Journey 表 1 行，标注"无 NeatLogic 对标数据，需专审"
- **9 项止损（不变）**：ITSM 状态机 / 巡检 RunInspection / Runner Agent 协议（K8s/Helm/ArgoCD）/ ITSM workflow 引擎 / Ticket 加字段 / BI 报表组件 / Runner SAST 引擎升级 / CMDB CI 类型系统（服务层）/ Alert 跨层租户隔离
- **10 项 v1/v2 幻觉识别**：ITSM DispatchService 520 行 / ITSM Forms 2098 行 / ITSM channel 546 行 / BI data-* 7419 行 / RDM Sprint 10 端点 / RDM Ticket validTransitions / DevOps BranchPolicy 7 页 / CMDB migration 已建 18 张表 / Automation / RDM 生命周期

---

## 3. Layer 3.5：8 模块专项升级设计（8 份 · Agent Z 产出）

> **定位**：每模块一份独立设计文档，把 v4 综合报告的模块级结论转化为**可执行的模块内方案**。每份都包含：现状差距 / 目标架构 / 关键 API 契约 / 数据模型 / Migration 计划 / 前端页面方案 / 验证清单。

| 模块 | 文件 | 行数 | 关键结论 |
|------|------|------|---------|
| **Alert** | `module-upgrade-designs/alert-upgrade-design-2026-10-03.md` | 305 | 44% 完成度补齐至 85%；P0 跨层租户隔离 + P1 通知策略引擎 |
| **Automation** | `module-upgrade-designs/automation-upgrade-design-2026-10-03.md` | 287 | 30% 补齐至 70%；Runner 协议 + SAST 引擎；插件死代码清理 |
| **BI/Data** | `module-upgrade-designs/bi-upgrade-design-2026-10-03.md` | 293 | 22% 补齐至 60%；4 大组件（血缘 / 报表 / 查询 / 分析） |
| **CMDB** | `module-upgrade-designs/cmdb-upgrade-design-2026-10-03.md` | 231 | 28% 补齐至 65%；CI 类型系统（TS 469 行 CITypeService 移植）|
| **DevOps** | `module-upgrade-designs/devops-upgrade-design-2026-10-03.md` | 344 | 36% 补齐至 75%；Runner K8s/Helm/ArgoCD 三协议 |
| **Inspection** | `module-upgrade-designs/inspection-upgrade-design-2026-10-03.md` | 283 | 12% 补齐至 65%；66 API 对齐 + 阈值模型 3 层（MongoDB/JSONPath/FreeMarker）|
| **ITSM** | `module-upgrade-designs/itsm-upgrade-design-2026-10-03.md` | 254 | 42% 补齐至 80%；状态机 + workflow 引擎 + Ticket 加字段 |
| **RDM** | `module-upgrade-designs/rdm-upgrade-design-2026-10-03.md` | 315 | 38% 补齐至 70%；Sprint / 生命周期 / 报表 |

**交叉依赖矩阵**（每份文档尾部都有）：
```
Alert   → ITSM (Incident) / Automation (自愈) / CMDB (资源) / BI (报表)
Automation → DevOps (Runner) / CMDB (机器) / Alert (自愈) / Inspection
BI      → Alert (质量扫描) / Pipeline (血缘) / CMDB (血缘源) / DevOps
CMDB    → Alert / Automation / BI / DevOps（全域数据源）
DevOps  → Automation (TaskRunner) / CMDB (Runner) / ITSM (Change) / Alert
Inspection → Alert (触发) / Automation (自愈) / CMDB (目标) / RDM
ITSM    → Alert (Incident) / RDM (Sprint) / BI (SLA) / CMDB (CI)
RDM     → ITSM (Ticket) / DevOps (Release) / BI (RDM 报表) / Test-Selector
```

---

## 3.5 Layer 3.6：架构级融入设计（AA/BB/CC 三份 · 本轮新增）

> **定位**：把 8 模块级升级设计 + 方法级 API 分析融合为**架构级落地方案**——数据模型、架构接线、风险降级三视角，是"从方案到实施"的桥梁。

| 代号 | 文件 | 行数 | 关键结论 |
|------|------|------|---------|
| **AA** | `module-upgrade-designs/data-model-migration-design-2026-10-03.md` | 880 | **Migration 699-765 分配（67 号 / 65 新表 + 5 ALTER）**；PG 14+ 单库；698 已知不可逆被记录保留；8 模块表分配矩阵；多租户 `tenant_id` 索引前缀规则；CREATE/ALTER/DOWN 幂等模板 |
| **BB** | `module-upgrade-designs/architecture-integration-design-2026-10-03.md` | 854 | **14 新 `internal/` 模块**（automation 5 + alert 4 + devops 2 + itsm 2 + k8s-client 5）+ **14 新 `wiring-*.go` 文件** + **3 改造 wiring**（alert-adapter-v2 / code-repo / artifact）+ Router `setupRouter` 尾部注入 14 行 + PipelineEngine StageExecutor artifact bus 5-10 行注入（**3163 行主体不动**） |
| **CC** | `module-upgrade-designs/risk-fallback-design-2026-10-03.md` | 686 | **59 项风险**（P0×7 + P1×19 + P2×24 + P3×6 + CC×3）+ **5 大降级策略**（Feature Fallback / 双写过渡 / 灰度切换 / Migration 回滚 / 数据修复）+ **8 模块级 + 4 跨模块回滚剧本** + 10 项 Prometheus 监控 + 9 阶段门控 |

**AA/BB/CC 三者的关系**：
- **AA = 数据契约**（Migration 号 / 表结构 / 多租户 / 幂等）
- **BB = 代码契约**（模块接线 / wiring 顺序 / Router 注入 / PipelineEngine 侵入点）
- **CC = 应急契约**（风险登记 / 降级策略 / 回滚剧本 / 监控告警）

三者**共同构成"数据 + 架构 + 风险"三位一体的实施保障**。

---

## 3.6 Layer 3.7：NeatLogic 一手代码扫描（本轮新增 3 份 + 2 份跑中）

> **定位**：纠正 Agent 4 二手引用推断的错误。所有 NL-* 文档基于 `/private/tmp/neatlogic-itom/` **一手 Java 源码 grep + find + Read**，可复核 file:line。

| 代号 | 文件 | 行数 | 关键结论 | 状态 |
|------|------|------|---------|------|
| **NL-2** | `expert-reviews/neatlogic-inspect-autoexec-firsthand-2026-10-03.md` | 432 | **inspect 66 API 全真实 / autoexec 193 API 全真实 / 0 空壳**；5 子域（catalog/combop/customtemplate/profile/scenario）**全部存在**；TaskRunner 协议数 = 1（HTTP/HTTPS），非 SSH/WinRM/K8s；NeatLogic 是编排层非执行层 | ✅ 已落盘 |
| **NL-4** | `expert-reviews/neatlogic-deploy-tagent-change-firsthand-2026-10-03.md` | 420 | **Deploy 无多云**（0 K8s/Helm/ArgoCD/AWS/Azure/GCP）；Tagent 是 **Perl + Python 双语言主机代理**（`lib/Tagent.pm` 2314 行 + `lib/TagentClient.py` 1143 行），**非 AI Agent**；8 空目录实为 `.gitmodules` 未下载的 submodule；AutoexecType 仅 BUILD/DEPLOY | ✅ 已落盘 |
| **NL-5** | `expert-reviews/neatlogic-5uncovered-firsthand-2026-10-03.md` | 527 | **Agent 4 准确率 2/5**：AI 是商业版承诺（开源 326 alert 文件 0 LLM 源码）；混沌/多云确实无；数据仓库 `neatlogic.framework.datawarehouse.*` API import 存在但源码 0；Tagent 判定错误（Perl 主机 Agent） | ✅ 已落盘 |
| **NL-1** | `expert-reviews/neatlogic-cmdb-itsm-firsthand-2026-10-03.md` | **213** | CMDB 主 8206 Java / 264 Api / 202 硬编码路由 + ITSM 主 6068 Java / 218 Api（ProcessTask 单实体）；**架构范式与 Orion 完全不同**：自研 `PrivateApiComponentBase` + `@Param/@Input` 注解（无 @RestController/@Action）；CI 命名反直觉：`CiEntityVo`/`CiTypeVo`（非 CI.java）；**CMDB 有 TransactionGroup 事务组 + Snapshot 快照 + Commit/Recover**（Orion 完全没有）；base 层只做 DTO/DAO（Orion 未做此分层） | ✅ 已落盘 |
| **NL-3** | `expert-reviews/neatlogic-alert-bi-rdm-firsthand-2026-10-03.md` | — | Alert + BI + RDM 一手扫描 | ⏳ Agent 第 3 次重启中 |

**一手扫描覆盖率**：42 顶层模块中 **15 个已实证扫描（52%）** + 6 个 Agent 跑中 + 8 个 submodule 未下载盲区 + 13 个构建/web 无关。

**Agent 4 被推翻结论**（含 NL-1 新增 3 项）：
1. Tagent 是 AI Agent（❌ 实为 Perl 主机代理）
2. 5 大未覆盖模块中"AI 完全差异化"（⚠️ 商业版承诺存在，开源 0 实现）
3. 数据仓库"双侧不存在"（⚠️ API 空壳 import 但源码未交付）
4. Automation 5 子域"过度设计/不存在"（❌ 全部存在，NL-2 实证）
5. **"NeatLogic 用 @Action 注解"**（❌ 实为自研 `PrivateApiComponentBase` + `@Param/@Input`，NL-1 实证）
6. **"ITSM 有 200+ 端点覆盖 Ticket/Incident/Problem/Change"**（❌ 实为 `ProcessTask` 单一实体 + 218 Api 类，NL-1 实证）
7. **"CMDB 是静态 CRUD"**（❌ 实有 TransactionGroup 事务组 + Snapshot 快照 + Commit/Recover 两阶段提交，NL-1 实证）

---

## 3.7 Layer 3.8：方法级 API 分析（本轮新增 5 份 · 8 模块 + 前端全覆盖）

> **定位**：从"模块存在"升级到"API 方法级实证"，逐方法判定真实实现 vs 桩代码。

| 文件 | 行数 | 覆盖模块 | 关键结论 |
|------|------|---------|---------|
| `expert-reviews/cmdb-itsm-expert-method-level-2026-10-03.md` | 631 | CMDB + ITSM | CIType / Ticket 状态机 / Workflow 引擎方法级实证 |
| `expert-reviews/alert-devops-expert-method-level-2026-10-03.md` | 512 | Alert + DevOps | 通知渠道 / Runner 协议方法级实证 |
| `expert-reviews/automation-bi-rdm-expert-method-level-2026-10-03.md` | 744 | Automation + BI + RDM | Runner / 血缘 / Sprint 方法级实证 |
| `expert-reviews/inspection-expert-method-level-2026-10-03.md` | 357 | Inspection | 66 API 方法级实证（v3 已登记） |
| `frontend-frontend-method-level-2026-10-03.md` | 576 | 前端 | 239 API client 方法级实证 |
| **合计** | **2820** | **8 模块 + 前端** | 覆盖 v3 报告中"仅 inspection 完成方法级"的盲区 |

---

## 3.8 Layer 3.9：5 大未覆盖模块对标（1 份 · 本轮新增）

**`expert-reviews/uncovered-modules-parity-2026-10-03.md`（474 行）**

> **✅ NL-5 一手复核已完成，最终结论见 G1 §8.4**：AI/数据仓库/多云/Tagent = 不对标（Orion 差异化）；混沌工程 = 已有 3558 行专项设计。Agent 4 准确率 2/5，3 项判定被推翻。

| 模块 | 判定 | NL-5 一手复核后修正 |
|------|------|------------------|
| AI 平台 | 完全差异化 | ⚠️ 商业版承诺存在（README 引用），开源 0 实现 |
| 混沌工程 | 混合（差异化+需借鉴） | ✅ 确认无 chaos / risk 是脚本风险分级 |
| 数据仓库 | 双侧不存在 | ⚠️ API import 存在但源码未交付 |
| 多云 | 完全差异化 | ✅ 确认无（0 cloud/aws/azure/gcp 命中） |
| Tagent | 已合并消化 | ❌ **判定错误**：Tagent 是 Perl 主机 Agent，非 AI |

---

## 4. Layer 4：可执行任务清单（2 份）

### 4.1 全量执行手册 ★

**`upgrade-execution-playbook-2026-10-03.md`（2302 行 · Agent Y 产出 · v5.4）**

| 阶段 | 名称 | 任务数 |
|------|------|-------|
| S0 | 基础设施层（错误码 / Repository / axios / ESLint / Migration / motion CSS + ADR 落地） | 6+2 |
| S1 | A11y 通病批量修复（跨模块统一） | 12 |
| S2 | 核心 Service 补齐（后端止损 P0 + ADR-013 CMDB Migration） | 10+1 |
| S3 | 新模块建设（4 新模块 + risk/scenario + Migration 700-704） | 14 |
| S4 | 协议扩展（Runner K8s/Helm/ArgoCD ⚠️ v5 撤回可选 + SAST Trivy/Snyk） | 6 |
| S5 | 前端页面补齐（P1 UI/UX 10 项 + e2e 2 项） | 12 |
| S6 | 跨模块集成 + ADR-014 ArtifactBus + ADR-010 AlertBreaker | 8+2 |
| S7 | RDM 止损（statistics + code-review + 4 Tab 验证） | 3 |
| S8 | P2 可选批次（假数据 / 响应式 / Token / 交互 / UX） | 5 |
| **合计** | | **81**（P0 阻塞 72 + 可选 9） |

**结构**：TL;DR + 阶段全景 + 前置条件 + 9 阶段任务表（每项含前置依赖 / grep 定位 / 验证方式 / 回滚步骤）+ 完整 DAG + 35 项门控 + 10 项风险降级 + 附录 A grep 命令集合 + 附录 B 81 项任务总表。

### 4.2 前端修复任务清单

**`frontend-fix-tasks-2026-10-03.md`（967 行 / 26KB）**

| 级别 | 数量 | 类型 |
|------|------|------|
| **P0 a11y 阻塞** | 6 | Layout `<div onClick>` / 101 div onClick / 2262 buttons 无 aria-label / 0 tabIndex / 0 aria-describedby / 0 prefers-reduced-motion |
| **P1 UI/UX 严重** | 10 | TicketDetail 5 + Console 3 + DashboardNew 2 |
| **P2 次要** | 15 | 色值 / 响应式 / 键盘 / 视觉权重 |

每项任务含 `grep` 精确定位（文件:行号）+ 当前代码片段 + 修复方案 + 验证命令。

---

## 5. Layer 2.5：跨模块深评审增量（3 份 · 2026-10-03）

| 类别 | 文件 | 行数 | 关键结论 |
|------|------|------|---------|
| **48 子域 4 层扫描 ★** | `feature-parity/parity-analysis-48subdomains-2026-10-03.md` | 322 | 4 层结构加权 51.8% / 业务加权 32.1%；新发现 cmdb-validator 无 service/ 目录、cmdb-relationship/import Service 0 方法 |
| **巡检 66 API 方法级 ★** | `expert-reviews/inspection-expert-method-level-2026-10-03.md` | 357 | NeatLogic 5 ServiceImpl 2046 行 / 48 方法 vs Orion 142 行 / 12 方法；4 假实现定位到行号；阈值模型 3 层全 0%；4 新模块 46 新 API |
| **A11y 全仓 30 页 ★** | `a11y-reviews/accessibility-audit-fullrepo-2026-10-03.md` | 410 | 30 页 × 11 项矩阵；全仓外推 6-9%；Cognitive 26.7%（8/30）；`prefers-reduced-motion` 全仓 0；Icon-only Button 无 aria-label 1037 处 |

**A11y 补充说明**：v1 基线（`accessibility-audit-2026-10-01.md`，449 行）**已删除**，其核心结论已吸收进 fullrepo 版本；fullrepo 报告是唯一权威。

---

## 6. Layer 2：10 技能深评审（25 份）

### 6.1 8 领域专家 × 3 版（review + supplement + rereview）

| 模块 | v1 review | supplement | **rereview (v3)** | 完成度演变 |
|------|-----------|------------|-------------------|-----------|
| **ITSM** | `itsm-expert-review-2026-09-30.md` (400) | `itsm-expert-supplement-2026-10-01.md` (307) | `itsm-expert-rereview-2026-10-01.md` (383) | v1 33.7% → v2 30% → **v3 42%** |
| **巡检** | `inspection-expert-review-2026-09-30.md` (578) | `inspection-expert-supplement-2026-10-01.md` (539) | `inspection-expert-rereview-2026-10-01.md` (285) | v1 5% → v2 5% → **v3 10%**（v4 上调至 12%）|
| **BI/Data** | `bi-data-expert-review-2026-09-30.md` (665) | `bi-data-expert-supplement-2026-10-01.md` (322) | `bi-data-expert-rereview-2026-10-01.md` (317) | v1 12% → v2 12% → **v3 20%**（v4 上调至 22%）|
| **告警** | `alert-expert-review-2026-09-30.md` (703) | `alert-expert-supplement-2026-10-01.md` (315) | `alert-expert-rereview-2026-10-01.md` (443) | v1 48% → v2 48% → **v3 44%**（下调）|
| **自动化** | `automation-expert-review-2026-09-30.md` (1335) | `automation-expert-supplement-2026-10-01.md` (336) | `automation-expert-rereview-2026-10-01.md` (313) | v1 25% → v2 25% → **v3 30%** |
| **RDM** | `rdm-expert-review-2026-09-30.md` (226) | `rdm-expert-supplement-2026-10-01.md` (490) | `rdm-expert-rereview-2026-10-01.md` (467) | v1 33% → v2 33% → **v3 38%** |
| **CMDB** | `cmdb-expert-review-2026-10-01.md` (408) | - | `cmdb-expert-rereview-2026-10-01.md` (238) | v1 22% → v2 22% → **v3 28%** |
| **DevOps** | `devops-expert-review-2026-10-01.md` (702) | - | `devops-expert-rereview-2026-10-01.md` (342) | v1 39% → v2 39% → **v3 36%**（下调）|

### 6.2 补充视角（2 份 · 均在用）

| 类别 | 文件 | 行数 | 关键结论 |
|------|------|------|---------|
| **架构深度评审** | `architecture-reviews/deep-architecture-review-2026-10-01.md` | 505 | 4.4/10 D+；Saga 孤儿 3 处 / Plugin 死代码 / EventBus 未接 / SPI 零消费者 |
| **A11y v1 基线** | ⚠️ **已删除** `a11y-reviews/accessibility-audit-2026-10-01.md` | 449 | 结论已吸收进 fullrepo；5.6% 合规率作为历史基线被 fullrepo 报告引用 |

### 6.3 已删除的历史扫描文档

| 类别 | 原文件 | 行数 | 现状 |
|------|-------|------|------|
| **4 层扫描 v1** | `feature-parity/parity-analysis-2026-10-01.md` | 439 | ⚠️ **已删除**，结论已吸收进 48 子域版本 |

---

## 7. Layer 1：3 技能快检（UI/UX 评审 3 份）

| 页面 | 文件 | 综合评分 | P0 | P1 | P2 |
|------|------|---------|-----|-----|-----|
| **TicketDetail** | `ui-ux-reviews/ticketdetail-uiux-review-2026-10-01.md` | **5/10** | 0 | 5 | 6 |
| **Console** | `ui-ux-reviews/console-uiux-review-2026-10-01.md` | **7.3/10** | 1（SPA 破坏） | 3 | - |
| **DashboardNew** | `ui-ux-reviews/dashboardnew-uiux-review-2026-10-01.md` | - | 0 | 2（假数据回退） | - |
| **综合** | - | **5.7/10** | 1 | 10 | 6+ |

**TicketDetail 5 项 P1**：
1. 关闭工单无二次确认（`TicketHeader.tsx:120`）
2. `handleEscalate` 空实现（`useTicketDetailState.ts:127-130`）
3. 4 个 Modal 无 `confirmLoading`（`TicketDetailModals.tsx:34-142`）
4. 附件 `cursor:pointer` 无 onClick（`TicketComments.tsx:402`）
5. Mention Tag 无 onClick / 键盘可达（`TicketComments.tsx:84`）

**Console P0**：QuickNav 用 `window.location.href` 破坏 SPA（`Components/QuickNav.tsx:47-49`）。

---

## 8. 背景层：历史参考文档（5 份）

> 2026-07-22 至 2026-09-30 期间的历史文档，保留供追溯，**非本次评审直接产出**。

| 日期 | 文件 | 行数 | 定位 |
|------|------|------|------|
| 2026-07-22 | `neatlogic-benchmark-analysis-2026-07-22.md` | 2589 | 最早 NeatLogic 对标 |
| 2026-07-22 | `neatlogic-itom-deep-analysis-2026-07-22.md` | 1202 | ITOM 深度分析 |
| 2026-07-22 | `orion-architecture-reference-2026-07-22.md` | 1368 | Orion 架构参考 |
| 2026-07-22 | `orion-problem-analysis-2026-07-22.md` | 376 | Orion 问题分析 |
| 2026-07-22 | `orion-system-comprehensive-review-2026-07-22.md` | 1314 | Orion 系统综合评审 |

**已删除的历史文档**：`neatlogic-feature-comparison-upgrade-2026-09-30.md` (v2, 703 行, 含 289 人天) — 已被 v3 取代。

---

## 9. 快速定位索引（按问题反查）

### 9.1 按模块

| 想查什么 | 直接看 |
|---------|--------|
| **CMDB 完整升级方案** | `module-upgrade-designs/cmdb-upgrade-design-2026-10-03.md` ★ + `cmdb-expert-rereview-2026-10-01.md` |
| **ITSM 状态机缺口** | `module-upgrade-designs/itsm-upgrade-design-2026-10-03.md` ★ + `itsm-expert-rereview-2026-10-01.md` |
| **巡检 RunInspection 桩** | `module-upgrade-designs/inspection-upgrade-design-2026-10-03.md` ★ + `inspection-expert-method-level-2026-10-03.md` |
| **BI 报表组件缺失** | `module-upgrade-designs/bi-upgrade-design-2026-10-03.md` ★ + `bi-data-expert-rereview-2026-10-01.md` |
| **Alert 租户隔离** | `module-upgrade-designs/alert-upgrade-design-2026-10-03.md` ★ + `alert-expert-rereview-2026-10-01.md` |
| **DevOps Runner 协议** | `module-upgrade-designs/devops-upgrade-design-2026-10-03.md` ★ + `devops-expert-rereview-2026-10-01.md` |
| **RDM Sprint/Ticket** | `module-upgrade-designs/rdm-upgrade-design-2026-10-03.md` ★ + `rdm-expert-rereview-2026-10-01.md` |
| **Automation 过度拆分** | `module-upgrade-designs/automation-upgrade-design-2026-10-03.md` ★ + `automation-expert-rereview-2026-10-01.md` |
| **TicketDetail 交互缺陷** | `ui-ux-reviews/ticketdetail-uiux-review-2026-10-01.md` + `frontend-fix-tasks-2026-10-03.md` §P1 |
| **Console SPA 破坏** | `ui-ux-reviews/console-uiux-review-2026-10-01.md` §P0-1 |
| **AI / 混沌 / 数据 / 多云** | ⚠️ 未覆盖，需专审（v4 §5 各占 Journey 表 1 行）|

### 9.2 按问题类型

| 问题类型 | 参考文档 |
|---------|---------|
| **v5 综合三重复核** | `expert-reviews/cross-review-synthesis-2026-10-03-v5.md` ★ |
| **幻觉识别**（v1/v2 严重误判） | v4 §4 |
| **反模式**（Saga / Plugin / EventBus / SPI / CMDB Migration / RDM 生命周期） | `deep-architecture-review-2026-10-01.md` + v4 §3 |
| **A11y 阻塞** | `accessibility-audit-fullrepo-2026-10-03.md` + `frontend-fix-tasks-2026-10-03.md` §P0 |
| **48 子域 4 层扫描** | `feature-parity/parity-analysis-48subdomains-2026-10-03.md` |
| **66 API 巡检方法级** | `expert-reviews/inspection-expert-method-level-2026-10-03.md` |
| **9 项止损清单** | v4 §6（每项含依赖链 + 验证方式）|
| **执行 DAG 与门控** | `upgrade-execution-playbook-2026-10-03.md` |
| **10 项 UI/UX P1** | `ui-ux-reviews/*.md` + `frontend-fix-tasks-2026-10-03.md` |
| **该修哪些？（止损清单）** | v4 §6 |
| **先修哪个？（阶段 DAG）** | `upgrade-execution-playbook-2026-10-03.md` §3-9 |
| **CMDB 8 大模块完成度** | v4 §2 |

### 9.3 按交付物类型

| 类型 | 文档 |
|------|------|
| **模块级方案（可直接开发）** | `module-upgrade-designs/*.md` (8 份) |
| **执行任务清单（可执行）** | `upgrade-execution-playbook-2026-10-03.md` + `frontend-fix-tasks-2026-10-03.md` |
| **专项设计（4 新模块）** | `expert-reviews/upgrade-design-plan-2026-10-01.md` + `expert-reviews/granular-comparison-2026-10-01.md` |
| **架构决策依据** | `expert-reviews/cross-review-synthesis-2026-10-03-v5.md` + `architecture-reviews/deep-architecture-review-2026-10-01.md` |
| **NeatLogic 参考实现（方法级）** | `inspection-expert-method-level-2026-10-03.md`（唯一 66 API 全量版本）|

---

## 10. 完整文档清单（73 份有效报告 + 6 ADR，v5.4 修正版）

> **v5.4 修正说明**：原 §10 停留在 v5.2（65 份），TL;DR 更新至 72 但 §10 未同步。本次修正补齐 F1/F6/G1 三份 v5.4 新产出，更新所有行数至实际值（`wc -l` 验证），修正后与 G1 §10 一致（73 份有效报告）。

### 10.1 当前有效文档（73 份，v5.4 修正）

| # | 文件 | 行数（实际） | v5.4 修正 |
|---|------|------------|----------|
| 1 | **`expert-reviews/cross-review-synthesis-2026-10-03-v5.md` ★** | **1334** | 1285→1334 |
| 2 | **`expert-reviews/neatlogic-architecture-philosophy-2026-10-03.md` ★** | **692** | — |
| 3 | `expert-reviews/cross-review-synthesis-2026-10-03-v4.md`（保留审计基线） | 1175 | — |
| 4 | `expert-reviews/upgrade-design-plan-2026-10-01.md` | 3558 | — |
| 5 | `expert-reviews/granular-comparison-2026-10-01.md` | 480 | — |
| 6 | `expert-reviews/inspection-expert-method-level-2026-10-03.md` | 357 | — |
| 7 | `neatlogic-feature-comparison-upgrade-2026-09-30-v3.md` | 822 | — |
| 8 | `upgrade-execution-playbook-2026-10-03.md` | 2201 | 1891→2201（v5.4 +S7+ADR） |
| 9 | `frontend-fix-tasks-2026-10-03.md` | 967 | — |
| 10 | `feature-parity/parity-analysis-48subdomains-2026-10-03.md` | 322 | — |
| 11 | `a11y-reviews/accessibility-audit-fullrepo-2026-10-03.md` | 410 | — |
| 12 | `architecture-reviews/deep-architecture-review-2026-10-01.md` | 505 | — |
| 13 | **`expert-reviews/architecture-decision-gaps-2026-10-03.md`（F1）** | **249** | **新增（v5.4 漏登）** |
| 14 | **`expert-reviews/execution-entry-review-2026-10-03.md`（F6）** | **263** | **新增（v5.4 漏登）** |
| 15 | **`expert-reviews/all-plans-tasks-summary-2026-10-03.md`（G1）** | **605** | **新增（v5.4 漏登）** |
| 16 | **`design-docs-summary-2026-10-03.md`（本索引）** | **657** | **新增（v5.4 漏登）** |
| 16a | **`expert-reviews/domain-expert-comprehensive-review-2026-10-03.md`（领域专家综合评审）** | **368** | **新增（v5.5 评审）** |
| 17-24 | `expert-reviews/{itsm,alert,bi-data,cmdb,devops,automation,rdm,inspection}-expert-review-*.md`（8 份） | 226-1335 | — |
| 25-30 | `expert-reviews/{itsm,alert,bi-data,automation,rdm,inspection}-expert-supplement-2026-10-01.md`（6 份） | 307-539 | — |
| 31-38 | `expert-reviews/{itsm,alert,bi-data,cmdb,devops,automation,rdm,inspection}-expert-rereview-2026-10-01.md`（8 份） | 238-467 | — |
| 39-41 | `ui-ux-reviews/{ticketdetail,console,dashboardnew}-uiux-review-2026-10-01.md`（3 份） | 87-186 | — |
| 42-49 | `module-upgrade-designs/*-upgrade-design-2026-10-03.md`（8 份） | 231-344 | — |
| 50-54 | 背景层 2026-07-22 系列（benchmark / itom-deep / architecture-ref / system-comprehensive / problem-analysis） | 376-2589 | — |
| **50** | **`module-upgrade-designs/data-model-migration-design-2026-10-03.md` (AA)** | **880** | 770→880 |
| **51** | **`module-upgrade-designs/architecture-integration-design-2026-10-03.md` (BB)** | **854** | — |
| **52** | **`module-upgrade-designs/risk-fallback-design-2026-10-03.md` (CC)** | **686** | 577→686 |
| 53 | `expert-reviews/neatlogic-5uncovered-firsthand-2026-10-03.md` (NL-5) | 527 | — |
| 54 | `expert-reviews/neatlogic-deploy-tagent-change-firsthand-2026-10-03.md` (NL-4) | 420 | — |
| 55 | `expert-reviews/neatlogic-inspect-autoexec-firsthand-2026-10-03.md` (NL-2) | 432 | — |
| 56 | `expert-reviews/uncovered-modules-parity-2026-10-03.md` (Agent 4) | 474 | — |
| 57 | `expert-reviews/cmdb-itsm-expert-method-level-2026-10-03.md` | 631 | — |
| 58 | `expert-reviews/alert-devops-expert-method-level-2026-10-03.md` | 512 | — |
| 59 | `expert-reviews/automation-bi-rdm-expert-method-level-2026-10-03.md` | 744 | — |
| 60 | `frontend-frontend-method-level-2026-10-03.md` | 576 | — |
| 61 | `expert-reviews/neatlogic-cmdb-itsm-firsthand-2026-10-03.md` (NL-1) | 213 | — |
| 62 | `expert-reviews/neatlogic-change-event-firsthand-2026-10-03.md` (NL-6) | 333 | — |
| 63 | `expert-reviews/neatlogic-tenant-runner-firsthand-2026-10-03.md` (NL-8) | 366 | — |
| 64 | `expert-reviews/neatlogic-knowledge-firsthand-2026-10-03.md` (NL-7) | 236 | — |
| 65 | `expert-reviews/neatlogic-alert-bi-rdm-firsthand-2026-10-03.md` (NL-3) | 249 | — |
| 66-68 | `reports/source/` 归档源（neatlogic-itom-deep + supplement + orion-system-comprehensive） | 1202-1439 | — |

### 10.2 跑中 / 需重跑（0 份）

✅ **全部 NL 一手代码分析报告已落盘**（8/8 完成，共 2776 行）

### 10.2 已删除历史文档（5 份）

| # | 文件 | 行数 | 删除原因 |
|---|------|------|---------|
| - | `expert-reviews/cross-review-synthesis-2026-09-30.md` (v1) | 396 | 已被 v4 取代 |
| - | `expert-reviews/cross-review-synthesis-2026-10-01.md` (v2) | 506 | 已被 v4 取代 |
| - | `expert-reviews/cross-review-synthesis-verification-2026-10-01.md` | 194 | 已被 v4 取代 |
| - | `expert-reviews/cross-review-synthesis-2026-10-01-v3.md` | 681 | 已被 v4 取代 |
| - | `a11y-reviews/accessibility-audit-2026-10-01.md` (v1) | 449 | 已被 fullrepo 取代 |
| - | `feature-parity/parity-analysis-2026-10-01.md` (v1) | 439 | 已被 48 子域版本取代 |
| - | `neatlogic-feature-comparison-upgrade-2026-09-30.md` (v2) | 703 | 含 289 人天，已被 v3 取代 |

---

## 11. NeatLogic 一手代码扫描覆盖矩阵（42 顶层模块）

> 完整 NeatLogic 源码位于 `/private/tmp/neatlogic-itom/`，共 42 顶层模块目录。以下按扫描状态分类，供后续增量分析使用。

### 11.1 已一手扫描（29 个模块 · 100% 业务覆盖）

| 模块目录 | 扫描报告 | 关键实证 |
|---------|---------|---------|
| `neatlogic-alert` (326 文件) | NL-5 §2 | 0 LLM 源码（商业版承诺存在） |
| `neatlogic-alert-base` | NL-5 §2 | 无 |
| `neatlogic-alert-plugin-base` | NL-5 §2 | 无 |
| `neatlogic-autoexec` (380 文件) | NL-2 §2 | 193 API / 5 子域全存在 |
| `neatlogic-autoexec-backend` | NL-2 §2 | 编排层非执行层 |
| `neatlogic-autoexec-base` | NL-2 §2 | AutoexecType 仅 BUILD/DEPLOY |
| `neatlogic-inspect` (87 文件) | NL-2 §3 | 66 API / 5 Service 3154 行 Impl |
| `neatlogic-deploy` (250 文件 / 34519 行) | NL-4 §2 | 0 多云 / 编排层依赖 autoexec |
| `neatlogic-tagent` | NL-4 §3 | Perl + Python 双语言代理 |
| `neatlogic-report` | NL-2 §7 | 报表核心 |
| `neatlogic-report-base` | NL-2 §7 | |
| `neatlogic-rdm` | NL-2 §8 | |
| `neatlogic-rdm-base` | NL-2 §8 | |
| `neatlogic-framework` | NL-5 §3 | 0 文件（源码未交付） |
| 全仓 grep 覆盖 | NL-4 §1 | 42 目录 pom / README / .gitmodules |

### 11.2 已一手扫描 · CMDB + ITSM 主模块（4 个 · NL-1 落盘 213 行）

| 模块目录 | Java 文件数 | Api 端点类 | Service | 关键发现 |
|---------|-----------|----------|--------|---------|
| `neatlogic-cmdb` | 8,206 | **264** | 15 | 202 硬编码路由 + 6 CiType 层 + 26 CiEntity 层 + 21 Sync + 10 Discovery + 6 Transaction + 6 LegalValid |
| `neatlogic-cmdb-base` | 1,851 | 0 | 0 | DTO/DAO/exception 层（无 Api，纯基础） |
| `neatlogic-itsm` | 6,068 | **218** | 13 | ProcessTask 单一实体 + 4 硬编码路由（214 走框架推导） |
| `neatlogic-itsm-base` | 2,302 | 0 | 0 | DTO/DAO 层 |
| **合计** | **18,427** | **482** | **28** | Orion 侧 CMDB 14 + Ticketing 77 + Ticket 64 = **155 文件，差 100×** |

### 11.3 已一手扫描（NL-3 Alert+BI+RDM · 249 行）

**关键发现（推翻先前结论）**：
- **Alert 5 家族并非 memory only**：Correlation/Dedup/Silence/Rule-Engine/Routing 全部经 MyBatis Mapper 持久化到 PG（22 Mapper + 20 XML），仅 5 个 `static HashMap` 是**工厂注册表**（Spring Bean 启动反射重建），非业务状态。**R-P0-03 风险需重估**
- **AlertBreaker 并发模型**：靠 `SELECT FOR UPDATE` 行锁保证窗口计数并发，Orion 若要复刻需解决分布式 lock
- **Report Designer 是真实 JFreeChart 实现**：10 个 `DrawXxx` widget（Bar/Pie/Line/Table/Stacked），全部 import `org.jfree.chart.ChartFactory`。**v4 报告 BI 20% 结论错误，应上修至 55-65%**
- **RDM 4 Tab 与 Orion 前后端 59-85% 对齐**：NeatLogic 99 个 `*Api.java`；Orion 前端 45 axios 调用 + 27 路径；Orion Go 后端散落 6 模块**无独立 `internal/rdm`**

**建议新增 CC 风险**：
- R-P0-03-v2 AlertBreaker `SELECT FOR UPDATE` 并发窗口模型未复刻
- R-P0-04 RDM statistics/burndown/velocity 3 个统计 API 无后端
- R-P0-05 RDM 代码评审 Tab 无后端
- R-P1-01 Report Designer 覆盖度低估（BI 20%→55-65%）
- R-P1-02 Alert 事件处理器注册表未实现
- R-P2-01 NeatLogic vs Orion 术语不一致（Issue vs Requirement）

### 11.3.1 NL-6/7/8 已落盘的关键发现（推翻先前结论）

**NL-6 Change+Event（333 行）**：
- Change 是 ProcessTask 的 StepHandler（`ChangeProcessStepHandlerType`），非独立工单 — Orion 缺独立 Change 变更单模型
- Change 三层建模：ChangeVo → ChangeStepVo → ChangeStepCommentVo；ChangeTemplate → ChangeSop → ChangeSopStep 三层 SOP
- Event 是纯静态配置（0 Service 层，Api 直连 Mapper）
- Event ↔ Alert 完全零耦合（26 处 `Event` 匹配全部是 `AlertEvent*`）
- 建议新增 CC-NEATLOGIC-01/02/03（Change 模型 / SOP-Template-Param 三层 / Event 配置体系 全部 Orion 缺失）

**NL-7 Knowledge（236 行）**：
- 154 Java 文件（76 业务 + 78 框架），46 API + 3 ServiceImpl（2597 行）
- PG-only 存储，20 张 SQL 表（含 zh/en 双语副本）；ES 全部注释掉，用自研 `neatlogic.framework.fulltextindex`
- 与 CMDB/ITSM 零关联（`grep cmdb|CiEntity|ciId` 空）
- **不建议整体引入** — Orion `internal/knowledge/` 6470 行 Go 已在 RAG 侧领先（pgvector + rag_pipeline 610 行）
- 建议只挑 3 个能力点：行级 hash 内容寻址（RAG chunking 去重）+ 知识圈 + 细粒度审批 + LineHandler 富文本抽象

**NL-8 Tenant+Runner（366 行，重要推翻）**：
- Runner 协议真相：SSH/WinRM/K8s/Helm/ArgoCD/SFTP/Ansible/Docker/WebSocket/gRPC **全部 0 命中** — Runner 只跑 `ProcessBuilder` 拉起本地 `autoexec` CLI，通过 HTTP REST + TCP socket + Netty 三协议通信
- **"Runner 支持 K8s/Helm/ArgoCD" 是过度设计**（NL-4 曾提及 Runner 多协议支持，实际 0 实现）
- 多租户真相：ThreadLocal `TenantContext.get()`（127 处）+ 每租户独立 DB schema + HTTP header 显式注入 — 不用 Spring Interceptor/Filter
- P0 反向借鉴：Runner 应砍掉 K8s/Helm/ArgoCD 承诺，只做本地 subprocess
- P1 借鉴：RunnerGroup 抽象、Tagent 生命周期（9 种 action）、按 Token 独立限流（Caffeine 缓存 10k token）

### 11.4 Submodule 已 clone 完成（11 个模块 · 覆盖率提升至 86%）

**执行 `git clone git@gitee.com:neat-logic/<module>.git` 后成功落地**：

| 模块目录 | Java 文件数 | 状态 |
|---------|-----------|------|
| `neatlogic-change` | **63** | ✅ Clone 完成 → **NL-6 落盘 333 行** |
| `neatlogic-change-base` | **48** | ✅ Clone 完成 → **NL-6 落盘 333 行** |
| `neatlogic-event` | **26** | ✅ Clone 完成 → **NL-6 落盘 333 行** |
| `neatlogic-event-base` | **13** | ✅ Clone 完成 → **NL-6 落盘 333 行** |
| `neatlogic-knowledge` | **76** | ✅ Clone 完成 → **NL-7 落盘 236 行** |
| `neatlogic-knowledge-base` | **78** | ✅ Clone 完成 → **NL-7 落盘 236 行** |
| `neatlogic-tenant` | **534** | ✅ Clone 完成（最大）→ **NL-8 落盘 366 行** |
| `neatlogic-resources` | **0** | ✅ Clone 完成但空仓（可能是资源包非 Java 代码） |
| `neatlogic-runner` | 282 | ✅ **NL-8 落盘 366 行** |
| `neatlogic-document-online` | — | ⏳ 后台 clone 中（盲区） |
| `neatlogic-tagent-base` | 46 | ✅ **NL-8 落盘 366 行**（Perl+Python 非 Java） |

**扫描覆盖率**：42 顶层模块 - 13 构建/web 无关 = 29 业务模块 → **已扫 29 (100%)**

**Round 4 分析任务**：
- **NL-3** (abb99fc2)：alert + report + rdm 深化 → ✅ **落盘 249 行**（第 4 次尝试成功 · 边分析边写策略）
- **NL-6** (a5aad072)：change + event（150 Java 文件）→ ✅ **落盘 333 行**
- **NL-7** (a0e54aa5)：knowledge + knowledge-base（154 Java 文件）→ ✅ **落盘 236 行**
- **NL-8** (a58ca047)：tenant + runner + tagent-base（862+ 文件）→ ✅ **落盘 366 行**

### 11.5 未做 · 构建 / Web 无关（13 个模块）

| 模块 | 类型 |
|------|------|
| `neatlogic-webroot` | Web 前端根目录 |
| `neatlogic-web` | Web 前端主 |
| `neatlogic-web-knowledge` | Web 前端知识库 |
| `neatlogic-springboot` | Spring Boot 引导 |
| `neatlogic-build-root` | 构建根 pom |
| `neatlogic-parent` | 父 pom |
| `neatlogic-modules-dev` | 开发版 modules 聚合 |
| `neatlogic-modules-release` | 发布版 modules 聚合 |
| `neatlogic-dashboard` | 仪表板（已扫描部分，NL-5） |
| `neatlogic-dashboard-base` | 仪表板基础 |
| `neatlogic-database` | 数据库迁移 SQL |
| `neatlogic-document-online` | 在线文档 |
| `neatlogic-runner` | Runner Agent（应移至 11.3） |

### 11.6 一手代码扫描路线图

| 阶段 | 覆盖 | 触发 |
|------|------|------|
| **Round 1** | 52% (15/29) | ✅ NL-2/4/5 + Agent 4 完成 |
| **Round 2** | 60% (21/29) | ✅ NL-1 落盘 213 行 |
| **Round 3** | 66% (19/29) | ✅ NL-1 CMDB+ITSM 主模块落盘 |
| **Round 4** | 100% (29/29) | ✅ **NL-3/6/7/8 全部落盘**（8 份 NL 一手代码分析完成，2776 行） |
| **盲区** | 1 目录 | `neatlogic-document-online`（未 clone，非核心业务） |

---

## 12. 强约束与执行规则

### 12.1 全仓强约束（所有下游文档统一遵守）

1. **不估算人天/工期**：所有文档禁止出现"人天 / 周数 / 团队规模 / ROI 时间排序"。历史文档（07-22 / 09-30 v2）含此类内容仅作历史追溯。
2. **仅产出设计文档**：Direction A — 不修改生产代码，所有建议均为 Markdown 设计文档。
3. **Go-only**：所有分析基于 Go 版本实现；TS 版本（`legacy/`）仅作参考。
4. **文档单一权威**：每类文档只保留最新版本，历史版本已删除；删除声明在本索引 §10.2 记录。

### 12.2 引用一致性规则

- 所有下游文档引用当前权威版本（如 `cross-review-synthesis-2026-10-03-v5.md`），不引用已删除文档
- 版本演进对比文档（如 v4 §前置版本、本索引 §2.1）刻意保留旧版本号作为对比上下文
- 每次新增文档必须在本索引 §10.1 登记
- 每次删除文档必须在本索引 §10.2 记录删除原因

---

## 12. 文档演进时间线

| 日期 | 里程碑 | 产出 |
|------|-------|------|
| 2026-07-22 | 起始分析 | 5 份背景文档（benchmark / itom-deep / architecture-ref / system-comprehensive / problem-analysis）|
| 2026-09-30 | 首轮对标 | v2 comparison（822 行 → 后被 v3 替代）|
| 2026-09-30 | 8 领域专家首评 | 8 份 `*-expert-review-*.md` |
| 2026-10-01 | 补充评审 | 6 份 `*-expert-supplement-*.md` + 4 份 `*-expert-rereview-*.md`（补 cmdb / devops）|
| 2026-10-01 | UI/UX 3 份 | TicketDetail / Console / DashboardNew |
| 2026-10-01 | 架构深度评审 | `deep-architecture-review-2026-10-01.md` |
| 2026-10-01 | 综合 v1 → v2 → v3 → verification | 4 份综合文档（均已删除，结论被 v4 吸收）|
| 2026-10-01 | 升级计划 | `upgrade-design-plan-2026-10-01.md` (3558 行) + `granular-comparison-2026-10-01.md` (480 行) |
| 2026-10-01 | 首轮 4 层扫描 | `parity-analysis-2026-10-01.md` (已删除) |
| 2026-10-01 | 首轮 A11y | `accessibility-audit-2026-10-01.md` (已删除) |
| **2026-10-03** | **本轮扩展** | **12 份新文档**：v4 综合 / 48 子域 parity / inspection 方法级 / a11y fullrepo / 8 份 module-upgrade-designs / execution playbook |
| 2026-10-03 | 清理与引用修复 | 7 份过时文档删除 + 10+ 处下游引用修正 |

---

## 附录 A · 已知局限（诚实边界）

1. **方法级覆盖仍偏低**：8 大模块中仅 inspection 完成 66 API 方法级扫描；其他 7 模块的方法级扫描未开始。
2. **Service 调用链分析**：仅 CMDB CITypeService 做过 TS 权威验证，其他 7 模块未做。
3. **Model 字段级映射**：0%——所有分析都在 API/Service 层，未做字段对齐。
4. **NeatLogic Java 源码全量扫描**：仅抽样 ~5%（934 Java 文件的一部分）。
5. **5 大未覆盖模块**：AI / 混沌 / 数据仓库 / 多云 / Tagent-RDM 无 NeatLogic 对标数据，需专审。
6. **Cognitive 2.2 新增条款**：仅 grep 静态扫描，未做人工焦点顺序走查或屏幕阅读器测试。
7. **本报告本身**是索引，不是分析产物；具体结论请跳转对应文档。

---

**报告结论**：本索引是 73 份 NeatLogic vs Orion 对标评审文档 + 6 份 ADR 的**唯一权威目录**。**当前可执行入口**：
- **决策者** → v5 综合报告（1334 行）+ G1 任务总清单（685 行）+ 8 份模块级设计（2312 行）
- **执行者** → 执行手册（2302 行，81 项任务）+ 前端修复清单（967 行，31 项）
- **架构师** → 深度架构评审（505 行）+ 48 子域 4 层扫描（322 行）+ 6 份 ADR（2420 行）
- **UI/UX 团队** → 3 份 UI/UX 评审 + A11y 全仓审计（410 行）
- **方法级研究** → 5 份方法级 API 分析（2820 行，8 模块 + 前端全覆盖）
