# Orion 逻辑完整度与功能缺失扫描报告

> 扫描时间: 2026-05-22
> 扫描范围: orion-frontend/src/pages/ + src/api/ + orion-platform-service/src/api/
> 规范来源: CLAUDE.md CRUD 规范 + Orion统一规范汇总.md

## 一、全局统计

| 指标 | 数量 |
|------|------|
| 扫描页面数 | 541 (.tsx 文件，不含 __tests__/) |
| 有效业务页面 | ~350 (去除重复/网关/测试 mock/辅助组件) |
| API 客户端文件 | 122 |
| 后端路由文件 | 100 |
| 已对接 API 的页面 | 224 (41%) |
| 未对接 API 的页面 | 317 (59%) |
| CRUD 完整 (C/R/U/D 均有) | ~12 (如 TenantList) |
| CRUD 缺失 Create | ~50 |
| CRUD 缺失 Update | ~120 |
| CRUD 缺失 Delete | ~80 |
| API 断链 (前端调后端无对应路由) | ~15 |
| .data.data 双层嵌套 | 198 文件, 411 处 |
| setTimeout Mock 逻辑 | 2 处 (TicketList/CreateTicketModal 双份) |
| "开发中" 占位 | 6 处 |
| 空 catch 块 | 1 处 (ChatOps/index.chat.tsx:57) |
| Mock 数据 (非测试文件) | 30+ 页面 |
| 功能缺失总数 | 28+ |

## 二、按模块详细报告

### 工单管理 (tickets)

| 页面 | 数据实体 | Create | Read | Update | Delete | CRUD率 | API断链 | Mock | 功能缺失数 |
|------|---------|--------|------|--------|--------|--------|---------|------|-----------|
| TicketList | Ticket | ✅ | ✅ | ❌ | ❌ | 50% | 否 | 1 | 4 |
| TicketDetail | Ticket | — | ✅ | 部分 | ❌ | 40% | 否 | 0 | 2 |

#### 逻辑问题清单

**页面: orion-frontend/src/pages/TicketList/index.tsx**
- [P0] handleAssign 仅弹 Modal.confirm，未调 assignTicket API (行440-450) — 提示"分配成功"但未调用后端
- [P0] CreateTicketModal 用 setTimeout 模拟提交 (行124: `await new Promise(resolve => setTimeout(resolve, 1000))`)
- [P0] 报表按钮弹"报表功能开发中" (行486)
- [P1] 无编辑入口 — 表格操作列只有"详情"和"分配"，缺少"编辑"按钮
- [P1] 无删除按钮 — 表格操作列无删除操作
- [P1] .data.data 双层嵌套 (行170: `const apiData = response.data.data`)
- [P2] 无批量操作 — 表格无 rowSelection 和批量操作按钮

**页面: orion-frontend/src/pages/ticket-svc/TicketList/CreateTicketModal.tsx**
- [P0] 同上 setTimeout Mock (行124)
- [P1] catch 块内仅注释 `// Form validation error` (行132)

**页面: orion-frontend/src/pages/TicketDetail/index.tsx**
- [P1] 右侧栏"基本信息"全部为 Descriptions 只读，无编辑入口 (行630-650)
- [P1] 无状态变更 API 调用 (如从 open → in-progress)
- [P2] 无删除工单入口

#### 功能缺失清单

**工单管理**
- [P0] 创建工单使用 setTimeout Mock，未对接 createTicket API
- [P0] 分配工单仅弹确认框，未调 assignTicket API (TicketList)
- [P1] 工单列表无编辑/删除操作
- [P1] 工单详情页基本信息只读，无法修改分类/优先级等字段
- [P2] 报表功能弹"开发中"
- [P2] 无批量操作

---

### 租户管理 (tenants)

| 页面 | 数据实体 | Create | Read | Update | Delete | CRUD率 | API断链 | Mock | 功能缺失数 |
|------|---------|--------|------|--------|--------|--------|---------|------|-----------|
| TenantList | Tenant | ✅ | ✅ | ✅ | ✅ | 100% | 否 | 0 | 2 |

#### 逻辑问题清单

**页面: orion-frontend/src/pages/TenantList/index.tsx**
- [P1] (res.data as any)?.data 类型断言 (行153, 195, 373)
- [P2] 子租户管理弹"功能开发中" (行464)
- [P2] 租户设置弹"功能开发中" (行475)

