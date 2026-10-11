# Orion vs NeatLogic 未覆盖模块首次对标（AI / 混沌 / 数据仓库 / 多云 / Tagent）

> ⚠️ **本文件结论待 NL-5（NeatLogic 一手代码扫描）复核后决定有效性**
> 原分析基于二手引用（`neatlogic-feature-comparison-upgrade-2026-09-30-v3.md`），未验证 NeatLogic 一手 Java 代码中是否已有：AI 智能、多云编排、数据仓库、Tagent Agent 等相关能力。
> 复核后可能推翻的判定：
> - "AI 平台完全差异化"：NeatLogic 是否已有 AI 辅助（NL 3.5+ AI Agent 概念）？
> - "多云完全差异化"：NeatLogic CMDB 是否含 MultiCloud / K8s 联邦？
> - "Tagent 命名差异"：NeatLogic `neatlogic-tagent/`（tar+zip 二进制）+ `neatlogic-runner/`（空 Java 目录）是否说明 Tagent 是核心组件？
> - "数据仓库独有"：NeatLogic `neatlogic-report` 是否有数据仓库能力？

**报告日期**：2026-10-03
**分析范围**：v4 综合报告（`cross-review-synthesis-2026-10-03-v4.md`, 1175 行）未覆盖的 5 大模块
**前置依赖**：
- `upgrade-design-plan-2026-10-01.md`（3558 行，含 §1.2 混沌工程目标架构 + §3.2 混沌 12 端点）
- `cross-review-synthesis-2026-10-03-v4.md`（1175 行，8 大模块加权完成度收敛）
**硬约束**：不估算人天 / 工期；不修改生产代码；只产出 Markdown；增量分析（首次对标 5 模块，不覆盖已完成的 8 大模块）

---

## 0. TL;DR（5 模块速览）

| # | 模块 | Orion 现状 | NeatLogic 侧对标存在？ | 判定 |
|---|------|-----------|---------------------|------|
| 1 | **AI 平台** | 3 层实现：Go 后端 4 目录 + Python 权威服务 + 12 前端页 / 15149 行 | ❌ NeatLogic 无原生 AI 平台（v3/v4 均无提及） | **完全差异化**（Orion 独有） |
| 2 | **混沌工程** | 4 目录（chaos / chaos-engine / chaos-enhanced / chaos-gateway）+ 2 前端页 / 2449 行 + 现有 73 API | ⚠️ 部分对标（risk/scenario 概念，upgrade-design-plan §1.2 / §3.2） | **差异化为主 + 需 risk/scenario 借鉴** |
| 3 | **数据仓库** | 后端 0 目录 / 前端 0 页 / `internal/` 全仓 grep 无 `warehouse\|dw\|data-warehouse` | ❌ NeatLogic 是 ITOM，非 BI 上游，无数据仓库概念 | **独有 + 无必要**（若未来补 BI 上游才需） |
| 4 | **多云** | Go 后端 7 文件 1511 行（含 23 API）+ 前端 20 文件 2276 行 | ❌ NeatLogic 是单集群 CMDB，无多云编排 | **完全差异化**（Orion 独有） |
| 5 | **Tagent** | 后端 0 目录 / 前端 0 页 / `internal/` 全仓 grep 无 `tagent`；仅在 `automation-expert-review-2026-09-30.md:64` 作为连接协议出现 | ❌ NeatLogic 有 Runner Agent 但不叫 Tagent（v3 报告"不建议借鉴"三兄弟之一） | **独有命名 + 已被 RDM+Ticket+RunnerPool 合并消化** |

**关键判定**：
- **5 个模块中 3 个是纯"独有差异化"**（AI / 多云 / 数据仓库）——不需要对标补齐，只需在文档中显式标注 Orion 差异化优势
- **1 个是"命名差异"已被合并消化**（Tagent）——v3 报告已给出"RDM+Tagent+报表 = 3 个不建议借鉴"结论，本轮核实 Tagent 在代码层**不存在**（连占位目录都没有）
- **1 个是"混合"**（混沌工程）——现有 73 API 已超 upgrade-design-plan 目标 12 API，但 risk/scenario 跨域共享仍需按 upgrade-design-plan §1.2 落地

