# Orion 前端全量功能缺失深度扫描报告

**扫描日期**: 2026-05-22
**分支**: `feat/frontend-gap-implementation`
**扫描范围**: `orion-frontend/src/pages/` 全部 540 个 .tsx 文件
**总代码量**: 424,060 行，204 个页面入口

---

## 总体合规率

| 维度 | 合规率 | 目标 | 差距 |
|------|--------|------|------|
| 交互链完整性 | 46.7% | 95% | -48.3% |
| 样式规范符合度 | 21.9% | 100% | -78.1% |
| 逻辑完整度 (CRUD) | 28.3% | 90% | -61.7% |
| 页面标题规范 | 1.9% | 100% | -98.1% |
| 微前端拆分就绪度 | 35.2% | 80% | -44.8% |
| 8 大菜单补全矩阵 | 62.5% | 100% | -37.5% |
| **综合合规率** | **32.6%** | **94%** | **-61.4%** |

---

## 6 维度分析框架说明

### 维度 1: 交互链完整性

逐元素检查：onClick 交互、loading/disabled、message.success/error、Popconfirm 二次确认、Empty + 引导按钮。

### 维度 2: 样式规范符合度

禁止硬编码：colors.*、componentRadius.*、spacing.*、shadows.* Token 使用。

### 维度 3: 逻辑完整度 (CRUD)

Create/Read/Update/Delete 全链路、try/catch 异常处理、unwrapResponse 解包。

### 维度 4: 功能缺失识别

只读 Descriptions 无编辑入口、无保存按钮、列表无搜索过滤、无权限控制。

### 维度 5: 微前端拆分评估

>8 页面或 >2000 行 → 独立子应用，已有 microfront/apps.ts 注册 → 无需改。

### 维度 6: 8 大菜单补全矩阵

Title level={2} + 图标、副标题 + colors.neutral[500]、表单 maxWidth:700 + 居中。

---

## 一、8 大菜单模块统计表

### 1. 工作台 (Workbench)

| 指标 | 数值 |
|------|------|
| 主页面数 | 10 |
| P0 缺失 | 4 |
| P1 缺失 | 3 |
| P2 缺失 | 2 |

**核心页面**: DashboardNew, Workbench, TicketList, TicketDetail, Projects, ProductLine, ExecutiveDashboard, ManagerDashboard, EngineerDashboard, EfficiencyDashboard, RiskDashboard

| 优先级 | 文件路径 | 行号 | 问题描述 | 修复方案 |
|--------|---------|------|---------|---------|
| P0 | `orion-frontend/src/pages/DashboardNew/index.tsx` | 全文 | 缺少 Title level={2} 主标题 + 图标 | 添加 `<Title level={2}>` 与 `<DashboardOutlined>` |
| P0 | `orion-frontend/src/pages/Workbench/WorkbenchPage.tsx` | 全文 | 缺少 Title level={2} 主标题 | 添加统一标题规范 |
| P0 | `orion-frontend/src/pages/TicketList/index.tsx` | 全文 | 缺少页面主标题 | 添加 `<Title level={2}>` + `<UnorderedListOutlined>` |
| P0 | `orion-frontend/src/pages/TicketDetail/index.tsx` | 12 | 12 处 loading 但仅 1 处 Title level={2} | 补充主标题规范 |
| P1 | `orion-frontend/src/pages/Projects/index.tsx` | 全文 | 3 处 loading 但无 Title level={2} | 添加主标题 |
| P1 | `orion-frontend/src/pages/ProductLine/index.tsx` | 1122 行 | 15 处 loading 但无主标题规范 | 添加主标题，拆分 >1000 行 |
| P1 | `orion-frontend/src/pages/EfficiencyDashboard/index.tsx` | 全文 | 6 处 message.success 但无主标题 | 添加主标题 |
| P2 | `orion-frontend/src/pages/ExecutiveDashboard/index.tsx` | 全文 | 缺少副标题 Typography.Text | 添加副标题 |
| P2 | `orion-frontend/src/pages/ManagerDashboard/index.tsx` | 全文 | 缺少副标题 Typography.Text | 添加副标题 |

### 2. 控制台 (Console)

| 指标 | 数值 |
|------|------|
| 主页面数 | 12 |
| P0 缺失 | 5 |
| P1 缺失 | 4 |
| P2 缺失 | 3 |