#### 功能缺失清单

**租户管理**
- [P2] 子租户管理功能开发中
- [P2] 租户设置功能开发中

---

### 角色能力 (capability)

| 页面 | 数据实体 | Create | Read | Update | Delete | CRUD率 | API断链 | Mock | 功能缺失数 |
|------|---------|--------|------|--------|--------|--------|---------|------|-----------|
| RoleCapabilityMapping | Role/Capability | ❌ | ✅ | 部分 | ❌ | 25% | 是 | 2 | 4 |

#### 逻辑问题清单

**页面: orion-frontend/src/pages/Capability/RoleCapabilityMapping.tsx**
- [P0] handleSave 用 setTimeout 模拟保存 (行361-365)
- [P0] mockRoles/mockCapabilities 全部使用硬编码 Mock 数据 (行69-155)
- [P1] 导出矩阵弹"导出功能开发中" (行377)
- [P1] 无创建角色/能力入口
- [P1] 无删除角色/能力入口

#### 功能缺失清单

**角色能力**
- [P0] 保存操作完全使用 Mock (setTimeout)，未对接后端 API
- [P0] 角色和能力数据全部硬编码，未从 API 加载
- [P1] 导出功能开发中
- [P1] 无创建/删除角色和能力的入口

---

### 缓存管理 (cache)

| 页面 | 数据实体 | Create | Read | Update | Delete | CRUD率 | API断链 | Mock | 功能缺失数 |
|------|---------|--------|------|--------|--------|--------|---------|------|-----------|
| CacheConfigPage | CacheStrategy | 部分 | ✅ | 部分 | 部分 | 60% | 否 | 3 | 1 |

#### 逻辑问题清单

**页面: orion-frontend/src/pages/pipeline-svc/cache/CacheConfigPage.tsx**
- [P0] handleDelete catch 内用本地状态模拟删除 (行361-364: `setStrategies(prev => prev.filter(...))`)
- [P0] handleSave catch 内用本地状态模拟创建/更新 (行378-406)
- [P1] 删除/创建/更新均有 try→catch-fallback 的 Mock 降级逻辑

#### 功能缺失清单

**缓存管理**
- [P0] 创建/更新/删除操作均在 catch 中降级为本地 Mock 状态修改

---

### 制品管理 (artifacts)

| 页面 | 数据实体 | Create | Read | Update | Delete | CRUD率 | API断链 | Mock | 功能缺失数 |
|------|---------|--------|------|--------|--------|--------|---------|------|-----------|
| ArtifactBrowser | ArtifactVersion | ❌ | ✅ | ❌ | ❌ | 25% | 否 | 1 | 3 |
| Artifacts | Artifact | ❌ | ✅ | ❌ | ❌ | 25% | 否 | 0 | 3 |
| ArtifactVersion | ArtifactVersion | ❌ | ✅ | ❌ | ❌ | 25% | 否 | 0 | 3 |

#### 逻辑问题清单

**页面: orion-frontend/src/pages/ArtifactBrowser/index.tsx**
- [P0] deployVersion catch 内 Mock 成功提示 (行287-289: `// Mock success for demo`)
- [P1] 无创建/编辑/删除版本入口

#### 功能缺失清单

**制品管理**
- [P0] 部署操作在 API 失败时降级为 Mock 提示
- [P1] 制品浏览器仅有查看功能，无创建/编辑/删除
- [P1] 制品版本列表无批量操作

---

### 部署管理 (deployments)

| 页面 | 数据实体 | Create | Read | Update | Delete | CRUD率 | API断链 | Mock | 功能缺失数 |
|------|---------|--------|------|--------|--------|--------|---------|------|-----------|
| DeploymentDetail | Deployment | — | ✅ | ❌ | ❌ | 25% | 否 | 0 | 1 |
| DeploymentList | Deployment | — | ✅ | ❌ | ❌ | 25% | 否 | 0 | 1 |

#### 逻辑问题清单

**页面: orion-frontend/src/pages/DeploymentDetail/index.tsx**
- [P1] 详情信息全部为 Descriptions 只读 (行230-282)，无可编辑字段
- [P2] 仅支持回滚操作，无重试/取消等额外操作

#### 功能缺失清单

**部署管理**
- [P1] 部署详情页全部只读，无可编辑字段
- [P2] 部署列表无批量操作

---

### AI 成本管理 (AICostDashboard)

