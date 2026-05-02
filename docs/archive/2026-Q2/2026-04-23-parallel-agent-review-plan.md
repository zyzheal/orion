# 并行 Agent 全量评审实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 使用 12 个并行 Agent 对 Orion 项目 44+ 模块、260 份设计文档进行全量评审，输出实现状态对比、缺失功能清单和代码质量评分。

**Architecture:** 12 个 Agent 按领域独立评审，各自读取对应文档和代码，输出标准化报告后合并汇总。Agent 之间无共享状态、无文件冲突，完全并行。

**Tech Stack:** Node.js/TypeScript (后端), Vue.js (前端), Fastify (API), SQL 迁移

---

## 文件映射

### Agent 将创建的文件

| 输出文件 | 创建者 | 说明 |
|---------|--------|------|
| `docs/review/agent-01-architecture.md` | Agent 1 | 核心架构评审 |
| `docs/review/agent-02-ai.md` | Agent 2 | AI/算法评审 |
| `docs/review/agent-03-sre.md` | Agent 3 | SRE/运维评审 |
| `docs/review/agent-04-security.md` | Agent 4 | 安全领域评审 |
| `docs/review/agent-05-frontend.md` | Agent 5 | 前端设计评审 |
| `docs/review/agent-06-database.md` | Agent 6 | 数据库评审 |
| `docs/review/agent-07-integration.md` | Agent 7 | 集成与事件评审 |
| `docs/review/agent-08-efficiency.md` | Agent 8 | 效能度量评审 |
| `docs/review/agent-09-artifact.md` | Agent 9 | 制品管理评审 |
| `docs/review/agent-10-cicd.md` | Agent 10 | CICD Pipeline 评审 |
| `docs/review/agent-11-iac.md` | Agent 11 | IaC 基础设施评审 |
| `docs/review/agent-12-api.md` | Agent 12 | API/需求评审 |
| `docs/review/full-review-2026-04-23.md` | 主 Agent | 综合汇总报告 |

### Agent 将读取的文件

详见各 Task 的文件列表。每个 Agent 读取其对应领域的 `docs/*.md` 和 `orion-platform-service/src/**/*` 文件。

---

## 每个 Agent 统一输出格式

所有 Agent 必须使用以下 Markdown 格式输出报告：

```markdown
# 评审报告: {领域名称}

> 评审日期: 2026-04-23
> 评审 Agent: Agent {编号}

## 1. 实现状态对比表

| 设计功能 | 实现程度(%) | 已实现代码 | 缺失部分 |
|----------|-------------|-----------|---------|
| 功能名称 | 80 | `services/xxx/index.ts` | 数据持久化 |
| 功能名称 | 0 | - | 全部缺失 |

## 2. 缺失功能清单

### P0 (紧急)
- **功能名**: 设计文档 → `docs/xxx.md` | 影响: 系统无法...

### P1 (重要)
- ...

### P2 (完善)
- ...

## 3. 代码质量评分

| 维度 | 评分(1-5) | 评分依据 |
|------|-----------|---------|
| 代码结构 | 4/5 | 模块化清晰，但... |
| 错误处理 | 3/5 | 部分函数缺少 try-catch |
| 测试覆盖 | 2/5 | 仅有单元测试，缺集成测试 |
| 文档一致性 | 3/5 | API 路径与设计不一致 |
| **综合评分** | **3/5** | |

## 4. 关键发现

1. ...
2. ...
```

---

## Task 1: Agent 1 - 核心架构评审

**Files:**
- 读取: `docs/architecture/*.md` (40 份), `docs/adr/*.md` (8 份)
- 读取: `orion-platform-service/src/engine/*.ts`, `orion-platform-service/src/saga/*.ts`, `orion-platform-service/src/api/routes.ts`
- 创建: `docs/review/agent-01-architecture.md`

- [ ] **Step 1: 调度 Agent 1 - 核心架构评审**

启动 Agent，任务指令：

