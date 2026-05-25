# CMDB + 工单系统 ITSM 专项深度评估报告

> **评估日期**: 2026-05-22
> **评估范围**: CMDB 模块 + 工单系统 (Ticket)
> **评估依据**: 代码级逐行审计，对标 ServiceNow / ITIL v4

---

## 一、CMDB 模块

### 1.1 模块概览

| 维度 | 状态 | 说明 |
|------|------|------|
| Service 目录 | `orion-platform-service/src/services/cmdb/` | 5个源文件 |
| Repository 层 | `orion-platform-service/src/api/repositories/` | 3个 Repository 文件 |
| 类型定义 | `CmdbTypes.ts` | 14种 CI 类型、9种关系类型 |
| DB 迁移 | **0 个迁移文件** | `grep cmdb migrations/` 结果为空 |
| 路由注册 | **未注册** | routes.ts:386 注明"已迁移到独立 Go 服务"，但该服务不存在 |
| 前端页面 | **无** | `glob *cmdb* pages/` 结果为空 |

**文件清单**:
- `orion-platform-service/src/services/cmdb/CmdbService.ts` -- 核心服务 (662行)
- `orion-platform-service/src/services/cmdb/CmdbTypes.ts` -- 类型定义 (157行)
- `orion-platform-service/src/services/cmdb/TopologyService.ts` -- 拓扑服务 (309行)
- `orion-platform-service/src/services/cmdb/CmdbEventPublisher.ts` -- 事件发布 (98行)
- `orion-platform-service/src/services/cmdb/K8sReconciliationService.ts` -- K8s 对账 (833行)
- `orion-platform-service/src/api/repositories/CmdbRepository.ts` -- CI 数据访问 (249行)
- `orion-platform-service/src/api/repositories/CmdbRelationRepository.ts` -- 关系数据访问
- `orion-platform-service/src/api/repositories/CmdbVersionRepository.ts` -- 版本数据访问

### 1.2 路由注册检查

| 检查项 | 结果 | 证据 |
|--------|------|------|
| routes.ts 是否 import cmdb 路由? | **未注册** | `routes.ts:386` 注释: "CMDB 路由已迁移到独立 Go 服务 (orion-cmdb-service)" |
| 是否存在 `cmdb-routes.ts` 文件? | **不存在** | `ls orion-platform-service/src/api/*cmdb*` 无结果 |
| `orion-cmdb-service` 目录是否存在? | **不存在** | 工程内无此目录 |
| ModuleManager 中 cmdb 配置 | 已声明启用 | `routes.ts:176` `cmdb: { enabled: true, autoStart: true }` |
| ModuleManager 中 cmdbIntegration 配置 | 声明为禁用 | `routes.ts:187` `cmdbIntegration: { enabled: false }` |

**结论**: CMDB 路由完全缺失。虽然 `routes.ts:176` 声明 cmdb 模块已启用，但没有任何路由文件被注册。注释声称"已迁移到独立 Go 服务"，但该 Go 服务不存在。任何对 CMDB API 的调用都会返回 404。

### 1.3 调用链追踪

```
前端页面: 不存在
  ↓
API Client: 不存在 (orion-frontend/src/api/ 中无 cmdb 相关)
  ↓
路由层: 未注册 (routes.ts:386 注释说明已迁移)
  ↓
Controller 层: 不存在
  ↓
Service 层: CmdbService.ts:59-661 ✅ 存在完整实现
  ├── createCI → CmdbRepository.createCI (PostgreSQL) ⚠️ Repository 存在但无表
  ├── getCI → CmdbRepository.getCIById (PostgreSQL) ⚠️ 同上
  ├── updateCI → CmdbRepository.updateCI (PostgreSQL) ⚠️ 同上
  ├── deleteCI → CmdbRepository.deleteCI (PostgreSQL) ⚠️ 同上
  ├── listCIs → CmdbRepository.listCIs (PostgreSQL) ⚠️ 同上
  ├── getCIRelations → CmdbRelationRepository ⚠️ 同上
  ├── createRelation → CmdbRelationRepository ⚠️ 同上
  └── getVersions → CmdbVersionRepository ⚠️ 同上

Repository 层: CmdbRepository.ts:18-248 ✅ SQL 完整
  └── 使用 DatabasePool.query() 访问 cmdb_ci 表
      └── DB 迁移: 011_create_tickets_healing.sql (无关)
          ⚠️ 没有任何 cmdb_ci / cmdb_relation / cmdb_version 迁移文件

DB 层: PostgreSQL
  └── cmdb_ci 表: **不存在** (无迁移)
  └── cmdb_relation 表: **不存在** (无迁移)
  └── cmdb_version 表: **不存在** (无迁移)
```