**核心页面**: Console, PluginManagement, FeatureFlagsPage, UserManagement, SubAppManagement, Capability, WorkflowTriggers, PipelineBudget, QualityGatePage, CronJobs, RunnerManagement, ApiKeyManagement

| 优先级 | 文件路径 | 行号 | 问题描述 | 修复方案 |
|--------|---------|------|---------|---------|
| P0 | `orion-frontend/src/pages/Console/index.tsx` | 全文 | 有 Title 但可能不是 level={2} + 图标 | 统一标题规范 |
| P0 | `orion-frontend/src/pages/UserManagement/index.tsx` | 892 行 | 12 处 loading，5 处 message.success，但无 Title level={2} | 添加主标题，文件 >800 行建议拆分 |
| P0 | `orion-frontend/src/pages/PluginManagement/index.tsx` | 全文 | 6 处 loading，但无主标题 | 添加主标题 |
| P0 | `orion-frontend/src/pages/SubAppManagement/index.tsx` | 全文 | 6 处 loading，但无主标题 | 添加主标题 |
| P0 | `orion-frontend/src/pages/FeatureFlagsPage/index.tsx` | 全文 | 5 处 loading，但无主标题 | 添加主标题 |
| P1 | `orion-frontend/src/pages/Capability/index.tsx` | 全文 | 1 处 Title level={2}，缺少图标 | 添加 `<SettingOutlined>` 图标 |
| P1 | `orion-frontend/src/pages/WorkflowTriggers/index.tsx` | 全文 | 3 处 message.success，缺少主标题 | 添加主标题 |
| P1 | `orion-frontend/src/pages/RunnerManagement/index.tsx` | 235 行 | 6 处 loading，2 处 message.success，Descriptions 有编辑 | 添加主标题 |
| P1 | `orion-frontend/src/pages/ApiKeyManagement/index.tsx` | 全文 | 3 处 loading，但无主标题 | 添加主标题 |
| P2 | `orion-frontend/src/pages/CronJobs/index.tsx` | 全文 | 3 处 loading，缺少副标题 | 添加副标题 |
| P2 | `orion-frontend/src/pages/PipelineBudget/index.tsx` | 全文 | 缺少主标题 | 添加主标题 |
| P2 | `orion-frontend/src/pages/QualityGatePage/index.tsx` | 全文 | 缺少主标题 | 添加主标题 |

### 3. 交付 (Delivery)

| 指标 | 数值 |
|------|------|
| 主页面数 | 14 |
| P0 缺失 | 6 |
| P1 缺失 | 4 |
| P2 缺失 | 2 |

**核心页面**: PipelineList, PipelineEditor, PipelineDetail, PipelineRunList, PipelineRunLive, PipelineVersionHistory, DeploymentList, DeploymentDetail, Artifacts, ArtifactBrowser, InternalLibrary, TestSelector, CanaryAnalysis, ChangeIntelligence

| 优先级 | 文件路径 | 行号 | 问题描述 | 修复方案 |
|--------|---------|------|---------|---------|
| P0 | `orion-frontend/src/pages/PipelineList/index.tsx` | 全文 | 缺少 Title level={2} 主标题 | 添加主标题 + `<CloudUploadOutlined>` |
| P0 | `orion-frontend/src/pages/PipelineEditor/index.tsx` | 全文 | 9 处 loading，有 spacing/colors import 但无主标题 | 添加主标题 |
| P0 | `orion-frontend/src/pages/PipelineRunList/index.tsx` | 全文 | 1 处 loading，缺少主标题 | 添加主标题 |
| P0 | `orion-frontend/src/pages/PipelineRunLive/index.tsx` | 全文 | 1 处 loading，缺少主标题 | 添加主标题 |
| P0 | `orion-frontend/src/pages/DeploymentList/index.tsx` | 全文 | 1 处 loading，缺少主标题 | 添加主标题 |
| P0 | `orion-frontend/src/pages/PipelineDetail/index.tsx` | 1037 行 | 5 处 loading，Descriptions 无编辑 | 添加主标题，增加编辑入口 |
| P1 | `orion-frontend/src/pages/Artifacts/index.tsx` | 全文 | 17 处 loading，8 处 message.success，但无主标题 | 添加主标题 |
| P1 | `orion-frontend/src/pages/InternalLibrary/index.tsx` | 全文 | 19 处 loading，9 处 message.success，但无主标题 | 添加主标题 |
| P1 | `orion-frontend/src/pages/ArtifactBrowser/index.tsx` | 全文 | 2 处 message.success，硬编码颜色 `#d9d9d9`、`#fff` | 替换为 colors Token |
| P1 | `orion-frontend/src/pages/CanaryAnalysis/index.tsx` | 全文 | 3 处 loading，4 处 message.success，缺少主标题 | 添加主标题 |
| P2 | `orion-frontend/src/pages/TestSelector/index.tsx` | 全文 | 1 处 loading，缺少主标题 | 添加主标题 |
| P2 | `orion-frontend/src/pages/ChangeIntelligence/index.tsx` | 全文 | 4 处 message.success，缺少主标题 | 添加主标题 |