```
你是 Orion 项目核心架构评审 Agent。请独立评审以下领域：

【文档范围】
- docs/architecture/ 目录下所有 .md 文件（架构设计）
- docs/adr/ 目录下所有 .md 文件（架构决策）

【代码范围】
- orion-platform-service/src/engine/ 目录（PipelineEngine, StageExecutor, TaskRunner）
- orion-platform-service/src/saga/ 目录（Saga 编排）
- orion-platform-service/src/api/routes.ts（路由注册入口）
- orion-platform-service/src/events/ 目录（事件发布）

【任务要求】
1. 阅读所有架构文档和 ADR 决策
2. 逐一对比设计与代码实现，统计每个架构功能的实现程度(%)
3. 列出所有缺失功能，按 P0/P1/P2 分级
4. 从以下 4 个维度评分代码质量：代码结构、错误处理、测试覆盖、文档一致性
5. 记录关键发现（积极和消极）

【输出要求】
严格按以下格式写入 docs/review/agent-01-architecture.md：
- 实现状态对比表（设计功能 vs 实现代码 vs 缺失部分）
- 缺失功能清单（P0/P1/P2）
- 代码质量评分表（含评分依据）
- 关键发现（至少 3 条）

【约束】
- 每个评分必须有具体代码行或文件作为依据
- 不要修改任何代码文件
- 仅创建评审报告文件
```

- [ ] **Step 2: 验证 Agent 1 输出**

确认 `docs/review/agent-01-architecture.md` 包含：
- 至少 10 行实现状态对比表
- 至少 3 条 P0 缺失清单（如微前端未实现）
- 4 个维度评分均有依据
- 无空表格行或占位符

---

## Task 2: Agent 2 - AI/算法评审

**Files:**
- 读取: `docs/ai/*.md` (20 份)
- 读取: `orion-platform-service/src/api/ai-*.ts`, `orion-platform-service/src/services/ai/`, `orion-platform-service/src/services/ai-review/`, `orion-platform-service/src/services/ai-security/`
- 创建: `docs/review/agent-02-ai.md`

- [ ] **Step 1: 调度 Agent 2 - AI/算法评审**

启动 Agent，任务指令：

```
你是 Orion 项目 AI/算法评审 Agent。请独立评审以下领域：

【文档范围】
- docs/ai/ 目录下所有 .md 文件（20 份 AI 设计文档）

【代码范围】
- orion-platform-service/src/api/ai-cost-routes.ts
- orion-platform-service/src/api/ai-gateway-routes.ts
- orion-platform-service/src/api/ai-review-routes.ts
- orion-platform-service/src/api/ai-security-routes.ts
- orion-platform-service/src/services/ai/ 目录
- orion-platform-service/src/services/ai-review/ 目录
- orion-platform-service/src/services/knowledge/ 目录

【任务要求】
1. 阅读所有 AI 设计文档
2. 重点关注：LLM 推理层、规则引擎、Skill 管理、算法引擎、向量存储、模型测试
3. 对比设计与实现，统计实现程度
4. 列出缺失功能（特别关注：向量数据库、Token 计费 SDK、XGBoost 风险模型）
5. 代码质量评分（4 维度）

【输出要求】
写入 docs/review/agent-02-ai.md，格式与标准模板一致

【约束】
- 不修改任何代码
- 每个评分需引用具体文件或行号
```

- [ ] **Step 2: 验证 Agent 2 输出**

确认报告包含：
- LLM 推理层、规则引擎、Skill 管理、算法引擎、向量存储、模型测试各层状态
- 向量存储 = 0% 确认（设计有 Milvus/Qdrant，代码无）
- Token 计费实现状态
- 4 维度评分

---

## Task 3: Agent 3 - SRE/运维评审

**Files:**
- 读取: `docs/sre/*.md` (11 份)
- 读取: `orion-platform-service/src/services/monitoring/`, `orion-platform-service/src/services/alert/`, `orion-platform-service/src/services/diagnostic/`, `orion-platform-service/src/services/scheduler/`, `orion-platform-service/src/services/self-healing/`, `orion-platform-service/src/services/notification/`
- 创建: `docs/review/agent-03-sre.md`

- [ ] **Step 1: 调度 Agent 3 - SRE/运维评审**

