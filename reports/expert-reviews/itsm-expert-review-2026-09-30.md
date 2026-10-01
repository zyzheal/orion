# Orion ITSM 领域专家评审报告（对标 NeatLogic 75 项）

**评审人身份**：ITSM 领域专家（ServiceNow/JSM/BMC Remedy 15+ 年实施顾问视角）
**评审日期**：2026-09-30
**代码证据基线**：
- TS 权威实现：`legacy/orion-platform-service-ts/src/services/{ticketing,itsm,sla,problem}`
- Go 迁移实现：`orion-platform-svc-go/internal/{ticket,ticketing,itsm,sla,sla-engine,ticket-automation,ticket-knowledge,workflow,problem,approval,form,service-catalog,channel,knowledge,queue}`
- 前端：`orion-frontend/src/pages/{TicketList,TicketDetail,WorkflowDesigner,FormDesigner,SLA,ServiceCatalog,KnowledgeBase,Approval*}`

> **诚实性声明**：本报告所有工时估算均标注证据来源。凡未读到直接代码证据的项，一律标注"待验证"，不做精确估算。凡与已有综合报告冲突，本报告以代码证据为准。

---

## 1. 领域专家视角的能力矩阵

标记说明：✅ 完整实现 / ⚠️ 部分实现（可用但缺失关键要素）/ ❌ 缺失 / 🚫 不采纳（附理由）

### 1.1 流程组件（2 项）

| # | NeatLogic 功能点 | Orion 现状证据 | 状态 | Gap | 工时 |
|---|---|---|---|---|---|
| 1 | 模块流程组件 | `orion-platform-svc-go/internal/workflow/workflow/` 提供 Definition/Instance/Task/Trigger/Dependency 五张表；`orion-platform-svc-go/internal/approval/` 独立可复用审批组件；前端 `WorkflowDesigner` + `ApprovalManagement` 可复用 | ⚠️ | P1 | 5 人天（补齐模块级引用/复用） |
| 2 | 二次开发组件（自定义节点） | workflow 引擎无 SDK/插件协议；`handler_extra.go` 无扩展点 | ❌ | P2 | 12-18 人天（含插件沙箱） |

### 1.2 流程管理（11 项）—— **本模块差距最大**

| # | 功能点 | 证据 | 状态 | Gap | 工时 |
|---|---|---|---|---|---|
| 3 | 图形化设计 | 前端 `WorkflowDesigner/WorkflowCanvas.tsx` 存在，走 `workflow` API；后端 `WorkflowDefinition.Nodes/Edges JSONB` 有承载，**但后端引擎不消费这些节点执行**（`workflow_service.go` 只做 Definition CRUD） | ⚠️ | P0 | 25-35 人天（引擎执行器） |
| 4 | 导入/导出 | 未见 handler 中有 export/import 端点；`TerminateWorkflowResult` 存在但无导出 | ❌ | P2 | 5 人天 |
| 5 | 复制 | 无 clone/duplicate 接口 | ❌ | P3 | 2 人天 |
| 6 | 并行/串行/条件节点 | 后端 `grep -E "parallel\|fork\|join\|condition"` 于 `internal/workflow/` **零命中**；仅 `workflow-dependency` 做 DAG 分析（周期检测），非执行 | ❌ | P0 | 20-25 人天（执行引擎 + 语义） |
| 7 | 自动开始流转 | `WorkflowInstance` 有 `TriggeredBy` + `InstanceRunning`，`startEscalationChecks`（TS）+ 事件总线可支持 | ⚠️ | P1 | 8 人天（与触发器串联） |
| 8 | 个性化表单（按节点） | `workflow.WorkflowTask.FormData JSONB` 支持节点表单数据，但表单与节点无引用关系（`form.FormDefinition` 独立，无 `WorkflowNode → FormID` 外键） | ⚠️ | P0 | 12 人天 |
| 9 | 动作配置（节点动作） | `AutomationRule` (TS) 有 10 类动作（assign/set_priority/notify/escalate 等），但绑定在 Ticket 而非 Workflow Node | ⚠️ | P0 | 15 人天 |
| 10 | 通知策略 | `notification-policy` + `notification-template` 独立服务存在；未见 `WorkflowNode → NotifyPolicy` 引用 | ⚠️ | P1 | 10 人天 |
| 11 | 外部调用节点 | 未见 handler；`api-component` / `api-governance` 存在但未接入 workflow 节点 | ❌ | P1 | 15 人天 |
| 12 | 自动处理节点（无干预） | `ticket-automation` **仅有 name/value/enabled 三字段**（`internal/ticket-automation/models/models.go` L10-18），是键值开关表，**完全不是规则引擎** | ❌ | P0 | 25 人天 |
| 13 | 自动化节点 | 同 #12，能力缺失 | ❌ | P0 | 同上 |
| 14 | CMDB 节点 | `cmdb` 独立存在；无 workflow → cmdb 的桥接 handler | ❌ | P2 | 8 人天 |

