---
title: 平台双 JD 能力扩展需求文档
created: "2026-08-13"
branch: feat/wave2-parallel-execution
---

# 平台双 JD 能力扩展需求文档

> 依据两份岗位 JD，将 Orion 平台自身视为候选系统，评审当前能力覆盖度，并将缺失能力转化为可执行的需求条目。目的：让 Orion 自身成为"演示级"的 AI 工程平台 + 运维平台产品，同时作为 JD 能力的验证载体。

---

## 一、需求来源（两份 JD 提炼）

### JD-1：工程平台 AI 方向（架构设计 + AI Agent 落地）

| 编号 | 能力域 | 关键要求 |
|------|--------|---------|
| A1 | 平台 AI 整体规划 | 技术规划、架构设计、关键模块研发 |
| A2 | AI Agent 产品形态 | 知识库问答、生产问题诊断、根因定位、告警解释、故障复盘辅助、研发流程自动化 |
| A3 | 企业级系统知识库 | 打通代码仓库、文档、服务目录、监控告警、日志链路、工单、变更记录、故障复盘数据源 |
| A4 | RAG / Agent 核心机制 | RAG、Agent 编排、工具调用、上下文管理、权限控制、结果评测、反馈闭环 |
| A5 | AI 展现形态 | ChatOps、平台内助手、故障诊断面板、自动化工作流、智能推荐、Copilot |
| A6 | AI 应用工程化 | 可观测性、成本控制、Prompt/Agent 版本管理、评测集、灰度发布、安全治理、效果度量 |
| A7 | 技术演进 | 大模型、Agent、AIOps、可观测性、工程平台新技术选型 |

### JD-2：运维平台方向（产品设计 + 核心模块开发）

| 编号 | 能力域 | 关键要求 |
|------|--------|---------|
| B1 | 运维平台产品 | 自动化运维、ITSM、CMDB、工单流转 |
| B2 | 架构与工程 | 可扩展性、稳定性、易用性负责人 |
| B3 | 迭代治理 | 迭代、重构、性能优化、故障治理 |
| B4 | 跨团队协同 | 运维/基础架构/网络安全协同、多团队统一落地 |
| B5 | AIOps 智能化 | AIOps、流程编排、低代码方向 |
| B6 | 关键技术攻关 | 难点攻关、技术方案评审 |

---

## 二、当前能力覆盖度评审（基于现有代码实测）

### 2.1 覆盖率总览

| 能力域 | 现有实现 | 覆盖度 |
|--------|---------|--------|
| A1 规划/架构 | `ai/orchestration`、`ai/decisions`、`ai/gateway` | ⭐⭐⭐⭐ 有骨架 |
| A2 AI Agent | `knowledge`(RAG)、`rca`、`diagnostic`、`incident`(converse) | ⭐⭐⭐⭐ 有 |
| A3 系统知识库 | `knowledge`(Space/Doc/Sync) + `ai/vector` + `code-embedding` | ⭐⭐⭐ 数据源未全打通 |
| A4 RAG/Agent 机制 | RAGPipeline、SafetyFilter、Eval、Feedback、Tool | ⭐⭐⭐⭐ 有 |
| A5 展现形态 | `chatops`、`AIDashboard`、诊断面板 | ⭐⭐⭐ 无统一 Copilot |
| A6 工程化 | `ai/models`(canary/version)、`llm-trace`(成本)、`prompt-security` | ⭐⭐⭐ 评测/灰度弱 |
| A7 技术演进 | `mcp`、`ai/semantic-search` | ⭐⭐⭐ 有探索 |
| B1 运维产品 | `pipeline`、`cmdb`、`ticket`、`workflow`、`lowcode` | ⭐⭐⭐⭐⭐ 强 |
| B2 架构工程 | Repository 模式、tenant 隔离、Saga | ⭐⭐⭐⭐ |
| B3 迭代治理 | S 级全量升级、测试 21500+ | ⭐⭐⭐⭐⭐ |
| B4 跨团队 | 多域模块全 | ⭐⭐⭐⭐ |
| B5 AIOps | `alert-*`、`rca`、`incident`、`self-healing` | ⭐⭐⭐⭐⭐ 强 |
| B6 攻关 | `cross-domain`、`decision-explanation` | ⭐⭐⭐ |

