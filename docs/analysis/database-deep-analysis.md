# Database 模块深度分析

**生成日期**: 2026-07-02  
**分析范围**: `orion-platform-service/src/services/database/`  
**模块标签**: MySQL, 主从复制, 故障切换, 读流量管理

---

## 一、现状概述

### 模块定位

Database 模块提供 MySQL 主从复制架构的延迟监控、读流量管理和自动故障切换能力。它不是一个 CRUD 数据服务，而是一个**数据库运维中间件**，监控从库健康状态并根据延迟级别自动调整流量分配。

### 文件结构

| 文件 | 行数 | 职责 |
|------|------|------|
| `services/database/ReplicationLagMonitor.ts` | 590 | 主从延迟检测（SHOW SLAVE STATUS），阈值告警，线性回归趋势分析 |
| `services/database/ReadTrafficManager.ts` | 576 | 读请求路由策略（轮询/加权/最少连接/随机），降级流量分配 |
| `services/database/DatabaseFailoverHandler.ts` | 734 | 故障切换状态机（Normal→Degraded→Recovering→FailedOver），降级/恢复事件记录 |
| `services/database/index.ts` | 34 | barrel 导出 |

### 核心数据模型

- **DegradationLevel**: LEVEL_0（正常）/ LEVEL_1（暂停分析查询）/ LEVEL_2（20% 从库流量）/ LEVEL_3（100% 切断）
- **ReplicaStatus**: host, port, ioRunning, sqlRunning, secondsBehindMaster, GTID 信息
- **TrafficDistribution**: primaryPercent, replicaPercent, degradationLevel
- **RoutingDecision**: targetNode, strategy, reason, skippedReplicas

### 持久化方式

✅ PostgreSQL Repository 模式（6 个 Repository）：
- `DbLagHistoryRepository`（延迟历史）
- `DbReplicaStatusRepository`（从库状态）
- `DbHealthCheckCountRepository`（健康检查计数）
- `DbRoutingTimeRepository`（路由时间）
- `DbDegradationEventRepository`（降级事件）
- `DbRecoveryEventRepository`（恢复事件）
- `DbFailoverAlertRepository`（告警事件）
- `DbFailoverAlertTimeRepository`（告警冷却时间）

---

## 二、功能矩阵

| 功能点 | 状态 | 说明 |
|--------|------|------|
| 主从延迟检测 | ✅ | 定期执行 `SHOW SLAVE STATUS`，解析复制状态 |
| 延迟级别分类 | ✅ | 基于阈值（10s/30s/60s）分为 Normal/Warning/Critical/Severe |
| 降级级别自动调整 | ✅ | 根据最大延迟自动切换 LEVEL_0~3 |
| 延迟趋势分析 | ✅ | 线性回归计算 slope + R²，预测 1 分钟后延迟 |
| 读流量路由策略 | ✅ | 5 种策略：轮询、加权、最少连接、随机、优先从库 |
| 降级流量分配 | ✅ | L1(30/70) → L2(80/20) → L3(100/0) |
| 自动恢复检测 | ✅ | 连续成功检查达阈值后自动恢复 |
| 告警通知 | ✅ | 支持冷却时间、自定义 onAlert 回调 |
| 故障切换状态机 | ✅ | Full state machine with NORMAL→DEGRADED→RECOVERING→FAILED_OVER |
| 健康检查计数 | ✅ | 持久化到 PostgreSQL，支持跨实例恢复 |
| 事件持久化 | ✅ | 降级事件、恢复事件、告警事件全部持久化 |
| getStats 统计 | ✅ | 综合统计：uptime, 降级/恢复次数, 平均恢复时间 |

---

## 三、API 端点

❌ **无独立路由文件**：`database-routes.ts` 不存在。

当前通过 `getCurrentState()`, `getDegradationHistory()`, `getRecoveryHistory()`, `getAlertHistory()`, `getStats()` 等公共方法暴露功能，但这些方法未注册到 Fastify 路由。

### 建议新增路由

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/database/status` | 当前延迟状态 |
| GET | `/database/stats` | 综合统计 |
| GET | `/database/degradations` | 降级历史 |
| GET | `/database/recoveries` | 恢复历史 |
| GET | `/database/alerts` | 告警历史 |
| PUT | `/database/config` | 更新配置 |
| POST | `/database/reset` | 重置状态 |

---

## 四、依赖关系

### 内部依赖

- `DatabaseFailoverHandler` → `ReplicationLagMonitor` + `ReadTrafficManager`
- `ReadTrafficManager` → `ReplicationLagMonitor`（仅 DegradationLevel 枚举）

### 外部依赖

- 8 个 Repository（`repositories/Db*Repository.ts`）
- `EventEmitter` 事件：level-change, alert, error, degradation, recovery, started, stopped, reset, config-updated
- 数据库查询方法：`executeQuery('SHOW SLAVE STATUS')`

### 测试覆盖

✅ 测试文件:
- `__tests__/ReplicationLagMonitor.test.ts`
- `__tests__/ReadTrafficManager.test.ts`
- `__tests__/DatabaseFailoverHandler.test.ts`

---

## 五、风险与改进建议

| 风险 | 级别 | 建议 |
|------|------|------|
| **无 HTTP 路由暴露**：所有功能只能通过代码调用，无法通过 API 访问 | **P1** | 创建 `database-routes.ts`，暴露状态查询和配置管理接口 |
| **无实际 MySQL 连接**：`executeQuery` 需外部提供，未集成连接池 | **P1** | 集成 mysql2 连接池或现有 DB 连接管理 |
| **线性回归趋势分析较简单**：只用简单线性回归，对周期性负载预测不准 | **P2** | 引入更复杂的时序预测（ARIMA 或 Prophet） |
| **故障切换自动执行缺实际动作**：状态机完整但未实现真实的主从切换 SQL | **P2** | 实现 `CHANGE MASTER TO` 或云 API 切换逻辑 |
| **L2 降级 20% 概率控制不精确**：`shouldUseReplica(0.2)` 用 `Math.random()` 实现概率分流 | **P2** | 改用一致性哈希或定量的权重分配 |
| **多租户隔离**：所有 Repository 支持 tenantId，但路由选择逻辑未隔离租户流量 | **P3** | 按租户维护独立的节点状态 |
| **从库状态全量删除再插入**：`performCheck` 中 `replicaStatusRepo.deleteAll()` 每次清空 | **P3** | 改为 upsert 方式，避免并发问题 |

---

## 六、总结

Database 模块是 Orion 中**代码质量最高的模块之一**：状态机设计完整、事件驱动架构清晰、持久化完备（8 个 Repository）、趋势分析用线性回归、测试覆盖全面。

**最大问题是没有暴露 HTTP API**——所有能力只能通过 Service 实例直接调用。这意味着前端/外部系统无法获取数据库状态、降级历史或统计数据。这是一个架构完整但缺少最后一公里的模块，P1 修复创建 `database-routes.ts` 即可解锁全部能力。
