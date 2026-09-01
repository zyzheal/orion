# DBA专家 + 数据挖掘工程师 + AI智能体视角缺失能力分析与设计完善方案

> 评审日期: 2026-08-29  
> 评审视角: DBA专家 + 数据挖掘工程师 + AI智能体集成（结合当前 AI Agent 技术趋势）  
> 评审范围: `orion-platform-svc-go/internal/` 17 个数据相关模块 + AI 基础设施 + orion-dba 插件  
> 评审方法: 代码级实测（grep + AST + 服务方法清单）+ 标杆平台对标  
> 输出: 缺失能力清单 + 平台对标矩阵 + AI 智能体集成设计模块

---

## 一、核心结论（Executive Summary）

### 1.1 三句话定调

1. **DBA 与数据模块功能骨架完整，但全部停留在"CRUD 工单流"阶段**，缺乏 DBA 专家视角的深度能力（SQL 审核、慢查询治理、索引/执行计划分析、容量规划、故障自愈）。
2. **数据挖掘链路已搭起 10 个模块骨架**（catalog/quality/pipeline/lineage/masking/classification/metadata/bi-dashboard/report-designer/datasource），但**每条链路都是浅层 CRUD，缺乏真正的"数据工程"能力**（ETL DAG、数据探查、特征工程、血缘自动采集、质量规则引擎、BI 智能问数）。
3. **AI 智能体集成是最大的系统性缺口**：主服务 17 个数据模块中 AI 集成为 **0**，而 orion-dba 插件已实现 Text2SQL + SQL advisor 但**未集成到主服务**，形成"能力孤岛"。当前技术趋势要求 AI Agent 深度融入 DBA/数据全流程，Orion 的现状与这一趋势严重脱节。

### 1.2 评分矩阵（10 分制）

| 能力域 | 现状 | AI 集成度 | 前端入口 | 期望值 | 缺口 |
|--------|------|-----------|---------|--------|------|
| DBA 专家能力 | 4/10 | 0% | ⚠️ 碎片化（1 页 3 Tab） | 8/10 | -4 |
| 数据挖掘工程 | 3/10 | 0% | ❌ 7 模块无页面 | 8/10 | -5 |
| AI 智能体集成 | 2/10 | 孤岛式 5% | ❌ 无 AI 入口 | 9/10 | -7 |
| 数据治理 | 5/10 | 0% | ⚠️ 散落 2 页 | 8/10 | -3 |
| **前端工作台** | **2/10** | - | **7/17 模块无入口** | **9/10** | **-7** |
| **综合** | **3/10** | **0-5%** | **碎片化** | **8/10** | **-5** |

---

## 二、现状实测（代码级证据）

### 2.1 数据相关模块清单（17 个模块）

| # | 模块 | LOC | Service 方法数 | AI 集成 | 状态 |
|---|------|-----|---------------|--------|------|
| 1 | `internal/dba/` | 1378 | 17 | ❌ 0 | 工单 CRUD + 审核 + 执行 + 回滚 |
| 2 | `internal/database-devops/` | 599 | ~8 | ❌ 0 | 备份/恢复执行 + 数据源 CRUD |
| 3 | `internal/data-catalog/` | 1446 | 9 + introspector | ❌ 0 | Entry CRUD + Discover（PG/MySQL/SQLite） |
| 4 | `internal/data-quality/` | 1913 | 13 | ❌ 0 | 规则/扫描/告警/统计 CRUD |
| 5 | `internal/data-pipeline/` | 603 | 12 | ❌ 0 | Pipeline CRUD + Run/Pause/Resume |
| 6 | `internal/data-lineage/` | 701 | 10 | ❌ 0 | Lineage/Node/Relationship CRUD（手工） |
| 7 | `internal/data-masking/` | 571 | ~10 | ❌ 0 | 掩码规则 CRUD |
| 8 | `internal/data-classification/` | 433 | ~10 | ❌ 0 | 分类规则 CRUD |
| 9 | `internal/bi-dashboard/` | 367 | 5 | ❌ 0 | Dashboard CRUD（仅 5 方法） |
| 10 | `internal/report-designer/` | 1332 | ~12 | ❌ 0 | 报表 CRUD |
| 11 | `internal/datasource/` | 560 | ~8 | ❌ 0 | 数据源 CRUD |
| 12 | `internal/metadata/` | 305 | ~8 | ❌ 0 | 元数据 CRUD |
| 13 | `internal/knowledge/` | - | 25+ | ✅ RAG Retrieve | Space/Doc/EvalSet + Retrieve |
| 14 | `internal/vector-store/` | - | 5 | ✅ 向量存储 | VectorStore CRUD |
| 15 | `internal/assistant/` | - | - | ✅ knowledge RAG + pipeline | /assistant/ask + /assistant/action |
| 16 | `internal/chatops/` | - | ~10 | ✅ 集成 | ChatOps CRUD |
| 17 | `internal/ai-agent-run/` | - | - | ✅ Agent 执行 | AgentRun 端点 |

**关键发现**:
- **AI 集成仅存在于 knowledge/vector-store/assistant/chatops/ai-agent-run（5 个）**
- **17 个数据相关模块中，12 个（dba、database-devops、data-catalog、data-quality、data-pipeline、data-lineage、data-masking、data-classification、bi-dashboard、report-designer、datasource、metadata）AI 集成为 0**

### 2.2 assistant 已接入的 SourceProvider（验证）

`cmd/server/cicd_domain_wiring.go:229-258` 实测：

```go
assistantProviders := []assistant_service.SourceProvider{
    assistant_service.NewKnowledgeProvider(...),    // ✅ knowledge RAG
    assistant_service.NewPipelineProvider(...),     // ✅ pipeline 列表
}
```

**缺口**：assistant 只接入了 knowledge RAG 和 pipeline，**未接入任何 DBA/数据模块**。自然语言无法查询"我的订单库慢 SQL Top10"、无法生成 SQL、无法触发数据质量扫描、无法生成 BI 报表。

### 2.3 orion-dba 插件 AI 能力（孤立存在）

`orion-dba/backend/handler/fetch/ai.go` 实测：

```go
func (ai *AIAssistant) BuildSQLAdvise(prompt *advisorFrom, tables []string, kind string) (string, error) {
    // kind="advisor" → 使用 AdvisorPrompt（SQL 优化建议）
    // kind="text2sql" → 使用 SQLGenPrompt（自然语言→SQL）
    pp := model.GloAI.AdvisorPrompt
    if kind == "text2sql" { pp = model.GloAI.SQLGenPrompt }
    // 通过 {{tables_info}}/{{sql}}/{{lang}} 模板替换
    // 调用 OpenAI ChatCompletion API
}
```

路由：`orion-dba/backend/router/router.go:85` → `r.POST("/chat", fetch.AiChat)` + `r.Restful("/fetch/:tp", apis.YearnFetchApis())`

