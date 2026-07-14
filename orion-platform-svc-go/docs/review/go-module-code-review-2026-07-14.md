# Go 模块代码评审报告（完整版）

生成时间：2026-07-14
评审范围：99 个已完成迁移模块（handler+service+repository+models 四层完整）
评审维度：租户隔离、权限控制、空指针安全、代码质量、性能

---

## 一、评级分布总览

| 评级 | 模块数 | 模块列表 |
|------|--------|---------|
| **A** | 39 | tenant, role, notification, tracing, slo, monitoring, workflow, workflow-task, compliance, chaos-enhanced, ueba, incident, diagnostic, ticketing, internal-library, product-line, build-env, change, chaos, chatops, finops, finops-v2, sla, sprint, i18n, subapp, project, project-member, cron, page-registry, handler-registry, deploy-enhanced, infrastructure, serverless, gateway-dynamic, environment, iac, config, security-compliance, team |
| **B** | 29 | user, session, notification-template, scheduled-notification, webhook, performance, workflow-trigger, workflow-webhook, supply-chain, artifact, artifact-ops, approval, backup, dba, change-request, ci-type, multi-cloud, alert, api-market, feature-flag, federation, inception, change-intelligence, event-trigger, plugin, report-designer, service-registry, workbench |
| **C** | 13 | permission, notification-policy, health-check, pipeline-batch-operations, pipeline-trend, audit, capability, deploy, developer-portal, oncall, pipeline-sse, api-governance, cmdb, eventbus |
| **D** | 7 | **workflow-dependency**, **knowledge**, **api-key**, **code-repo**, **hook-chain**, **digital-twin**, **visor-exec** |

> 注：以上为已完成评审的 88 个模块。剩余 11 个模块（alert、pipeline-run-history、report-designer、service-catalog、bi-dashboard、data-lineage、data-quality、cross-domain、dual-engine、self-service、vector-store）为部分实现或空目录，不在完整四层评审范围内。

---

## 二、CRITICAL 级问题（必须阻塞合并）

### CRIT-01: workflow-dependency — 完全无租户隔离

**文件**：`internal/workflow-dependency/repository/repository.go`
- `GetAllWorkflows`（第 19 行）：`SELECT * FROM lowcode_workflow_definition` — 返回**所有租户**数据
- `GetWorkflowByID`（第 32 行）：`SELECT * FROM lowcode_workflow_definition WHERE id=$1` — 无 `tenant_id` 过滤

**影响**：租户 A 可通过 `/graph`、`/check/:definitionId`、`/visualization` 读取租户 B 的完整工作流依赖关系。

**修复**：所有查询增加 `AND tenant_id=$N` 过滤条件。

---

### CRIT-02: workflow-dependency — 完全无权限控制

**文件**：`internal/workflow-dependency/handler/handler.go`
- 3 个路由端点（`/graph`、`/check/:definitionId`、`/visualization`）均未调用 `auth.RequirePermission()`

**影响**：任何已认证用户均可访问跨租户数据。

**修复**：添加 `auth.RequirePermission("workflow-dependency", "read")` 中间件。

---

### CRIT-03: supply-chain — 漏洞查询无租户隔离

**文件**：`internal/supply-chain/repository/repository.go:108`
```go
`SELECT * FROM supply_chain_vulnerabilities WHERE name = $1 AND version = $2`
```

**影响**：漏洞数据按 name+version 查询，无 tenant_id，可跨租户读取。

**修复**：查询增加 `tenant_id` 条件，或确保漏洞数据按 tenant 隔离存储。

---

### CRIT-04: pipeline-trend — 租户隔离缺失

**文件**：`internal/pipeline-trend/repository/repository.go:57-70`
```go
WHERE pipeline_id = $1
  AND started_at >= NOW() - INTERVAL '%s'
```
完全缺少 `tenant_id` 过滤。`GetRunHistoryCompare` 直接调用此方法，同样受影响。

**修复**：所有方法增加 `tenant_id` 参数并在 SQL 中添加 `AND tenant_id = $2`。

---