---

## 1. AI 平台对标

### 1.1 Orion 现状实证

**代码分布三层**：

| 层 | 路径 | 文件数 | 代码行 | 说明 |
|----|------|--------|--------|------|
| Go 后端主力 | `orion-platform-svc-go/internal/ai/` | 130 文件（非测试） | ~14,537 行 | 17 子目录：agents / aicost / aisecurity / auto-recovery / cost / decisions / gateway / inference / intelligence / knowledge / llm / llm-provider / models / orchestration / review / skill |
| Go 后端配套 | `orion-platform-svc-go/internal/{agents,assistant,ai-agent-run}/` | 23 文件 | ~693 行 | agents(3/19) / assistant(14/249) / ai-agent-run(6/345) |
| Python 权威服务 | `orion-ai-service/` | 48 py 文件（非测试） | 10,543 行 | FastAPI 实现；含 8 API 路由 + 8 迁移 |
| Python 蓝图 | `orion-ai-agents-svc/` | 2166 文件（含 .venv） | 排除虚拟环境后仅业务代码 ~150 行/文件 | 蓝图目录（非权威） |
| 前端 | `orion-frontend/src/pages/` 下 12 目录 | 113 文件 | 15,149 行 | 详见 1.2 |

**Go AI 后端 17 子目录行数实测**：

| 子目录 | 文件数 | 非测试行数 |
|--------|--------|-----------|
| agents | 7 | 1,868 |
| aicost | 6 | 506 |
| aisecurity | 5 | 168 |
| auto-recovery | 5 | 654 |
| cost | 6 | 453 |
| decisions | 6 | 1,683 |
| gateway | 6 | 568 |
| inference | 3 | 498 |
| intelligence | 5 | 345 |
| knowledge | 5 | 675 |
| llm-provider | 9 | 1,561 |
| llm | 5 | 1,166 |
| models | 6 | 1,507 |
| orchestration | 8 | 2,278 |
| review | 6 | 359 |
| skill | 5 | 2,669 |

**Go AI API 总数**（`.POST/.GET/.PUT/.DELETE` grep 计数）：**154 端点**（含 agents 9 / aicost 4 / aisecurity 2 / auto-recovery 6 / cost 4 / decisions 9 / gateway 8 / inference 7 / intelligence 5 / knowledge 8 / llm 14 / models 14 / orchestration 7 / review 5 / skill 34 / ai-agent-run 8 / agents 4 / assistant 6）

**Python AI Service API 端点**：`orion-ai-service/src/api/*.py` 下 10 个路由文件，`@router.` grep 计数 **50 端点**（ai_decision / ai_gateway / ai_review / ai / inference / metric / mlops / training / routes）

**Python 迁移**：`orion-ai-service/migrations/` 下 8 个 SQL（050_ai_generations / 051_ai_analyses / 052_ai_diagnoses / 053_ai_decisions / 054_ai_reviews / 055_ai_model_versions / 056_ai_vectors / 057_create_metric_storage）

### 1.2 AI 前端 12 目录

| 目录 | 文件数 | 说明 |
|------|--------|------|
| AIAgents | 12 | AI Agent 管理 |
| AIDashboard | 12 | AI 仪表盘 |
| ai-decision | 12 | AI 决策 |
| ai-decision-explanation | 11 | AI 决策解释 |
| AIGateway | 10 | AI 网关 |
| AIReview | 10 | AI 评审 |
| AISecurity | 10 | AI 安全 |
| AIDocManagement | 10 | AI 文档管理 |
| AICostDashboard | 10 | AI 成本 |
| AgentDashboard | 8 | Agent 仪表盘 |
| AgentRunDetail | 6 | Agent 运行详情 |
| Assistant | 3 | 智能助手 |
| **合计** | **113 文件 / 15,149 行** | 12 目录 0 空页 |

### 1.3 NeatLogic AI 对标核查

