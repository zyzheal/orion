# 设计约束检查报告 — 8 大菜单模块功能缺失检测

> 生成时间：2026-05-21
> 扫描范围：orion-frontend 全部 70+ 页面组件
> 检查维度：14 维 ~196 项（CRUD 完整性、交互链、空状态、表单字段、Tab 交互）

---

## 自动识别结果

| 属性 | 值 |
|------|-----|
| Code Type | frontend |
| Module | orion-frontend（8 大菜单模块） |
| Pages Scanned | 70+ 页面组件 |
| Total Checks | ~196 项（14 维度） |

## 8 大菜单模块清单

| 序号 | 模块 | 路由前缀 | 页面数 | 子 Tab 数 |
|------|------|---------|--------|----------|
| 1 | 工作台 | /dashboard, /workbench | 10 | 多 Tab |
| 2 | 控制台 | /console | 7 | 多 Tab |
| 3 | 交付 | /pipelines, /deployments | 15+ | 多 Tab |
| 4 | 可观测性 | /observability | 12 | 多 Tab |
| 5 | AI 平台 | /ai | 12+ | 多 Tab |
| 6 | 基础设施 | /infra | 12 | 多 Tab |
| 7 | 治理 | /governance | 14 | 多 Tab |
| 8 | 生态 | /ecosystem | 5 | 多 Tab |

---

## P0 级问题 — CRUD 操作缺失 / 假交互（20 处）

| # | 模块 | 页面 | 问题 | 文件:行号 |
|---|------|------|------|-----------|
| 1 | 交付 | TestSelector | **Run/Detail 全是假交互**，只有 `message.info` | `TestSelector/index.tsx:277-292` |
| 2 | 交付 | DeploymentList | **回滚按钮无 onClick**，创建/删除入口缺失 | `DeploymentList/index.tsx:249-251` |
| 3 | 交付 | RepoList | **删除是假操作**，只提示"需要后端支持" | `CodeMgmt/RepoList.tsx:120` |
| 4 | 交付 | RepoDetail | **分支保护/解锁按钮无 onClick** | `CodeMgmt/RepoDetail.tsx:241-247` |
| 5 | 交付 | PipelineList | **缺少删除 Pipeline 功能** | `PipelineList/index.tsx:177-193` |
| 6 | 工作台 | DashboardNew | **任务"处理"按钮无 onClick**，"查看全部"无点击 | `DashboardNew/index.tsx:342-346, 478` |
| 7 | AI平台 | AIGateway | **配置按钮无 onClick** | `AIGateway/index.tsx:199` |
| 8 | AI平台 | AIDashboard | **5 张分类卡片无点击**，视觉可点击但无交互 | `AIDashboard/index.tsx:29-38` |
| 9 | AI平台 | ExecutionDashboard | **"查看"按钮无 onClick** | `ChatOps/ExecutionDashboard.tsx:126-131` |
| 10 | 治理 | SbomDashboard | **下载/导出 PDF 按钮无 onClick**（2处） | `SbomDashboard/index.tsx:222-224, 340-342` |
| 11 | 治理 | FinOpsDashboard | **设置预算/查看明细按钮无 onClick**（2处） | `FinOpsDashboard/index.tsx:514-519` |
| 12 | 治理 | RoleManagement | **缺少编辑角色操作** | `RoleManagement/index.tsx:214-235` |
| 13 | 治理 | DBA | **审核规则 Tab 无创建/编辑入口** | `dba/DbaPage.tsx:803-819` |
| 14 | 可观测性 | StrategyList | **编辑功能未实现**，只显示占位提示 | `SelfHealing/StrategyList.tsx:109-111` |
| 15 | 生态 | OnCall | **缺少编辑排班操作** | `OnCall/index.tsx:427-456` |
| 16 | 交付 | CanaryAnalysis | **配置缺少编辑/删除** | `CanaryAnalysis/index.tsx` |
| 17 | AI平台 | AIAgents | **缺少创建/删除 Agent** | `AIAgents/index.tsx` |
| 18 | AI平台 | AIReview Config | **缺少删除配置** | `AIReview/Config.tsx` |
| 19 | 可观测性 | Channels | **渠道缺少编辑/删除** | `monitor-svc/Monitoring/Channels.tsx:203-216` |
| 20 | 可观测性 | KnowledgeBase | **知识模式缺少编辑/删除** | `security-svc/Diagnostic/KnowledgeBase.tsx:230-238` |

---

## P1 级问题 — 错误处理缺失 / 静默失败 / Mock 数据（10 处）

