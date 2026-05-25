# 基础设施 (/infra) + 治理 (/governance) 深度能力评估报告

**评估日期**: 2026-05-22
**评估人**: 资深代码审计专家
**分支**: `feat/frontend-gap-implementation`

---

## 一、模块概览

### 基础设施 (/infra)

| 指标 | 值 |
|------|-----|
| 菜单子项数 | 16（环境管理、临时环境、构建环境、IaC、队列、向量存储、事件总线、CMDB 6个子Tab、会话、备份、值班） |
| 前端页面数 | 11 个独立页面 + CMDB 内 6 个子页面 = 17 |
| 后端 Service 数 | ~8（environment, ephemeral-env, iac, queue, eventbus, session, vector-store, audit） |
| API 路由注册状态 | ⚠️ 部分路由未注册（详见下文） |

### 治理 (/governance)

| 指标 | 值 |
|------|-----|
| 菜单子项数 | 11（策略、审计、SBOM、租户、角色、配置、审批、工作流、FinOps） |
| 前端页面数 | 12 个独立页面（含 /console/approvals, /workflows, /console/workflows 等子页面） |
| 后端 Service 数 | ~10（policy, audit, sbom, tenant, role, config, approval, workflow, eventbus） |
| API 路由注册状态 | ⚠️ FinOps 路由已迁移到独立微服务，SBOM 路由存在但未注册 |

---

## 二、路由注册检查（routes.ts）

### ✅ 已注册路由

| 前端路径 | 后端路由前缀 | 路由文件 | 状态 |
|----------|------------|---------|------|
| `/environments` | `/api/v1/environments` | `environment-routes.ts` | ✅ routes.ts:529 |
| `/ephemeral-envs` | `/api/v1/ephemeral-envs` | `ephemeral-env-routes.ts` | ✅ routes.ts:437 |
| `/console/iac/*` | `/api/v1/iac` | `iac-routes.ts` | ✅ routes.ts:434 |
| `/queue` | `/api/v1/queue` | `queue-routes.ts` | ✅ routes.ts:1031 |
| `/eventbus` | `/api/v1/eventbus` | `eventbus-routes.ts` | ✅ routes.ts:499 |
| `/sessions` | `/api/v1/sessions` | `session-routes.ts` | ✅ routes.ts:520 |
| `/vector-store` | `/api/v1/vector-store` | `vector-store-routes.ts` | ✅ routes.ts (import line 27) |
| `/policies` | `/api/v1/policies` | `policy-routes.ts` | ✅ routes.ts:1041 |
| `/audit-log` | `/api/v1/audit` | `audit-routes.ts` | ✅ routes.ts:421 |
| `/roles` | `/api/v1/roles` | `role-routes.ts` | ✅ routes.ts:517 |
| `/config-management` | `/api/v1/config` | `config-routes.ts` | ✅ routes.ts:398 |
| `/approvals` | `/api/v1/approvals` | `approval-routes.ts` | ✅ routes.ts:495 |
| `/workflows` | `/api/v1/workflows` | `workflow-routes.ts` | ✅ routes.ts:587 |
| `/tenant-list` | `/api/v1/tenant` | `tenant-routes.ts` | ✅ routes.ts:424 |

### ❌ 未注册路由（= 404）

| 前端路径 | 期望后端路由 | 问题 | 严重性 |
|----------|------------|------|--------|
| `/backup` | `/api/v1/backup` | **`backup-routes.ts` 文件不存在**（仅注释引用，实际无实现） | 🔴 P0 |
| `/oncall` | `/api/v1/oncall` | **`oncall-routes.ts` 文件不存在**（仅 `.bak` 中有 import，当前无实现） | 🔴 P0 |
| `/finops` | `/api/v1/cost` | **路由注释掉**（`routes.ts:400-404` 写明"已迁移到 orion-finops-svc"，但前端仍调用 `/v1/cost/*`） | 🔴 P0 |
| `/cmdb` | 无 | **`routes.ts:386` 明确注释"CMDB 路由已迁移到独立 Go 服务 (orion-cmdb-service)"**，前端仍调用 API | 🟡 P1 |
| `/sbom` | `/api/v1/sbom` | **`sbom-routes.ts` 仅存在于 `.bak` 文件**，当前 `api/` 目录下无此文件，路由未注册 | 🔴 P0 |