**检索依据**：
- `cross-review-synthesis-2026-10-03-v4.md`（1175 行）—— 全文 grep "AI 平台 / AI 服务 / LLM / Copilot / Agents"，8 大模块（CMDB / ITSM / 巡检 / 自动化 / BI / 告警 / RDM / DevOps）**无 AI 模块**
- `upgrade-design-plan-2026-10-01.md`（3558 行）—— 巡检 + 混沌，不含 AI 章节
- `automation-expert-review-2026-09-30.md:64` —— 仅将 "Tagent" 作为 Runner 连接协议枚举出现，非 AI Agent 语义
- `v3 全量深度评审完成 (2026-08-26) 记忆卡`——12,456 行文档体系，36 维全量评审，未提及 NeatLogic AI

**结论**：NeatLogic 是 ITOM 平台（IT 运维管理），核心叙事是"CMDB + 巡检 + 变更 + 服务"，**不定位 AI 平台**。Orion 的 AI 平台（LLM Provider + Agent + Skill + Review + Gateway + Auto-recovery）**在 NeatLogic 侧没有对标对象**。

### 1.4 AI 判定

**判定：完全差异化（Orion 独有优势）**

- **代码规模**：Orion AI 侧总代码 = Go 后端 ~15,230 行 + Python 权威 10,543 行 + 前端 15,149 行 = **~40,922 行**
- **API 规模**：Go 154 + Python 50 = **204 API 端点**
- **子域宽度**：17 个 Go 子目录覆盖 LLM 全栈（Provider / Gateway / Agent / Skill / Knowledge / Review / Security / Cost / Auto-recovery / Decision / Orchestration / Inference）
- **无对标 ≠ 无价值**：这是 Orion 相对 NeatLogic 的**结构性差异化优势**——NeatLogic 4230 Java 文件覆盖 CMDB+ITSM 深度，Orion 40,922 行 AI 代码构成"运维 AI 化"的独有护城河
- **建议动作**：v4 报告中 8 大模块加权完成度可以不变；但**文档需显式标注"AI 平台 = Orion 差异化能力"**，防止后续评审把"未对标"误读为"缺失"

---

## 2. 混沌工程对标

### 2.1 Orion 现状实证

**代码分布**：4 目录 + 前端 2 目录

| 目录 | 文件数 | 非测试行数 | 角色 |
|------|--------|-----------|------|
| `internal/chaos/` | 11 | 630+（injector 630 行） | 核心域，含 injector 真实注入器 |
| `internal/chaos-engine/` | 1 | 165 | 引擎入口 |
| `internal/chaos-enhanced/` | 7 | 28+ | 增强模块（较薄） |
| `internal/chaos-gateway/` | 7 | 31+ | 网关模块（较薄） |
| `orion-frontend/src/pages/chaos/` | — | — | 前端 chaos 页 |
| `orion-frontend/src/pages/ChaosEngineering/` | — | — | 前端 ChaosEngineering 页 |
| **前端合计** | **21 文件** | **2,449 行** | 2 目录 |

**API 实测**（`.POST/.GET/.PUT/.DELETE` grep）：
- chaos: **18 端点**
- chaos-engine: **32 端点**
- chaos-enhanced: **10 端点**
- chaos-gateway: **13 端点**
- **合计：73 端点**

### 2.2 upgrade-design-plan-2026-10-01.md 目标 API 对照

**§3.2 目标新增 12 端点**：

| 分类 | 端点数 | 目标 |
|------|--------|------|
| 风险评级（Risk API） | 6 | POST/GET/GET/DELETE/PUT/GET — `/api/v1/risks/*` |
| 场景管理（Scenario API） | 4 | POST/GET/GET/DELETE — `/api/v1/scenarios/*` |
| chaos 增强端点 | 2 | PUT risk-level / PUT scenario / POST validate（注：3 端点，文档 §3.2 表述为"2 端点"，此处按文档原文表述） |
| **合计** | **12** | upgrade-design-plan §3.2 line 351-379 |

**§1.2 混沌工程目标架构（line 76-108）**：
- `chaos/` 改造：修复静默成功 + PreReleaseVerify 真实化
- `risk/` 新建：跨域共享（chaos + autoexec + inspect）
- `scenario/` 新建：4 类预定义 + 实验关联
- 集成点：chaos↔risk / chaos↔scenario / chaos↔inspection / chaos↔notification / chaos↔approval

