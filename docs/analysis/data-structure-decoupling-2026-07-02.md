# 数据结构与解耦分析

**生成日期**: 2026-07-02
**分析范围**: repositories/ + saga/ + engine/ + services/

---

## 一、Repository Pattern 覆盖率

| 指标 | 值 |
|------|-----|
| Repository 文件数 | 297 |
| 使用 Repository 的服务 | 30+/137 (22%) |
| 继承 BaseRepository 的服务 | ~15 |
| 直接使用 db.query() 的服务 | ~100 |

### 1.1 Repository 质量评估

| 评级 | 服务 | 说明 |
|------|------|------|
| ✅ 完整 | ApprovalRepository, EventBusRepository | 有 tenant_id 过滤 + 完整 CRUD |
| ⚠️ 部分 | ArtifactRepository | 缺少 tenant_id 字段和隔离逻辑 |
| ❌ 缺失 | 多数 Repository | 无 tenant_id 自动过滤 |

---

## 二、内存 Map 残留（最高风险）

### 2.1 关键内存 Map 统计

| 组件 | Map 数量 | 重启丢失影响 |
|------|---------|-------------|
| PipelineSaga | 3 (pipelineRuns, stagesByRun, tasksByStage) | 🔴 高 - Pipeline 运行中断 |
| DeploySaga | 1 (deployments) | 🔴 高 - 部署中断 |
| SagaCoordinator | 1 (runningTransactions) | 🟡 中 - 超时事务丢失 |
| EventBusService | 1 (fallbackSubscribers) | 🟢 低 - 降级订阅 |
| NotificationService | 1 (notificationSettings) | 🟡 中 - 用户设置丢失 |
| ChatOps | 1 (commandHistory) | 🟢 低 - 命令历史丢失 |
| Cache | 1 (cacheEntries) | 🟡 中 - 缓存丢失 |
| **总计** | **~10+** | |

**317 处 `new Map()`** 分布在 186 个服务文件中

### 2.2 Saga 持久化问题

**PipelineSaga** (`src/saga/PipelineSaga.ts`):
- `pipelineRuns = new Map()` - 进程重启完全丢失
- `stagesByRun = new Map()` - 同上
- `tasksByStage = new Map()` - 同上
- `compensate()` 只做 Map.delete()，**未回写数据库**

**DeploySaga** (`src/saga/DeploySaga.ts`):
- `deployments = new Map()` - 同上
- `cleanup()` 仅删除 Map 条目，**无数据库回写**

**SagaCoordinator** (`src/saga/SagaCoordinator.ts`):
- `runningTransactions = new Map()` - 超时定时器丢失
- 无超时事务恢复机制

---

## 三、循环依赖风险

### 3.1 直接 import 依赖链

| 循环链路 | 代码路径 | 严重度 |
|---------|---------|--------|
| ConfigChangeService ↔ ConfigService | `services/config-mgmt/ConfigChangeService.ts:15-16` | 🟡 中 |
| PipelineService ↔ ApprovalService | `services/pipeline/PipelineService.ts` ↔ `services/approval/ApprovalService.ts` | 🟡 中 |
| Engine → Services → Engine | `PipelineEngine.ts` 导入 18 个 services | 🔴 高 |

### 3.2 Engine 耦合度

**PipelineEngine.ts** 直接导入：
```
PipelineEngine → 18 个 services (Artifact, Deploy, Notification, SCM, Approval, Quality, Cache, Secrets, Skill, EventBus...)
```

**Saga → Services → Engine 三角依赖**：
```
SagaCoordinator → PipelineService → PipelineEngine → SagaCoordinator
```

---

## 四、服务降级策略

### 4.1 Redis 不可用降级

| 组件 | 降级方式 | 风险等级 |
|------|---------|---------|
| IdempotencyChecker | InMemoryStorage | 🟡 中 - 重启数据丢失 |
| RedisCache | 直接抛异常 ORION_ERROR | 🔴 高 - 功能不可用 |
| CircuitBreaker | 内存状态 Map | 🟡 中 - 分布式一致性丧失 |
| Session 存储 | 进程内存储 | 🔴 高 - 水平扩展失效 |

### 4.2 NATS 不可用降级

**EventBusService 实现最佳**：
- publish: 写入内存 subscribers 投递
- subscribe: 注册到 `fallbackSubscribers` Map
- event 持久化: 写入 PostgreSQL `event_bus_events` 表
- 自动重试: `retryPendingEvents()` 在 NATS 恢复后重发

**但 Saga 和 Engine 未利用此降级**，事件发布失败时仅记录日志。

### 4.3 PostgreSQL 不可用降级

**无降级策略** - 这是最关键的基础设施缺失。
- Repository 模式直接依赖 `db.query()`
- Saga 的 `TransactionLog` 默认实现始终是内存存储

---

## 五、多租户隔离

### 5.1 实现机制

| 组件 | 实现 | 状态 |
|------|------|------|
| TenantContextStorage | AsyncLocalStorage | ✅ 请求级传播 |
| SYSTEM_TENANT_ID | `__system__` 绕过 RLS | ✅ |
| getCurrentTenantId() | 多处调用 | ✅ |

### 5.2 不一致性

| 层级 | 问题 |
|------|------|
| Saga 层 | 完全缺失租户隔离（tenantId 字段未被使用） |
| Repository 层 | ApprovalRepository 有 tenant_id 过滤，ArtifactRepository 无 |
| 路由层 | BaseController.getTenantId() 回退到 'default' |

---

## 六、TransactionLog 设计

| 接口 | 默认实现 | PostgreSQL 实现 |
|------|---------|----------------|
| TransactionLogStorage | InMemoryTransactionLogStorage | ❌ 未连接 |
| getRecoverableTransactions() | 存在但从未被调用 | ❌ |
| recoverInFlightTransactions() | 未实现 | ❌ |

---

## 七、解耦评分

| 维度 | 评分 (1-10) | 说明 |
|------|------------|------|
| Repository 覆盖率 | 7 | 297 文件但质量参差不齐 |
| Saga 持久化 | 2 | 核心状态全在内存 Map |
| 事件降级 | 9 | EventBusService 实现最完善 |
| 多租户隔离 | 5 | 部分 Repository 有 tenant_id，Saga 层缺失 |
| 服务解耦 | 4 | Engine 导入 18+ services，三角依赖 |
| Redis 降级 | 6 | IdempotencyChecker 有内存替代 |
| PG 降级 | 1 | 无任何降级策略 |
| **综合评分** | **4.6/10** | **解耦程度偏低** |

---

## 八、改进建议

### P0 立即修复
1. **PipelineSaga/DeploySaga 状态持久化** - 内存 Map → PostgreSQL
2. **Saga 补偿逻辑回写数据库** - compensate() 不仅做 Map.delete()
3. **PostgreSQL 不可用降级策略** - 至少记录 pending 事务到文件

### P1 短期修复
4. **统一 Repository tenant_id 过滤** - 所有 Repository 继承 BaseRepository 的 tenant 逻辑
5. **减少 Engine → Services 直接 import** - 改为事件驱动或接口抽象
6. **TransactionLog 连接 PostgreSQL** - 替换 InMemoryTransactionLogStorage

### P2 中期修复
7. **RedisCache 降级策略** - 改为 graceful degradation 而非直接抛异常
8. **SagaCoordinator 超时事务恢复** - 实现 recoverInFlightTransactions()
9. **循环依赖检测** - CI 中新增循环 import 检查