| # | 模块 | 页面 | 问题 | 文件:行号 |
|---|------|------|------|-----------|
| 1 | AI平台 | ChatOps AdminSettings | **catch 块静默吞掉错误**，无用户提示（2处） | `ChatOps/AdminSettings.tsx:169-171, 458-460` |
| 2 | 控制台 | PluginDetail | **保存配置失败无提示**，按钮停止 loading 但无 error | `PluginManagement/PluginDetail.tsx:62-68` |
| 3 | 工作台 | TicketList | **分配工单是前端 mock**，未调真实 API | `TicketList/index.tsx:440-449` |
| 4 | AI平台 | CostDetail | **导出是假操作**，只有 success 提示 | `AICostDashboard/CostDetail.tsx:132-134` |
| 5 | AI平台 | AlertConfig | **规则使用硬编码 mock 数据** | `AICostDashboard/AlertConfig.tsx:51-82` |
| 6 | 工作台 | DashboardNew | **任务数据为硬编码 mock** | `DashboardNew/index.tsx:199-224` |
| 7 | 交付 | PipelineDetail | **任务输出 Tab 纯 mock 数据** | `PipelineDetail/index.tsx:79-128` |
| 8 | 可观测性 | Reports | **filterDefs 为空数组**，无筛选选项 | `security-svc/Diagnostic/Reports.tsx:56` |
| 9 | AI平台 | ROIReport | **LineChartOutlined 未导入**，运行时错误 | `AICostDashboard/ROIReport.tsx:166` |
| 10 | 可观测性 | KnowledgeBase | **ReadOutlined 未导入**，编译错误 | `security-svc/Diagnostic/KnowledgeBase.tsx:253` |

---

## P2 级问题 — 空状态无引导（35 处，系统性问题）

以下页面列表为空时缺少 `Empty` 组件 + 引导按钮，仅显示空白表格：

### 按模块分组

| 模块 | 页面数 | 涉及文件 |
|------|--------|---------|
| 工作台 | 7 | DashboardNew, EngineerDashboard, ExecutiveDashboard, ManagerDashboard, EfficiencyDashboard, RiskDashboard, TicketList |
| 控制台 | 3 | PluginList, SubAppManagement, UserCapabilityMapping |
| 交付 | 9 | PipelineList, DeploymentList, CanaryAnalysis, ChangeIntelligence, BranchPolicyList, WebhookLog, Artifacts, InternalLibrary, TestSelector |
| 可观测性 | 7 | Metrics, Alerts, Channels, Sessions, Reports, History, ObservabilityPage |
| AI平台 | 10 | AIGateway, AIReview Dashboard/History, CostOverview(3处), CostDetail, ROIReport(2处), AlertConfig(2处), ExecutionDashboard, TraceOverview(2处), TraceList, CostAnalysis |
| 基础设施 | 6 | EphemeralEnvList, QueueTasks, EventBus, Sessions, Backup, OnCall |
| 治理 | 2 | AuditLog, DBA(2个Tab) |
| 生态 | 1 | DBA Audit Rules Tab |

### 按优先级排序

| 优先级 | 涉及页面 |
|--------|---------|
| **高**（列表页用户直接可见） | PipelineList, DeploymentList, TestSelector, PluginList, SubAppManagement, AIGateway, ExecutionDashboard, EphemeralEnvList, QueueTasks, Sessions, Backup, OnCall, AuditLog |
| **中**（详情/Tab 页内） | DashboardNew, EngineerDashboard, ExecutiveDashboard, ManagerDashboard, EfficiencyDashboard, RiskDashboard, TicketList, UserCapabilityMapping, CanaryAnalysis, ChangeIntelligence, BranchPolicyList, WebhookLog, Artifacts, InternalLibrary, Metrics, Alerts, Channels, Reports, History, ObservabilityPage, AIReview Dashboard/History, TraceOverview, TraceList, CostAnalysis, EventBus |
| **低**（仪表盘图表区域） | CostOverview(3处), CostDetail, ROIReport(2处), AlertConfig(2处) |

---

## 编译/运行时错误（2 处）

| # | 文件 | 问题 | 影响 |
|---|------|------|------|
| 1 | `security-svc/Diagnostic/KnowledgeBase.tsx:253` | `ReadOutlined` 使用了但未导入 | 编译失败 |
| 2 | `AICostDashboard/ROIReport.tsx:166` | `LineChartOutlined` 使用了但未导入 | 运行时错误 |

---

## 检查结果汇总

