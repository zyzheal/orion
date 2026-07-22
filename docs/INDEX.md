# Orion 文档索引 v1.0

> **版本**: v1.0 | **生成日期**: 2026-07-20 | **总文档数**: 445+

---

## 1. 文档体系概览

```
docs/
├── INDEX.md                        ← 本文：项目主索引
├── README.md                       — 文档总览
├── 文档管理规范.md                   — 文档编写规范
├── adr/                            — 架构决策记录 (ADR)
├── analysis/                       — 模块深度分析 (88 篇)
├── architecture/                   — 架构设计 (75 篇)
├── archive/                        — 归档文档 (9 篇)
├── code-review/                    — 代码评审报告
├── design-constraints/             — 设计约束框架
├── migration/                      — 迁移方案
├── operations/                     — 运维文档
├── reports/                        — 综合评审报告 (4 篇)
├── requirements/                   — 需求文档
├── review/                         — 评审与执行计划
├── services/                       — 服务级设计 (140 篇)
├── specs/                          — 服务规格定义 (68 篇)
├── superpowers/                    — 专项计划 (10 篇)
└── 规范汇总/                       — 统一规范汇总
```

---

## 2. 架构决策记录 (ADR)

| 编号 | 文档 | 主题 |
|:----:|------|------|
| 001 | [adr/0001-service-architecture.md](adr/0001-service-architecture.md) | 微服务架构决策 |
| 002 | [adr/0002-repository-pattern.md](adr/0002-repository-pattern.md) | Repository 模式采用 |
| 003 | [adr/0003-event-driven-architecture.md](adr/0003-event-driven-architecture.md) | 事件驱动架构 |
| 004 | [adr/0004-multi-tenancy.md](adr/0004-multi-tenancy.md) | 多租户隔离设计 |
| 005 | [adr/0005-cqrs.md](adr/0005-cqrs.md) | CQRS 模式采用 |
| 006 | [adr/0006-saga-compensation.md](adr/0006-saga-compensation.md) | Saga 分布式事务补偿 (待补充) |
| 007 | [adr/0007-pipeline-engine-architecture.md](adr/0007-pipeline-engine-architecture.md) | Pipeline Engine 架构 (待补充) |
| 008 | [adr/0008-feature-flag-system.md](adr/0008-feature-flag-system.md) | Feature Flag 功能开关系统 (待补充) |
| 009 | [adr/0009-gin-middleware-stack.md](adr/0009-gin-middleware-stack.md) | Gin 中间件栈设计 (待补充) |
| 010 | [adr/0010-api-gateway-architecture.md](adr/0010-api-gateway-architecture.md) | API 网关架构决策 (待补充) |
| 011 | [adr/0011-otel-observability.md](adr/0011-otel-observability.md) | OpenTelemetry 可观测性集成 (待补充) |
| 012 | [adr/0012-prometheus-monitoring.md](adr/0012-prometheus-monitoring.md) | Prometheus 监控集成 (待补充) |
| 013 | [adr/0013-microfrontend-migration.md](adr/0013-microfrontend-migration.md) | 微前端 Orion-MF 迁移 (待补充) |
| 014 | [adr/014-backend-technology-stack-migration.md](adr/014-backend-technology-stack-migration.md) | 技术栈迁移 (Node.js → Go/Rust/Python) |
| 015 | [adr/015-phase5-go-migration-architecture.md](adr/015-phase5-go-migration-architecture.md) | Phase 5 Go 迁移架构决策 |

**历史 ADR (旧编号体系, ADR-00X-*)**:

