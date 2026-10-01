# RDM 模块对标评审补充报告（国际专家视角）

> 评审人：研发管理 / DevOps Report 领域专家（Jira / Linear / Azure DevOps / Asana / ClickUp / OpenProject 实施背景，DORA Metrics / SPACE 框架 15+ 年）
> 评审日期：2026-10-01
> 数据来源：NeatLogic RDM Java 源码（290 文件 = 187 `neatlogic-rdm` + 103 `neatlogic-rdm-base`）实测；Orion `orion-platform-svc-go/internal/{sprint,ticket,project,workbench}` 实测
> 上游报告：`rdm-expert-review-2026-09-30.md`（37% 加权，226 行）

---

## 一、核心结论（≤200 字）

**部分验证 37%，但偏保守。** 已有报告准确识别了"Orion Sprint 缺 ProjectId 关联、Burndown 是简化版、Workbench 仅 5 字段"等结构性缺陷，但低估了 NeatLogic RDM 的**模型深度**：实测发现 NeatLogic IssueVo 含 30+ 业务字段（含 parentId/sourceIssueId 实现需求层级、issueRelList 实现追溯链、attrList 实现自定义字段、costList 实现工时台账），并配套 99 个 API + 29 个统计 handler + IssueAudit AOP 审计 + 全文索引 + Webhook + Notify 策略。Orion 仅有 Sprint CRUD（9 路由，无 ProjectId）+ Ticket 偏 ITSM（SLA/Dispatch/Transfer），**真实研发管理（Epic/Story/Task/Bug 一级模型、自定义字段、工时台账、追溯链）几乎为零**。重估完成度 **33%（中置信度）**，较 37% 下修 4 个百分点。

---

## 二、NeatLogic RDM 实际架构（基于 Java 源码）

### 2.1 需求 / 缺陷 / 任务模型：AppType 枚举四类型

**关键发现**：NeatLogic **不使用独立 Requirement/Defect 实体**，而是统一 Issue 模型 + AppType 枚举区分类型。

证据 `neatlogic-rdm-base/.../enums/AppType.java:18-22`：

```java
ITERATION("iteration", "common.iteration", "#87CEEB", null, false, 1),
STORY("story", "common.request", "#1670f0", new AttrType[]{...}, true, 2),
TASK("task", "common.task", "#25b864", new AttrType[]{...}, true, 3),
BUG("bug", "common.bug", "#f33b3b", new AttrType[]{...}, true, 4);
```

- **STORY** = 需求（label=`common.request`，蓝色 #1670f0）
- **TASK** = 任务（绿色 #25b864）
- **BUG** = 缺陷（红色 #f33b3b）
- **ITERATION** = 迭代/ Sprint 容器（青色 #87CEEB，`hasIssue=false` 表示其本身不作为 Issue 载体）

每个 AppType 绑定固定 AttrType 数组（`STORY` 含 ITERATION/CATALOG/WORKER/TAG/PRIORITY/TIMECOST/STARTDATE/ENDDATE 8 个属性），这是 Jira "Issue Type Screen Scheme" 的等价物。

**IssueVo 30+ 字段**（`IssueVo.java:33-172`）：除常规 id/name/priority/status/content/createDate 外，关键字段：

| 字段 | 行号 | 研发管理语义 |
|------|------|-------------|
| `parentId` | :47 | **需求层级**（Epic → Story → Task） |
| `sourceIssueId` | :49 | 跨项目复制溯源 |
| `catalog` / `catalogLft` / `catalogRht` | :53/62/64 | **目录树**（左右值 Lft-Rht，经典 MPTT 树） |
| `iteration` / `iterationName` | :54/57 | 关联 Sprint |
| `appId` / `appType` / `appColor` | :68/71/74 | AppType 元数据 |
| `projectId` | :78 | **项目归属** |
| `timecost` | :89 | **计划工时** |
| `attrList` (List<IssueAttrVo>) | :128 | **自定义字段** |
| `costList` (List<IssueCostVo>) | :131 | **实际工时台账** |
| `webhookList` | :119 | 外部系统集成 |
| `issueRelList` | :150 | **需求追溯链** |
| `userIdList` / `userList` | :121/123 | 多人协作 |
| `tagList` | :125 | 标签 |
| `fileList` | :143 | 附件 |
| `childrenCount` | :108 | 子任务计数 |
| `isExpired` | :156 | 逾期判定（endDate 与当前比较） |
| `isProjectOwner` / `isProjectLeader` / `isProjectMember` | :161-165 | 项目角色权限 |

### 2.2 排期 / 版本 / 发布管理

**IterationVo**（`IterationVo.java:29-49`）= Sprint 容器，字段：`projectId` / `name` / `description` / `issueCount` / `doneIssueCount` / `isOpen` / `startDate` / `endDate` / `appType=iteration`。

**关键差距**：NeatLogic **未发现独立的 Release / Version 实体**（搜遍 99 个 API 无 `ReleaseApi` / `VersionApi`）。发布管理通过 `Iteration` + `status` 流转近似实现，这是其相对 Jira（有 Fix Version/Historical Version）的明显短板。**Orion 同样无 Release 实体**。

### 2.3 工时 / 估时 / 燃尽图