**内存存储后备**: `CmdbService.ts:30-32` 存在 Map 作为 fallback:
```typescript
const cis = new Map<string, CI>();
const ciVersions = new Map<string, CIVersion[]>();
const relations = new Map<string, CIRelation>();
```
这意味着即使 Service 层被调用，由于没有 Repository 初始化（database 未传入），实际运行时会降级到内存 Map 存储，服务重启即丢失数据。

### 1.4 CMDB 专项能力评估

| 能力项 | 状态 | 评分 | 证据 | 对标 ServiceNow |
|--------|------|------|------|----------------|
| **CI 生命周期 CRUD** | ❌ 不可用 | 2/10 | Service 层完整 (`CmdbService.ts:59-648`)，但无路由注册 (`routes.ts:386`)，无 DB 迁移，外部不可达 | SN 支持完整 CI 生命周期+审计日志 |
| **版本管理** | ⚠️ 部分 | 3/10 | `CmdbService.ts:546-648` 有 getVersions/restoreToVersion，但无持久化 | SN 支持 CI 快照+时间回溯 |
| **关系管理 (9种)** | ⚠️ 部分 | 3/10 | `CmdbTypes.ts:37-46` 定义9种关系: DEPENDS_ON/HOSTED_ON/CONNECTS_TO/BELONGS_TO/USES/CONTAINS/VERSION_OF/DEPLOYED_TO/MONITORED_BY。TopologyService.ts:41-308 实现拓扑+影响分析。无持久化 | SN 支持动态关系+CMDB 关系图 |
| **拓扑可视化** | ⚠️ 部分 | 3/10 | `TopologyService.ts:51-112` getTopology 返回 nodes+edges 结构，但无前端页面消费 | SN 有原生依赖图谱可视化 |
| **影响分析** | ⚠️ 部分 | 3/10 | `TopologyService.ts:241-308` getImpactAnalysis 按 BFS 计算 affectedNodes 并分级(critical/high/medium/low)。但无持久化 | SN 有业务影响分析(BIA) |
| **K8s 自动发现** | ⚠️ 部分 | 4/10 | `K8sReconciliationService.ts:137-832` 完整实现: Namespace/Deployment/Pod/Service 发现 + 5分钟对账 + 冲突解决(K8s原生 vs CMDB扩展)。但未启动(无路由)。`K8sWatchClient.ts` 仅导出 SyncStatus 类型 | SN Discovery & Service Mapping |
| **AWS 发现** | ❌ 缺失 | 0/10 | 代码中无任何 AWS SDK 调用 | SN 支持 AWS/Azure/GCP 自动发现 |
| **网络设备发现** | ❌ 缺失 | 0/10 | 无 SNMP/ICMP 等网络设备探测逻辑 | SN 支持网络设备自动发现 |
| **数据调和** | ⚠️ 部分 | 3/10 | `K8sReconciliationService.ts:550-768` 实现 K8s vs CMDB 冲突检测+按策略合并。仅支持单一数据源(K8s)。多源冲突解决(>2源)未实现 | SN 支持多源 IRE(识别+调和引擎) |
| **健康度评分** | ❌ 缺失 | 0/10 | 无完整性/准确性/新鲜度评分逻辑 | SN 有 CMDB Health Dashboard |
| **导入导出** | ❌ 缺失 | 0/10 | 无 CSV/JSON 批量导入导出 API | SN 支持 Import Sets + Transform Maps |
| **RBAC (CI 级别)** | ❌ 缺失 | 0/10 | CmdbService 无权限检查逻辑。租户级别有(`CmdbTypes.ts:52: tenantId`)，但无细粒度 CI 级权限 | SN 有 CI 级 ACL |
| **合规检查** | ❌ 缺失 | 0/10 | 无 CI 策略校验+违规告警逻辑 | SN 有 CMDB Compliance |