| 文档 | 主题 | 对应新版编号 |
|------|------|:----------:|
| [adr/ADR-002-Plugin-SPI 接口设计.md](adr/ADR-002-Plugin-SPI%20接口设计.md) | Plugin SPI 接口设计 | — |
| [adr/ADR-003-成本数据采集架构.md](adr/ADR-003-成本数据采集架构.md) | 成本数据采集与 FinOps 架构 | — |
| [adr/ADR-004-备份恢复策略设计.md](adr/ADR-004-备份恢复策略设计.md) | 备份恢复与灾难重建 | — |
| [adr/ADR-005-数据库选型决策.md](adr/ADR-005-数据库选型决策.md) | 数据库选型统一决策 | — |
| [adr/ADR-006-ClickHouse 集成设计.md](adr/ADR-006-ClickHouse%20集成设计.md) | ClickHouse 集成设计 | — |
| [adr/ADR-008-ProductLine-CRD 多分支产品线设计.md](adr/ADR-008-ProductLine-CRD%20多分支产品线设计.md) | ProductLine CRD 设计 | — |
| [adr/ADR-009-依赖追踪设计.md](adr/ADR-009-依赖追踪设计.md) | 依赖追踪与自动升级 | — |

---

## 3. 架构设计文档

### 核心架构
- [当前系统架构](architecture/当前系统架构.md) — 系统整体架构
- [架构设计详解](architecture/架构设计详解.md) — 架构设计详细
- [架构重构设计](architecture/架构重构设计.md) — 重构方案
- [微前端子应用接入与后端交互设计](architecture/微前端子应用接入与后端交互设计.md) — 微前端架构
- [多租户隔离设计](architecture/多租户隔离设计.md) — 多租户方案
- [开放平台基座能力规则设计](architecture/开放平台基座能力规则设计.md) — 开放平台

### 架构分析 (2026-07)
- [orion-24-dimension-review-2026-07-18.md](architecture/orion-24-dimension-review-2026-07-18.md) — 24 维度架构评审
- [architecture-completeness-analysis-2026-07-02.md](architecture/architecture-completeness-analysis-2026-07-02.md) — 架构完整度分析
- [architecture-design-evaluation-2026-07-02.md](architecture/architecture-design-evaluation-2026-07-02.md) — 架构设计评估
- [service-governance-design-2026-07-02.md](architecture/service-governance-design-2026-07-02.md) — 服务治理设计
- [actual-service-dependency-map.md](architecture/actual-service-dependency-map.md) — 实际服务依赖图

### 技术架构
- [code-architecture-layers.md](architecture/code-architecture-layers.md) — 代码架构分层
- [service-communication-design.md](architecture/service-communication-design.md) — 服务通信设计
- [service-dependency-graph.md](architecture/service-dependency-graph.md) — 服务依赖图
- [grpc-integration-design.md](architecture/grpc-integration-design.md) — gRPC 集成设计
- [cache-layer-design.md](architecture/cache-layer-design.md) — 缓存层设计
- [data-flow-architecture-diagram-2026-07-03.md](architecture/data-flow-architecture-diagram-2026-07-03.md) — 数据流架构图
- [er-diagram-2026-07-03.md](architecture/er-diagram-2026-07-03.md) — ER 图
- [infrastructure-topology-2026-07-03.md](architecture/infrastructure-topology-2026-07-03.md) — 基础设施拓扑

### Go 微服务迁移
- [go-service-unification-design.md](architecture/go-service-unification-design.md) — Go 服务统一设计
- [go-microservice-consolidation/consolidation-plan.md](architecture/go-microservice-consolidation/consolidation-plan.md) — Go 微服务合并计划
- [platform-service-split-design.md](architecture/platform-service-split-design.md) — 平台服务拆分设计
- [subproject-refactoring-standards.md](architecture/subproject-refactoring-standards.md) — 子项目重构标准