### 2.2 已具备的完整能力（无需新建）

| 能力 | 位置 | 备注 |
|------|------|------|
| 自动化运维 Pipeline | `internal/pipeline-engine|executor|sse|template|version` | 完整 |
| CMDB | `internal/cmdb` | 30 服务/Adapter/BFS |
| ITSM 工单 | `internal/ticket` | SLA/分派/队列/转派 |
| 审批编排 | `internal/approval` + `workflow` | 完整 |
| 可观测性 | `internal/observability` + `alert-*` | 完整 |
| AI 引擎骨架 | `internal/ai/*` | 编排/RAG/推理/网关 |
| AIOps | `internal/rca` + `incident` + `self-healing` | 完整 |
| MCP 服务 | `internal/mcp` | 有 handler/service/repo |

---

## 三、差距需求列表（TR-xx：To-Requirement）

按优先级（P0 直接对应 JD 明确要求；P1 工程化补强；P2 深化）。

### P0 需求（JD 直接点名但目前缺口）

#### TR-01 告警解释（AI 解释端点） · 对应 JD-1 A2/A4 ✅ 已实现
**现状**：`alert` 服务无 Explain 能力；`rca` 有 `Analyze`/`SuggestFixes` 但未接到 alert。
**实现**：
- [x] `internal/alert` 新增 `GET /api/v1/alert/:id/explain` 端点（`ExplainAlert`）
- [x] 规则式解释（无 LLM 依赖）：`inferCause` 按 metric/name 分类（CPU/内存/延迟/错误率）
- [x] 输出：自然语言摘要 + 可能原因 + 关系（duplicate/suppressed/standalone）+ 证据链 + 建议
- [x] 复用 `GetKnownIssueByPattern` 关联已知问题
- [ ] 前端 Alert 详情页加"AI 解释"按钮（面板）
**测试**：`internal/alert/service/explain_test.go` 7 例（inferCause 全分支 + truncate）
**验证**：点开任意告警 → 一键解释 → 展示结论 + 证据链。

#### TR-02 全局智能助手（AI Copilot 统一入口） · 对应 JD-1 A5/A3 ✅ 已实现
**现状**：AIDashboard + ChatOps 分散，无跨模块（pipeline/告警/工单/日志）统一问答入口。
**实现**：
- [x] 新建 `internal/assistant`（意图识别 + 多源检索 + 模板/LLM 生成）
  - `detectIntent` 自动识别 alert/ticket/pipeline/change/knowledge
  - `SourceProvider` 插拔接口，wiring 注入 knowledge RAG + pipeline 适配器
  - knowledge provider 在任意意图下补充上下文
  - 可选 `LLMClient`（未配置时回退模板答案）
- [x] 路由 `POST /api/v1/assistant/ask` + `GET /assistant/health`
- [x] 前端全局悬浮 Copilot 组件 + `/assistant` 页面（2026-08-14 `CopilotFloating` 组件）
- [ ] 会话上下文管理（短时 + 长时）
**测试**：`internal/assistant/service/service_test.go` 8 例（意图路由/聚合/兜底模板）
**验证**：用户输入"为什么订单一小时前失败" → 助手串联 pipeline + 知识库给出一份答复。

#### TR-03 变更 AI 分析（变更风险/失败根因） · 对应 JD-1 A3（变更记录数据源） ✅ 已实现
**现状**：`change` 管理变更无 AI 分析。
**实现**：
- [x] `internal/change` 加 `AnalyzeChangeRisk(ctx, tenantID, changeID)`（规则评分 0-100）
  - 维度：类型、声明风险、优先级、关键词（db/migration/迁移/权限/主库/生产/ssl）、历史完成率
  - 输出 `ChangeRiskAnalysis`：分数 + low/medium/high + 因素明细 + 建议