**问题**：
- orion-dba 是独立 Vue3 + Go 微前端插件（基于 Yearning fork），**与主服务 `orion-platform-svc-go` 无代码集成**
- 前端通过 `FetchSQLAdvisor(post, type)` 直接调用 orion-dba 后端 `/api/v2/fetch/{type}`
- 主服务的 `internal/dba/` 没有任何 AI 端点，用户在主平台内无法使用 Text2SQL

### 2.4 主服务 AI 基础设施（已就绪但未被数据模块使用）

| 组件 | 位置 | 状态 |
|------|------|------|
| LLM Provider | `internal/ai/llm-provider/` | ✅ mock/deepseek/anthropic + registry + tokenbucket |
| Assistant | `internal/assistant/` | ✅ /ask + /action + SourceProvider + Executor |
| AI Agent Run | `internal/ai-agent-run/` | ✅ AgentRun 端点 |
| ChatOps | `internal/chatops/` | ✅ 集成 |
| Knowledge RAG | `internal/knowledge/` | ✅ Retrieve + EvalSet |
| Vector Store | `internal/vector-store/` | ✅ CRUD |
| Prompt Security | `internal/prompt-security/` | ✅ Repository |
| LLM Trace | `internal/llm-trace/` | ✅ wired |
| MCP | `internal/mcp/` | ✅ wired |

**结论**：AI 基础设施齐备，但**数据模块完全没有调用它们**。这是一个接线（wiring）+ 设计缺口，而非基础设施缺口。

---

## 三、对标主流平台能力矩阵

### 3.1 DBA 专家视角对标（Bytebase / OceanBase ODC / DBeaver / DataGrip / Yearning）

| 能力 | Bytebase | OceanBase ODC | DBeaver | DataGrip | Yearning | **Orion 现状** | 缺口 |
|------|----------|---------------|---------|----------|----------|---------------|------|
| SQL 审核（规则引擎） | ✅ Advisor + 70+ 规则 | ✅ SQL 审核任务 | ❌ | ❌ | ✅ 审核规则 | ⚠️ 有 AuditRule CRUD，**无规则引擎执行** | P0 |
| 慢查询分析 | ✅ Slow Query | ✅ ODC 慢日志 | ❌ | ❌ | ❌ | ❌ 完全缺失 | P0 |
| 执行计划分析 | ✅ Explain 可视化 | ✅ Plan | ✅ Explain | ✅ Explain | ❌ | ❌ 完全缺失 | P0 |
| 索引建议 | ✅ AI Advisor | ✅ 索引诊断 | ❌ | ❌ | ❌ | ❌ 完全缺失 | P0 |
| Text2SQL | ✅ AI SQL 生成 | ❌ | ❌ | ❌ | ✅ text2sql | ❌ 主服务缺失（orion-dba 插件有） | P0 |
| SQL 优化建议 | ✅ AI Advisor | ✅ | ❌ | ❌ | ✅ advisor | ❌ 主服务缺失 | P0 |
| Schema 变更审批 | ✅完整审批流 | ✅ | ❌ | ❌ | ✅ 工单 | ✅ Order 工单流 | ✅ |
| 数据脱敏导出 | ✅ | ✅ | ❌ | ❌ | ❌ | ⚠️ data-masking 模块独立，未与 DBA 联动 | P1 |
| 容量规划 | ✅ | ✅ OBC | ❌ | ❌ | ❌ | ❌ 完全缺失 | P1 |
| 数据库健康检查 | ✅ | ✅ OBC | ❌ | ❌ | ❌ | ❌ 完全缺失 | P1 |
| 备份恢复 | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ database-devops | ✅ |

**DBA 缺口合计**：6 项 P0 + 3 项 P1

### 3.2 数据挖掘工程师视角对标（Kettle / DataX / Spark / dbt / DataHub / OpenMetadata / Amundsen / Superset / Tableau）

| 能力 | Kettle | DataX | Spark | dbt | DataHub | Superset | **Orion 现状** | 缺口 |
|------|--------|-------|-------|-----|--------|----------|---------------|------|
| ETL DAG 调度 | ✅ | ✅ | ✅ Airflow | ❌ | ❌ | ❌ | ⚠️ data-pipeline 仅 Run/Pause，**无 DAG 编排/依赖/重试** | P0 |
| 数据探查（Profile） | ✅ | ❌ | ✅ | ✅ profiling | ✅ | ❌ | ❌ 完全缺失 | P0 |
| 特征工程 | ✅ | ❌ | ✅ MLlib | ❌ | ❌ | ❌ | ❌ 完全缺失 | P1 |
| 血缘自动采集 | ❌ | ❌ | ✅ Spark | ✅ 解析 | ✅ 自动 | ❌ | ⚠️ 手工 CreateNode，**无 SQL/ETL 自动解析** | P0 |
| 数据质量规则引擎 | ❌ | ❌ | ❌ | ✅ tests | ✅ | ❌ | ⚠️ 有 Rule CRUD，**无 evaluator 引擎执行**（虽然有 engine/evaluator.go 但需验证深度） | P0 |
| 智能问数（NL→BI） | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ 完全缺失（Bi-Dashboard 仅 5 方法） | P0 |
| BI 可视化编排 | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ⚠️ bi-dashboard 仅 CRUD，**无图表/组件/布局编排** | P0 |
| 报表设计器 | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ⚠️ report-designer 1332 行，需验证深度 | P1 |
| 元数据自动发现 | ❌ | ❌ | ❌ | ✅ | ✅ ingest | ❌ | ✅ data-catalog introspector（PG/MySQL/SQLite） | ✅ |
| 数据资产搜索 | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ⚠️ SearchEntries，**无跨资产统一搜索 + 排序** | P1 |

**数据挖掘缺口合计**：5 项 P0 + 3 项 P1

### 3.3 AI 智能体集成视角对标（Dify / LangChain / LlamaIndex / Vanna.ai / Snowflake Cortex / Databricks AI/BI / GitHub Copilot）

| 能力 | Dify | LangChain | Vanna | Cortex | Databricks AI/BI | **Orion 现状** | 缺口 |
|------|------|-----------|-------|--------|------------------|---------------|------|
| Text2SQL Agent | ✅ | ✅ | ✅ 专用 | ✅ | ✅ | ❌ 主服务缺失（orion-dba 孤岛） | P0 |
| SQL 优化 Agent | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ 主服务缺失 | P0 |
| RAG over Schema | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ 现有 knowledge RAG 未用于 schema | P0 |
| 自然语言→BI | ✅ | ✅ | ❌ | ✅ | ✅ Genie | ❌ 完全缺失 | P0 |
| 数据质量异常检测 AI | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ 完全缺失 | P0 |
| 慢 SQL 根因分析 Agent | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ 完全缺失 | P0 |
| DBA Copilot（对话式） | ✅ | ✅ | ❌ | ✅ | ✅ | ⚠️ assistant 有 /ask，**未接 DBA 数据** | P0 |
| 数据探查 Agent | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ 完全缺失 | P1 |
| 血缘影响分析 Agent | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ 完全缺失 | P1 |
| 工单自动审批 AI | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ 完全缺失 | P1 |
| Agent 编排（多 Agent 协作） | ✅ | ✅ | ❌ | ✅ | ✅ | ⚠️ ai-agent-run 有，**未用于数据场景** | P1 |
| MCP 工具协议 | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ internal/mcp 已 wired | P2（接线即可） |