### 功能设计 (01-22 系列)
- [01-Pipeline-List-DESIGN.md](architecture/01-Pipeline-List-DESIGN.md) — Pipeline 列表
- [02-Pipeline-Wizard-DESIGN.md](architecture/02-Pipeline-Wizard-DESIGN.md) — Pipeline 向导
- [03-Pipeline-Run-Details-DESIGN.md](architecture/03-Pipeline-Run-Details-DESIGN.md) — Pipeline 运行详情
- [04-Approval-Workbench-DESIGN.md](architecture/04-Approval-Workbench-DESIGN.md) — 审批工作台
- [05-Notification-Center-DESIGN.md](architecture/05-Notification-Center-DESIGN.md) — 通知中心
- [06-Efficiency-Dashboard-DESIGN.md](architecture/06-Efficiency-Dashboard-DESIGN.md) — 效率仪表板
- [07-Security-Audit-DESIGN.md](architecture/07-Security-Audit-DESIGN.md) — 安全审计
- [08-Product-Lines-DESIGN.md](architecture/08-Product-Lines-DESIGN.md) — 产品线管理
- [09-GitOps-Config-DESIGN.md](architecture/09-GitOps-Config-DESIGN.md) — GitOps 配置
- [10-AI-Skill-Marketplace-DESIGN.md](architecture/10-AI-Skill-Marketplace-DESIGN.md) — AI 技能市场
- [11-Tool-Marketplace-DESIGN.md](architecture/11-Tool-Marketplace-DESIGN.md) — 工具市场
- [12-Smart-Deployment-DESIGN.md](architecture/12-Smart-Deployment-DESIGN.md) — 智能部署
- [13-Security-Compliance-DESIGN.md](architecture/13-Security-Compliance-DESIGN.md) — 安全合规
- [14-Observability-DESIGN.md](architecture/14-Observability-DESIGN.md) — 可观测性
- [15-Collaboration-DESIGN.md](architecture/15-Collaboration-DESIGN.md) — 协作
- [16-Code-Management-DESIGN.md](architecture/16-Code-Management-DESIGN.md) — 代码管理
- [17-Build-Environment-DESIGN.md](architecture/17-Build-Environment-DESIGN.md) — 构建环境
- [18-Self-Healing-DESIGN.md](architecture/18-Self-Healing-DESIGN.md) — 自愈
- [19-Multi-Tenancy-DESIGN.md](architecture/19-Multi-Tenancy-DESIGN.md) — 多租户
- [20-IaC-Management-DESIGN.md](architecture/20-IaC-Management-DESIGN.md) — IaC 管理
- [21-Event-Bus-DESIGN.md](architecture/21-Event-Bus-DESIGN.md) — 事件总线
- [22-Data-Storage-DESIGN.md](architecture/22-Data-Storage-DESIGN.md) — 数据存储

### 专项架构
- [circuit-breaker-degradation-design.md](architecture/circuit-breaker-degradation-design.md) — 熔断降级
- [tenant-isolation-implementation-design.md](architecture/tenant-isolation-implementation-design.md) — 租户隔离实现
- [rbac-abac-unified-implementation.md](architecture/rbac-abac-unified-implementation.md) — RBAC/ABAC 统一实现
- [product-line-management-design.md](architecture/product-line-management-design.md) — 产品线管理
- [api-version-management-design.md](architecture/api-version-management-design.md) — API 版本管理
- [openapi-specification.md](architecture/openapi-specification.md) — OpenAPI 规范

---

## 4. 服务级设计文档

按模块分类，每篇对应一个微服务/功能模块。完整清单共 140+ 篇。

### 核心服务
- [auth/01-auth-spec.md](services/auth/01-auth-spec.md) — 认证授权
- [user/01-user-org-spec.md](services/user/01-user-org-spec.md) — 用户与组织
- [approval/01-approval-workflow-spec.md](services/approval/05-approval-workflow-spec.md) — 审批流程
- [ticket/01-ticket-spec.md](services/ticket/01-ticket-spec.md) — 工单系统
- [config-mgmt/01-config-mgmt-spec.md](services/config-mgmt/01-config-mgmt-spec.md) — 配置管理

### 交付与部署
- [pipeline/01-pipeline-spec.md](services/pipeline/01-pipeline-spec.md) — Pipeline 核心
- [pipeline/02-autonomous-pipeline-spec.md](services/pipeline/02-autonomous-pipeline-spec.md) — 自主 Pipeline
- [pipeline/09-data-pipeline-spec.md](services/pipeline/09-data-pipeline-spec.md) — 数据 Pipeline
- [build/01-build-spec.md](services/build/01-build-spec.md) — 构建
- [deploy/04-deploy-spec.md](services/deploy/04-deploy-spec.md) — 部署
- [canary/02-canary-spec.md](services/canary/02-canary-spec.md) — 金丝雀
- [pipeline-template/11-pipeline-template-spec.md](services/pipeline-template/11-pipeline-template-spec.md) — Pipeline 模板

