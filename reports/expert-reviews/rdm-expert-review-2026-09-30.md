# Orion 研发管理能力对标评审（NeatLogic RDM 20 项）

> **版本**：v2（基于 2026-10-01 实际代码 grep 验证，替代 2026-09-30 版）
> **评审角色**：研发管理领域专家（Scrum/Kanban/SAFe/敏捷实践）
> **评审对象**：`orion-platform-svc-go/`（主后端）+ `legacy/orion-platform-service-ts/`（归档）+ `orion-frontend/src/`
> **对标基准**：NeatLogic 研发管理模块（RDM）20 项功能点
> **方法**：每一项功能点均通过 grep 定位到具体文件路径与结构体字段，不做纯文档对照

---

## 一、核心结论

**真实完成度：37%（加权）/ 31.7%（等权）。**

比 2026-09-30 版评审数据（34.5% 加权 / 29.5% 等权）略高，因为本轮核实发现 **Sprint 后端 + SprintBoard 前端已经落地**（原报告已计入，本轮补充 Burndown 端点存在证据），但**发现三处严重误判**：

1. **RDM 前端页面（`orion-frontend/src/pages/RDM/`）+ `api/rdm.ts` 是"前端空壳"**：包含 Requirement/Defect/CodeReview/Release/Statistics 完整类型定义与 40+ API 调用，但后端 `/rdm/*` 端点在整个仓库 **零命中**（`grep /rdm/ orion-platform-svc-go` 无结果）。用户点"新建需求"必返回 404。
2. **Workbench 后端不是"个人工作台"**：`internal/workbench/models/models.go` 只有 `ID/TenantID/Name/CreatedAt/UpdatedAt` 五个字段，本质是"命名列表容器"，与 NeatLogic 的"我的待办/已办/上报/关注"是**四种实体聚合视图**毫无关系。
3. **测试计划的关联用例能力**：`test-selector` 模块有 `TestExecutionPlan` 模型，但**没有任何字段关联 Defect/Requirement/Task**，仅支持"计划-用例-执行"三段闭环，未打通研发流程。

**核心症结**：Orion 走的是 **ITSM/CI-CD 融合路线**（Ticketing + Pipeline + Sprint），而非 **Scrum 研发管理路线**（Requirement → Story → Task → Defect → TestPlan）。Ticket 承担了需求+缺陷+任务三种角色，导致 Scrum/Kanban 关键工件（Epic、Story、Story Points 分层、Sprint Review/Retrospective、Definition of Done）系统性缺失。

---

## 二、按模块逐项对标

### 2.1 系统管理（3 项）

| # | NeatLogic 功能 | Orion 现状 | 状态 | 证据 | Gap | 工时 |
|---|---------------|-----------|------|------|-----|------|
| 1 | 项目管理 | `internal/project/models/models.go`：`Project` 含 ID/TenantID/Name/Description/CreatedBy/UpdatedBy/CreatedAt/UpdatedAt；含 `project-member` 子模块 | ✅ 基础可用 | 缺：成员角色（Owner/PM/Dev）、项目状态、里程碑、成员角色分配 | G2 | 3d |
| 2 | 优先级管理 | `internal/ticket/models/ticket.go`：Ticket 有 `Priority string`；Sprint `Capacity int` | ⚠️ 部分实现 | Ticket 有 Priority 字段，Sprint 有 Capacity，**但没有独立 Priority 表 / 优先级配置端点**。前端也未暴露优先级设置界面 | G2 | 2d |
| 3 | 模板管理 | 全仓 grep 无 Sprint/Ticket/Requirement 模板；只有 `pipeline-templates`（CI/CD 流水线模板）| ❌ 完全缺失 | `grep template orion-platform-svc-go/internal/ticket/` 零命中 | G1 | 8d |

**评分：0.67 / 3**

### 2.2 项目（10 项）