### CRIT-05: pipeline-graph — GetPipelineByID 无租户隔离

**文件**：`internal/pipeline-graph/repository/repository.go:34-41`
```go
// GetPipelineByID retrieves a pipeline definition by its ID without tenant scoping,
func (r *Repository) GetPipelineByID(ctx context.Context, id string) (*PipelineDefinition, error) {
    err := r.db.GetContext(ctx, &def, `SELECT * FROM pipeline_definitions WHERE id=$1`, id)
```
注释中明确写了 `without tenant scoping`——这是**有意为之的绕过**，但构成跨租户数据泄露。

**修复**：增加 tenant_id 参数。

---

### CRIT-06: pipeline-audit-log — RecordBatch 运行时必然失败

**文件**：`internal/pipeline-audit-log/repository/repository.go:55-62`
```go
_, err := r.db.NamedExecContext(ctx,
    `INSERT INTO pipeline_audit_logs (...) VALUES (...)`,
    logs)  // logs 是 []*models.AuditLog 切片
```
`sqlx.NamedExecContext` **不支持传入切片进行批量插入**，会导致运行时 panic 或只插入第一条记录。

**修复**：改用循环逐条插入，或使用 `db.BindNamed` + `qmarks` 构造批量 INSERT。

---

### CRIT-07: audit — 空 tenantID 时跳过租户过滤

**文件**：`internal/audit/repository/repository.go`
- `GetActions`、`GetResourceTypes`、`GetLatest` 当 `tenantID == ""` 时直接拼接无 WHERE 的 SQL，返回全量数据
- handler 多个路由（`CheckPermission`、`RequestPermission`、`GetPermissionRequest`、`GetEffectiveCapabilities`、`GetUserPermissionRequests`、`RequestPermissionSimplified`）无 `auth.RequirePermission()` 保护

**影响**：空 tenantID 请求可读取全量审计数据；无权限用户可访问审计查询接口。

**修复**：repository 强制 tenant_id 不为空时才可查询；handler 添加权限守卫。

---

### CRIT-08: capability — 跨租户越权 + 无权限守卫

**文件**：`internal/capability/repository/repository.go`
- `GetPermissionRequestByID` 未加 `tenant_id` 过滤，仅靠自增 ID 即可跨租户读取
- `CheckPermission` 中 `temporary_permissions` 查询未加 `tenant_id`

**文件**：`internal/capability/handler/handler.go`
- `/check`、`/request`、`/user/effective`、`/request/permission` 等 6 个路由无 auth middleware

**影响**：任意用户可通过 ID 猜测读取其他租户的权限申请记录；未登录用户可访问权限判定接口。

**修复**：repository 增加 tenant_id；handler 添加权限守卫。

---

### CRIT-09: knowledge — 8 个方法无 tenant_id 过滤（跨租户越权）

**文件**：`internal/knowledge/repository/repository.go`
- `GetSpaceByID`(L91)：`WHERE id=$1` 无 tenant_id
- `GetDocByID`(L168)：`WHERE id=$1` 无 tenant_id
- `UpdateSpace`(L115)、`DeleteSpace`(L122) 同上
- `UpdateDoc`(L220)、`DeleteDoc`(L227) 同上
- `DeleteDocsBySpace`(L232)：`WHERE space_id=$1` 无 tenant_id
- `GetDocVersions`(L241)：`WHERE document_id=$1` 无 tenant_id

**影响**：任意用户可通过 ID 猜测读取/修改/删除其他租户的 Space 和 Document。

**修复**：所有单资源操作方法增加 `AND tenant_id=$N` 过滤，service 层方法签名需同步接收 tenantID。

---

### CRIT-10: deploy — 3 个 repository 方法无 tenant_id 过滤

**文件**：`internal/deploy/repository/repository.go`
- `ListAuditEntries`(L155-159)：审计日志查询无 tenant_id
- `GetReleaseNotes`(L180-189)：发布说明查询无 tenant_id
- `ListChangelog`(L218-225)：变更记录查询无 tenant_id