### 可观测性
- [monitor/03-observability-spec.md](services/monitor/03-observability-spec.md) — 可观测性
- [monitor/OnCall 排班系统设计.md](services/monitor/OnCall%20排班系统设计.md) — OnCall 排班
- [inspection/07-inspection-spec.md](services/inspection/07-inspection-spec.md) — 巡检
- [finops/04-cost-operations-spec.md](services/finops/04-cost-operations-spec.md) — FinOps 成本

### 安全
- [security/02-supply-chain-security-spec.md](services/security/02-supply-chain-security-spec.md) — 供应链安全
- [security/15-security-compliance-spec.md](services/security/15-security-compliance-spec.md) — 安全合规
- [governance/02-api-governance-spec.md](services/governance/02-api-governance-spec.md) — API 治理

### AI 平台
- [ai/AI-Skill-Schema-定义.md](services/ai/AI-Skill-Schema-定义.md) — AI 技能 Schema
- [ai/mlops-and-ml-frameworks-design.md](services/ai/mlops-and-ml-frameworks-design.md) — MLOps 框架
- [ai/skill-marketplace-design.md](services/ai/skill-marketplace-design.md) — 技能市场
- [intelligence/01-ai-decision-spec.md](services/intelligence/01-ai-decision-spec.md) — AI 决策

### 基础设施
- [cmdb/01-cmdb-spec.md](services/cmdb/01-cmdb-spec.md) — CMDB
- [cron/04-cron-spec.md](services/cron/04-cron-spec.md) — Cron 调度
- [feature-flag/06-feature-flag-spec.md](services/feature-flag/06-feature-flag-spec.md) — 功能开关
- [event-bus/05-event-bus-spec.md](services/event-bus/05-event-bus-spec.md) — 事件总线
- [notification/01-notification-spec.md](services/notification/01-notification-spec.md) — 通知

### 专项服务
- [artifact/artifact-promotion-design.md](services/artifact/artifact-promotion-design.md) — 制品升级
- [chatops/01-chatops-spec.md](services/chatops/01-chatops-spec.md) — ChatOps
- [digital-twin/01-digital-twin-spec.md](services/digital-twin/01-digital-twin-spec.md) — 数字孪生
- [dr/disaster-recovery-design.md](services/dr/disaster-recovery-design.md) — 灾备
- [federation/03-federation-scheduling-spec.md](services/federation/03-federation-scheduling-spec.md) — 联邦调度
- [lowcode/01-lowcode-spec.md](services/lowcode/01-lowcode-spec.md) — 低代码
- [middleware-ops/09-middleware-ops-spec.md](services/middleware-ops/09-middleware-ops-spec.md) — 中间件运维
- [quality-gate/03-quality-gate-spec.md](services/quality-gate/03-quality-gate-spec.md) — 质量门禁
- [scheduler/12-scheduler-spec.md](services/scheduler/12-scheduler-spec.md) — 调度器
- [selfhealing/01-self-healing-spec.md](services/selfhealing/01-self-healing-spec.md) — 自愈引擎
- [community/community-ecosystem-spec.md](services/community/community-ecosystem-spec.md) — 社区生态
- [plugin/05-plugin-marketplace-spec.md](services/plugin/05-plugin-marketplace-spec.md) — 插件市场

---

## 5. 服务规格定义 (Specs)

位于 `docs/specs/`，共 68 篇，涵盖每个微服务的 API 规格。

### 核心服务规格
- [auth-spec.md](specs/auth-spec.md) — 认证服务
- [approval-spec.md](specs/approval-spec.md) — 审批服务
- [build-svc-spec.md](specs/build-svc-spec.md) — 构建服务
- [deploy-spec.md](specs/deploy-spec.md) — 部署服务
- [canary-svc-spec.md](specs/canary-svc-spec.md) — 金丝雀服务

### 数据与治理
- [audit-spec.md](specs/audit-spec.md) — 审计服务
- [governance-svc-spec.md](specs/governance-svc-spec.md) — 治理服务
- [risk-spec.md](specs/risk-spec.md) — 风险服务
- [secret-svc-spec.md](specs/secret-svc-spec.md) — 密钥服务

