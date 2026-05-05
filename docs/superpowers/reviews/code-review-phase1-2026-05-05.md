# Phase 1 代码评审报告

> **日期**: 2026-05-05
> **评审范围**: Phase 1（0-3 个月）6 个能力域
> **评审依据**: `/Users/heal/orion-design/docs/superpowers/specs/phase1/` 下的规格文档
> **评审人**: ola-cc 自动化代码评审

---

## 总览

| 能力域 | 规格成熟度目标 | 实际成熟度 | 整体状态 |
|--------|:-------------:|:---------:|:--------:|
| 1. 核心流水线 | L3.3 | L3.1 | 部分实现 |
| 2. 构建制品 | L2.5 | L2.2 | 部分实现 |
| 3. 质量门禁 | L3.3 | L3.0 | 严重不足 |
| 4. 部署发布 | L3.3 | L3.0 | 未实现 |
| 5. 开发者门户 | L1.5 | L1.0 | 未实现 |
| 6. 环境管理 | L2.3 | L2.0 | 严重不足 |

**Phase 1 整体完成度: ~35%**（后端 Service 约 45%，API 路由约 15%，前端约 40%，迁移约 20%）

---

## 数据库迁移编号对比

规格定义的迁移编号与实际代码存在严重不一致：

| 规格定义 | 规格描述 | 实际 080-085 迁移 | 是否匹配 |
|:--------:|----------|-------------------|:--------:|
| 080 | pipeline_versions, budgets, templates | `080_create_llm_traces.sql` (LLM 追踪) | 不匹配 |
| 081 | artifacts, build_cache_stats | `081_create_pipeline_versions.sql` (pipeline 版本+预算+模板) | 部分重叠 |
| 082 | policy_overrides, exemptions | `082_create_ai_model_versions.sql` (AI 模型版本) | 不匹配 |
| 083 | deploy_windows, dependencies | `083_create_chaos_engineering.sql` (混沌工程) | 不匹配 |
| 084 | portal_documents | `084_create_digital_twin.sql` (数字孪生) | 不匹配 |
| 085 | env_templates, hibernation, ttl | 不存在 | 缺失 |

**P0-001**: 迁移编号混乱。规格要求的 082-085 迁移全部缺失。081 虽然包含部分 pipeline 表，但缺少 `pipeline_budget_usage`、`pipeline_template_versions` 等规格定义的表。

---

## 能力域 1: 核心流水线

| 检查项 | 状态 | 说明 |
|--------|:----:|------|
| 迁移文件 | ⚠️ | `081_create_pipeline_versions.sql` 包含 pipeline_versions、pipeline_budgets、pipeline_templates 三个表，但缺少 `pipeline_budget_usage`、`pipeline_template_versions`（规格 4.3 和 4.4 的表）。另外 `pipeline_runs` 表缺少规格定义的 `runtime_params`、`dynamic_stages`、`estimated_cost_cents` 等列 |
| Repository 层 | ❌ | 无独立的 PipelineVersionRepository、BudgetRepository、TemplateRepository。Services 直接操作 `DatabasePool` |
| Service 层 | ⚠️ | `PipelineVersionService`、`PipelineBudgetService`、`PipelineTemplateService` 存在于 `services/pipeline-*/` 目录（规格定义为 `services/pipeline/`），有基本 CRUD 逻辑。缺少 `DynamicParamsResolver` |
| API 路由 | ❌ | 仅 `GET /v1/pipelines/:id/versions` 已注册。版本详情、diff、rollback、tag、baseline、预算 CRUD、模板 CRUD 路由均未注册到 `routes.ts`。前端 API 客户端指向不存在的端点 |
| 前端页面 | ⚠️ | `PipelineVersionHistory` 和 `PipelineBudget` 页面存在，但 API 端点未实现。`PipelineTemplates` 页面不存在（规格要求） |
| 测试覆盖 | ⚠️ | 有 `PipelineVersionService.test.ts`、`PipelineBudgetService.test.ts`、`PipelineTemplateService.test.ts` 三个测试文件，但未验证实际运行通过情况 |

### 具体问题

