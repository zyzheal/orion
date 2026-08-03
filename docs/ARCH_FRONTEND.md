# Orion 前端功能架构与交互深度文档

> 更新日期: 2026-08-01 | 数据源: 实际代码扫描
> 前端页面: 217 个 | API 客户端: 194 个 | 路由文件: 2046 行

---

## 一、前端技术栈

| 维度 | 选型 |
|------|------|
| 框架 | React 18 + TypeScript |
| 构建 | Vite |
| UI 库 | Ant Design |
| 状态管理 | Zustand (authStore, menuConfigStore, subappStore) |
| 路由 | react-router-dom (routes.tsx, 2046 行) |
| API 客户端 | Axios 统一实例 (client.ts, 30s 超时, 拦截器) |
| 微前端 | Orion-MF (自研) |
| 测试 | Vitest + Playwright E2E |
| 数据获取 | @tanstack/react-query (已安装) |

---

## 二、页面分类导航

### 2.1 工作台 (6 页)

| 页面 | 行数 | API 调用 | 路由 | 交互深度 |
|------|------|---------|------|---------|
| DashboardNew | — | 调用 pipelines/runs/monitoring | `/dashboard` | 中 |
| DashboardCore | — | — | — | 中 |
| ExecutiveDashboard | — | — | — | 中 |
| ManagerDashboard | — | — | — | 中 |
| EngineerDashboard | — | — | — | 中 |
| Workbench | — | — | `/workbench` | 低 |

### 2.2 控制台/管理 (10 页)

| 页面 | 行数 | API 调用 | 功能 |
|------|------|---------|------|
| Console | — | plugins/feature-flags/users | 控制台主入口 |
| UserManagement | — | user.ts | 用户管理 |
| RoleManagement | — | roles.ts | 角色管理 |
| TenantList | — | tenant.ts | 租户列表 |
| TenantManagement | — | tenant.ts | 租户管理 |
| Session | — | session.ts | 会话管理 |
| AuditLog | — | audit-logs.ts | 审计日志 |
| AuditLogs | — | audit-logs.ts | 审计日志高级 |
| Capability | — | capability.ts | 能力管理 |
| CapabilityAdmin | — | capability.ts | 能力管理后台 |

### 2.3 交付 (Pipeline/CI-CD) — 8 核心页

| 页面 | 行数 | API 调用 | 功能 |
|------|------|---------|------|
| PipelineList | 597 | pipelines.ts | Pipeline 列表(13Search+12Filter+7Batch) |
| PipelineDetail | 1033 | pipelineRuns.ts | Pipeline 详情+SSE 实时日志 |
| PipelineEditor | 1435 | — | Pipeline 编辑器/StageModal |
| PipelineRunList | — | pipelineRuns.ts | 运行列表 |
| PipelineRunLive | 768 | pipelineRuns.ts + SSE | 实时运行监控 |
| PipelineVersionHistory | — | pipeline-versions.ts | 版本历史 |
| PipelineBudget | 459 | pipeline-budget.ts | 预算管理 |
| pipeline-template | — | pipeline-template.ts | 模板管理 |

### 2.4 交付 (构建/部署/制品) — 12 页

| 页面 | 行数 | API 调用 | 功能 |
|------|------|---------|------|
| BuildEnv | — | build-env.ts | 构建环境(7 子页面) |
| DeployPage | 1667 | deploy.ts / deployments.ts | 部署管理 |
| DeploymentDetail | — | deployments.ts | 部署详情 |
| DeploymentList | — | deployments.ts | 部署列表 |
| ArtifactBrowser | — | artifact.ts | 制品浏览 |
| Artifacts | — | artifacts.ts | 制品列表 |
| ArtifactVersion | — | artifactVersions.ts | 制品版本 |
| ScriptLibrary | 1268 | scripts.ts | 脚本库 |
| ScriptRunner | — | scripts.ts | 脚本执行 |
| ScriptVersions | — | script-versions.ts | 脚本版本 |

### 2.5 可观测性 (10 页)

| 页面 | 行数 | API 调用 | 功能 |
|------|------|---------|------|
| AlertList | 656 | alerts.ts | 告警列表 |
| Monitoring | — | monitoring.ts | 监控仪表板 |
| MetricsDashboard | 502 | monitoring.ts | 指标仪表板 |
| Tracing | — | tracing 相关 | 链路追踪 |
| HealthDashboard | — | health.ts | 健康检查 |
| performance | — | performance.ts | 性能 |
| EventBus | — | eventbus.ts | 事件总线 |
| EventRegistry | — | event-registry.ts | 事件注册 |
| ServiceRegistry | — | service-registry.ts | 服务注册 |
| Observability | — | observability.ts | 可观测性 |