**AI 集成缺口合计**：6 项 P0 + 4 项 P1

---

## 四、缺失能力清单（按优先级）

### 4.1 P0 阻塞性缺口（17 项）

#### A. DBA 专家能力缺口（6 项）

| ID | 缺失能力 | 影响 | 建议位置 |
|----|---------|------|---------|
| DBA-P0-1 | **SQL 审核规则引擎**（当前仅 AuditRule CRUD，无执行引擎） | SQL 工单提交后无法自动审核，依赖人工 | `internal/dba/advisor/` 新增 engine.go |
| DBA-P0-2 | **慢查询分析**（采集 + Top N + 执行计划 + 优化建议） | 无法发现和治理慢 SQL | `internal/dba/slowquery/` 新增 |
| DBA-P0-3 | **执行计划可视化分析**（EXPLAIN + 解读） | 无法判断 SQL 效率 | `internal/dba/explain/` 新增 |
| DBA-P0-4 | **索引建议 Agent**（基于慢 SQL + Schema 推荐索引） | 无法优化数据库性能 | `internal/dba/advisor/index_agent.go` |
| DBA-P0-5 | **Text2SQL**（主服务集成，从 orion-dba 迁移） | 主平台用户无法自然语言查询 | `internal/dba/advisor/text2sql.go` |
| DBA-P0-6 | **SQL 优化建议 Agent**（从 orion-dba 迁移） | 主平台用户无法获得 SQL 优化建议 | `internal/dba/advisor/sql_advisor.go` |

#### B. 数据挖掘工程缺口（5 项）

| ID | 缺失能力 | 影响 | 建议位置 |
|----|---------|------|---------|
| DM-P0-1 | **ETL DAG 编排**（当前 Run/Pause 无依赖/重试/DAG） | 数据管道无法表达复杂 ETL | `internal/data-pipeline/dag/` 新增 |
| DM-P0-2 | **数据探查（Profile）**（列级统计/分布/质量评分） | 无法快速了解数据特征 | `internal/data-catalog/profiler/` 新增 |
| DM-P0-3 | **血缘自动采集**（当前手工 CreateNode） | 血缘不真实、不可维护 | `internal/data-lineage/parser/` 新增（SQL + ETL 解析） |
| DM-P0-4 | **数据质量规则引擎执行**（验证 evaluator 深度） | 规则定义后可能无法真正执行 | 验证 `internal/data-quality/engine/evaluator.go` |
| DM-P0-5 | **自然语言→BI 智能问数** | 无法对话式生成报表 | `internal/bi-dashboard/agent/` 新增 |

#### C. AI 智能体集成缺口（6 项）

| ID | 缺失能力 | 影响 | 建议位置 |
|----|---------|------|---------|
| AI-P0-1 | **DBA Copilot 接入 DBA 数据**（assistant → dba） | 自然语言无法查询慢 SQL/工单 | `cmd/server/cicd_domain_wiring.go` 新增 DBAProvider |
| AI-P0-2 | **RAG over Schema**（knowledge 检索 schema 元数据） | Text2SQL 缺乏 schema 上下文 | `internal/knowledge/` 增加 schema ingest |
| AI-P0-3 | **数据质量异常检测 Agent** | 无法 AI 发现数据异常 | `internal/data-quality/agent/` 新增 |
| AI-P0-4 | **慢 SQL 根因分析 Agent** | 慢 SQL 无法自动根因定位 | `internal/dba/agent/rca_agent.go` |
| AI-P0-5 | **Text2SQL 集成到 assistant action** | 自然语言无法生成 SQL 并执行 | assistant 新增 ActionGenerateSQL |
| AI-P0-6 | **自然语言→BI 集成到 assistant action** | 自然语言无法生成 BI 报表 | assistant 新增 ActionGenerateBI |

### 4.2 P1 高优先级缺口（10 项）

| ID | 缺失能力 | 建议位置 |
|----|---------|---------|
| DBA-P1-1 | 容量规划（表空间增长预测 + 告警） | `internal/dba/capacity/` |
| DBA-P1-2 | 数据库健康检查（综合评分 + 巡检报告） | `internal/dba/healthcheck/` |
| DBA-P1-3 | 数据脱敏与 DBA 联动（导出自动脱敏） | data-masking ↔ dba wiring |
| DM-P1-1 | 特征工程（特征存储 + 特征服务） | `internal/feature-store/`（新建） |
| DM-P1-2 | 跨资产统一搜索 + 排序 | data-catalog 增强 SearchEntries |
| DM-P1-3 | report-designer 深度验证（1332 行需审计是否浅层） | 审计 |
| AI-P1-1 | 数据探查 Agent（对话式 Profile） | `internal/data-catalog/agent/` |
| AI-P1-2 | 血缘影响分析 Agent（变更影响预测） | `internal/data-lineage/agent/` |
| AI-P1-3 | 工单自动审批 AI（低风险 SQL 自动通过） | `internal/dba/agent/auto_approve.go` |
| AI-P1-4 | 多 Agent 编排用于数据场景（ai-agent-run 接线） | ai-agent-run wiring |

---

## 五、AI 智能体集成设计模块（核心交付物）

### 5.1 设计原则

1. **不重复造轮子**：复用现有 `internal/ai/llm-provider/` + `internal/assistant/` + `internal/knowledge/` + `internal/ai-agent-run/`
2. **SourceProvider 模式扩展**：assistant 已有 Provider 抽象，按同一模式新增 DBAProvider/CatalogProvider/QualityProvider/LineageProvider
3. **ActionExecutor 模式扩展**：assistant 已有 ActionCreateTicket/ActionTriggerPipeline，按同一模式新增 ActionGenerateSQL/ActionRunSQLAudit/ActionGenerateBI
4. **从 orion-dba 迁移而非重写**：`orion-dba/backend/handler/fetch/ai.go` 的 `BuildSQLAdvise` 逻辑迁移到 `internal/dba/advisor/`，复用主服务 LLM Provider（不再依赖 OpenAI SDK 直连）
5. **MCP 工具协议**：DBA/数据能力封装为 MCP 工具，供外部 Agent 调用（internal/mcp 已就绪）