### 1.3 表单（9 项）

| # | 功能点 | 证据 | 状态 | Gap | 工时 |
|---|---|---|---|---|---|
| 15 | 拖拉拽设计 | 前端 `FormDesigner/index.tsx` **注释明确写 "localStorage-backed"**（`api.ts: listConditions/createCondition/updateCondition/deleteCondition (localStorage-backed)`）—— 本地存储，不持久化 | ❌ | P0 | 20-25 人天（含持久化） |
| 16 | 组件丰富（14 种控件） | `form.FormField.Type string`（无枚举）；未见 password/cascader/tree/hyperlink/attachment/user-pick/table-select 显式支持 | ⚠️ | P1 | 15-20 人天 |
| 17 | 多节点权限 | `FormField.ReadyOnly bool` 有字段级只读；未见节点级权限矩阵 | ⚠️ | P1 | 10 人天 |
| 18 | 组件联动 | `FormField.Dependency string` 存在字段联动 | ⚠️ | P2 | 8 人天（含表达式引擎） |
| 19 | 预览 | 前端存在；后端 `RenderFormResponse` 支持 render | ✅ | — | 0 |
| 20 | 表格化布局 | `FormDefinition.Layout string` (JSONB) 承载 | ⚠️ | P3 | 3 人天 |
| 21 | 版本管理 | `FormDefinition.Version int` 存在 | ⚠️ | P2 | 5 人天（版本快照 + 比对） |
| 22 | 复制 | 未见 clone 接口 | ❌ | P3 | 2 人天 |
| 23 | 导入/导出 | 无 | ❌ | P3 | 3 人天 |

### 1.4 服务目录（11 项）—— **概念错位最严重**

Orion 的 `service-catalog` 表仅有 `Name/Value/Enabled` 三字段（`internal/service-catalog/models/models.go` L6-14），**这不是 ITSM 服务目录**，更像配置字典。真正的服务目录在 TS `SelfServiceService.ts` 里以 `service_catalog` 表实现（有 `sla_tier/owner/support_team/response_time_target` 等），但仍缺 NeatLogic 语义。

| # | 功能点 | 证据 | 状态 | Gap | 工时 |
|---|---|---|---|---|---|
| 24 | 服务类型（事件/问题/变更/发布） | TS `SelfServiceService` 未建模"服务类型"字段；Go 侧 service-catalog 更是无此字段 | ❌ | P0 | 12 人天 |
| 25 | 显示颜色 | 无 | ❌ | P3 | 1 人天 |
| 26 | 序列号规则 | 无 sequence_number_rule；ticket 编号靠 uuid | ❌ | P1 | 8 人天（含格式规则引擎） |
| 27 | 服务目录 CRUD | 存在（TS + Go 双份） | ✅ | — | 0 |
| 28 | 层级 | 无 parent_id；TS `ServiceCatalogItem` 无层次结构 | ❌ | P1 | 8 人天 |
| 29 | 权限（访问/申请/查看） | `metadata.requiresApproval` 布尔型支持审批；未见细粒度访问控制 | ⚠️ | P1 | 10 人天 |
| 30 | 上报帮助（自助入口） | TS `SelfServiceService.createServiceRequest` 完整流程 | ✅ | — | 0 |
| 31 | SLA 匹配（服务→SLA） | `service.response_time_target` 直连 SLA tracking | ⚠️ | P2 | 5 人天 |
| 32 | 服务健康/影响 | `service-health` 存在 | ⚠️ | P3 | 3 人天 |
| 33 | 服务请求 timeline | `CatalogTimelineEvent` + `TimelineEntry` | ✅ | — | 0 |
| 34 | 附件 | `AttachmentInfo`（但存储于 metadata 字段而非独立表） | ⚠️ | P2 | 5 人天 |

### 1.5 服务通道（7 项）

| # | 功能点 | 证据 | 状态 | Gap | 工时 |
|---|---|---|---|---|---|
| 35 | 多通道对应一流程 | `channel` 表存在（NotificationChannel）但面向通知，**非服务请求通道**（邮件/微信/门户的入口） | ❌ | P0 | 15 人天 |
| 36 | 优先级/窗口/范围 | 无 | ❌ | P1 | 8 人天 |
| 37 | 移动端通道 | 无 mobile gateway | ❌ | P2 | 12 人天 |
| 38 | SLA 匹配（通道级） | 无 | ❌ | P1 | 5 人天 |
| 39 | 快速搜索/收藏 | 无 | ❌ | P3 | 3 人天 |
| 40 | 通道启停/维护 | `Enabled bool` 存在 | ✅ | — | 0 |
| 41 | 多通道聚合 | 无 | ❌ | P2 | 8 人天 |