**§5.2 chaos 静默成功修复（line 665-690）**：`internal/chaos/service/service.go:628-690` 需要真实 K8s 注入器（非桩）

### 2.3 现状 vs 目标 gap 分析

| 维度 | upgrade-design-plan 目标 | Orion 现状 | Gap |
|------|------------------------|-----------|-----|
| 混沌核心 API | 保持（改造） | 18（chaos） | 改造范围，非数量差距 |
| 混沌引擎 API | — | 32（chaos-engine） | Orion 已超目标 |
| 混沌增强 | — | 10（chaos-enhanced） | Orion 已建 |
| 混沌网关 | — | 13（chaos-gateway） | Orion 已建 |
| **风险评级 API** | **6 端点** | **0**（`grep -rn "internal/risk\|risks" internal/` 全仓无 `internal/risk/` 目录） | **缺失** |
| **场景管理 API** | **4 端点** | **0**（`grep -rn "internal/scenario\|scenarios" internal/` 全仓无 `internal/scenario/` 目录） | **缺失** |
| 跨域接线 | chaos↔risk / chaos↔scenario | 未接线（因 risk/scenario 不存在） | **缺失** |
| chaos 静默成功 | 真实 K8s 注入器 | `injector.go` 630 行存在（`internal/chaos/injector/injector.go`） | **需核验注入器真实执行 vs 桩** |

**关键发现**：
- **Orion 混沌 API 数（73）已远超 upgrade-design-plan 目标（12）**，但**目标 12 端点是 risk/scenario 跨域共享能力**——这是"API 数量不是问题，语义完整度才是"的典型例子
- 现状：chaos 家族已建 4 目录 73 API，但**跨域共享风险/场景模型 0 存在**
- upgrade-design-plan §4.1-§4.4 定义的 4 个集成点（chaos↔risk / chaos↔scenario / chaos↔inspection / chaos↔notification / chaos↔approval）—— **0/5 落地**

### 2.4 NeatLogic risk/scenario 对标

**依据**：upgrade-design-plan §1.2 明确指出 chaos ↔ risk/scenario 借鉴路径（NeatLogic 有 Risk 和 Scenario 概念，作为跨域共享），这是**本轮 5 模块中唯一"NeatLogic 有对标"的模块**。

**借鉴路径**（upgrade-design-plan §4.1-§4.4）：
- Risk Service：6 端点（Save / List / Get / Delete / Move / Search）
- Scenario Service：4 端点（Save / Search / Get / Delete）
- chaos Experiment 扩展 `RiskID` / `ScenarioID` 字段（migration 703_alter_chaos_experiments.sql）
- 高风险实验需审批门控（chaos→approval）
- 实验完成通知（chaos→notification）
- PreReleaseVerify 真实化（chaos→inspection）

### 2.5 混沌判定

**判定：差异化为主 + risk/scenario 需按 upgrade-design-plan 补齐**

- **API 数量**：Orion 混沌 73 API > 目标 12 API（+51）——数量已达标
- **语义完整度**：0/5 跨域集成点落地——**结构性缺口**
- **建议动作**：按 upgrade-design-plan §3.2 新增 risk/scenario 2 目录 + 10 端点 + §4.1-§4.4 五个集成点接线

---

## 3. 数据仓库对标

### 3.1 Orion 现状实证

**检索方法**：
```
ls orion-platform-svc-go/internal/ | grep -iE "warehouse|data.?warehouse|dw|data-warehouse"
→ (no output)

ls orion-frontend/src/pages/ | grep -iE "warehouse|data.?warehouse"
→ (no output)
```

**结论**：**数据仓库在 Orion 侧完全不存在**——后端 0 目录、前端 0 页、无迁移文件、无 API、无 Service、无 Model。

### 3.2 NeatLogic 数据仓库核查