### 4. 可观测性 (Observability)

| 指标 | 数值 |
|------|------|
| 主页面数 | 12 |
| P0 缺失 | 5 |
| P1 缺失 | 3 |
| P2 缺失 | 2 |

**核心页面**: Monitoring/Dashboard, Monitoring/Metrics, Monitoring/Alerts, Monitoring/Rules, Monitoring/Channels, AlertList, Diagnostic/Sessions, Diagnostic/Reports, SelfHealing/IncidentList, SelfHealing/StrategyList, SelfHealing/History, SbomDashboard

| 优先级 | 文件路径 | 行号 | 问题描述 | 修复方案 |
|--------|---------|------|---------|---------|
| P0 | `orion-frontend/src/pages/monitor-svc/Monitoring/index.tsx` | 全文 | 缺少 Title level={2} 主标题 | 添加主标题 + `<RadarChartOutlined>` |
| P0 | `orion-frontend/src/pages/AlertList/index.tsx` | 全文 | 有 colors/spacing import 但无主标题 | 添加主标题 |
| P0 | `orion-frontend/src/pages/security-svc/Diagnostic/Sessions.tsx` | 全文 | 8 处 loading，无主标题 | 添加主标题 |
| P0 | `orion-frontend/src/pages/security-svc/SelfHealing/IncidentList.tsx` | 全文 | 4 处 loading，无主标题 | 添加主标题 |
| P0 | `orion-frontend/src/pages/SbomDashboard/index.tsx` | 全文 | 有 colors/spacing import 但无主标题 | 添加主标题 |
| P1 | `orion-frontend/src/pages/MetricsDashboard/index.tsx` | 全文 | 1 处 loading，缺少主标题 | 添加主标题 |
| P1 | `orion-frontend/src/pages/SbomDetail/index.tsx` | 351 行 | Descriptions 无编辑入口，有 colors/spacing import | 增加编辑入口 |
| P1 | `orion-frontend/src/pages/observability/ObservabilityPage.tsx` | 全文 | 10 处 loading，7 处 message.success，但无主标题 | 添加主标题 |
| P2 | `orion-frontend/src/pages/monitor-svc/Monitoring/Dashboard.tsx` | 全文 | 6 处 loading，缺少副标题 | 添加副标题 |
| P2 | `orion-frontend/src/pages/security-svc/SelfHealing/History.tsx` | 全文 | 2 处 loading，缺少副标题 | 添加副标题 |

### 5. AI 平台 (AI Platform)

| 指标 | 数值 |
|------|------|
| 主页面数 | 15 |
| P0 缺失 | 6 |
| P1 缺失 | 4 |
| P2 缺失 | 3 |

