# 权限管控能力评审 + DBA/数据模块接入权限体系协作方案

> 评审日期: 2026-08-29  
> 评审问题: 权限管控能力是否具备？如何接入当前权限体系协作？  
> 评审范围: `orion-go-common/pkg/auth` + 17 个数据相关模块权限守卫 + 前端 usePermission  
> 评审结论: **权限体系完备（RBAC+ABAC+审计+租户隔离+UEBA），但数据域接入有 6 项缺口**

---

## 一、权限管控能力现状（具备，且完备）

### 1.1 权限体系架构

权限管控位于 `orion-go-common/pkg/auth/`（公共包，被所有 Go 微服务复用），包含 **5 大子系统**：

| 子系统 | 文件 | 能力 |
|--------|------|------|
| **RBAC** | `rbac_repository.go` | 角色 + 权限 + 角色继承 + 角色权限授予/撤销 |
| **ABAC** | `abac.go` | 属性策略引擎（租户隔离 + 外网限制 + 工作时间限制） |
| **AuthorizationEngine** | `authorization_engine.go` | RBAC+ABAC 组合决策 + 内存缓存 + 数据库回退 + 审计 worker |
| **PermissionCache** | `permission_cache.go` | 权限缓存（带统计 + 配置） |
| **审计** | `PermissionAuditLog` | 权限决策审计日志 + UEBA 异常检测 + WORM 存储 + 告警 |

### 1.2 权限模型

```go
// 权限三元组: (role, resource, action)
type Permission struct {
    ID          string `db:"id"`
    Resource    string `db:"resource"`    // 如 "dba", "data-catalog"
    Action      string `db:"action"`      // 如 "read", "write", "execute", "approve", "delete"
    Description string `db:"description"`
}

// 角色继承
type RoleInheritance struct { ... }  // 支持角色继承链

// ABAC 策略
type ABACPolicy struct {
    Effect               ABACEffect  // Allow/Deny
    ResourceType         string
    ActionType           string
    ResourceConditions   map[string]interface{}  // 如 tenant_mismatch
    EnvironmentConditions map[string]interface{}  // 如 working_hours, network
    Priority             int
}
```

### 1.3 权限守卫使用方式

**后端**（Gin 中间件，DBA 已用）：

```go
// internal/dba/handler/handler.go:31
f.GET("/orders", auth.RequirePermission("dba", "read"), h.ListOrders)
f.POST("/orders/:id/approve", auth.RequirePermission("dba", "approve"), h.ApproveOrder)
f.POST("/orders/:id/execute", auth.RequirePermission("dba", "execute"), h.ExecuteOrder)
```

**前端**（路由守卫 + usePermission Hook）：

```tsx
// src/router/routes.tsx:20
requiredPermission?: { resource: string; action: string };

// src/hooks/usePermission.ts
const ROLE_PERMISSIONS_FALLBACK: Record<string, string[]> = {
  admin: ['*:*'],
  dba: ['project:read', 'pipeline:read', 'deployment:read', 'config:read', 'alert:read', 'cmdb:read', 'environment:read', 'secrets:read'],
  ...
};
```

### 1.4 结论：权限管控能力具备

- ✅ RBAC 角色权限模型完备
- ✅ ABAC 属性策略（租户隔离 + 外网 + 工作时间）
- ✅ AuthorizationEngine 组合决策
- ✅ 权限缓存 + 数据库回退
- ✅ 审计日志 + UEBA + WORM + 告警
- ✅ 前后端联动（后端中间件 + 前端路由守卫 + Hook fallback）

---

## 二、数据域权限接入现状（6 项缺口）

### 2.1 缺口清单

| ID | 缺口 | 实测证据 | 严重度 |
|----|------|---------|--------|
| PERM-1 | **datasource 模块 0 个权限守卫** | `grep RequirePermission internal/datasource/handler/` → 0 结果 | 🔴 高 |
| PERM-2 | **database-devops 模块 0 个权限守卫** | `grep RequirePermission internal/database-devops/handler/` → 0 结果 | 🔴 高 |
| PERM-3 | **DBA 角色 fallback 无 DBA 权限** | 前端 `dba: [project:read, pipeline:read, ...]` 无 `dba:*` | 🔴 高 |
| PERM-4 | **缺少数据专业角色** | 无 `data_admin`/`data_steward`/`bi_analyst`/`data_engineer` 角色 | 🟡 中 |
| PERM-5 | **权限 resource 拼写不一致** | `data-mashing`（应为 `data-masking`）+ `bi_dashboard` 下划线 vs `report-designer` 短横线 | 🟡 中 |
| PERM-6 | **AI 端点权限未设计** | 原方案 AI Advisor/Text2SQL 端点未定义权限 | 🟡 中 |

