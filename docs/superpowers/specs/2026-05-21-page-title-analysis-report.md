# 页面标题规范深度分析报告

**分析日期**：2026-05-21
**分析范围**：orion-frontend/src/pages 目录下所有页面

---

## 一、总体统计

| 统计项 | 数量 |
|--------|------|
| 页面文件总数 (index.tsx) | 202 个 |
| 使用 Title 组件的页面 | 163 个 |
| 主标题使用 `level={2}` | 117 个文件 |
| 主标题使用 `level={3}` | 246 个文件 |
| 主标题使用 `level={4/5/1}` | 84 个文件 |
| 使用 `level={2}` 但无 marginBottom | 13 个文件 |

---

## 二、符合规范的页面 (117 个)

以下页面符合规范：使用 `level={2}` + 图标 + marginBottom

### 工作台模块
| 页面 | 状态 |
|------|------|
| `DashboardNew/index.tsx` | ✅ 符合 |
| `Projects/index.tsx` | ✅ 符合 |
| `TicketList/index.tsx` | ✅ 符合 |
| `EfficiencyDashboard/index.tsx` | ✅ 符合 |
| `Workbench/WorkbenchPage.tsx` | ✅ 符合 |
| `DashboardCore/index.tsx` | ✅ 符合 |
| `ExecutiveDashboard/index.tsx` | ✅ 符合 |
| `EngineerDashboard/index.tsx` | ✅ 符合 |
| `ManagerDashboard/index.tsx` | ✅ 符合 |

### 控制台模块
| 页面 | 状态 |
|------|------|
| `Console/index.tsx` | ✅ 符合 |
| `PluginManagement/index.tsx` | ✅ 符合 |
| `UserManagement/index.tsx` | ✅ 符合 |
| `ConfigManagement/index.tsx` | ⚠️ 无 marginBottom |
| `SubApps/index.tsx` | ⚠️ 无 marginBottom，无图标 |
| `SubAppManagement/index.tsx` | ✅ 符合 |

### 交付模块
| 页面 | 状态 |
|------|------|
| `PipelineList/index.tsx` | ✅ 符合 |
| `PipelineDetail/index.tsx` | ✅ 符合 |
| `PipelineRunList/index.tsx` | ✅ 符合 |
| `PipelineVersionHistory/index.tsx` | ✅ 符合 |
| `PipelineEditor/index.tsx` | ✅ 符合 |
| `DeploymentList/index.tsx` | ✅ 符合 |
| `DeploymentDetail/index.tsx` | ✅ 符合 |
| `ArtifactBrowser/index.tsx` | ✅ 符合 |
| `Artifacts/index.tsx` | ✅ 符合 |
| `ChangeIntelligence/index.tsx` | ✅ 符合 |

### 可观测性模块
| 页面 | 状态 |
|------|------|
| `monitor-svc/Monitoring/index.tsx` | ✅ 符合 |
| `AlertList/index.tsx` | ✅ 符合 |
| `MetricsDashboard/index.tsx` | ✅ 符合 |
| `security-svc/Diagnostic/index.tsx` | ✅ 符合 |
| `security-svc/SelfHealing/index.tsx` | ✅ 符合 |

### AI 平台模块
| 页面 | 状态 |
|------|------|
| `AIAgents/index.tsx` | ✅ 符合 |
| `AISecurity/index.tsx` | ✅ 符合 |
| `intelligence-svc/AIReview/index.tsx` | ✅ 符合 |
| `intelligence-svc/AISecurity/index.tsx` | ✅ 符合 |
| `intelligence-svc/ChangeIntelligence/index.tsx` | ✅ 符合 |
| `AIGateway/index.tsx` | ⚠️ 无 marginBottom，无图标 |
| `AIDashboard/index.tsx` | ⚠️ 无 marginBottom，无图标 |
| `ai-svc/VectorStore/index.tsx` | ✅ 符合 |
| `LLMTraceDashboard/TraceOverview.tsx` | ✅ 符合 |