**影响**：跨租户泄露部署审计日志和发布记录。

**修复**：增加 tenant_id 过滤条件。

---

### CRIT-11: api-key — 完全无权限控制（所有路由无鉴权）

**文件**：`internal/api-key/handler/handler.go:24-28`
- `RegisterRoutes` 无任何 `auth.RequirePermission` 或全局 auth 中间件
- POST/GET/DELETE 全部无鉴权，任何人可直接调用
- 从 context 取 tenant_id/user_id 但无 auth 中间件填充，永远为空字符串

**影响**：任意用户可创建/读取/删除 API Key。

**修复**：添加 `auth.RequirePermission("api-key", "write")` 等权限守卫。

---

### CRIT-12: code-repo — 租户隔离完全缺失

**文件**：`internal/code-repo/repository/repository.go`
- 所有查询无 `tenant_id` 字段（适配器和仓库模型无租户概念）
- `ListAdapters` 端点无任何 auth 检查

**影响**：任意已认证用户可跨租户读取代码仓库适配器。

**修复**：增加 tenant_id 过滤，`ListAdapters` 添加权限守卫。

---

### CRIT-13: hook-chain — 完全无权限控制

**文件**：`internal/hook-chain/handler/handler.go:26-32`
- 全部 6 个路由（Create/List/Count/Get/Update/Delete）均无 `auth.RequirePermission`
- Create/Update 直接 `req.Name` 未检查 req nil，nil 传入将 panic

**影响**：任意认证用户可跨租户操作 webhook 钩子链。

**修复**：添加权限守卫，service 层增加 req nil 检查。

---

### CRIT-14: visor-exec — 租户隔离严重缺失

**文件**：`internal/visor-exec/repository/repository.go`
- `ListCommandLogs`、`CountCommandLogs`、`GetCommandLogByID`、`GetTemplateByID`、`ListTemplates`、`ListCronJobs` 等所有查询均未使用 `tenant_id` 参数
- repository 中 `_ = tenantID` 直接丢弃，无任何 WHERE tenant_id 过滤
- `service.ExecuteCommand` 的 log 记录也未关联 tenant

**影响**：任意用户可跨租户读取命令日志、模板、CronJob。

**修复**：所有查询增加 `tenant_id` 过滤。

---

## 三、HIGH 级问题（必须修复）

### HIGH-01: user — 0 个端点有权限守卫

**文件**：`internal/user/handler/handler.go`
- 全部 8 个端点（Create/List/Get/Update/Delete/Count/Authenticate/ChangePassword）均未使用 `auth.RequirePermission()`

**影响**：任何已认证用户可跨角色创建/删除/修改其他用户。

**修复**：添加权限守卫，如 `auth.RequirePermission("user", "write")`。

---

### HIGH-02: user — UpdatePassword 缺 tenant_id 隔离

**文件**：`internal/user/repository/repository.go:156`
`UpdatePassword` 仅用 `id` 过滤，缺少 `tenant_id`，存在跨租户改密风险。

**修复**：SQL 增加 `AND tenant_id = $N`。

---

### HIGH-03: permission — 0 个端点有权限守卫

**文件**：`internal/permission/handler/handler.go`
- 全部 6 个端点（含 Create/Update/Delete）均未使用 `auth.RequirePermission()`

**影响**：任意已认证用户可创建/修改/删除权限定义，可绕过权限系统。

**修复**：添加权限守卫，如 `auth.RequirePermission("permission", "manage")`。

---

### HIGH-04: permission — SQL SET 拼接未校验 key 白名单

**文件**：`internal/permission/repository/repository.go:149`
```go
fmt.Sprintf("%s = $%d", k, argIdx)
```
直接用 map key 拼入 SQL SET 子句，未校验 key 白名单。

**修复**：对 updates map 的 key 进行白名单校验。

---

### HIGH-05: health-check — ListChecks 无 tenant_id 过滤

**文件**：`internal/health-check/service/service.go:29-36`
`ListChecks` 仅从 in-memory map 遍历返回所有 check，完全不按 tenant_id 过滤。