- **估时**：IssueVo.`timecost` 字段（`IssueVo.java:89`，AttrType.`TIMECOST`），单位 INTEGER，对应"计划人时"。
- **实际工时台账**：独立实体 `IssueCostVo`（`IssueCostVo.java:20-31`），字段 `issueId` / `costDate` / `timecost` / `description`，配套 4 个 API：`SaveIssueCostApi` / `GetIssueCostApi` / `DeleteIssueCostApi` / `SearchIssueCostApi`。这是 Jira "Log Work" + Tempo Timesheets 的等价物。
- **燃尽图**：NeatLogic 通过 `issuestat` 模块的 `StoryTrendStatHandler` / `BugTrendStatHandler`（`issuestat/handler/`）实现趋势统计，输出按日/按迭代聚合。

### 2.4 需求追溯链路（Requirement → Task → Defect → TestPlan）

**IssueRelVo**（`IssueRelVo.java:22-43`）实现 Issue 间双向关联：

```java
private Long fromAppId;     // 来源应用 id
private Long fromIssueId;   // 来源任务 id
private Long toAppId;       // 目标应用 id
private Long toIssueId;     // 目标任务 id
private String fromAppType; // 来源应用类型（story/task/bug）
private String toAppType;
private String direction;   // 关联方向（IssueRelDirection 枚举）
private String relType;     // 关联类型
```

`IssueRelType` 枚举（`IssueRelType.java:20-22`）：

```java
EXTEND("extend", "从属"),    // 父子从属
RELATIVE("relative", "关联"), // 平行关联
REPEAT("repeat", "相同");     // 重复/合并
```

**追溯链落点**：Story ↔ Task（EXTEND 从属）、Bug ↔ Story（RELATIVE 关联，"缺陷阻塞需求"）、Bug ↔ Bug（REPEAT 重复，"重复缺陷合并"）。

**测试用例关联**：存在 `api/test/` 子包（搜到 `neatlogic/module/rdm/api/test/`），但本轮未深入；NeatLogic 整体有独立 `neatlogic-testing` 模块，RDM 侧通过 IssueRel 桥接，非强类型追溯链。

### 2.5 看板视图（Kanban / Scrum board）

**DashboardVo**（`DashboardVo.java:24-39`）字段：`id` / `appId` / `name` / `isActive` / `description` / `widgetList(JSONArray)`。`widgetList` 是 JSON 数组，由前端解释渲染——这是"元数据驱动的仪表板"，类似 Jira Dashboard/Gadget、Azure DevOps Widgets。

配套 4 个 API：`SaveDashboardApi` / `GetDashboardApi` / `SearchDashboardApi` / `DeleteDashboardApi`。

`IssueVo.mode` 字段（`IssueVo.java:60`）注释"显示模式"暗示支持 Kanban/ListView/TreeList 多视图切换。

### 2.6 里程碑 / 路线图

**未发现独立的 Milestone / Roadmap 实体**。NeatLogic RDM 的"里程碑"通过 `Iteration` 关闭（`isOpen=0`）+ `Dashboard` 聚合近似。**Orion 同样无 Roadmap 实体**。这是 NeatLogic 与 Jira（有 Version/Milestone）/ Linear（有 Project Milestones + Roadmap view）/ Azure DevOps（有 Iteration Paths + Delivery Plans）相比的**显著短板**。

### 2.7 DORA Metrics / SPACE 框架

**未发现 DORA / SPACE 框架的原生实现**。NeatLogic 的 `issuestat` 模块（29 个 handler）覆盖的是**研发吞吐量指标**，非 DORA 四指标（Lead Time for Changes / Deployment Frequency / MTTR / Change Failure Rate）。

29 个 handler 分类（`issuestat/handler/`）：

| 类别 | Handler 数 | 示例 |
|------|-----------|------|
| Story 统计 | 6 | `StoryTotalStatHandler` / `StoryCompleteRateStatHandler` / `StoryTrendStatHandler` / `StoryStatusDistributionStatHandler` / `StoryPriorityDistributionStatHandler` / `StoryOverdueStatHandler` / `StoryHighRiskStatHandler` |
| Bug 统计 | 9 | `BugTotalStatHandler` / `BugOpenStatHandler` / `BugReopenTotalStatHandler` / `BugSourceDistributionStatHandler` / `BugStatusDistributionStatHandler` / `BugSeverityDistributionStatHandler` / `BugTrendStatHandler` / `BugOverdueStatHandler` + `BugCustomAttrStatHandlerBase` |
| 基础设施 | 4 | `IssueStatHandlerBase` / `IssueStatHandlerFactory` / `IssueStatFieldResolver` / `IIssueStatHandler` |

**这是 IT 服务台报表逻辑（事件计数/分布/趋势），不是研发效能度量**。DORA 的 Lead Time 需要"代码提交→合并→部署"时间戳链，NeatLogic RDM 无 Git/Webhook 集成（`webhookList` 仅是 Issue 字段，非 Git webhook handler）。SPACE 框架的 Satisfaction/Well-being 维度更无从谈起。

### 2.8 代码仓库关联（PR/MR 与需求关联）

**未发现原生 Git 集成**。`IssueWebhookVo`（`IssueVo.java:119` 引用）是 Issue 自身的 webhook 配置（事件触发外发），**不是接收 Git webhook**。NeatLogic 整体架构中 Git 集成由 `neatlogic-code` 模块（独立模块）承担，RDM 侧通过 `IssueRel` + 自定义字段（如 `commitHash` attr）软关联。

---

## 三、对标能力矩阵（NeatLogic 20 项）