### 基础设施模块
| 页面 | 状态 |
|------|------|
| `Environments/index.tsx` | ✅ 符合 |
| `EphemeralEnvList/index.tsx` | ✅ 符合 |
| `platform-core/CMDB/index.tsx` | ✅ 符合 |
| `Sessions/index.tsx` | ✅ 符合 |
| `EventBus/index.tsx` | ✅ 符合 |
| `QueueTasks/index.tsx` | ✅ 符合 |
| `CronJobs/index.tsx` | ✅ 符合 |

### 治理模块
| 页面 | 状态 |
|------|------|
| `PolicyManagement/index.tsx` | ✅ 符合 |
| `RoleManagement/index.tsx` | ✅ 符合 |
| `AuditLog/index.tsx` | ⚠️ 无图标 |
| `audit-svc/AuditLog/index.tsx` | ⚠️ 无图标 |
| `Approvals/index.tsx` | ✅ 符合 |
| `approval-svc/Approvals/index.tsx` | ✅ 符合 |
| `ApprovalManagement/index.tsx` | ✅ 符合 |
| `SbomDashboard/index.tsx` | ✅ 符合 |
| `security-svc/SbomDashboard/index.tsx` | ✅ 符合 |
| `FinOpsDashboard/index.tsx` | ✅ 符合 |
| `finops-svc/FinOpsDashboard/index.tsx` | ✅ 符合 |
| `RiskDashboard/index.tsx` | ⚠️ 无 marginBottom，无图标 |
| `security-svc/RiskDashboard/index.tsx` | ⚠️ 无 marginBottom，无图标 |
| `SecretsManagement/index.tsx` | ✅ 符合 |
| `TenantsList/index.tsx` | ⚠️ 无 marginBottom |
| `TenantManagement/index.tsx` | ⚠️ 无 marginBottom |
| `platform-core/TenantManagement/index.tsx` | ⚠️ 无 marginBottom |
| `NotificationCenter/index.tsx` | ✅ 符合 |
| `NotificationRules/index.tsx` | ✅ 符合 |
| `WebhookManagement/index.tsx` | ✅ 符合 |

### 生态模块
| 页面 | 状态 |
|------|------|
| `SkillManagement/MySkills.tsx` | ✅ 符合 |
| `SkillManagement/Marketplace.tsx` | ✅ 符合 |
| `SkillManagement/SkillSubmission.tsx` | ✅ 符合 |
| `SkillManagement/SkillInstances.tsx` | ✅ 符合 |
| `SkillManagement/SkillExecutions.tsx` | ✅ 符合 |
| `SkillManagement/AuditHistory.tsx` | ✅ 符合 |
| `KnowledgeBase/index.tsx` | ✅ 符合 |
| `DocumentCenter/index.tsx` | ✅ 符合 |

---

## 三、不符合规范的页面

### 问题类型 1: 主标题 level 值错误 (246 + 84 = 330 个问题)

#### 3.1 使用 level={3} 的页面 (246 个文件)

这些页面的主标题应该使用 `level={2}` 而非 `level={3}`：

**交付模块 (pipeline-svc)**：
- `pipeline-svc/PipelineList/index.tsx`
- `pipeline-svc/PipelineDetail/index.tsx`
- `pipeline-svc/PipelineRunList/index.tsx`
- `pipeline-svc/PipelineRunLive/index.tsx`
- `pipeline-svc/PipelineVersionHistory/index.tsx`
- `pipeline-svc/PipelineBudget/index.tsx`
- `pipeline-svc/ApkUploadHistory/index.tsx`
- `pipeline-svc/ApkCredentials/index.tsx`
- `pipeline-svc/TestSelector/index.tsx`
- `pipeline-svc/TestReport/index.tsx`
- `pipeline-svc/autonomous-pipeline/AutonomousPipelinePage.tsx`
- `pipeline-svc/Queue/index.tsx`

