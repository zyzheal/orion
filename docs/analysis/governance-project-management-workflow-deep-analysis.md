# 治理 / 项目管理 / 工作流 域深度分析 (2026-08-02)

> **覆盖**: 21 模块 | **数据源**: `orion-platform-svc-go/internal/` 逐文件实测
> **原深度分析覆盖率**: 治理域 0% / 项目管理域 20% / 工作流域 0%

---

## 一、治理域 (Governance) — 21 模块 / 35,551 行 / 综合 82%

### 1.1 治理域总览

治理域是 Orion 平台的安全与合规中枢，分为两层：
- **独立模块层**: policy(策略引擎)/audit(审计)/compliance(合规)/risk(风险)/abac-policy(ABAC)/terminal-audit(终端审计)
- **治理父域层**: `internal/governance/` 含 9 个子模块，与独立模块形成**双实现关系**

| 模块 | 行数 | 测试 | H | S | R | 路由 | Wired | 迁移 | 评分 |
|------|:----:|:----:|:-:|:-:|:-:|:----:|:-----:|:----:|:----:|
| **policy** (策略引擎) | 2,986 | 3 | 28 | 33 | 26 | ✅ | ✅ | ❌ | **100%** |
| **policy/engine** | — | 1 | — | — | — | — | — | — | Rego 评估引擎 |
| **audit** (审计) | 2,830 | 3 | 21 | 77 | 13 | ✅ | ✅ | ❌ | **100%** |
| **governance** (父域) | 9,936 | 7 | — | — | — | ❌ | ❌ | ❌ | 30% |
| **governance/compliance** | 2,748 | 1 | 9 | **35** | — | — | — | — | 75% |
| **governance/risk** | 2,046 | 2 | 6 | **42** | — | — | — | — | 70% |
| **governance/audit** | 1,812 | 2 | 10 | 16 | — | — | — | — | 60% |
| **governance/governance** | 1,965 | 2 | 6 | 7 | — | — | — | — | 55% |
| **condition** (条件引擎) | 2,286 | 1 | 8 | 95 | 16 | ✅ | ❌ | ✅ | **85%** |
| **compliance** (独立) | 910 | 1 | 10 | 22 | 10 | ✅ | ✅ | ❌ | 90% |
| **risk** (独立) | 377 | 1 | 6 | 6 | 6 | ✅ | ✅ | ❌ | 55% |
| **contract** (契约) | 823 | 1 | 10 | 12 | 11 | ✅ | ✅ | ❌ | 90% |
| **abac-policy** | 509 | 1 | 6 | 6 | 6 | ✅ | ✅ | ❌ | 55% |
| **terminal-audit** | 483 | 1 | 6 | 6 | 9 | ✅ | ❌ | ❌ | 45% |
| **privacy** (隐私) | 393 | 1 | 5 | 6 | 7 | ✅ | ❌ | ❌ | 45% |

### 1.2 模块深度分析

#### policy (策略引擎) — 100% ⭐ 域内最强

| 维度 | 数据 | 评价 |
|------|------|------|
| 代码行 | 2,986 | 大模块 |
| Handler | 28 方法 | 策略 CRUD/评估/版本/审批/统计/报告 |
| Service | 33 方法 | 策略评估 + 规则引擎 + 审计 |
| Repo | 26 方法 | 策略持久化 + 版本管理 |
| 测试 | 3 个 | 策略评估测试 + 单元测试 |

**核心能力**:
- **Rego 策略评估引擎** (`policy/engine/rego.go`): 82 个引擎方法，支持 OPA Rego 策略语言
- **策略全生命周期**: Create/Evaluate/Approve/Publish/Deprecate/Archive
- **策略版本管理**: 版本追踪 + 回滚
- **策略审计**: 评估记录 + 决策追踪
- **权限模型**: ABAC 属性评估 + RBAC 角色映射

**关键接口**:
```go
type Policy struct{ ID, TenantID, Name, Description string; Status string }
type EvaluateRequest struct{ Resource, Action, Subject string; Attributes map[string]string }
type EvaluateResponse struct{ Decision string; Reason string; Conditions []string }
```

#### governance (父域) — 30% ⚠️ 最大缺口

| 子模块 | 行数 | 测试 | H | S | 说明 |
|--------|:----:|:----:|:-:|:-:|------|
| governance/compliance | 2,748 | 1 | 9 | **35** | **合规深度实现**，远超独立 compliance(22S) |
| governance/risk | 2,046 | 2 | 6 | **42** | **风险管理深度实现**，远超独立 risk(6S) |
| governance/audit | 1,812 | 2 | 10 | 16 | 审计(独立 audit 77S 更深) |
| governance/governance | 1,965 | 2 | 6 | 7 | 治理框架骨架 |
| governance/abac-policy | 273 | 0 | 6 | 6 | ABAC 策略 (与独立重复) |
| governance/api-governance | 273 | 0 | 6 | 6 | API 治理 (与独立重复) |
| governance/permission-audit | 273 | 0 | 6 | 6 | 权限审计 (与独立重复) |
| governance/policy | 273 | 0 | 6 | 6 | 策略 (与独立重复) |
| governance/terminal-audit | 273 | 0 | 6 | 6 | 终端审计 (与独立重复) |