### 1.5 场景逆向验证

**场景: "创建一个新的 Kubernetes Deployment CI 并查看其拓扑关系"**

| 步骤 | 预期 | 实际 | 结果 |
|------|------|------|------|
| 1. 调用 `POST /api/v1/cmdb/cis` 创建 CI | 路由接收请求 | `routes.ts:386` 无路由注册 | ❌ 404 |
| 2. 假设路由存在 → CmdbService.createCI | Service 检查 ciId 是否存在 | `CmdbService.ts:66-79` 检查逻辑存在，但 ciRepository 为 undefined（routes.ts 未初始化） | ⚠️ 降级到内存 Map |
| 3. 创建 CI 存入数据库 | `INSERT INTO cmdb_ci` | `CmdbRepository.ts:18-43` SQL 正确，但 `cmdb_ci` 表不存在（无迁移） | ❌ 运行时错误 |
| 4. 调用 `GET /api/v1/cmdb/topology` 查看拓扑 | 返回 nodes + edges | 无路由 | ❌ 404 |
| 5. 假设路由存在 → TopologyService.getTopology | 遍历 CIs 构建拓扑图 | `TopologyService.ts:51-112` 逻辑正确，但数据源为空(内存Map未初始化) | ❌ 返回空数据 |

### 1.6 缺失能力清单

| 优先级 | 缺失能力 | 影响 | 备注 |
|--------|---------|------|------|
| **P0** | CMDB 路由注册 | 全部功能不可达 | 最致命：Service→Repository→SQL 全链条存在但无入口 |
| **P0** | DB 迁移文件 (cmdb_ci/cmdb_relation/cmdb_version) | 持久化层不存在 | 3个 Repository 文件无对应表 |
| **P0** | CMDB 前端页面 | 用户无法操作 | 无任何 CMDB 页面 |
| **P1** | 导入导出 (CSV/JSON) | 无法批量导入现有资产 | ServiceNow 基础能力 |
| **P1** | CI 健康度评分 | 无法评估数据质量 | ServiceNow CMDB Health |
| **P1** | AWS/云资源自动发现 | 混合云 CMDB 不完整 | 当前仅支持 K8s |
| **P1** | 网络设备发现 | 传统 IT 资产无法自动发现 | SNMP/SSH 探测 |
| **P2** | CI 级别 RBAC | 无法做细粒度权限控制 | 当前仅租户级隔离 |
| **P2** | 合规检查引擎 | 无法做策略审计 | 如"所有 Production CI 必须有 owner" |

---

## 二、工单系统 (Ticket)

### 2.1 模块概览

| 维度 | 状态 | 说明 |
|------|------|------|
| Service 目录 | `orion-platform-service/src/services/ticketing/` | 16个源文件 |
| Controller | `orion-platform-service/src/api/controllers/ticketing/TicketingController.ts` | 1885行，覆盖所有端点 |
| 类型定义 | `services/ticketing/types.ts` | 1025行，类型系统完整 |
| Repository | `services/ticketing/TicketingRepository.ts` | 692行，PostgreSQL 实现 |
| DB 迁移 | **3个** | 011_create_tickets, 038_create_ticket_workflow, 061_create_ticketing_sub_services |
| 路由注册 | **❌ 未注册** | routes.ts 中无任何 ticket 路由 import/register |
| 前端页面 | ✅ 存在 | `orion-frontend/src/pages/ticket-svc/TicketList/` + `TicketDetail/` |
| 前端 API Client | ✅ 存在 | `orion-frontend/src/api/ticketing.ts` |