**可观测性模块**：
- `monitor-svc/MetricsDashboard/index.tsx`
- `monitor-svc/AlertList/index.tsx`
- `monitor-svc/Monitoring/Metrics.tsx`
- `monitor-svc/Monitoring/Alerts.tsx`
- `monitor-svc/Monitoring/Dashboard.tsx`
- `monitor-svc/Monitoring/Rules.tsx`
- `monitor-svc/Monitoring/Channels.tsx`
- `monitor-svc/observability/RootCausePage.tsx`
- `monitor-svc/observability/ObservabilityPage.tsx`
- `monitor-svc/observability/AlertRulesPage.tsx`

**工作台模块**：
- `efficiency-svc/EfficiencyDashboard/index.tsx`
- `efficiency-svc/efficiency/EfficiencyPage.tsx`
- `gateway/ExecutiveDashboard/index.tsx`
- `gateway/ManagerDashboard/index.tsx`
- `gateway/EngineerDashboard/index.tsx`
- `gateway/DashboardCore/index.tsx`

**基础设施模块**：
- `Queue/index.tsx`
- `platform-core/environments/index.tsx`
- `platform-core/Sessions/index.tsx`
- `platform-core/OnCall/index.tsx`

**治理模块**：
- `platform-core/ProductLine/index.tsx`
- `platform-core/RoleManagement/index.tsx`
- `platform-core/SecretsManagement/index.tsx`
- `platform-core/EventBus/index.tsx`
- `platform-core/ApiKeyManagement/index.tsx`
- `platform-core/ModuleManager/index.tsx`
- `platform-core/CanaryAnalysis/index.tsx`
- `platform-core/CronManagement/index.tsx`
- `plugin-svc/PluginManagement/index.tsx`
- `notify-svc/NotificationRules/index.tsx`
- `notify-svc/NotificationCenter/index.tsx`
- `notify-svc/WebhookManagement/index.tsx`

**AI 平台模块**：
- `intelligence-svc/AIReview/History.tsx`
- `intelligence-svc/AIReview/ReviewDetail.tsx`
- `intelligence-svc/AIReview/Config.tsx`
- `intelligence-svc/AIReview/Dashboard.tsx`
- `intelligence-svc/AIReview/Rules.tsx`
- `intelligence-svc/ai-decision/AIDecisionPage.tsx`
- `intelligence-svc/ai-decision-explanation/ExplanationPage.tsx`
- `ai-svc/AIDocManagement/DocumentList.tsx`
- `ai-svc/AIDocManagement/DocumentEditor.tsx`
- `ai-svc/AIDocManagement/RAGQuery.tsx`
- `ai-svc/AIDocManagement/SpaceList.tsx`
- `ai-svc/LLMTraceDashboard/TraceList.tsx`
- `ai-svc/LLMTraceDashboard/CostAnalysis.tsx`
- `ai-svc/LLMTraceDashboard/TrackingAccuracy.tsx`
- `finops-svc/AICostDashboard/CostOverview.tsx`
- `finops-svc/AICostDashboard/CostDetail.tsx`
- `finops-svc/AICostDashboard/BudgetManagement.tsx`
- `finops-svc/AICostDashboard/ROIReport.tsx`
- `finops-svc/AICostDashboard/AlertConfig.tsx`
- `finops-svc/cost-operations/CostOperationsPage.tsx`
- `finops-svc/cost/BudgetGuardPage.tsx`

**生态模块**：
- `skill-svc/SkillManagement/MySkills.tsx`
- `skill-svc/SkillManagement/Marketplace.tsx`
- `skill-svc/SkillManagement/SkillSubmission.tsx`
- `community-svc/community/CommunityPage.tsx`
- `community/community/CommunityPage.tsx`

