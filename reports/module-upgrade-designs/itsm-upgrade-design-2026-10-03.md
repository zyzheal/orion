# ITSM 升级设计（2026-10-03）

**目标模块**：`orion-platform-svc-go/internal/{ticket,ticketing,workflow,sla,sla-engine,form,channel,queue,knowledge,approval,service-catalog,ticket-automation,workcenter}` + `orion-frontend/src/pages/{EngineerDashboard,ManagerDashboard,ExecutiveDashboard,FormDesigner}`
**基线数据**：`reports/expert-reviews/itsm-expert-rereview-2026-10-01.md`（383 行，独立复评 42%）
**相关报告**：`reports/expert-reviews/itsm-expert-review-2026-09-30.md`（v1 33.7%）+ `itsm-expert-supplement-2026-10-01.md`（v2 30%）

---

## 1. TL;DR

- **当前完成度**：42%（复评中值，置信度 ±5%）
- **目标完成度**：72-75%（补齐 workflow 执行引擎 + SLA 策略管理层 + workcenter + channeltype + 服务目录 + ticket-automation 语法）
- **关键改动**：
  1. **P0-1**：workflow 执行引擎消费 Nodes/Edges（当前只走图分析不遍历节点）
  2. **P0-2**：SLA 策略管理层（新增 SLABreak/SLAException/SLAPolicy/EscalationMatrix/SLAConfig 5 类概念）
  3. **P1-1**：workcenter 模块完全新建（24 API）
  4. **P1-2**：channeltype 元数据新建（channel 本体已有 546 行）
  5. **P2**：ticket-automation 条件-动作语法 + service-catalog SLA 引用/owner/category 层级
- **不动的部分**：DispatchService 520 行（差异化亮点保留）+ SLA 计算引擎 533 行 + 三层 Dashboard + FormDesigner Forms 落库

---

## 2. 当前状态（代码实证）

| 项目 | 位置 | 行数 | 状态 |
|------|------|------|------|
| Ticket 主模块 | `internal/ticket/` | 8280 行 / 16 文件 | ✅ 深度实现 |
| Ticketing（工单） | `internal/ticketing/` | 11857 行 / 状态机 5×13 | ✅ 5 状态 + 13 转换 |
| DispatchService（派工） | `internal/ticket/service/dispatch.go` | 520 行 / 8 方法 | ✅ 差异化亮点 |
| SLA 计算引擎 | `internal/sla-engine/service/calculator.go` | 533 行 | ✅ 真实 |
| SLA 主模块 | `internal/sla/` | 2258 行 | ⚠️ CRUD + 5 类策略概念全缺 |
| Workflow 服务 | `internal/workflow/workflow/service/workflow_service.go` | 523 行 | ⚠️ 分析层消费图，执行层不遍历 |
| Form 后端 | `internal/form/` | 2098 行 | ✅ Forms 落库（仅 Conditions 走 localStorage） |
| Channel | `internal/channel/` | 546 行 / NotificationChannel CRUD | ⚠️ channeltype 元数据缺失 |
| Queue | `internal/queue/` | 765 行 / Queue/Job/Enqueue | ✅ |
| 三层 Dashboard 后端 | `internal/ticket/service/analytics*.go` | 4 方法（4 位置） | ✅ |
| TicketTransfer | `internal/ticket/models/transfer_enhanced.go` | 5 类型 | ✅ manual/auto/timeout/suspend/escalate |
| Service Catalog | `internal/service-catalog/models/models.go` | 3 字段 | ⚠️ 概念正确字段过窄 |
| Ticket Automation | `internal/ticket-automation/models/models.go` | 3 字段 | ⚠️ 缺条件-动作语法 |
| Workcenter | `internal/workcenter/` | — | ❌ **P1 完全缺失** |
| **17 个 ITSM 相关模块** | `ls internal/` | 5.8% | 存在过度拆分（ticket+ticketing 40-50% 重叠） |

---

## 3. NeatLogic 对标差距（Gap 分级）

| Gap 编号 | 能力项 | 分级 | 描述 |
|---------|-------|------|------|
| G0-1 | Workflow 执行引擎消费 Nodes/Edges | **G0** | CreateInstance/CompleteTask 不遍历图，只分析不执行 |
| G0-2 | SLA 策略管理层（5 类概念） | **G0** | SLABreak/Exception/Policy/Matrix/Config 全缺 |
| G0-3 | Workcenter 24 API | **G0** | 完全无模块 |
| G1-1 | channeltype 元数据 | **G1** | channel 本体有，元数据模型无 |
| G1-2 | 服务目录字段扩展（SLA 引用/owner/category 层级/依赖） | **G1** | 3 字段窄 |
| G1-3 | ticket-automation 条件-动作语法 | **G1** | 3 字段窄，无 when/then |
| G1-4 | ticket vs ticketing 合并（40-50% 重叠） | **G1** | 双模块功能重复 |
| G2-1 | FormDesigner Conditions 落库 | **G2** | Forms 已落库，仅 Conditions localStorage |
| G2-2 | Sprint→Project 关联（跨 RDM 域） | **G2** | 见 rdm-upgrade-design |
| G3-1 | 服务目录依赖图（BFS 拓扑） | **G3** | 高级能力，非近期目标 |