**文件清单 (后端)**:
- `TicketService.ts` (1487行) - 主编排器
- `TicketWorkflowService.ts` (719行) - 状态机
- `TicketingService.ts` (83行) - PostgreSQL 数据层
- `TicketingRepository.ts` (692行) - Repository 层
- `TicketGenerator.ts` - 从 Alert/Incident 生成工单
- `TicketRelationAnalyzer.ts` - 关联分析
- `TicketReportService.ts` - 报表
- `TicketBIService.ts` - BI 分析
- `TicketTransferService.ts` - 工单转交
- `DispatchEngine.ts` - 智能分派
- `DispatchQueueManager.ts` - 分派队列
- `LoadBalancer.ts` - 负载均衡
- `DispatchAnalytics.ts` - 分派分析
- `EngineerSuspendService.ts` - 工程师暂停/请假
- `types.ts` (1025行) - 完整类型系统

**DB 迁移文件**:
- `011_create_tickets_healing.sql` → tickets, ticket_comments 表
- `038_create_ticket_workflow.sql` → ticket_workflow_history, ticket_sla, dispatch_queue, engineer_load 表
- `061_create_ticketing_sub_services.sql` → ticket_assignments, ticket_relations, dispatch_rules, ticket_transfers, engineer_suspensions, dispatch_weights 表

### 2.2 路由注册检查

| 检查项 | 结果 | 证据 |
|--------|------|------|
| routes.ts 是否 import ticketing 路由? | **未注册** | `grep tickets routes.ts` 结果为空 |
| 是否存在 `ticketing-routes.ts` 文件? | **不存在** | `ls orion-platform-service/src/api/*ticket*` 无结果 |
| TicketingController 是否被使用? | ❌ 未被引用 | 仅文件存在，无 import |
| 前端 API Client 路径 | `/v1/tickets` | `ticketing.ts:26` `api.get('/v1/tickets', { params })` |
| 后端是否有 /v1/tickets 路由? | ❌ 无 | routes.ts 无任何 /v1/tickets 注册 |
| routes.ts.bak 中是否有? | ⚠️ 可能存在 | 存在 `routes.ts.bak` 但非活跃文件 |
| ModuleManager 中 ticketing 配置 | 已声明启用 | `routes.ts:167` `ticketing: { enabled: true, autoStart: true }` |

**结论**: 工单系统是**"幽灵模块"**——后端 Service/Controller/Repository/DB 表全部存在且实现完整，前端页面和 API Client 也已就绪，但 `routes.ts` 完全没有注册任何 ticketing 路由。这意味着:
- 前端调用 `GET /v1/tickets` → **404**
- 前端调用 `POST /v1/tickets/:id/assign` → **404**
- 前端调用 `GET /v1/tickets/statistics` → **404**

所有前端工单功能目前全部不可用。

### 2.3 调用链追踪

**Ticket CRUD**:
```
前端: TicketList/index.tsx:165-181 → getTickets(params) → api.get('/v1/tickets')
  ↓
前端 API: ticketing.ts:25-27 → api.get('/v1/tickets', { params })
  ↓
路由层: ❌ 未注册 (routes.ts 无 import) → 404
  ↓
Controller: TicketingController.ts:96-166 → listTickets ✅ 实现完整
  ↓
Service: TicketingService.ts:38-46 → listTickets ✅ 分页
  ↓
Repository: TicketingRepository.ts:154-167 → SELECT * FROM tickets ✅ SQL
  ↓
DB: tickets 表 (migration 011) ✅ 存在
```

**Ticket 工作流 (状态转换)**:
```
前端: TicketDetail/index.tsx:266-268 (canResolve/canClose/canAssign 状态判断)
  ↓
前端: ticketing.ts:43-47 → api.post('/v1/tickets/:id/transition', data)
  ↓
路由层: ❌ 未注册 → 404
  ↓
Controller: TicketingController.ts:328-369 → transitionStatus ✅ 完整
  ↓
Service: TicketService.ts:442-463 → transitionStatus ✅ 事件发布
  ↓
Workflow: TicketWorkflowService.ts:266-335 → transitionStatus ✅ 状态机
  ├── VALID_TRANSITIONS 矩阵 (30-41行)
  ├── ticketingRepository.createWorkflowHistory ✅ 持久化
  └── ticketingRepository.updateSLA ✅ SLA 更新
  ↓
DB: ticket_workflow_history (migration 038) ✅ 存在
    ticket_sla (migration 038) ✅ 存在
```

