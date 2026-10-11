# RDM 升级设计（2026-10-03）

**目标模块**：`orion-platform-svc-go/internal/{project,sprint,ticket,ticketing,workbench,test-selector,requirement?}` + 前端 RDM 页面
**基线数据**：`reports/expert-reviews/rdm-expert-rereview-2026-10-01.md`（467 行独立复评 36-42%）
**相关报告**：`reports/expert-reviews/rdm-expert-review-2026-09-30.md`（v1 33%）

---

## 1. TL;DR

- **当前完成度**：38%（复评中值 36-42%，v1 33% 低估）
- **目标完成度**：65-70%（补 RDM 后端路由 + 需求管理 + 任务管理 + Sprint→Project 关联 + Ticket RDM 字段扩展）
- **关键改动**：
  1. **P0-1**：新建 `/rdm/` 后端路由（当前 0 API，前后端契约 100% 断裂）
  2. **P0-2**：新建 Requirement 模块（需求管理，8+ API）
  3. **P0-3**：Sprint 补 ProjectID 外键 + 关联查询（当前 0 命中 project_id）
  4. **P0-4**：Ticket 扩展 6 个 RDM 字段（parent_id/sprint_id/repo_ref/labels/story_points/severity）
  5. **P0-5**：Sprint 补 SprintReview/Retrospective/Gantt/Velocity
  6. **P1-1**：Task 模块新建（可复用 Ticket 或独立子域）
  7. **P1-2**：Spec 需求规格文档模块新建
- **不动的部分**：Sprint 10 端点（CRUD + board + addTickets/removeTickets/reorderTickets/burndown）+ TicketRelation 4 种 rel_type + Ticket 状态机 5×13 + TestSelector + Workbench（保留但升级）

---

## 2. 当前状态（代码实证）

### 2.1 Orion 侧现有 RDM 相关模块

| 模块 | 行数 | 端点 | 状态 |
|------|------|------|------|
| sprint | 85-89 model + 10 endpoints | 10（CRUD 5 + 业务 5） | ✅ 10 端点完整，含看板/Burndown/拖拽 |
| ticket | — | 5+ | ⚠️ 状态机 5 状态 + 13 转换（ticketing/service.go:71-78） |
| ticketing | — | TicketRelation 4 rel_type | ✅ IssueRel 等价实现 |
| workbench | 22 行 / 5 字段 | — | ❌ 空壳（P0-2） |
| project | — | 有 API | ⚠️ 存在但 Sprint 无关联 |
| project-member | — | — | ✅ |
| ticket-automation | — | — | ⚠️ 3 字段 |
| ticket-knowledge | — | — | ⚠️ |
| test-selector | TestExecutionPlan（选/跳/估/分组） | — | ⚠️ 与 RDM 测试计划语义不同 |

### 2.2 关键实证

- `grep "rdm\|Requirement" internal/ --include="*.go"` → 0 命中（后端 0 API）
- Sprint 10 端点（v1 报告为 3 端点，v3 修正）：
  - POST/GET/GET:ID/PUT/DELETE 5 个 CRUD
  - GET /:id/board, POST /:id/tickets, DELETE /:id/tickets/:ticketId, PUT /:id/tickets/reorder, GET /:id/burndown
  - 每端点带 `auth.RequirePermission("sprint", "xxx")` ACL
- Sprint 模型：`SprintBoard` + `TicketsByStatus` + `BurndownPoint`（Date/Planned/Actual/Remaining）
- Ticket 状态机：open/assigned/in-progress/resolved/closed = 5 状态 + 13 条转移边
- TicketRelation 结构：ID/TenantID/TicketID/RelatedID/Type/Confidence（4 rel_type：blocks/blocked_by/relates/duplicate）
- `grep "project_id\|ProjectID" internal/sprint/` → 0 命中（**P0-4 阻塞**）
- `grep "Severity\|parent_id\|sprint_id\|repo_url\|labels\|story_points" ticketing/models/`：
  - severity 存在（DefectBI 相关，不在 Ticket 主表）
  - parent_id/sprint_id/repo_ref/labels/story_points 全部 0 命中（**P0-5**）
- Workbench：`models.Workbench` 只有 ID/TenantID/Name/CreatedAt/UpdatedAt 5 字段（P0-2 空壳）