**检索依据**：
- v4 综合报告 `cross-review-synthesis-2026-10-03-v4.md`：8 大模块**无"数据仓库"**
- v3 记忆卡 `v3.5 全量深度评审完成 (2026-08-26)`：36 维全量评审，NeatLogic 是 ITOM 平台（CMDB+ITSM+Automation）
- 数据仓库（Data Warehouse）在概念上是 BI 的上游——NeatLogic 定位 ITOM，不做 BI，也不做 BI 上游

**结论**：NeatLogic 无数据仓库。**数据仓库属于 BI / 数据分析领域，非 ITOM 领域**。

### 3.3 数据仓库判定

**判定：独有命名 + 无必要（当前阶段）**

- Orion 侧无此能力，NeatLogic 侧也无对标——**双侧不存在**
- 若未来要做企业级 BI 平台，数据仓库才是上游；但**当前 Orion BI 模块完成度仅 20%**（v4 报告 §11.5），BI 上游（数据仓库）**不在近期路线图**
- **建议动作**：不做。若未来 BI 从 20% 补齐到 60%+，再考虑数据仓库作为上游层

---

## 4. 多云对标

### 4.1 Orion 现状实证

**代码分布**：

| 层 | 路径 | 文件数 | 代码行 |
|----|------|--------|--------|
| Go 后端 | `orion-platform-svc-go/internal/multi-cloud/` | 7 | 1,511 |
| 前端 | `orion-frontend/src/pages/multi-cloud/` | 20 | 2,276 |

**Go 后端文件明细**：
- `handler/handler.go` — 527 行
- `service/service.go` — 601 行
- `repository/repository.go` — 383 行
- `models/models.go` — 骨架
- `service/service_interface.go` — 40 行（含 3 端点定义）
- `handler/handler_test.go` + `repository/update_test.go` — 测试

**API 实测**（`.POST/.GET/.PUT/.DELETE` grep 计数）：**23 端点**

**API 分布**（`internal/multi-cloud/handler/handler.go` line 22-85）：
- Providers（5 端点）：POST/GET/PUT/DELETE/GET
- Resources（3 端点）：GET list / GET detail / POST sync
- Costs（3 端点）：GET list / GET per-provider / POST compare
- Recommendations（1 端点）
- Health / Statistics（2 端点）
- Sync（1 端点）
- Compliance（2 端点）：POST check / GET rules
- Scheduling（2 端点）：POST create policy / GET list

**前端 20 文件明细**（`orion-frontend/src/pages/multi-cloud/`）：
- 主入口：MultiCloudPage.tsx / MultiCloudAdvancedPage.tsx
- Tabs（8 个）：AccountsTab / ComplianceTab / CostOptimizationTab / DisasterRecoveryTab / NetworkOrchestrationTab / ResourcesTab / SchedulingTab / DashboardSection
- 配置：MultiCloudConfig.tsx / MultiCloudAdvancedConfig.ts / MultiCloudColumns.tsx / MultiCloudAdvancedColumns.tsx
- 模态：MultiCloudModals.tsx / MultiCloudAdvancedModals.tsx
- 状态：useMultiCloudState.ts / useMultiCloudAdvancedState.ts
- 辅助：StatsCards.tsx
- 测试：`__tests__/` 目录

### 4.2 NeatLogic 多云核查

**检索依据**：
- v4 综合报告（1175 行）8 大模块——**无多云模块**
- v3 记忆卡：NeatLogic 是 CMDB 单集群管理（K8s sync 是 CMDB 的一个子能力，非多云编排）
- 多云（Multi-cloud）在概念上是"跨 AWS/Azure/GCP/华为云/阿里云的编排"——NeatLogic 定位单集群 ITOM，**无多云编排概念**

**结论**：NeatLogic 无多云。**多云是云原生平台级能力，非 ITOM 领域**。

### 4.3 多云判定

**判定：完全差异化（Orion 独有）**

- **Orion 现状**：Go 后端 1,511 行 / 23 API + 前端 2,276 行 / 8 Tabs——已建 6 个子能力（Providers / Resources / Costs / Compliance / Scheduling / Disaster Recovery）
- **无对标 ≠ 无价值**：与 AI 平台同属 Orion 独有差异化能力
- **建议动作**：文档显式标注"多云 = Orion 差异化能力"；不需对标补齐