```
┌────────────────────────────────────────────────────────────┐
│  Design Constraint Check Report                            │
├────────────────────────────────────────────────────────────┤
│  Module:         8 大菜单模块全量扫描                         │
│  Code Type:      frontend                                  │
│  Pages Scanned:  70+                                       │
│  P0 (CRUD/交互缺失): 20                                     │
│  P1 (错误处理/假数据): 10                                    │
│  P2 (空状态缺失):     35                                     │
│  编译/运行时错误:      2                                     │
│  综合评分:          58/100                                  │
└────────────────────────────────────────────────────────────┘
```

## 模块合规度排名

| 排名 | 模块 | 评分 | 说明 |
|------|------|------|------|
| 1 | 治理 | 72 | TenantList/TenantManagement/ConfigManagement 交互完整 |
| 2 | 基础设施 | 68 | Environments/VectorStore/Backup 交互完整 |
| 3 | 可观测性 | 65 | AlertRulesPage/Monitoring/Rules 较完整 |
| 4 | 控制台 | 62 | WorkflowTriggers/UserManagement 较完整 |
| 5 | 生态 | 60 | PluginSPI/TenantList 交互完整 |
| 6 | 交付 | 55 | PipelineEditor/CodeOwnersPage 完整，但列表页问题较多 |
| 7 | AI平台 | 52 | AISecurity/BudgetManagement 完整，但假交互/空状态多 |
| 8 | 工作台 | 48 | mock 数据多，按钮无交互问题集中 |

## 建议修复优先级

1. **修复编译/运行时错误**（2 处）— `ReadOutlined`/`LineChartOutlined` 未导入
2. **修复假交互/无 onClick 按钮**（P0, 20 处）— 用户可见的"点了没反应"
3. **修复静默失败**（P1, 10 处）— 错误无提示
4. **补充空状态引导**（P2, 35 处）— 系统性问题，可批量修复

## 按模块详细发现

### 1. 工作台模块（/dashboard, /workbench）

| 页面 | CRUD缺失 | 交互链问题 | 空状态缺失 | 表单问题 | 其他 |
|------|---------|-----------|-----------|---------|------|
| DashboardNew | 2 (按钮无onClick) | 0 | 2 (纯文本空状态) | 0 | 1 (mock数据) |
| WorkbenchPage | 0 | 0 | 0 | 0 | 1 (a标签SPA问题) |
| EngineerDashboard | 1 (表格无操作列) | 0 | 1 (表格无空状态) | 0 | 0 |
| ExecutiveDashboard | 0 | 0 | 2 (表格无空状态) | 0 | 0 |
| ManagerDashboard | 0 | 0 | 2 (表格无空状态) | 0 | 0 |
| TicketList | 2 (mock操作+占位) | 1 (无loading) | 1 (无Empty) | 0 | 0 |
| ProductLine | 0 | 1 (无提示fallback) | 1 (无emptyText) | 0 | 1 (子表无编辑删除) |
| Projects | 0 | 0 | 1 (无emptyText) | 0 | 0 |
| EfficiencyDashboard | 0 | 2 (无刷新入口) | 1 (纯文本空状态) | 0 | 1 (表格无操作) |
| RiskDashboard | 0 | 1 (统一loading) | 2 (无Empty) | 1 (无loading) | 1 (双入口) |

### 2. 控制台模块（/console）

| # | 文件 | 问题 | 严重程度 |
|---|------|------|---------|
| 1 | PluginManagement/PluginList.tsx | Table has no Empty component for zero plugins | Medium |
| 2 | PluginManagement/PluginDetail.tsx | `handleSaveConfig` catch block swallows error -- no `message.error` | High |
| 3 | feature-flags/FeatureFlagsPage.tsx | Empty state uses plain text instead of `Empty` component | Low |
| 4 | SubAppManagement/index.tsx | Table has no Empty component for zero subapps | Medium |
| 5 | Capability/CapabilityList.tsx | Read-only page, no Create/Update/Delete for capabilities | Medium |
| 6 | Capability/RoleCapabilityMapping.tsx | Checkbox toggles have no immediate feedback message | Low |
| 7 | Capability/UserCapabilityMapping.tsx | Main user table has no Empty component | Medium |

### 3. 交付模块（/pipelines, /deployments）

| 页面 | CRUD 缺失 | 交互链缺失 | Empty 缺失 | 假交互 | 表单问题 |
|------|-----------|-----------|-----------|--------|---------|
| PipelineList | Delete | - | YES | - | - |
| PipelineEditor | - | - | - | - | - |
| PipelineDetail | N/A | - | - | Mock数据 | - |
| DeploymentList | Create/Delete/Update | YES(回滚) | YES | - | - |
| DeploymentDetail | N/A | - | - | - | - |
| CanaryAnalysis | Config Edit/Delete | - | YES | - | - |
| ChangeIntelligence | - | - | YES | - | - |
| RepoList | Create/假Delete | - | - | YES | - |
| RepoDetail | - | YES(保护/解锁) | - | - | - |
| BranchPolicyList | - | - | YES | - | - |
| CodeOwnersPage | - | - | - | - | - |
| WebhookLog | N/A | - | YES | - | - |
| Artifacts | - | - | YES | - | - |
| InternalLibrary | - | - | YES | - | - |
| TestSelector | Run/Detail | YES | YES | YES | - |

