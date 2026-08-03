# AI 域 & 剩余模块深度分析 (2026-08-02)

> **覆盖**: 21 模块 / ~450 行 | **原深度分析覆盖率**: 剩余 7%
> **AI 域**: `orion-platform-svc-go/internal/ai/` — 25 子组件统一容器

---

## 一、AI 域总览 (internal/ai/ — 169 文件 / 44H / 52S / 31R / 29T / ✅ Wired / ✅ Routes)

`internal/ai/` 是 AI 功能的统一容器，包含 **25 个子组件**，每个子组件有独立的 handler/service/repository/models：

| 子组件 | H | S | R | T | 能力 |
|--------|:-:|:-:|:-:|:-:|------|
| **ai/llm** (大模型) | 2 | 3 | 2 | 4 | LLM 调用/Token 预估/模型管理 |
| **ai/decisions** (决策) | 2 | 3 | 2 | 2 | AI 决策引擎 |
| **ai/gateway** (AI 网关) | 2 | 3 | 2 | 2 | 多模型路由/限流 |
| **ai/cost** (成本) | 2 | 3 | 2 | 2 | Token 用量/成本追踪 |
| **ai/review** (评审) | 2 | 3 | 2 | 2 | AI 代码评审 |
| **ai/security** (安全) | 2 | 3 | 2 | 2 | AI 安全审计 |
| **ai/degradation** (降级) | 2 | 3 | 2 | 2 | AI 服务降级 |
| **ai/skill** (技能) | 2 | 3 | 1 | 3 | 技能管理 |
| **ai/models** (模型) | 2 | 3 | 2 | 2 | 模型注册/管理 |
| **ai/orchestration** (编排) | 2 | 2 | 1 | 1 | AI Agent 编排 |
| **ai/intelligence** (智能) | 2 | 2 | 1 | 2 | 智能分析 |
| **ai/agents** (Agent) | 2 | 4 | 2 | 2 | Agent 管理 |
| **ai/aiagent** (AI Agent) | 2 | 2 | 1 | 1 | Agent 运行 |
| **ai/aicost** (AI 成本) | 2 | 2 | 1 | 1 | 成本计算 |
| **ai/aigateway** (网关 v2) | 2 | 1 | 1 | 0 | 网关路由 |
| **ai/aireview** (评审 v2) | 2 | 1 | 1 | 0 | 评审引擎 |
| **ai/aisecurity** (安全 v2) | 2 | 1 | 1 | 0 | 安全策略 |
| **ai/auto-recovery** (自愈) | 2 | 2 | 1 | 1 | 自动恢复 |
| **ai/vector** (向量) | 1 | 1 | 1 | 0 | 向量检索 |
| **ai/semantic-search** (语义搜索) | 1 | 1 | 1 | 0 | 语义检索 |
| **ai/llm-provider** (LLM 提供商) | 0 | 0 | 0 | 0 | 提供商接口 |
| **ai/code-embedding** (代码嵌入) | 1 | 1 | 0 | 0 | 代码 Embedding |
| **ai/inference** (推理) | 1 | 1 | 1 | 0 | 推理服务 |
| **ai/prompt-security** (提示安全) | 1 | 1 | 0 | 0 | 提示注入防护 |
| **ai/rule-engine** (规则引擎) | 1 | 1 | 0 | 0 | 规则执行 |
| **ai/task-executor** (任务执行) | 1 | 1 | 0 | 0 | 任务调度 |

**核心能力**:
- **LLM 调用**: Token 预估 (`llm/service/estimate_test.go`)、多模型路由
- **AI Agent**: 2 Agent 子组件 (agents + aiagent)
- **AI 安全**: 2 安全子组件 (security + aisecurity)
- **AI 评审**: 2 评审子组件 (review + aireview)
- **向量/语义**: vector + semantic-search + code-embedding
- **编排/决策**: orchestration + decisions
- **29 测试** — AI 域测试覆盖率最高

---

## 二、剩余独立模块