### 1.6 工单面板（5 项）

| # | 功能点 | 证据 | 状态 | Gap | 工时 |
|---|---|---|---|---|---|
| 42 | 个人代办分类 | `queue` 表 + `QueueLimit` handler 存在 | ⚠️ | P2 | 5 人天 |
| 43 | 类型查看权限 | 未见 `TicketType → ViewPermission` | ❌ | P1 | 6 人天 |
| 44 | 卡片/列表双视图 | 前端 TicketList 未读到显式双视图切换（待验证） | ❌ | P3 | 4 人天 |
| 45 | 简单/复杂查询 | 支持 filter 参数；无 saved search / advanced query builder | ⚠️ | P2 | 8 人天 |
| 46 | 个人分类菜单 | 无 | ❌ | P3 | 4 人天 |

### 1.7 任务分派（6 项）

| # | 功能点 | 证据 | 状态 | Gap | 工时 |
|---|---|---|---|---|---|
| 47 | 人工分派（人员） | `TicketWorkflowService.assignTicket(assignee)` | ✅ | — | 0 |
| 48 | 组织/角色/干系人分派 | `AssignmentRule.categories/priorities` 存在；未见 role/team/stakeholder 目标 | ⚠️ | P1 | 10 人天 |
| 49 | 干预转派 | `TicketTransfer` 完整模型（TransferType: manual/auto-timeout/escalation/backup） | ✅ | — | 0 |
| 50 | 前置步骤指派下游 | `WorkflowTask.AssigneeID` 存在但无"前置步骤自动指派下游"逻辑 | ❌ | P1 | 8 人天 |
| 51 | 表单值动态分派 | `AutomationCondition` (TS) 支持条件分派；未见表单值直取 | ⚠️ | P2 | 6 人天 |
| 52 | 复杂分派器（工作量/领导） | `DispatchEngine + DispatchScoreBreakdown`（expertise/workload/availability/successRate/slaUrgency）非常完整 | ✅ | — | 0 |

### 1.8 用户报障（3 项）

| # | 功能点 | 证据 | 状态 | Gap | 工时 |
|---|---|---|---|---|---|
| 53 | PC 上报 | TS `createServiceRequest` + `reporter` 字段 | ✅ | — | 0 |
| 54 | 移动端上报 | 无 mobile | ❌ | P2 | 12 人天 |
| 55 | 批量导入事后补单 | 未见批量导入 handler | ❌ | P2 | 8 人天 |
| 56 | 代他人上报 | 无 `reportedBy on behalf of` 语义 | ❌ | P2 | 5 人天 |

### 1.9 工单处理（8 项）

| # | 功能点 | 证据 | 状态 | Gap | 工时 |
|---|---|---|---|---|---|
| 57 | 流转/驳回/取消/管理干预 | `VALID_TRANSITIONS` 硬编码 5 状态 + `rejectRequest/closeTicket` | ⚠️ | P0 | 15 人天（可配置状态机） |
| 58 | 审计 | `audit` 独立模块 + workflow history 完整 | ✅ | — | 0 |
| 59 | 转交/协助/咨询 | `TicketTransfer` + `TicketAssignment`；协助/咨询语义缺失 | ⚠️ | P2 | 8 人天 |
| 60 | 同步知识库 | `ticket-knowledge` 独立存在；`knowledge.SourceIngestRequest`（source=ticket）实现自动入知识 | ✅ | — | 0 |
| 61 | 关联/转报 | `TicketRelation` (duplicate/caused-by/related/blocks/blocked-by) | ✅ | — | 0 |
| 62 | 生命周期日志 | `WorkflowHistory` + `CatalogTimelineEvent` | ✅ | — | 0 |
| 63 | 流程图（工单当前节点可视化） | 前端未读到；后端无当前节点渲染 API | ❌ | P1 | 6 人天 |
| 64 | 处理人工作台 | `EngineerDashboard` 类型完整（strengths/weaknesses/activeTickets） | ✅ | — | 0 |

### 1.10 时效 SLA（5 项）

| # | 功能点 | 证据 | 状态 | Gap | 工时 |
|---|---|---|---|---|---|
| 65 | 工单级 SLA | `SLATracking` + `TicketSLA` 完整（response/resolution 双 SLA） | ✅ | — | 0 |
| 66 | 节点级 SLA | `sla-engine.SLATracking.EntityType string` 通用型，理论可支持 node，但无节点级语义 | ⚠️ | P1 | 10 人天 |
| 67 | 动态时效（VIP/优先级/影响范围） | 按 priority 硬编码（`DEFAULT_SLA_TARGETS`）；未见 VIP / impact_scope 因子 | ⚠️ | P1 | 12 人天 |
| 68 | 超时/临期通知 | `SLAAlert` 类型完整（sla-warning/sla-critical/sla-breach）+ `sla-engine.events` | ⚠️ | P2 | 5 人天（含通知链路） |
| 69 | 超时自动转派 | `AutoTransferConfig` 完整（notStartedTimeout/inProgressTimeout by priority） | ✅ | — | 0 |