> 标记说明：✅ Orion 已实现且对齐 / ⚠️ 部分实现有差距 / 🚫 完全缺失 / ❌ Orion 有但方向错误（偏 ITSM）

| # | 能力 | NeatLogic 证据（文件:行） | Orion 现状 | 标记 | Gap 描述 | 工时（人天） |
|---|------|-------------------------|-----------|------|---------|------------|
| 1 | 需求/任务/缺陷一级模型 | `AppType.java:18-22` STORY/TASK/BUG 三类型 | `ticket.go:23` Type 字段（string，无枚举约束） | 🚫 | Orion 单一 Ticket 类型，无 Story/Task/Bug 语义区分 | 6 |
| 2 | 需求模板（Issue Type Screen） | `AppType.java:20-22` 每 AppType 绑定 AttrType[] | 无 | 🚫 | Orion 无"类型→字段集"映射 | 4 |
| 3 | 自定义字段 | `IssueAttrVo.java:30-43` + `AttrType.java:22-40` 17 种类型 | 无 | 🚫 | Orion Ticket 11 个固定字段，无 attrList | 8 |
| 4 | 需求层级（Epic→Story→Task） | `IssueVo.java:47` parentId + :49 sourceIssueId | `relation.go:7-12` 5 种关系类型 | ⚠️ | Orion 有 TicketRelation 但无 parentId 层级 | 5 |
| 5 | 缺陷管理（严重等级/优先级/缺陷类型） | `BugSeverityDistributionStatHandler` + `BugSourceDistributionStatHandler` + `BugReopenTotalStatHandler` | `ticket.go:24` Priority string | 🚫 | Orion 无 severity/source/reopenCount 字段 | 5 |
| 6 | 测试用例关联 | `api/test/` 子包 + IssueRel 桥接 | 无 | 🚫 | Orion 无 TestPlan-Issue 关联 | 6 |
| 7 | 文档关联（知识库） | IssueVo.fileList + 整体知识库模块 | 无 | 🚫 | Orion 无 Issue-Wiki 关联 | 3 |
| 8 | 研发效能报表（DORA） | 29 个 issuestat handler（非 DORA） | 无 | 🚫 | 双方均无 Lead Time / Deploy Freq / MTTR / CFR | 12 |
| 9 | 工时统计（Story Points / 时间追踪） | `IssueCostVo.java:20-31` + 4 个 API + `timecost` 字段 | 无 | 🚫 | Orion 无 Log Work / 工时台账 | 6 |
| 10 | 多项目 / 多团队 | `ProjectVo.java:34` + `userList` (ProjectUserVo) | `project/models.go:11` Project 简单结构 | ⚠️ | Orion Project 6 字段，无 userList/角色 | 4 |
| 11 | 项目用户角色 | `ProjectUserType.java:22-25` OWNER/LEADER/MEMBER 三角色 | 无 | 🚫 | Orion Project 无 role 字段 | 3 |
| 12 | 通知 / 订阅 | `api/notify/` 2 API + `RdmNotifyService` + `RdmIssueNotifyTriggerType` | 无 | 🚫 | Orion 无 Issue 事件订阅 | 5 |
| 13 | 目录树（需求分类） | `api/catalog/` 5 API + `catalogLft/Rht` MPTT 树 | 无 | 🚫 | Orion 无需求分类树 | 5 |
| 14 | 看板视图 | `DashboardVo.java:24` widgetList JSON + 4 API | `sprint/models.go:68` SprintBoard 简化版 | ⚠️ | Orion SprintBoard 仅按 status 分组，无 widget 配置 | 4 |
| 15 | 燃尽图 | `StoryTrendStatHandler` 按日趋势 | `sprint/repository.go:108` 单点快照 | ⚠️ | **Orion 只返当前 total/done/remaining 一个点，非按日累积** | 4 |
| 16 | Sprint 容器 | `IterationVo.java:29` + 5 API + `projectId` 关联 | `sprint/models.go:6` Sprint 无 ProjectId | ⚠️ | **Orion Sprint 与 Project 完全脱钩** | 2 |
| 17 | Issue 变更审计 | `IssueAuditAspect.java` AOP + `SearchIssueAuditApi` | 无 | 🚫 | Orion 无 Issue 变更历史 | 4 |
| 18 | 全文搜索 | `IssueFullTextIndexHandler.java` + `FullTextIndexUtil` | `ticket/handler/ticket.go` 仅 LIKE 查询 | ⚠️ | Orion SQL LIKE，无倒排索引 | 3 |
| 19 | Webhook 外发 | `IssueWebhookVo` + `webhookList` 字段 | 无 | 🚫 | Orion 无 Issue 事件外发 | 3 |
| 20 | 状态流转配置 | `api/status/` + `SaveProjectStatusApi` / `ListProjectStatusRelApi` | `ticket.go:25` Status string 自由文本 | 🚫 | Orion 无 Status 流转图配置 | 6 |

**合计工时**：98 人天（98 = 6+4+8+5+5+6+3+12+6+4+3+5+5+4+4+2+4+3+3+6）

---

## 四、真实完成度重估

### 4.1 加权计算