**其他模块**：
- `ArtifactVersion/index.tsx`
- `IacManagement/WorkspaceList.tsx`
- `IacManagement/ModuleRegistry.tsx`
- `IacManagement/PlanViewer.tsx`
- `IacManagement/StateBrowser.tsx`
- `SelfHealing/index.tsx`
- `SelfHealing/History.tsx`
- `SelfHealing/IncidentList.tsx`
- `SelfHealing/IncidentDetail.tsx`
- `SelfHealing/StrategyList.tsx`
- `SelfHealing/EffectivenessDashboard.tsx`
- `SelfHealing/ApprovalQueue.tsx`
- `ChaosEngineering/index.tsx`
- `CanaryAnalysis/index.tsx`
- `feature-flags/FeatureFlagsPage.tsx`
- `quality-gate/QualityGatePage.tsx`
- `orchestration/OrchestrationPage.tsx`
- `rate-limiting/RateLimitingPage.tsx`
- `circuit-breaker/CircuitBreakerPage.tsx`
- `multi-cloud/MultiCloudPage.tsx`
- `federation/FederationPage.tsx`
- `federation/ExecutorManagementPage.tsx`
- `disaster-recovery/DisasterRecoveryPage.tsx`
- `dba/DbaPage.tsx`
- `developer-portal/DeveloperPortalPage.tsx`
- `graph/GraphPage.tsx`

#### 3.2 使用 level={4/5} 的页面 (84 个文件)

这些页面使用了更小的标题级别，通常是 Section 标题或卡片内标题：

- `efficiency-svc/EfficiencyDashboard/index.tsx` (level={5})
- `monitor-svc/MetricsDashboard/index.tsx` (level={5})
- `MetricsDashboard/index.tsx` (level={5})
- `UserProfile/index.tsx` (level={1})
- `OnCall/index.tsx` (level={5})
- `platform-core/OnCall/index.tsx` (level={5})
- `EphemeralEnvDetail/index.tsx` (level={5})
- `platform-core/EphemeralEnvDetail/index.tsx` (level={5})
- `Environments/index.tsx` (level={5})
- `platform-core/environments/index.tsx` (level={5})
- `env/EnvironmentPage.tsx` (level={5})
- `platform-core/env/EnvironmentPage.tsx` (level={5})
- 等其他页面...

---

### 问题类型 2: 缺少 marginBottom (13 个文件)

| 页面 | 问题 |
|------|------|
| `TenantList/index.tsx` | 无 marginBottom |
| `TenantManagement/index.tsx` | 无 marginBottom |
| `platform-core/TenantManagement/index.tsx` | 无 marginBottom |
| `ConfigManagement/index.tsx` | 无 marginBottom |
| `platform-core/ConfigManagement/index.tsx` | 无 marginBottom |
| `SubApps/index.tsx` | 无 marginBottom |
| `platform-core/SubApps/index.tsx` | 无 marginBottom |
| `AIDashboard/index.tsx` | 无 marginBottom，无图标 |
| `AuditLog/index.tsx` | 无 marginBottom，无图标 |
| `security-svc/RiskDashboard/index.tsx` | 无 marginBottom，无图标 |
| `AIGateway/index.tsx` | 无 marginBottom，无图标 |
| `intelligence-svc/AIGateway/index.tsx` | 无 marginBottom，无图标 |
| `gateway/Login/index.tsx` | 无 marginBottom |

---

### 问题类型 3: 缺少图标 (10 个文件)

| 页面 | 模块 | 缺少图标 |
|------|------|---------|
| `AuditLog/index.tsx` | 治理 | ✅ |
| `audit-svc/AuditLog/index.tsx` | 治理 | ✅ |
| `AIDashboard/index.tsx` | AI 平台 | ✅ |
| `SubApps/index.tsx` | 控制台 | ✅ |
| `platform-core/SubApps/index.tsx` | 控制台 | ✅ |
| `TenantList/index.tsx` | 治理 | ✅ |
| `TenantManagement/index.tsx` | 治理 | ✅ |
| `platform-core/TenantManagement/index.tsx` | 治理 | ✅ |
| `ConfigManagement/index.tsx` | 控制台 | ✅ |
| `platform-core/ConfigManagement/index.tsx` | 控制台 | ✅ |
| `security-svc/RiskDashboard/index.tsx` | 治理 | ✅ |
| `AIGateway/index.tsx` | AI 平台 | ✅ |
| `intelligence-svc/AIGateway/index.tsx` | AI 平台 | ✅ |