```
你是 Orion 项目 SRE/运维评审 Agent。请独立评审以下领域：

【文档范围】
- docs/sre/ 目录下所有 .md 文件（11 份 SRE 设计文档）

【代码范围】
- orion-platform-service/src/services/monitoring/ （MonitoringService）
- orion-platform-service/src/services/alert/ （告警服务）
- orion-platform-service/src/services/diagnostic/ （诊断引擎）
- orion-platform-service/src/services/scheduler/ （定时调度）
- orion-platform-service/src/services/self-healing/ （自愈引擎）
- orion-platform-service/src/services/notification/ （通知服务）
- orion-platform-service/src/api/monitoring-routes.ts
- orion-platform-service/src/api/alert-routes.ts
- orion-platform-service/src/api/diagnostic-routes.ts
- orion-platform-service/src/api/self-healing-routes.ts

【任务要求】
1. 阅读所有 SRE 设计文档
2. 重点关注：告警去重、告警关联、诊断引擎、定时调度、OnCall 排班、SLO 管理、自愈引擎
3. 对比设计与实现，统计各功能实现程度
4. 特别关注 OnCall 排班系统（之前报告显示完全缺失）
5. 代码质量评分（4 维度）

【输出要求】
写入 docs/review/agent-03-sre.md，格式与标准模板一致
```

- [ ] **Step 2: 验证 Agent 3 输出**

确认报告包含：
- OnCall 排班系统状态（预期 0%）
- 告警去重实现确认（SHA256 指纹）
- 自愈引擎实现状态
- 4 维度评分

---

## Task 4: Agent 4 - 安全领域评审

**Files:**
- 读取: `docs/security/*.md` (9 份)
- 读取: `orion-platform-service/src/services/risk-assessment/`, `orion-platform-service/src/api/risk-routes.ts`, `orion-platform-service/src/api/ai-security-routes.ts`, `orion-platform-service/src/api/policy-routes.ts`, `orion-platform-service/src/api/sbom-routes.ts`
- 创建: `docs/review/agent-04-security.md`

- [ ] **Step 1: 调度 Agent 4 - 安全领域评审**

```
你是 Orion 项目安全领域评审 Agent。请独立评审以下领域：

【文档范围】
- docs/security/ 目录下所有 .md 文件（9 份安全设计文档）

【代码范围】
- orion-platform-service/src/services/risk-assessment/
- orion-platform-service/src/api/risk-routes.ts
- orion-platform-service/src/api/ai-security-routes.ts
- orion-platform-service/src/api/policy-routes.ts
- orion-platform-service/src/api/sbom-routes.ts
- orion-platform-service/src/services/policy/
- orion-platform-service/src/services/sbom/

【任务要求】
1. 阅读所有安全设计文档
2. 重点关注：Prompt 注入防护、Risk Assessment、SBOM、OPA Policy、AI 安全
3. 对比设计与实现，统计实现程度
4. 列出安全相关的 P0 缺失（如 Prompt 注入防护未实现）
5. 代码质量评分（4 维度）

【输出要求】
写入 docs/review/agent-04-security.md，格式与标准模板一致
```

- [ ] **Step 2: 验证 Agent 4 输出**

确认报告包含：
- 各安全功能实现程度
- P0 安全缺失清单
- 4 维度评分

---

## Task 5: Agent 5 - 前端设计评审

**Files:**
- 读取: `docs/frontend/*.md` (24 份), `docs/ui/*.md` (3 份)
- 读取: `orion-frontend/src/pages/` (50+ 页面), `orion-frontend/src/api/` (34 个客户端)
- 创建: `docs/review/agent-05-frontend.md`

- [ ] **Step 1: 调度 Agent 5 - 前端设计评审**

```
你是 Orion 项目前端设计评审 Agent。请独立评审以下领域：

【文档范围】
- docs/frontend/ 目录下所有 .md 文件（24 份前端设计文档）
- docs/ui/ 目录下所有 .md 文件（3 份 UI 设计文档）

【代码范围】
- orion-frontend/src/pages/ 目录下所有页面（50+ 页面）
- orion-frontend/src/api/ 目录下所有 API 客户端（34 个）

【任务要求】
1. 阅读所有前端/UI 设计文档
2. 重点关注：微前端架构（设计为 1 基座+7 子应用）、页面实现状态、Design Tokens、API 路径一致性
3. 对比设计与实现，统计各页面实现程度
4. 列出 P0 缺失（如微前端完全未实现）
5. 代码质量评分（4 维度）
6. 检查 API 路径与后端 routes.ts 的一致性

【输出要求】
写入 docs/review/agent-05-frontend.md，格式与标准模板一致

【注意】
- 前端文档数量较多（27 份），请优先阅读设计概述类文档，再抽查各页面详细设计
- 如果文档过多无法全部细读，请总结核心设计要点并说明抽查范围
```