### 2.2 PERM-1/2 详解：无守卫模块

**datasource 模块**（连接管理，560 LOC，5 种数据库）：
```
internal/datasource/handler/ → grep RequirePermission → 0 结果
```
**问题**：任何能访问 API 的人都能调用 datasource 端点，获取加密前的连接信息、修改数据源配置、删除数据源。这是**数据源管理的安全裸奔**。

**database-devops 模块**（备份恢复，599 LOC）：
```
internal/database-devops/handler/ → grep RequirePermission → 0 结果
```
**问题**：备份/恢复操作无权限控制，任何用户可触发任意数据库的备份或恢复。

### 2.3 PERM-3 详解：DBA 角色权限错配

前端 `usePermission.ts:74` 的 DBA 角色 fallback：

```ts
dba: [
  'project:read', 'pipeline:read', 'deployment:read', 'config:read',
  'alert:read', 'cmdb:read', 'environment:read', 'secrets:read',
],
```

**问题**：
- 给 DBA 角色分配的是 `project:read`/`pipeline:read` 等研发权限，**完全没有 `dba:read`/`dba:write`/`dba:approve`/`dba:execute`**
- 后端中间件 `auth.RequirePermission("dba", "read")` 会拦截，但前端 fallback 说有权限 → **前后端不一致**
- DBA 用户登录后，前端认为有权限显示菜单，但实际调用 API 被 403 拦截

### 2.4 PERM-4 详解：缺少数据专业角色

当前角色清单（fallback）：
```
admin, super_admin, platform_admin, tenant_admin, org_admin, security_admin,
finops_admin, tech_lead, developer, project_developer, dba, viewer
```

**缺失的数据域专业角色**：
- `data_admin`（数据管理员）— 数据目录/质量/血缘/掩码/分类全权限
- `data_steward`（数据管家）— 数据质量规则 + 血缘标记 + 分类标记
- `bi_analyst`（BI 分析师）— BI 仪表盘 + 报表设计器 + 智能问数
- `data_engineer`（数据工程师）— 数据管道 + ETL DAG + 数据探查

---

## 三、接入权限体系协作方案

### 3.1 修复缺口（PERM-1~3）

#### 3.1.1 datasource 模块补权限守卫

```go
// internal/datasource/handler/handler.go
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
    g := rg.Group("/datasources")
    g.GET("", auth.RequirePermission("datasource", "read"), h.List)
    g.GET("/:id", auth.RequirePermission("datasource", "read"), h.Get)
    g.POST("", auth.RequirePermission("datasource", "write"), h.Create)
    g.PUT("/:id", auth.RequirePermission("datasource", "write"), h.Update)
    g.DELETE("/:id", auth.RequirePermission("datasource", "delete"), h.Delete)
    g.POST("/:id/test", auth.RequirePermission("datasource", "write"), h.TestConnection)
    g.GET("/:id/health", auth.RequirePermission("datasource", "read"), h.HealthCheck)
}
```

#### 3.1.2 database-devops 模块补权限守卫

```go
// internal/database-devops/handler/handler.go
g.POST("/backup", auth.RequirePermission("database-devops", "execute"), h.ExecuteBackup)
g.POST("/restore", auth.RequirePermission("database-devops", "execute"), h.ExecuteRestore)
g.GET("/backups", auth.RequirePermission("database-devops", "read"), h.ListBackups)
g.DELETE("/backups/:id", auth.RequirePermission("database-devops", "delete"), h.DeleteBackup)
```

#### 3.1.3 修复 DBA 角色 fallback

```ts
// src/hooks/usePermission.ts
dba: [
  'dba:read', 'dba:write', 'dba:approve', 'dba:execute', 'dba:delete',
  'dba:ai',                          // 🆕 AI Advisor 权限
  'datasource:read', 'datasource:write',  // 🆕 统一数据源
  'database-devops:read', 'database-devops:execute',  // 🆕 备份恢复
  'data-catalog:read',              // 🆕 数据目录查看（DBA 需要了解 schema）
  'data-quality:read',               // 🆕 SQL 质量规则
  'cmdb:read', 'environment:read', 'alert:read',  // 保留
],
```

### 3.2 新增数据专业角色（PERM-4）