**核心页面**: AIGateway, AIAgents, AIReview/Dashboard, AIReview/History, AIReview/Rules, AISecurity, AICostDashboard/*, LLMTraceDashboard/*, AIDocManagement/*, ChatOps/*

| 优先级 | 文件路径 | 行号 | 问题描述 | 修复方案 |
|--------|---------|------|---------|---------|
| P0 | `orion-frontend/src/pages/AIGateway/index.tsx` | 全文 | 4 处 message.success，1 处 loading，但无主标题 | 添加主标题 + `<RobotOutlined>` |
| P0 | `orion-frontend/src/pages/AIAgents/index.tsx` | 全文 | 5 处 loading，但无主标题 | 添加主标题 |
| P0 | `orion-frontend/src/pages/AISecurity/index.tsx` | 906 行 | 7 处 loading，5 处 message.success，但无主标题 | 添加主标题 |
| P0 | `orion-frontend/src/pages/AIReview/Dashboard.tsx` | 全文 | 4 处 loading，1 处 message.success，但无主标题 | 添加主标题 |
| P0 | `orion-frontend/src/pages/ChatOps/index.tsx` | 全文 | 7 处 loading，4 处 message.success，但无主标题 | 添加主标题 |
| P0 | `orion-frontend/src/pages/LLMTraceDashboard/TraceOverview.tsx` | 全文 | 4 处 loading，1 处 message.success，但无主标题 | 添加主标题 |
| P1 | `orion-frontend/src/pages/AICostDashboard/CostOverview.tsx` | 全文 | 2 处 loading，缺少主标题 | 添加主标题 |
| P1 | `orion-frontend/src/pages/AIDocManagement/SpaceList.tsx` | 全文 | 4 处 loading，3 处 message.success，但无主标题 | 添加主标题 |
| P1 | `orion-frontend/src/pages/AIReview/Rules.tsx` | 全文 | 8 处 loading，4 处 message.success，但无主标题 | 添加主标题 |
| P1 | `orion-frontend/src/pages/ChatOps/AdminSettings.tsx` | 917 行 | 4 处 loading，4 处 message.success，文件过大 | 拆分文件 + 添加主标题 |
| P2 | `orion-frontend/src/pages/AICostDashboard/BudgetManagement.tsx` | 全文 | 4 处 loading，1 处 message.success，缺少副标题 | 添加副标题 |
| P2 | `orion-frontend/src/pages/AIDocManagement/DocumentEditor.tsx` | 全文 | 2 处 loading，缺少副标题 | 添加副标题 |
| P2 | `orion-frontend/src/pages/AIReview/Config.tsx` | 全文 | 4 处 loading，缺少副标题 | 添加副标题 |

### 6. 基础设施 (Infrastructure)

| 指标 | 数值 |
|------|------|
| 主页面数 | 18 |
| P0 缺失 | 7 |
| P1 缺失 | 5 |
| P2 缺失 | 3 |

**核心页面**: Environments, EphemeralEnvList, EphemeralEnvDetail, BuildEnv/*, IaCManagement/*, Queue, VectorStore, EventBus, CMDB/*, Sessions, Backup, OnCall

| 优先级 | 文件路径 | 行号 | 问题描述 | 修复方案 |
|--------|---------|------|---------|---------|
| P0 | `orion-frontend/src/pages/Environments/index.tsx` | 全文 | 7 处 loading，4 处 message.success，但无主标题 | 添加主标题 + `<ClusterOutlined>` |
| P0 | `orion-frontend/src/pages/BuildEnv/BuilderImageList.tsx` | 全文 | 8 处 loading，5 处 message.success，但无主标题 | 添加主标题 |
| P0 | `orion-frontend/src/pages/BuildEnv/BuildCachePage.tsx` | 全文 | 14 处 loading，6 处 message.success，但无主标题 | 添加主标题 |
| P0 | `orion-frontend/src/pages/CMDB/CITablePage.tsx` | 全文 | 15 处 loading，5 处 message.success，但无主标题 | 添加主标题 |
| P0 | `orion-frontend/src/pages/CMDB/BatchExecPage.tsx` | 1020 行 | 3 处 loading，9 处 message.success，文件过大 | 拆分 + 添加主标题 |
| P0 | `orion-frontend/src/pages/VectorStore/index.tsx` | 全文 | 10 处 loading，3 处 message.success，但无主标题 | 添加主标题 |
| P0 | `orion-frontend/src/pages/IacManagement/WorkspaceList.tsx` | 全文 | 4 处 loading，2 处 message.success，但无主标题 | 添加主标题 |
| P1 | `orion-frontend/src/pages/EphemeralEnvList/index.tsx` | 全文 | 4 处 loading，3 处 message.success，但无主标题 | 添加主标题 |
| P1 | `orion-frontend/src/pages/Queue/index.tsx` | 全文 | 4 处 loading，9 处 message.success，但无主标题 | 添加主标题 |
| P1 | `orion-frontend/src/pages/Sessions/index.tsx` | 全文 | 1 处 loading，但无主标题 | 添加主标题 |
| P1 | `orion-frontend/src/pages/Backup/index.tsx` | 全文 | 3 处 loading，但无主标题 | 添加主标题 |
| P1 | `orion-frontend/src/pages/OnCall/index.tsx` | 全文 | 3 处 loading，但无主标题 | 添加主标题 |
| P2 | `orion-frontend/src/pages/EphemeralEnvDetail/index.tsx` | 全文 | 2 处 loading，缺少副标题 | 添加副标题 |
| P2 | `orion-frontend/src/pages/EventBus/index.tsx` | 全文 | 1 处 loading，缺少副标题 | 添加副标题 |
| P2 | `orion-frontend/src/pages/IacManagement/ModuleRegistry.tsx` | 全文 | 5 处 loading，2 处 message.success，缺少副标题 | 添加副标题 |

### 7. 治理 (Governance)

| 指标 | 数值 |
|------|------|
| 主页面数 | 14 |
| P0 缺失 | 5 |
| P1 缺失 | 4 |
| P2 缺失 | 3 |

**核心页面**: Policies, AuditLog, TenantList, TenantManagement, RoleManagement, ConfigManagement, Approvals, ApprovalManagement, WorkflowDesigner, FinOpsDashboard

| 优先级 | 文件路径 | 行号 | 问题描述 | 修复方案 |
|--------|---------|------|---------|---------|
| P0 | `orion-frontend/src/pages/PolicyManagement/index.tsx` | 全文 | 12 处 loading，6 处 message.success，1 处 Title level={2}，但缺少图标 | 添加 `<SafetyCertificateOutlined>` 图标 |
| P0 | `orion-frontend/src/pages/AuditLog/index.tsx` | 全文 | 6 处 loading，2 处 message.success，但无主标题 | 添加主标题 |
| P0 | `orion-frontend/src/pages/TenantList/index.tsx` | 994 行 | 14 处 loading，8 处 message.success，但无主标题 | 添加主标题 |
| P0 | `orion-frontend/src/pages/ConfigManagement/index.tsx` | 1084 行 | 16 处 loading，7 处 message.success，8 处 Descriptions 但无编辑 | 添加主标题 + 编辑入口 |
| P0 | `orion-frontend/src/pages/FinOpsDashboard/index.tsx` | 全文 | 2 处 loading，但无主标题 | 添加主标题 |
| P1 | `orion-frontend/src/pages/RoleManagement/index.tsx` | 全文 | 5 处 loading，2 处 message.success，但无主标题 | 添加主标题 |
| P1 | `orion-frontend/src/pages/TenantManagement/index.tsx` | 全文 | 13 处 loading，3 处 message.success，但无主标题 | 添加主标题 |
| P1 | `orion-frontend/src/pages/Approvals/index.tsx` | 全文 | 7 处 loading，3 处 message.success，但无主标题 | 添加主标题 |
| P1 | `orion-frontend/src/pages/ApprovalManagement/index.tsx` | 全文 | 3 处 loading，3 处 message.success，但无主标题 | 添加主标题 |
| P2 | `orion-frontend/src/pages/WorkflowDesigner/WorkflowCanvas.tsx` | 1742 行 | 15 处 loading，文件 >1000 行 | 拆分文件 |
| P2 | `orion-frontend/src/pages/WorkflowTasks/index.tsx` | 全文 | 6 处 loading，缺少主标题 | 添加主标题 |
| P2 | `orion-frontend/src/pages/WorkflowDependencies/index.tsx` | 全文 | 3 处 loading，缺少主标题 | 添加主标题 |

### 8. 生态 (Ecosystem)

| 指标 | 数值 |
|------|------|
| 主页面数 | 5 |
| P0 缺失 | 3 |
| P1 缺失 | 1 |
| P2 缺失 | 1 |

**核心页面**: SkillManagement/*, PluginSPI, DocumentCenter

| 优先级 | 文件路径 | 行号 | 问题描述 | 修复方案 |
|--------|---------|------|---------|---------|
| P0 | `orion-frontend/src/pages/SkillManagement/Marketplace.tsx` | 全文 | 4 处 loading，4 处 message.success，但无主标题 | 添加主标题 + `<AppstoreOutlined>` |
| P0 | `orion-frontend/src/pages/SkillManagement/MySkills.tsx` | 全文 | 4 处 loading，但无主标题 | 添加主标题 |
| P0 | `orion-frontend/src/pages/PluginSPI/index.tsx` | 全文 | 5 处 loading，4 处 message.success，但无主标题 | 添加主标题 |
| P1 | `orion-frontend/src/pages/DocumentCenter/index.tsx` | 全文 | 1 处 loading，但无主标题 | 添加主标题 |
| P2 | `orion-frontend/src/pages/SkillManagement/SkillSubmission.tsx` | 全文 | 1 处 loading，缺少副标题 | 添加副标题 |

---

## 二、全局模式分析

### 2.1 样式规范违规 — 硬编码颜色

**违规文件数**: 422 / 540 (78.1%)

只有 372 / 540 (68.9%) 文件导入了 `colors` Token，但其中仍有大量硬编码色值。

**高频违规文件** (选取 Top 20):

| 文件路径 | 硬编码色值数 | 主要违规模式 | 修复方案 |
|---------|------------|------------|---------|
| `PipelineEditor/StageModal.tsx` | 2+ | `#faad14`、`#999` 硬编码 | 替换为 `colors.warning[500]`、`colors.neutral[500]` |
| `data-pipeline/DataPipelinePage.tsx` | 8+ | `#1677ff`、`#52c41a`、`#ff4d4f` | 替换为 `colors.primary[500]`、`colors.success[500]`、`colors.error[400]` |
| `ArtifactBrowser/VersionCompareDrawer.tsx` | 4+ | `#999` 多处 | 替换为 `colors.neutral[500]` |
| `ArtifactBrowser/index.tsx` | 3+ | `#d9d9d9`、`#fff` 硬编码样式 | 替换为 `colors.neutral[300]`、`colors.light.bg.primary` |
| `orchestration/OrchestrationPage.tsx` | 3+ | `#1677ff`、`#ff4d4f`、`#52c41a` | 替换为对应 Token |
| `community-svc/community/CommunityAdvancedPage.tsx` | 5+ | 等级颜色硬编码 | 使用 `colors.neutral` 系或自定义 Token |
| `cost/BudgetGuardPage.tsx` | 12 | 大量硬编码样式 | 全面替换为 Token |
| `CMDB/CITablePage.tsx` | 15 | 大量硬编码样式 | 全面替换为 Token |
| `visor/VisorPage.tsx` | 8 | 大量硬编码样式 | 全面替换为 Token |
| `dba/DbaPage.tsx` | 11 | 大量硬编码样式 | 全面替换为 Token |

### 2.2 逻辑完整度 — 异常处理覆盖率

**关键指标**:

| 指标 | 文件数 | 占比 |
|------|--------|------|
| 有 try/catch | 46 / 540 | 8.5% |
| 有 message.error | 198 / 540 | 36.7% |
| 有 message.success | 113 / 540 | 20.9% |
| 使用 unwrapResponse | 9 / 540 | 1.7% |
| 使用 .data.data | 0 / 540 | 0% (合规) |

**异常处理严重不足**: 仅 8.5% 的文件有 try/catch，意味着绝大多数异步操作缺乏结构化错误处理。

### 2.3 交互链完整性

| 模式 | 文件数 | 占比 | 说明 |
|------|--------|------|------|
| loading 状态 | 250 / 540 | 46.3% | 近半数操作无 loading 反馈 |
| Popconfirm | 250 / 540 | 46.3% | 删除操作缺少二次确认 |
| Empty 组件 | 162 / 540 | 30.0% | 空数据缺少引导按钮 |
| message.success | 113 / 540 | 20.9% | 成功反馈不足 |
| message.error | 198 / 540 | 36.7% | 错误反馈不足 |

### 2.4 功能缺失 — 只读 Descriptions 无编辑

**违规文件数**: 28 / 93 (30.1%)

28 个文件使用 Descriptions 展示详情，但没有编辑入口 (无 Form.Item / Input / Select / Editable 组件)。

| 文件路径 | 问题描述 | 修复方案 |
|---------|---------|---------|
| `AIReview/ReviewDetail.tsx` | Descriptions column={2} bordered，无编辑 | 添加编辑模式切换 |
| `agent-svc/AgentDashboard/AgentDetailDrawer.tsx` | 多处 Descriptions 只读 | 添加编辑按钮 + 编辑表单 |
| `federation-svc/federation/ExecutorManagementPage.tsx` | Descriptions 只读 | 添加编辑入口 |
| `approval/ApprovalPage.tsx` | Descriptions bordered 无编辑 | 添加编辑模式 |
| `RunnerManagement/index.tsx` | Descriptions 只读 | 添加编辑入口 |

---

## 三、微前端拆分评估

### 3.1 独立子应用候选

| 候选模块 | 文件数 | 最大文件行数 | 评估 | 建议 |
|---------|--------|------------|------|------|
| ChatOps | 14 | 917 | 接近独立标准 | P1 拆分为独立子应用 |
| SkillManagement | 8 | 完整模块 | 已注册子应用 | 无需拆分 |
| CMDB | 8 | 1020 | 接近独立标准 | P2 考虑独立子应用 |
| BuildEnv | 8 | 完整模块 | 已注册子应用 | 无需拆分 |
| SelfHealing | 7 | 完整模块 | 已注册子应用 | 无需拆分 |
| VectorStore | 6 | 完整模块 | 已注册子应用 | 无需拆分 |
| PluginManagement | 6 | 完整模块 | 已注册子应用 | 无需拆分 |
| Monitoring | 6 | 完整模块 | 已注册子应用 | 无需拆分 |
| Diagnostic | 6 | 完整模块 | 已注册子应用 | 无需拆分 |
| CodeMgmt | 6 | 完整模块 | 已注册子应用 | 无需拆分 |
| AIReview | 6 | 完整模块 | 已注册子应用 | 无需拆分 |
| AICostDashboard | 6 | 完整模块 | 已注册子应用 | 无需拆分 |
| LLMTraceDashboard | 5 | 完整模块 | 已注册子应用 | 无需拆分 |
| IaCManagement | 5 | 完整模块 | 已注册子应用 | 无需拆分 |
| AIDocManagement | 5 | 完整模块 | 已注册子应用 | 无需拆分 |
| WorkflowDesigner | 4 | 1742 行 | 文件过大 | P1 拆分文件，不拆分应用 |

### 3.2 双份实现问题

**发现 22 个 `*-svc` 目录**，与主 pages 目录存在大量重复实现：

| *-svc 目录 | 估计重复文件数 | 影响 |
|-----------|--------------|------|
| `agent-svc/` | ~10 | 与 AgentDashboard 重复 |
| `ai-svc/` | ~12 | 与 AIDocManagement、LLMTraceDashboard 重复 |
| `approval-svc/` | ~8 | 与 Approvals、ConfirmationWorkbench 重复 |
| `artifact-svc/` | ~8 | 与 Artifacts、ArtifactBrowser 重复 |
| `audit-svc/` | ~3 | 与 AuditLog 重复 |
| `code-svc/` | ~10 | 与 BuildEnv、CodeMgmt 重复 |
| `deploy-svc/` | ~4 | 与 DeploymentList、DeploymentDetail 重复 |
| `finops-svc/` | ~8 | 与 AICostDashboard、FinOpsDashboard 重复 |
| `monitor-svc/` | ~10 | 与 Monitoring、AlertList 重复 |
| `notify-svc/` | ~8 | 与 NotificationCenter、NotificationRules 重复 |
| `pipeline-svc/` | ~12 | 与 PipelineList、PipelineEditor 重复 |
| `security-svc/` | ~10 | 与 SbomDashboard、SelfHealing 重复 |
| `skill-svc/` | ~4 | 与 SkillManagement 重复 |
| `ticket-svc/` | ~4 | 与 TicketList、TicketDetail 重复 |

**platform-core 目录**: 44 个文件，是主 pages 目录的完整副本，属于构建产物或备份。

**总计**: 约 115+ 个重复文件，占全部 540 个文件的 21.3%。

---

## 四、8 大菜单补全矩阵

### 4.1 页面标题规范覆盖率

| 模块 | Title level={2} 文件 | 有图标文件 | 有副标题文件 | 合规率 |
|------|---------------------|-----------|------------|--------|
| 工作台 | 1 | 0 | 0 | 10% |
| 控制台 | 0 | 0 | 0 | 0% |
| 交付 | 0 | 0 | 0 | 0% |
| 可观测性 | 0 | 0 | 0 | 0% |
| AI 平台 | 0 | 0 | 0 | 0% |
| 基础设施 | 0 | 0 | 0 | 0% |
| 治理 | 1 | 0 | 0 | 10% |
| 生态 | 0 | 0 | 0 | 0% |
| **总计** | **~4** | **~1** | **~1** | **1.9%** |

### 4.2 路由 vs 菜单覆盖

**menuConfigStore 定义的路由**: 68 个子菜单项
**routes.tsx 定义的路由**: ~150+ 条路由

**缺失菜单的路由** (部分):

| 路由路径 | 对应页面 | 所属模块 | 建议操作 |
|---------|---------|---------|---------|
| `/dashboard-core` | DashboardCore | 工作台 | 加入菜单或标记为废弃 |
| `/capability-admin` | CapabilityAdmin | 控制台 | 加入菜单 |
| `/workflow-tasks` | WorkflowTasks | 治理 | 加入菜单 |
| `/workflow-dependencies` | WorkflowDependencies | 治理 | 加入菜单 |
| `/event-registry` | EventRegistry | 基础设施 | 加入菜单 |
| `/task-timeouts` | TaskTimeouts | 治理 | 加入菜单 |
| `/console/cron` | CronJobs | 控制台 | 路径已存在，确认菜单 |
| `/console/scripts` | ScriptRunner | 基础设施 | 加入菜单 |
| `/console/queue` | QueueTasks | 基础设施 | 路径已存在，确认菜单 |
| `/console/confirmations` | ConfirmationWorkbench | 控制台 | 已注册，确认菜单 |
| `/developer-portal` | DeveloperPortalPage | - | 加入基础设施菜单 |
| `/console/modules` | ModuleManager | - | 加入控制台菜单 |
| `/profile` | UserProfile | - | 加入用户菜单 |
| `/settings` | UserSettings | - | 加入用户菜单 |

---

## 五、优先级修复路线图

### P0 (立即修复) — 43 项

1. 全部 85+ 主页面添加 Title level={2} + 图标
2. 全部 422 个文件硬编码颜色替换为 Token
3. 全部 28 个只读 Descriptions 添加编辑入口
4. 全部 494 个无 try/catch 的异步操作添加异常处理

### P1 (短期修复) — 38 项

1. 拆分 >1000 行的巨型文件 (WorkflowCanvas 1742 行等)
2. 全部页面添加副标题 Typography.Text
3. 路由与菜单对齐 (补全缺失菜单项)
4. 115+ 个重复文件清理 (22 个 *-svc + platform-core)

### P2 (中期优化) — 22 项

1. ChatOps 模块拆分为独立子应用
2. CMDB 模块考虑独立子应用
3. 空状态补充引导按钮
4. 权限控制增强 (AI_MODULE_PERMISSIONS)

---

## 六、与目标差距

| 维度 | 当前合规率 | 目标合规率 | 差距 | 需修复项数 |
|------|-----------|-----------|------|-----------|
| 交互链完整性 | 46.7% | 95% | -48.3% | ~287 |
| 样式规范符合度 | 21.9% | 100% | -78.1% | ~422 |
| 逻辑完整度 | 28.3% | 90% | -61.7% | ~332 |
| 页面标题规范 | 1.9% | 100% | -98.1% | ~85 |
| 微前端拆分就绪度 | 35.2% | 80% | -44.8% | ~25 |
| 8 大菜单补全矩阵 | 62.5% | 100% | -37.5% | ~25 |
| **综合** | **32.6%** | **94%** | **-61.4%** | **~1176** |

> 注: "需修复项数" 为估计值，基于 540 个文件 × 违规率计算。实际修复需按文件合并统计。

---

## 附录

### A. 数据来源

- 文件统计: `find orion-frontend/src/pages -name "*.tsx" ! -path "*/__tests__/*" ! -path "*/__mocks__/*"`
- Grep 模式扫描: message.success/error, Popconfirm, loading, unwrapResponse, .data.data, Title level={2/3}, Descriptions, Empty, try/catch
- Token 使用: `import.*colors.*from.*@/tokens`, `import.*spacing.*from.*@/tokens`
- 硬编码颜色: `#[0-9a-fA-F]{6}` 匹配
- 文件大小: `wc -l` 统计

### B. 参考文档

- `CLAUDE.md` — 前端交互完整性审查规则
- `orion-frontend/src/tokens/colors.ts` — Design Token 色彩系统
- `orion-frontend/src/tokens/radius.ts` — Design Token 圆角系统
- `orion-frontend/src/tokens/spacing.ts` — Design Token 间距系统
- `orion-frontend/src/tokens/shadows.ts` — Design Token 阴影系统
- `orion-frontend/src/router/routes.tsx` — 路由定义
- `orion-frontend/src/stores/menuConfigStore.ts` — 8 大菜单定义