### 2.6 AI 平台 (11 页)

| 页面 | 行数 | API 调用 | 功能 |
|------|------|---------|------|
| AIDashboard | 164 | ai-gateway.ts | AI 仪表板(1 次 API) |
| AIAgents | — | agents.ts / ai-agents.ts | Agent 管理 |
| AICostDashboard | 74 | ai-cost.ts | AI 成本 |
| AIReview | — | ai-review.ts | AI 代码审查 |
| AIGateway | — | ai-gateway.ts | AI 网关 |
| AISecurity | — | ai-security.ts | AI 安全 |
| AIDocManagement | — | ai-docs.ts | AI 文档 |
| LLMTraceDashboard | — | llm-trace.ts | LLM 追踪 |
| AgentRunDetail | — | agents.ts | Agent 运行详情 |
| AIReview | — | ai-review.ts | AI 评审 |
| ai-decision | — | ai-decision.ts | AI 决策 |

### 2.7 基础设施 (10 页)

| 页面 | 行数 | API 调用 | 功能 |
|------|------|---------|------|
| CMDB/index | 190 | cmdb.ts | CMDB 主入口(Tab 导航) |
| CITablePage | 772 | cmdb.ts | CI 实例列表 |
| TopologyPage | 434 | cmdb.ts | 拓扑图 |
| BatchExecPage | 1013 | cmdb.ts | 批量执行 |
| WebTerminalPage | 442 | visor.ts | Web 终端 |
| ImpactAnalysisPage | — | cmdb.ts | 影响分析 |
| IntegrationPage | — | cmdb.ts | 外部集成 |
| multi-cloud | — | multi-cloud.ts | 多云管理 |
| network | — | — | 网络管理 |
| serverless | — | serverless.ts | Serverless 管理 |

### 2.8 治理 (ITSM) — 10 页

| 页面 | 行数 | API 调用 | 功能 |
|------|------|---------|------|
| TicketList | 714 | ticketing.ts | 工单列表 |
| TicketDetail | 852 | ticketing.ts | 工单详情 |
| Incident | 1437 | incident.ts | 事件管理 |
| Problem | 1315 | problem.ts | 问题管理 |
| ChangeManagement | 1899 | change.ts | 变更管理 |
| ChangeRequestManagement | — | change-requests.ts | 变更请求 |
| SLA | 1221 | sla.ts | SLA 管理 |
| Approval | — | approval.ts | 审批管理 |
| Approvals | — | approvals.ts | 审批列表 |
| ApprovalManagement | — | approvals.ts | 审批管理 |

### 2.9 生态/其他 (24 页)

| 页面 | 行数 | API 调用 | 功能 |
|------|------|---------|------|
| ServiceCatalog | 1476 | service-catalog.ts | 服务目录 |
| ServicePortal | 1015 | — | 服务门户 |
| NotificationCenter | 1051 | notifications.ts | 通知中心 |
| NotificationEnhanced | — | notification-enhanced.ts | 通知增强 |
| NotificationRules | — | notificationRules.ts | 通知规则 |
| ConfigManagement | 1172 | config.ts | 配置管理 |
| ReportDesigner | 1030 | reports.ts | 报表设计器 |
| ProductLine | 1123 | product-lines.ts | 产品线 |
| DeveloperPortal | 1581 | — | 开发者门户 |
| OpsTools | 1355 | ops-tools.ts | 运维工具 |
| DatabaseDevOps | 1640 | database-devops.ts | 数据库运维 |
| lowcode | — | lowcode.ts | 低代码 |
| WorkflowDesigner | 1716 | workflow.ts | 工作流设计器 |
| WorkflowTasks | — | workflow-task.ts | 工作流任务 |
| WorkflowDependencies | — | workflow-dependency.ts | 工作流依赖 |
| FormDesigner | — | — | 表单设计器 |
| SecretsManagement | 509 | secrets.ts | 密钥管理 |
| feature-flags | — | feature-flags.ts | 特性开关 |
| ScriptLibrary | 1268 | scripts.ts | 脚本库 |
| ChaosEngineering | — | chaos.ts | 混沌工程 |
| DigitalTwin | — | digital-twin.ts | 数字孪生 |
| OnCall | — | oncall.ts | 值班管理 |
| SubApps | — | — | 子系统管理 |
| SubAppManagement | — | — | 子系统管理 |

---

## 三、API 客户端映射 (194 个)

### 3.1 按域分组的 API 文件

