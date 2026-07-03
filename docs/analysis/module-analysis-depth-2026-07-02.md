# 模块分析深度评估报告

**生成日期**: 2026-07-02
**分析范围**: docs/analysis/ + orion-platform-service/src/services/

---

## 一、现有分析文档清单

| 文档 | 日期 | 类型 | 覆盖模块 |
|------|------|------|---------|
| 18-module-analysis-coverage-assessment.md | 2026-07-02 | 覆盖率评估 | 18 个核心模块 |
| ai-domain-analysis.md | 2026-07-02 (更新 2026-07-03) | AI 域深度分析 | AI 域 15 个目录（含 model-version/vector-store/vectorize-rules/knowledge/skill） |
| operations-domain-analysis-2026-07-03.md | 2026-07-03 | 运营协作域深度分析 | 运营域 12 子模块（FinOps/ChangeIntelligence/Change/ChangeRequest/ReleaseTrain/TestGeneration/TestSelector/Audit/Compliance/SLA/QualityGate/Cost） |
| artifact-module-deep-analysis.md | 2026-07-02 | 制品模块 | artifact/ |
| auth-module-deep-analysis.md | 2026-07-02 | 认证模块 | auth/, authz/, user/, tenant/, role/ |
| chatops-module-deep-analysis.md | 2026-07-02 | ChatOps | chatops/ |
| cmdb-module-deep-analysis.md | 2026-07-02 | CMDB | cmdb/ |
| code-module-deep-analysis.md | 2026-07-02 | 代码管理 | code-repo/ |
| config-module-deep-analysis.md | 2026-07-02 | 配置管理 | config/, config-mgmt/ |
| data-platform-module-deep-analysis.md | 2026-07-02 | 数据平台 | data-pipeline/, vector-store/ |
| deploy-module-deep-analysis.md | 2026-07-02 | 部署 | deploy/ |
| infrastructure-module-deep-analysis.md | 2026-07-02 | 基础设施 | federation/, multi-cloud/ |
| itsm-ticketing-deep-analysis.md | 2026-07-02 | ITSM/工单 | ticketing/ |
| lowcode-module-deep-analysis.md | 2026-07-02 | 低代码 | lowcode/ |
| monitoring-module-deep-analysis.md | 2026-07-02 | 监控 | monitoring/ |
| notification-module-deep-analysis.md | 2026-07-02 | 通知 | notification/ |
| organization-module-deep-analysis.md | 2026-07-02 | 组织/IAM | user/, team/, tenant/, role/ |
| pipeline-module-deep-analysis.md | 2026-07-02 | Pipeline | pipeline/ |
| security-module-deep-analysis.md | 2026-07-02 | 安全/合规 | security/, sbom/, compliance/ |
| self-healing-module-deep-analysis.md | 2026-07-02 | 自愈 | self-healing/ |

**总计**: 18 个模块深度分析 + 1 个 AI 域分析 + 1 个运营协作域分析 = **20 份分析文档**

---

## 二、后端服务 vs 分析覆盖度

### 2.1 已分析 vs 未分析对照

| 状态 | 数量 | 说明 |
|------|------|------|
| 已深度分析 | 20 | 18 个核心模块 + 1 个 AI 域 + 1 个运营协作域 |
| 有服务文档无深度分析 | 26 | docs/services/*/ 下有设计文档 |
| 完全无分析 | 92 | 137 - 19 - 26 |

### 2.2 分析深度评级

| 评级 | 模块 | 特征 |
|------|------|------|
| **5 (最深入)** | 制品/构建、通知、自愈、ChatOps、审批 | 7/7 维度齐全 + 具体代码路径 + 文件行号 |
| **4 (较深入)** | 认证、Code、Config、数据平台、组织/IAM、Pipeline | 6/7 维度，缺前端集成或数据模型 |
| **3 (中等)** | 基础设施、CMDB、Deploy、监控、ITSM、低代码 | 4-5 维度，缺 API 清单或前端集成 |
| **2 (较浅)** | 安全 | 3/7 维度，无 API 清单、无数据模型、无前端集成 |

**平均深度评分: 3.8/5**

---

## 三、缺失的深度分析模块

### 3.1 P0 优先级缺失（影响系统稳定性）

| 模块 | 目录 | 缺失影响 |
|------|------|---------|
| 韧性工程 | chaos-engineering, circuit-breaker, degradation, disaster-recovery | 平台高可用核心能力无分析 |
| FinOps | finops, cost, billing | 成本管理完整性无法评估 |
| API 管理 | api-governance, api-key, api-market, webhook | 跨模块基础设施无分析 |

### 3.2 P1 优先级缺失（影响功能完整性）

| 模块 | 目录 | 缺失影响 |
|------|------|---------|
| 可观测性全域 | observability, metrics, tracing, canary | 仅分散在 monitoring 中 |
| ITIL 完整域 | incident, problem, escalation, sla | 事件/问题/升级/SLA 流程不完整 |
| 工程效能 | efficiency, workbench, developer-portal | 效能度量无分析 |
| 测试与质量 | quality-gate, test-generation, test-selector, inspection | 质量门禁/测试管理无分析 |

### 3.3 P2 优先级缺失（影响运营效率）

| 模块 | 目录 | 缺失影响 |
|------|------|---------|
| 基础设施底层 | iac, database, dba, serverless, middleware-ops | 基础设施底层能力无系统分析 |
| 政策与治理 | policy, privacy, guardian, audit | 治理合规无完整分析 |
| 资产库 | internal-library, script-library, runbook, service-catalog | 资产管理无分析 |

---

## 四、25 个顶层服务文件未覆盖

以下服务文件未纳入任何模块深度分析：

```
agent-profile-service.ts, agent-run-service.ts, ai-security.ts, cmdb-integration-service.ts,
CrossDomainWorkflowRepository.ts, database.ts, ephemeral-env-service.ts, event-bus-service.ts,
health.ts, jetstream-manager.ts, k8s-provisioner-service.ts, MaintenanceWindowService.ts,
nats-registry.ts, PipelineBudgetService.ts, plugin-executor-service.ts, plugin-manager-service.ts,
redis-cache.ts, ResourceAbstractionService.ts, task-type-plugin-mapper.ts
```

---

## 五、前端页面分析覆盖

| 维度 | 已覆盖 | 缺失 | 覆盖率 |
|------|--------|------|--------|
| 核心模块前端集成分析 | 7/18 | 11/18 | 39% |
| 空状态处理分析 | 30/202 页面 | 172/202 页面 | 15% |
| 交互链完整性分析 | Pipeline/Deploy/Approval | 其余 195+ 页面 | 3% |

---

## 六、总结

| 指标 | 值 |
|------|-----|
| 已分析服务目录 | 60/100 (60%) |
| 完全缺失分析的目录 | 40/100 (40%) |
| 顶层服务文件覆盖 | 0/25 (0%) |
| 前端页面分析覆盖 | 3%/202 (1.5%) |
| 平均分析深度 | 3.8/5 |

**核心问题**：现有分析采用的是"业务域"视角（18 个模块），而非"服务目录"视角。大量细分服务未得到独立的深度分析，尤其是韧性工程、FinOps、API 管理、质量域等关键能力。