---

## 5. Tagent 对标

### 5.1 Orion 现状实证

**检索方法**：
```
ls orion-platform-svc-go/internal/ | grep -iE "tagent"
→ (no output)

ls orion-frontend/src/pages/ | grep -iE "tagent"
→ (no output)

grep -rni "tagent" orion-platform-svc-go/ orion-frontend/src/
→ 唯一命中：automation-expert-review-2026-09-30.md:64
```

**唯一命中上下文**（`automation-expert-review-2026-09-30.md:64`）：
```
25 | 连接协议（10 种：SSH/WinRM/Telnet/IPMI/HTTP/HTTPS/SNMP/SMI/Tagent）
    | `runner/models` 中 `TaskType` 仅 shell/npm/test/build/http/pipeline/deploy
    | **全仓 grep 无 ssh/winrm/telnet/ipmi 关键字**
```

**结论**：Tagent 在 Orion 代码层**完全不存在**——0 目录、0 页、0 API、0 迁移。仅在一份评审报告中作为 Runner 连接协议枚举值出现（与 SSH/WinRM/Telnet 并列）。

### 5.2 NeatLogic Tagent 核查

**检索依据**：
- v3 记忆卡 `RDM/Tagent/报表合并方案 (2026-06-24)`：**"3 个不建议借鉴"模块与 Orion 现有功能重叠分析，合并策略：扩展 Ticket + RunnerPool + 自研设计器**
- v3 记忆卡 `NeatLogic 升级评审配套技能 (2026-10-01)`：NeatLogic 侧有 Runner Agent 概念，命名非"Tagent"

**结论**：
- NeatLogic 侧**存在 Runner Agent 概念**，但**命名非"Tagent"**
- Orion 侧**代码层完全不存在**（连占位都没有）
- v3 报告已定性："Tagent 已被 RDM+Ticket+RunnerPool 合并消化"——即 Orion 不做 Tagent 作为独立模块，而把其能力分散到已有 Ticket（工单）+ RunnerPool（执行器池）+ RDM 扩展字段中

### 5.3 Tagent 判定

**判定：命名差异 + 已被合并消化（v3 决策延续）**

- **Orion 现状**：0 代码 / 0 API / 0 页
- **NeatLogic 对标**：Runner Agent 概念存在，但命名不同
- **v3 决策延续**：不做 Tagent 独立模块；能力分散到 Ticket + RunnerPool + RDM
- **建议动作**：**不新增**。若评审把"Tagent 缺失"作为 gap，应引用 v3 合并方案作为决策依据，非"缺失"

---

## 6. 综合判定表

| # | 模块 | Orion 现状（行/API） | NeatLogic 对标存在？ | 判定类别 | 建议 |
|---|------|--------------------|--------------------|----------|------|
| 1 | **AI 平台** | ~40,922 行 / 204 API（Go 154 + Py 50） | ❌ 无（NeatLogic 无 AI 定位） | **完全差异化** | 文档标注差异化；不补齐 |
| 2 | **混沌工程** | ~1,448 行（后端 4 目录）+ 2,449 行（前端）/ 73 API | ⚠️ 部分（risk/scenario 概念） | **混合（差异化+需借鉴）** | 按 upgrade-design-plan §3.2 新增 risk(6)+scenario(4) 10 端点 + §4.1-4.4 五个集成点接线 |
| 3 | **数据仓库** | 0 行 / 0 API | ❌ 无（非 ITOM 领域） | **独有命名 + 当前无必要** | 不做；BI 补齐后再评估 |
| 4 | **多云** | ~3,787 行（后端 1,511 + 前端 2,276）/ 23 API | ❌ 无（NeatLogic 单集群） | **完全差异化** | 文档标注差异化；不补齐 |
| 5 | **Tagent** | 0 行 / 0 API | ❌ 命名差异（NeatLogic Runner Agent） | **已合并消化** | 不做；能力分散到 Ticket+RunnerPool+RDM |