### ⚠️ 路由迁移但未更新前端

| 前端页面 | 问题 |
|----------|------|
| `FinOpsDashboard` | 调用 `/v1/cost/*`，但后端路由已迁移到 `orion-finops-svc:3009`，当前 platform-service 无此路由 |
| `CMDB` 全部子页面 | 调用 `/v1/cmdb/*`，但后端已迁移到独立 Go 服务，当前无此路由 |

---

## 三、完整调用链追踪

### 基础设施模块

#### 1. Environment Management (`/environments`)

| 步骤 | 文件 | 状态 | 备注 |
|------|------|------|------|
| 按钮 → handle | `Environments/index.tsx:136-170` (handleCreate) | ✅ | 含 loading, feedback |
| 前端 API | `api/environments.ts` → `api.post('/v1/environments', ...)` | ✅ | |
| 后端路由 | `routes.ts:529` → `environmentRoutes` | ✅ | |
| Controller | `environment-routes.ts` 内联 fastify handler | ✅ | |
| Service | `services/EnvironmentService` (PostgreSQL backed) | ✅ | 有 Repository 层 |
| 持久化 | PostgreSQL | ✅ | routes.ts 传入了 `database` |
| 前端反馈 | `message.success('环境创建成功')` | ✅ | |

**调用链**: ✅ 完整 (Create/Read/Update/Delete 全链路)

#### 2. Ephemeral Environments (`/ephemeral-envs`)

| 步骤 | 文件 | 状态 | 备注 |
|------|------|------|------|
| 按钮 → handle | `EphemeralEnvList/index.tsx:200-224` (handleCreate) | ✅ | |
| 前端 API | `api/ephemeral-envs.ts` | ✅ | |
| 后端路由 | `routes.ts:437` → `ephemeralEnvRoutes` | ✅ | |
| Service | 有 PostgreSQL 支持 | ✅ | |
| 前端反馈 | `message.success('临时环境创建成功')` | ✅ | |

**调用链**: ✅ 完整

#### 3. IaC Management (`/console/iac`)

| 步骤 | 文件 | 状态 | 备注 |
|------|------|------|------|
| 路由 | `routes.ts:434` → `iacRoutes` | ✅ | |
| 前端页面 | `IacManagement/index.tsx` 仅为 Layout 壳 | ⚠️ | 子页面 `WorkspaceList.tsx` 有实际实现 |
| Service | 有 PostgreSQL 支持 | ✅ | |

**调用链**: ✅ 完整（需确认子页面对接）

#### 4. Backup Management (`/backup`)

| 步骤 | 文件 | 状态 | 备注 |
|------|------|------|------|
| 前端页面 | `Backup/index.tsx` | ✅ 代码完整 | CRUD + Restore + Download |
| 前端 API | `api/backup.ts` → `/v1/backup/*` | ✅ | |
| 后端路由 | ❌ **`backup-routes.ts` 文件不存在** | ❌ | `routes.ts` 中只有注释行（line 417） |
| Service | ❌ 无实现 | ❌ | |
| 持久化 | ❌ 无 | ❌ | |

**调用链**: ❌ **前端有完整 UI，后端无路由 = 所有操作均 404**

#### 5. OnCall Management (`/oncall`)