```ts
// src/hooks/usePermission.ts 新增 4 个角色
data_admin: [
  // 全部数据模块权限
  'dba:*', 'datasource:*', 'database-devops:*',
  'data-catalog:*', 'data-quality:*', 'data-lineage:*',
  'data-masking:*', 'data-classification:*',
  'bi_dashboard:*', 'report_designer:*', 'report-designer:*',
  'metadata:*', 'data-pipeline:*',
  // 跨域只读
  'cmdb:read', 'alert:read', 'audit-log:read',
],

data_steward: [
  // 数据质量 + 血缘 + 分类
  'data-catalog:read', 'data-catalog:write',
  'data-quality:read', 'data-quality:write',
  'data-lineage:read', 'data-lineage:write',
  'data-classification:read', 'data-classification:write',
  'data-masking:read',
  'metadata:read',
],

bi_analyst: [
  // BI + 报表 + 智能问数
  'bi_dashboard:read', 'bi_dashboard:write',
  'report_designer:read', 'report_designer:write',
  'report-designer:read', 'report-designer:write',
  'data-catalog:read',
  'metadata:read',
  'data-pipeline:read',
  // AI 问数
  'assistant:read', 'assistant:write',
  'bi_dashboard:ai',              // 🆕 NL→BI 权限
],

data_engineer: [
  // 数据管道 + ETL + 探查
  'data-pipeline:read', 'data-pipeline:write', 'data-pipeline:execute',
  'data-catalog:read', 'data-catalog:write',
  'data-lineage:read',
  'data-quality:read',
  'datasource:read',
  'metadata:read',
],
```

### 3.3 权限 resource 命名统一（PERM-5）

| 现状 | 统一为 | 修复 |
|------|--------|------|
| `data-mashing`（拼写错误） | `data-masking` | 全局替换 |
| `bi_dashboard`（下划线） | `bi-dashboard`（短横线） | 统一 |
| `report_designer` + `report-designer` 并存 | `report-designer` | 删除下划线版本 |

**统一规则**：所有 resource 使用短横线命名（`kebab-case`），与模块目录名一致。

### 3.4 AI 端点权限设计（PERM-6）

原方案第五章新增的 AI 端点，权限设计如下：

| AI 端点 | resource | action | 谁可用 |
|---------|----------|--------|--------|
| `POST /dba/ai/text2sql` | `dba` | `ai` | dba, data_admin, data_engineer, bi_analyst |
| `POST /dba/ai/sql-advisor` | `dba` | `ai` | dba, data_admin |
| `POST /dba/ai/index-advisor` | `dba` | `ai` | dba, data_admin |
| `POST /dba/ai/explain` | `dba` | `ai` | dba, data_admin |
| `GET /dba/slow-queries` | `dba` | `read` | dba, data_admin |
| `POST /data-catalog/profiler/ai` | `data-catalog` | `ai` | data_admin, data_engineer, data_steward |
| `POST /bi-dashboard/ai/ask` | `bi-dashboard` | `ai` | bi_analyst, data_admin |
| `POST /assistant/action` (GenerateSQL) | `assistant` | `write` | dba, data_admin, data_engineer, bi_analyst |

**新增 action: `ai`** — 专门用于 AI 驱动的端点，区别于普通 `read`/`write`，便于成本控制和审计。

### 3.5 ABAC 策略增强（数据场景）

现有 ABAC 默认策略：租户隔离 + 外网限制 + 工作时间限制。**为数据场景新增策略**：

```go
// orion-go-common/pkg/auth/abac.go DefaultABACPolicies() 新增

// 生产库写操作必须在工作时间 + 需要审批
{
    ID:           "production-db-write-restriction",
    Name:         "Production DB write requires approval + working hours",
    Effect:       ABACDeny,
    ResourceType: "dba",
    ActionType:   "execute",
    ResourceConditions: map[string]interface{}{
        "environment": "production",
        "approved":    false,
    },
    EnvironmentConditions: map[string]interface{}{
        "working_hours": false,
    },
    Priority: 60,
    Enabled:  true,
},

// 敏感数据导出必须脱敏
{
    ID:           "sensitive-data-export-masking",
    Name:         "Sensitive data export requires masking",
    Effect:       ABACDeny,
    ResourceType: "data-masking",
    ActionType:   "export",
    ResourceConditions: map[string]interface{}{
        "sensitivity": "high",
        "masked":      false,
    },
    Priority: 55,
    Enabled:  true,
},

// AI 生成 SQL 必须经过审核才能执行
{
    ID:           "ai-sql-audit-required",
    Name:         "AI-generated SQL requires audit before execution",
    Effect:       ABACDeny,
    ResourceType: "dba",
    ActionType:   "execute",
    ResourceConditions: map[string]interface{}{
        "source": "ai_generated",
        "audited": false,
    },
    Priority: 50,
    Enabled:  true,
},
```