**关键发现**: governance 父域有 **9 个子模块**，其中 **compliance(35S) 和 risk(42S) 远深于独立模块**。但父域**整体未注册 wiring**，9,936 行代码全部不可用。

#### condition (条件引擎) — 85% ⭐ 被低估

| 维度 | 数据 | 评价 |
|------|------|------|
| 代码行 | 2,286 | 大模块 |
| Service | **95 方法** | 条件评估引擎 |
| Repo | 16 方法 | 条件持久化 |
| 迁移 | ✅ `001_create_condition_tables.sql` | 有独立迁移表 |

**核心能力**:
- **95 Service 方法**的条件评估引擎 — Orion 最复杂的评估逻辑之一
- 条件定义/组合/评估/验证
- 支持 AND/OR/NOT 布尔逻辑
- 属性匹配/数值比较/正则匹配/时间窗口

**Wired 状态**: ❌ **未注册** — 85% 完成度但因未 wiring 而完全不可用。

#### contract (契约管理) — 90%

| 维度 | 数据 |
|------|------|
| Handler | 10 方法 (Create/Get/List/Update/Delete/Approve/Schedule/Review/Cancel/GetStats) |
| Service | 12 方法 |
| Repo | 11 方法 |

**核心能力**: 第三方 API 契约管理，支持 SLA/版本/审批/定时执行。

### 1.3 治理域双实现分析

| 功能 | 独立模块 | governance 子模块 | 深度对比 | 推荐保留 |
|------|---------|------------------|---------|---------|
| 合规 | compliance(22S) | governance/compliance(**35S**) | 子模块更深 | governance/compliance |
| 风险 | risk(**6S**) | governance/risk(**42S**) | 子模块深 7 倍 | governance/risk |
| 审计 | audit(**77S**) | governance/audit(16S) | 独立更深 | audit (独立) |
| ABAC | abac-policy(6S) | governance/abac-policy(6S) | 完全重复 | abac-policy (独立) |

---

## 二、项目管理域 (Project Management) — 5 模块 / 6,405 行 / 综合 75%

### 2.1 模块总览

| 模块 | 行数 | 测试 | H | S | R | 路由 | Wired | 评分 |
|------|:----:|:----:|:-:|:-:|:-:|:----:|:-----:|:----:|
| **federation** (联邦) | 1,845 | 3 | 24 | 30 | 27 | ✅ | ✅ | **100%** |
| **team** (团队) | 1,110 | 1 | 14 | 16 | 16 | ✅ | ✅ | **100%** |
| **product-line** (产品线) | 1,101 | 1 | 16 | 16 | 16 | ✅ | ✅ | **100%** |
| **sprint** (冲刺) | 743 | 1 | 11 | 12 | 11 | ✅ | ✅ | **90%** |
| **project** (项目) | 343 | 1 | 6 | 6 | 6 | ✅ | ✅ | 55% |
| **project-member** | 573 | 1 | 9 | 12 | 12 | ✅ | ✅ | 75% |
| **cross-domain** | 433 | 1 | 6 | 8 | 6 | ✅ | ✅ | 55% |

### 2.2 模块深度分析

#### federation (跨租户联邦) — 100% ⭐ 域内最强

**跨租户联邦管理**是项目管理域的核心架构组件：

| 维度 | 数据 | 评价 |
|------|------|------|
| 代码行 | 1,845 | 中等偏大 |
| Handler | 24 方法 | 联邦 CRUD/关联/权限/同步/状态 |
| Service | 30 方法 | 联邦生命周期管理 |
| Repo | 27 方法 | 联邦持久化 |
| 测试 | 3 个 | 测试覆盖较好 |

**核心能力**:
- **跨租户数据联邦**: 租户间资源共享/隔离/同步
- **联邦生命周期**: Create/Activate/Deactivate/Terminate
- **联邦权限**: 跨租户访问控制
- **数据同步**: 增量同步/全量同步

**关键接口**:
```go
type Federation struct{ ID, Name, Status string; Tenants []FederationTenant }
type FederationTenant struct{ TenantID, Role, PermissionLevel string }
type SyncResult struct{ SyncedCount, FailedCount int; Errors []string }
```

#### team (团队管理) — 100%

| 维度 | 数据 |
|------|------|
| Handler | 14 方法 | 团队 CRUD/成员管理/角色/统计 |
| Service | 16 方法 | 团队业务逻辑 |
| Repo | 16 方法 | 团队持久化 |

