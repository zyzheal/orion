# Phase 0 Task 1: RLS 租户隔离修复 设计文档

> 设计日期：2026-05-09 | 实施优先级：P0 | 所属：Phase 0 预迁移基础设施

---

## 1. 问题描述

当前 RLS 租户隔离存在 **Critical 级别数据泄漏风险**：

- `RLSPolicyManager.setTenantSessionVariable()` 使用 `pool.query()` 设置 session 变量，该调用从连接池中随机获取连接 A
- 后续业务查询也通过 `pool.query()` 执行，可能获取连接 B
- 连接 B 上没有 `app.current_tenant_id`，RLS 策略失效 → **跨租户数据泄漏**

### 根因分析

| 层面 | 问题 |
|------|------|
| 连接池 | `pool.query()` 每次从池中随机获取连接，session 变量不保证在同一连接上 |
| TenantContext | 模块级全局单例，并发请求互相覆盖 tenantId |
| RLS 策略 | 63 张表只有 `USING`（读隔离），无 `WITH CHECK`（写隔离） |
| 非请求上下文 | Cron/EventBus/Saga 等后台任务无租户上下文，被 RLS 阻断 |
| 启动期 | 服务实例化和 recoverRuns() 无租户上下文 |

---

## 2. 设计方案

### 2.1 核心模式：AsyncLocalStorage + request.dbClient 混合方案

```
HTTP 请求生命周期：
  onRequest    → acquire client + set_config + mount on request
  业务查询      → DatabasePool.query() 优先使用 request.dbClient
  onResponse   → ROLLBACK (if needed) + RESET + release client

后台任务：
  Cron/EventBus/Saga → set app.current_tenant_id = '__system__' → 绕过 RLS

启动期：
  服务实例化/recoverRuns → bypassRLS 专用连接 → 绕过 RLS

测试环境：
  测试 role → bypass RLS
```

### 2.2 文件修改范围

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/db/tenant-context-storage.ts` | **新增** | AsyncLocalStorage 定义 |
| `src/services/database.ts` | **修改** | `query()` 和 `transaction()` 优先使用 ALS/client |
| `src/api/routes.ts` | **修改** | 替换 preHandler/onResponse 钩子为 request-scoped 模式 |
| `src/services/tenant/RLSPolicyManager.ts` | **修改** | 增加 system tenant 和 bypass 支持 |
| `src/db/tenant-aware-repository.ts` | **修改** | `getCurrentTenantId()` 从 ALS 获取 |
| `src/db/migrations/145_fix_rls_policies.sql` | **新增** | FOR ALL 策略迁移 + 新增表 RLS |
| `src/repositories/BudgetRepository.ts` | **修改** | `withClient` 方法补充租户条件 |
| `src/repositories/PluginExecutionRepository.ts` | **修改** | `updateResult` 补充租户条件 |

### 2.3 关键设计决策

#### 决策 1：保持 SET SESSION (false)，不改为 SET LOCAL

**原因**：`SET LOCAL` 只在显式事务内有效，当前 Repository 全部使用非事务模式 `pool.query()`。改为 SET LOCAL 会破坏所有现有查询。

#### 决策 2：使用 request.dbClient 传递连接，非纯 ALS.run()

**原因**：Fastify 的 hook 链已是 async/await 序列，用 ALS.run() 包裹整个请求链会导致代码结构复杂。改为：
- `onRequest` 获取 client 并挂载到 `request.dbClient`
- `DatabasePool.query()` 检查 `tenantContextStorage.getStore()` 或 `request.dbClient`
- 两者都支持：ALS 用于后台任务，request.dbClient 用于 HTTP 请求

#### 决策 3：System Tenant 模式

后台任务使用 `app.current_tenant_id = '__system__'`，RLS 策略增加：
```sql
USING (current_setting('app.current_tenant_id', true) = '__system__')
```
允许系统任务操作所有租户数据。

#### 决策 4：aborted 事务清理

`onResponse` 钩子中先执行 `ROLLBACK`（幂等，无活跃事务时无影响），再 `RESET`，确保连接安全释放。

---

## 3. 非请求上下文处理

### 3.1 后台任务 (Cron/EventBus/Saga)

```typescript
// 在所有后台任务执行函数入口处：
await dbPool.query(
  "SELECT set_config('app.current_tenant_id', $1, false)",
  ['__system__']
);
// 执行业务逻辑...
await dbPool.query("SELECT set_config('app.current_tenant_id', $2, false)", ['']);
```

### 3.2 启动期 (服务实例化 + recoverRuns)

```typescript
// 在 routes.ts 服务实例化前：
const bypassClient = await dbPool.getConnection();
await bypassClient.query("SET SESSION ROLE postgres"); // superuser bypass RLS
// 服务实例化...
// 实例化完成后恢复：
await bypassClient.query("RESET SESSION ROLE");
bypassClient.release();
```

### 3.3 测试环境

```sql
-- 测试数据库创建 test role
CREATE ROLE test_role LOGIN;
ALTER ROLE test_role BYPASSRLS;
```

测试使用 `test_role` 连接数据库，自动绕过 RLS。

---

## 4. 迁移策略

### 4.1 迁移文件：145_fix_rls_policies.sql

```sql
BEGIN;

-- Step 1: 为 63 张现有表替换为 FOR ALL 策略
-- （DROP 旧策略 + CREATE 新 FOR ALL 策略）

-- Step 2: 为 migrations 129-132 新增表添加 RLS
-- plugin_installations, execution_timelines, secrets 等

-- Step 3: 添加 system tenant 旁路策略到所有表
-- ALTER POLICY ... ADD USING (current_setting('app.current_tenant_id') = '__system__')

COMMIT;
```

### 4.2 执行顺序

```
1. 新增 tenant-context-storage.ts (无副作用)
2. 修改 database.ts (向后兼容，fallback 到原 pool.query)
3. 修改 routes.ts (启用 request-scoped 连接)
4. 修改 RLSPolicyManager (增加 system tenant)
5. 修改 TenantAwareRepository (从 ALS 获取 tenantId)
6. 修改 BudgetRepository / PluginExecutionRepository
7. 执行 migration 145 (FOR ALL 策略)
8. 测试验证
```

---

## 5. 验证标准

| 验证项 | 通过标准 |
|--------|---------|
| 连接池隔离测试 | 模拟 100 并发请求，每个请求只能看到自己的租户数据 |
| 后台任务测试 | Cron job 能正常查询/写入所有租户数据 |
| 启动期测试 | 服务启动成功，recoverRuns() 能恢复 RUNNING 状态流水线 |
| 事务失败清理测试 | 模拟 constraint violation，验证连接被正确 RESET |
| 单元测试 | 所有现有测试通过 |
| 集成测试 | 多租户隔离集成测试通过 |

---

## 6. 风险评估

| 风险 | 缓解措施 |
|------|---------|
| 连接池耗尽 (poolSize=10) | 调整为 50-100，设置 acquire timeout |
| 慢查询占用连接 | 设置 statement_timeout |
| 连接泄漏 (onResponse 不触发) | onError 钩子兜底，idleTimeoutMillis 自动回收 |
| RLS 策略迁移导致服务中断 | 在事务中执行，先验证单表再批量 |