### 5.2 架构总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                     用户（自然语言对话）                              │
│  "帮我查最近 1 小时慢 SQL Top10"  "生成一个销售趋势 BI 报表"          │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  internal/assistant/  (已存在)                                       │
│  /assistant/ask    /assistant/action                                 │
│  ┌─────────────────────────────────────────────────────────┐         │
│  │  SourceProvider（已扩展）                                │         │
│  │  ├── KnowledgeProvider ✅ (已有)                         │         │
│  │  ├── PipelineProvider ✅ (已有)                          │         │
│  │  ├── DBAProvider 🆕 (慢SQL/工单/数据源/索引建议)          │         │
│  │  ├── CatalogProvider 🆕 (表/列/统计/血缘)                │         │
│  │  ├── QualityProvider 🆕 (规则/扫描结果/异常)             │         │
│  │  └── LineageProvider 🆕 (血缘/影响范围)                  │         │
│  └─────────────────────────────────────────────────────────┘         │
│  ┌─────────────────────────────────────────────────────────┐         │
│  │  ActionExecutor（已扩展）                                │         │
│  │  ├── ActionCreateTicket ✅ (已有)                        │         │
│  │  ├── ActionTriggerPipeline ✅ (已有)                      │         │
│  │  ├── ActionGenerateSQL 🆕 (Text2SQL → 返回 SQL)         │         │
│  │  ├── ActionRunSQLAudit 🆕 (SQL → 审核规则 → 报告)        │         │
│  │  ├── ActionGenerateBI 🆕 (NL → BI 报表生成)             │         │
│  │  ├── ActionRunQualityScan 🆕 (触发数据质量扫描)         │         │
│  │  └── ActionAnalyzeLineage 🆕 (血缘影响分析)             │         │
│  └─────────────────────────────────────────────────────────┘         │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ 调用
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  internal/ai/llm-provider/  (已存在)                                 │
│  mock / deepseek / anthropic + registry + tokenbucket               │
│  internal/knowledge/ (RAG Retrieve)                                 │
│  internal/vector-store/ (向量存储)                                  │
│  internal/ai-agent-run/ (多 Agent 编排)                             │
│  internal/mcp/ (MCP 工具协议)                                       │
└─────────────────────────────────────────────────────────────────────┘
                               │ 调用
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  数据模块层（17 个模块，AI 接线目标）                                │
│  dba / database-devops / data-catalog / data-quality / data-pipeline│
│  data-lineage / data-masking / data-classification / bi-dashboard   │
│  report-designer / datasource / metadata                             │
│  ┌─────────────────────────────────────────────────────────┐         │
│  │  新增 AI 子模块                                          │         │
│  │  ├── dba/advisor/        (Text2SQL + SQL Advisor + 索引)│         │
│  │  ├── dba/slowquery/      (慢 SQL 采集分析)               │         │
│  │  ├── dba/explain/        (执行计划可视化)                │         │
│  │  ├── dba/agent/          (根因分析 + 自动审批)           │         │
│  │  ├── data-catalog/profiler/ (数据探查)                  │         │
│  │  ├── data-quality/agent/ (异常检测 Agent)               │         │
│  │  ├── data-lineage/parser/ (SQL/ETL 血缘自动采集)         │         │
│  │  ├── bi-dashboard/agent/ (NL→BI 智能问数)              │         │
│  │  └── data-pipeline/dag/  (ETL DAG 编排)                 │         │
│  └─────────────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.3 核心设计：DBA AI Agent 子系统

#### 5.3.1 `internal/dba/advisor/` — Text2SQL + SQL Advisor + 索引建议

**设计文件结构**:
```
internal/dba/advisor/
├── text2sql.go          # 自然语言 → SQL
├── sql_advisor.go       # SQL → 优化建议
├── index_advisor.go     # 慢 SQL + Schema → 索引建议
├── advisor_service.go   # 统一入口
├── schema_rag.go        # Schema 元数据 RAG（调用 knowledge.Retrieve）
├── models.go            # 请求/响应模型
├── advisor_test.go      # 测试
└── prompts/             # Prompt 模板（从 orion-dba 迁移）
    ├── text2sql.txt
    ├── sql_advisor.txt
    └── index_advisor.txt
```

**接口设计**:

```go
package advisor

// AdvisorService 提供 AI 驱动的 SQL 智能能力
type AdvisorService interface {
    // Text2SQL 将自然语言转换为 SQL（基于 schema 上下文）
    Text2SQL(ctx context.Context, tenantID, question, datasourceID, database string) (*Text2SQLResult, error)
    
    // SQLAdvisor 分析 SQL 并给出优化建议
    SQLAdvisor(ctx context.Context, tenantID, sql, datasourceID string) (*AdvisorResult, error)
    
    // IndexAdvisor 基于慢 SQL + Schema 推荐索引
    IndexAdvisor(ctx context.Context, tenantID, datasourceID, slowSQLs []string) (*IndexAdvice, error)
    
    // ExplainAnalyze 解读执行计划
    ExplainAnalyze(ctx context.Context, tenantID, sql, datasourceID string) (*ExplainResult, error)
}

// 依赖注入：复用主服务 LLM Provider + knowledge RAG
type advisorService struct {
    llm       llm_provider.Provider     // 复用 internal/ai/llm-provider/
    knowledge knowledge.Service         // 复用 RAG Retrieve（schema 元数据）
    dbaSvc    dba.Service               // 复用 ExecuteDirectQuery / ListDataSources
    prompts   *PromptTemplates          // 从 orion-dba 迁移
}
```

**关键设计点**:
- **Text2SQL 流程**: question → schema RAG 检索（表/列/注释）→ Prompt 模板（`{{tables_info}}`/`{{question}}`）→ LLM → SQL → 可选执行（调用 dba.ExecuteDirectQuery）
- **SQL Advisor 流程**: SQL → schema 上下文 → Prompt → LLM → 建议列表（索引/重写/分区）
- **从 orion-dba 迁移**: `orion-dba/backend/handler/fetch/ai.go:BuildSQLAdvise` 的模板替换逻辑直接迁移，但 LLM 调用从 OpenAI SDK 改为 `llm_provider.Provider`

#### 5.3.2 `internal/dba/slowquery/` — 慢查询治理

```go
package slowquery

type SlowQueryService interface {
    // CollectFromPG 从 pg_stat_statements 采集慢 SQL
    CollectFromPG(ctx context.Context, tenantID, datasourceID string) error
    // CollectFromMySQL 从 mysql.slow_log 采集
    CollectFromMySQL(ctx context.Context, tenantID, datasourceID string) error
    // TopN 查询 Top N 慢 SQL
    TopN(ctx context.Context, tenantID, datasourceID string, n int, since time.Time) ([]SlowQuery, error)
    // Analyze 调用 advisor.SQLAdvisor 对慢 SQL 给出优化建议
    Analyze(ctx context.Context, tenantID, datasourceID string, sql string) (*advisor.AdvisorResult, error)
}
```