| 页面 | 数据实体 | Create | Read | Update | Delete | CRUD率 | API断链 | Mock | 功能缺失数 |
|------|---------|--------|------|--------|--------|--------|---------|------|-----------|
| AlertConfig | AlertRule | 部分 | 部分 | ❌ | ❌ | 25% | 是 | 1 | 3 |

#### 逻辑问题清单

**页面: orion-frontend/src/pages/AICostDashboard/AlertConfig.tsx**
- [P0] rules 状态使用硬编码 Mock 数据 (行51-82)，注释明确标注 `TODO: Alert rule CRUD requires backend API support`
- [P1] 告警规则仅 alerts 从 API 加载，rules 为本地 Mock
- [P1] 无编辑/删除告警规则入口

**页面: orion-frontend/src/pages/finops-svc/AICostDashboard/AlertConfig.tsx**
- [P0] 同上 (双份实现)

#### 功能缺失清单

**AI 成本管理**
- [P0] 告警规则使用硬编码 Mock 数据，未对接后端
- [P1] 无告警规则编辑/删除功能
- [P2] AlertConfig 存在双份实现 (AICostDashboard + finops-svc/AICostDashboard)

---

### 工作台 (Dashboard)

| 页面 | 数据实体 | Create | Read | Update | Delete | CRUD率 | API断链 | Mock | 功能缺失数 |
|------|---------|--------|------|--------|--------|--------|---------|------|-----------|
| DashboardNew | Pipeline/Run/Task | — | ✅ | — | — | N/A | 否 | 1 | 1 |
| ExecutiveDashboard | BI Data | — | ✅ | — | — | N/A | 否 | 0 | 0 |
| ManagerDashboard | BI Data | — | ✅ | — | — | N/A | 否 | 0 | 0 |
| EngineerDashboard | BI Data | — | ✅ | — | — | N/A | 否 | 0 | 0 |

#### 逻辑问题清单

**页面: orion-frontend/src/pages/DashboardNew/index.tsx**
- [P1] tasks 数据硬编码 Mock (行198-224: `// Mock tasks (until tasks API is available)`)

#### 功能缺失清单

**工作台**
- [P1] 任务列表使用硬编码 Mock 数据，未对接后端 API

---

### ChatOps

| 页面 | 数据实体 | Create | Read | Update | Delete | CRUD率 | API断链 | Mock | 功能缺失数 |
|------|---------|--------|------|--------|--------|--------|---------|------|-----------|
| index.chat.tsx | ChatMessage | — | ✅ | — | — | N/A | 否 | 0 | 1 |

#### 逻辑问题清单

**页面: orion-frontend/src/pages/ChatOps/index.chat.tsx**
- [P1] 空 catch 块 (行57: `.catch(() => {})`) — getAvailableTools 失败时无反馈

#### 功能缺失清单

**ChatOps**
- [P1] getAvailableTools 失败时静默忽略

---

## 三、API 断链汇总

| 前端调用 | 前端 API 文件 | 后端路由 | 状态 |
|---------|-------------|---------|------|
| AlertRule CRUD (Mock) | finops.ts | 无对应 route | 前端用硬编码 Mock |
| Role/Capability CRUD | capability.ts (无) | 无 capability-routes.ts | 无后端支持 |
| Task CRUD | tasks.ts (无) | 无 task-routes.ts | 工作台 tasks 为 Mock |

> 注: 大部分前端 API 调用已有后端路由对应。主要断链集中在能力管理、告警规则、任务管理等模块。

## 四、Mock 逻辑汇总