**SLA 管理**:
```
前端: TicketList/index.tsx:95-128 → calculateSLA (纯前端计算，未对接后端)
  ↓
前端: TicketDetail/index.tsx:124-159 → calculateSLA (前端本地计算)
  ↓
后端: TicketingController.ts:725-766 → addSLATarget ✅
后端: TicketingController.ts:770-789 → getTicketSLA ✅
后端: TicketingController.ts:793-809 → getSLACompliance ✅
  ↓
Service: TicketWorkflowService.ts:66-67 → slaTargets (⚠️ 内存配置)
Service: TicketWorkflowService.ts:46-51 → DEFAULT_SLA_TARGETS (硬编码)
  ↓
Repository: TicketingRepository.ts:470-479 → createSLA ✅
Repository: TicketingRepository.ts:492-503 → updateSLA ✅
  ↓
DB: ticket_sla 表 (migration 038) ✅ 存在
```

**分派与报表**:
```
前端: DispatchPanel.tsx → getQueueStatus / autoDispatch
  ↓
路由层: ❌ 未注册 → 404
  ↓
Controller: TicketingController.ts:868-1883 ✅ 70+ 端点
  ├── Dispatch Endpoints (registerEngineer, autoDispatch, etc.)
  ├── Transfer Endpoints (transferTicket, getTransferHistory)
  ├── Suspend Endpoints (createSuspend, activateSuspend, etc.)
  ├── BI Endpoints (getExecutiveDashboard, getEngineerEfficiency, etc.)
  └── Report Endpoints (getSLACompliance, getBacklogAnalysis, etc.)
```

**前端 TicketList 页面问题**:
- `TicketList/index.tsx:123`: `await new Promise((resolve) => setTimeout(resolve, 1000))` -- CreateTicketModal 使用 setTimeout 模拟 API，**不是真实调用**
- `TicketList/index.tsx:188-232`: 过滤在前端本地执行 (filteredTickets useMemo)，未利用后端分页和过滤
- `TicketList/index.tsx:230-232`: 无真实加载逻辑，依赖 `getTickets` 但实际路由不存在
- `TicketDetail/index.tsx:230-240`: history/relations/transfers 全部是硬编码空数组:
  ```typescript
  const history = useMemo(() => [] as any[], [id]); // 230行
  const relations = useMemo(() => [] as any[], [id]); // 232-234行
  const transfers = useMemo(() => [] as any[], [id]); // 236-238行
  ```

### 2.4 ITSM 专项能力评估