- **P1-001**: 前端 `pipeline-budget.ts` 和 `pipeline-versions.ts` API 客户端已实现，指向 `/api/v1/pipelines/:id/budget`、`/api/v1/pipelines/:id/versions/:versionId/diff` 等端点，但这些端点在后端不存在，调用会返回 404。
- **P1-002**: 规格要求 `pipeline_runs` 增加 `runtime_params`、`dynamic_stages`、`estimated_cost_cents`、`budget_exceeded`、`budget_policy_action` 列（规格 4.5），实际迁移中不存在。
- **P2-001**: Service 文件路径与规格不一致（`services/pipeline-version/` vs 规格 `services/pipeline/PipelineVersionService.ts`）。

---

## 能力域 2: 构建制品

| 检查项 | 状态 | 说明 |
|--------|:----:|------|
| 迁移文件 | ⚠️ | 081 迁移不存在（被占用）。已有的 `010_create_artifact_registry.sql` 是旧表，非规格定义的新 `artifacts` 表。缺少 `build_architectures`、`build_manifests`、`build_file_hashes`、`build_cache_stats` 表 |
| Repository 层 | ⚠️ | `ArtifactRepository`（接口+Postgres实现）存在，但操作的是 `artifact_registry` 表（旧 schema），非规格定义的 `artifacts` 表 |
| Service 层 | ❌ | `ArtifactService`（`services/build/ArtifactService.ts`）仍使用 `Map<string, Artifact>` 内存存储。规格验收标准 A1-A4 全部未满足。缺少 `BuildCacheMonitorService`、`MultiArchBuildService`、`IncrementalBuildService` |
| API 路由 | ⚠️ | `artifact-routes.ts` 存在，提供 CRUD/标签/下载/搜索/升级端点，但使用的是旧的 `ArtifactRegistryServiceImpl`（基于 `artifact_registry` 表），非规格定义的 `artifacts` API。路径为 `/artifacts` 而非规格要求的 `/api/v1/artifacts`（前缀由 routes.ts 添加后为 `/v1/artifacts`） |
| 前端页面 | ⚠️ | `BuildCachePage` 存在，提供缓存配置/条目的 CRUD，但规格要求的是"缓存监控面板"（命中率统计、趋势图、热点分析），不是 CRUD 页面 |
| 测试覆盖 | ❌ | 无 `BuildCacheMonitorService`、`MultiArchBuildService`、`IncrementalBuildService` 的测试文件 |

### 具体问题

- **P0-002**: `ArtifactService` 仍使用 `Map` 内存存储（第 116-119 行），服务重启后数据全部丢失。规格验收标准 A3 明确要求"服务重启后 Artifact 数据不丢失"。
- **P0-003**: 规格定义的 `artifacts` 表（含 `tenant_id`、`run_id`、`stage_id`、`expires_at`、`downloaded_count` 等列）不存在。已有的 `artifact_registry` 表 schema 与规格完全不同（使用 `namespace`/`version` 而非 `run_id`/`stage_id`）。
- **P1-003**: `BuildxBuilderService.buildMultiArch()` 第 86 行使用 `for...of` 循环**串行**构建每个平台，规格 M2 要求"并行执行多架构构建"。
- **P1-004**: 增量构建能力（`IncrementalBuildService`）完全缺失，规格 I1-I4 全部未满足。
- **P1-005**: 缓存监控 API 端点（`/stats`、`/hot-keys`、`/trend`）缺失。`build-routes.ts` 仅提供缓存配置/条目的 CRUD 端点。

---

## 能力域 3: 质量门禁

| 检查项 | 状态 | 说明 |
|--------|:----:|------|
| 迁移文件 | ❌ | `policy_overrides`、`policy_exemptions`、`quality_gate_snapshots` 三张表均不存在 |
| Repository 层 | ❌ | `PolicyOverrideRepository` 不存在。`PolicyEvaluationRepository` 存在但仅用于 evaluation 记录 |
| Service 层 | ❌ | `ExemptionService`、`QualityGateTrendService` 均不存在 |
| API 路由 | ❌ | `/policies/exemptions`、`/quality-gates/trend`、`/quality-gates/distribution` 等端点均未注册。`policy-routes.ts` 仅有基础的 Policy CRUD、violations、overrides（Map 存储） |
| 前端页面 | ❌ | `QualityGateDashboard`、`ExemptionRequest`、`QualityGateTrend` 均不存在 |
| 测试覆盖 | ❌ | 无相关测试文件 |