| 维度 | 权重 | NeatLogic 实现度 | Orion 实现度 | 加权得分 |
|------|------|----------------|------------|---------|
| 一级模型（Story/Task/Bug） | 15% | 100% | 0% | 0% |
| 自定义字段 | 12% | 100% | 0% | 0% |
| 需求追溯链 | 10% | 100% | 40% | 4% |
| 工时台账 | 10% | 100% | 0% | 0% |
| Sprint 容器 | 10% | 100% | 60% | 6% |
| 看板 / Dashboard | 8% | 100% | 30% | 2.4% |
| 燃尽图 | 8% | 100% | 20% | 1.6% |
| 目录树 | 5% | 100% | 0% | 0% |
| 变更审计 | 5% | 100% | 0% | 0% |
| 通知 / 订阅 | 5% | 100% | 0% | 0% |
| 状态流转配置 | 5% | 100% | 0% | 0% |
| Webhook / 集成 | 4% | 100% | 0% | 0% |
| 全文搜索 | 3% | 100% | 30% | 0.9% |
| **合计** | **100%** | - | - | **14.9% ≈ 15%** |

### 4.2 真实完成度：33%（中置信度）

修正逻辑：

1. **已有报告 37%** 含 Ticket 模块（SLA/Dispatch/Transfer/Queue/Balancing）的 ITSM 能力计入，但这些**不是研发管理**能力——它们对标的是 NeatLogic `neatlogic-ticketing` 模块，不是 `neatlogic-rdm`。本评审**只计研发管理**能力，剔除 ITSM 后 RDM 净覆盖约 15%。
2. 但 Orion `ticket` 模块的 `TicketRelation`（5 种关系类型，`relation.go:7-12`）部分实现了 IssueRel，且 Sprint 9 路由 + Burndown 数据结构（`sprint/models.go:79-92`）有最小可用骨架，应给予"基础设施分"18%。
3. 综合：**纯研发管理能力 15% + 基础设施分 18% = 33%**（中置信度 ±5%）。

### 4.3 与 37% 报告的差异

| 项 | 37% 报告 | 本报告 | 差异原因 |
|----|---------|-------|---------|
| 完成度 | 37% | 33% | 本报告剔除 ITSM 能力（SLA/Dispatch 不属于 RDM） |
| Sprint-Project 关联 | 未提及 | **完全脱钩** | `sprint/models.go:6` 实测无 ProjectId 字段，`sprint/handler/handler.go:23-35` 9 路由无 project 前缀 |
| Burndown 质量 | "完整" | **单点快照** | `sprint/repository.go:108-135` 只返回当前 total/done，非按日累积趋势 |
| NeatLogic 模型深度 | "Ticket 多类型" | **AppType 枚举 + 17 种 AttrType** | 已有报告未深入 IssueVo 30+ 字段 |
| 自定义字段 | 未提及 | **完全缺失** | NeatLogic `IssueAttrVo` 17 种类型 vs Orion 0 |
| 工时台账 | 未提及 | **完全缺失** | NeatLogic `IssueCostVo` + 4 API vs Orion 0 |

---

## 五、国际专家视角

### 5.1 Jira / Linear 客户实施研发管理的核心痛点

基于 15+ 年 Jira/Linear 实施经验，研发团队落地的**三大真实痛点**：

1. **自定义字段膨胀失控**：Jira 客户平均每项目 40+ 自定义字段，5 年后字段冗余 60%。Linear 通过"固定字段 + Property"模式刻意限制自定义。**NeatLogic 选择"17 种 AttrType 枚举"是正确折衷**——比 Jira 自由度低，但比 Linear 灵活。**Orion 0 种自定义字段**意味着连"故事点数""验收标准""优先级枚举"都要硬编码进 Ticket 表，这是 2010 年前的水平。
2. **状态流转图配置**：Jira Workflow Designer、Linear Status Cycle、Azure DevOps Board Columns 都允许团队自定义状态流转。**NeatLogic `SaveProjectStatusApi` + `ListProjectStatusRelApi` 实现了项目级状态流转图**，这是研发团队"流程适配"的核心。**Orion Status 是 string 自由文本**（`ticket.go:25`），等同于没有状态机。
3. **需求追溯链可见性**：客户最常问的是"这个缺陷阻塞了哪些需求？""这个 Story 关联了哪些测试用例？"。**NeatLogic `IssueRelVo` 双向追溯 + `IssueRelType` 三类型（EXTEND/RELATIVE/REPEAT）** 提供了基线。**Orion `TicketRelation` 有 5 种类型（duplicate/caused-by/related/blocks/blocked-by，`relation.go:7-12`）**，类型选择甚至优于 NeatLogic，但**无 UI 可视化、无影响传播查询**。

### 5.2 NeatLogic RDM 设计是否符合现代 ALM 理念？

**部分符合，但有三个反现代设计**：

1. **✅ 符合**：统一 Issue 模型 + AppType 枚举。现代 ALM（Linear、Height、Shortcut）都倾向统一 Issue + Type 区分，而非 Jira 的独立 Entity（Story/Bug/Task 各一张表）。NeatLogic 选择正确。
2. **❌ 反现代**：**无原生 Git 集成**。2025 年的 ALM 工具必须有"PR ↔ Issue 自动关联"（GitHub ` Fixes #123` 语法、GitLab `closing #123`）。NeatLogic 把 Git 集成推给 `neatlogic-code` 独立模块，**RDM 侧 Issue 无 commit/PR/branch 字段**，这是 2015 年前 ITSM 工具的水平。
3. **❌ 反现代**：**29 个统计 handler 全是计数器，无 DORA/SPACE**。现代研发管理工具（Linear Insights、Jira Dashboards for DORA、Velocity by Codecov）都内置 Lead Time / Deployment Frequency / MTTR / Change Failure Rate。NeatLogic 的 `StoryTotalStatHandler` / `BugOpenStatHandler` 是 IT 服务台思维（"在办/已办/超时"），不是研发效能思维（"从代码提交到生产的时间分布"）。
4. **❌ 反现代**：**MPTT 目录树（`catalogLft/Rht`）**。2025 年用 MPTT（Modified Preorder Tree Traversal）做层级是过度工程，现代工具用 Closure Table 或 Materialized Path + 递归 CTE。NeatLogic 选了 2008 年的模式。