---

## 3. NeatLogic 对标差距（Gap 分级）

| Gap 编号 | 能力项 | 分级 | 描述 |
|---------|-------|------|------|
| G0-1 | `/rdm/` 后端路由完全缺失 | **G0** | 前后端契约 100% 断裂 |
| G0-2 | Workbench 空壳 | **G0** | 22 行 5 字段 |
| G0-3 | Requirement 需求管理完全空白 | **G0** | 8+ API 全缺 |
| G0-4 | Sprint→Project 0 耦合 | **G0** | 0 命中 project_id |
| G0-5 | Ticket 缺 RDM 字段（6 字段） | **G0** | parent_id/sprint_id/repo_ref/labels/story_points/severity |
| G0-6 | Sprint 缺 SprintReview/Retrospective/Gantt/Velocity | **G0** | 5 项能力全缺 |
| G1-1 | Task 模块完全空白 | **G1** | 可复用 Ticket 或独立 |
| G1-2 | Spec 需求规格文档 | **G1** | 完全空白 |
| G1-3 | Code Review 集成 | **G1** | 完全空白 |
| G1-4 | Release 版本发布 | **G1** | 完全空白 |
| G1-5 | 需求跟踪矩阵 | **G1** | 完全空白 |
| G2-1 | TestExecutionPlan 语义冲突 | **G2** | Orion 同名不同义 |

---

## 4. 升级目标

### 4.1 架构层

- **RDM 后端路由挂载**：
  - `/api/v1/rdm/*` 顶级路由
  - 子路由：`/requirements` `/tasks` `/specs` `/releases` `/matrix`
- **Sprint 与 Project 关联**：
  - Sprint 表增加 `project_id` 外键
  - `ProjectID` 可选但强烈建议
  - API 查询：`GET /projects/{id}/sprints`
- **Ticket RDM 字段扩展**：
  - ALTER tickets 表加 6 字段
  - Repository 层扩展
  - Handler 层接收
- **Workbench 升级**：
  - 从 5 字段扩到 15+ 字段
  - 增加 widgets 配置、过滤器、快捷操作
- **SprintReview 与 Retrospective**：
  - SprintReview 表：回顾项、行动项、评分
  - Retrospective 模板：3 things that went well / 3 things to improve / actions
- **需求跟踪矩阵**：
  - Requirement → Task → TestCase → Release 四层矩阵

### 4.2 数据模型层（Migration 745-754）

- `745_rdm_requirements.sql`：需求表
- `746_rdm_requirement_children.sql`：需求父子层级
- `747_rdm_tasks.sql`：任务表（或 ALTER tickets）
- `748_rdm_specs.sql`：需求规格文档
- `749_rdm_releases.sql`：版本发布
- `750_rdm_sprint_review.sql`：Sprint 回顾
- `751_rdm_sprint_gantt.sql`：甘特图数据
- `752_rdm_velocity.sql`：速率数据
- `753_rdm_matrix.sql`：需求跟踪矩阵
- `754_rdm_ticket_ext.sql`：Ticket 扩展 6 字段（ALTER 现有 tickets）

### 4.3 API 层（对齐 NeatLogic RDM 8 子域）

- `/api/v1/rdm/requirements/*`：CRUD 5 + 搜索 1 + 层级 2 = 8 端点
- `/api/v1/rdm/tasks/*`：CRUD 5 + 分配 2 = 7 端点（或复用 /tickets）
- `/api/v1/rdm/specs/*`：CRUD 4 + 版本 3 = 7 端点
- `/api/v1/rdm/releases/*`：CRUD 5 + 发布 2 = 7 端点
- `/api/v1/rdm/matrix/*`：查询 3 + 更新 1 = 4 端点
- `/api/v1/rdm/workbench/*`：配置 CRUD 3 + 快捷操作 2 = 5 端点
- Sprint 扩展：`GET /sprints/:id/review` + `POST /sprints/:id/review` + `GET /sprints/:id/gantt` + `GET /sprints/:id/velocity` = 4 端点

---

## 5. 依赖链

### 5.1 前置模块