| 步骤 | 文件 | 状态 | 备注 |
|------|------|------|------|
| 前端页面 | `OnCall/index.tsx` | ✅ 代码完整 | CRUD + Override + Detail |
| 前端 API | `api/oncall.ts` → `/v1/oncall/*` | ✅ | |
| 后端路由 | ❌ **`oncall-routes.ts` 文件不存在** | ❌ | `routes.ts` 中只有注释行（line 476） |
| Service | ❌ 无实现 | ❌ | |
| 降级 | `api/oncall.ts:99` fallback to `FALLBACK_USERS` | ⚠️ | 前端有硬编码降级用户 |

**调用链**: ❌ **前端有完整 UI，后端无路由 = 所有操作均 404**

#### 6. CMDB (`/cmdb`)

| 步骤 | 文件 | 状态 | 备注 |
|------|------|------|------|
| 前端页面 | `CMDB/index.tsx` (Tabs: 配置项/拓扑图/集成/Web终端/批量执行/审计) | ✅ 代码完整 | 6 个子页面 |
| 前端 API | `api/cmdb.ts` → `/v1/cmdb/*` | ✅ | |
| 后端路由 | ❌ **`routes.ts:386` 明确注释"已迁移到独立 Go 服务"** | ❌ | |
| Service | ❌ platform-service 无实现 | ❌ | orion-cmdb-service (Go) 可能有 |
| WebTerminal | `WebTerminalPage.tsx` 使用 xterm.js + WebSocket | ✅ | 但依赖 orion-visor SSH 代理 |

**调用链**: ❌ **后端路由不存在于当前服务，需确认 orion-cmdb-service 是否部署**

#### 7. Queue Management (`/queue`)

| 步骤 | 文件 | 状态 | 备注 |
|------|------|------|------|
| 前端页面 | `QueueTasks/index.tsx` | ✅ | 完整 |
| 前端 API | `api/queue.ts` | ✅ | |
| 后端路由 | `routes.ts:1031` → `queueRoutes` | ✅ | |

**调用链**: ✅ 完整

---

### 治理模块

#### 1. Policy Management (`/policies`)

| 步骤 | 文件 | 状态 | 备注 |
|------|------|------|------|
| 前端页面 | `PolicyManagement/index.tsx` | ✅ | CRUD + Violations + Evaluate |
| 前端 API | `api/policies.ts` | ✅ | |
| 后端路由 | `routes.ts:1041` → `policyRoutes` | ✅ | PostgreSQL backed |

**调用链**: ✅ 完整

#### 2. Audit Log (`/audit-log`)

| 步骤 | 文件 | 状态 | 备注 |
|------|------|------|------|
| 前端页面 | `AuditLog/index.tsx` | ✅ | 链式完整性验证 |
| 前端 API | `api/audit.ts` | ✅ | |
| 后端路由 | `routes.ts:421` → `auditRoutes` | ✅ | PostgreSQL backed |

**调用链**: ✅ 完整

#### 3. SBOM (`/sbom`)

| 步骤 | 文件 | 状态 | 备注 |
|------|------|------|------|
| 前端页面 | `SbomDashboard/index.tsx` | ✅ | 列表 + Waiver + Compliance |
| 前端 API | `api/sbom.ts` → `/v1/sbom/*` | ✅ | |
| 后端路由 | ❌ **`sbom-routes.ts` 不存在于 `api/` 目录** | ❌ | 仅 `.bak` 中有 |
| Controller | `api/controllers/SbomController.ts` 存在 | ✅ | 但无路由注册 |
| Service | `services/sbom/` 存在 | ✅ | SbomDocumentService, SbomWaiverService |

**调用链**: ❌ **Service/Controller 存在但路由未注册 = 404**

#### 4. Role Management (`/roles`)

| 步骤 | 文件 | 状态 | 备注 |
|------|------|------|------|
| 前端页面 | `RoleManagement/index.tsx` | ✅ | CRUD + 权限分配 |
| 前端 API | `api/roles.ts` | ✅ | |
| 后端路由 | `routes.ts:517` → `roleRoutes` | ✅ | PostgreSQL backed |
| 缺失 | ❌ **缺少 Update 功能** | ⚠️ | 前端只有 Create + Delete，无编辑按钮 |