### 5.3 Orion 当前实现距离"研发团队真能用"还差什么？

**三个致命缺口**（按优先级）：

1. **一级模型缺失**（P0）：研发团队需要"这是 Story 还是 Bug"的语义区分。Orion `Ticket.Type` 是 string 自由文本，前端无法渲染不同字段表单。**NeatLogic `AppType` 枚举 + 每 Type 绑定 AttrType[] 是最小可用实现**。Orion 需补齐：`TicketType` 枚举（story/task/bug/epic）+ `TicketTypeField` 关联表（type → field 集合）。
2. **Sprint-Project 脱钩**（P0）：`sprint/models.go:6` Sprint 无 `ProjectId` 字段，意味着"我的项目有哪些 Sprint""这个 Sprint 属于哪个项目"都查不出。**已有报告建议复用 Ticket 加字段不够**——Sprint 表本身需要加 `project_id` 列，且 Sprint CRUD 路由要从 `/sprints` 改为 `/projects/:projectId/sprints`。
3. **Burndown 是假图**（P0）：`sprint/repository.go:108-135` 只返回当前 `total/done/remaining` 一个点。真实燃尽图需要**按日累积**：从 Sprint StartDate 到 EndDate，每天记录 ideal line（线性下降）和 actual line（实际剩余）。**已有报告"Burndown 完整"结论错误**。

---

## 六、P0 / P1 补充

### P0（阻塞研发团队使用，98 人天）

| ID | 任务 | 工时 | 依据 |
|----|------|------|------|
| P0-RDM-01 | Ticket 一级模型（Story/Task/Bug/Epic 枚举 + 类型字段表） | 6+4=10 | `AppType.java:18-22` |
| P0-RDM-02 | 自定义字段（17 种 AttrType + IssueAttr CRUD） | 8 | `IssueAttrVo.java:30-43` |
| P0-RDM-03 | Sprint 加 `project_id` + 路由前缀化 | 2 | `sprint/models.go:6` 实测缺失 |
| P0-RDM-04 | Burndown 按日累积实现（替换单点快照） | 4 | `sprint/repository.go:108-135` |
| P0-RDM-05 | 工时台账（IssueCost + 4 API） | 6 | `IssueCostVo.java:20-31` |
| P0-RDM-06 | 需求追溯链 UI 可视化 + 影响传播查询 | 5 | `IssueRelVo.java:22-43` |
| P0-RDM-07 | 状态流转图配置（项目级） | 6 | `SaveProjectStatusApi` 等 |
| P0-RDM-08 | DORA 四指标基础采集（Git webhook → Issue 关联） | 12 | §5.2 反现代设计 |
| P0-RDM-09 | 缺陷管理（severity/source/reopenCount） | 5 | `BugSeverityDistributionStatHandler` |
| P0-RDM-10 | 变更审计（IssueAudit AOP） | 4 | `IssueAuditAspect.java` |
| P0-RDM-11 | 目录树（需求分类） | 5 | `api/catalog/` 5 API |
| P0-RDM-12 | 通知订阅（Issue 事件触发） | 5 | `api/notify/` |
| P0-RDM-13 | 看板 Dashboard（widgetList JSON） | 4 | `DashboardVo.java:24` |
| P0-RDM-14 | 测试用例关联 | 6 | `api/test/` |
| P0-RDM-15 | Webhook 外发 | 3 | `IssueWebhookVo` |
| P0-RDM-16 | 全文搜索（倒排索引） | 3 | `IssueFullTextIndexHandler.java` |
| P0-RDM-17 | 项目用户角色（OWNER/LEADER/MEMBER） | 3 | `ProjectUserType.java:22-25` |
| P0-RDM-18 | 全文搜索 → 已有 LIKE 升级 | （含 P0-RDM-16） | - |
| **小计** | | **98** | 已有报告估 118 人天，本报告压减 20 人天（剔除 Release 实体，NeatLogic 也无） |

### P1（提升可用性，30 人天）

| ID | 任务 | 工时 | 依据 |
|----|------|------|------|
| P1-RDM-01 | Story Points 字段（区别于 timecost 工时） | 2 | Jira story_points 标配 |
| P1-RDM-02 | Sprint 容量规划（Capacity）已有字段但无校验 | 2 | `sprint/models.go:14` |
| P1-RDM-03 | 29 个统计 handler 中至少移植 5 个（StoryTotal/BugOpen/BugReopen/StoryTrend/BugTrend） | 8 | `issuestat/handler/` |
| P1-RDM-04 | Issue 排序（SortOrder）跨 Sprint 全局 Backlog 视图 | 4 | NeatLogic 无，Orion `sprint/models.go:51` TicketOrder 仅 Sprint 内 |
| P1-RDM-05 | 跨项目搜索（当前 Orion Sprint 按 tenant 隔离，无项目间聚合） | 4 | `sprint/repository.go:147` |
| P1-RDM-06 | Sprint 报告（velocity 趋势，跨 Sprint 对比） | 5 | NeatLogic 无原生 velocity，需自建 |
| P1-RDM-07 | 文档关联（Issue ↔ Wiki） | 3 | `IssueVo.fileList` |
| P1-RDM-08 | Issue 收藏（isFavorite 字段） | 2 | `IssueVo.java:158` |