- [ ] **Step 2: 验证 Agent 5 输出**

确认报告包含：
- 微前端实现状态（预期单体前端）
- 各主要页面实现程度
- API 路径一致性检查结果
- 4 维度评分

---

## Task 6: Agent 6 - 数据库评审

**Files:**
- 读取: `docs/db/*.md` (7 份)
- 读取: `orion-platform-service/src/db/migrations/`, `orion-platform-service/src/services/database.ts`
- 创建: `docs/review/agent-06-database.md`

- [ ] **Step 1: 调度 Agent 6 - 数据库评审**

```
你是 Orion 项目数据库评审 Agent。请独立评审以下领域：

【文档范围】
- docs/db/ 目录下所有 .md 文件（7 份数据库设计文档）

【代码范围】
- orion-platform-service/src/db/migrations/ 目录下所有 .sql 文件
- orion-platform-service/src/services/database.ts
- 各 Service 中的数据访问模式（检查是否使用 Map() 模拟存储）

【任务要求】
1. 阅读所有数据库设计文档
2. 检查 SQL 迁移文件完整性（001-034+ 迁移）
3. 对比表设计与实际迁移文件，确认一致性
4. 检查服务层数据访问：哪些使用 Map() 模拟、哪些有真实 DB 操作
5. 列出 P0 缺失（如数据持久化缺失、RLS 策略未实现）
6. 代码质量评分（4 维度）

【输出要求】
写入 docs/review/agent-06-database.md，格式与标准模板一致
```

- [ ] **Step 2: 验证 Agent 6 输出**

确认报告包含：
- 迁移文件覆盖的表清单
- 设计与实际表的对比
- Map() 模拟存储统计
- 4 维度评分

---

## Task 7: Agent 7 - 集成与事件评审

**Files:**
- 读取: `docs/integration/*.md` (5 份), `docs/event-bus/*.md` (4 份), `docs/cmdb/*.md` (3 份)
- 读取: `orion-platform-service/src/events/`, `orion-platform-service/src/services/event-bus-service.ts`, `orion-platform-service/src/services/cmdb*`, `orion-platform-service/src/services/nats-registry.ts`, `orion-platform-service/src/api/cmdb-routes.ts`
- 创建: `docs/review/agent-07-integration.md`

- [ ] **Step 1: 调度 Agent 7 - 集成与事件评审**

```
你是 Orion 项目集成与事件评审 Agent。请独立评审以下领域：

【文档范围】
- docs/integration/ 目录下所有 .md 文件（5 份集成文档）
- docs/event-bus/ 目录下所有 .md 文件（4 份事件总线文档）
- docs/cmdb/ 目录下所有 .md 文件（3 份 CMDB 文档）

【代码范围】
- orion-platform-service/src/events/ 目录（事件发布/订阅）
- orion-platform-service/src/services/event-bus-service.ts
- orion-platform-service/src/services/cmdb-integration-service.ts
- orion-platform-service/src/services/cmdb/ 目录
- orion-platform-service/src/services/nats-registry.ts
- orion-platform-service/src/clients/ 目录（GitHubClient, GitLabClient）

【任务要求】
1. 阅读所有集成/事件/CMDB 设计文档
2. 重点关注：事件发布订阅机制、NATS 集成、CMDB 同步、外部系统集成（GitHub/GitLab）
3. 对比设计与实现，统计实现程度
4. 列出 P0/P1/P2 缺失
5. 代码质量评分（4 维度）

【输出要求】
写入 docs/review/agent-07-integration.md，格式与标准模板一致
```

- [ ] **Step 2: 验证 Agent 7 输出**

确认报告包含：
- 事件总线实现状态
- NATS 集成状态
- CMDB 同步实现状态
- 4 维度评分

---

## Task 8: Agent 8 - 效能度量评审