| 模块 | 文件 | 测试 | H | S | R | 路由 | Wired | 评分 |
|------|:----:|:----:|:-:|:-:|:-:|:----:|:-----:|:----:|
| **application** (应用聚合) | 26 | 7 | 1 | 1 | 1 | ❌ | ❌ | **90%** |
| **crossover** (跨域调用) | 7 | 2 | 0 | 1 | 0 | ❌ | ❌ | 70% |
| **branch-policy** (分支策略) | 7 | 1 | 2 | 2 | 2 | ❌ | ❌ | 75% |
| **bi-dashboard** (BI 仪表板) | 7 | 1 | 2 | 2 | 2 | ✅ | ❌ | 80% |
| **apk-upload-history** (APK 上传) | 7 | 1 | 2 | 2 | 2 | ❌ | ❌ | 75% |
| **api-consumption** (API 消费) | 7 | 1 | 2 | 2 | 2 | ✅ | ❌ | 80% |
| **vulnerability** (漏洞管理) | 7 | 1 | 2 | 2 | 2 | ❌ | ❌ | 75% |
| **alert-adapter** (告警适配) | 11 | 0 | 1 | 8 | 1 | ❌ | ❌ | 60% |
| **alert-adapter-v2** (告警适配 v2) | 4 | 0 | 0 | 2 | 1 | ❌ | ❌ | 50% |
| **alert-correlation** (告警关联) | 6 | 0 | 2 | 1 | 2 | ❌ | ❌ | 55% |
| **alert-silence** (告警静默) | 5 | 0 | 1 | 1 | 2 | ❌ | ❌ | 50% |
| **alert-deduplication** (告警去重) | 3 | 0 | 1 | 1 | 0 | ❌ | ❌ | 45% |
| **alert-pipeline** (告警管道) | 16 | 0 | 0 | 0 | 0 | ❌ | ❌ | 30% |
| **api-component** (API 组件注册) | 6 | 0 | 0 | 0 | 0 | ❌ | ❌ | 35% |
| **ai-agent-run** (AI Agent 运行) | 4 | 0 | 1 | 1 | 1 | ✅ | ❌ | 60% |
| **assignee** (指派规则) | 6 | 0 | 1 | 1 | 1 | ❌ | ❌ | 50% |
| **tenantutil** (租户工具) | 1 | 0 | 0 | 0 | 0 | ❌ | ❌ | 30% |

### 2.1 application (应用聚合) — 90% ⭐ CQRS 聚合根重建

**26 文件 / 7 测试**，Event Sourcing 聚合根重建：

| 能力 | 方法 |
|------|------|
| AggregateService | RebuildPipeline/RebuildApproval/RebuildFeatureFlag |
| Snapshot | NewAggregates/Snapshot |
| QueryBus | NewQueryBus/eventStoreReader |
| Pipeline Handlers | PipelineList/PipelineGet/PipelineEventStream/PipelineAggregateRebuild |
| Pagination | `pagination[T any]` 泛型分页 |

### 2.2 crossover (跨域调用) — 70%

**CallDispatcher + AsyncJob**，跨域异步调用：

| 能力 | 方法 |
|------|------|
| 异步任务 | `CreateJob(ctx, tenantID, targetModule, operation, params)` |
| 任务管理 | GetJob/ListJobs/UpdateJobStatus/CompleteJob/FailJob |
| 清理 | CleanupFinishedJobs(maxAge) |

### 2.3 branch-policy (分支策略) — 75%

| 能力 | 方法 |
|------|------|
| 策略 CRUD | List/Get/Create/Update/Delete |
| 策略执行 | ValidateBranch/GetCoverage/EnforcePolicy |

### 2.4 api-consumption (API 消费管理) — 80%

| 能力 | 方法 |
|------|------|
| 消费记录 | ListConsumptions/CreateConsumption |
| 限额管理 | ListLimits/CreateLimit/GetLimit/UpdateLimit/DeleteLimit |
| 统计 | GetStats |

### 2.5 vulnerability (漏洞管理) — 75%

| 能力 | 方法 |
|------|------|
| 漏洞 CRUD | ListVulnerabilities/Get/Create/Update/Delete |
| 扫描导入 | ImportScanResults |
| 统计 | GetStatistics |
| 状态管理 | UpdateStatus |

### 2.6 alert-adapter (告警适配器) — 60%

**8 Service 方法**，告警数据源适配：

| 能力 | 方法 |
|------|------|
| 适配器 CRUD | CreateAdapter/ListAdapters/GetAdapter/UpdateAdapter/DeleteAdapter |
| 事件 | Send/Receive/ListEvents |

---

## 三、域级 P0 问题

| # | 问题 | 模块 | 影响 |
|---|------|------|------|
| 1 | **未 wiring** | application (26 文件, CQRS 聚合根重建) | 聚合根重建不可用 |
| 2 | **未 wiring** | crossover (跨域调用) | 跨域异步调用不可用 |
| 3 | **未 wiring** | alert-adapter/v2/correlation/silence/deduplication/pipeline (7 模块) | 告警管道完全不可用 |
| 4 | **未 wiring** | branch-policy/api-consumption/vulnerability/apk-upload-history (4 模块) | 治理子模块不可用 |
| 5 | **零测试** | alert-adapter-v2/correlation/silence/deduplication/pipeline/api-component (6 模块) | 告警管道不可信 |
| 6 | **alert-pipeline 异常** | 16 文件但 0H/0S/0R/0T | 无标准架构 |

---

*分析完成: 2026-08-02 | 全模块覆盖 100% (282 模块 / 96 报告)*