### 3.6 权限与前端工作台协作

第九章设计的两个工作台，权限映射如下：

| 工作台 | 路由 | requiredPermission | 可见角色 |
|--------|------|-------------------|---------|
| `/dba-workbench` | 顶级 | `{resource: 'dba', action: 'read'}` | dba, data_admin |
| `/dba-workbench/ai-advisor` | 子路由 | `{resource: 'dba', action: 'ai'}` | dba, data_admin |
| `/dba-workbench/backup` | 子路由 | `{resource: 'database-devops', action: 'execute'}` | dba, data_admin |
| `/data-workbench` | 顶级 | `{resource: 'data-catalog', action: 'read'}` | data_admin, data_steward, data_engineer, bi_analyst |
| `/data-workbench/masking` | 子路由 | `{resource: 'data-masking', action: 'read'}` | data_admin, data_steward |
| `/data-workbench/bi-dashboard` | 子路由 | `{resource: 'bi-dashboard', action: 'read'}` | bi_analyst, data_admin |
| `/data-workbench/ai-ask` | 子路由 | `{resource: 'bi-dashboard', action: 'ai'}` | bi_analyst, data_admin |

---

## 四、完整权限矩阵

### 4.1 资源 × 动作 × 角色 矩阵

| Resource | Action | dba | data_admin | data_steward | bi_analyst | data_engineer |
|----------|--------|-----|------------|--------------|------------|----------------|
| dba | read | ✅ | ✅ | - | - | - |
| dba | write | ✅ | ✅ | - | - | - |
| dba | approve | ✅ | ✅ | - | - | - |
| dba | execute | ✅ | ✅ | - | - | - |
| dba | delete | ✅ | ✅ | - | - | - |
| dba | ai 🆕 | ✅ | ✅ | - | - | - |
| datasource | read | ✅ | ✅ | - | - | ✅ |
| datasource | write | ✅ | ✅ | - | - | - |
| database-devops | read | ✅ | ✅ | - | - | - |
| database-devops | execute | ✅ | ✅ | - | - | - |
| data-catalog | read | ✅ | ✅ | ✅ | ✅ | ✅ |
| data-catalog | write | - | ✅ | ✅ | - | ✅ |
| data-catalog | ai 🆕 | - | ✅ | - | - | ✅ |
| data-quality | read | ✅ | ✅ | ✅ | - | ✅ |
| data-quality | write | - | ✅ | ✅ | - | - |
| data-lineage | read | - | ✅ | ✅ | - | ✅ |
| data-lineage | write | - | ✅ | ✅ | - | - |
| data-masking | read | - | ✅ | ✅ | - | - |
| data-masking | write | - | ✅ | - | - | - |
| data-classification | read | - | ✅ | ✅ | - | - |
| data-classification | write | - | ✅ | ✅ | - | - |
| bi-dashboard | read | - | ✅ | - | ✅ | - |
| bi-dashboard | write | - | ✅ | - | ✅ | - |
| bi-dashboard | ai 🆕 | - | ✅ | - | ✅ | - |
| report-designer | read | - | ✅ | - | ✅ | - |
| report-designer | write | - | ✅ | - | ✅ | - |
| metadata | read | - | ✅ | ✅ | ✅ | ✅ |
| data-pipeline | read | - | ✅ | - | ✅ | ✅ |
| data-pipeline | write | - | ✅ | - | - | ✅ |
| data-pipeline | execute | - | ✅ | - | - | ✅ |
| assistant | read | ✅ | ✅ | ✅ | ✅ | ✅ |
| assistant | write | ✅ | ✅ | - | ✅ | ✅ |

### 4.2 权限守卫覆盖率目标

| 模块 | 现状守卫数 | 目标守卫数 | 状态 |
|------|-----------|-----------|------|
| dba | 17 | 17 + 4(AI) = 21 | 补 AI 端点 |
| datasource | **0** | 7 | 🔴 全补 |
| database-devops | **0** | 5 | 🔴 全补 |
| data-catalog | 9 | 9 + 1(AI) = 10 | 补 AI 端点 |
| data-quality | 13 | 13 | ✅ |
| data-pipeline | 12 | 12 | ✅ |
| data-lineage | 9 | 9 | ✅ |
| data-masking | 6 | 6 | ✅（修拼写） |
| data-classification | 4 | 4 | ✅ |
| bi-dashboard | 5 | 5 + 1(AI) = 6 | 补 AI 端点 |
| report-designer | 16 | 16 | ✅（修命名） |
| metadata | 8 | 8 | ✅ |