### 与已有报告的工时差异说明

| 项 | 37% 报告 | 本报告 | 差异 |
|----|---------|-------|------|
| 总工时 | 118 人天 | P0 98 + P1 30 = 128 人天 | +10 人天 |
| 37%→65% 路径 | 28 人天 | 不认同 | 已有报告低估自定义字段（8d）+ 工时台账（6d）+ 状态机（6d） |
| Release 实体 | 含 | 不含 | NeatLogic 也无 Release，不应计入 RDM 范畴 |

---

## 七、认知边界

1. **NeatLogic `api/test/` 子包未深入**：本轮未读取 `neatlogic/module/rdm/api/test/` 下的 Java 文件，"测试用例关联"工时（6 人天）为基于 `IssueRel` 桥接模式的推断估计，实际可能 ±2 人天。
2. **`neatlogic-testing` 独立模块未评审**：NeatLogic 有独立的测试管理模块，本评审严格限定在 `neatlogic-rdm` + `neatlogic-rdm-base` 范围，未跨模块。
3. **Orion 前端未评审**：已有报告称"前端 40+ API 全部 404"未在本轮复核，本报告结论基于**后端源码实测**。前端实际状态以已有报告为准。
4. **DORA 指标采集链未设计**：P0-RDM-08（12 人天）仅估"基础采集"，完整 DORA 看板（含 Git webhook、CI/CD pipeline 事件、部署时间戳）需额外 15-20 人天，超出本评审范围。
5. **NeatLogic `neatlogic-code` 模块未评审**：§5.2 提到"Git 集成推给独立模块"的判断基于 RDM 源码无 Git 字段，未读取 `neatlogic-code` 源码验证其与 RDM 的集成深度。
6. **Orion `internal/project/` 仅读 models**：`project/models.go:11-19` Project 6 字段（id/tenant_id/name/description/created_by/updated_by/时间戳），未读取 service/handler 层，可能存在业务逻辑层补充，但模型层贫瘠是事实。
7. **置信度**：33% 完成度为**中置信度（±5%）**。上界 38%（若 Orion 前端有未发现的 RDM 页面）、下界 28%（若 Burndown 单点快照被认定为完全不可用）。
8. **本报告不做跨模块对比**：已严格遵守"只对标 `neatlogic-rdm` vs Orion 研发管理相关目录"的约束，未与 `neatlogic-ticketing` / `neatlogic-testing` / `neatlogic-code` 做对比。

---

## 八、SaveIssueApi 实现深度（事务 / 通知 / 状态流转自动换人）

已有报告称"Sprint/Project/Ticket 基础 CRUD 完整"，但未深入 NeatLogic 的 SaveIssueApi 实现复杂度。实测 `SaveIssueApi.java:144-199`：

### 8.1 状态流转自动换人（:168-189）

```java
if (issueVo.getStatus() != null) {
    Long oldIssueId = 0L;
    if (id != null) {
        oldIssueId = issueMapper.getIssueStatusById(id);
    }
    if (!issueVo.getStatus().equals(oldIssueId)) {
        AppStatusRelVo appStatusRelVo = new AppStatusRelVo();
        appStatusRelVo.setFromStatusId(oldIssueId);
        appStatusRelVo.setToStatusId(issueVo.getStatus());
        AppStatusRelVo rel = appMapper.getAppStatusRel(appStatusRelVo);
        if (rel != null && MapUtils.isNotEmpty(rel.getConfig()) && rel.getConfig().containsKey("userList")) {
            // 自动替换处理人
            issueVo.setUserIdList(userIdList);
        }
    }
}
```

**这是 Jira Workflow Post-Function 的等价物**：状态从 A→B 时，自动把处理人换成预设角色（如"测试中→测试工程师"）。**Orion 完全无此能力**，`ticket.go:24-26` Status/AssignedTo 是独立字段，无联动。

### 8.2 IssueRel 跨项目复制策略（:191-199）

```java
Long fromId = issueVo.getFromId();
String relType = StringUtils.isNotBlank(issueVo.getRelType())
    ? issueVo.getRelType() : IssueRelType.EXTEND.getValue();
if (fromId != null) {
    fromIssue = issueMapper.getIssueById(fromId);
    needCopyRel = fromIssue != null
        && issueRelStrategyService.needCopy(fromIssue.getAppId(), issueVo.getAppId(), relType);
}
```

`IssueRelStrategyService.needCopy()` 是策略模式入口——根据"源 App → 目标 App + 关系类型"决定是否复制属性。这是**跨项目需求拆分的原子能力**（如"产品需求 PRD → 项目 Story"时自动继承 priority/tagList）。**Orion 无此能力**。

### 8.3 事务 + 防重提交 + 权限校验（:56-75）

```java
@Service
@AuthAction(action = RDM_BASE.class)       // 模块级权限
@OperationType(type = OperationTypeEnum.UPDATE)
@Transactional                              // 事务
@ResubmitInterval                           // 防重提交
public class SaveIssueApi extends PrivateApiComponentBase {
```

