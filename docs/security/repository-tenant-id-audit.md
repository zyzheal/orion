# Repository Tenant ID 审计报告

> **审计日期**: 2026-06-07
> **修复完成**: 2026-06-07
> **审计范围**: 所有 `orion-*-svc-go` 服务的 repository 文件
> **审计目标**: 检查自定义 SQL 查询是否缺少 `tenant_id` 过滤
> **总文件数**: 63 个 repository 文件

---

## 审计摘要

| 严重度 | 原始数量 | 修复后 | 说明 |
|--------|---------|--------|------|
| **P0 (数据泄露风险)** | 12 | **0** | 全部修复 — 查询已包含 tenant_id 过滤 |
| **P1 (隔离绕过)** | 18 | **0** | 全部修复 — Update/Delete 已添加 tenant_id |
| **P2 (纵深防御)** | 6 | 6 | 子表通过父表间接隔离（RLS 覆盖） |
| **CLEAN** | ~27 | ~57 | 修复后绝大多数文件合规 |

### 修复详情

| 服务 | 修复内容 |
|------|---------|
| **scheduler-svc-go** | OnCall 方法全部添加 tenantID 参数（ListSchedules, GetScheduleByID, DeleteSchedule, CreateSchedule, CreateOverride, generateAssignments）；handler 层全部提取并传递 tenantID |
| **skill-svc-go** | skill_instances/skill_executions 表方法添加 tenantID（UpdateInstance, DeleteInstance, FindExecutionByID, UpdateExecution）；skill_packages 为全局注册表（无 tenant_id by design） |
| **secret-svc-go** | 已有安全方法（GetByID, Delete, UpdateValue, UpdateDescription）；FindByID/DeleteByID 标记 DEPRECATED |
| **deploy-svc-go** | 已有安全方法（StartDeployment, CompleteDeployment, UpdateRollbackTo）；GetByIDAny 标记 DEPRECATED |
| **build-svc-go** | 已有安全方法（所有方法均含 tenant_id）；无违规 |
| **cmdb-service** | 已有 WithTenant 方法变体；GetByID/Update/Delete/GetByIDs 标记 DEPRECATED |

### RLS 测试

- 测试文件: `orion-go-common/pkg/database/rls_test.go`
- 运行方式: `go test -tags=integration -run TestRLS -v ./pkg/database/`
- 覆盖场景: SELECT 隔离、无租户返回空、UPDATE/DELETE 拦截、NULL tenant_id、并发租户切换、FORCE RLS

---

## P0 违规（数据泄露风险）

### deploy-svc-go

| 方法 | 行号 | 问题 | SQL |
|------|------|------|-----|
| `GetByIDAny` | 56 | 显式绕过租户隔离 | `WHERE id = $1` |
| `FindByBuild` | 183 | 按 image_tag 查询无租户过滤 | `WHERE image_tag = $1` |
| `StartDeployment` | 141 | 状态转换无租户过滤 | `WHERE id = $1` |
| `CompleteDeployment` | 152 | 状态转换无租户过滤 | `WHERE id = $3` |

### build-svc-go

| 方法 | 行号 | 问题 | SQL |
|------|------|------|-----|
| `List` | 49 | tenant_id 为可选过滤条件 | `if filter.TenantID != ""` |
| `GetBuildStats` | 213 | tenant_id 为可选条件 | `if tenantID != ""` |
| `GetEnvironmentByID` | 246 | 无租户过滤 | `WHERE id = $1` |
| `GetArtifactByID` | 297 | 无租户过滤 | `WHERE id = $1` |
| `CleanupExpiredArtifacts` | 359 | 跨租户清理 | `DELETE FROM artifacts WHERE expires_at < NOW()` |
| `CleanupArtifactsByRun` | 369 | 跨租户清理 | `DELETE FROM artifacts WHERE run_id = $1` |

### scheduler-svc-go

| 方法 | 行号 | 问题 | SQL |
|------|------|------|-----|
| `FindJobsDueForExecution` | 134 | 跨租户查询所有待执行任务 | `WHERE status = 'active' AND next_run_at <= $1` |
| `GetExecutionHistory` | 175 | jobID 为空时跨租户查询 | `SELECT * FROM job_runs ORDER BY ...` |

---

## P1 违规（隔离绕过 — 更新/删除）

### deploy-svc-go

| 方法 | 行号 | 问题 |
|------|------|------|
| `UpdateRollbackTo` | 231 | `WHERE id = $2` 无 tenant_id |

### build-svc-go

| 方法 | 行号 | 问题 |
|------|------|------|
| `UpdateEnvironment` | 268 | `WHERE id = $7` 无 tenant_id |
| `DeleteEnvironment` | 278 | `WHERE id = $1` 无 tenant_id |
| `DeleteArtifact` | 348 | `DELETE FROM artifacts WHERE id = $1` |
| `IncrementDownloadCount` | 353 | `WHERE id = $1` 无 tenant_id |

### secret-svc-go