**Files:**
- 读取: `docs/efficiency/*.md` (4 份)
- 读取: `orion-platform-service/src/services/efficiency/`
- 创建: `docs/review/agent-08-efficiency.md`

- [ ] **Step 1: 调度 Agent 8 - 效能度量评审**

```
你是 Orion 项目效能度量评审 Agent。请独立评审以下领域：

【文档范围】
- docs/efficiency/ 目录下所有 .md 文件（4 份效能设计文档）

【代码范围】
- orion-platform-service/src/services/efficiency/ 目录
- orion-platform-service/src/api/efficiency-routes.ts
- orion-platform-service/src/services/finops/ 目录（FinOps 成本相关）
- orion-platform-service/src/api/finops-v2-routes.ts
- orion-platform-service/src/api/cost-routes.ts

【任务要求】
1. 阅读所有效能度量设计文档
2. 重点关注：DORA 四大指标（部署频率、变更前置时间、变更失败率、MTTR）、FinOps 成本管理、成本报表
3. 对比设计与实现，统计实现程度
4. 检查 DoraMetricsService 测试覆盖（DoraMetricsService.test.ts）
5. 列出 P0/P1/P2 缺失（如自动周报模块缺失）
6. 代码质量评分（4 维度）

【输出要求】
写入 docs/review/agent-08-efficiency.md，格式与标准模板一致
```

- [ ] **Step 2: 验证 Agent 8 输出**

确认报告包含：
- DORA 四大指标各实现程度
- FinOps 成本管理状态
- 自动周报模块缺失确认
- 测试覆盖情况
- 4 维度评分

---

## Task 9: Agent 9 - 制品管理评审

**Files:**
- 读取: `docs/artifact/*.md` (3 份), `docs/cache/*.md` (35 份)
- 读取: `orion-platform-service/src/services/artifact/`, `orion-platform-service/src/services/cache/`, `orion-platform-service/src/services/sbom/`, `orion-platform-service/src/api/artifact-routes.ts`, `orion-platform-service/src/api/sbom-routes.ts`
- 创建: `docs/review/agent-09-artifact.md`

- [ ] **Step 1: 调度 Agent 9 - 制品管理评审**

```
你是 Orion 项目制品管理评审 Agent。请独立评审以下领域：

【文档范围】
- docs/artifact/ 目录下所有 .md 文件（3 份制品管理文档）
- docs/cache/ 目录下所有 .md 文件（35 份缓存/构建文档）

【代码范围】
- orion-platform-service/src/services/artifact/ 目录（ArtifactService, ArtifactRepository）
- orion-platform-service/src/services/cache/ 目录
- orion-platform-service/src/services/sbom/ 目录
- orion-platform-service/src/api/artifact-routes.ts
- orion-platform-service/src/api/sbom-routes.ts

【任务要求】
1. 阅读所有制品/缓存设计文档
2. 重点关注：制品 CRUD、标签管理、制品搜索、制品提升（状态机）、过期清理、SBOM
3. 对比设计与实现，统计实现程度
4. 检查数据存储方式（Map 模拟 vs 真实持久化）
5. 列出 P0/P1/P2 缺失（如 5 阶段状态机、多级审批流程）
6. 代码质量评分（4 维度）

【注意】
- docs/cache/ 有 35 份文件，请优先阅读架构概述类文档，其余可作为详细设计抽查
```

- [ ] **Step 2: 验证 Agent 9 输出**

确认报告包含：
- 制品各功能实现程度
- 数据存储方式检查
- 制品晋升状态机缺失确认
- 4 维度评分

---

## Task 10: Agent 10 - CICD Pipeline 评审

**Files:**
- 读取: `docs/cicd/*.md` (2 份), `docs/qa/*.md` (5 份)
- 读取: `orion-platform-service/src/engine/` (PipelineEngine, StageExecutor, TaskRunner), `orion-platform-service/src/services/pipeline/`, `orion-platform-service/src/api/build-routes.ts`, `orion-platform-service/src/api/deploy-routes.ts`, `orion-platform-service/src/api/canary-analysis-routes.ts`
- 创建: `docs/review/agent-10-cicd.md`

- [ ] **Step 1: 调度 Agent 10 - CICD Pipeline 评审**

