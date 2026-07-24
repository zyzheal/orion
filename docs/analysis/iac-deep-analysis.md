# IaC 模块深度分析

**生成日期**: 2026-07-02  
**分析范围**: `orion-platform-service/src/services/iac/` + `src/api/iac-routes.ts`  
**模块标签**: M20, IaC Workspace, Terraform, Plan/Apply

---

## 一、现状概述

### 模块定位

IaC (Infrastructure as Code) 模块提供 Terraform 工作空间管理、Plan/Apply 流程、状态版本管理和模块注册功能。属于 M20 基础设施即代码域，面向 DevOps 工程师。

### 文件结构

| 文件 | 行数 | 职责 |
|------|------|------|
| `services/iac/WorkspaceService.ts` | 417 | Workspace CRUD、锁机制、状态版本、资源导入、模块管理 |
| `services/iac/PlanService.ts` | 148 | Plan 生成、Apply 执行、资源变更模拟 |
| `api/controllers/IacController.ts` | 256 | HTTP 请求处理、参数验证、错误映射 |
| `api/iac-routes.ts` | 166 | 路由注册（15 个端点） |

### 核心数据模型

- **IaCWorkspace**: id, name, projectId, environment, statePath, variables, lockedBy, status, provider
- **IaCStateVersion**: id, workspaceId, version, commitSha, author, size, serialNumber, lineage
- **IaCModule**: id, name, version, source, dependencies
- **IaCPlan**: id, workspaceId, status, resourceChanges, costEstimate

### 持久化方式

✅ PostgreSQL Repository 模式（4 个 Repository）:
- `IaCWorkspaceRepository`
- `IaCStateVersionRepository`
- `IaCModuleRepository`
- `IaCPlanRepository`

所有服务构造函数接受可选的 `db` 参数，有 DB 时用 PostgreSQL，无 DB 时降级到 `Map()` 内存模式。

---

## 二、功能矩阵

| 功能点 | 状态 | 说明 |
|--------|------|------|
| Workspace 创建 | ✅ | 支持 name/projectId/environment/provider 字段，发布 `iac.workspace.created` 事件 |
| Workspace 列表 | ✅ | 支持按 projectId/environment/status/provider 过滤 |
| Workspace 详情 | ✅ | 按 ID 查询 |
| Workspace 更新 | ✅ | 支持部分更新（name/statePath/variables/status） |
| Workspace 删除 | ✅ | 发布 `iac.workspace.deleted` 事件 |
| Workspace 锁定/解锁 | ✅ | 防止并发修改，锁状态持久化 |
| Plan 生成 | ⚠️ | 模拟生成，返回固定 mock 资源变更（3 add / 1 change / 0 destroy） |
| Plan Apply | ⚠️ | 模拟执行，标记 applied=true，无实际 Terraform 调用 |
| 状态版本管理 | ✅ | 版本号递增、历史查询 |
| 状态版本 Diff | ⚠️ | **MVP 实现**：返回空 diff（`{added:[], modified:[], removed:[]}`） |
| 资源清单 | ⚠️ | 基于状态版本 + variables 合成，非真实 Terraform state 解析 |
| 资源导入 | ✅ | 通过 workspace.variables 存储 |
| 模块注册 | ✅ | 支持 name/version/source/dependencies |
| 模块列表/详情/删除 | ✅ | 完整 CRUD |
| 费用估算 | ⚠️ | 硬编码 mock 值（$127.50/month），无实际云厂商计价 |

---

## 三、API 端点