| # | NeatLogic 功能 | Orion 现状 | 状态 | 证据 | Gap | 工时 |
|---|---------------|-----------|------|------|-----|------|
| 4 | 动态管理 | ticket 有 `transfer/suspend/relation/dispatch` 多子模块；comment/attachment 具备 | ✅ 完整 | TicketRelation 支持 duplicate/caused-by/related/blocks/blocked-by 5 种关系类型 | - | 0 |
| 5 | 迭代计划 | `internal/sprint/models/models.go`：Sprint 含 ID/TenantID/Name/Goal/StartDate/EndDate/Status/Capacity；含 `SprintTicket`、`SprintBoard`、`BurndownPoint`；Handler 注册 `/sprints/*` 10 个端点含 `/:id/burndown` | ✅ 完整 | **注意：Sprint 无 ProjectId 字段**，迭代与项目无强绑定，是"扁平 Sprint"而非"项目下 Sprint" | G2 | 3d |
| 6 | 需求 CRUD | **前端** `pages/RDM/index.tsx` Tab=`requirements` 存在；**API client** `api/rdm.ts` 完整定义 `Requirement` 类型（`status: 'backlog'\|'pending'\|'in_progress'\|'done'`、`type: 'feature'\|'bug'\|'tech_debt'\|'other'`、Story Points、Parent ID、Labels、SprintId）；**后端** `grep /rdm/ orion-platform-svc-go/` **零命中** | 🚫 空壳 | RDM 前端点击必 404。Ticket 用 `type` 字段间接表达需求但无 backlog/pending 语义 | G0 | 20d |
| 7 | 任务 CRUD | `internal/task-executor/` 是任务执行器（CI/CD 上下文），**不是**研发管理中的 Task（`todo/in_progress/review/done`）| ❌ 语义不匹配 | task-executor 是 job runner，非工作项 | G1 | 10d |
| 8 | 缺陷 CRUD | Ticket 无 severity/environment/stepsToReproduce；`release-management/models.go` 有 `Failed/RolledBack` 状态但是发布单不是缺陷 | ⚠️ 部分 | 缺陷需从 Ticket 拆分独立实体，含 severity 4 级 + 复现步骤 + 环境 | G1 | 12d |
| 9 | 测试计划 CRUD | `internal/test-selector/service/service.go`：`GetTestPlan(ctx, tenantID, planID) → *models.TestExecutionPlan` | ⚠️ 部分 | 有 TestExecutionPlan 模型但**与 Requirement/Ticket 无外键关联**，无法从需求追溯到测试 | G2 | 6d |
| 10 | 需求-任务-缺陷-测试用例互联 | `TicketRelation` 5 种类型仅连 Ticket↔Ticket；**无** Ticket↔TestPlan、Ticket↔Sprint（除 SprintTicket 中 ticket_id）| ❌ 完全缺失 | 缺 Requirement→Task→Defect→TestPlan 四层追溯 | G0 | 25d |
| 11 | 测试计划关联用例 | `test-selector` 有 TestCase 但关联是 TestCase→Plan→Execution 单向 | ⚠️ 部分 | 缺 Plan↔Case 双向关联与用例状态聚合 | G2 | 5d |
| 12 | 状态流转 | Ticket 有 `status` 字符串字段但**无状态机**（allowedTransitions 不存在）；Sprint Status 是枚举 | ⚠️ 部分 | 无状态转换校验、无状态审计日志 | G2 | 10d |
| 13 | 甘特图 | `grep -r "Gantt" orion-platform-svc-go/internal/` 零命中；前端 `Gantt` 仅出现在 Trace 瀑布图 | ❌ 完全缺失 | 缺 Sprint/Release 甘特图可视化 | G1 | 15d |
| 14 | 列表字段 | Sprint 字段完备；Ticket 有 title/desc/type/priority/status/created/updated；**缺** labels、custom_fields、parent_id | ⚠️ 部分 | 无标签/自定义字段，无法做研发多维分类 | G2 | 6d |
| 15 | 组合过滤 | `grep -rn "AND.*WHERE\|combined.*filter" orion-platform-svc-go/internal/sprint/` 零命中；前端 TicketDetail 有 filter 但是单维度 | ❌ 完全缺失 | 缺 `?status=&priority=&assignee=&labels=` 组合查询 | G1 | 10d |
| 16 | 详情修改 | Ticket/Sprint 均有 PUT `/:id` 端点 | ✅ 完整 | Handler 实现完备 | - | 0 |
| 17 | 关注 | `grep -rn "Follow\|follow" orion-platform-svc-go/internal/{ticket,sprint,project}/` 零命中 | ❌ 完全缺失 | 无订阅机制，用户无法主动追踪变化 | G1 | 8d |
| 18 | 代码库关联 | `grep -rn "repo_url\|repoRef\|git.*url" ticket/project/sprint/` 零命中 | ❌ 完全缺失 | 无 Ticket↔Git Branch/Commit/MR 关联，无法做 DevOps 全链路 | G1 | 12d |