**调用链**: ⚠️ 基本完整，但缺 Update

#### 5. Config Management (`/config-management`)

| 步骤 | 文件 | 状态 | 备注 |
|------|------|------|------|
| 前端页面 | `ConfigManagement/index.tsx` | ✅ | GitOps + Diff + Drift Detection |
| 前端 API | `api/config.ts` | ✅ | |
| 后端路由 | `routes.ts:398` → `configRoutes` | ✅ | PostgreSQL + Redis |

**调用链**: ✅ 完整

#### 6. Approval Management (`/approvals`)

| 步骤 | 文件 | 状态 | 备注 |
|------|------|------|------|
| 前端页面 | `Approvals/index.tsx` | ✅ | 多级审批 |
| 前端 API | `api/approvals.ts` | ✅ | |
| 后端路由 | `routes.ts:495` → `approvalRoutes` | ✅ | PostgreSQL backed |
| 缺失 | ⚠️ `currentUserId` 硬编码为 `'current-user'` (`Approvals/index.tsx:84`) | ⚠️ | Mock |

**调用链**: ⚠️ 基本完整，当前用户 ID 为硬编码

#### 7. FinOps Dashboard (`/finops`)

| 步骤 | 文件 | 状态 | 备注 |
|------|------|------|------|
| 前端页面 | `FinOpsDashboard/index.tsx` | ✅ | 完整 Dashboard + 图表 |
| 前端 API | `api/finops.ts` → `/v1/cost/*` | ✅ | |
| 后端路由 | ❌ **注释掉** (`routes.ts:400` "已迁移到 orion-finops-svc") | ❌ | |
| Controller | `api/controllers/finops/FinOpsController.ts` 存在 | ✅ | 但无路由 |
| Service | `services/finops/` 存在 | ✅ | |

**调用链**: ❌ **Service/Controller 存在但路由未注册 = 所有 API 调用 404**

---

## 四、代码级验证（Mock/硬编码/降级模式检测）

| 页面 | 问题 | 文件:行号 | 严重性 |
|------|------|-----------|--------|
| OnCall | `FALLBACK_USERS` 硬编码用户字典 | `OnCall/index.tsx:93-102` | 🟡 P1 |
| Approvals | `currentUserId` 硬编码 `'current-user'` | `Approvals/index.tsx:84` | 🟡 P1 |
| Backup | **全部操作 404**（后端无路由） | `api/backup.ts:32-53` | 🔴 P0 |
| OnCall | **全部操作 404**（后端无路由） | `api/oncall.ts:81-130` | 🔴 P0 |
| FinOps | **全部操作 404**（后端路由已迁移） | `api/finops.ts:78-140` | 🔴 P0 |
| SBOM | **全部操作 404**（后端无路由） | `api/sbom.ts` | 🔴 P0 |
| CMDB | **全部操作 404**（后端已迁移到 Go 服务） | `api/cmdb.ts` | 🔴 P0 |
| Role | 无 updateRole API/编辑按钮 | `RoleManagement/index.tsx:117-129` | 🟡 P1 |
| Config | `handleCreate` 使用 `any` 类型 | `ConfigManagement/index.tsx:193` | 🟡 P1 |
| Audit | 无搜索/分页/过滤功能 | `AuditLog/index.tsx:107-152` | 🟡 P1 |

---

## 五、4 维度评分

### 基础设施 (/infra)

| 维度 | 评分(1-10) | 依据 |
|------|-----------|------|
| 代码完整度 | 6/10 | 17 个页面中有 11 个实现完整，但 5 个页面后端路由缺失 |
| 持久化 | 7/10 | Environment/IaC/Queue/Session 使用 PostgreSQL，但 CMDB/Backup/OnCall 无持久化 |
| API 对接 | 5/10 | 6/11 个页面前后端完全对接；5/11 个页面前端完整但后端 404 |
| 交互完整 | 8/10 | 已实现的页面大多有 loading/feedback/empty/confirm |