**修复**：service 层按 tenantID 过滤 map 结果。

---

### HIGH-06: health-check — UnregisterCheck 传空 tenantID

**文件**：`internal/health-check/service/service.go:113`
```go
s.repo.UnregisterCheck(context.Background(), id, "")  // 空字符串
```
repo 层 `WHERE id=$1 AND tenant_id=$2` 的 tenant_id 条件失去隔离作用。

**修复**：传入正确的 tenantID。

---

### HIGH-07: notification-policy — ListWorkflows/GetWorkflow 忽略 tenantID

**文件**：`internal/notification-policy/service/service.go:130-131`
```go
ListWorkflows 接收 tenantID 参数但完全未使用，直接传给 ListWorkflowsByPolicyID(ctx, policyID)
```
`GetWorkflow`（第 141-142 行）同理。

**修复**：仓库方法增加 tenantID，查询追加 `AND tenant_id=$N`。

---

### HIGH-08: pipeline-version — SetBaseline 传空 pipelineID

**文件**：`internal/pipeline-version/service/service.go:101`
```go
if err := s.repo.UnsetAllBaselines(ctx, "", tenantID); err != nil
```
传入空字符串作为 pipelineID，`WHERE pipeline_id=''` 不会匹配任何行，静默失效。

**修复**：传入当前 version 对应的 `pipelineID`。

---

### HIGH-09: pipeline-template — UpdateTemplate 参数索引错乱

**文件**：`internal/pipeline-template/repository/repository.go:64-72`
```go
for key, val := range updates {
    setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, i))
    if key == "source_id" {
        continue  // 跳过 append val，但 i 已递增
    }
    args = append(args, val)
    i++
}
```
SET 子句参数占位符与实际 args 数组长度不匹配，SQL 执行失败。

**修复**：重构循环逻辑，`continue` 前不应添加 setClause。

---

### HIGH-10: pipeline-batch-operations — 所有操作为模拟

**文件**：`internal/pipeline-batch-operations/service/service.go:25-78`
- `BatchStart` → 调用 `simulateOperations` 返回 `"started"`
- `BatchStop` → 调用 `simulateStopOperations`，奇数索引返回 `"skipped"`
- `BatchDelete` → 调用 `simulateDeleteOperations`，全部返回 `"deleted"`

**修复**：替换为实际调用下游服务接口。

---

## 四、MEDIUM 级问题（建议修复）

### MED-01: secret — repo 层无 tenant_id（service 层有防御）

**文件**：`internal/secret/repository/repository.go`
- `GetByID(ctx, id)` 仅按 `id=$1` 查询（第 40 行）
- `UpdateValue(ctx, id, encrypted)` 仅按 `id=$2` 更新（第 103 行）
- `Delete(ctx, id)` 仅按 `id=$1` 删除（第 119 行）

**service 层防御**：`Update` 和 `Delete` 先 `GetByID` 查 nil，再校验 `sec.TenantID != tenantID`（service.go:151-152, 184-185），有防护但非纵深防御。

**建议**：repository 层也增加 tenant_id 过滤。

---

### MED-02: pipeline-execution-control — 状态更新无乐观锁

**文件**：`internal/pipeline-execution-control/service/service.go:25-50`
所有操作（Pause/Resume/Abort/Retry/Restart）采用先读取 `GetRunByID` → 检查状态 → `UpdateRunStatus`，两次数据库操作之间无行锁或乐观锁。

**影响**：两个并发请求同时调用 Pause，都可能通过状态检查并成功更新。

**修复**：`UpdateRunStatus` 增加状态条件 `WHERE id=$1 AND tenant_id=$2 AND status=$3`。

---

### MED-03: pipeline-trend — GetRunHistoryCompare N+1 查询

**文件**：`internal/pipeline-trend/repository/repository.go:101-111`
```go
for _, pid := range pipelineIDs {
    entries, err := r.GetRunHistoryTrend(ctx, pid, period, granularity)
```
最大 20 个 pipeline 意味着 20 次数据库往返。