- **Project 模块**：Sprint→Project 关联（已有 project 模块）
- **Ticket/Ticketing**：Task 复用 Ticket（TicketRelation 已有）
- **Test-Selector**：需求验证计划可复用（但语义不同，需新建 RDM 版）

### 5.2 复用组件

| 组件 | 用途 |
|------|------|
| `internal/ticket/` (8280 行) | Task 复用（若不做独立 Task 模块） |
| `internal/ticketing/` (11857 行) | 状态机复用（Ticket→Task 状态转移） |
| `internal/sprint/` | Sprint 扩展 |
| `internal/project/` | Project 已有 |
| `internal/audit/` | RDM 变更审计 |
| `internal/notification/` | 需求/任务通知 |

### 5.3 下游消费者

- **DevOps**：Release 触发 Pipeline
- **ITSM**：需求缺陷转 ITSM Ticket
- **BI**：RDM 数据入报表

---

## 6. 实施步骤

### 阶段 1：RDM 后端路由 + Project/Sprint 关联（P0-1/4）

1. 新建 `internal/rdm/routes.go`：
   ```go
   func RegisterRoutes(r *gin.RouterGroup) {
       r.GET("/rdm/requirements", h.ListRequirements)
       r.POST("/rdm/requirements", h.CreateRequirement)
       // ...
   }
   ```
2. Sprint 表 ALTER：加 `project_id VARCHAR(36) NULL`
3. Sprint Model 增加 `ProjectID string` 字段
4. Sprint Service 增加：
   - `ListByProject(ctx, tenantID, projectID)`
   - `GetSprintProjects(ctx)`
5. Project Service 增加：`ListSprintsByProject(ctx, tenantID, projectID)`

### 阶段 2：Ticket RDM 字段扩展（P0-5）

1. ALTER tickets 表加 6 字段：
   - `parent_id VARCHAR(36) NULL`（父子层级）
   - `sprint_id VARCHAR(36) NULL`（迭代关联，替代 SprintTicket 表外联）
   - `repo_ref VARCHAR(255) NULL`（代码仓库关联）
   - `labels JSONB NULL`（标签数组）
   - `story_points FLOAT NULL`（敏捷估算）
   - `severity VARCHAR(20) NULL`（严重度，迁移 DefectBI 的 severity）
2. Ticket Model 增加对应字段
3. Repository 层扩展查询
4. Handler 层接收
5. 保留 SprintTicket 表用于关联 Sprint，但 sprint_id 也冗余存储方便查询

### 阶段 3：Requirement 模块新建（P0-3）

1. `internal/rdm/requirement/` 新建：
   - Models：Requirement / RequirementChild / RequirementVersion / RequirementComment
   - Service：CRUD + Search + Hierarchy + Link/Unlink
   - Handler：8 端点
2. Migration 745-746
3. 与 Ticket/Task 关联：Requirement 可创建为 Task（Ticket 类型）

### 阶段 4：Workbench 升级（P0-2）

1. Workbench 表扩展：widgets_json / filters_json / quick_actions_json / columns / layout / theme
2. Service 增加：Configure / ApplyPreset / SaveAsPreset
3. Handler 补齐 5 端点
4. 前端页面配合改造

### 阶段 5：SprintReview + Retrospective + Gantt + Velocity（P0-6）

1. Migration 750-752
2. Sprint Service 增加：
   - `GetReview(ctx, sprintID)`
   - `SaveReview(ctx, sprintID, items)`
   - `GetGantt(ctx, sprintID)`
   - `GetVelocity(ctx, sprintID)`
3. Handler 补齐 4 端点
4. Retrospective 模板：预置 3 种模板（SAFe / Kanban / 3-2-1）

### 阶段 6：Task 模块决策（P1-1）

**方案 A**：Task 完全复用 Ticket
- Ticket 表增加 `kind` 字段（task/bug/feature/requirement）
- `/api/v1/rdm/tasks` 路由实际走 tickets
- 优点：无重复数据
- 缺点：Ticket 表职责膨胀

**方案 B**：Task 独立模块
- 新建 `internal/rdm/task/`
- 优点：职责清晰
- 缺点：与 Ticket 有重叠

**建议**：方案 A（复用 Ticket + kind 字段），符合"合并方向"策略

### 阶段 7：Spec 需求规格 + Code Review + Release + 矩阵（P1-2/3/4/5）