### 治理 (/governance)

| 维度 | 评分(1-10) | 依据 |
|------|-----------|------|
| 代码完整度 | 7/10 | Policy/Audit/Config/Approval/Role 实现完整，但 SBOM/FinOps 后端未注册 |
| 持久化 | 8/10 | Policy/Audit/Config/Approval/Role 全部使用 PostgreSQL |
| API 对接 | 6/10 | 6/9 完全对接；SBOM/FinOps 前端有但后端 404；Config 使用 DashboardLayout 而非统一标题规范 |
| 交互完整 | 7/10 | 大部分页面交互完整，但 Role 缺编辑，Approval 缺删除 |

---

## 六、交互完整度

| 页面 | 异步函数数 | 缺 loading | 缺 feedback | 缺 empty | 缺 confirm |
|------|-----------|-----------|------------|---------|-----------|
| Environments | 5 | ❌ | ❌ | ❌ | ❌ (Delete 有 Popconfirm) |
| EphemeralEnvList | 5 | ❌ | ❌ | ⚠️ (无 Empty 组件) | ❌ (Teardown 有 Popconfirm) |
| BuildEnv | 3+ | ❌ | ❌ | ⚠️ | ❌ |
| IacManagement | 4+ | ❌ | ❌ | ❌ | ❌ |
| QueueTasks | 4 | ❌ | ❌ | ⚠️ | ❌ |
| CMDB-CITable | 5 | ❌ | ❌ | ❌ | ❌ |
| CMDB-Topology | 2 | ❌ | ❌ | ⚠️ | ❌ |
| CMDB-WebTerminal | 3 | ❌ | ❌ | ✅ | ❌ |
| Backup | 4 | ❌ | ❌ | ⚠️ | ❌ (Delete 有 Popconfirm, Restore 有 Modal) |
| OnCall | 4 | ❌ | ❌ | ✅ (Empty) | ❌ (Delete 有 Popconfirm) |
| PolicyManagement | 5 | ❌ | ❌ | ⚠️ | ⚠️ (Delete 无 Popconfirm) |
| AuditLog | 3 | ❌ | ❌ | ❌ | ❌ |
| SBOM | 3 | ❌ | ❌ | ⚠️ | ❌ |
| RoleManagement | 2 | ❌ | ❌ | ❌ | ❌ (Delete 有 Popconfirm) |
| ConfigManagement | 6 | ❌ | ❌ | ✅ | ⚠️ |
| Approvals | 4 | ❌ | ❌ | ⚠️ | ⚠️ |
| FinOps | 6 | ❌ | ❌ | ⚠️ | ❌ |
| WorkflowDesigner | 3+ | ❌ | ❌ | ⚠️ | ❌ |

---

## 七、样式规范符合度

| 页面 | 颜色违规 | 圆角违规 | 间距违规 | 阴影违规 | 标题不规范 |
|------|---------|---------|---------|---------|-----------|
| Environments | ❌ 无 | ✅ 合规 | ❌ `marginBottom: 24` 硬编码 (应用 `spacing.md`) | ✅ 合规 | ❌ 标题规范合规 |
| EphemeralEnvList | ❌ 无 | ✅ 合规 | ❌ 多处硬编码间距 | ✅ 合规 | ✅ 合规 |
| Backup | ❌ 无 | ✅ 合规 | ⚠️ 部分使用 `spacing[6]` | ✅ 合规 | ⚠️ 标题为英文 "Backup Management" (`Backup/index.tsx:474`) |
| OnCall | ❌ 无 | ✅ 合规 | ❌ 多处硬编码间距 | ✅ 合规 | ✅ 合规 |
| CMDB | ❌ 无 | ✅ 合规 | ❌ 无 padding | ✅ 合规 | ❌ 无 Title 组件（仅 Tabs） |
| PolicyManagement | ❌ 无 | ⚠️ Card 无 borderRadius | ❌ 多处硬编码 24/16 | ✅ 合规 | ✅ 合规 |
| AuditLog | ❌ 无 | ✅ 合规 | ❌ `padding: 24` 硬编码 | ✅ 合规 | ❌ 无 icon |
| RoleManagement | ❌ 无 | ✅ 合规 | ❌ 多处硬编码 | ✅ 合规 | ✅ 合规 |
| ConfigManagement | ❌ 无 | ✅ 合规 | ❌ `padding: 24` 硬编码 | ✅ 合规 | ❌ 无 icon |
| FinOps | ❌ 无 | ⚠️ Card borderRadius: 8 非 token | ❌ 多处硬编码 | ✅ 合规 | ✅ 合规 |