| 能力项 | 状态 | 评分 | 证据 | 对标 ITIL v4 / ServiceNow ITSM |
|--------|------|------|------|-------------------------------|
| **CRUD 完整性** | ⚠️ 部分 | 4/10 | 后端 Service+Controller 完整 (`TicketingService.ts`, `TicketingController.ts`)，DB 表存在，但**路由未注册 = 全部不可达**。前端 CreateTicketModal 使用 setTimeout 模拟 (`CreateTicketModal.tsx:124`) | SN 支持 Incident/Request/Change/Problem 四种工单类型 |
| **SLA 管理** | ⚠️ 部分 | 4/10 | SLA Target 硬编码 (`TicketWorkflowService.ts:46-51`)。SLA tracking 表存在 (migration 038)。违约自动处理存在 (`TicketWorkflowService.ts:511-538` checkAndEscalateOverdue)。但 SLA 策略不可配置(无持久化)，前端 SLA 计算纯本地 (`TicketList/index.tsx:95-128`) | SN 支持可配置 SLA 定义 + 业务日历 |
| **工作流自动化** | ⚠️ 部分 | 5/10 | 状态机完整 (`VALID_TRANSITIONS: TicketWorkflowService.ts:30-41`)。自动分配规则支持 (`TicketWorkflowService.ts:423-451`) 但 AssignmentRules 仅内存 (`TicketWorkflowService.ts:64`)。自动升级 via `setInterval` (`TicketWorkflowService.ts:544-554`)。无审批流 | SN 支持完整 Flow Designer + Approval |
| **知识库关联** | ❌ 缺失 | 0/10 | 无任何 KB 关联逻辑。Knowledge Service 存在但工单模块未关联 | SN ITSM 有 KB 自动推荐 |
| **CMDB 关联** | ❌ 缺失 | 0/10 | Ticket 类型无 CI 关联字段。工单关联配置项功能不存在。影响面分析不可用(依赖 CMDB 模块) | SN 有 CMDB CI 关联工单 |
| **多渠道接入** | ⚠️ 部分 | 4/10 | `TicketSource` 类型支持 manual/alert/incident/api (`types.ts:38`)。NATS 事件订阅实现 (`TicketService.ts:1324-1387`)。但无邮件/Webhook/ChatBot 接入实现 | SN 支持 Email/Web/Chat/Phone/Portal |
| **问题管理 (Problem)** | ⚠️ 部分 | 3/10 | 工单关联支持 5 种关系 (duplicate/caused-by/related/blocks/blocked-by) (`types.ts:163`)。根因关联 (`TicketRelationAnalyzer.ts` + `TicketService.ts:1220-1231`)。但 Problem 不是独立实体，只是 Ticket 的一种关联 | SN 有独立 Problem 实体 |
| **变更工单关联** | ❌ 缺失 | 0/10 | 无变更管理(Change Management)关联逻辑。`config-mgmt-enhanced-routes.ts` 有变更请求但与工单无关联 | SN 有 Change Request ↔ Incident 关联 |
| **满意度调查 (CSAT)** | ❌ 缺失 | 0/10 | 无 CSAT 相关代码。`types.ts` 中有 `customerSatisfactionScore` 字段但无调查流程 | SN 有 Survey Management |
| **权限控制** | ⚠️ 部分 | 3/10 | Controller 无 requirePermission 校验。`routes.ts` 中 ticketing 路由未注册，无权限中间件。Repository 有 tenant_id 字段但无租户过滤逻辑 | SN 有完整的角色+组+ACL |
| **通知规则** | ⚠️ 部分 | 3/10 | NATS 事件发布 (`TicketService.ts:1418-1437`) 存在。Notification Service 存在但未集成。无邮件/Slack/钉钉等多端通知实现 | SN 支持多通道通知 |
| **自动化规则** | ⚠️ 部分 | 4/10 | Dispatch Rules 支持 (`TicketingRepository.ts:295-337`) 有 DB 表。Assignment Rules 仅内存。Escalation 自动规则 via setInterval。但无触发器引擎(条件→动作通用框架) | SN 有 Flow Designer |
| **报表分析** | ⚠️ 部分 | 5/10 | BI 服务完整: `TicketBIService.ts` 有 Executive/Manager/Engineer 三套 Dashboard。`TicketReportService.ts` 有 SLA/Backlog/Trend 报告。但路由未注册=前端不可达 | SN 有 Performance Analytics |

### 2.5 场景逆向验证

**场景: "创建一个 P1 告警工单 → 自动分配 → 查看 → 解决 → 关闭"**

| 步骤 | 预期 | 实际 | 结果 |
|------|------|------|------|
| 1. 告警触发 → NATS 事件 → 自动创建工单 | TicketService.createTicketFromAlert 监听 NATS | `TicketService.ts:1392-1413` handleAlertEvent 实现。但 NATS 连接在 `connectNats()` 中优雅降级（无 NATS 则跳过）。且路由未注册，前端无法手动触发 | ⚠️ NATS 可能未部署 |
| 2. 前端创建工单 (CreateTicketModal) | 调用 `POST /v1/tickets` | `CreateTicketModal.tsx:124`: `setTimeout(resolve, 1000)` 模拟，无真实 API 调用 | ❌ 无真实创建 |
| 3. 前端调用 getTickets 加载列表 | 返回工单列表 | `ticketing.ts:26`: `api.get('/v1/tickets')` → **404** (无路由) | ❌ 404 |
| 4. 自动分配: Dispatch Engine 匹配工程师 | DispatchEngine 按权重计算最佳工程师 | `TicketService.ts:586-645` autoDispatch 实现完整。但路由未注册，工程师注册 API 也不可达 | ❌ 不可用 |
| 5. 查看工单详情: GET /v1/tickets/:id | 返回工单信息 + 历史 + 关联 + 转交记录 | `ticketing.ts:29-31` API 存在，但路由未注册。`TicketDetail/index.tsx:230-240` history/relations/transfers 全部为空数组 | ❌ 404 + 空数据 |
| 6. 解决工单: POST /v1/tickets/:id/resolve | 状态转为 resolved, 记录 SLA resolvedAt | `TicketingController.ts:441-468` 实现完整。但路由未注册 | ❌ 404 |
| 7. 关闭工单: POST /v1/tickets/:id/close | 状态转为 closed | `TicketService.ts:528-530` 实现完整。但路由未注册 | ❌ 404 |
| 8. 关闭后触发 CSAT 满意度调查 | 自动发送调查 | 无 CSAT 逻辑 | ❌ 缺失 |