#### 5.3.3 `internal/dba/agent/` — DBA 多 Agent 编排

```go
package agent

// RCAAgent 慢 SQL 根因分析 Agent
// 流程: 慢SQL → Explain → Schema → 索引 → 服务器指标 → 根因报告
type RCAAgent struct {
    explain   explain.Service
    advisor   advisor.AdvisorService
    metrics   observability.MetricsQuery
    llm       llm_provider.Provider
}

// AutoApproveAgent 低风险 SQL 自动审批 Agent
// 流程: SQL → 规则审核 → 风险评分 → 低风险自动通过/高风险人工
type AutoApproveAgent struct {
    auditEngine  advisor.AuditEngine
    llm          llm_provider.Provider
    riskPolicy   RiskPolicy
}
```

### 5.4 核心设计：数据挖掘 AI Agent 子系统

#### 5.4.1 `internal/data-catalog/profiler/` — 数据探查 + AI Profile

```go
package profiler

type ProfilerService interface {
    // ProfileTable 表级探查（行数/大小/列统计）
    ProfileTable(ctx context.Context, tenantID, datasourceID, table string) (*TableProfile, error)
    // ProfileColumn 列级探查（NULL 比例/基数/分布/Top K）
    ProfileColumn(ctx context.Context, tenantID, datasourceID, table, column string) (*ColumnProfile, error)
    // AIProfile 用 LLM 总结探查结果 + 异常检测
    AIProfile(ctx context.Context, tenantID, datasourceID, table string) (*AIProfileSummary, error)
}
```

#### 5.4.2 `internal/data-lineage/parser/` — 血缘自动采集

```go
package parser

type LineageParser interface {
    // ParseSQL 从 SQL 解析血缘（SELECT ... FROM ... JOIN）
    ParseSQL(sql string) (*LineageGraph, error)
    // ParseETL 从 ETL 配置解析血缘（source → transform → sink）
    ParseETL(config ETLConfig) (*LineageGraph, error)
    // AutoDiscover 自动发现血缘（扫描所有 SQL/ETL 并写入 data-lineage 模块）
    AutoDiscover(ctx context.Context, tenantID, datasourceID string) error
}
```

#### 5.4.3 `internal/bi-dashboard/agent/` — NL→BI 智能问数

```go
package agent

type BIAgentService interface {
    // NL2Dashboard 自然语言 → BI 报表
    // 流程: 问题 → schema RAG → SQL 生成 → 执行 → 图表推荐 → Dashboard
    NL2Dashboard(ctx context.Context, tenantID, question, datasourceID string) (*Dashboard, error)
    // NL2Chart 自然语言 → 单图表
    NL2Chart(ctx context.Context, tenantID, question, datasourceID string) (*Chart, error)
    // ExplainDashboard 用 LLM 解读现有 Dashboard
    ExplainDashboard(ctx context.Context, tenantID, dashboardID string) (*Explanation, error)
}
```

### 5.5 核心设计：assistant 扩展（SourceProvider + ActionExecutor）

#### 5.5.1 新增 SourceProvider

```go
// cmd/server/cicd_domain_wiring.go 扩展
assistantProviders := []assistant_service.SourceProvider{
    assistant_service.NewKnowledgeProvider(...),     // 已有
    assistant_service.NewPipelineProvider(...),       // 已有
    // 🆕 DBA Provider
    assistant_service.NewDBAProvider(func(ctx context.Context, tenantID, query string, limit int) ([]assistant_service.DBADoc, error) {
        // 查询慢 SQL Top N / 工单 / 数据源 / 索引建议
    }),
    // 🆕 Catalog Provider
    assistant_service.NewCatalogProvider(func(ctx context.Context, tenantID, query string) ([]assistant_service.CatalogEntry, error) {
        return dataCatalogSvc.SearchEntries(ctx, tenantID, dataCatalog_models.SearchRequest{Query: query})
    }),
    // 🆕 Quality Provider
    assistant_service.NewQualityProvider(func(ctx context.Context, tenantID string) ([]assistant_service.QualityAlert, error) {
        return dataQualitySvc.ListAlerts(ctx, tenantID, nil)
    }),
    // 🆕 Lineage Provider
    assistant_service.NewLineageProvider(func(ctx context.Context, tenantID, table string) ([]assistant_service.LineageNode, error) {
        // 查询表的上游/下游
    }),
}
```

#### 5.5.2 新增 ActionExecutor

```go
// assistant 新增 Action 类型
const (
    ActionGenerateSQL     ActionKind = "generate_sql"
    ActionRunSQLAudit     ActionKind = "run_sql_audit"
    ActionGenerateBI      ActionKind = "generate_bi"
    ActionRunQualityScan   ActionKind = "run_quality_scan"
    ActionAnalyzeLineage  ActionKind = "analyze_lineage"
)

// 在 cicd_domain_wiring.go 注册
assistantSvc.AddExecutor(assistant_service.NewFuncActionExecutor(
    assistant_models.ActionGenerateSQL,
    func(ctx context.Context, tenantID string, req *assistant_models.ActionRequest) (*assistant_models.ActionResult, error) {
        // 调用 dba/advisor.Text2SQL
        result, err := dbaAdvisorSvc.Text2SQL(ctx, tenantID, req.Question, req.DataSourceID, req.Database)
        // ...
    },
))
```

### 5.6 从 orion-dba 迁移清单

| orion-dba 文件 | 迁移目标 | 迁移内容 |
|---------------|---------|---------|
| `backend/handler/fetch/ai.go` | `internal/dba/advisor/text2sql.go` + `sql_advisor.go` | `BuildSQLAdvise` 逻辑 + 模板替换 |
| `backend/model/subModel.go` | `internal/dba/advisor/prompts/` | `AdvisorPrompt` + `SQLGenPrompt` 模板 |
| `frontend/src/apis/advisor.ts` | `orion-frontend/src/api/dba.ts` | `FetchSQLAdvisor` 端点 |
| `frontend/src/views/advisor/` | `orion-frontend/src/pages/dba/` | Advisor UI 组件 |

**迁移原则**:
- LLM 调用从 OpenAI SDK 直连 → 改为 `internal/ai/llm-provider/`（支持 deepseek/anthropic/mock）
- Prompt 模板从 `model.GloAI` 全局变量 → 改为配置注入
- 权限从 orion-dba 独立体系 → 改为主服务 `auth.RequirePermission("dba","ai")`

---

## 六、实施路线图

### Phase 1 — DBA AI 基础能力（2 周）