---

## 八、逻辑完整度（CRUD）

| 数据实体 | Create | Read | Update | Delete | 调用链状态 |
|----------|--------|------|--------|--------|-----------|
| Environment | ✅ | ✅ | ✅ | ✅ | ✅ 全链路 |
| EphemeralEnv | ✅ | ✅ | ⚠️ (仅 wake/teardown) | ✅ (teardown) | ✅ 全链路 |
| IaC Workspace | ✅ | ✅ | ✅ | ✅ | ✅ 全链路 |
| Queue Job | ✅ | ✅ | ✅ (complete/fail) | ❌ | ✅ 全链路 |
| Session | ✅ | ✅ | ✅ | ❌ | ✅ 全链路 |
| Policy | ✅ | ✅ | ✅ (toggle) | ✅ | ✅ 全链路 |
| Config | ✅ | ✅ | ⚠️ (仅提交审批) | ❌ | ✅ 全链路 |
| Approval | ✅ | ✅ | ✅ (approve/reject) | ❌ | ✅ 全链路 |
| Role | ✅ | ✅ | ❌ | ✅ | ⚠️ 缺 Update |
| Backup | ✅ (前端) | ✅ (前端) | ❌ | ✅ (前端) | ❌ 后端 404 |
| OnCall | ✅ (前端) | ✅ (前端) | ⚠️ (仅 override) | ✅ (前端) | ❌ 后端 404 |
| SBOM | ❌ | ✅ (前端) | ❌ | ❌ | ❌ 后端 404 |
| FinOps | ❌ (Dashboard) | ✅ (前端) | ❌ | ❌ | ❌ 后端 404 |
| CMDB CI | ✅ | ✅ | ✅ | ✅ | ⚠️ 路由已迁移到 Go |

---

## 九、微前端拆分评估

### 基础设施模块

| 评估项 | 评分(1-5) | 依据 |
|--------|----------|------|
| 代码规模 | 3/5 | 17 个页面，中等规模 |
| 团队独立性 | 2/5 | 当前无独立团队，与平台共享 |
| 技术栈差异 | 2/5 | 全部 React + Ant Design，无特殊技术栈 |
| 部署频率 | 2/5 | 变更频率低，非高频迭代模块 |
| 故障隔离 | 3/5 | CMDB WebTerminal 使用 xterm.js，故障可能影响其他模块 |
| 独立后端 | 2/5 | 仅 CMDB 有独立 Go 服务，其余均在 platform-service |
| **综合建议** | **暂不拆分** | 基础设施模块代码规模适中，技术栈统一，无独立部署需求。CMDB 已拆分，IaC 可考虑独立。建议优先补全 Backup/OnCall 后端实现 |

### 治理模块

| 评估项 | 评分(1-5) | 依据 |
|--------|----------|------|
| 代码规模 | 3/5 | 12 个页面，中等规模 |
| 团队独立性 | 2/5 | 当前无独立团队 |
| 技术栈差异 | 2/5 | 统一技术栈 |
| 部署频率 | 2/5 | 策略/审批变更频率低 |
| 故障隔离 | 3/5 | 审计日志需要高可用，应独立 |
| 独立后端 | 3/5 | FinOps 已独立为微服务 |
| **综合建议** | **暂不拆分** | 治理模块与平台核心耦合度高（策略引擎、审批流），不建议近期拆分。FinOps 独立是正确方向 |