| 文件 | 行号 | Mock 代码 | 应改为 |
|------|------|----------|--------|
| orion-frontend/src/pages/TicketList/CreateTicketModal.tsx | 124 | `await new Promise(resolve => setTimeout(resolve, 1000))` | 调用 createTicket API |
| orion-frontend/src/pages/ticket-svc/TicketList/CreateTicketModal.tsx | 124 | `await new Promise(resolve => setTimeout(resolve, 1000))` | 调用 createTicket API |
| orion-frontend/src/pages/Capability/RoleCapabilityMapping.tsx | 361-365 | `setTimeout(() => { setLoading(false); ... })` | 调用 saveRoleCapabilities API |
| orion-frontend/src/pages/Capability/RoleCapabilityMapping.tsx | 69-155 | mockRoles/mockCapabilities 硬编码 | 从 API 加载 |
| orion-frontend/src/pages/ArtifactBrowser/index.tsx | 287-289 | catch 内 `// Mock success for demo` | 调用真实部署 API |
| orion-frontend/src/pages/AICostDashboard/AlertConfig.tsx | 51-82 | rules 硬编码 Mock 数组 | 调用 getAlertRules API |
| orion-frontend/src/pages/finops-svc/AICostDashboard/AlertConfig.tsx | 51-82 | rules 硬编码 Mock 数组 | 调用 getAlertRules API |
| orion-frontend/src/pages/DashboardNew/index.tsx | 198-224 | tasks 硬编码 | 调用 getTasks API |
| orion-frontend/src/pages/pipeline-svc/cache/CacheConfigPage.tsx | 361-406 | catch 内本地状态模拟 | 确保 API 调用成功或正确报错 |
| orion-frontend/src/pages/TicketList/index.tsx | 440-450 | handleAssign 仅弹确认框无 API 调用 | 调用 assignTicket API |

## 五、.data.data 双层嵌套汇总

`.data.data` 模式在 198 个文件中出现 411 次。虽然部分原因是后端响应格式 `response.data.data`，但使用 `as any` 进行解包是潜在问题。

**高频出现文件** (5+ 次):
- orion-frontend/src/pages/ConfigManagement/index.tsx — 8 次
- orion-frontend/src/pages/InceptionPage.tsx — 6 次
- orion-frontend/src/pages/EfficiencyDashboard/index.tsx — 6 次 (双份)
- orion-frontend/src/pages/TestReport/index.tsx — 6 次
- orion-frontend/src/pages/AuditLog/index.tsx — 5 次
- orion-frontend/src/pages/SbomDetail/index.tsx — 5 次 (双份)
- orion-frontend/src/pages/ArtifactVersion/index.tsx — 5 次
- orion-frontend/src/pages/CodeOwnersPage.tsx — 5 次
- orion-frontend/src/pages/Diagnostic/KnowledgeBase.tsx — 5 次

**含 as any 的不安全解包**:
- orion-frontend/src/pages/TenantList/index.tsx:153 — `(res.data as any)?.data ?? res.data`
- orion-frontend/src/pages/PipelineEditor/index.tsx:127 — `response.data as any`
- orion-frontend/src/pages/CodeMgmt/RepoList.tsx:89 — `branchesResp.data.data as any[]`

## 六、空 catch 块汇总

| 文件 | 行号 | 代码 | 问题 |
|------|------|------|------|
| orion-frontend/src/pages/ChatOps/index.chat.tsx | 57 | `.catch(() => {})` | getAvailableTools 失败时完全静默 |

> 未发现其他严格的空 catch 块。大部分 catch 块都有错误处理逻辑。

## 七、优先级修复汇总

### P0 — 逻辑断裂（API 未对接/Mock）

| # | 问题 | 文件 | 行号 |
|---|------|------|------|
| 1 | CreateTicketModal 用 setTimeout 模拟提交 | TicketList/CreateTicketModal.tsx | 124 |
| 2 | CreateTicketModal 用 setTimeout 模拟提交 (双份) | ticket-svc/TicketList/CreateTicketModal.tsx | 124 |
| 3 | handleAssign 仅弹 Modal 未调 assignTicket API | TicketList/index.tsx | 440-450 |
| 4 | 角色能力保存使用 setTimeout Mock | Capability/RoleCapabilityMapping.tsx | 361-365 |
| 5 | 角色/能力数据全部硬编码 | Capability/RoleCapabilityMapping.tsx | 69-155 |
| 6 | 部署失败 catch 内 Mock 成功提示 | ArtifactBrowser/index.tsx | 287-289 |
| 7 | 告警规则使用硬编码 Mock (TODO 标注) | AICostDashboard/AlertConfig.tsx | 51-82 |
| 8 | 告警规则使用硬编码 Mock (双份) | finops-svc/AICostDashboard/AlertConfig.tsx | 51-82 |
| 9 | 缓存 CRUD 在 catch 中降级为本地 Mock | pipeline-svc/cache/CacheConfigPage.tsx | 361-406 |
| 10 | 工作台 tasks 数据硬编码 | DashboardNew/index.tsx | 198-224 |

### P1 — CRUD 不完整