---

## 4. 升级目标

### 4.1 架构层

- **Workflow 执行引擎升级**：从"分析层消费 Nodes/Edges"扩展到"执行层遍历节点图"
  - CreateInstance：初始化时构建执行上下文，遍历起始节点
  - CompleteTask：完成后触发下一节点（依赖 Edge 定义的 successor）
  - 保留 AnalyzeDependencies/CheckDefinition/GetVisualizationData 三个分析函数
- **SLA 策略管理层新增**：5 个新概念 + 5 张表
  - SLAPolicy：策略主表（含 priority/trigger 条件）
  - SLABreak：策略豁免（时段/条件/审批人）
  - SLAException：单次例外（工单级）
  - EscalationMatrix：升级矩阵（时间/严重度→动作）
  - SLAConfig：全局配置（工作时间/假期）
- **Workcenter 模块新建**：24 API，含 workitem/workqueue/workassignment/workflow
- **Ticket+Ticketing 合并**：Ticket 为主，Ticketing 保留工单领域特有逻辑（状态机+关系），去重后统一路由

### 4.2 数据模型层

新增 Migration 706-712：
- `706_itsm_sla_policies.sql`：SLA 策略
- `707_itsm_sla_breaks.sql`：策略豁免
- `708_itsm_sla_exceptions.sql`：单次例外
- `709_itsm_escalation_matrix.sql`：升级矩阵
- `710_itsm_workcenter_tables.sql`：workcenter 4 表（workitem/queue/assignment/assignment_history）
- `711_itsm_channel_types.sql`：channeltype 元数据
- `712_itsm_service_catalog_ext.sql`：服务目录扩展字段（sla_id/owner_id/category_id/dependencies）

### 4.3 API 层

- `/api/v1/itsm/sla/policies`：6 端点（CRUD + preview + validate）
- `/api/v1/itsm/sla/matrix`：4 端点
- `/api/v1/itsm/workcenter/*`：24 端点
- `/api/v1/itsm/channel-types`：4 端点
- `/api/v1/itsm/service-catalog/dependencies`：3 端点

---

## 5. 依赖链

### 5.1 前置模块

- **CMDB**：ITSM 工单常关联 CI 资源（`cmdb_ci_relations` 已建）
- **Alert**：ITSM Incident 可从告警升级而来（`alert-escalation` 445 行已就绪）
- **Approval**：SLABreak 审批需 approval 模块（10 Go 文件已存在）

### 5.2 复用组件

| 组件 | 用途 |
|------|------|
| `internal/notification/` | ITSM 工单通知 |
| `internal/audit/` | 工单变更审计 |
| `internal/form/` | 工单表单 |
| `internal/queue/` | 派工队列 |
| `internal/channel/` | 通知渠道本体 |

### 5.3 下游消费者

- **Alert Escalation**：`alert-escalation` 升级策略可触发 ITSM Incident
- **RDM**：Sprint 中的 bug 从 ITSM Ticket 转入（TicketRelation 已实现）
- **BI**：SLA 报表、Dashboard 数据源

---

## 6. 实施步骤

### 阶段 1：SLA 策略管理层（G0，独立）

1. 定义 5 个新概念模型（SLAPolicy/SLABreak/SLAException/EscalationMatrix/SLAConfig）
2. Migration 706-709
3. 新建 `internal/sla/service/policy.go`，5 方法（List/Get/Create/Update/Delete Policy）
4. 新建 `internal/sla/service/break.go`，4 方法（CRUD Break）
5. 新建 `internal/sla/service/matrix.go`，3 方法（CRUD Matrix）
6. 现有 calculator.go 533 行接入 Policy（原本硬编码工作时间）
7. Handler 层暴露 14 端点

### 阶段 2：Workflow 执行引擎升级（G0）

1. 分析现有 `workflow_service.go` 331/370/406 行分析函数的 Nodes/Edges 数据结构
2. 新建 `workflow_engine.go`，实现：
   - `StartInstance(ctx, defID)`：从起始节点构建执行上下文
   - `CompleteNode(ctx, instanceID, nodeID)`：完成后按 Edge 找到 successor 触发
   - `SkipNode`/`RollbackNode`（可选，v2 增强）
3. 状态机与 workflow 联动：CompleteNode 内部触发 TicketTransition（复用已有 validTransitions）
4. 保留 331/370/406 分析函数不变
5. Migration：workflow_instances 增加 current_node_id / node_history 字段

### 阶段 3：Workcenter 模块新建（G0）

