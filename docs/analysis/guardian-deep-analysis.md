# Guardian 模块深度分析

**生成日期**: 2026-07-02  
**分析范围**: `orion-platform-service/src/services/guardian/`  
**模块标签**: 任务执行保镖, 心跳看门狗, 进程管理, 超时控制

---

## 一、现状概述

### 模块定位

Guardian（执行保镖）模块提供任务执行的**生命周期保护机制**：全局超时控制、步骤超时控制、心跳检测和强制进程终止。主要面向 Pipeline 任务执行场景，防止任务失控或资源泄露。

### 文件结构

| 文件 | 行数 | 职责 |
|------|------|------|
| `services/guardian/ExecutionGuardian.ts` | ~200 | 全局 Guardian 协调器，Timer 管理，任务注册/中止 |
| `services/guardian/HeartbeatWatchdog.ts` | ~150 | 心跳超时检测，DB 持久化 + 回调通知 |
| `services/guardian/ProcessKiller.ts` | ~100 | 进程终止（SIGTERM → 等待 → SIGKILL），进程组/容器支持 |
| `services/guardian/index.ts` | 4 | barrel 导出 |

### 核心数据模型

- **GuardianConfig**: globalTimeoutMs (30min), stepTimeoutMs (5min), heartbeatIntervalMs (5s), heartbeatTimeoutMs (15s)
- **TaskTimerState**: globalTimer, stepTimer, aborted（仅内存，Timer 不可序列化）
- **ProcessInfo**: taskId, pid, pgid, containerId
- **GuardianTaskEntity**: taskId, startTime, globalTimeoutMs, stepTimeoutMs, aborted, status

### 持久化方式

✅ PostgreSQL Repository 模式（3 个 Repository）：
- `GuardianTaskRepository`（任务注册）
- `HeartbeatWatchdogRepository`（心跳条目）
- `ProcessRegistryRepository`（进程注册）

**注意**：Timer (NodeJS.Timeout) 仅内存保存，重启后丢失，需重新注册。

---

## 二、功能矩阵

| 功能点 | 状态 | 说明 |
|--------|------|------|
| 任务注册 | ✅ | 设置 globalTimeout + stepTimeout，启动倒计时 |
| 全局超时 | ✅ | 超时触发 onGlobalTimeout，emit 'timeout' 事件 |
| 步骤超时 | ✅ | 超时触发 onStepTimeout，emit 'step-timeout' 事件 |
| 任务中止 | ✅ | 清除 Timer + 更新 DB 状态 |
| 心跳注册 | ✅ | 设置心跳间隔和超时时间 |
| 心跳检测 | ✅ | 定期检查心跳超时，5s 检测间隔 |
| DB 心跳恢复 | ✅ | 重启后从 DB 恢复活跃心跳条目 |
| 进程注册 | ✅ | 记录 taskId→pid 映射 |
| 进程中止 (SIGTERM) | ✅ | 向进程组发 SIGTERM，等待 5s |
| 进程强杀 (SIGKILL) | ✅ | SIGTERM 无效后发 SIGKILL |
| 容器终止 | ✅ | 支持 containerId 终止 |
| 优雅停止 | ✅ | stop() 中止所有任务，清理 Timer |

---

## 三、API 端点

❌ **无独立路由文件**：`guardian-routes.ts` 不存在。

所有功能只能通过代码调用来使用（`ExecutionGuardian.registerTask()`, `HeartbeatWatchdog.register()` 等）。

### 建议新增路由

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/guardian/tasks` | 活跃任务列表 |
| GET | `/guardian/tasks/:taskId` | 任务状态 |
| POST | `/guardian/tasks/:taskId/abort` | 中止任务 |
| GET | `/guardian/stats` | Guardian 统计 |

---

## 四、依赖关系

### 内部依赖

- `ExecutionGuardian` → `HeartbeatWatchdog` + `ProcessKiller` + `GuardianTaskRepository`
- `HeartbeatWatchdog` → `HeartbeatWatchdogRepository`
- `ProcessKiller` → `ProcessRegistryRepository`

### 外部依赖

- `EventEmitter`（Guardian 事件：timeout, step-timeout, aborted, error）
- `uuid`（ID 生成）
- `utils/logger.ts`

### 测试覆盖

✅ 4 个测试文件:
- `__tests__/ExecutionGuardian.test.ts`
- `__tests__/HeartbeatWatchdog.test.ts`
- `__tests__/ProcessKiller.test.ts`
- `__tests__/index.test.ts`

---

## 五、风险与改进建议

| 风险 | 级别 | 建议 |
|------|------|------|
| **无 HTTP 路由暴露**：无法通过 API 查询任务状态或管理 Guardian | **P1** | 创建 `guardian-routes.ts` |
| **Timer 状态仅内存**：进程重启后 Timer 丢失，旧任务不能被自动中止 | **P1** | 启动时从 DB 恢复任务，重新计算剩余超时 |
| **ExecutionGuardian 强依赖 DB**：构造函数 `if (!db) throw Error`，无内存降级 | **P2** | 允许无 DB 模式（仅内存 Timer） |
| **进程终止的跨平台兼容性**：`process.kill(-pid)` 在非 Unix 系统不可用 | **P2** | 增加 Windows 兼容处理 |
| **心跳回调查用丢失**：`loadFromDb()` 恢复条目但回调需重新注册 | **P2** | 文档化此限制，提供重新注册示例 |
| **无任务依赖图**：无法表达任务间的依赖关系 | **P3** | 增加 DAG 支持（参考 Airflow） |

---

## 六、总结

Guardian 模块是 Orion **后台基础设施的核心组件**，提供了任务执行的三重保护机制（超时 + 心跳 + 进程管理）。架构清晰（3 个独立组件协同工作），持久化完备（3 个 Repository）。

**主要不足**：无 HTTP API（P1）、Timer 重启丢失（P1）、强依赖 DB 无降级（P2）。对于当前 Pipeline 执行场景，代码调用方式可行；但要独立暴露为服务网关可调用的能力，需要创建路由文件。