### 具体问题

- **P0-004**: 规格要求的 `policy_overrides` 持久化表不存在，Override 仍存储在 `PolicyEvaluationService` 的 `Map<string, PolicyOverride>`（第 53 行）中。规格 O1-O3 全部未满足。
- **P0-005**: 门禁豁免机制（ExemptionService + Exemption API）完全缺失，规格 E1-E6 全部未满足。
- **P0-006**: 质量门禁趋势分析（QualityGateTrendService + 趋势 API）完全缺失，规格 T1-T5 全部未满足。
- **P0-007**: 门禁与 Pipeline 深度集成（规格 P1-P3）未实现。`PolicyEvaluationService.evaluate()` 未与 Pipeline Run 完成事件关联。

---

## 能力域 4: 部署发布

| 检查项 | 状态 | 说明 |
|--------|:----:|------|
| 迁移文件 | ❌ | `deploy_windows`、`deploy_emergencies`、`deploy_service_dependencies`、`deploy_progressive_stages` 四张表均不存在。`deployments` 表缺少规格定义的 `release_notes`、`window_id`、`emergency_id`、`canary_percent`、`progressive_stage` 列 |
| Repository 层 | ❌ | 无相关 Repository |
| Service 层 | ❌ | `DeployWindowService`、`DeployDependencyService`、`ProgressiveDeployService`、`ReleaseNotesGenerator` 均不存在 |
| API 路由 | ❌ | `/deploy-windows`、`/deploy-dependencies`、`/deployments/:id/progressive`、`/deployments/:id/release-notes` 均未注册 |
| 前端页面 | ❌ | `DeployWindows`、`DeployDependencies`、`DeployProgressive`、`ReleaseNotes` 均不存在 |
| 测试覆盖 | ❌ | 无相关测试文件 |

### 具体问题

- **P0-008**: 部署发布 Phase 1 的 4 个模块（发布窗口、依赖协调、渐进式推进、Release Notes）全部未实现。这是规格中 P1 优先级的能力域。
- **P0-009**: 现有 `DeployService` / `SmartDeployService` 不包含任何发布窗口检查逻辑。任何时间均可部署，无禁发期概念（规格 W3）。

---

## 能力域 5: 开发者门户

| 检查项 | 状态 | 说明 |
|--------|:----:|------|
| 迁移文件 | ❌ | `portal_documents` 表不存在 |
| Repository 层 | ❌ | 无 `PortalDocumentRepository` |
| Service 层 | ❌ | `DeveloperPortalService` 不存在 |
| API 路由 | ❌ | `/developer-portal/docs`、`/developer-portal/templates`、`/developer-portal/developer-status` 均未注册 |
| 前端页面 | ❌ | `DeveloperPortal` 目录及页面不存在。规格要求的 `DocCenter`、`TemplateLib`、`Onboarding` 均未实现 |
| 测试覆盖 | ❌ | 无相关测试文件 |

### 具体问题

- **P0-010**: 开发者门户完全未实现。无统一文档中心、无模板聚合、无状态总览、无快速开始引导。这是规格中 P2 优先级但 L1→L1.5 的关键交付。
- **P1-006**: `AIDocManagement` 页面存在，可能部分覆盖文档管理需求，但不是规格定义的"开发者门户文档中心"。

---

## 能力域 6: 环境管理