```
你是 Orion 项目 CICD Pipeline 评审 Agent。请独立评审以下领域：

【文档范围】
- docs/cicd/ 目录下所有 .md 文件（2 份 CI/CD 文档）
- docs/qa/ 目录下所有 .md 文件（5 份 QA 文档）

【代码范围】
- orion-platform-service/src/engine/PipelineEngine.ts
- orion-platform-service/src/engine/StageExecutor.ts
- orion-platform-service/src/engine/TaskRunner.ts
- orion-platform-service/src/services/pipeline/ 目录
- orion-platform-service/src/services/build/ 目录
- orion-platform-service/src/services/deploy/ 目录
- orion-platform-service/src/services/canary-analysis/ 目录
- orion-platform-service/src/api/build-routes.ts
- orion-platform-service/src/api/deploy-routes.ts
- orion-platform-service/src/api/canary-analysis-routes.ts
- orion-platform-service/src/api/policy-routes.ts

【任务要求】
1. 阅读所有 CI/CD 和 QA 设计文档
2. 重点关注：Pipeline 引擎、Stage 执行、Task 运行、构建管理、智能部署、Canary 分析
3. 对比设计与实现，统计实现程度
4. 列出 P0/P1/P2 缺失
5. 代码质量评分（4 维度）

【输出要求】
写入 docs/review/agent-10-cicd.md，格式与标准模板一致
```

- [ ] **Step 2: 验证 Agent 10 输出**

确认报告包含：
- Pipeline 引擎实现状态
- 构建/部署实现状态
- Canary 分析实现状态
- 4 维度评分

---

## Task 11: Agent 11 - IaC 基础设施评审

**Files:**
- 读取: `docs/iac/*.md` (2 份), `docs/tasks/*.md` (6 份)
- 读取: `orion-platform-service/src/services/iac/`, `orion-platform-service/src/services/k8s-provisioner-service.ts`, `orion-platform-service/src/services/ephemeral-env-service.ts`, `orion-platform-service/src/api/iac-routes.ts`
- 创建: `docs/review/agent-11-iac.md`

- [ ] **Step 1: 调度 Agent 11 - IaC 基础设施评审**

```
你是 Orion 项目 IaC 基础设施评审 Agent。请独立评审以下领域：

【文档范围】
- docs/iac/ 目录下所有 .md 文件（2 份 IaC 文档）
- docs/tasks/ 目录下所有 .md 文件（6 份任务文档）

【代码范围】
- orion-platform-service/src/services/iac/ 目录
- orion-platform-service/src/services/k8s-provisioner-service.ts
- orion-platform-service/src/services/ephemeral-env-service.ts
- orion-platform-service/src/services/environment/ 目录
- orion-platform-service/src/api/iac-routes.ts
- orion-platform-service/src/models/IacWorkspace.ts
- orion-platform-service/src/models/EphemeralEnvironment.ts

【任务要求】
1. 阅读所有 IaC 和任务设计文档
2. 重点关注：IaC 工作空间管理、K8s 资源调配、临时环境管理
3. 对比设计与实现，统计实现程度
4. 列出 P0/P1/P2 缺失
5. 代码质量评分（4 维度）

【输出要求】
写入 docs/review/agent-11-iac.md，格式与标准模板一致
```

- [ ] **Step 2: 验证 Agent 11 输出**

确认报告包含：
- IaC 工作空间实现状态
- K8s 资源调配实现状态
- 临时环境管理实现状态
- 4 维度评分

---

## Task 12: Agent 12 - API/需求评审

**Files:**
- 读取: `docs/api/*.md` (3 份), `docs/requirements/*.md` (5 份), `docs/collaboration/*.md` (5 份)
- 读取: `orion-platform-service/src/api/*-routes.ts` (34 个路由文件), `orion-platform-service/src/api/controllers/`
- 创建: `docs/review/agent-12-api.md`

- [ ] **Step 1: 调度 Agent 12 - API/需求评审**