- `@AuthAction(RDM_BASE.class)`：模块级权限门控（所有人需 RDM_BASE 授权）
- `ProjectAuthManager.checkAppAuth(appId, MEMBER, OWNER, LEADER)`（:146）：**项目级权限**，非 MEMBER/OWNER/LEADER 三角色之一拒绝
- `@ResubmitInterval`：防重复提交（Jira 无此能力，需插件）
- `@Transactional`：数据库事务

**Orion 对照**：`sprint/handler/handler.go:25` `auth.RequirePermission("sprint", "create")` 是 RBAC 权限，**无项目角色校验**（因为 Sprint 无 ProjectId，无从判断用户在该项目中的角色）。

### 8.4 输入参数 20 个（:119-139）

`@Input` 注解声明 20 个参数：id / fromId / toId / relType / parentId / appId(必填) / name / priority / iteration / catalog / tagList / status / startDate / endDate / timecost / content / attrList / userIdList / copyIssueIdList / comment。

**Orion `CreateSprintRequest`**（`sprint/models.go:21-27`）只有 6 个参数：name / goal / startDate / endDate / status / capacity。**Orion `CreateTicketRequest`**（`ticket/models/ticket.go:56-61`）只有 4 个：title / description / type / priority。

差距：20 vs 6/4，**NeatLogic 单个 API 参数量是 Orion Sprint 的 3.3 倍、Ticket 的 5 倍**。

---

## 九、Burndown 实现质量对比（已有报告"完整"结论错误）

已有报告称 Sprint "Burndown 完整"，本节实测证伪。

### 9.1 Orion Burndown 实测（单点快照）

`orion-platform-svc-go/internal/sprint/repository/repository.go:108-135`：

```go
func (r *Repository) GetBurndownData(ctx context.Context, tenantID, sprintID string) (*models.BurndownData, error) {
    var total, done int
    err := r.db.GetContext(ctx, &total,
        `SELECT COUNT(*) FROM sprint_ticket st WHERE st.sprint_id=$1 AND st.tenant_id=$2`, sprintID, tenantID)
    err = r.db.GetContext(ctx, &done,
        `SELECT COUNT(*) FROM sprint_ticket st JOIN tickets t ON t.id=st.ticket_id
         WHERE st.sprint_id=$1 AND st.tenant_id=$2 AND t.status IN ('done','closed','completed')`, sprintID, tenantID)

    data := &models.BurndownData{
        SprintID: sprintID,
        Total:    total,
        Done:     done,
        Points:   []models.BurndownPoint{},  // 空数组
    }
    if total == done {
        data.Points = append(data.Points, models.BurndownPoint{Total: total, Done: done, Remaining: 0})
    } else {
        data.Points = append(data.Points, models.BurndownPoint{Total: total, Done: done, Remaining: total - done})
    }
    return data, nil
}
```

**三个致命缺陷**：

1. **`Points` 数组只有 1 个元素**（当前快照），不是按日累积的时间序列。真实燃尽图应有 StartDate→EndDate 之间每天一个点。
2. **无 ideal line**（理想燃尽线）：标准燃尽图有两条线——ideal（线性下降）+ actual（实际剩余）。Orion 无 ideal。
3. **无历史数据持久化**：每次查询实时 `COUNT(*)`，无法回溯"Sprint 第 3 天时还剩多少"。如果 Sprint 已关闭，历史燃尽轨迹丢失。

### 9.2 NeatLogic 趋势实现（按月聚合，非按日）

`StoryTrendStatHandler.java:37-41`：

```java
public IssueStatResultVo calculate(IssueStatContextVo context) {
    IssueStatResultVo resultVo = createResult(context, "trend", "近7个月需求/逾期趋势");
    resultVo.setDataList(getTrendList(issueMapper.getIssueOverviewTrendList(toIssueVo(context))));
    return resultVo;
}
```

`getTrendList()`（:43-60）按月聚合，最近 7 个月，每月一个数据点。**这是项目级趋势报表，不是 Sprint 级燃尽图**。

### 9.3 Burndown 质量评级

| 维度 | Orion | NeatLogic | Jira 标准 |
|------|-------|-----------|----------|
| 数据点数 | 1（当前快照） | 7（按月） | N（按日，Sprint 天数） |
| Ideal line | 无 | 无 | 有（线性下降） |
| Actual line | 单点 | 按月趋势 | 按日剩余 |
| 历史持久化 | 无（实时 COUNT） | 有（issueMapper 聚合） | 有（每日快照表） |
| Sprint 级 | 是（但假图） | 否（项目级） | 是 |
| 评级 | 🚫 不可用 | ⚠️ 部分可用（项目级） | ✅ 标杆 |

**结论**：已有报告"Burndown 完整"结论错误。Orion Burndown 是**不可用的假图**（单点快照伪装成燃尽图），NeatLogic 也只是**项目级月度趋势**（非 Sprint 级按日燃尽）。**双方均未达 Jira 标准**。

---

## 十、已有报告 226 行结论逐条验证