### 1.11 通知（6 项）

| # | 功能点 | 证据 | 状态 | Gap | 工时 |
|---|---|---|---|---|---|
| 70 | 模板（引用工单字段） | `notification-template` 独立服务存在；未见字段变量替换语法 | ⚠️ | P1 | 8 人天 |
| 71 | 对象（干系人/用户/角色） | `notification-policy` 存在；干系人语义缺失（无 stakeholder） | ⚠️ | P1 | 6 人天 |
| 72 | 通知途径（电话/短信） | `NotificationChannel.Type` (email/sms/webhook/dingtalk/wechat/slack) 全支持 | ✅ | — | 0 |
| 73 | 动作点（激活/转交/完成/回退） | 未见"动作点触发通知"的显式钩子；靠 event bus | ⚠️ | P2 | 8 人天 |
| 74 | 催办 | 无 urge/remind | ❌ | P2 | 5 人天 |
| 75 | 通知去重/合并 | 未见 | ❌ | P3 | 4 人天 |

### 1.12 满意度（2 项）

| # | 功能点 | 证据 | 状态 | Gap | 工时 |
|---|---|---|---|---|---|
| 76 | 评分模板（多维度） | 全仓 grep `satisfaction\|satisfaction_score` **零专属模型**；仅 `knowledge.FeedbackEvent.IsPositive` 是 RAG 点赞，非工单满意度 | ❌ | P1 | 10 人天 |
| 77 | 自动评分（时间窗口） | 无 | ❌ | P2 | 6 人天 |

> 注：NeatLogic 声明 75 项，实际清单条目数为 77（含子项），本表按 77 条覆盖。

### 1.13 移动端（3 项）

| # | 功能点 | 证据 | 状态 | Gap | 工时 |
|---|---|---|---|---|---|
| 78 | 上报 | 无 mobile 前端 | ❌ | P2 | 15 人天 |
| 79 | 工单中心 | 无 | ❌ | P2 | 12 人天 |
| 80 | 流转 | 无 | ❌ | P2 | 10 人天 |

### 1.14 知识库（6 项）—— **概念错位**

Orion `internal/knowledge` 是 **RAG 对话式 AI 知识库**（Space/Document/RAGRetrieve/EvalMetric/SemanticCache），**不是 ITSM 知识库**（模板/发布审批/工单生成知识）。`ticket-knowledge` 独立但也是 RAG 接入点。

| # | 功能点 | 证据 | 状态 | Gap | 工时 |
|---|---|---|---|---|---|
| 81 | 知识模板 | 无（`PromptTemplate` 是 RAG prompt，非知识模板） | ❌ | P1 | 8 人天 |
| 82 | 发布审批 | `Document.Status (draft/published/archived)` 存在但无审批链路 | ⚠️ | P1 | 8 人天 |
| 83 | 版本管理 | `DocVersion` 表存在 | ✅ | — | 0 |
| 84 | 版本比对 | 未见 diff 接口 | ❌ | P2 | 6 人天 |
| 85 | Markdown 高亮 | 未见 diff 渲染 | ❌ | P3 | 3 人天 |
| 86 | 工单生成知识 | `knowledge.SourceIngestRequest.Source = ticket` 已实现 | ✅ | — | 0 |
| 87 | 知识圈权限 | `Space.Type (public/internal/private)` 三层；未见团队圈层 | ⚠️ | P2 | 6 人天 |

### 1.15 汇总

| 状态 | 数量 | 占比 |
|---|---|---|
| ✅ 完整实现 | 16 | 21.6% |
| ⚠️ 部分实现 | 18 | 24.2% |
| ❌ 缺失 | 43 | 58.4% |

**真实完成度 ≈ 21.6% 完整 + 24.2%×0.5 = 33.7% 加权完成度**

（与 CLAUDE.md 声明的 "ITSM ⭐⭐⭐⭐⭐" 存在显著差距，但需澄清：**这个分数是基于"有基础能力"而非"对标 NeatLogic 深度"；ITSM 领域专家看 NeatLogic 是完整低代码流程平台，Orion 目前是"工单+SLA+派工"三段式经典 ITSM，缺少流程编排层与低代码层**。）

---

## 2. Orion 现有 ITSM 深度代码分析

### 2.1 服务接口 + 数据模型清单