1. 新建 `internal/workcenter/` 目录
2. Models：WorkItem / WorkQueue / WorkAssignment / WorkAssignmentHistory（4 表）
3. Service：WorkItemService（CRUD）+ WorkQueueService（Enqueue/Dequeue）+ AssignmentService
4. Handler：24 端点
5. Migration 710
6. 与 ticket 模块桥接：WorkItem.Type = "ticket" 时映射到 ticket 表

### 阶段 4：Ticket + Ticketing 合并（G1）

1. 建立映射表：Ticket(8280 行) 为主，Ticketing(11857 行) 中的状态机/关系模型作为子模块
2. Ticket 主表扩展 RDM 字段（parent_id/sprint_id/repo_ref/labels/story_points 6 字段）
3. 保留 TicketRelation（4 种 rel_type + DetectDuplicates）
4. 统一路由 `/api/v1/tickets/*`（原 /ticketing 与 /ticket 二选一合并）
5. 迁移脚本：将 ticketing_tickets 表数据同步到 tickets 表

### 阶段 5：Channeltype + Service Catalog 补齐（G1）

1. Channeltype 元数据模型：ID/TenantID/Name/Protocol/Templates/RequiredFields
2. Channel 表增加 channel_type_id 外键
3. ServiceCatalog 扩展字段：sla_id / owner_id / category_id / dependencies_json
4. Handler 补齐 7 端点

### 阶段 6：Ticket-Automation 语法升级（G1）

- 从 3 字段升级到完整 when/then：
  - `WhenCondition`：字段 = 值 AND/OR 组合
  - `ThenAction`：CreateTicket / TransitionStatus / AssignTo / Notify / AddComment
- Migration：ticket_automation_rules 增加 condition_json / action_json

---

## 7. 验证方式

### 7.1 grep 验证

```bash
# SLA 策略层
grep -rn "SLAPolicy\|SLABreak\|SLAException\|EscalationMatrix\|SLAConfig" internal/sla/
# 期望：>50 命中

# Workflow 执行引擎
grep -n "StartInstance\|CompleteNode\|ExecuteNode" internal/workflow/workflow/service/
# 期望：新增 3+ 方法

# Workcenter
find internal/workcenter -name "*.go" | wc -l
# 期望：>8 文件

# Channeltype
grep -n "ChannelType\|channel_type" internal/channel/
# 期望：>10 命中
```

### 7.2 单元测试

- SLA Policy CRUD：6 用例
- SLABreak 时段判定：5 用例
- Workflow StartInstance 遍历起始节点：3 用例
- CompleteNode 触发 successor：4 用例
- Workcenter Enqueue/Dequeue：4 用例
- Ticket→WorkItem 映射：3 用例

### 7.3 e2e 验证

1. 创建 SLA Policy（响应 4h / 解决 24h）
2. 创建 SLABreak（周五 20:00-周一 08:00 除外）
3. 创建 Ticket，触发工单 SLA 计时
4. 24h 未解决 → EscalationMatrix 升级到经理
5. 通过 Workcenter 分配给工程师 → DispatchService 加权评分验证
6. 工单完成 → workflow_history + SLA resolution 双记录

---

## 8. 风险与回滚

### 8.1 主要风险

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| Workflow 执行引擎破坏现有 6 个 extractNodeArray 调用点 | 中 | 高 | 保留原方法，新增 engine 层不改动原有 523 行 |
| SLA Policy 与 calculator.go 533 行整合复杂 | 高 | 高 | 分阶段：先并存两套，calculator 保持独立，新增 PolicyEngine 与之互查 |
| Ticket+Ticketing 合并双写数据 | 中 | 高 | 迁移期双写 + 最终切读，保留回滚开关 |
| Workcenter 与 Ticket 语义重叠 | 中 | 中 | WorkItem.Type 字段区分语义（ticket/task/bug） |
| 前端三层 Dashboard 破坏 | 低 | 中 | Dashboard 数据 API 保持稳定签名 |

### 8.2 回滚策略

- **SLA 策略层回滚**：Migration `migrate down 709`，保留 calculator.go 独立运行
- **Workflow 执行引擎回滚**：调用方降级到原 CreateInstance/CompleteTask
- **Workcenter 回滚**：删除 `internal/workcenter/` + Migration 710
- **Ticket+Ticketing 合并回滚**：切回双路由并存

### 8.3 认知边界

- 未量化 ticket vs ticketing 40-50% 功能重叠的确切重合率（估计值）
- 未验证 workflow 执行引擎升级后前端可视化是否需要同步改造
- NeatLogic Workcenter 具体 24 API 清单来自 v1/v2 报告，未直接读 Java 源码验证
- FormDesigner Conditions 落库的具体表结构未在本设计中细化

---

**文档编号**：`itsm-upgrade-design-2026-10-03.md`
**关联报告**：`itsm-expert-rereview-2026-10-01.md` / `cross-review-synthesis-2026-10-03-v4.md`（当前权威）
**交叉依赖**：Alert（告警→Incident） / RDM（Ticket→Sprint 映射） / BI（SLA 报表） / CMDB（工单关联 CI）