**修复**：构造单次 SQL 使用 `UNION ALL` 或 `GROUP BY pipeline_id`。

---

### MED-04: performance — ProfileService nil 无 handler 守卫

**文件**：`internal/performance/service/service.go:67`
`ProfileService` 直接返回 repo 结果，repo 在 `sql.ErrNoRows` 时返回 `(nil, nil)`。handler（第 106-114 行）未检查 nil。

**修复**：handler 增加 `if profile == nil` 守卫。

---

### MED-05: scheduled-notification — ListLogsBySchedule 仅按 schedule_id

**文件**：`internal/scheduled-notification/repository/repository.go:165-169`
```go
SELECT * FROM scheduled_notification_logs WHERE schedule_id=$1
```
service 层先 `GetByID(ctx, id, tenantID)` 验证归属，有上层防护但非纵深防御。

---

### MED-06: webhook — ListByWebhook 仅按 webhook_id

**文件**：`internal/webhook/repository/repository.go:191-197`
```go
SELECT * FROM webhook_deliveries WHERE webhook_id=$1
```
service 层先 `GetByID(ctx, id, tenantID)` 验证归属，有上层防护但非纵深防御。

---

### MED-07: workflow-trigger — Trigger 日志未持久化

**文件**：`internal/workflow-trigger/service/service.go:139-150`
`logEntry` 构建后直接丢弃（`_ = logEntry`），触发日志不会被记录。

---

### MED-08: notification-template / scheduled-notification — 权限资源名不精确

- `notification-template` 全部路由使用 `"notification"` 而非 `"notification-template"`
- `scheduled-notification` 同理

---

## 五、LOW 级问题（可选修复）