| # | 任务 | 优先级 | 工作量 |
|---|------|--------|--------|
| 1.1 | 从 orion-dba 迁移 Text2SQL 到 `internal/dba/advisor/` | P0 | 2d |
| 1.2 | 迁移 SQL Advisor | P0 | 1d |
| 1.3 | 新增 Index Advisor Agent | P0 | 3d |
| 1.4 | 新增 Explain 执行计划分析 | P0 | 2d |
| 1.5 | 新增慢 SQL 采集 + Top N | P0 | 3d |
| 1.6 | DBA SourceProvider + ActionGenerateSQL 接入 assistant | P0 | 2d |
| 1.7 | 前端 DBA Advisor 页面（从 orion-dba 迁移） | P0 | 3d |

### Phase 2 — 数据挖掘 AI 能力（2 周）

| # | 任务 | 优先级 | 工作量 |
|---|------|--------|--------|
| 2.1 | 数据探查 Profiler（表/列级统计） | P0 | 3d |
| 2.2 | 血缘自动采集 Parser（SQL 解析） | P0 | 3d |
| 2.3 | 验证 + 补全 data-quality 规则引擎 | P0 | 2d |
| 2.4 | NL→BI 智能问数 Agent | P0 | 4d |
| 2.5 | Catalog/Quality/Lineage Provider 接入 assistant | P0 | 2d |

### Phase 3 — 多 Agent 编排（1.5 周）

| # | 任务 | 优先级 | 工作量 |
|---|------|--------|--------|
| 3.1 | 慢 SQL 根因分析 Agent（Explain+Schema+Metrics+LLM） | P0 | 3d |
| 3.2 | 数据质量异常检测 Agent | P0 | 2d |
| 3.3 | 血缘影响分析 Agent | P1 | 2d |
| 3.4 | 工单自动审批 Agent | P1 | 2d |
| 3.5 | ai-agent-run 接线到数据场景 | P1 | 2d |

### Phase 4 — 深度能力（1.5 周）

| # | 任务 | 优先级 | 工作量 |
|---|------|--------|--------|
| 4.1 | 容量规划 + 健康检查 | P1 | 3d |
| 4.2 | ETL DAG 编排 | P0 | 4d |
| 4.3 | 数据脱敏 ↔ DBA 联动 | P1 | 2d |
| 4.4 | 特征工程 Feature Store | P1 | 3d |

**总计**: 7 周（35 人天），可由 2-3 人并行

---

## 七、验收标准

### 7.1 功能验收（用户场景）

| 场景 | 验收标准 |
|------|---------|
| "帮我查最近 1 小时慢 SQL Top10" | assistant 返回慢 SQL 列表 + 每条 SQL 的优化建议 |
| "把这段自然语言转成 SQL" | 返回可执行 SQL + schema 上下文说明 |
| "分析这条 SQL 的执行计划" | 返回 EXPLAIN 解读 + 索引建议 |
| "生成一个销售趋势 BI 报表" | 返回 Dashboard + SQL + 图表配置 |
| "这张表的数据质量如何" | 返回 Profile + 质量扫描结果 + 异常提示 |
| "修改 orders 表会影响哪些下游" | 返回血缘影响范围 |
| "这条 SQL 低风险，自动审批" | 返回风险评分 + 自动通过/拒绝 |

### 7.2 技术验收

| 维度 | 标准 |
|------|------|
| AI 集成度 | 17 个数据模块中 ≥12 个接入 AI（从 0 → 70%） |
| assistant Provider | ≥6 个 SourceProvider（现有 2 + 新增 4） |
| assistant Executor | ≥7 个 ActionExecutor（现有 2 + 新增 5） |
| orion-dba 迁移 | Text2SQL + Advisor 完全迁移到主服务 |
| 测试覆盖 | 新增模块单测覆盖率 ≥80% |
| 编译 | `go build ./cmd/server/` 0 错误 |
| 权限 | 所有 AI 端点有 `auth.RequirePermission` 守卫 |

---

## 八、附录

### 8.1 现有 AI 基础设施复用清单

| 组件 | 位置 | 复用方式 |
|------|------|---------|
| LLM Provider | `internal/ai/llm-provider/` | 直接注入 `llm_provider.Provider` |
| Knowledge RAG | `internal/knowledge/` | 调用 `Retrieve(ctx, tenantID, query, req)` |
| Vector Store | `internal/vector-store/` | 存储 schema embedding |
| Assistant | `internal/assistant/` | 扩展 SourceProvider + ActionExecutor |
| AI Agent Run | `internal/ai-agent-run/` | 多 Agent 编排 |
| MCP | `internal/mcp/` | DBA/数据能力暴露为 MCP 工具 |
| Prompt Security | `internal/prompt-security/` | Prompt 注入防护 |
| LLM Trace | `internal/llm-trace/` | AI 调用链路追踪 |

### 8.2 标杆平台参考

- **DBA**: Bytebase（SQL 审核 + AI Advisor）、OceanBase ODC（慢查询 + 索引诊断）、Yearning（Text2SQL）
- **数据挖掘**: dbt（质量测试 + 血缘）、DataHub/OpenMetadata/Amundsen（元数据 + 血缘自动采集）、Apache Superset（BI）
- **AI 集成**: Vanna.ai（Text2SQL 专用）、Databricks AI/BI（Genie NL→BI）、Snowflake Cortex（AI SQL）、Dify/LangChain（Agent 编排）

---

---

## 九、前端访问入口缺口分析（DBA/BI 工作台）

> 补充评审：当前系统是否为 DBA 专家和数据挖掘工程师（BI）提供独立的专业工作台访问页面？

### 9.1 现状实测：前端入口清单

#### ✅ 已有独立页面的数据相关模块（6 个，但碎片化）

| 模块 | 路由 | 菜单归属 | 页面文件 |
|------|------|---------|---------|
| DBA（SQL 工单/数据源/审计规则） | `/dba` + 2 子路由 | 基础设施 → 数据库 DevOps | `pages/dba/DbaPage.tsx`（3 Tab） |
| 数据血缘 | `/data-lineage` | 治理 → 数据治理 | `pages/data-lineage/DataLineagePage.tsx` |
| 数据质量 | `/data-quality` | 治理 → 数据治理 | `pages/data-quality/DataQualityPage.tsx` |
| 元数据 | `/metadata` | ❌ 未在菜单（仅路由） | `pages/metadata/MetadataPage.tsx` |
| 数据管道 | `/data-pipeline` | ❌ 未在菜单（仅路由） | `pages/pipeline/PipelineManagementPage` |
| 报表设计器 | `/console/report-designer` | ❌ 未在菜单（仅路由） | `pages/ReportDesigner/` |

#### ❌ 后端有模块但前端完全无页面 + 无 API 客户端的（7 个 — 关键缺口）