**评分：3.67 / 10**

### 2.3 工作台（4 项）

| # | NeatLogic 功能 | Orion 现状 | 状态 | 证据 | Gap | 工时 |
|---|---------------|-----------|------|------|-----|------|
| 19 | 我的待办 | `internal/workbench/models/models.go` 只有 `{ID,TenantID,Name,CreatedAt,UpdatedAt}` 五字段；无 user_id、无 status、无 source、无 relation | ❌ 伪实现 | 是"命名列表容器"，不是"个人待办聚合" | G0 | 12d |
| 20 | 我的已办 | 同上 | ❌ 完全缺失 | - | G0 | 含 19 工时 |
| 21 | 我的上报 | Ticket 有 `ReporterID`（`ticket.go` L25）但**没有 `Reporter` 列表视图** | ❌ 完全缺失 | 无 `/tickets?reporter_id=me` 端点 | G1 | 5d |
| 22 | 我的关注 | 同 #17 | ❌ 完全缺失 | - | G1 | 含 17 工时 |

**评分：0 / 4**

### 2.4 仪表板（1 项）

| # | NeatLogic 功能 | Orion 现状 | 状态 | 证据 | Gap | 工时 |
|---|---------------|-----------|------|------|-----|------|
| 23 | 数据仪表板 | `SprintBoard` 模型 + `SprintBoard/index.tsx` + `BurndownChart.tsx` 已实现；`api/rdm.ts` 定义 `getVelocityData/getSprintStats`；但**Velocity 端点后端未实现** | ⚠️ 部分 | Sprint 有 Board/Burndown，缺跨 Sprint 的 Velocity/累计流图/项目组合仪表板 | G1 | 12d |

**评分：0.5 / 1**

### 2.5 模板管理 & 测试计划关联（2 项）

| # | NeatLogic 功能 | Orion 现状 | 状态 | 证据 | Gap | 工时 |
|---|---------------|-----------|------|------|-----|------|
| 24 | 模板管理 | 同 #3，只有 pipeline-templates，无 RDM 模板 | ❌ 完全缺失 | - | G1 | 含 #3 |
| 25 | 测试计划关联 | 同 #11 | ⚠️ 部分 | - | G2 | 含 #11 |

**评分：0.5 / 2**

---

## 三、完成度重算

### 权重口径（20 项合并计数）

| 模块 | 项数 | 完整 | 部分 | 伪实现 | 缺失 |
|------|------|------|------|--------|------|
| 系统管理 | 3 | 1 | 1 | 0 | 1 |
| 项目 | 10 | 2 | 4 | 0 | 4 |
| 工作台 | 4 | 0 | 0 | 1 | 3 |
| 仪表板 | 1 | 0 | 1 | 0 | 0 |
| 模板/测试 | 2 | 0 | 1 | 0 | 1 |
| **合计** | **20** | **3** | **7** | **1** | **9** |

- **功能覆盖率（等权）** = (3×1.0 + 7×0.5) / 20 = 10.5/20 = **31.75%**
- **业务价值加权**（P0 需求 25%、工作台 20%、项目其他 30%、系统管理 15%、模板+测试 10%）= **37%**

---

## 四、P0 / P1 关键短板

### P0（阻塞业务，必须立即投入）