| 检查项 | 状态 | 说明 |
|--------|:----:|------|
| 迁移文件 | ❌ | `environment_templates`、`environment_hibernation_log`、`environment_ttl_config` 表均不存在。`environments` 表缺少 `template_id`、`hibernated_at`、`last_accessed_at`、`ttl_config_id` 列 |
| Repository 层 | ❌ | 无 `EnvironmentTemplateRepository`、`TTLConfigRepository`、`HibernationLogRepository` |
| Service 层 | ❌ | `EnvironmentHibernationService`、`TTLManager`、`EnvironmentTemplateService` 均不存在 |
| API 路由 | ❌ | `/environments/:envId/hibernate`、`/environments/:envId/wake`、`/environments/:envId/ttl`、`/environment-templates` 均未注册。`ephemeral-env-routes.ts` 仅提供临时环境的 CRUD |
| 前端页面 | ❌ | `EnvironmentTemplates`、`EnvironmentStatus` 不存在。`EnvironmentList` 存在但不含休眠/TTL/模板功能 |
| 测试覆盖 | ❌ | 无相关测试文件 |

### 具体问题

- **P0-011**: 休眠回收、TTL 管理、环境模板三个模块全部未实现。
- **P0-012**: 临时环境 TTL 仍为固定 24h（`auto_destroy_at`），不可配置（规格 T1-T6 未满足）。
- **P1-007**: 静态环境（`environments` 表）无休眠/唤醒能力。仅临时环境有 `destroy` 操作，无 `hibernate`/`wake`。

---

## 问题汇总

### P0（阻塞）- 12 项

| 编号 | 能力域 | 问题 |
|------|--------|------|
| P0-001 | 通用 | 迁移编号与规格不一致，082-085 迁移全部缺失 |
| P0-002 | 构建制品 | ArtifactService 仍使用 Map 内存存储，数据重启丢失 |
| P0-003 | 构建制品 | 规格定义的 `artifacts` 表不存在，旧表 schema 不匹配 |
| P0-004 | 质量门禁 | `policy_overrides` 持久化表不存在，仍为 Map 存储 |
| P0-005 | 质量门禁 | 门禁豁免机制（ExemptionService）完全缺失 |
| P0-006 | 质量门禁 | 趋势分析（QualityGateTrendService）完全缺失 |
| P0-007 | 质量门禁 | 门禁与 Pipeline 深度集成未实现 |
| P0-008 | 部署发布 | 部署发布 4 个模块全部未实现 |
| P0-009 | 部署发布 | 无发布窗口/禁发期检查逻辑 |
| P0-010 | 开发者门户 | 开发者门户完全未实现 |
| P0-011 | 环境管理 | 休眠/TTL/模板三个模块全部未实现 |
| P0-012 | 环境管理 | TTL 固定 24h 不可配置 |

### P1（重要）- 7 项

| 编号 | 能力域 | 问题 |
|------|--------|------|
| P1-001 | 核心流水线 | 前端 API 客户端指向不存在的后端端点（404） |
| P1-002 | 核心流水线 | `pipeline_runs` 缺少规格定义的 runtime 列 |
| P1-003 | 构建制品 | 多架构构建串行执行，规格要求并行 |
| P1-004 | 构建制品 | 增量构建能力完全缺失 |
| P1-005 | 构建制品 | 缓存监控 API 端点（stats/trend/hot-keys）缺失 |
| P1-006 | 开发者门户 | AIDocManagement 非规格定义的开发者门户文档中心 |
| P1-007 | 环境管理 | 静态环境无休眠/唤醒能力 |

### P2（建议）- 1 项

| 编号 | 能力域 | 问题 |
|------|--------|------|
| P2-001 | 核心流水线 | Service 文件路径与规格命名约定不一致 |

---

## 建议

1. **立即修正迁移编号冲突**：规格定义的 080-085 与现有 080-084（LLM traces、pipeline versions、AI model versions、chaos engineering、digital twin）冲突。建议规格迁移使用新编号（如 090-095）或重新排列现有迁移。

2. **优先级排序**：
   - 第一批：核心流水线 API 路由注册（P1-001）、Artifact 持久化迁移（P0-002/003）
   - 第二批：Override 持久化 + 豁免机制（P0-004/005）
   - 第三批：部署窗口 + 依赖协调（P0-008/009）
   - 第四批：开发者门户 + 环境管理

3. **前端与后端同步**：前端已有 PipelineVersionHistory、PipelineBudget 页面和 API 客户端，后端对应的 API 路由缺失，导致前端调用全部 404。应尽快注册这些路由。

---

_报告生成时间: 2026-05-05_
_评审依据规格版本: v1.0 (2026-05-05)_