- [x] 路由 `GET /api/v1/change/:id/risk`
- [ ] `ExplainChangeFailure`（变更失败根因）— P1 扩展
- [x] 前端变更详情页加 "AI 风险评估"面板（2026-08-14）
**测试**：`internal/change/service/risk_test.go` 5 例
**验证**：对一条变更给出风险等级 + 依据。

#### TR-04 数据源打通（告警/日志/工单向量化） · 对应 JD-1 A3 ✅ 已实现
**现状**：`knowledge.TriggerSync` 主接文档/仓库；告警/日志/工单未入知识库。
**实现**：
- [x] `internal/knowledge` 新增 `POST /api/v1/ingest/source`（`IngestFromSource`）
  - `SourceIngestRequest{source, items}`：source ∈ alert/ticket/incident/change
  - 每条记录转为 `kb_docs` Document（标题带 `source[id]` 标记，tags 含 source+status）
  - 默认空间映射 `defaultSourceSpace`：space-ops-alert/ticket/incident/change
- [x] 接入 `ai/vector` 检索路径：入库后即被 `Retrieve`（ILIKE）覆盖，可被 assistant 的 knowledge provider 检索
- [ ] 周期调度 ingestion（需 external scheduler 推送，当前为 on-demand API）
- [ ] 数据源过滤（RAG 检索按 source 过滤）— 可用 space_id 近似实现
**测试**：`internal/knowledge/service/ingest_test.go`（defaultSourceSpace 映射）
**验证**：通过 API 投递告警/工单记录 → knowledge.Retrieve 可检索到片段。

### P1 需求（工程化标准补强）

#### TR-05 评测集工程化 · 对应 JD-1 A6 ✅ 已实现
**现状**：`knowledge` 有 EvalMetrics + GroundTruth，但无评测集管理/回归对比/AutoEval。
**实现**：
- [x] 迁移 `401_create_eval_sets.sql` + `402_create_eval_runs.sql`（eval_sets / eval_set_cases / eval_runs）
- [x] `CreateEvalSet`（批量导入用例，含 gold_answer/gold_sources/tags）
- [x] `RunEval`（对每个 case 跑 Retrieve 判分，输出 pass_rate/avg_recall/avg_score JSON report）
- [x] `CompareRuns`（Base/Head 对比，输出 pass_rate/recall/score delta + regression 标记）
- [x] 路由：`POST /eval/sets`、`GET /eval/sets`、`GET /eval/sets/:id`、`DELETE /eval/sets/:id`、`POST /eval/sets/:id/run`、`POST /eval/compare`、`GET /eval/runs`
**测试**：`internal/knowledge/service/eval_set_service_test.go` 9 例（含回归检测 mock）
**验证**：新建评测集 → 跑分 → 对比两次结果，能观察回归。

#### TR-06 Prompt/Model Canary 联动 · 对应 JD-1 A6 ✅ 已实现
**现状**：`ai/models` 有模型 canary/版本；`PromptTemplateManager` 无版本管理；Agent 未按分组灰度。
**实现**：
- [x] `PromptTemplateManager.PublishCanaryPrompt`（新版本以 canary 发布，保留 active 版本）
- [x] `GetPromptWithCanary`：基于 callerID FNV-1a 稳定散列分流到 canary 桶
- [x] `PromptVersionStats`：版本历史 + active/canary 版本标识
- [x] 路由：`POST /rag/prompt/canary`、`GET /rag/prompt/canary/:name`
- [ ] Agent Run 指定 canary 分组（可调用 `GetPromptWithCanary` 完成）
- [ ] 效果指标联动（llm-trace by-version 比较）→ TR-08 已有 usage dashboard 可扩展
**测试**：`internal/knowledge/service/canary_test.go` 6 例（桶稳定性/流量分布/单调性）
**验证**：发布新 prompt → 按 callerID 灰度 10% → 观测指标 → 全量。