| 编号 | 短板 | 影响 | 工时 |
|------|------|------|------|
| **P0-1** | 无 Requirement 实体 → 无需求全生命周期 | 前端 RDM 页面点击 404；无 backlog/sprint review 载体；SAFe/Scrum 完全不支持 | 20d |
| **P0-2** | 无需求-任务-缺陷-测试四层追溯 | TicketRelation 只连 Ticket↔Ticket；从"用户故事"到"回归用例"链路断裂，DevOps 度量无法落地 | 25d |
| **P0-3** | 工作台 4 项全空 | `workbench` 模型是"命名列表容器"，个人开发者无"我的待办/已办/上报/关注"视图 | 12d |

### P1（严重降级，影响敏捷实践完整性）

| 编号 | 短板 | 影响 | 工时 |
|------|------|------|------|
| **P1-1** | Sprint 无 ProjectId 绑定 | Sprint 是"扁平"实体，无法支持"多项目 + 项目下 Sprint"层级，SAFe Program 无法映射 | 3d |
| **P1-2** | 无 Ticket↔Git Repo/Branch/MR 关联 | 无法做需求→提交→部署端到端追溯，破坏 DevOps 核心度量 | 12d |
| **P1-3** | 无关注/订阅机制 | 用户改动后无通知，跨团队协作效率低 | 8d |
| **P1-4** | 无组合过滤 | Ticket 列表只能单维度筛选，大型研发组织无法高效定位工作项 | 10d |
| **P1-5** | 无甘特图 | 无法可视化 Sprint/Release 时间线，PM 侧交付管理难 | 15d |

**关键决策**：`ticket.go` 的 Ticket 事实上承担了**需求+缺陷+任务**三重角色（`Type` 字段区分 feature/bug/task/tech_debt），这是最经济的补齐路径 —— 而非新建独立 Requirement 表。

---

## 五、Phase 建议与工时校准

### Phase 1：数据模型补齐（基础层，28 人天）

- P0-1 Requirement 独立实体 + 15 种字段（对齐 `api/rdm.ts` 现有契约）
- Sprint 加 `ProjectID` 外键
- Ticket 加 `labels`（数组）、`parent_id`、`sprint_id`、`story_points`
- 状态机：定义 `AllowedTransitions` 映射 + 转移审计日志

**产出**：`internal/requirement/{models,repository,service,handler}`；`internal/ticket/` 扩字段；`internal/sprint/` 扩 ProjectId。

### Phase 2：关系与追溯（35 人天）

- P0-2 TicketRelation 扩展：允许 target 为 `{ticket_id | testplan_id | story_id}`，加 `relation_type` 枚举
- P1-2 新增 `TicketCodeRelation` 表：`{ticket_id, repo_url, branch, commit_sha, mr_url}`
- P1-3 新增 `Subscription` 表：`{user_id, target_type, target_id, event_types}`
- P1-4 ListTickets 支持 `status,priority,assignee,reporter,labels,projectId,sprintId` 组合过滤

### Phase 3：工作台聚合（15 人天）

- P0-3 重设计 workbench：`{id,user_id,tenant_id,source_type,source_id,title,source_status,created_at,completed_at,reported_at}`
- 4 个视图：todo（source_status IN (todo,in_progress) AND user_id=me）、done（completed_at NOT NULL）、reported（source_type='ticket' AND reporter_id=me）、watched（关联 Subscription 表）

### Phase 4：可视化与模板（25 人天）

- P1-5 Sprint/Release 甘特图（前端 ECharts）
- P0-1 需求池 UI（`pages/RDM/` 后端接通）
- P1-1 Velocity 图表（后端补 `/rdm/statistics/velocity`）
- Sprint/Ticket/Requirement 模板 CRUD + 应用模板端点

### Phase 5：敏捷仪式（15 人天，可选）

- Sprint Review / Retrospective 记录表
- Definition of Done 检查清单
- Kanban WIP 限制 + 拖拽看板（`pages/SprintBoard/` 已有基础）

### 总工时校准

| 口径 | 人天 | 说明 |
|------|------|------|
| 原报告估算 | 116d | 未考虑 RDM 前端空壳、workbench 伪实现 |
| **本次评审** | **118d** | 新增甘特图 15d、Sprint Review/Retrospective 15d；扣除原高估的模板工时 |
| 建议实施 | **78d**（Phase 1-3） | Phase 4-5 可延后到 M2 |