**核心能力**:
- 团队创建/编辑/删除/合并/拆分
- 团队成员管理 (加入/移除/角色变更)
- 团队权限继承
- 团队统计 (活跃度/项目数/成员数)

#### sprint (冲刺管理) — 90%

**Scrum 冲刺管理**，含看板、燃尽图、容量规划：

| 维度 | 数据 |
|------|------|
| Service | `GetBoard()`, `GetBurndownData()`, `AddTicket()`, `Create()`, `Get()` |

**核心能力**:
- 看板管理 (Backlog → To Do → In Progress → Done)
- 燃尽图数据 (`GetBurndownData`)
- 冲刺计划/回顾
- Ticket 分配

---

## 三、工作流域 (Workflow) — 12 模块 / 31,931 行 / 综合 70%

### 3.1 模块总览

| 模块 | 行数 | 测试 | H | S | 路由 | Wired | 评分 |
|------|:----:|:----:|:-:|:-:|:----:|:-----:|:----:|
| **workflow** (核心引擎) | 2,650 | 6 | 8 | 38 | ✅ | ✅ | **90%** |
| **approval** (多级审批) | 2,200 | 2 | 16 | 36 | ✅ | ✅ | **90%** |
| workflow-dependency | 266 | 0 | 6 | 6 | ✅ | ❌ | 50% |
| workflow-task | 266 | 0 | 6 | 6 | ✅ | ❌ | 50% |
| workflow-trigger | 266 | 0 | 6 | 6 | ✅ | ❌ | 50% |
| workflow-webhook | 266 | 0 | 6 | 6 | ✅ | ✅ | 55% |
| workflow (独立) | 3,005 | 8 | 52 | 83 | ✅ | ✅ | 85% |
| workflow-dependency (独立) | 616 | 1 | 5 | 3 | 6 | ❌ | 50% |
| workflow-task (独立) | 634 | 1 | 6 | 4 | 7 | ❌ | 50% |
| workflow-trigger (独立) | 791 | 1 | 10 | 7 | 8 | ❌ | 60% |
| workflow-webhook (独立) | 1,044 | 1 | 12 | 9 | 10 | ✅ | 70% |

### 3.2 模块深度分析

#### workflow (核心引擎) — 90%

**DAG 工作流引擎**，支持定义/执行/状态机/事件驱动：

| 维度 | 数据 |
|------|------|
| Handler | 8 方法 (Create/Get/List/Update/Delete/Execute/GetStatus/GetHistory) |
| Service | 38 方法 (DAG 定义/执行/暂停/恢复/取消/重试/状态查询) |
| 测试 | 6 个 |

**核心能力**:
- DAG 工作流定义 (节点/边/依赖)
- 工作流执行引擎 (顺序/并行/条件分支)
- 状态机 (Draft → Running → Paused → Completed → Cancelled)
- 事件驱动触发
- 工作流模板

#### approval (多级审批) — 90%

**多级审批引擎**，支持审批链/委托/时限：

| 维度 | 数据 |
|------|------|
| Handler | 16 方法 | 审批 CRUD/提交/审批/拒绝/撤回/委托 |
| Service | 36 方法 | 审批链构建/审批/超时处理/统计 |

**核心能力**:
- 审批链定义 (多级/并行/条件路由)
- 审批操作 (Approve/Reject/Defer/Delegate)
- 审批时限管理 (自动升级/超时处理)
- 审批历史追踪

### 3.3 工作流域 P0 问题

| # | 问题 | 模块 | 说明 |
|---|------|------|------|
| 1 | **未注册 wiring** | dependency/task/trigger 3 模块 | 1,164 行代码不可用 |
| 2 | **零测试** | workflow-dependency/task/trigger (子模块) | 3 模块无测试 |
| 3 | **重复实现** | workflow/子模块 vs workflow/独立 | 两套实现，需合并 |

---

## 四、域级 P0 问题汇总

| # | 模块 | 问题 | 影响 |
|---|------|------|------|
| 1 | **governance (父域)** | 9,936 行未注册 wiring | 9 子模块全部不可用 |
| 2 | **condition** | 2,286 行/95S 未注册 wiring | 条件引擎完全不可用 |
| 3 | **workflow-dependency/task/trigger** | 1,164 行未注册 wiring | 工作流子模块不可用 |
| 4 | **terminal-audit** | 483 行未注册 wiring | 终端审计不可用 |
| 5 | **privacy** | 393 行未注册 wiring | 隐私管理不可用 |
| 6 | **双实现** | governance/compliance vs compliance | 保留治理父域 |
| 7 | **双实现** | governance/risk vs risk | 保留治理父域 (深 7 倍) |

---

*分析完成: 2026-08-02 | 21 模块 / 35,551 行 / 治理域+项目管理域+工作流域*