---

## 十、场景逆向验证

### 场景 1: "创建备份任务并下载"

**页面**: `/backup` (BackupManagement)

1. 用户点击"创建备份"按钮 → ✅ 前端有 Modal 和 Form
2. 前端 API 调用 `createBackup({ name, type })` → ✅ `api/backup.ts:39-41`
3. 后端路由 `POST /api/v1/backup` → ❌ **`backup-routes.ts` 文件不存在**
4. 响应 → ❌ **404 Not Found**
5. 前端反馈 → ⚠️ 会显示 `message.error('创建备份失败')`

**结论**: ❌ **卡在第 3 步：后端无路由，所有操作返回 404**

---

### 场景 2: "创建值班排班"

**页面**: `/oncall` (OnCallManagement)

1. 用户点击"创建排班"按钮 → ✅ 前端有 Modal 和 Form
2. 前端 API 调用 `createSchedule(payload)` → ✅ `api/oncall.ts`
3. 后端路由 `POST /api/v1/oncall/schedules` → ❌ **`oncall-routes.ts` 文件不存在**
4. 响应 → ❌ **404 Not Found**
5. 前端反馈 → ⚠️ 会显示 `message.error('创建失败')`

**结论**: ❌ **卡在第 3 步：后端无路由**

---

### 场景 3: "查看 SBOM 列表"

**页面**: `/sbom` (SbomDashboard)

1. 页面加载 → ✅ 前端 `useEffect` 调用 `loadData()`
2. 前端 API 调用 `getSbomDocuments()` → ✅ `api/sbom.ts`
3. 后端路由 `GET /api/v1/sbom/documents` → ❌ **`sbom-routes.ts` 不存在**
4. 响应 → ❌ **404 Not Found**
5. 前端反馈 → ⚠️ `message.error('Failed to load SBOM data')`

**结论**: ❌ **卡在第 3 步：后端无路由，Controller/Service 存在但未注册**

---

### 场景 4: "查看成本分析"

**页面**: `/finops` (FinOpsDashboard)

1. 页面加载 → ✅ 前端 `useEffect` 调用 `loadData()`
2. 前端 API 调用 `getCostSummary()` → ✅ `api/finops.ts:78`
3. 后端路由 `GET /api/v1/cost/summary` → ❌ **`routes.ts:400` 注释"已迁移到 orion-finops-svc"**
4. 响应 → ❌ **404 Not Found**（除非 orion-finops-svc 独立部署且 Gateway 路由到）

**结论**: ❌ **卡在第 3 步：后端路由已迁移到独立服务**

---

### 场景 5: "查看 CMDB 配置项"

**页面**: `/cmdb` (CMDBPage)

1. 页面加载 → ✅ 前端 `useEffect` 调用 `loadData()`
2. 前端 API 调用 `getCIs()` → ✅ `api/cmdb.ts`
3. 后端路由 `GET /api/v1/cmdb/*` → ❌ **`routes.ts:386` 注释"已迁移到独立 Go 服务"**
4. 响应 → ❌ **404 Not Found**（除非 orion-cmdb-service 独立部署）

**结论**: ❌ **卡在第 3 步：后端已迁移到 Go 服务**

---

### 场景 6: "创建角色"

**页面**: `/roles` (RoleManagement)

1. 用户点击"创建角色" → ✅ 前端有 Modal
2. 前端 API 调用 `createRole(payload)` → ✅ `api/roles.ts`
3. 后端路由 `POST /api/v1/roles` → ✅ `routes.ts:517`
4. Controller → ✅ role-routes.ts 内联 handler
5. Service → ✅ RoleService with PostgreSQL
6. 持久化 → ✅ PostgreSQL
7. 前端反馈 → ✅ `message.success('角色创建成功')`

**结论**: ✅ **全链路畅通**