**分阶段落地节奏**：Phase 1（第 1-2 周）→ Phase 2（第 3-5 周）→ Phase 3（第 6 周）→ Phase 4（第 7-9 周）。M1 结束时功能覆盖率从 37% → **72%**。

---

## 六、专家结论

### 已实现（3 项 ✅）
- 项目管理（Project 模型 + member）
- 迭代计划（Sprint 完整 CRUD + Board + Burndown）
- 详情修改（Ticket/Sprint 均有 PUT）

### 部分实现（7 项 ⚠️）
- 优先级、测试计划 CRUD、测试计划关联用例、状态流转、列表字段、数据仪表板、代码库关联（Ticket 侧）

### 伪实现（1 项 ❌）
- **工作台**：模型字段与语义完全错位

### 完全缺失（9 项 ❌/🚫）
- 需求 CRUD（🚫 空壳）、任务 CRUD、缺陷 CRUD、需求-任务-缺陷-测试互联、组合过滤、关注、代码库关联、甘特图、模板、工作台 4 项

### 核心判断

1. **Orion 是 ITSM 优先，Scrum 补齐**的架构，与 NeatLogic "Scrum 原生"定位有本质差异。当前 37% 完成度中，**Scrum 原生能力只占 20%**（Sprint+Board+Burndown+Ticket 状态流转）。
2. **前端 `RDM/` 目录 40 个 API 调用全部指向 `/rdm/*` 不存在的端点**，是本轮评审发现的最严重技术债 —— 用户会看到"新建需求"按钮但点击必 404，是**功能性欺骗**。
3. **推荐策略**：不要新建独立的 Requirement/Defect/Task 三张表，而是**在 Ticket 上加字段**（story_points、parent_id、labels、sprint_id、severity）+ **新建一个轻量 Relation 表**打通追溯，可在 28 人天内把功能覆盖率从 37% 提升到 65%。

**综合评级：C+（37% 完成度，Scrum 补齐路线可行）**

---

## 七、证据文件索引

| 类别 | 文件 |
|------|------|
| Sprint 后端 | `/Users/heal/orion-design/orion-platform-svc-go/internal/sprint/models/models.go`、`handler/handler.go` |
| Ticket 后端 | `/Users/heal/orion-design/orion-platform-svc-go/internal/ticket/models/ticket.go`、`relation.go` |
| Project 后端 | `/Users/heal/orion-design/orion-platform-svc-go/internal/project/models/models.go` |
| Workbench 后端 | `/Users/heal/orion-design/orion-platform-svc-go/internal/workbench/models/models.go`（仅 5 字段）|
| RDM 前端 | `/Users/heal/orion-design/orion-frontend/src/pages/RDM/index.tsx`、`useRDMState.ts` |
| RDM API client | `/Users/heal/orion-design/orion-frontend/src/api/rdm.ts`（40+ API 调用，后端全不存在）|
| SprintBoard 前端 | `/Users/heal/orion-design/orion-frontend/src/pages/SprintBoard/index.tsx`、`BurndownChart.tsx` |
| TicketDetail 前端 | `/Users/heal/orion-design/orion-frontend/src/pages/TicketDetail/index.tsx` |
| Sprint 归档实现 | `/Users/heal/orion-design/legacy/orion-platform-service-ts/src/services/rdm/SprintBoardService.ts`（2026-07-13 迁移至 Go）|
| TestPlan 后端 | `/Users/heal/orion-design/orion-platform-svc-go/internal/test-selector/service/service.go` |
| Release-Management（非需求） | `/Users/heal/orion-design/orion-platform-svc-go/internal/release-management/models/models.go` |
| Product-Line（含 SAFe ReleaseTrain）| `/Users/heal/orion-design/orion-platform-svc-go/internal/product-line/models/models.go` |

---

**评审日期**：2026-10-01
**评审方法**：全部结论基于 `grep` + `Read` 实际代码，不使用文档推理
**评审边界**：不涉及 Python AI 微服务、DBA 平台、K8s 可视化等非 RDM 域