#### TR-07 故障复盘辅助 · 对应 JD-1 A2 ✅ 已实现
**现状**：`incident` 有 Postmortem 管理，但无 AI 辅助（时间线自动汇总、改进项提取）。
**实现**：
- [x] `incident.GeneratePostmortemDraft`（规则式，无需 LLM）：从 incident 元数据 + timeline 生成
  - Title（含 severity）、Summary、RootCause 启发式推断（timeout/oom/disk/5xx/变更关联）
  - ContributingFactors、TimelineSummary（压缩事件）、ActionItems、LessonsLearned
- [x] 路由 `GET /incident/:id/postmortem/draft`
- [x] 前端复盘页"AI 生成草稿"按钮（2026-08-14）
**测试**：`internal/incident/service/postmortem_draft_test.go` 8 例
**验证**：点按钮 → 生成结构化工单复盘草稿。

#### TR-08 模型网关遥测/成本控制面板 · 对应 JD-1 A6（AIGC 成本） ✅ 已实现
**现状**：`ai/gateway` + `llm-trace` 记录请求与成本，但无集中成本看板与限流策略联动。
**实现**：
- [x] `llm-trace.GetUsageDashboard`：按时间窗口聚合 总调用/令牌/成本 + 按模型 + 按天趋势 + 按租户 + 线性月成本投影
- [x] 路由 `GET /llm/usage/dashboard`（支持 startDate/endDate）
- [ ] 成本预算阈值触发（复用 `finops` BudgetGuard 模式，可后续接线）
- [ ] 前端 `AICostDashboard` 扩展按模型/租户过滤与告警
**测试**：`internal/llm-trace/service/dashboard_test.go` 6 例（聚合/租户视图)
**验证**：看板展示各模型调用量与成本；超额触发告警。

### P2 需求（深化 / 场景化）

#### TR-09 研发流程自动化 Agent（Ticket→Pipeline 联动） · 对应 JD-1 A2/A5
**现状**：`ticket` 有 generator/dispatch，但无"自然语言发起研发流程"。
**需求**：
- [ ] 助手识别工单意图 → 触发 `pipeline` 创建 + 绑定参数
- [ ] 工单状态自动流转（提案→执行→完成）
**验证**："帮我部署 v2.1 到 staging" → 自动生成流水线并执行。

#### TR-10 低代码 + AI 生成（`lowcode` 页面 AI 生成） · 对应 JD-2 B5
**现状**：`lowcode-designer` 有设计器，无 AI 生成页面。
**需求**：
- [ ] `POST /api/lowcode/ai-generate`（自然语言 → 组件树 JSON）
- [ ] 复用 `ai/llm` + `lowcode` schema
- [ ] 前端设计器加"AI 生成"按钮
**验证**：输入"做一个发布记录列表页" → 生成可编辑的组件树。

#### TR-09 研发流程自动化 Agent（Ticket→Pipeline 联动） · 对应 JD-1 A2/A5 ✅ 已实现
**实现**：
- [x] `assistant` 意图识别 → `ActionTriggerPipeline` executor → `pipeline.Svc` 创建 + 执行
- [x] `POST /assistant/action` 路由（handler→service→executor 全链路）
- [x] 前端 "触发研发流程 Agent" 按钮（Assistant 智能操作面板）
**验证**："帮我部署 v2.1 到 staging" → 创建流水线并执行。

#### TR-10 低代码 + AI 生成（`lowcode` 页面 AI 生成） · 对应 JD-2 B5 ✅ 已实现
**实现**：
- [x] `lowcode.GenerateFlowFromPrompt`：自然语言 → 组件树 JSON（LLM 驱动）
- [x] `POST /lowcode/ai-generate` 路由
- [x] 前端 "AI 生成流程" 按钮（Assistant 智能操作面板）
**验证**：输入"做一个发布记录列表页" → 生成可编辑的组件树。