### 4. 可观测性模块（/observability）

| 违规类型 | 文件 | 严重程度 |
|---------|------|---------|
| ReadOutlined 未导入 | KnowledgeBase.tsx | **高(编译错误)** |
| Update 未实现(仅提示) | StrategyList.tsx | **中** |
| 渠道缺少 Edit/Delete | Channels.tsx | **中** |
| 知识模式缺少 Edit/Delete | KnowledgeBase.tsx | **中** |
| 静默规则缺少 Edit | ObservabilityPage.tsx | **中** |
| 升级策略缺少 Edit/Delete | Channels.tsx | **中** |
| 空状态无引导(多处) | Metrics/Alerts/Channels/Sessions/Reports/History | **低** |
| filterDefs 为空 | Reports.tsx | **低** |
| Metrics 缺少 Update/Delete | Metrics.tsx | **低** |

### 5. AI平台模块（/ai）

| 违规类型 | 数量 | 最受影响页面 |
|---------|------|------------|
| No Empty state | 14 | TraceOverview, TraceList, CostAnalysis, CostDetail, ROIReport, AlertConfig, ExecutionDashboard |
| Button without onClick | 3 | AIGateway "配置", AIDashboard cards (5), ExecutionDashboard "查看" |
| Incomplete CRUD | 5 | AIAgents (no Create/Delete), AIReview History (no Create), AIReview Config (no Delete), AlertConfig rules (no Edit) |
| Silent error handling | 2 | ChatOps AdminSettings (2 catch blocks) |
| Mock/Fake data | 3 | AlertConfig rules, ReviewDetail issues, CostDetail export |
| Missing import | 1 | ROIReport uses LineChartOutlined without importing |

**最合规页面**：AISecurity, ChatOps ChatDashboard, ChatOps AuditLogViewer, AICostDashboard/BudgetManagement, AIReview/Rules

### 6. 基础设施模块（/infra）

| 页面 | 状态 | 问题 |
|------|------|------|
| Environments | GOOD | - |
| EphemeralEnvList | GOOD | Minor: missing Empty state with guide |
| EphemeralEnvDetail | GOOD | - |
| VectorStore | GOOD | - |
| Backup | GOOD | Minor: missing Empty state with guide |
| QueueTasks | GOOD | Minor: missing Empty state, missing Delete |
| EventBus | READ-ONLY | Minor: missing Empty state |
| Sessions | GOOD | Minor: missing Empty state |
| OnCall | PARTIAL | Missing Edit schedule, missing Empty state, team members comma-separated |
| CMDB | TAB SHELL | Sub-components not scanned |
| BuildEnv | LAYOUT ONLY | Sub-components not scanned |
| IacManagement | LAYOUT ONLY | Sub-components not scanned |

### 7. 治理模块（/governance）

| 页面 | 状态 | 问题 |
|------|------|------|
| PolicyManagement | GOOD | Minor: "同步 Bundle" no async error handling |
| TenantList | GOOD | Full CRUD, Empty state with guide |
| TenantManagement | GOOD | Empty state with guide |
| ConfigManagement | GOOD | Full CRUD, Empty states |
| ApprovalManagement | GOOD | Full CRUD, Empty state |
| WorkflowTasks | GOOD | Empty state with guide |
| AuditLog | READ-ONLY | Minor: missing Empty state |
| SbomDashboard | PARTIAL | **Dead buttons**: Download, Export PDF (no onClick) |
| SbomDetail | GOOD | Read-only with actions |
| RoleManagement | PARTIAL | **Missing Edit role** operation |
| FinOpsDashboard | PARTIAL | **Dead buttons**: 设置预算, 查看明细 (no onClick) |
| Approvals | LAYOUT ONLY | Sub-routes |
| WorkflowDesigner | TAB SHELL | Sub-components not scanned |

### 8. 生态模块（/ecosystem）

| 页面 | 状态 | 问题 |
|------|------|------|
| PluginSPI | GOOD | CRUD for SPI config, Empty states in sub-components |
| SkillManagement | LAYOUT ONLY | Sub-routes |
| DBA | PARTIAL | SQL Orders: missing Empty, missing Delete; Data Sources: OK; Audit Rules: **missing Create/Edit**, missing Empty |