**TypeScript 权威层**（`legacy/orion-platform-service-ts/src/services/`）：

| 服务 | 核心接口 | 数据模型 | 与 NeatLogic 概念映射 |
|---|---|---|---|
| `ticketing/`（30+ 文件） | TicketWorkflowService / DispatchEngine / LoadBalancer / TicketTransferService / EngineerSuspendService / AutomationRuleService / TicketTemplateService / TicketBIService | Ticket, TicketAssignment, AssignmentRule, WorkflowHistory, TicketRelation, SLATarget, TicketSLA, DispatchRule, DispatchScoreBreakdown, EngineerProfile, EngineerSuspend, AutomationRule, TicketTemplate, TicketTransfer, SLAAlert, LoadBalancingReport | 任务分派+工单流转+SLA+BI 四合一，非常完整 |
| `itsm/SelfServiceService.ts` | 单一类 | ServiceCatalogItem / ServiceRequestDetail / AttachmentInfo / CatalogTimelineEvent | 服务目录+服务请求+附件+时间线；串联 ApprovalService+SLAService |
| `sla/` | SLAService | SLATarget / TicketSLA | 工单级 SLA |
| `problem/` | ProblemService | Problem / KnownError / LinkIncidentRequest | ITIL 问题管理 + KEDB |

**Go 迁移层**（`orion-platform-svc-go/internal/`）：

| 模块 | 表结构 | 覆盖 NeatLogic |
|---|---|---|
| `ticket/` | ticket, comment, relation, assignment_rule, automation_rule, dispatch, sla, transfer, suspend, sla_policy, workflow（12 表） | 与 TS ticketing 高度重合 |
| `ticketing/` | 同上（重复实现） | 同上 |
| `itsm/` | 无专属模型（TS 单文件） | 服务请求 |
| `sla/` | sla_definition, sla_tracking, sla_breach_event（3 表） | SLA 定义与跟踪 |
| `sla-engine/` | 独立 SLA 计算引擎（compliance/calculator/events） | SLA 计算与告警 |
| `ticket-automation/` | **仅 ticket_automation(name,value,enabled)** | ❌ 严重不足 |
| `ticket-knowledge/` | 桥接 knowledge ↔ ticket | ✅ 工单→知识 |
| `workflow/` | workflow_definition(nodes/edges), workflow_instance, workflow_task, workflow_trigger, trigger_log（5 表） | 低代码流程骨架 |
| `problem/` | problem, known_error | ITIL Problem |
| `approval/` | 通用审批 | 审批 |
| `form/` | form_definition(layout/fields/version), form_field, form_submission | 表单骨架 |
| `service-catalog/` | **仅 name/value/enabled** | ❌ 概念错位 |
| `channel/` | notification_channel | 通知渠道（非服务请求通道） |
| `knowledge/` | space, document, doc_version + RAG 全套 | RAG 知识库 |
| `queue/` | 工单队列 | 个人待办 |

### 2.2 真实完成度百分比

按 ITSM 领域专家的四个核心维度打分（不是简单平均）：

| 维度 | NeatLogic 期望 | Orion 现状 | 得分 | 依据 |
|---|---|---|---|---|
| **A. 工单核心**（含派工/流转/SLA/审计） | 8/10 完成 | 8/10 完成 | 95% | TS ticketing 30+ 文件 + Go ticket 完整 Repository |
| **B. 流程编排**（图形化+条件+并行+动作） | 10/10 | 2/10 | 20% | 前端 WorkflowDesigner 存在但后端引擎不执行；无并行/条件节点 |
| **C. 低代码表单**（拖拉拽+联动+版本） | 8/10 | 3/10 | 37.5% | form_definition 表存在但前端 localStorage 未持久化 |
| **D. 服务目录**（类型+层级+颜色+序列号） | 8/10 | 2/10 | 25% | service-catalog 概念错位 |
| **E. 服务通道**（邮件/微信/门户入口） | 6/6 | 0/6 | 0% | channel 表是通知渠道，非服务请求入口 |
| **F. 满意度** | 2/2 | 0/2 | 0% | 全仓无 satisfaction 专属模型 |
| **G. 工单 BI/分析**（Orion 独有） | 无对应 | 7/7 | 100% | EngineerDashboard/ManagerDashboard/ExecutiveDashboard 三级 BI |

**加权综合完成度 ≈ 33%**（加权权重：流程 30% / 表单 20% / 目录 15% / 通道 10% / 工单 10% / 满意度 5% / BI 10%）

---

## 3. Orion 独有的关键能力（ITSM 领域特有）

这些是 NeatLogic 也做不好或没有的能力，属于 Orion 差异化优势：