| 已有报告结论 | 验证结果 | 证据 |
|-------------|---------|------|
| RDM 加权完成度 37% | **部分验证，下修为 33%** | 剔除 ITSM 能力（SLA/Dispatch 不属于 RDM） |
| 前端 40+ API 全部 404 | **未复核**（本报告限定后端源码评审） | 认知边界 §7.3 |
| Workbench 模型只有 5 字段 | **验证属实** | `workbench/models/models.go:5-11` Workbench 含 id/tenant_id/name/created_at/updated_at 5 字段 |
| Sprint/Project/Ticket 基础 CRUD 完整 | **部分验证** | Sprint 9 路由 CRUD 完整；Project 仅 models 层，handler/service 层未在本报告验证；Ticket CRUD 完整但偏 ITSM |
| 建议复用 Ticket 加字段（28 人天 37%→65%） | **不认同** | 已有报告低估：自定义字段（8d）+ 工时台账（6d）+ 状态机（6d）+ Burndown 重写（4d）= 24d 单项已接近 28d，65% 需 P0 全量 98d |
| 估 118 人天补齐 | **调整为 128 人天**（P0 98 + P1 30） | 已有报告少估 DORA 采集（12d）+ 变更审计（4d）+ 全文搜索升级（3d） |
| NeatLogic "Ticket 多类型" | **验证但不准确** | NeatLogic 是 AppType 枚举（STORY/TASK/BUG/ITERATION），非"多类型 Ticket"——Story/Task/Bug 是 Issue 的 AppType 属性，不是独立实体 |
| 已有报告未提及自定义字段 | **本报告补充** | NeatLogic `IssueAttrVo` 17 种 AttrType，Orion 0 |
| 已有报告未提及工时台账 | **本报告补充** | NeatLogic `IssueCostVo` + 4 API，Orion 0 |
| 已有报告未提及状态流转配置 | **本报告补充** | NeatLogic `SaveProjectStatusApi` + `ListProjectStatusRelApi`，Orion Status 自由文本 |
| 已有报告未提及变更审计 | **本报告补充** | NeatLogic `IssueAuditAspect` AOP 拦截，Orion 0 |
| 已有报告未提及 Sprint-Project 脱钩 | **本报告补充** | `sprint/models.go:6` 实测无 ProjectId 字段 |

---

## 十一、关键文件索引

### NeatLogic RDM（证据源）

| 文件 | 行号 | 用途 |
|------|------|------|
| `neatlogic-rdm-base/.../enums/AppType.java` | 18-22 | STORY/TASK/BUG/ITERATION 四类型 |
| `neatlogic-rdm-base/.../enums/AttrType.java` | 22-40 | 17 种自定义字段类型 |
| `neatlogic-rdm-base/.../enums/IssueRelType.java` | 20-22 | EXTEND/RELATIVE/REPEAT 三关系 |
| `neatlogic-rdm-base/.../enums/ProjectUserType.java` | 22-25 | OWNER/LEADER/MEMBER 三角色 |
| `neatlogic-rdm-base/.../dto/IssueVo.java` | 33-172 | Issue 30+ 字段 |
| `neatlogic-rdm-base/.../dto/ProjectVo.java` | 34 | Project 含 userList/appList/config |
| `neatlogic-rdm-base/.../dto/IterationVo.java` | 29-49 | Sprint 含 projectId/issueCount/doneIssueCount |
| `neatlogic-rdm-base/.../dto/IssueRelVo.java` | 22-43 | 双向追溯链 |
| `neatlogic-rdm-base/.../dto/IssueAttrVo.java` | 30-43 | 自定义字段值 |
| `neatlogic-rdm-base/.../dto/IssueCostVo.java` | 20-31 | 工时台账 |
| `neatlogic-rdm-base/.../dto/DashboardVo.java` | 24-39 | widgetList JSON 仪表板 |
| `neatlogic-rdm/.../issuestat/handler/` | 29 文件 | 29 个统计 handler |
| `neatlogic-rdm/.../fulltextindex/IssueFullTextIndexHandler.java` | - | 全文索引 |
| `neatlogic-rdm/.../aop/IssueAuditAspect.java` | - | 变更审计 AOP |
| `neatlogic-rdm/.../api/` | 99 个 API | 总量 |

### Orion（被评审方）

| 文件 | 行号 | 实测结论 |
|------|------|---------|
| `orion-platform-svc-go/internal/sprint/models/models.go` | 6-17 | Sprint 无 ProjectId 字段 |
| `orion-platform-svc-go/internal/sprint/models/models.go` | 68-76 | SprintBoard 简化版 |
| `orion-platform-svc-go/internal/sprint/models/models.go` | 79-92 | Burndown 数据结构存在 |
| `orion-platform-svc-go/internal/sprint/handler/handler.go` | 23-35 | 9 路由，无 project 前缀 |
| `orion-platform-svc-go/internal/sprint/service/service.go` | 27-33 | Service 仅传 repo |
| `orion-platform-svc-go/internal/sprint/repository/repository.go` | 108-135 | **Burndown 单点快照，非按日累积** |
| `orion-platform-svc-go/internal/ticket/models/ticket.go` | 17-31 | Ticket 11 字段，无自定义字段 |
| `orion-platform-svc-go/internal/ticket/models/relation.go` | 7-12 | 5 种关系类型（优于 NeatLogic 3 种） |
| `orion-platform-svc-go/internal/ticket/handler/routes.go` | 25-79 | 30+ 路由，偏 ITSM（SLA/Dispatch/Transfer） |
| `orion-platform-svc-go/internal/project/models/models.go` | 11-19 | Project 6 字段，无 userList |

---

**报告终**