---

## 十一、缺失能力清单

### P0（阻断性问题）

| # | 缺失能力 | 影响页面 | 根因 | 建议操作 |
|---|---------|---------|------|---------|
| 1 | **Backup 后端路由缺失** | `/backup` | `backup-routes.ts` 文件不存在 | 创建 `backup-routes.ts` 并注册，或前端隐藏页面 |
| 2 | **OnCall 后端路由缺失** | `/oncall` | `oncall-routes.ts` 文件不存在 | 创建 `oncall-routes.ts` 并注册，或前端隐藏页面 |
| 3 | **SBOM 后端路由缺失** | `/sbom`, `/sbom/:id` | `sbom-routes.ts` 不存在，但 Controller/Service 已存在 | 创建 `sbom-routes.ts` 注册 SbomController |
| 4 | **FinOps 路由已迁移但前端未适配** | `/finops` | 后端路由注释掉，迁移到独立微服务 | 更新 Gateway 路由配置，或前端改为调用独立服务 |
| 5 | **CMDB 路由已迁移但前端未适配** | `/cmdb` 全部 | 后端路由注释掉，迁移到 Go 服务 | 更新 Gateway 路由配置，或前端隐藏页面 |

### P1（功能缺失）

| # | 缺失能力 | 影响页面 | 根因 | 建议操作 |
|---|---------|---------|------|---------|
| 1 | **Role 缺 Update 功能** | `/roles` | 无 `updateRole` API，无编辑按钮 | 添加编辑按钮 + updateRole API + 后端路由 |
| 2 | **Approval 缺删除功能** | `/approvals` | 无 `deleteApproval` API | 添加删除按钮 + API |
| 3 | **Approval currentUserId 硬编码** | `/approvals` | `currentUserId = 'current-user'` | 接入 auth 获取真实用户 ID |
| 4 | **Policy 删除无二次确认** | `/policies` | 删除按钮直接调用 `handleDeletePolicy` | 添加 `Modal.confirm` 或 `Popconfirm` |
| 5 | **Config 无删除功能** | `/config-management` | 只有 Create + Submit Approval，无 Delete | 添加删除按钮 + API |
| 6 | **Audit 无搜索/分页** | `/audit-log` | 固定 `limit: 50`，无搜索框 | 添加 SearchFilterBar + 分页 |
| 7 | **OnCall 无编辑排班功能** | `/oncall` | 只有 Create + Delete + Override | 添加编辑按钮 |
| 8 | **OnCall fallback 用户硬编码** | `/oncall` | `FALLBACK_USERS` 字典 | 确保 API 降级时不影响核心功能 |

### P2（优化建议）

| # | 缺失能力 | 影响页面 | 根因 | 建议操作 |
|---|---------|---------|------|---------|
| 1 | **Backup 标题为英文** | `/backup` | `Title` 内容为 "Backup Management" | 改为中文 "备份恢复" |
| 2 | **CMDB 页面无主标题** | `/cmdb` | 仅渲染 Tabs，无 Title 组件 | 添加统一标题组件 |
| 3 | **Config 标题无 icon** | `/config-management` | 标题无图标 | 添加 `CloudSyncOutlined` 图标 |
| 4 | **Audit 标题无 icon** | `/audit-log` | 标题无图标 | 添加 `SafetyCertificateOutlined` 图标 |
| 5 | **FinOps Card 圆角非 token** | `/finops` | `borderRadius: 8` 硬编码 | 改为 `componentRadius.card` |
| 6 | **多处间距硬编码** | 所有页面 | `marginBottom: 24` 等 | 改为 `spacing.md` / `spacing.lg` token |
| 7 | **Empty 状态缺失** | 多个列表页 | 无数据时直接空白 | 添加 Ant Design Empty 组件 |
| 8 | **Config 类型使用 any** | `ConfigManagement/index.tsx:193` | `handleCreate` 参数类型为 `any` | 改为明确类型定义 |