1. Spec：类似 Confluence，Markdown/HTML 文档 + 版本
2. Code Review：集成 GitHub/GitLab 变更请求
3. Release：版本发布管理，关联 Sprint/Ticket/Commit
4. 需求跟踪矩阵：Requirement→Task→TestCase→Release 四层映射

---

## 7. 验证方式

### 7.1 grep 验证

```bash
# RDM 路由存在
grep -n "rdm" internal/rdm/routes.go
grep -rn "internal/rdm" main.go app.go cmd/server/main.go
# 期望：>5 命中

# Sprint Project 关联
grep -n "ProjectID\|project_id" internal/sprint/models/ internal/sprint/repository/
# 期望：>5 命中（原 0）

# Ticket RDM 字段
grep -n "ParentID\|SprintID\|RepoRef\|Labels\|StoryPoints\|Severity" internal/ticketing/models/ internal/ticket/models/
# 期望：>10 命中（原 0）

# SprintReview/Gantt/Velocity
grep -n "GetReview\|GetGantt\|GetVelocity" internal/sprint/service/
```

### 7.2 单元测试

- RDM 路由挂载：3 用例（GET/POST/权限）
- Sprint→Project 查询：3 用例
- Ticket RDM 字段：6 用例（每字段一用例）
- Workbench 配置：4 用例
- SprintReview 保存/查询：3 用例
- Requirement CRUD：4 用例
- Requirement 父子层级：3 用例

### 7.3 e2e 验证

1. 创建 Project "支付系统 v2.0"
2. 在 Project 下创建 Sprint "Sprint 5"（带 project_id）
3. 创建 Requirement "用户登录"（关联 Sprint 5）
4. Requirement 拆分子需求："验证码"、"记住我"
5. 子需求关联到 Ticket（kind=task）
6. Ticket 分配给工程师，状态 open→assigned→in-progress→resolved→closed
7. Sprint 结束 → 触发 SprintReview
8. Release "v2.0" 发布，关联本 Sprint 的所有 Ticket

---

## 8. 风险与回滚

### 8.1 主要风险

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| RDM 后端路由与现有 ITSM 路由冲突 | 中 | 高 | 路由前缀独立（/rdm vs /tickets） |
| Ticket 表扩展 6 字段破坏现有查询 | 中 | 高 | 全部字段可空，迁移不影响现有数据 |
| Sprint→Project 关联强制迁移历史数据 | 中 | 中 | project_id 可选，历史 Sprint 保持 NULL |
| Task 复用 Ticket 语义混乱 | 高 | 中 | kind 字段区分，UI 层显示不同视图 |
| 需求父子层级深度无限循环 | 中 | 中 | 最大层级限制 3 层，深度优先检测 |
| SprintReview/Retrospective 模板过多 | 低 | 低 | 预置 3 种，用户可扩展 |

### 8.2 回滚策略

- **RDM 路由回滚**：从 main.go 移除 `RegisterRoutes(rdm)`
- **Ticket 字段回滚**：Migration `migrate down 754` 回退 ALTER
- **Sprint ProjectID 回滚**：ALTER TABLE 移除字段（保留数据）
- **Workbench 升级回滚**：Model 字段可空，回滚后不影响旧字段
- **SprintReview/Gantt/Velocity 回滚**：4 端点移除，表保留

### 8.3 认知边界

- 未量化 NeatLogic RDM 8 子域具体端点数（`/private/tmp/neatlogic-itom/` 本机不存在，采信 v1/v2 报告）
- 未验证 Task 复用 Ticket 的语义是否覆盖 NeatLogic Task 全部需求
- 未评估 Code Review 集成的具体 Git Provider 覆盖（GitHub/GitLab/Bitbucket 三家已有模型字段）
- 未评估前端 RDM 页面的具体交互设计（本设计仅覆盖后端）

---

**文档编号**：`rdm-upgrade-design-2026-10-03.md`
**关联报告**：`rdm-expert-rereview-2026-10-01.md` / `cross-review-synthesis-2026-10-03-v4.md`（当前权威）
**交叉依赖**：ITSM（Ticket 状态机复用） / DevOps（Release→Pipeline） / BI（RDM 报表） / Test-Selector（验证计划）