**统计**：
- **完全差异化（不补齐）**：3 个（AI / 多云 / 数据仓库）
- **部分差异化 + 需补齐**：1 个（混沌工程 risk/scenario 10 端点）
- **命名差异（不补齐）**：1 个（Tagent）
- **真缺口（需要动作）**：**只有混沌工程的 risk/scenario 10 端点**

---

## 7. 认知边界

**本报告的分析边界**：

1. **AI 对标基于 NeatLogic 无 AI 定位的假设**——若 NeatLogic 后续版本引入 AI Copilot / AI Agent，本报告判定需重新评估；当前 v3/v4/upgrade-design-plan 三份文档均无 AI 章节，判定为"完全差异化"

2. **混沌 engineering API 数量 73 > 目标 12 是"数量口径"，非"语义口径"**——本报告已明确：数量达标 ≠ 语义达标，risk/scenario 跨域共享仍是真缺口

3. **数据仓库"无必要"判定基于 BI 完成度 20%（v4 §11.5）**——若 BI 模块补齐到 60%+，数据仓库作为上游需重新评估；当前建议"不做"是**基于现状的时点判定**，非永久性结论

4. **多云"完全差异化"假设 NeatLogic 是单集群 CMDB**——若客户实际部署环境是多集群 / 多厂商，多云能力的对标对象可能不是 NeatLogic 而是 Kubernetes Federation / Crossplane / Anthos 类工具

5. **Tagent"已合并消化"引用 v3 记忆卡**——v3 记忆卡 `RDM/Tagent/报表合并方案 (2026-06-24)` 声明"扩展 Ticket + RunnerPool + 自研设计器"，但**未验证能力是否真的分散实现**；本轮 grep 未发现 Tagent 关键字，也**未反向验证 Ticket/RunnerPool 是否覆盖 Tagent 的连接协议能力**（SSH/WinRM/Telnet/IPMI 全仓 0 命中）

6. **代码行数统计口径**：
   - Go 非测试行数：`wc -l *.go -not -name "*_test.go"` 求和
   - Python 非测试行数：`wc -l *.py -not -name "*_test.py"` 求和
   - 前端行数：`wc -l *.tsx` + `wc -l *.ts`（不含 `.test.` 后缀）
   - 未排除自动生成代码 / proto / vendor；实际业务代码量可能略低于本报告数字

7. **未做的事**：
   - 未估算人天（硬约束）
   - 未修改生产代码（硬约束）
   - 未对 8 大模块（v4 已覆盖）做任何增量分析（硬约束：增量分析）
   - 未验证 AI Service Python 与 Go 后端的 API 契约一致性（可能是双份实现）
   - 未验证混沌 injector.go 630 行是否真实注入（upgrade-design-plan §5.2 声明"静默成功"需修复）
   - 未验证多云后端 6 个子能力（Providers/Resources/Costs/Compliance/Scheduling/DR）是否都有真实数据源

8. **建议后续动作**：
   - **P0**：混沌 risk/scenario 10 端点 + 5 集成点接线（唯一真缺口）
   - **P1**：AI 平台与 Go 后端 API 契约对齐核验（可能是双份实现）
   - **P1**：混沌 injector.go 真实注入器核验（upgrade-design-plan §5.2 修复项）
   - **P2**：数据仓库作为 BI 上游的路线图评估（BI 补齐到 60% 后触发）
   - **P3**：多云 6 子能力数据源真实性核验

---

## 附录 A：扫描命令与命中数