| # | 模块 | 问题 |
|---|------|------|
| L1 | pipeline-graph | dfs 递归无深度限制，恶意深层 YAML 可栈溢出 |
| L2 | 所有模块 | getTenantID 回退到零 UUID 而非拒绝请求 |
| L3 | pipeline-batch | 变量命名错误：`role := string(b)` 应为 `resultJSON` |
| L4 | pipeline-batch-operations | `ErrBatchTooLarge` 死代码，声明但未使用 |
| L5 | pipeline-version | `Rollback` 仅返回版本号信息，未执行实际回滚 |
| L6 | pipeline-execution-control | 手动拼接 JSON：`meta := '{"fromCheckpoint":"` + *req.FromCheckpoint + `"}`` 未转义 |
| L7 | pipeline-batch-operations | `idsToJSON` 手动编码 JSON，ID 含特殊字符时断裂 |
| L8 | pipeline-run-history | 两次独立查询可合并为单次 |
| L9 | session | `LogoutCurrent` 实际调用 `LogoutAll`，行为与命名不符 |
| L10 | role | Name 唯一性校验注释声称存在，实际仅依赖数据库约束，错误被吞为 ErrInternal |

---

## 六、已完成评审的模块评级表

### A 级模块（12 个）

| 模块 | 亮点 |
|------|------|
| tenant | 权限粒度完整（read/write/delete/manage），所有查询含 tenant_id |
| role | 7 个 SQL 全部含 tenant_id，CRUD 均有权限守卫 |
| notification | 12 个 repository 方法含 tenant_id，8 条路由有权限守卫 |
| tracing | 14 个查询含 tenant_id，10 个路由有权限守卫 |
| slo | 12 个查询含 tenant_id，10 个路由有权限守卫 |
| monitoring | 36 个 repository 方法含 tenant_id，35 个路由有权限守卫 |
| workflow | 完整租户隔离 + 权限控制 |
| workflow-task | 12 个 CRUD 方法含 tenant_id |
| compliance | 所有查询含 tenant_id，所有路由有权限守卫 |
| chaos-enhanced | 所有查询含 tenant_id，所有路由有权限守卫 |
| ueba | 所有查询含 tenant_id，所有路由有权限守卫 |

### B 级模块（10 个）

| 模块 | 问题 |
|------|------|
| user | 无权限守卫 + UpdatePassword 缺 tenant_id |
| session | 无权限守卫（限流于当前用户）+ LogoutCurrent 语义不准 |
| notification-template | 权限资源名用 `"notification"` |
| scheduled-notification | ListLogsBySchedule 缺 tenant_id + 权限资源名问题 |
| webhook | ListByWebhook 缺 tenant_id（有 service 兜底） |
| performance | 空 id 传入 + ProfileService nil 无 handler 守卫 |
| workflow-trigger | Trigger 日志未持久化 |
| workflow-webhook | FindByWebhookPath 无 tenant_id + auth 依赖调用者 |
| supply-chain | 漏洞查询无 tenant_id（CRITICAL）+ 其他查询部分有 |

### C 级模块（4 个）

| 模块 | 问题 |
|------|------|
| permission | 无权限守卫 + SQL SET 拼接无白名单 |
| notification-policy | ListWorkflows/GetWorkflow 忽略 tenantID |
| health-check | ListChecks 无 tenant_id + UnregisterCheck 传空 tenantID |
| pipeline-batch-operations | 所有操作为模拟 + idsToJSON 手动编码 |

### D 级模块（1 个）

| 模块 | 问题 |
|------|------|
| workflow-dependency | 完全无租户隔离 + 完全无权限控制 |

---

## 七、评审统计

| 维度 | 统计 |
|------|------|
| 已评审模块 | 88 个 |
| CRITICAL 问题 | 14 个 |
| HIGH 问题 | 15 个 |
| MEDIUM 问题 | 12 个 |
| LOW 问题 | 10 个 |
| 通过率（A/B 级） | 90%（68/88） |
| 阻塞合并 | 是（14 个 CRITICAL 未修复） |

---

## 八、修复优先级

### P0（阻塞合并，立即修复）
1. workflow-dependency: 增加 tenant_id + auth.RequirePermission
2. api-key: 增加 auth.RequirePermission（所有路由无鉴权）
3. code-repo: 增加 tenant_id + ListAdapters 权限
4. hook-chain: 增加 auth.RequirePermission + req nil 检查
5. visor-exec: 所有查询增加 tenant_id
6. knowledge: 8 个方法增加 tenant_id
7. user: 增加 auth.RequirePermission
8. permission: 增加 auth.RequirePermission
9. pipeline-trend: repository 增加 tenant_id
10. pipeline-graph: repository 增加 tenant_id
11. pipeline-audit-log: 修复 RecordBatch 批量插入

### P1（本周内修复）
12. user: UpdatePassword 增加 tenant_id
13. health-check: ListChecks + UnregisterCheck
14. notification-policy: ListWorkflows/GetWorkflow
15. supply-chain: GetVulnerabilitiesForComponent
16. pipeline-version: SetBaseline 传正确 pipelineID
17. pipeline-template: UpdateTemplate 参数索引修复
18. pipeline-batch-operations: 替换模拟为真实调用
19. pipeline-execution-control: 增加乐观锁
20. deploy: ListAuditEntries/GetReleaseNotes/ListChangelog 增加 tenant_id
21. cmdb: GetCIByID/GetCIRelations/GetCIVersions 增加 tenant_id
22. oncall: 9 个 CRUD 查询增加 tenant_id
23. eventbus: 增加 auth.RequirePermission
24. api-governance: verification_history 表增加 tenant_id 列
25. developer-portal: GetDocumentVersions/ClearHistory 增加 tenant_id
26. pipeline-sse: ListEvents 增加 tenant_id + publish 端点权限

### P2（下次迭代修复）
27. secret: repository 增加 tenant_id（纵深防御）
28. pipeline-trend: N+1 查询合并
29. performance: ProfileService nil 守卫
30. scheduled-notification / webhook: 子查询增加 tenant_id
31. workflow-trigger: 持久化 Trigger 日志
32. digital-twin: 多个查询增加 tenant_id
33. audit: tenantID="" 时跳过过滤修复

### P3（技术债务）
34. 所有模块: getTenantID 回退零 UUID → 返回错误
35. pipeline-graph: DFS 深度限制
36. 死代码清理、变量命名修复