---

## 五、实施计划

### Phase 0 — 权限修复（前置，3 天）

| # | 任务 | 解决缺口 | 工作量 |
|---|------|---------|--------|
| P0.1 | datasource 模块补 7 个权限守卫 | PERM-1 | 0.5d |
| P0.2 | database-devops 模块补 5 个权限守卫 | PERM-2 | 0.5d |
| P0.3 | 修复 DBA 角色 fallback（加 dba:*） | PERM-3 | 0.5d |
| P0.4 | 新增 4 个数据专业角色 fallback | PERM-4 | 0.5d |
| P0.5 | 修拼写 data-mashing→data-masking + 命名统一 | PERM-5 | 0.5d |
| P0.6 | AI 端点权限定义（dba:ai / data-catalog:ai / bi-dashboard:ai） | PERM-6 | 0.5d |

### Phase 1 — ABAC 增强（与原方案 Phase 0 并行，2 天）

| # | 任务 | 工作量 |
|---|------|--------|
| P1.1 | 生产库写操作 ABAC 策略 | 0.5d |
| P1.2 | 敏感数据导出脱敏 ABAC 策略 | 0.5d |
| P1.3 | AI 生成 SQL 必须审核 ABAC 策略 | 0.5d |
| P1.4 | 数据库迁移：新增 permissions 行（dba:ai, data-catalog:ai, bi-dashboard:ai） | 0.5d |

### 验收标准

| 维度 | 标准 | 验证方法 |
|------|------|---------|
| 守卫覆盖率 | 12 个数据模块 100% 有权限守卫 | grep 每个模块 ≥1 个 RequirePermission |
| 角色完整性 | 4 个新角色（data_admin 等）有完整权限 | 前端 fallback + 后端 roles 表 |
| 命名一致 | 0 个 `data-mashing`，0 个下划线/短横线混用 | grep 全局 |
| AI 权限 | 所有 AI 端点有 `:ai` action 守卫 | grep `dba.*ai\|data-catalog.*ai\|bi-dashboard.*ai` |
| 前后端一致 | 前端 fallback 与后端中间件权限一致 | 对比 usePermission.ts 与 handler.go |
| ABAC 策略 | 3 条数据场景策略生效 | ABAC 引擎测试 |

---

## 六、总结

### 6.1 回答两个问题

**Q1: 权限管控能力是否具备？**
**A: 具备，且完备。** `orion-go-common/pkg/auth` 提供 RBAC + ABAC + AuthorizationEngine + 权限缓存 + 审计日志 + UEBA + WORM 存储，前后端联动（后端中间件 + 前端路由守卫 + Hook fallback）。

**Q2: 如何接入当前权限体系协作？**
**A: 数据域接入有 6 项缺口需修复**：
1. datasource + database-devops 补权限守卫（PERM-1/2，🔴 安全裸奔）
2. 修复 DBA 角色 fallback 权限错配（PERM-3，🔴 前后端不一致）
3. 新增 4 个数据专业角色（PERM-4，data_admin/data_steward/bi_analyst/data_engineer）
4. 统一 resource 命名 + 修拼写（PERM-5）
5. AI 端点权限设计（PERM-6，新增 `:ai` action）
6. ABAC 增强 3 条数据场景策略（生产库写/敏感导出/AI SQL 审核）

### 6.2 与前两份文档的关系

| 文档 | 内容 | 本文档补充 |
|------|------|-----------|
| `dba-data-ai-agent-gap-analysis-2026-08-29.md` | AI 集成设计 | 补充 AI 端点权限 + 新角色 |
| `dba-data-deep-review-and-interaction-issues-2026-08-29.md` | 系统交互问题 | 补充权限守卫缺口 + ABAC 增强 |
| **本文档** | **权限体系接入** | 6 项缺口修复 + 完整权限矩阵 |

三份文档配套使用，构成 DBA/数据/AI 域的完整设计：**能力设计 → 交互修复 → 权限接入**。

---

> 文档结束。本文档评审权限管控能力现状（完备）+ 数据域接入缺口（6 项）+ 修复方案 + 完整权限矩阵，可直接作为权限接入开发的设计依据。