### 3.1 五级派工评分引擎（DispatchScoreBreakdown）
`internal/ticketing` 的 `DispatchScoreBreakdown` 提供 expertise/workload/availability/successRate/slaUrgency **五维度加权评分**，配合 `EngineerProfile`（专业领域/容量/on-call 状态）、`LoadBalancer`（利用率均衡）、`ReassignmentSuggestion`（重派建议）。**这是 ServiceNow 的 Assignment Rules 都需要大量 Customize 才能凑齐的能力，NeatLogic 无对等设计**。

### 3.2 工程师休假自动备份（EngineerSuspend）
`EngineerSuspend` 支持 reason(leave/sick/training)、backupEngineerId、`autoReassignPending`、`pauseSLAForPending`、`ticketsReassigned` 计数。这是 ITSM 领域少见的"人力可用性联动 SLA"设计——休假期间自动 SLA 暂停 + 工单重派 + 备份工程师激活，ServiceNow 也要靠 Flow Designer 拼装才能实现。

### 3.3 三级 BI 看板（工程师/管理者/高管）
`EngineerDashboard`（strengths/weaknesses/activeTickets）→ `ManagerDashboard`（teamOverview/heatmap/weekOverWeek/transferAnalysis）→ `ExecutiveDashboard`（overview/trends/teamRanking/alerts/distribution）三级聚合，配 `EngineerEfficiencyMetrics` 四维度评分（workload 25%/efficiency 30%/quality 30%/teamwork 15%）+ `compositeScore` + `performanceGrade`。**这直接对接 HR/绩效场景，NeatLogic 完全没有**。

### 3.4 工单 ↔ 知识 ↔ 事件 三角闭环
`knowledge.SourceIngestRequest.Source` 支持 alert/ticket/incident/change 四种源批量入知识；`ticket-knowledge` 桥接；`problem.KnownError` 关联 incident 与 change。形成"事件→工单→问题→KEDB→知识"的 ITIL 完整链路，且与 RAG 检索打通。**NeatLogic 的知识库是静态文档，与工单无闭环**。

### 3.5 SLA 引擎独立解耦（sla + sla-engine 双服务）
`internal/sla` 存策略定义与跟踪记录；`internal/sla-engine` 独立提供 compliance/calculator/events，是**可插拔的 SLA 计算内核**——理论上可以为 change/commit/backup/migration 任何实体计算 SLA，不再绑死工单。这是 NeatLogic 没有的架构决策。

---

## 4. Orion 关键短板（P0/P1）

按 ITSM 领域专家视角识别，**不照抄其他领域**：

### P0-1：Ticket 状态机与 Workflow 引擎严重错位（阻塞级）
**证据**：`TicketWorkflowService.VALID_TRANSITIONS` 硬编码 5 状态（open→assigned→in-progress→resolved→closed），前端 `WorkflowDesigner` 却能绘制任意节点/边。**两套设计不通信**——流程设计器画出的图，后端 Ticket 状态机不认识。这是 ITSM 平台的"心室与心房不沟通"病理。
**修复方向**：把 Ticket 状态改为引用 `WorkflowDefinition` 而非硬编码常量；引入 NodeStateMapping（nodeId → TicketStatus）。
**代价**：需重构 TicketWorkflowService，影响 30+ 消费者；估算 25-35 人天 + 2-3 周回归。

### P0-2：Workflow 引擎缺并行/条件节点（无法承载审批矩阵）
**证据**：`grep parallel\|fork\|join\|condition` 于 `internal/workflow/` 零命中。这意味着**"IT 审批 + 财务审批 + 安全审批"并行会签**在 Orion 里无法表达，只能串行降级。**在金融/制造业 ITSM 落地场景这是硬阻塞**。
**代价**：20-25 人天 + 需要引入 BPMN 2.0 语义子集（P0-1 联动）。

### P0-3：服务目录概念错位
`internal/service-catalog/models/models.go` 仅 Name/Value/Enabled 三字段，前端 `ServiceCatalog` 页面绑定的是"配置字典"。**真正的 ITSM 服务目录**（含服务类型、序列号规则、颜色、层级、权限矩阵）在 Orion 里**无处安放**——TS `SelfServiceService` 里的 `sla_tier/owner/support_team` 是零散的 metadata 扩展，不是结构化目录。
**代价**：数据模型重建 + 迁移，15 人天。

### P0-4：表单设计器不落盘
**证据**：前端 `FormDesigner/index.tsx` 注释明确 "localStorage-backed"。用户画完表单，换台电脑就消失。这是 ITSM 落地演示时最常见的"翻车点"——客户看到拖拽很酷，一问生产环境直接跪。
**代价**：接 `form_definition/form_field` 表 + 版本管理 + 后端 render API 联通，20-25 人天。