```
你是 Orion 项目 API/需求评审 Agent。请独立评审以下领域：

【文档范围】
- docs/api/ 目录下所有 .md 文件（3 份 API 文档）
- docs/requirements/ 目录下所有 .md 文件（5 份需求文档）
- docs/collaboration/ 目录下所有 .md 文件（5 份协作文档）

【代码范围】
- orion-platform-service/src/api/ 目录下所有 *-routes.ts 文件（34 个路由文件）
- orion-platform-service/src/api/controllers/ 目录下所有控制器
- orion-platform-service/src/api/routes.ts（路由注册入口）

【任务要求】
1. 阅读所有 API/需求/协作设计文档
2. 重点关注：API 路由与设计文档一致性、控制器实现完整度、前后端 API 路径对齐
3. 检查 routes.ts 中注册的路由是否都有对应的设计文档
4. 列出 P0/P1/P2 缺失（如路由与设计不一致、控制器方法缺失实现）
5. 代码质量评分（4 维度）

【输出要求】
写入 docs/review/agent-12-api.md，格式与标准模板一致
```

- [ ] **Step 2: 验证 Agent 12 输出**

确认报告包含：
- API 路由一致性检查结果
- 控制器实现完整度
- 前后端路径对齐情况
- 4 维度评分

---

## Task 13: 综合汇总

**Files:**
- 读取: `docs/review/agent-01-*.md` 到 `docs/review/agent-12-*.md`
- 创建: `docs/review/full-review-2026-04-23.md`

- [ ] **Step 1: 收集所有 Agent 报告**

等待所有 12 个 Agent 完成并确认报告文件存在。

- [ ] **Step 2: 生成综合汇总报告**

读取所有 12 份 Agent 报告，生成 `docs/review/full-review-2026-04-23.md`：

```markdown
# Orion 项目全量评审汇总报告

> 评审日期: 2026-04-23
> 评审方式: 12 个并行 Agent 独立评审
> 覆盖范围: 44+ 模块, 260 份设计文档

## 一、各领域实现状态汇总

| 领域 | 实现程度 | 综合评分 | P0 缺失数 | 详细报告 |
|------|----------|----------|-----------|---------|
| 核心架构 | X% | X/5 | N | agent-01-architecture.md |
| AI/算法 | X% | X/5 | N | agent-02-ai.md |
| SRE/运维 | X% | X/5 | N | agent-03-sre.md |
| 安全领域 | X% | X/5 | N | agent-04-security.md |
| 前端设计 | X% | X/5 | N | agent-05-frontend.md |
| 数据库 | X% | X/5 | N | agent-06-database.md |
| 集成事件 | X% | X/5 | N | agent-07-integration.md |
| 效能度量 | X% | X/5 | N | agent-08-efficiency.md |
| 制品管理 | X% | X/5 | N | agent-09-artifact.md |
| CICD Pipeline | X% | X/5 | N | agent-10-cicd.md |
| IaC 基础设施 | X% | X/5 | N | agent-11-iac.md |
| API/需求 | X% | X/5 | N | agent-12-api.md |

## 二、全系统 P0 缺失清单

（合并所有 Agent 的 P0 项，去重后按优先级排序）

## 三、全系统代码质量评分对比

（12 领域评分可视化对比）

## 四、跨领域问题

（识别多个领域共性的问题，如 Map 模拟存储、文档不一致等）

## 五、分阶段修复建议

Phase 1 (P0): ...
Phase 2 (P1): ...
Phase 3 (P2): ...
```

- [ ] **Step 3: 提交所有评审报告**

```bash
git add docs/review/agent-*.md docs/review/full-review-2026-04-23.md
git commit -m "docs: 12-agent parallel full review of 44+ modules, 260 docs"
```

---

## 自审检查

### 1. 规范覆盖检查

| 规范要求 | 状态 |
|---------|------|
| 每个 Agent 有明确文档范围（精确文件路径） | ✅ |
| 每个 Agent 有明确代码范围（精确目录/文件） | ✅ |
| 每个 Agent 有统一输出模板（4 个部分） | ✅ |
| 每个 Agent 有验证步骤 | ✅ |
| 无 TBD/TODO 占位符 | ✅ |
| Agent 间无共享状态冲突 | ✅ |
| 综合汇总 Task 定义清晰 | ✅ |

### 2. 类型一致性

所有 Agent 使用相同的评分维度和输出格式，无命名冲突。

### 3. 范围检查

12 个领域覆盖 INDEX.md 中列出的全部文档目录，无遗漏。