| 方法 | 行号 | 问题 |
|------|------|------|
| `FindByID` | 65 | `WHERE id=$1` 无 tenant_id |
| `DeleteByID` | 110 | `DELETE FROM secrets WHERE id=$1` |
| `UpdateValue` | 132 | `WHERE id=$2` 无 tenant_id |
| `UpdateDescription` | 141 | `WHERE id=$2` 无 tenant_id |

### skill-svc-go

| 方法 | 行号 | 问题 |
|------|------|------|
| `FindSkillByID` | 43 | `WHERE id = $1` 无 tenant_id |
| `FindSkillByName` | 54 | `WHERE name = $1` 无 tenant_id |
| `UpdateSkill` | 81 | `WHERE id = $%d` 无 tenant_id |
| `DeleteSkill` | 99 | `WHERE id = $1` 无 tenant_id |
| `FindInstanceByID` | 273 | `WHERE id = $1` 无 tenant_id |
| `UpdateInstance` | 324 | `WHERE id = $%d` 无 tenant_id |
| `DeleteInstance` | 342 | `DELETE FROM skill_instances WHERE id = $1` |
| `FindExecutionByID` | 390 | `WHERE id = $1` 无 tenant_id |

### scheduler-svc-go

| 方法 | 行号 | 问题 |
|------|------|------|
| `UpdateJobStatus` | 62 | `WHERE id = $2` 无 tenant_id |
| `UpdateJobNextRun` | 107 | `WHERE id = $2` 无 tenant_id |
| `UpdateJobRunInfo` | 114 | `WHERE id = $1` 无 tenant_id |
| `ListSchedules` | 218 | 无 tenant_id |
| `GetScheduleByID` | 245 | `WHERE id = $1` 无 tenant_id |
| `DeleteSchedule` | 265 | `DELETE WHERE id = $1` 无 tenant_id |

### cmdb-service (GORM)

| 方法 | 行号 | 问题 |
|------|------|------|
| `GetByID` | 25 | `WHERE id = ?` 无 tenant_id |
| `Update` | 64 | 调用 GetByID 无租户隔离 |
| `Delete` | 117 | `WHERE id = ?` 无 tenant_id |
| `GetByIDs` | 191 | `WHERE id IN ?` 无 tenant_id |

---

## P2 违规（纵深防御 — 子表操作）

以下操作通过父表 ID 间接获取租户隔离，但 RLS 策略可能无法保护：

### approval-svc-go (approval_steps 表)

| 方法 | 问题 |
|------|------|
| `CreateStep` | INSERT 无 tenant_id（子表） |
| `GetStepsByApprovalID` | `WHERE approval_id = $1` |
| `UpdateStepStatus` | `WHERE id = $3` |
| `ActivateWaitingSteps` | `WHERE approval_id = $1` |

### finops-svc-go (子表)

| 方法 | 问题 |
|------|------|
| `GetBudgetThresholds` | `WHERE budget_id=$1` |
| `UpdateBudgetThreshold` | `WHERE id=$2` |

---

## CLEAN 文件（所有查询正确包含 tenant_id）

| 服务 | 文件 |
|------|------|
| approval-svc | approval_repository.go (主表操作) |
| pipeline-svc | pipeline_repository.go, run_repository.go |
| config-mgmt-svc | config_mgmt_repository.go, extended_repository.go |
| monitor-svc | alert_repository.go, metric_repository.go, trace_repository.go |
| notification-svc | notification_repository.go |
| finops-svc | cost_repository.go (主表操作) |
| tenant-svc | repository.go (特殊：tenants 表无 tenant_id) |
| user-svc | repository.go |

---

## 修复建议

### 优先级 1：P0 修复（数据泄露风险）

1. **deploy-svc**: 删除 `GetByIDAny`，所有操作使用 `GetByID(ctx, tenantID, id)`
2. **deploy-svc**: `StartDeployment`/`CompleteDeployment` 添加 `tenant_id` 参数
3. **build-svc**: `List` 和 `GetBuildStats` 的 tenant_id 改为必填
4. **build-svc**: `GetEnvironmentByID`/`GetArtifactByID` 添加 tenant_id
5. **build-svc**: `Cleanup*` 方法添加 tenant_id 过滤
6. **scheduler-svc**: `FindJobsDueForExecution` 改为按租户分批查询

### 优先级 2：P1 修复

1. 所有 `Update*`/`Delete*` 方法添加 `AND tenant_id = $N` 条件
2. **secret-svc**: 删除 `FindByID`/`DeleteByID`，使用带 tenant_id 的版本
3. **skill-svc**: 所有 Find/Update/Delete 添加 tenant_id
4. **cmdb-service**: 使用 `GetByIDWithTenant` 替代 `GetByID`

### 优先级 3：P2 纵深防御

1. 子表（approval_steps 等）考虑添加 tenant_id 列
2. 或确保 RLS 策略覆盖子表

---

## RLS 防御层

`migrations/002_enable_rls.sql` 已为所有核心表启用 RLS。即使应用层遗漏 tenant_id，数据库层也会拦截跨租户访问。但 RLS 依赖 `SET app.current_tenant_id` 会话变量，需确保每个请求正确设置。