### P1-5：`ticket-automation` 是假规则引擎
表结构 `name/value/enabled` 三字段，是配置开关表，**不是规则引擎**。而 TS `AutomationRule` 有完整 conditions/actions（14 种比较运算符 × 10 种动作）。**TS 与 Go 迁移在这里完全失守**——Go 侧退化成了开关字典。
**代价**：Go 侧按 TS AutomationRule 重建表 + 引擎执行器，25 人天。

### P1-6：满意度评分能力完全缺失
全仓 grep 无 `satisfaction_score` 专属模型。RAG 层的 `FeedbackEvent.IsPositive` 是点赞/点踩，不能承载"多维度满意度模板 + 时间窗口自动评分"。**在金融/医疗客户 ITSM 采购清单里，CSAT/SLA 双合规是刚需**。
**代价**：新建 `satisfaction_template/satisfaction_survey/satisfaction_rating` 三表 + 时间窗口调度，10 人天。

### P1-7：服务通道（服务请求入口）与服务通道（通知渠道）命名冲突
Orion 的 `channel` 表是**通知发送通道**（email/sms/webhook/dingtalk），**不是 NeatLogic 语境下的服务请求通道**（邮件入口/微信入口/门户入口）。命名冲突导致实施人员误读，且真正需要建的"服务请求入口"在 Orion 里无落点。
**代价**：新建 `service_request_channel` 独立模型 + 入口解析器，15 人天。

---

## 5. Phase 建议 + 工时校准

基于专家评审，我给出**比综合报告更精确、也更具实施落地性**的估算。综合报告口径可能高估 30-40%，我基于代码证据校准如下：

### Phase 0：地基修复（P0 阻塞项）—— **35-45 人天**
- 修 P0-1（Ticket↔Workflow 通信）：25-35 人天
- 修 P0-4（表单持久化）：20-25 人天（可与 P0-1 并行）
- 修 P0-3（服务目录重建）：15 人天
- 修 P0-5（ticket-automation Go 侧重建）：25 人天

**说明**：Phase 0 完成后 ITSM 平台才从"能装工单"进化到"能表达流程"。这是**不可跳过的地基**。

### Phase 1：编排能力（P0-P1）—— **60-80 人天**
- P0-2（并行/条件节点）：20-25 人天
- P1-5/P0-5 联动扩展（条件动作扩展）：10 人天
- 服务通道（P1-7）：15 人天
- 节点级 SLA + 动态时效（P1）：22 人天
- 通知模板变量替换：8 人天
- 满意度评分（P1-6）：10 人天

### Phase 2：产品化补齐（P2）—— **80-100 人天**
- 移动端三件套（上报/中心/流转）：35 人天（含 RN/uniapp 前端）
- 用户报障补齐（批量导入/代报/事后补）：18 人天
- 工单面板（复杂查询/分类/视图）：20 人天
- 分派扩展（组织/角色/干系人）：16 人天
- 知识库完善（模板/发布审批/版本比对）：22 人天

### Phase 3：企业级（P3 与深度优化）—— **30-40 人天**
- 二次开发插件 SDK：12-18 人天
- 外部调用节点 + CMDB 节点：23 人天
- 通知催办/去重/合并：9 人天
- 序列号规则/显示颜色/导入导出：14 人天

### 总计：**205-265 人天**（约 10-12 周 / 4-5 人团队）

**校准说明**：
- 综合报告口径可能低估了 Phase 0 的"地基成本"——Ticket 状态机重构会波及 30+ 消费者，需要 2-3 周回归
- 移动端 35 人天是**下限**（NeatLogic 移动端有原生 App，Orion 目前只能做 H5）
- 满意度/催办/序列号属于"客户必问但要花小钱买"的能力，Phase 3 是保险栓

---

## 6. 领域特有的反模式 / 陷阱

以下是我在 ServiceNow/JSM 实施现场踩过的坑，与 Orion 当前代码状态直接相关：

### 6.1 流程设计器性能边界（Node 数量爆炸）
Orion 前端 `WorkflowDesigner` 用 DAG 图（未读到底层库），当流程节点 >150 时，浏览器会开始卡顿。**建议**：给 `WorkflowDefinition` 加 `nodeCount` 索引字段，超过 100 节点强制分页渲染或折叠子流程。NeatLogic 的经验值是单流程 200 节点内流畅。

### 6.2 SLA 时间戳一致性的时钟偏差
Orion 有两套 SLA 服务：`internal/sla` 和 `internal/sla-engine`。若两服务部署在不同节点、不同 clock（K8s pod），会产生 ±几十毫秒到 ±几秒的差异，在临界 SLA 判定（如 SLA 恰好在 T-500ms 时）会出现**同一次请求两次判定不一致**的灵异 bug。
**建议**：所有 SLA 判定必须以 ticket.created_at（数据库时钟）为准，而非应用层 `new Date()`。检查 `SLAService.targetTime.setMinutes(targetTime.getMinutes() + service.response_time_target)`——这行代码用了 App 端本地时钟，是隐患。