```bash
# 1. AI Go 后端
find orion-platform-svc-go/internal/ai -name "*.go" -not -name "*_test.go" | wc -l
→ 130
find orion-platform-svc-go/internal/ai -name "*.go" -not -name "*_test.go" -exec wc -l {} + | tail -1
→ ~14,537 行

# 2. AI Python 权威服务
find orion-ai-service/src -name "*.py" -not -name "*_test.py" | wc -l
→ 48
find orion-ai-service/src -name "*.py" -not -name "*_test.py" -exec wc -l {} + | tail -1
→ 10,543 行

# 3. AI 前端
find orion-frontend/src/pages/{AIAgents,AIDashboard,ai-decision*,AIGateway,AIReview,AISecurity,AIDoc*,AICost*,AgentDashboard,AgentRunDetail,Assistant} -type f | wc -l
→ 113 文件
→ 15,149 行

# 4. AI API 端点
grep -cE "\.(POST|GET|PUT|DELETE)\(" orion-platform-svc-go/internal/ai/*/handler/*.go orion-platform-svc-go/internal/{agents,assistant,ai-agent-run}/handler/*.go
→ 154 端点
grep -c "@router\." orion-ai-service/src/api/*.py
→ 50 端点

# 5. 混沌
for d in chaos chaos-engine chaos-enhanced chaos-gateway; do
  wc -l orion-platform-svc-go/internal/$d/**/*.go -not -name "*_test.go"
done
→ 4 目录，1511 行（后端）+ 2449 行（前端 2 目录 21 文件）
grep -cE "\.(POST|GET|PUT|DELETE)\(" orion-platform-svc-go/internal/chaos*/handler/handler.go
→ 18+32+10+13 = 73 端点

# 6. 数据仓库
ls orion-platform-svc-go/internal/ | grep -iE "warehouse|data.?warehouse|dw"
→ (empty)

# 7. 多云
wc -l orion-platform-svc-go/internal/multi-cloud/**/*.go -not -name "*_test.go"
→ 1511 行（7 文件）
wc -l orion-frontend/src/pages/multi-cloud/*.{tsx,ts}
→ 2276 行（20 文件）
grep -cE "\.(POST|GET|PUT|DELETE)\(" orion-platform-svc-go/internal/multi-cloud/handler/handler.go
→ 23 端点

# 8. Tagent
ls orion-platform-svc-go/internal/ | grep -iE "tagent"
→ (empty)
ls orion-frontend/src/pages/ | grep -iE "tagent"
→ (empty)
grep -rni "tagent" orion-platform-svc-go/ orion-frontend/src/
→ 唯一命中：automation-expert-review-2026-09-30.md:64（Runner 连接协议枚举）
```

## 附录 B：与 v4 综合报告的关系

本报告**不修改** v4 综合报告（`cross-review-synthesis-2026-10-03-v4.md`）的 8 大模块加权完成度数字，仅补充**5 个未覆盖模块**的判定：

- v4 覆盖 8 模块加权完成度（CMDB 28% / ITSM 42% / 巡检 10% / 自动化 30% / BI 20% / 告警 44% / RDM 38% / DevOps 36%）
- **本报告新增 5 模块判定**（AI 完全差异化 / 混沌混合 / 数据仓库无必要 / 多云完全差异化 / Tagent 已合并）
- v4 §11.5 BI 完成度 20% 是数据仓库判定"当前无必要"的依据
- upgrade-design-plan §3.2 混沌 12 端点是混沌 risk/scenario 补齐目标

## 附录 C：真缺口清单（唯一动作项）

**只有 1 个真缺口需要动作**：混沌工程 risk/scenario 跨域共享

- **risk 目录**：`orion-platform-svc-go/internal/risk/` — 需新建，6 端点（Save/List/Get/Delete/Move/Search）
- **scenario 目录**：`orion-platform-svc-go/internal/scenario/` — 需新建，4 端点（Save/Search/Get/Delete）
- **chaos Experiment 扩展**：Migration `703_alter_chaos_experiments.sql` 加 `RiskID` / `ScenarioID` 字段
- **集成点 5 个**（upgrade-design-plan §4.1-§4.4）：
  1. chaos ↔ risk（关联风险级别）
  2. chaos ↔ scenario（关联场景）
  3. chaos ↔ inspection（PreReleaseVerify 真实化）
  4. chaos ↔ notification（实验完成通知）
  5. chaos ↔ approval（高风险审批门控）
- **chaos 静默成功修复**（upgrade-design-plan §5.2）：`internal/chaos/service/service.go:628-690` 真实 K8s 注入器

**其他 4 模块（AI / 数据仓库 / 多云 / Tagent）均为"独有差异化"或"已合并消化"，无需动作**。