| 域 | API 文件数 | 代表性文件 |
|------|-----------|-----------|
| 身份认证 | 6 | auth.ts, user.ts, tenant.ts, roles.ts, session.ts, permission-audit.ts |
| Pipeline | 9 | pipelines.ts, pipelineRuns.ts, pipeline-budget.ts, pipeline-template.ts, pipeline-versions.ts, pipeline-templates.ts |
| 部署/制品 | 6 | deploy.ts, deployments.ts, deploy-enhanced.ts, artifact.ts, artifacts.ts, artifactVersions.ts |
| 通知 | 5 | notifications.ts, notificationRules.ts, notification-enhanced.ts, alerts.ts |
| ITSM | 8 | ticketing.ts, incident.ts, problem.ts, change.ts, change-requests.ts, sla.ts, approval.ts, approvals.ts |
| AI | 10 | agents.ts, ai-agents.ts, ai-cost.ts, ai-review.ts, ai-gateway.ts, ai-security.ts, ai-docs.ts, ai-decision.ts, llm-trace.ts |
| CMDB | 7 | cmdb.ts, ci-types.ts, service-topology.ts, visor.ts, visor-exec.ts |
| 监控 | 5 | monitoring.ts, apm.ts, health.ts, performance.ts, observability.ts |
| 数据 | 6 | data-quality.ts, data-pipeline.ts, data-lineage.ts, vector-store.ts, bi.ts, reports.ts |
| FinOps | 8 | finops.ts, cost-allocation.ts, billing.ts, efficiency.ts, capacity.ts, cost-operations.ts |
| 配置 | 4 | config.ts, feature-flags.ts, global-params.ts, env-profiles.ts |
| 低代码 | 5 | lowcode.ts, workflow.ts, workflow-task.ts, workflow-dependency.ts, workflow-trigger.ts |
| 安全 | 7 | secrets.ts, compliance.ts, security-compliance.ts, audit.ts, audit-logs.ts, abac-policy.ts |
| 其他 | 108+ | 其余所有 API 文件 |

### 3.2 API 客户端统一模式

所有 API 文件使用统一 `client.ts` 实例：

```typescript
// client.ts — 统一 Axios 实例
import axios from 'axios';
const client = axios.create({ baseURL: '/api/v1', timeout: 30000 });
// 认证拦截器 + 错误处理
```

每个 API 文件导出独立函数，模式：
```typescript
// api/ticketing.ts
export const getTickets = (params) => client.get('/tickets', { params });
export const getTicket = (id) => client.get(`/tickets/${id}`);
export const createTicket = (data) => client.post('/tickets', data);
// ...
```

---

## 四、路由系统 (routes.tsx, 2046 行)

### 4.1 路由结构

```
├── /login                    → Login
├── /dashboard                → DashboardNew
├── /console                  → Console
├── /pipeline                 → PipelineList (+ children)
│   ├── /pipeline/list        → PipelineList
│   ├── /pipeline/detail/:id  → PipelineDetail
│   ├── /pipeline/editor/:id  → PipelineEditor
│   └── /pipeline/runs        → PipelineRunList
├── /deploy                   → DeployPage
├── /cmdb                     → CMDB (Tab 导航)
│   ├── /cmdb/ci              → CITablePage
│   ├── /cmdb/topology        → TopologyPage
│   ├── /cmdb/batch-exec      → BatchExecPage
│   └── /cmdb/terminal        → WebTerminalPage
├── /tickets                  → TicketList
├── /tickets/:id              → TicketDetail
├── /incident                 → Incident
├── /problem                  → Problem
├── /change                   → ChangeManagement
├── /sla                      → SLA
├── /monitoring               → AlertList
├── /ai                       → AIDashboard
├── /ai/agents                → AIAgents
├── /ai/cost                  → AICostDashboard
├── /ai/review                → AIReview
├── /ai/gateway               → AIGateway
├── /ai/security              → AISecurity
├── /ai/documents             → AIDocManagement
├── /notification             → NotificationCenter
├── /config                   → ConfigManagement
├── /service-catalog          → ServiceCatalog
├── ... (287/323 路由已 lazy loading)
```

### 4.2 路由注册状态

| 类型 | 数量 |
|------|------|
| 总路由 | 323 |
| Lazy loading | 287 (89%) |
| 非 lazy | 36 |
| ARCHIVED 标记 | 17 (已标记) |
| 重复路由 | 0 (已全部修复) |

---

## 五、前端交互深度评估

### 5.1 交互深度分级