| # | 问题 | 文件 | 行号 |
|---|------|------|------|
| 1 | 工单列表无编辑入口 | TicketList/index.tsx | 操作列 |
| 2 | 工单列表无删除按钮 | TicketList/index.tsx | 操作列 |
| 3 | 工单详情 Descriptions 全部只读 | TicketDetail/index.tsx | 630-650 |
| 4 | 制品浏览器无创建/编辑/删除 | ArtifactBrowser/index.tsx | 整体 |
| 5 | 部署详情 Descriptions 全部只读 | DeploymentDetail/index.tsx | 230-282 |
| 6 | 角色能力无创建/删除入口 | Capability/RoleCapabilityMapping.tsx | 整体 |
| 7 | 告警规则无编辑/删除 | AICostDashboard/AlertConfig.tsx | 整体 |
| 8 | .data.data 双层嵌套 (198 文件) | 多文件 | 见第五节 |
| 9 | ChatOps 空 catch 块 | ChatOps/index.chat.tsx | 57 |
| 10 | 工单列表无批量操作 | TicketList/index.tsx | 整体 |

### P2 — 功能缺失

| # | 问题 | 文件 | 行号 |
|---|------|------|------|
| 1 | 报表功能弹"开发中" | TicketList/index.tsx | 486 |
| 2 | 子租户管理弹"开发中" | TenantList/index.tsx | 464 |
| 3 | 租户设置弹"开发中" | TenantList/index.tsx | 475 |
| 4 | 导出矩阵弹"开发中" | Capability/RoleCapabilityMapping.tsx | 377 |
| 5 | ChatOps 排班弹"开发中" | ChatOps/ApprovalConfig.tsx | 603 |
| 6 | AlertConfig 存在双份实现 | AICostDashboard + finops-svc | 多文件 |
| 7 | TicketList/CreateTicketModal 存在双份 | TicketList + ticket-svc | 多文件 |
| 8 | 部署列表无批量操作 | DeploymentList/index.tsx | 整体 |

## 八、Detail 页面只读问题汇总（DESC_NO_FORM）

以下 61 个 Detail 页面使用 `Descriptions` 组件展示详情，但**不包含 `Form.Item`**，即纯只读无编辑入口。

### 按模块分类

| 模块 | 文件数 | 文件路径 |
|------|--------|---------|
| Agent | 4 | AgentDashboard/AgentDetailDrawer.tsx (x2), AgentRunDetail/index.tsx (x2) |
| AI 评测 | 2 | AIAgents/AgentDetail.tsx, AIReview/ReviewDetail.tsx (x2) |
| 制品管理 | 10 | ArtifactBrowser/ (x2), Artifacts/ArtifactDetail.tsx (x2), ArtifactVersion/index.tsx (x2), ArtifactPage.tsx (x2), artifact-svc/ (x4) |
| 审计日志 | 2 | AuditLog/index.tsx, audit-svc/AuditLog/index.tsx |
| 构建环境 | 2 | BuildEnv/BuildPodDetail.tsx, code-svc/BuildEnv/BuildPodDetail.tsx |
| CMDB | 3 | CMDB/AuditLogPage.tsx, CMDB/IntegrationPage.tsx, CMDB/TopologyPage.tsx, CMDB/WebTerminalPage.tsx |
| 确认工单 | 2 | ConfirmationWorkbench/ConfirmationDetail.tsx (x2) |
| 审批管理 | 1 | ApprovalManagement/ApprovalRecordTable.tsx |
| 部署管理 | 2 | DeploymentDetail/index.tsx, deploy-svc/DeploymentDetail/index.tsx |
| 诊断会话 | 2 | Diagnostic/SessionDetail.tsx (x2) |
| 临时环境 | 2 | EphemeralEnvDetail/index.tsx (x2) |
| 事件总线 | 2 | EventBus/index.tsx (x2) |
| IaC | 2 | IacManagement/PlanViewer.tsx (x2) |
| Inception | 1 | inception/InceptionPage.tsx |
| 内部库 | 2 | InternalLibrary/LibraryDetail.tsx (x2) |
| Pipeline | 6 | PipelineDetail/index.tsx (x2), PipelineRunLive/index.tsx (x2), pipeline-svc/PipelineDetail/index.tsx, pipeline-svc/PipelineRunLive/index.tsx |
| 插件市场 | 2 | plugin-marketplace/PluginMarketplacePage.tsx (x2) |
| SBOM | 2 | SbomDetail/index.tsx (x2) |
| Self-Healing | 2 | SelfHealing/IncidentDetail.tsx (x2) |
| Sessions | 2 | Sessions/index.tsx (x2) |
| Skill | 1 | SkillManagement/SkillExecutions.tsx |
| TaskTimeouts | 1 | TaskTimeouts/index.tsx |
| TestReport | 2 | TestReport/index.tsx (x2) |
| VectorStore | 2 | VectorStore/CollectionDetail.tsx (x2) |
| Workflow | 1 | WorkflowDesigner/ExecutionHistory.tsx |