| 后端模块 | LOC | 前端页面 | API 客户端 | 问题 |
|---------|-----|---------|-----------|------|
| `bi-dashboard` | 367 | ❌ 无 | ❌ 无 | BI 仪表盘后端存在但前端无法访问 |
| `data-masking` | 571 | ❌ 无 | ❌ 无 | 数据脱敏规则无 UI、无 API 调用 |
| `data-classification` | 433 | ❌ 无 | ❌ 无 | 数据分类规则无 UI、无 API 调用 |
| `datasource` | 560 | ❌ 无 | ❌ 无 | 数据源管理散落在 DBA 页面，无独立入口 |
| `database-devops` | 599 | ❌ 无 | ⚠️ 有但仅 1 处 | 备份/恢复无独立入口 |
| `data-catalog` | 1446 | ❌ 无 | ❌ 无 | 数据目录/资产浏览无 UI（最大缺口） |
| `report-designer` | 1332 | ⚠️ 仅挂在 `/console/report-designer` | ⚠️ 有 | 未在主菜单，入口隐蔽 |

### 9.2 与其它模块对比（碎片化 vs 统一工作台）

其它域都是**一个顶级菜单 + 多个二级页面**的完整模块结构：

| 域 | 顶级菜单 | 子页面数 | 结构 |
|----|---------|---------|------|
| 可观测性 | `/observability` | 10+ | 告警/监控/ traces/ 日志/ 诊断/ APM/ 健康/ 拓扑 |
| AI 平台 | `/ai` | 8+ | ChatOps/ 知识库/ Agents/ MLOps/ Prompt 安全 |
| 交付 | `/delivery` | 10+ | Pipeline/ 部署/ 制品/ 构建/ 发布 |
| 治理 | `/governance` | 10+ | 策略/ 审计/ SBOM/ 合规/ 成本 |

**DBA/数据域现状却是碎片化的**：
- DBA 在"基础设施"下只有 1 个入口（3 Tab），与多云/容量规划挤在一起
- 数据血缘/质量散落在"治理"下，与策略/审计/SBOM 混在一起
- BI/目录/掩码/分类/元数据完全没有入口或入口隐蔽
- **没有 DBA 专家和数据挖掘工程师的专属顶级工作台**

### 9.3 核心判断

**当前系统没有为 DBA 专家和数据挖掘工程师（BI）提供统一的专业工作台**：

- **DBA 专家**：只能用 `/dba` 一个三 Tab 页面（SQL 工单 + 数据源 + 审计规则），缺少慢 SQL、执行计划、索引建议、备份恢复、健康检查、AI Advisor 入口
- **数据挖掘工程师/BI 分析师**：**完全没有专属入口** — 没有数据目录浏览、没有数据探查、没有 BI 仪表盘编排、没有数据掩码/分类管理、没有元数据浏览

这是比"AI 集成为 0"更前置的缺口：**用户根本无法在 UI 上触达这些后端能力**。即使后端 `data-catalog`（1446 行）和 `bi-dashboard`（367 行）已实现，前端无入口 = 用户不可见 = 能力不存在。

### 9.4 设计方案：两个顶级专业工作台

参照其它模块"顶级菜单 + 多二级页面"结构，新增两个工作台：

#### 9.4.1 `/dba-workbench`（DBA 专家工作台）

**菜单结构**：
```
基础设施 → DBA 专家工作台
├── SQL 工单          (/dba-workbench/orders)         ✅ 迁移自现有 /dba
├── 数据源管理        (/dba-workbench/datasources)    ✅ 迁移自现有 /dba
├── 审计规则          (/dba-workbench/audit-rules)    ✅ 迁移自现有 /dba
├── 慢 SQL 分析       (/dba-workbench/slow-queries)   🆕 新增
├── 执行计划          (/dba-workbench/explain)        🆕 新增
├── 索引建议          (/dba-workbench/index-advisor)  🆕 新增（AI）
├── AI SQL 助手       (/dba-workbench/ai-advisor)     🆕 迁移自 orion-dba
├── 备份恢复          (/dba-workbench/backup)         🆕 对接 database-devops
├── 健康检查          (/dba-workbench/health)         🆕 新增
└── 容量规划          (/dba-workbench/capacity)       🆕 新增
```

**页面文件结构**：
```
src/pages/dba-workbench/
├── index.tsx                    # 工作台首页（概览仪表盘）
├── Orders/                      # 迁移自 pages/dba
├── DataSources/                 # 迁移自 pages/dba
├── AuditRules/                  # 迁移自 pages/dba
├── SlowQueries/                 # 🆕
├── Explain/                     # 🆕
├── IndexAdvisor/                # 🆕 AI
├── AIAdvisor/                   # 🆕 迁移自 orion-dba frontend
├── Backup/                       # 🆕
├── HealthCheck/                 # 🆕
└── CapacityPlanning/             # 🆕
```

#### 9.4.2 `/data-workbench`（数据工程工作台）

**菜单结构**：
```
基础设施 → 数据工程工作台
├── 数据目录          (/data-workbench/catalog)       🆕 对接 data-catalog
├── 数据探查          (/data-workbench/profiler)      🆕 新增（AI Profile）
├── 数据质量          (/data-workbench/quality)       ✅ 迁移自 /data-quality
├── 数据血缘          (/data-workbench/lineage)        ✅ 迁移自 /data-lineage
├── 数据掩码          (/data-workbench/masking)       🆕 对接 data-masking
├── 数据分类          (/data-workbench/classification) 🆕 对接 data-classification
├── 元数据管理        (/data-workbench/metadata)      ✅ 迁移自 /metadata
├── BI 仪表盘         (/data-workbench/bi-dashboard)   🆕 对接 bi-dashboard
├── 报表设计器        (/data-workbench/report-designer) ✅ 迁移自 /console/report-designer
├── 数据管道          (/data-workbench/pipeline)      ✅ 迁移自 /data-pipeline
└── 智能问数          (/data-workbench/ai-ask)        🆕 AI NL→BI
```

**页面文件结构**：
```
src/pages/data-workbench/
├── index.tsx                    # 工作台首页（数据资产概览）
├── DataCatalog/                 # 🆕
├── DataProfiler/                # 🆕 AI
├── DataQuality/                 # 迁移自 pages/data-quality
├── DataLineage/                 # 迁移自 pages/data-lineage
├── DataMasking/                 # 🆕
├── DataClassification/          # 🆕
├── Metadata/                    # 迁移自 pages/metadata
├── BiDashboard/                 # 🆕
├── ReportDesigner/              # 迁移自 pages/ReportDesigner
├── DataPipeline/                # 迁移自 pages/pipeline/PipelineManagementPage
└── AIAsk/                       # 🆕 AI NL→BI
```

#### 9.4.3 前端 API 客户端补全清单

新增 7 个 API 客户端文件（对应后端无前端入口的 7 个模块）：