### 可观测性与运维
- [monitor-svc-spec.md](specs/monitor-svc-spec.md) — 监控服务
- [notify-spec.md](specs/notify-spec.md) — 通知服务
- [chaos-svc-spec.md](specs/chaos-svc-spec.md) — 混沌工程
- [middleware-ops-spec.md](specs/middleware-ops-spec.md) — 中间件运维

### 规格追踪
- [traceability-matrix.md](specs/traceability-matrix.md) — 规格追踪矩阵
- [spec-traceability-matrix.md](specs/spec-traceability-matrix.md) — 规格可追溯矩阵
- [acceptance-criteria-traceability.md](specs/acceptance-criteria-traceability.md) — 验收标准追踪

---

## 6. 评审与执行计划

- [review/INDEX.md](review/INDEX.md) — 评审文档索引 (v2.5, 权威)
- [review/execution-plan-2026-07-19.md](review/execution-plan-2026-07-19.md) — 执行计划 (Phase 0-5)
- [review/expert-review-summary-2026-07-19.md](review/expert-review-summary-2026-07-19.md) — 专家评审汇总
- [review/final-30-dimension-audit-2026-07-19.md](review/final-30-dimension-audit-2026-07-19.md) — 30 维度审计
- [review/30-dimension-code-audit-2026-07-19.md](review/30-dimension-code-audit-2026-07-19.md) — 30 维度代码审计
- [review/system-deep-audit-2026-07-19.md](review/system-deep-audit-2026-07-19.md) — 系统深度审计
- [review/docs-correlation-deep-analysis-2026-07-20.md](review/docs-correlation-deep-analysis-2026-07-20.md) — 文档关联分析
- [review/REVIEW-UPDATE-LOG-2026-07-20.md](review/REVIEW-UPDATE-LOG-2026-07-20.md) — 评审更新日志

---

## 7. 模块深度分析

位于 `docs/analysis/`，共 88 篇，每篇对应一个功能模块的代码级分析。

### 覆盖模块 (按首字母)
agent, ai-domain, api-governance, api-key, api-market, approval, artifact, audit, auth, billing, canary, change-management, chaos-engineering, chatops, circuit-breaker, cmdb, code, community-ecosystem, compliance-security, config, data-governance, data-platform, database, dba, degradation, deploy, deployment-scheduling, developer-portal, digital-twin, dr, efficiency-performance, escalation, finops, form-report, governance, guardian, iac, incident, infrastructure, inspection, integration, intelligence, internal-library, itsm-ticketing, knowledge, lowcode, metrics, middleware-ops, monitoring, notification, observability, operations, organization, pipeline, plugin, policy, privacy, problem, quality-gate, risk, runbook, script-library, security, self-healing, serverless, service-catalog, supply-chain, test-generation, test-selector, vector-store, webhook, workbench

### 专项分析
- [go-migration-phase1-review-2026-07-04.md](analysis/go-migration-phase1-review-2026-07-04.md) — Go 迁移阶段 1 评审
- [neatlogic-autoexec-vs-orion.md](analysis/neatlogic-autoexec-vs-orion.md) — NeatLogic vs Orion 对比
- [module-analysis-depth-2026-07-02.md](analysis/module-analysis-depth-2026-07-02.md) — 模块分析深度评估
- [spec-driven-design-analysis-2026-07-02.md](analysis/spec-driven-design-analysis-2026-07-02.md) — 规格驱动设计分析

---

## 8. 综合报告与规划

### 系统分析
- [orion-system-full-analysis-report-2026-07-02.md](orion-system-full-analysis-report-2026-07-02.md) — 系统全面分析报告
- [orion-system-comprehensive-report-2026-07-02.md](orion-system-comprehensive-report-2026-07-02.md) — 系统综合报告
- [orion-system-complementary-analysis-2026-07-02.md](orion-system-complementary-analysis-2026-07-02.md) — 系统补充分析
- [orion-system-deep-analysis-2026-07-01.md](orion-system-deep-analysis-2026-07-01.md) — 系统深度分析 (2026-07-01)
- [system-truth-report-2026-07-01.md](system-truth-report-2026-07-01.md) — 系统真相报告
- [module-completion-status-report.md](module-completion-status-report.md) — 模块完成度报告
- [feature-completion-analysis-2026-07-08.md](feature-completion-analysis-2026-07-08.md) — 功能完成度分析