#### TR-11 运维问答助手（Ops FAQ 场景） · 对应 JD-1 A5 + JD-2 B5 ✅ 已实现
**实现**：
- [x] `assistant` Ops 意图分支：`ActionSuggestCommand` executor → `runbook.Query` → 可执行命令 + 预填执行面板
- [x] 前端 "Ops 问答助手" 按钮
**验证**："如何扩容 xx 服务副本" → 给出命令 + 一键预填执行。

---

## 四、实施路线图

### Phase 0（打底） ✅ 已完成 2026-08-13
1. ✅ 新建 `internal/assistant`（Router + 意图识别 + SourceProvider 插拔 + 模板/LLM 生成）
2. ✅ knowledge 打通 ingestion 管道（alert/ticket/incident/change → kb_docs）

### Phase 1（P0 全部） ✅ 已完成 2026-08-13
1. ✅ TR-01 告警解释（`GET /alert/:id/explain`）
2. ✅ TR-02 全局智能助手（`POST /assistant/ask`，接 knowledge RAG + pipeline）
3. ✅ TR-03 变更 AI 分析（`GET /change/:id/risk`）
4. ✅ TR-04 数据源打通（`POST /ingest/source`）

### Phase 2（P1 工程化） ✅ 已完成 2026-08-13
1. ✅ TR-05 评测集（`/eval/sets` + `/eval/sets/:id/run` + `/eval/compare`）
2. ✅ TR-06 Prompt/Model Canary（`/rag/prompt/canary`，FNV 分流）
3. ✅ TR-07 复盘辅助（`GET /incident/:id/postmortem/draft`）
4. ✅ TR-08 成本面板（`GET /llm/usage/dashboard`）

### Phase 3（P2 场景化） ✅ 已完成 2026-08-14
1. ✅ TR-09 研发流程自动化 Agent（`POST /assistant/action` + `ActionTriggerPipeline`）
2. ✅ TR-10 低代码 AI 生成（`lowcode.GenerateFlowFromPrompt` + `ActionGenerateFlow`）
3. ✅ TR-11 Ops 问答助手（`ActionSuggestCommand` + `runbook.Query`）

---

## 五、质量门控与验收标准

| 门控 | 检查 |
|------|------|
| 编译 | `go build ./...` 通过 |
| 静态 | `go vet ./...` 无新增告警 |
| 测试 | `go test ./internal/... -count=1` 全通过（新增用例覆盖每张 TR 的 CRUD + 主场景） |
| 规范 | 遵循 tenants 隔离（ctx tenantID 贯穿）、ServiceInterface 模式、S 层（logging/trace） |
| 后端门控 | 所有新增查询含 tenant_id；异常用结构化日志；无直接 SQL 拼接；handler 走 ServiceInterface |
| 前端门控 | 交互链 8 项（loading/success/error/empty/confirm）；Design Token；每块新 UI 有反馈 |
| 文档 | 每张 TR 完成后更新本文件勾选框 |

---

## 六、风险与前置

| 风险 | 说明 | 缓解 |
|------|------|------|
| rca/diagnostic 重复 | 已有 rca + diagnostic 职责重叠 | 告警解释优先复用 rca.Analyze，不重复实现 |
| ingestion 性能 | 大对象源向量化成本高 | 增量同步 + 去重 + 只存 embedding 摘要 |
| LLM 成本 | Assistant 多跳调用贵 | 检索优先、单次 LLM 汇总、token 预算（llm-trace 计费） |
| 效果度量 | 无统一评测基线 | TR-05 评测集先行，作为所有 P1 的验收基线 |
| 前端工作量大 | 25 个 AI 页已存在，新增入口需收敛 | Copilot 全局组件复用 AIDashboard 已有能力 |