> **注**: 部分文件有双份实现（平台级 + 模块级），如 AgentDetailDrawer 同时存在于 `agent-svc/` 和根级目录。

### 严重程度分析

- **P1 — 应有编辑入口但无**: Agent 详情、Pipeline 详情、SelfHealing 事件详情、IaC Plan 详情
- **P2 — 查看型页面可接受**: 审计日志、SBOM 详情、审批记录、EventBus 事件详情、Skill 执行记录

### 建议

对于以下 15 个关键 Detail 页面，建议优先添加编辑能力：

1. AgentDetail (AIAgents/AgentDetail.tsx) — 可编辑 Agent 配置、参数
2. PipelineDetail (PipelineDetail/index.tsx) — 可编辑 Pipeline 描述、参数
3. SelfHealing/IncidentDetail (SelfHealing/IncidentDetail.tsx) — 可添加处理备注
4. EphemeralEnvDetail (EphemeralEnvDetail/index.tsx) — 可修改环境配置
5. ConfirmationDetail (ConfirmationWorkbench/ConfirmationDetail.tsx) — 可编辑确认信息
6. Diagnostic/SessionDetail (Diagnostic/SessionDetail.tsx) — 可添加诊断备注
7. SbomDetail (SbomDetail/index.tsx) — 可标记误报/已处理
8. TestReport (TestReport/index.tsx) — 可添加评审意见
9. VectorStore/CollectionDetail (VectorStore/CollectionDetail.tsx) — 可编辑集合配置
10. AgentRunDetail (AgentRunDetail/index.tsx) — 可标记运行结果
11. ArtifactBrowser/TraceabilityChainView — 可关联部署信息
12. ApprovalRecordTable (ApprovalManagement/ApprovalRecordTable.tsx) — 可添加审批备注
13. EventBus (EventBus/index.tsx) — 可编辑事件配置
14. IacManagement/PlanViewer — 可编辑 Terraform 变量
15. WorkflowDesigner/ExecutionHistory — 可标记执行结果

## 九、扫描方法说明

1. **页面扫描**: 遍历 `orion-frontend/src/pages/` 下所有 .tsx 文件（排除 `__tests__/`、`__mocks__/`）
2. **CRUD 检查**: 对每个数据实体页面搜索 Create/Read/Update/Delete 相关操作
3. **API 连接**: 检查页面 `import from @/api/` → API 客户端函数 → 后端 `*-routes.ts` 三层对应关系
4. **Mock 模式**: 搜索 `setTimeout` + `resolve`、`message.info('开发中')`、`// TODO`、`// mock`、硬编码 Mock 数组
5. **数据解包**: 搜索 `.data.data` 和 `as any`
6. **错误处理**: 搜索空 catch 块 `catch {}` 或 `catch(() => {})`
7. **权限检查**: 搜索 `requirePermission`、`hasPermission`（未发现使用）

## 九、关键发现

1. **TenantList 是 CRUD 最完整的页面**: Create/Read/Update/Delete 全部实现，含搜索筛选、批量删除、CSV 导出
2. **CreateTicketModal 两处完全相同**: `TicketList/CreateTicketModal.tsx` 和 `ticket-svc/TicketList/CreateTicketModal.tsx` 是双份实现，均使用 setTimeout Mock
3. **AICostDashboard AlertConfig 双份**: `AICostDashboard/AlertConfig.tsx` 和 `finops-svc/AICostDashboard/AlertConfig.tsx` 使用完全相同的硬编码 Mock 数据
4. **权限检查缺失**: 整个前端代码库未发现 `requirePermission`、`hasPermission`、`checkPermission` 等权限检查
5. **租户管理有 3 处 `.data as any` 类型断言**: 说明后端响应格式与前端预期不完全匹配
6. **198 个文件使用 `.data.data`**: 这是全局一致的数据解包模式，但含 `as any` 的部分存在类型安全风险