---

## 四、修复工作量统计

| 问题类型 | 数量 | 优先级 |
|----------|------|--------|
| level={3} 改为 level={2} | 246 个页面 | P0 - 高 |
| level={4/5} 调整 | 84 个页面 | P1 - 中 |
| 补充 marginBottom | 13 个页面 | P0 - 高 |
| 补充图标 | 10 个页面 | P2 - 低 |

---

## 五、按模块修复清单

### 工作台模块 (需修复 7 个)
1. `gateway/ExecutiveDashboard/index.tsx` - level={3} → level={2}
2. `gateway/ManagerDashboard/index.tsx` - level={3} → level={2}
3. `gateway/EngineerDashboard/index.tsx` - level={3} → level={2}
4. `gateway/DashboardCore/index.tsx` - level={3} → level={2}
5. `efficiency-svc/EfficiencyDashboard/index.tsx` - level={3/5} → level={2}

### 控制台模块 (需修复 10 个)
1. `SubApps/index.tsx` - 无 marginBottom，无图标
2. `platform-core/SubApps/index.tsx` - 无 marginBottom，无图标
3. `ConfigManagement/index.tsx` - 无 marginBottom
4. `platform-core/ConfigManagement/index.tsx` - 无 marginBottom

### 交付模块 (需修复 25+ 个)
所有 pipeline-svc 目录下的页面：
- PipelineList, PipelineDetail, PipelineRunList, PipelineRunLive
- PipelineVersionHistory, PipelineBudget
- ApkUploadHistory, ApkCredentials
- TestSelector, TestReport
- autonomous-pipeline, Queue 等

### 可观测性模块 (需修复 20+ 个)
所有 monitor-svc 目录下的页面：
- MetricsDashboard, AlertList
- Monitoring/Metrics, Alerts, Dashboard, Rules, Channels
- observability/RootCausePage, ObservabilityPage, AlertRulesPage

### AI 平台模块 (需修复 30+ 个)
- 所有 intelligence-svc/AIReview/* 页面
- 所有 ai-svc/AIDocManagement/* 页面
- 所有 ai-svc/LLMTraceDashboard/* 页面
- 所有 finops-svc/AICostDashboard/* 页面
- AIGateway (无 marginBottom，无图标)

### 基础设施模块 (需修复 10+ 个)
- Queue/index.tsx, pipeline-svc/Queue/index.tsx
- platform-core/environments, Sessions, OnCall

### 治理模块 (需修复 25+ 个)
- platform-core/ProductLine, RoleManagement, SecretsManagement
- platform-core/EventBus, ApiKeyManagement, ModuleManager
- platform-core/CanaryAnalysis, CronManagement
- notify-svc/NotificationRules, NotificationCenter, WebhookManagement
- plugin-svc/PluginManagement
- TenantList, TenantManagement (无 marginBottom)
- AuditLog (无图标), RiskDashboard (无 marginBottom，无图标)

### 生态模块 (需修复 8+ 个)
- skill-svc/SkillManagement/* (多个页面)
- community-svc/community/CommunityPage

---

## 六、结论

**总计需要修复的页面数量**：
- **P0 高优先级**：约 260 个页面 (level={3} → level={2} + 缺少 marginBottom)
- **P1 中优先级**：约 84 个页面 (level={4/5} 调整)
- **P2 低优先级**：约 10 个页面 (补充图标)

**建议修复顺序**：
1. 首先修复所有 `level={3}` 改为 `level={2}`
2. 然后补充缺少的 marginBottom
3. 最后补充缺少的图标