### 迁移与规划
- [ai-migration-plan-2026-07-02.md](ai-migration-plan-2026-07-02.md) — AI 迁移计划
- [implementation-plan-2026-07-02.md](implementation-plan-2026-07-02.md) — 实施计划
- [frontend-backend-mapping.md](frontend-backend-mapping.md) — 前端-后端映射
- [business-module-inventory.md](business-module-inventory.md) — 业务模块清单
- [migration/数据迁移方案.md](migration/数据迁移方案.md) — 数据迁移方案

### 文档管理
- [文档管理规范.md](文档管理规范.md) — 文档编写规范
- [documentation-map-2026-07-02.md](documentation-map-2026-07-02.md) — 文档地图
- [document-progress-analysis-2026-07-02.md](document-progress-analysis-2026-07-02.md) — 文档进度分析
- [document-four-way-comparison-2026-07-02.md](document-four-way-comparison-2026-07-02.md) — 四向对比

### 设计约束
- [design-constraints/README.md](design-constraints/README.md) — 设计约束框架概览
- [design-constraints/orion/detector/README.md](design-constraints/orion/detector/README.md) — 检测器清单

### 专项计划 (Superpowers)
- [superpowers/migration-summary.md](superpowers/migration-summary.md) — 迁移总结
- [superpowers/phase-05-bounded-contexts.md](superpowers/phase-05-bounded-contexts.md) — Phase 5 限界上下文
- [superpowers/performance-baseline-ts.md](superpowers/performance-baseline-ts.md) — 性能基线
- [superpowers/load-test-plan.md](superpowers/load-test-plan.md) — 负载测试计划

---

## 9. 规范汇总

- [规范汇总/Orion统一规范汇总.md](规范汇总/Orion统一规范汇总.md) — 统一规范汇总 (权威)
- [规范汇总/archive/Orion统一规范汇总-二次评审报告.md](规范汇总/archive/Orion统一规范汇总-二次评审报告.md) — 二次评审
- [规范汇总/archive/Orion统一规范汇总-多维度评审报告.md](规范汇总/archive/Orion统一规范汇总-多维度评审报告.md) — 多维度评审

---

## 10. 文档统计

| 目录 | 文档数 | 类型 |
|------|:------:|------|
| adr/ | 14 | 架构决策记录 |
| analysis/ | 88 | 模块深度分析 |
| architecture/ | 75 | 架构设计 |
| archive/ | 9 | 归档文档 |
| code-review/ | 1 | 代码评审 |
| design-constraints/ | 5 | 设计约束 |
| migration/ | 1 | 迁移方案 |
| operations/ | 1 | 运维 |
| reports/ | 4 | 综合评审报告 |
| requirements/ | 1 | 需求 |
| review/ | 9 | 评审与执行 |
| services/ | 140 | 服务级设计 |
| specs/ | 68 | 服务规格 |
| superpowers/ | 10 | 专项计划 |
| 规范汇总/ | 3 | 规范汇总 |
| **根目录** | **14** | **报告/规划** |
| **总计** | **~445** | — |

---

## 11. 权威文档索引

> 当存在多份相似文档时，以下文档为权威来源：

| 主题 | 权威文档 |
|------|---------|
| 评审与 P0/P1 进度 | `docs/review/INDEX.md` (v2.5) |
| 执行计划 | `docs/review/execution-plan-2026-07-19.md` |
| ADR 体系 | 本文件 §2 |
| 统一规范 | `docs/规范汇总/Orion统一规范汇总.md` |
| 微服务规格 | `docs/specs/` 目录 (68 篇) |
| 服务级设计 | `docs/services/` 目录 (140 篇) |
| 架构设计 | `docs/architecture/` 目录 (75 篇) |