| API 文件 | 对接后端 | 优先级 |
|---------|---------|--------|
| `src/api/bi-dashboard.ts` | `internal/bi-dashboard/` | P0 |
| `src/api/data-catalog.ts` | `internal/data-catalog/` | P0 |
| `src/api/data-masking.ts` | `internal/data-masking/` | P0 |
| `src/api/data-classification.ts` | `internal/data-classification/` | P0 |
| `src/api/datasource.ts` | `internal/datasource/` | P0 |
| `src/api/database-devops.ts` | 增强（已有但需补全） | P0 |
| `src/api/report-designer.ts` | 增强（已有 reportDashboard.ts） | P1 |

### 9.5 路由 + 菜单注册

#### 路由注册（`src/router/routes.tsx`）

```tsx
// DBA 专家工作台（替换现有碎片化 /dba）
{
  path: '/dba-workbench',
  element: React.lazy(() => import('@/pages/dba-workbench')),
  protected: true,
  requiredPermission: { resource: 'dba', action: 'read' },
  routes: [
    { path: '/dba-workbench/orders', element: <Orders /> },
    { path: '/dba-workbench/datasources', element: <DataSources /> },
    { path: '/dba-workbench/audit-rules', element: <AuditRules /> },
    { path: '/dba-workbench/slow-queries', element: <SlowQueries /> },
    { path: '/dba-workbench/explain', element: <Explain /> },
    { path: '/dba-workbench/index-advisor', element: <IndexAdvisor /> },
    { path: '/dba-workbench/ai-advisor', element: <AIAdvisor /> },
    { path: '/dba-workbench/backup', element: <Backup /> },
    { path: '/dba-workbench/health', element: <HealthCheck /> },
    { path: '/dba-workbench/capacity', element: <CapacityPlanning /> },
  ],
},

// 数据工程工作台（整合散落数据页面）
{
  path: '/data-workbench',
  element: React.lazy(() => import('@/pages/data-workbench')),
  protected: true,
  requiredPermission: { resource: 'data', action: 'read' },
  routes: [
    { path: '/data-workbench/catalog', element: <DataCatalog /> },
    { path: '/data-workbench/profiler', element: <DataProfiler /> },
    { path: '/data-workbench/quality', element: <DataQuality /> },
    { path: '/data-workbench/lineage', element: <DataLineage /> },
    { path: '/data-workbench/masking', element: <DataMasking /> },
    { path: '/data-workbench/classification', element: <DataClassification /> },
    { path: '/data-workbench/metadata', element: <Metadata /> },
    { path: '/data-workbench/bi-dashboard', element: <BiDashboard /> },
    { path: '/data-workbench/report-designer', element: <ReportDesigner /> },
    { path: '/data-workbench/pipeline', element: <DataPipeline /> },
    { path: '/data-workbench/ai-ask', element: <AIAsk /> },
  ],
},
```

#### 菜单注册（`src/stores/menuConfigStore.ts`）

```ts
// 基础设施下新增两个工作台（替换现有碎片化 DBA 入口）
{
  key: '/dba-workbench',
  label: 'DBA 专家工作台',
  description: 'SQL工单、慢查询、执行计划、索引建议、AI SQL 助手',
  category: '数据库DevOps',
  enabled: true,
},
{
  key: '/data-workbench',
  label: '数据工程工作台',
  description: '数据目录、探查、质量、血缘、BI仪表盘、智能问数',
  category: '数据治理',
  enabled: true,
},
```

### 9.6 缺口清单补充

| ID | 缺失能力 | 优先级 | 归属工作台 |
|----|---------|--------|-----------|
| UI-P0-1 | DBA 专家工作台（10 子页面 + 路由 + 菜单） | P0 | dba-workbench |
| UI-P0-2 | 数据工程工作台（11 子页面 + 路由 + 菜单） | P0 | data-workbench |
| UI-P0-3 | 7 个 API 客户端补全（bi-dashboard/data-catalog/data-masking/data-classification/datasource/database-devops 增强/report-designer 增强） | P0 | 跨工作台 |
| UI-P0-4 | data-catalog 前端页面（最大单体缺口，1446 行后端无 UI） | P0 | data-workbench |
| UI-P0-5 | bi-dashboard 前端页面（367 行后端无 UI） | P0 | data-workbench |
| UI-P0-6 | data-masking 前端页面（571 行后端无 UI） | P0 | data-workbench |
| UI-P0-7 | data-classification 前端页面（433 行后端无 UI） | P0 | data-workbench |
| UI-P0-8 | datasource 前端页面（560 行后端无独立 UI） | P0 | dba-workbench |

### 9.7 与 AI 设计的关系

前端工作台是 **AI 能力的用户触达载体**：

| 工作台子页面 | 对应 AI 设计（第五章） |
|------------|---------------------|
| DBA → AI SQL 助手 | `internal/dba/advisor/` Text2SQL + SQL Advisor |
| DBA → 索引建议 | `internal/dba/advisor/index_advisor.go` |
| DBA → 慢 SQL 分析 | `internal/dba/slowquery/` + `agent/rca_agent.go` |
| 数据工程 → 数据探查 | `internal/data-catalog/profiler/` AI Profile |
| 数据工程 → 智能问数 | `internal/bi-dashboard/agent/` NL→BI |
| 数据工程 → 数据血缘 | `internal/data-lineage/parser/` 自动采集 |

**先有入口，才能注入 AI**：工作台提供页面壳，AI Agent 注入能力内核。两者必须配套交付。

### 9.8 工作台实施计划

| Phase | 任务 | 工作量 |
|-------|------|--------|
| UI-Phase 1 | DBA 工作台骨架 + 3 个迁移页（Orders/DataSources/AuditRules）+ 路由 + 菜单 | 2d |
| UI-Phase 2 | 数据工程工作台骨架 + 3 个迁移页（Quality/Lineage/Metadata）+ 路由 + 菜单 | 2d |
| UI-Phase 3 | 7 个 API 客户端补全 | 2d |
| UI-Phase 4 | data-catalog + bi-dashboard + data-masking + data-classification 4 个新页面 | 5d |
| UI-Phase 5 | DBA 新页面（SlowQueries/Explain/IndexAdvisor/AIAdvisor/Backup/Health/Capacity） | 5d |
| UI-Phase 6 | 数据工程新页面（Profiler/AIAsk）+ ReportDesigner/Pipeline 迁移 | 3d |

**前端工作台合计**: 19 人天，可与第六章 AI 后端路线图（35 人天）并行推进。

---

> 文档结束。本文档为 DBA专家 + 数据挖掘工程师 + AI智能体三视角的缺失能力分析与设计完善方案，基于代码级实测与标杆平台对标，可直接作为后续开发的设计依据。
> 第九章为补充评审：前端访问入口缺口与工作台设计方案，与第五章 AI 设计、第六章路线图配套交付。
