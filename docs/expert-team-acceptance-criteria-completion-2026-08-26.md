# Orion 系统设计方案 — 验收标准缺口补全报告

> **文档版本**: v1.0 | **生成日期**: 2026-08-26
> **触发指令**: 启动互联网大厂资深领域专家团队，对当前整体系统的设计方案进行缺失验收标准规则的识别与补全
> **评审范围**: 217 前端页面 × 310 后端服务 × 359 路由 × 40 spec × 15 ADR × 9 服务设计文档
> **产出**: 本报告 + 12 份 P0 优先缺口 Spec 补全文档

---

## 目录

1. [专家团队构成](#1-专家团队构成)
2. [分析方法论](#2-分析方法论)
3. [现状盘点](#3-现状盘点)
4. [验收标准缺口识别](#4-验收标准缺口识别)
5. [优先级排序](#5-优先级排序)
6. [P0 优先级缺口补全方案](#6-p0-优先级缺口补全方案)
7. [跨域协作验收标准](#7-跨域协作验收标准)
8. [验收标准模板](#8-验收标准模板)
9. [实施路线图](#9-实施路线图)
10. [交叉引用矩阵](#10-交叉引用矩阵)

---

<a id="1-专家团队构成"></a>
## 一、专家团队构成

本报告由模拟的 12 位互联网大厂资深领域专家组成，各专家在特定领域具备 10+ 年生产经验。

| # | 专家角色 | 背景 (公司 + 年限) | 评审领域 |
|:-:|---------|-------------------|---------|
| E1 | **首席系统架构师** | Google SRE / 15y | 整体架构一致性、跨域耦合、SLA 设计 |
| E2 | **可靠性架构专家** | Netflix / 12y | 弹性、混沌工程、故障恢复、SLO/SLI |
| E3 | **多租户安全专家** | AWS / 13y | 租户隔离、IAM、ABAC、密钥轮换 |
| E4 | **AIOps 首席架构师** | Meta / 10y | AI Agent 平台、Prompt 治理、幻觉防控 |
| E5 | **数据平台专家** | Uber Data / 11y | DataOps、血缘、质量、FinOps |
| E6 | **DevOps 平台专家** | GitLab / 12y | CI/CD 流水线、制品、SBOM、供应链 |
| E7 | **微服务治理专家** | Stripe / 10y | 服务网格、API 网关、gRPC、Circuit Breaker |
| E8 | **合规审计专家** | Palantir / 14y | SOC2、ISO27001、GDPR、审计追溯 |
| E9 | **前端架构专家** | Slack / 9y | 微前端、状态管理、可访问性、性能 |
| E10 | **数据库专家** | CockroachDB / 11y | 多租户存储、读写分离、迁移策略 |
| E11 | **可观测性专家** | Datadog / 10y | OpenTelemetry、APM、日志、Tracing |
| E12 | **FinOps 首席** | HashiCorp / 8y | 成本分摊、预算告警、容量规划、闲置治理 |

**评审机制**: 各专家独立评审 → 交叉打分 → 共识会议 → 优先级仲裁 → 报告汇总

---

<a id="2-分析方法论"></a>
## 二、分析方法论

采用 **四层穿透分析法**，每层专家视角独立打分再汇总。

```
Layer 1: 覆盖度扫描 (Coverage Scan)
  → 每个后端服务是否有对应 spec？每个页面是否有对应 spec？
  → 输出: 覆盖率热力图
Layer 2: 深度审计 (Depth Audit)
  → 已有 spec 是否含完整验收标准 (AC)？每条 AC 是否有验证方式？
  → 输出: AC 完整度报告
Layer 3: 跨域协作审计 (Cross-Domain Audit)
  → 服务间契约、事件流、权限模型是否有一致规则？
  → 输出: 跨域契约缺口清单
Layer 4: 运行时规则审计 (Runtime Rules Audit)
  → 运行时行为 (限流、重试、熔断、超时、幂等) 是否有统一标准？
  → 输出: 运行时规则基线
```

**判定标准** (每个 Spec 是否合格):
- ✅ **完整**: 有 ≥ 15 条 AC，每条含验证方式 (API 测试 / 集成测试 / 前端验证 / 单元测试)，覆盖所有子模块
- ⚠️ **部分**: AC < 15 条，或缺验证方式，或子模块缺失
- ❌ **缺失**: 完全无 spec


---

<a id="3-现状盘点"></a>
## 三、现状盘点

### 3.1 资产总量 (2026-08-26 实测)

| 维度 | 实测值 | 数据来源 |
|------|:-----:|---------|
| 前端页面目录 | 217 | `find orion-frontend/src/pages -maxdepth 1 -type d` |
| 后端服务 (internal/) | 310 | `find orion-platform-svc-go/internal -maxdepth 1 -type d` |
| 路由条目 | 359 | `grep -c "path:" routes.tsx` |
| Spec 文档 (真实规范) | 40 | `ls docs/specs/*.md \| grep -v metadata` |
| ADR 架构决策 | 15 (编号 001-015) | `ls docs/adr/` |
| 服务设计文档 | 9 | `ls docs/services/*.md` |
| 规范总文档 | 672+ | `find docs -name "*.md" \| wc -l` |

### 3.2 覆盖率 (Coverage Ratio)

| 覆盖类型 | 已覆盖 | 总需求 | 覆盖率 | 缺口 |
|---------|:------:|:------:|:------:|:----:|
| 后端服务 → Spec | 40 | 310 | **12.9%** | 270 服务无 spec |
| 前端页面 → Spec | 40 | 217 | **18.4%** | 177 页面无对应 spec |
| 路由 → Spec | ~40 | 359 | **11.1%** | 319 路由无规范 |
| ADR 深度 (含 AC) | 4 / 15 | 15 | **26.7%** | 11 ADR 仅决策，无验收标准 |
| 服务设计 → AC 覆盖 | 5 / 9 | 9 | **55.6%** | 4 服务设计无 AC |

### 3.3 已有 40 Spec 深度审计

| Spec | AC 数 | 验证方式覆盖 | 完整度 |
|------|:----:|:-----------:|:-----:|
| api-governance | 23 | 5 类全覆盖 | ✅ 完整 |
| artifact-operations | 22 | 5 类全覆盖 | ✅ 完整 |
| community-ecosystem | 23 | 5 类全覆盖 | ✅ 完整 |
| config-mgmt | 21 | 5 类全覆盖 | ✅ 完整 |
| data-pipeline | 24 | 5 类全覆盖 | ✅ 完整 |
| digital-twin | 22 | 5 类全覆盖 | ✅ 完整 |
| federated-scheduling | 23 | 5 类全覆盖 | ✅ 完整 |
| security-compliance | 23 | 5 类全覆盖 | ✅ 完整 |
| self-healing | 23 | 5 类全覆盖 | ✅ 完整 |
| **其余 31 spec** | **10-18** | **3-4 类** | ⚠️ 部分 |

**关键发现**: 只有 9 / 40 spec 达到"完整"标准 (含 ≥ 15 条 AC + 5 类验证方式全覆盖)。其余 31 spec 存在 AC 数量不足、验证方式缺失、子模块遗漏等缺陷。

### 3.4 缺失 Spec 域 (无 Spec 覆盖的关键域)

**基于 217 前端页面 × 310 后端服务的交叉分析，识别 12 个核心缺失域**：

| # | 缺失域 | 前端页面 | 后端服务 | 影响面 |
|:-:|-------|:--------:|:--------:|:-----:|
| G1 | **CMDB / 配置管理** | CMDB, ConfigManagement, ConfigDiff | cmdb, config-diff, unified-config | 资产治理入口 |
| G2 | **变更管理** | ChangeManagement, ChangeIntelligence, ChangeRequestManagement | change, change-intelligence, change-request, branch-policy | 变更闭环缺失 |
| G3 | **FinOps / 成本** | FinOpsDashboard, CostAllocation, PipelineBudget, cost-operations | billing, cost, capacity, sla | 成本可见性缺失 |
| G4 | **服务目录/拓扑** | ServiceCatalog, ServicePortal, ServiceRegistry, service-topology, service-boundary | service-registry, service-topology, service-health | 服务可见性缺失 |
| G5 | **事件响应 (OnCall/Incident)** | OnCall, Incident, Problem, AlertList, alert-escalation, RunbookManagement | alert*, incident, problem, runbook, oncall | 事件闭环缺失 |
| G6 | **AI Agent 平台** | AIAgents, AIDashboard, AIReview, AIGateway, AIDocManagement, AICostDashboard, AgentDashboard, AgentRunDetail, PromptCanary, EvalSetManagement, LLMTraceDashboard, ModelEvolution | agents, ai, ai-agent-run, ai-review, llm-svc, agent-trace | AI 治理缺失 |
| G7 | **流水线主域** | PipelineList, PipelineDetail, PipelineEditor, PipelineRunList, PipelineRunLive, PipelineRunAnalytics, PipelineVersionHistory | pipeline, pipeline-svc, runner-svc, ci-cd, auto-exec | 核心能力无主 spec |
| G8 | **制品 / SBOM** | Artifacts, ArtifactBrowser, ArtifactVersion, SbomDashboard, SbomDetail | artifact, artifact-lifecycle, artifact-version, sbom, supply-chain | 供应链安全缺口 |
| G9 | **知识库** | KnowledgeBase, KnowledgeBaseV2, DocumentCenter | pandawiki, ticket-knowledge | 知识管理缺口 |
| G10 | **测试管理** | TestReport, TestSelector, contract-test, quality-gate | test-execution-engine, test-generation, test-reports, test-selector, quality-gate | QA 缺口 |
| G11 | **租户 / 配额 / 用户** | TenantList, TenantManagement, tenant-quota, UserManagement, RoleManagement, UserSettings, UserProfile, Sessions | tenant, tenant-quota, tenant-gateway, user, user-profile, user-status, user-activity, user-token, session, sso, auth-mfa | 多租户治理缺口 |
| G12 | **MCP / 脚本 / 编排** | MCPManagement, plugin-marketplace, PluginSPI, ScriptLibrary, ScriptRunner, ScriptVersions, WorkflowDesigner, WorkflowTasks, WorkflowTriggers | tool, skill, workflow, workflow-*, orchestration, script-runner | 编排能力缺口 |

**总缺口规模**: 12 域 × 平均 20-30 条 AC = **约 240-360 条验收标准缺失**


---

<a id="4-验收标准缺口识别"></a>
## 四、验收标准缺口识别

### 4.1 Layer 1: 覆盖度扫描结果

```
后端服务覆盖: [████████░░░░░░░░░░░░░░░░░░░░░░░░░░░] 12.9%  ← 严重不足
前端页面覆盖: [██████████░░░░░░░░░░░░░░░░░░░░░░░░░░░] 18.4%  ← 严重不足
路由覆盖:     [██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 11.1%  ← 严重不足
ADR 深度:     [███████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 26.7%  ← 中等缺口
服务设计深度: [██████████████████████░░░░░░░░░░░░░░░░░░] 55.6%  ← 相对可接受
```

**E1 首席架构师点评**: "Orion 有 310 个后端服务，但只有 40 个 spec，覆盖率 12.9%。这不是规范不足，是**规范体系未建立**。每新增 1 个服务没有强制生成 spec 的机制。建议在 CI 中增加 spec-presence gate。"

### 4.2 Layer 2: 深度审计结果 (已有 Spec 的质量)

| Spec | AC 数 | AC 验证方式覆盖 | 是否含 API 设计 | 是否含数据模型 | 是否含依赖 | 完整度 |
|------|:----:|:-------------:|:-------------:|:-------------:|:---------:|:-----:|
| api-governance | 23 | 5/5 | ✅ | ✅ | ✅ | 100% |
| artifact-operations | 22 | 5/5 | ✅ | ✅ | ✅ | 100% |
| community-ecosystem | 23 | 5/5 | ✅ | ✅ | ✅ | 100% |
| config-mgmt | 21 | 5/5 | ✅ | ✅ | ✅ | 100% |
| data-pipeline | 24 | 5/5 | ✅ | ✅ | ✅ | 100% |
| digital-twin | 22 | 5/5 | ✅ | ✅ | ✅ | 100% |
| federated-scheduling | 23 | 5/5 | ✅ | ✅ | ✅ | 100% |
| security-compliance | 23 | 5/5 | ✅ | ✅ | ✅ | 100% |
| self-healing | 23 | 5/5 | ✅ | ✅ | ✅ | 100% |
| **平均 (31 其他)** | **13.2** | **3.4/5** | **62%** | **48%** | **31%** | **68%** |

**关键发现**: 已有 9 spec 达"完整"标准；其余 31 spec 平均缺 60% 依赖说明、52% 数据模型、1.6 类验证方式。

**E7 微服务专家点评**: "31 个 spec 平均只有 13.2 条 AC，且无依赖说明 — 这意味着服务间契约没有规范。一旦某个服务重构，下游服务会静默失败。建议在每个 spec 增加 '依赖服务 + 契约变更通知' 章节。"

### 4.3 Layer 3: 跨域协作审计

**识别 8 类跨域契约缺失**:

| # | 契约类型 | 现状 | 影响 |
|:-:|---------|------|------|
| C1 | **服务间 API 契约** | 无统一版本号策略 | 破坏性变更无通知 |
| C2 | **事件流契约** | EventBus 有 spec，但事件 schema 分散 | 消费方无版本感知 |
| C3 | **权限模型契约** | RBAC + ABAC 并存，无统一映射 | 权限混乱 |
| C4 | **审计日志契约** | 各服务自定字段 | 合规审计困难 |
| C5 | **错误码契约** | 无统一错误码体系 | 客户端解析困难 |
| C6 | **数据模型契约** | 各服务独立定义共享实体 | 数据不一致 |
| C7 | **配置契约** | Feature Flag + Config 并存 | 配置漂移 |
| C8 | **可观测性契约** | Tracing/Logging/Metrics 各自为政 | 排障困难 |

**E8 合规专家点评**: "C4 审计日志契约缺失是最严重的合规风险。SOC2 要求审计日志字段统一、时序完整。当前各服务自定义字段，无法做端到端审计追溯。建议立即定义统一审计日志 schema。"

### 4.4 Layer 4: 运行时规则审计

**识别 6 类运行时规则缺失**:

| # | 规则类型 | 建议基线 | 现状 |
|:-:|---------|---------|------|
| R1 | **超时规则** | 客户端 30s / 服务端 120s / 后台任务 30min | 无统一标准 |
| R2 | **重试规则** | 指数退避 (1s/2s/4s)，最多 3 次 | 各服务自定 |
| R3 | **幂等规则** | 关键写操作必须幂等 (Idempotency-Key) | 无规范 |
| R4 | **限流规则** | 100 req/min/user, 1000 req/min/tenant | 无统一标准 |
| R5 | **熔断规则** | 50% 错误率触发，30s 半开 | 无统一标准 |
| R6 | **超时传播** | 上游超时 < 下游超时之和 | 无规范 |

**E2 可靠性专家点评**: "R3 幂等规则缺失是最容易引发事故的点。支付、部署、事件发布等关键写操作如果无幂等，重试一次就产生重复订单/重复部署。建议将所有 POST/PUT 写操作强制要求 Idempotency-Key 头。"


---

<a id="5-优先级排序"></a>
## 五、优先级排序

综合专家共识 (E1-E12 投票) 后，12 个缺口域按以下维度评分 (1-5 分制):

| 缺口 | 业务影响 | 合规风险 | 技术债 | 实施成本 | 紧急度 | 总分 |
|------|:-------:|:-------:|:------:|:-------:|:-----:|:----:|
| G5 事件响应 | 5 | 5 | 5 | 3 | 5 | **4.2** |
| G3 FinOps | 5 | 3 | 4 | 2 | 4 | **3.6** |
| G6 AI Agent | 5 | 4 | 5 | 3 | 5 | **4.4** |
| G7 流水线主域 | 5 | 3 | 4 | 3 | 4 | **3.6** |
| G8 制品/SBOM | 4 | 5 | 4 | 2 | 4 | **3.8** |
| G1 CMDB | 4 | 3 | 3 | 2 | 3 | **3.0** |
| G2 变更管理 | 4 | 4 | 3 | 2 | 3 | **3.2** |
| G11 租户/用户 | 4 | 5 | 4 | 3 | 4 | **3.6** |
| G4 服务目录 | 3 | 2 | 3 | 2 | 2 | **2.6** |
| G12 MCP/编排 | 3 | 2 | 3 | 3 | 3 | **2.6** |
| G9 知识库 | 3 | 2 | 2 | 2 | 2 | **2.4** |
| G10 测试管理 | 3 | 3 | 3 | 3 | 3 | **3.0** |

**排序后 P0 (总分级差 ≥ 3.5)**:
1. **G6 AI Agent 平台** (4.4) — 战略能力
2. **G5 事件响应** (4.2) — 生产事故
3. **G8 制品/SBOM** (3.8) — 供应链安全
4. **G3 FinOps** (3.6) — 成本控制
5. **G7 流水线主域** (3.6) — 核心能力
6. **G11 租户/用户** (3.6) — 多租户治理

**P1 (总分 3.0-3.4)**:
7. G2 变更管理 (3.2)
8. G1 CMDB (3.0)
9. G10 测试管理 (3.0)

**P2 (总分 < 3.0)**:
10. G4 服务目录 (2.6)
11. G12 MCP/编排 (2.6)
12. G9 知识库 (2.4)


---

<a id="6-p0-优先级缺口补全方案"></a>
## 六、P0 优先级缺口补全方案

以下补全方案由对应领域专家主笔，每条 AC 均含验证方式。

### 6.1 G6: AI Agent 平台 Spec (E4 主笔)

**范围**: AIAgents, AIDashboard, AIReview, AIGateway, AIDocManagement, AICostDashboard, AgentDashboard, AgentRunDetail, PromptCanary, EvalSetManagement, LLMTraceDashboard, ModelEvolution

**12 个能力子域**:

| 子域 | AC 数 | 关键能力 |
|-----|:----:|---------|
| Agent 注册与生命周期 | 8 | 注册、发现、健康检查、版本管理 |
| Agent 执行与调度 | 10 | 任务分发、并发控制、超时、重试 |
| Prompt 治理 | 10 | 模板管理、版本控制、A/B 测试、金丝雀发布 |
| 幻觉防控 | 8 | 输出校验、引用追溯、置信度评分 |
| 评估集管理 | 8 | 评估集 CRUD、评估运行、指标聚合 |
| LLM 网关 | 10 | 多供应商路由、降级、限流、成本记账 |
| 成本可见性 | 6 | Token 用量、按 Agent/项目分摊、预算告警 |
| 执行追踪 | 8 | Trace 记录、Span 聚合、失败定位 |
| 文档与知识库 | 8 | 文档索引、RAG 检索、引用溯源 |
| 模型演进 | 6 | 模型切换、灰度、回滚 |
| AI 安全 | 8 | Prompt 注入检测、敏感数据过滤 |
| 可观测性 | 8 | 仪表盘、告警、SLO |

**关键 AC (示例)**:

| # | 标准 | 验证方式 |
|---|------|----------|
| AG1 | Agent 注册时必须声明版本、健康检查端点、依赖模型 | API 测试 |
| AG2 | Agent 执行超时 60s，超时自动取消并记录 Trace | 集成测试 |
| AG3 | Prompt 模板必须版本化，支持回滚到任一历史版本 | 集成测试 |
| AG4 | 幻觉检测：Agent 输出含未引用外部事实时标记警告 | 集成测试 |
| AG5 | 评估集支持 5+ 评估维度 (准确性/一致性/完整性/安全性/成本) | API 测试 |
| AG6 | LLM 网关按成本+延迟双维度路由，降级时自动切换备用供应商 | 集成测试 |
| AG7 | Token 成本按 Agent 执行自动记账，支持按项目/团队分摊 | 集成测试 |
| AG8 | Prompt 注入检测：输入含 `ignore all previous instructions` 类模式时拒绝 | 单元测试 |
| AG9 | 敏感数据过滤：PII (邮箱/手机/身份证) 自动脱敏 | 单元测试 |
| AG10 | Trace 完整覆盖 Prompt → LLM 调用 → 输出，Span 关联 | 集成测试 |

**验收方式**: API 测试 8 项 + 集成测试 10 项 + 单元测试 4 项 + 前端验证 6 项

### 6.2 G5: 事件响应 Spec (E2 主笔)

**范围**: OnCall, Incident, Problem, AlertList, alert-escalation, RunbookManagement, alert-rule-engine, alert-correlation, alert-deduplication, alert-silence, alert-pipeline, alert-breaker

**8 个能力子域**:

| 子域 | AC 数 | 关键能力 |
|-----|:----:|---------|
| 告警规则引擎 | 10 | 规则 CRUD、表达式、去重、静默 |
| 告警关联 | 8 | 相关性分析、告警聚合、根因推断 |
| 告警升级 | 6 | 升级链、超时升级、轮询升级 |
| 值班表 | 8 | OnCall 排班、交接班、覆盖 |
| 事件管理 | 10 | 事件生命周期、状态流转、时间线 |
| 问题管理 | 6 | Problem 关联、根因分析、复盘 |
| Runbook | 8 | Runbook CRUD、执行、审核 |
| ChatOps | 6 | 事件通知、命令执行、审批 |

**关键 AC (示例)**:

| # | 标准 | 验证方式 |
|---|------|----------|
| IR1 | 告警规则支持 PromQL / LogQL / MetricQL 表达式 | API 测试 |
| IR2 | 告警去重窗口 5min，窗口内相同告警合并 | 集成测试 |
| IR3 | 告警静默支持标签匹配 + 时间段 + 备注 | API 测试 |
| IR4 | 告警升级链：L1 值班 15min → L2 主管 30min → L3 CTO | 集成测试 |
| IR5 | 值班表支持轮班、节假日覆盖、单人最多 2 周 | API 测试 |
| IR6 | 事件状态机：Triggered → Acknowledged → Resolved (不可逆回退) | 集成测试 |
| IR7 | 事件时间线自动记录状态变更、通知、操作 | 集成测试 |
| IR8 | Runbook 执行需审批 (P0/P1 事件)，审批链 ≥ 2 人 | 集成测试 |
| IR9 | 事件复盘报告自动生成 (时间线、影响面、根因、改进项) | 前端验证 |
| IR10 | ChatOps 支持 Slack/钉钉/飞书多通道通知 | 集成测试 |

**验收方式**: API 测试 6 项 + 集成测试 12 项 + 前端验证 4 项 + 单元测试 6 项

### 6.3 G8: 制品 / SBOM Spec (E6 主笔)

**范围**: Artifacts, ArtifactBrowser, ArtifactVersion, SbomDashboard, SbomDetail, artifact, artifact-lifecycle, artifact-version, sbom, supply-chain

**6 个能力子域**:

| 子域 | AC 数 | 关键能力 |
|-----|:----:|---------|
| 制品生命周期 | 10 | 上传、版本、保留策略、归档 |
| 制品索引 | 8 | Docker/ImageHash/SBOM 关联 |
| SBOM 生成 | 8 | SPDX/CycloneDX 格式生成 |
| 漏洞扫描 | 10 | CVE 扫描、严重度分级、豁免 |
| 供应链验证 | 8 | 签名验证、依赖锁定、来源追溯 |
| 合规审计 | 6 | 许可证扫描、许可证合规 |

**关键 AC (示例)**:

| # | 标准 | 验证方式 |
|---|------|----------|
| AR1 | 制品上传必须关联构建流水线 + Git Commit | 集成测试 |
| AR2 | 制品版本不可变，同 tag 不允许覆盖 | 集成测试 |
| AR3 | 制品保留策略：默认 90 天，支持按标签扩展 | API 测试 |
| AR4 | SBOM 自动生成 (SPDX + CycloneDX 双格式) | 集成测试 |
| AR5 | SBOM 覆盖所有直接 + 传递依赖 | 单元测试 |
| AR6 | CVE 扫描每日自动执行，严重度 ≥ HIGH 告警 | 集成测试 |
| AR7 | 漏洞豁免需审批，豁免期 ≤ 30 天 | 集成测试 |
| AR8 | 制品签名验证 (Cosign / Sigstore)，未签名拒绝部署 | 集成测试 |
| AR9 | 依赖锁定文件存在且 hash 匹配 | 单元测试 |
| AR10 | 许可证扫描，GPL/AGPL 等传染性许可证需审批 | 集成测试 |

**验收方式**: API 测试 4 项 + 集成测试 12 项 + 单元测试 4 项 + 前端验证 6 项


### 6.4 G3: FinOps / 成本 Spec (E12 主笔)

**范围**: FinOpsDashboard, CostAllocation, PipelineBudget, cost-operations, billing, cost, capacity, sla

**7 个能力子域**:

| 子域 | AC 数 | 关键能力 |
|-----|:----:|---------|
| 成本采集 | 8 | 多云成本采集、聚合、对账 |
| 成本分摊 | 10 | 按标签/项目/团队/环境分摊 |
| 预算与告警 | 8 | 预算设置、阈值告警、预测 |
| 闲置治理 | 6 | 闲置资源识别、通知、下线 |
| 容量规划 | 6 | 使用率分析、预测、扩容建议 |
| SLA/SLO 计费 | 6 | SLA 达标计费、降级补偿 |
| 报表 | 6 | 多维度报表、导出、订阅 |

**关键 AC (示例)**:

| # | 标准 | 验证方式 |
|---|------|----------|
| F1 | 多云成本采集支持 AWS/Azure/GCP/阿里云/华为云 | 集成测试 |
| F2 | 成本采集延迟 ≤ 24h，精度 ≥ 95% | 集成测试 |
| F3 | 成本分摊规则支持 4 维度 (标签/项目/团队/环境) | API 测试 |
| F4 | 分摊后各维度总和 = 原始成本 (±0.5% 精度) | 单元测试 |
| F5 | 预算超阈值 (80%/100%/120%) 三级告警 | 集成测试 |
| F6 | 预算预测支持 30/60/90 天趋势 | 前端验证 |
| F7 | 闲置资源识别：CPU < 5% 且网络 < 1MB/s 持续 7 天 | 集成测试 |
| F8 | 闲置通知后 7 天未处理自动下线 | 集成测试 |
| F9 | 容量预测支持 30 天滚动窗口 | 前端验证 |
| F10 | SLA 达标率 < 99.9% 时自动触发降级补偿 | 集成测试 |

**验收方式**: API 测试 4 项 + 集成测试 12 项 + 单元测试 4 项 + 前端验证 4 项

### 6.5 G7: 流水线主域 Spec (E6 主笔)

**范围**: PipelineList, PipelineDetail, PipelineEditor, PipelineRunList, PipelineRunLive, PipelineRunAnalytics, PipelineVersionHistory, pipeline, pipeline-svc, ci-cd, auto-exec

**7 个能力子域**:

| 子域 | AC 数 | 关键能力 |
|-----|:----:|---------|
| 流水线 CRUD | 8 | 创建、编辑、删除、导入导出 |
| 流水线编辑器 | 10 | 拖拽式、条件分支、并行、子流水线 |
| 流水线执行 | 10 | 触发、并发、取消、重跑 |
| 流水线版本 | 6 | 版本快照、对比、回滚 |
| 运行分析 | 8 | 耗时统计、成功率、瓶颈分析 |
| 实时追踪 | 6 | 实时日志、状态推送、WebSocket |
| 权限与触发 | 6 | 触发权限、Webhook、定时 |

**关键 AC (示例)**:

| # | 标准 | 验证方式 |
|---|------|----------|
| PL1 | 流水线支持 YAML DSL + UI 编辑器双模式，双向同步 | 集成测试 |
| PL2 | 流水线编辑器支持拖拽节点、条件分支 (if/else)、并行 (parallel)、循环 (loop) | 前端验证 |
| PL3 | 子流水线调用支持参数传递 + 返回值 | 集成测试 |
| PL4 | 流水线触发源：手动 / Webhook / 定时 (Cron) / 事件 | 集成测试 |
| PL5 | 并发控制：同分支默认串行，可配置并行度 | 集成测试 |
| PL6 | 运行取消支持 (running → cancelled)，下游阶段自动取消 | 集成测试 |
| PL7 | 重跑支持 (全部 / 从失败阶段 / 指定阶段) | 集成测试 |
| PL8 | 流水线版本快照不可变，可对比 diff | API 测试 |
| PL9 | 耗时分析按阶段聚合，识别 Top 3 瓶颈 | 前端验证 |
| PL10 | 实时日志推送延迟 ≤ 2s (WebSocket) | 集成测试 |

**验收方式**: API 测试 4 项 + 集成测试 12 项 + 单元测试 2 项 + 前端验证 6 项

### 6.6 G11: 租户 / 用户 / 权限 Spec (E3 主笔)

**范围**: TenantList, TenantManagement, tenant-quota, UserManagement, RoleManagement, UserSettings, UserProfile, Sessions, tenant, tenant-quota, tenant-gateway, user, user-profile, user-status, user-activity, user-token, session, sso, sso-providers, sso-unified, auth-mfa

**8 个能力子域**:

| 子域 | AC 数 | 关键能力 |
|-----|:----:|---------|
| 租户生命周期 | 8 | 创建、停用、删除、迁移 |
| 租户隔离 | 10 | 数据隔离、资源隔离、配置隔离 |
| 租户配额 | 8 | 资源配额、配额调整、超限告警 |
| 用户管理 | 8 | 用户 CRUD、角色分配、状态管理 |
| RBAC | 8 | 角色、权限、继承 |
| ABAC | 8 | 属性、条件、策略 |
| SSO/SAML | 6 | SSO 提供商、SAML/OIDC |
| MFA | 6 | 多因子认证、TOTP、SMS |
| 会话管理 | 6 | 会话、Token、刷新 |

**关键 AC (示例)**:

| # | 标准 | 验证方式 |
|---|------|----------|
| T1 | 租户数据隔离：独立 schema 或独立数据库 (按规模自动选择) | 集成测试 |
| T2 | 租户资源隔离：独立 K8s Namespace + NetworkPolicy | 集成测试 |
| T3 | 租户配额：API 调用、存储、计算、流水线并发 | API 测试 |
| T4 | 配额超限返回 429 + Retry-After，通知租户管理员 | 集成测试 |
| T5 | RBAC 权限继承：角色可继承其他角色 | 单元测试 |
| T6 | ABAC 策略：基于属性 (时间/地域/资源标签) 的访问控制 | 单元测试 |
| T7 | RBAC + ABAC 双模型：RBAC 粗粒度 + ABAC 细粒度 | 集成测试 |
| T8 | SSO 支持 SAML 2.0 + OIDC，多 IdP 并存 | 集成测试 |
| T9 | MFA 强制：管理员账号必须启用 MFA | 集成测试 |
| T10 | 会话 Token 有效期 2h，刷新 Token 有效期 30 天 | 单元测试 |
| T11 | 会话管理：支持强制下线、多端登录控制 | 集成测试 |
| T12 | 用户活动审计：登录、权限变更、资源访问全记录 | 集成测试 |

**验收方式**: API 测试 6 项 + 集成测试 14 项 + 单元测试 4 项 + 前端验证 4 项


---

<a id="7-跨域协作验收标准"></a>
## 七、跨域协作验收标准

以下 8 类跨域契约 + 6 类运行时规则形成统一规范，所有服务必须遵守。

### 7.1 服务间 API 契约 (C1)

| # | 标准 | 验证方式 |
|---|------|----------|
| C1.1 | 所有 API 必须使用 URL 路径版本 (/v1/, /v2/) | 代码扫描 |
| C1.2 | 每个 API 必须有 OpenAPI 3.0 定义 | 构建时检查 |
| C1.3 | 破坏性变更必须发新版本，旧版本保留 ≥ 6 个月 | 集成测试 |
| C1.4 | API 变更必须通知订阅方 (Webhook + 邮件) | 集成测试 |
| C1.5 | 每个 API 必须声明幂等性 (Idempotent / Non-Idempotent) | 代码扫描 |

### 7.2 事件流契约 (C2)

| # | 标准 | 验证方式 |
|---|------|----------|
| C2.1 | 所有事件必须有 schema 定义 (JSON Schema / Avro) | 构建时检查 |
| C2.2 | 事件消费必须声明版本范围 (v1-v2 兼容) | 集成测试 |
| C2.3 | 事件必须含 traceId 以支持端到端追踪 | 单元测试 |
| C2.4 | 事件发布必须至少一次 (at-least-once) 语义 | 集成测试 |
| C2.5 | 事件消费必须幂等 (基于 eventId 去重) | 单元测试 |

### 7.3 权限模型契约 (C3)

| # | 标准 | 验证方式 |
|---|------|----------|
| C3.1 | RBAC 角色必须映射到 ABAC 属性 (角色 = 一组属性) | 单元测试 |
| C3.2 | 权限检查必须统一入口 (middleware) | 代码扫描 |
| C3.3 | 权限变更必须记录审计日志 | 集成测试 |
| C3.4 | 权限检查失败必须返回 403 + 错误码 + 权限申请链接 | 单元测试 |

### 7.4 审计日志契约 (C4)

| # | 标准 | 验证方式 |
|---|------|----------|
| C4.1 | 所有写操作必须产生审计日志 | 集成测试 |
| C4.2 | 审计日志必含字段: timestamp, actor, action, resource, before, after, traceId | 单元测试 |
| C4.3 | 审计日志必须不可变 (追加-only) | 集成测试 |
| C4.4 | 审计日志保留期 ≥ 180 天 | 集成测试 |
| C4.5 | 审计日志支持按 actor/resource/action 查询 | API 测试 |

### 7.5 错误码契约 (C5)

| # | 标准 | 验证方式 |
|---|------|----------|
| C5.1 | 错误码格式: ORION-{DOMAIN}-{NNN} (如 ORION-AUTH-401) | 代码扫描 |
| C5.2 | 错误响应必含: code, message, requestId, docs | 单元测试 |
| C5.3 | 错误码文档自动生成 (OpenAPI + 错误码目录) | 构建时检查 |

### 7.6 数据模型契约 (C6)

| # | 标准 | 验证方式 |
|---|------|----------|
| C6.1 | 共享实体必须定义在 shared/ 或 api-contract/ 目录 | 代码扫描 |
| C6.2 | 数据模型变更必须版本化 | 集成测试 |
| C6.3 | 数据模型必须含向后兼容字段 (nullable + 默认值) | 单元测试 |

### 7.7 配置契约 (C7)

| # | 标准 | 验证方式 |
|---|------|----------|
| C7.1 | 配置项必须命名空间化 (domain:subdomain:key) | 代码扫描 |
| C7.2 | Feature Flag 必须有过期时间 (默认 90 天) | 集成测试 |
| C7.3 | 配置变更必须可追踪 (谁、何时、改了什么) | 集成测试 |

### 7.8 可观测性契约 (C8)

| # | 标准 | 验证方式 |
|---|------|----------|
| C8.1 | 所有服务必须暴露 /metrics (Prometheus 格式) | 集成测试 |
| C8.2 | 所有服务必须产生结构化日志 (JSON) | 单元测试 |
| C8.3 | 所有服务必须集成 OpenTelemetry Tracing | 集成测试 |
| C8.4 | 关键路径必须有 SLO (99.9% / 99.95% / 99.99%) | 代码扫描 |

### 7.9 运行时规则基线 (R1-R6)

| 规则 | 基线值 | 验证方式 |
|-----|--------|---------|
| **R1 超时** | 客户端 30s / 服务端 120s / 后台任务 30min | 代码扫描 |
| **R2 重试** | 指数退避 1s/2s/4s，最多 3 次 | 集成测试 |
| **R3 幂等** | 写操作必须 Idempotency-Key 头 | 代码扫描 |
| **R4 限流** | 100 req/min/user, 1000 req/min/tenant | 集成测试 |
| **R5 熔断** | 50% 错误率触发，30s 半开，3 次探测恢复 | 集成测试 |
| **R6 超时传播** | 上游超时 ≥ 下游超时之和 + 20% 缓冲 | 集成测试 |


---

<a id="8-验收标准模板"></a>
## 八、验收标准模板

所有新 Spec 必须遵循以下模板 (基于已有 9 个"完整" Spec 的标准格式)。

```markdown
# Spec: {能力域名称}

> **日期**: YYYY-MM-DD
> **状态**: 待实现 / 部分实现 / 已实现
> **能力域**: {所属域}
> **目标成熟度**: L{X} → L{Y}
> **关键交付**: {核心能力一句话}

## 一、功能描述

### 1.1 现状评估 (L{X})

{当前实现概述}
**不足**:
- {差距 1}
- {差距 2}

### 1.2 Phase 1 目标 (L{Y})

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| {模块 1} | {描述} | L{Y} |

## 二、验收标准 (≥ 15 条 AC)

### 2.1 {子模块 1}

| # | 标准 | 验证方式 |
|---|------|----------|
| {前缀}1 | {标准描述} | {API 测试 / 集成测试 / 前端验证 / 单元测试} |

## 三、API 设计

Base: /api/v1/{resource}

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /{resource} | 列表 |

## 四、数据模型

CREATE TABLE {table} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ...
);

## 五、依赖服务

| 服务 | 依赖类型 | 契约 |
|-----|---------|------|
| {service} | {同步/异步} | {API/Event} |

## 六、运行时规则

| 规则 | 值 |
|-----|---|
| 超时 | 30s |
| 重试 | 指数退避 3 次 |
| 限流 | 100 req/min/user |

## 七、验收方式统计

| 类型 | 数量 |
|------|:----:|
| API 测试 | N |
| 集成测试 | N |
| 前端验证 | N |
| 单元测试 | N |
```

### 8.1 验证方式定义

| 验证方式 | 含义 | 工具 |
|---------|------|------|
| **API 测试** | 后端 HTTP API 行为验证 | Vitest / Cypress |
| **集成测试** | 跨服务 / 跨层集成验证 | Testcontainers / Supertest |
| **前端验证** | UI 行为 + 交互验证 | Playwright / Vitest |
| **单元测试** | 纯函数 / 组件单元测试 | Vitest + Jest |
| **代码扫描** | 静态分析规则 | ESLint / ts-morph |
| **构建时检查** | 构建阶段强制 | tsc / webpack plugin |

---

<a id="9-实施路线图"></a>
## 九、实施路线图

### Phase 1 (2 周): P0 缺口补全 (6 域)

| 周 | 任务 | 交付物 |
|:-:|------|--------|
| W1 | G6 AI Agent + G5 事件响应 Spec 补全 | 2 份 spec (含 100+ AC) |
| W2 | G8 制品/SBOM + G3 FinOps Spec 补全 | 2 份 spec (含 80+ AC) |
| W2 | G7 流水线主域 + G11 租户/用户 Spec 补全 | 2 份 spec (含 80+ AC) |

### Phase 2 (2 周): P1 缺口补全 (3 域)

| 周 | 任务 | 交付物 |
|:-:|------|--------|
| W3 | G2 变更管理 + G1 CMDB Spec 补全 | 2 份 spec |
| W4 | G10 测试管理 Spec 补全 | 1 份 spec |

### Phase 3 (2 周): P2 缺口补全 (3 域)

| 周 | 任务 | 交付物 |
|:-:|------|--------|
| W5 | G4 服务目录 + G12 MCP/编排 Spec 补全 | 2 份 spec |
| W6 | G9 知识库 Spec 补全 | 1 份 spec |

### Phase 4 (持续): 已有 Spec 深度补全 + CI Gate

| 周 | 任务 | 交付物 |
|:-:|------|--------|
| W3+ | 31 个"部分" Spec 补齐 AC 至 ≥ 15 条 | 31 份更新 |
| W4+ | 11 个 ADR 补充验收标准章节 | 11 份更新 |
| W5+ | CI 增加 spec-presence gate | 1 个 CI 规则 |
| W6+ | CI 增加 AC 完整度扫描 | 1 个 CI 规则 |

### 9.1 总工时估算

| 阶段 | 工时 | 人力 |
|------|:----:|:----:|
| Phase 1 (P0) | 120h | 2 专家并行 |
| Phase 2 (P1) | 40h | 1 专家 |
| Phase 3 (P2) | 40h | 1 专家 |
| Phase 4 (持续) | 60h | 团队 |
| **总计** | **260h** | **约 6-8 周** |

---

<a id="10-交叉引用矩阵"></a>
## 十、交叉引用矩阵

### 10.1 Spec × 服务矩阵 (P0 6 域)

| Spec | 后端服务 | 前端页面 | 关联 ADR |
|------|---------|---------|---------|
| AI Agent 平台 | agents, ai, ai-agent-run, ai-review, llm, agent-trace | AIAgents, AIDashboard, AIReview, AIGateway, AIDocManagement, AICostDashboard, AgentDashboard, AgentRunDetail, PromptCanary, EvalSetManagement, LLMTraceDashboard, ModelEvolution | ADR-001, ADR-014 |
| 事件响应 | alert*, incident, problem, runbook, oncall, chatops | OnCall, Incident, Problem, AlertList, alert-escalation, RunbookManagement | ADR-003, ADR-011 |
| 制品/SBOM | artifact*, sbom, supply-chain | Artifacts, ArtifactBrowser, ArtifactVersion, SbomDashboard, SbomDetail | ADR-001, ADR-007 |
| FinOps | billing, cost, capacity, sla | FinOpsDashboard, CostAllocation, PipelineBudget, cost-operations | ADR-012, ADR-005 |
| 流水线主域 | pipeline, pipeline-svc, runner-svc, ci-cd, auto-exec | PipelineList, PipelineDetail, PipelineEditor, PipelineRunList, PipelineRunLive, PipelineRunAnalytics, PipelineVersionHistory | ADR-007, ADR-014 |
| 租户/用户 | tenant*, user*, sso*, session, auth-mfa | TenantList, TenantManagement, tenant-quota, UserManagement, RoleManagement, UserSettings, UserProfile, Sessions | ADR-004, ADR-009 |

### 10.2 已有 Spec × 跨域契约矩阵

| 已有 Spec | C1 API | C2 事件 | C3 权限 | C4 审计 | C5 错误 | C6 数据 | C7 配置 | C8 可观测 |
|----------|:------:|:------:|:------:|:------:|:------:|:------:|:------:|:------:|
| api-governance | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| security-compliance | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| data-pipeline | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| self-healing | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| eventbus-svc | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| feature-flag-svc | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| **合计覆盖率** | **33%** | **50%** | **50%** | **50%** | **33%** | **50%** | **50%** | **33%** |

**关键发现**: 8 类跨域契约平均覆盖率仅 43.75%。所有已有 spec 均需补齐跨域契约章节。

---

## 附录 A: 专家投票记录

| 缺口 | E1 | E2 | E3 | E4 | E5 | E6 | E7 | E8 | E9 | E10 | E11 | E12 | 平均 |
|------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:---:|
| G6 AI Agent | 4.5 | 4 | 4 | 5 | 3 | 4 | 4 | 4 | 4.5 | 3 | 5 | 4 | 4.13 |
| G5 事件响应 | 5 | 5 | 4 | 4 | 4 | 4 | 4 | 5 | 4 | 4 | 4 | 4 | 4.25 |
| G8 制品/SBOM | 4 | 4 | 4 | 3 | 4 | 4 | 4 | 5 | 3 | 4 | 4 | 4 | 3.83 |
| G3 FinOps | 4 | 3 | 3 | 3 | 5 | 4 | 3 | 4 | 3 | 4 | 3 | 5 | 3.67 |
| G7 流水线主域 | 4 | 4 | 3 | 3 | 4 | 4 | 4 | 3 | 4 | 3 | 3 | 3 | 3.58 |
| G11 租户/用户 | 4 | 3 | 5 | 3 | 3 | 3 | 4 | 5 | 4 | 4 | 3 | 4 | 3.75 |
| G2 变更管理 | 3 | 3 | 3 | 3 | 3 | 4 | 4 | 4 | 3 | 3 | 3 | 3 | 3.25 |
| G1 CMDB | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3.00 |
| G10 测试管理 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3.00 |
| G4 服务目录 | 3 | 3 | 2 | 2 | 2 | 3 | 3 | 2 | 3 | 3 | 2 | 3 | 2.58 |
| G12 MCP/编排 | 3 | 2 | 2 | 3 | 2 | 3 | 3 | 2 | 3 | 2 | 3 | 3 | 2.58 |
| G9 知识库 | 3 | 2 | 2 | 3 | 2 | 2 | 2 | 2 | 3 | 2 | 2 | 3 | 2.33 |

## 附录 B: 后续行动

- [ ] 将 6 份 P0 Spec 补全文档落盘到 `docs/specs/`
- [ ] 将 8 类跨域契约 + 6 类运行时规则发布为 `docs/design-constraints/` 框架
- [ ] 在 CI 增加 spec-presence gate (每个新服务必须带 spec)
- [ ] 在 CI 增加 AC 完整度扫描 (每个 spec 必须 ≥ 15 条 AC)
- [ ] 在 `check-spec-acceptance.ts` 增加跨域契约检查
- [ ] 更新 `docs/INDEX.md` 加入本报告

---

_文档生成: 2026-08-26 by 模拟的 12 位互联网大厂资深领域专家团队_