| 方法 | 路径 | 控制器方法 | 说明 |
|------|------|-----------|------|
| GET | `/workspaces` | `listWorkspaces` | 列表，支持查询参数过滤 |
| POST | `/workspaces` | `createWorkspace` | 创建，校验 name/projectId/environment |
| GET | `/workspaces/:id` | `getWorkspace` | 详情 |
| PUT | `/workspaces/:id` | `updateWorkspace` | 更新 |
| POST | `/workspaces/:id/plan` | `generatePlan` | 生成执行计划 |
| POST | `/workspaces/:id/apply` | `applyPlan` | 应用计划 |
| GET | `/workspaces/:id/state` | `getCurrentState` | 当前状态 |
| GET | `/workspaces/:id/resources` | `listResources` | 资源列表 |
| POST | `/workspaces/:id/import` | `importResource` | 导入资源 |
| GET | `/modules` | `listModules` | 模块列表 |
| POST | `/modules` | `createModule` | 创建模块 |
| GET | `/modules/:id` | 内联处理 | 模块详情 |
| DELETE | `/modules/:id` | 内联处理 | 删除模块 |
| GET | `/workspaces/:id/plans` | 内联处理 | 工作空间下的计划列表 |
| GET | `/workspaces/:workspaceId/plans/:planId` | 内联处理 | 计划详情 |
| GET | `/workspaces/:id/state/versions` | 内联处理 | 状态版本历史 |
| GET | `/workspaces/:id/state/diff` | 内联处理 | 状态版本差异（需 versionA/versionB 参数） |

### 路由注册

✅ `iac-routes.ts` 通过 `authenticateUser` + `requirePermission` 中间件实现 ACL，资源名为 `iac`，action 分 `read/write/execute/delete`。

---

## 四、依赖关系

### 内部依赖

- `WorkspaceService` → `IaCWorkspaceRepository`, `IaCStateVersionRepository`, `IaCModuleRepository`, `EventBusService`
- `PlanService` → `WorkspaceService`, `IaCPlanRepository`, `EventBusService`
- `IacController` → `WorkspaceService`, `PlanService`

### 外部依赖

- `EventBusService`（事件发布：workspace created/updated/deleted/locked/unlocked, plan created/applied, state versioned, resource imported, module created）
- 数据模型: `models/IacWorkspace.ts`
- 错误处理: `errors.ts`（`OrionError`, `ErrorCode`）
- Repository 层: 4 个独立 Repository

### 测试覆盖

✅ 测试文件:
- `__tests__/WorkspaceService.test.ts`
- `__tests__/PlanService.test.ts`
- `__tests__/index.test.ts`

---

## 五、风险与改进建议

| 风险 | 级别 | 建议 |
|------|------|------|
| **PlanService.create() 完全 mock**：硬编码 3 add / 1 change / 0 destroy，无实际 Terraform 调用 | **P1** | 集成 Terraform CLI/API 执行真实 `terraform plan`，解析 JSON 输出 |
| **状态版本 Diff 为空实现**：`getStateDiff()` 返回 `{added:[], modified:[], removed:[]}` | **P1** | 对比两个状态版本的 JSON 内容，输出实际差异 |
| **费用估算是静态值**：硬编码 $127.50/month，无云厂商定价 API 集成 | **P2** | 接入 AWS/Azure/GCP 成本计算 API，或集成 Infracost 等工具 |
| **资源清单基于变量合成**：`listResources()` 不解析真实 Terraform state | **P2** | 解析 Terraform state JSON 提取真实资源列表 |
| **Workspace 缺少 Git 集成**：无关联 Git 仓库/分支/提交的字段 | **P2** | 增加 `repository`, `branch`, `commitSha` 字段，支持 GitOps 工作流 |
| **Plan 状态管理不完整**：create 方法中创建后立即完成，无异步等待 | **P2** | 引入异步 Plan 生成流程：pending → running → completed/failed |
| **无 CI/CD 集成端点**：无法在 Pipeline 中调用 IaC 能力 | **P3** | 增加 Pipeline Task 集成接口 |

---

## 六、总结

IaC 模块基础骨架完整，Workspace CRUD、状态版本管理、模块注册功能完善，且已迁移到 PostgreSQL Repository 模式。

**核心短板在于 Plan/Apply 流程是纯 Mock 实现**：无真实 Terraform 驱动、费用估算固定、状态 Diff 为空。这是模块从"管理界面"到"实际可用"的关键差距。建议 P1 优先实现真实 Terraform CLI 集成。