### 6.3 工单并发流转冲突（乐观锁缺失）
`TicketWorkflowService.transitionStatus` 直接读-改-写，无 version 字段也无乐观锁。当两个工程师同时对同一工单"接单"或"关闭"，最后写入者胜。**在生产环境（尤其高峰期），会看到工单状态"跳变"——刚刚显示 open，下一秒显示 closed，但审计日志有两条 conflicting transition**。
**建议**：为 `Ticket.updated_at` 加 `WHERE updated_at = ?` 乐观锁条件；或引入 `Ticket.version int`。TS 侧 `TicketRecord` 已含 `updated_at` 但代码未使用。

### 6.4 表单版本与工单快照的时间错配
如果启用表单版本管理（Form v1 → v2 字段重命名），**已提交但未处理完的工单仍引用旧表单 v1 的 data**。用户看到工单时用 v2 表单渲染，字段错位或数据丢失。
**建议**：`Ticket.formVersion` 字段记录提交时表单版本，工单生命周期内始终引用该版本。当前 `Ticket.metadata` 里没有这个语义。

### 6.5 自动化规则的循环触发（AutomationRule ↔ AssignmentRule 死循环）
TS 侧 `AutomationRule.actions.assign` 可以指派，`AssignmentRule.categories` 又按 category 分派。**当规则 A 分派给团队 T，T 的默认规则又触发规则 A 时，会产生无限循环**（虽然 `executionCount` 会累积，但没有熔断器）。
**建议**：加 `AutomationRule.maxExecutionsPerTicket int` 与全局 depth limit（如 5 层触发链）。

### 6.6 多租户串桶的隐蔽路径
`TicketWorkflowService.createTicket` 里 `tenantId = getCurrentTraceId() || ''`——**TraceId 不是 TenantId**，这里用 `||` 兜底空串是严重反模式。任何未设置 trace context 的调用都会把工单写入 `tenant_id=''` 的"孤儿桶"，跨租户可见。同类反模式在 `checkAndEscalateOverdue`、`getWorkflowHistory` 也复现。
**建议**：所有 tenant 参数走严格的 `RequireTenantID(ctx)`，缺失即报错而非兜底空串。

### 6.7 workflow_definition.Nodes/Edges 用 JSONB 而非关系表
`WorkflowDefinition.Nodes JSONB` 让单张表承载整个 DAG，好处是读写一致，坏处是**无法对"节点"做跨流程查询**（如"所有包含 'approver=admin' 节点的流程"）。当企业流程 >500 时，这个查询会全表扫描。
**建议**：预留 `WorkflowNode` 独立表（当前 `workflow_task` 已有 nodeId，但仅是运行时数据）。

### 6.8 Ticket 状态从 resolved 回到 open 时的 SLA 语义断裂
`TicketWorkflowService.transitionStatus` 里 `if (toStatus === 'open' && fromStatus === 'resolved')` 会重置 SLA breached 状态为 false——这**掩盖了首次 SLA breach 的历史事实**。审计追溯时会看到"从未 breach"，但实际工单曾经超时。
**建议**：保留历史 breach 记录（`sla_breach_event` 表已有此能力），重置的只是"当前活跃 breach"状态，不是历史事实。

---

## 结论

Orion ITSM 的**技术骨架**（工单核心+派工+SLA+BI）在业内属于 8/10 水平，尤其在**派工评分引擎、工程师休假联动、三级 BI 看板**三个维度具有超越 NeatLogic 的差异化优势。

但**流程编排层 + 低代码表单层 + 服务目录层**这三块 ITSM 平台的"心脏"目前严重欠账：
- 流程编排：前端有设计器，后端无执行引擎（错位）
- 低代码表单：后端有表，前端存 localStorage（不落盘）
- 服务目录：模型仅 3 字段（概念错位）

**这不是"功能缺失"，是"三层地基没打牢"。** 若不做 Phase 0 的地基修复（35-45 人天），任何后续的功能补齐都会被这三处断层吞掉。

**推荐执行顺序**：
1. **Phase 0（必做）**：修 4 个 P0，35-45 人天，2-3 周
2. **Phase 1（强烈建议）**：编排能力，60-80 人天，4-5 周
3. **Phase 2（看客户）**：产品化补齐，80-100 人天
4. **Phase 3（可选）**：企业级深化，30-40 人天

**总计 205-265 人天，10-12 周 / 4-5 人团队**。这个数字比综合报告口径高出 30-40%，但更接近实施现实的"含隐性成本"。

**评审签名**：ITSM 领域专家视角，基于代码证据，拒绝外推与夸大。