### 2.6 缺失能力清单

| 优先级 | 缺失能力 | 影响 | 备注 |
|--------|---------|------|------|
| **P0** | 工单路由注册 | **全部功能不可达** | 这是最致命的问题：后端完整实现但前端全部 404 |
| **P0** | CreateTicketModal 使用 setTimeout 模拟 | 创建工单不真实 | `CreateTicketModal.tsx:124` 需要改为真实 API 调用 |
| **P0** | TicketDetail 空数组: history/relations/transfers | 详情页无数据 | `TicketDetail/index.tsx:230-240` 需调用后端 API |
| **P0** | 工单前端过滤本地执行 | 性能差且不准确 | `TicketList/index.tsx:188-232` 应利用后端分页过滤 |
| **P1** | CMDB 关联 (工单关联 CI) | 无法做影响分析 | Ticket 类型无 ciId 字段 |
| **P1** | 知识库关联 | 无法推荐解决方案 | ITIL v4 核心要求 |
| **P1** | CSAT 满意度调查 | 关闭后无反馈收集 | ServiceNow 基础能力 |
| **P1** | 变更管理关联 | Incident ↔ Change 无关联 | ITIL v4 Service Value Chain |
| **P1** | Problem 独立实体 | 无法做多工单合并+根因追踪 | 当前只有 TicketRelation |
| **P1** | 邮件/ChatBot/Webhook 接入 | 仅支持 API + 手动创建 | 多渠道缺失 |
| **P1** | SLA 策略持久化配置 | 硬编码 DEFAULT_SLA_TARGETS | `TicketWorkflowService.ts:46-51` |
| **P1** | Assignment Rules 持久化 | 内存存储 | `TicketWorkflowService.ts:64` |
| **P2** | CI 级别 RBAC | 无 requirePermission 集成 | Controller 层无权限校验 |
| **P2** | 通用触发器引擎 (条件→动作) | 硬编码 escalation/dispatch | 需要规则引擎 |
| **P2** | 工单附件 | 前端 API 有 getAttachments 但后端无实现 | `ticketing.ts:165-167` |
| **P2** | 审批流集成 | 工单无审批环节 | 可集成 approval-routes |

---

## 三、总体结论

### 核心问题: "幽灵模块"现象

CMDB 和 Ticket 两个模块都存在**后端完整实现但路由未注册**的问题。这意味着:

1. **代码实现质量**: 后端 Service 层代码质量较高，类型系统完整，分层清晰
2. **DB 状态**: CMDB 完全无迁移文件，Ticket 有完整迁移
3. **可访问性**: 两个模块对前端来说都是 404，用户完全无法使用
4. **根因**: `routes.ts` 中的注释声称"已迁移到独立服务"或"migrated to orion-ticket-svc"，但这些独立服务不存在

### 修复优先级

| 优先级 | 工作 | 预计工作量 |
|--------|------|-----------|
| P0 (紧急) | 注册 CMDB 路由 + 创建 DB 迁移 | 2-3 天 |
| P0 (紧急) | 注册 Ticket 路由 | 0.5 天 |
| P0 (紧急) | 修复 CreateTicketModal 使用真实 API | 0.5 天 |
| P0 (紧急) | 修复 TicketDetail 加载真实数据 | 1 天 |
| P1 | 创建 CMDB 前端页面 | 3-5 天 |
| P1 | 工单关联 CMDB CI | 2 天 |
| P1 | SLA/Assignment Rules 持久化 | 1-2 天 |
| P2 | CSAT / KB / Problem / 变更关联 | 5-10 天 |