| 级别 | 标准 | 页面数 | 代表页面 |
|------|------|--------|---------|
| ⭐⭐⭐⭐⭐ | 全功能 (10+ API, 批量操作, 编辑, 筛选) | ~20 | Incident, PipelineDetail, ChangeManagement, ServiceCatalog |
| ⭐⭐⭐⭐ | 丰富 (5-10 API, 列表+详情+编辑) | ~40 | TicketList, CMDB/CITable, BuildEnv, ConfigManagement |
| ⭐⭐⭐ | 中等 (3-5 API, 列表+详情) | ~60 | Problem, SLA, DeployPage, NotificationCenter |
| ⭐⭐ | 基础 (1-2 API, 列表页) | ~60 | AI 子页面, FinOpsDashboard, ModuleManager |
| ⭐ | 骨架 (0 API, 占位) | ~37 | 部分早期页面 |

### 5.2 权限校验覆盖

| 指标 | 数据 |
|------|------|
| 总页面 | 217 |
| 有权限校验 | 6 (PipelineList, AlertList, usePermission, usePermissionActions, ProjectMember, Workbench) |
| 覆盖率 | 2.8% |
| 敏感页面缺权限 | ChangeManagement, Secret, Approval, Admin, DeployPage, ConfigManagement |

### 5.3 前端深度建议

1. **P0**: 敏感页面增加 `usePermission` 守卫 (6-8 页面)
2. **P1**: 37 个骨架页面补全 API 对接 (AIDashboard/CMDB/index 等)
3. **P2**: 迁移 10 个核心页面到 @tanstack/react-query

---

## 六、前端与后端交互模式

### 6.1 交互模式

| 模式 | 协议 | 使用场景 | 示例 |
|------|------|---------|------|
| REST API | HTTP/JSON | CRUD 操作 | 全部 API 客户端 |
| SSE | Server-Sent Events | 实时日志 | PipelineRunLive |
| WebSocket | 全双工 | 实时终端 | WebTerminal (orion-visor) |
| 硬编码路径 | `/api/v1/*` | 全局 API | 137 个 API 文件 |

### 6.2 数据流

```
用户操作 → React Component → API Client (client.ts)
    → Axios 拦截器 (添加 JWT Token)
    → HTTP 请求
    → 后端 Handler → Service → Repository
    → 响应 → client.ts 反序列化
    → React State 更新 → UI 渲染
```

---

## 七、统一架构健康度评分

> 评分体系: 后端架构分层 (9.5) + 前端交互完整性 (7.0) + 前后端映射完整度 (7.5) = 综合 8.0/10
> 详细评分矩阵见 `docs/ARCH_BACKEND.md` 第十六章

### 7.1 前端维度评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 页面覆盖度 | 9.5/10 | 217 页面覆盖 9 大域 |
| 页面交互深度 | 7.0/10 | 20 全功能 + 40 丰富 + 60 中等 + 60 基础 + 37 骨架 |
| 权限校验 | 3.0/10 | 仅 6/217 页面 (2.8%) 有权限守卫 |
| 菜单/路由覆盖 | 8.5/10 | 315 路由 89% lazy loading |
| API 客户端覆盖 | 8.0/10 | 166 API 文件, 60+ 已映射到后端 |
| 空状态与引导 | 6.0/10 | 部分页面缺 Empty 引导 |
| Loading 状态 | 7.0/10 | 部分异步操作缺 loading |
| 交互链完整度 | 7.0/10 | 部分页面缺编辑入口/保存按钮 |
| **前端综合** | **7.0/10** | |

### 7.2 改进优先级

| 改进项 | 优先级 | 工作量 | 参考 |
|--------|--------|--------|------|
| 敏感页面权限守卫 | P0 | 1-2 天 | ALL_TODOS.md P0-1 |
| 骨架页面补 API | P1 | 3-5 天 | 37 骨架页面 |
| 核心页面迁移 react-query | P2 | 2-3 天 | ALL_TODOS.md P2-10 |
| 空状态统一 | P2 | 1 天 | 60+ 基础页面 |
| `any` 类型清理 | P2 | 3-5 天 | 1138 处 any |

---

> 数据来源: 实际代码扫描 (217 页面, 194 API 文件, 2046 行路由)
> 关联文档:
> - `docs/ARCH_BACKEND.md` — 后端功能架构 (286 模块, 10 域分类)
> - `docs/ARCH_MAPPING.md` — 前后端交互映射 (REST/SSE/WS/NATS)
> - `docs/ALL_TODOS.md` — 统一待办清单 (P0 4 项, P1 9 项, P2 11 项)
> - `docs/architecture-review-2026-08-01.md` — 主统一报告 (1088 行, 9 章)
> - `docs/three-domain-depth-analysis-2026-08-01.md` — 三域专家深度分析