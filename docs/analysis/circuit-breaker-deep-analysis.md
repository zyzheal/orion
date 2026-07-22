# Circuit Breaker 深度分析报告

**生成日期**: 2026-07-02
**分析模块**: `orion-platform-service/src/services/circuit-breaker/`
**路由文件**: `circuit-breaker-routes.ts`
**迁移文件**: `051b_create_circuit_breaker_tables.sql`

---

## 一、现状概述

### 模块定位

Circuit Breaker 模块为 Orion 平台提供 **服务依赖熔断保护**，防止级联故障。基于已有的 `CircuitBreaker` 基础工具类，构建了完整的管理层：注册中心（Registry）、PostgreSQL 持久化、优雅降级（内存回退）。同时集成了 Pipeline 执行中的外部调用保护。

### 文件结构

| 子域 | 文件 | 当前状态 |
|------|------|----------|
| 服务层 | `circuit-breaker-service.ts` | ✅ 完整（PostgreSQL + 内存双重保障） |
| 仓储层 | `circuit-breaker-repositories.ts` | ✅ 完整（3 Repository，BaseRepository 继承） |
| Pipeline 集成 | `pipeline-circuit-breaker.ts` | ✅ 完整（预定义目标 Key 和配置） |
| 工厂入口 | `index.ts` | ✅ 完整（单例初始化和降） |

### 核心数据模型

**circuit_breaker_configs**（迁移 051b）：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | 主键 |
| target_key | VARCHAR(200) UNIQUE | 目标依赖标识（如 `scm:github`） |
| description | TEXT | 描述 |
| failure_threshold | INT DEFAULT 5 | 连续失败阈值 |
| recovery_timeout_ms | INT DEFAULT 60000 | OPEN → HALF_OPEN 等待时间 |
| success_threshold | INT DEFAULT 1 | HALF_OPEN 下连续成功阈值 |
| enabled | BOOLEAN DEFAULT true | 是否启用 |
| created_at / updated_at | TIMESTAMPTZ | 时间戳 |

**circuit_breaker_states**：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | 主键 |
| target_key | VARCHAR(200) UNIQUE | 目标标识 |
| state | VARCHAR(20) | closed / open / half-open |
| failure_count | INT | 失败计数 |
| success_count | INT | 成功计数 |
| last_failure_time | TIMESTAMPTZ | 上次失败时间 |
| last_success_time | TIMESTAMPTZ | 上次成功时间 |
| last_state_change | TIMESTAMPTZ | 上次状态变更时间 |

**circuit_breaker_events**：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | 主键 |
| target_key | VARCHAR(200) | 目标标识 |
| event_type | VARCHAR(50) | state_change / failure / success / manual_trip / manual_reset / config_change |
| from_state / to_state | VARCHAR(20) | 状态变化 |
| failure_count / success_count | INT | 计数 |
| message | TEXT | 事件描述 |

---

## 二、功能矩阵

### 熔断器管理

| 功能点 | 状态 | 说明 |
|--------|------|------|
| 熔断器注册 | ✅ | PostgreSQL 持久化配置 + 内存实例创建 |
| 熔断器获取/自动创建 | ✅ | getOrCreate 模式，优先从 DB 加载，无则用默认值 |
| 配置更新 | ✅ | 更新内存实例 + 持久化到 DB |
| 手动重置 (→CLOSED) | ✅ | 调用 breaker.close() + DB 状态重置 |
| 手动跳闸 (→OPEN) | ✅ | 调用 breaker.open() + DB 状态更新 |
| 启用/禁用 | ✅ | 软删除模式，保留 DB 配置 |

### 执行保护

| 功能点 | 状态 | 说明 |
|--------|------|------|
| 函数执行保护 | ✅ | execute 方法包装，自动统计成功/失败 |
| DB 状态同步 | ✅ | 每次执行后 upsert state 到 PostgreSQL |
| 状态变更事件记录 | ✅ | 状态变更时自动写入 circuit_breaker_events |
| 优雅降级 | ✅ | DB 不可用时安全回退到内存模式 |

### Pipeline 集成

| 功能点 | 状态 | 说明 |
|--------|------|------|
| SCM 保护 | ✅ | GitHub/GitLab/Bitbucket 预定义 |
| Docker Registry 保护 | ✅ | Docker/Harbor 预定义 |
| 通知服务保护 | ✅ | Slack/DingTalk/WeCom 预定义 |
| K8s API 保护 | ✅ | k8s:api 预定义 |
| 制品存储保护 | ✅ | artifact:storage 预定义 |
| 分类执行 | ✅ | 按 category/provider 模式调用 |
| 全局状态查询 | ✅ | 只返回 pipeline 相关的熔断器 |

### 查询能力

| 功能点 | 状态 | 说明 |
|--------|------|------|
| 列表查询 | ✅ | 融合 DB + 内存数据 |
| 详情查询 | ✅ | 三级回退：内存 → memory state → DB |
| 汇总统计 | ✅ | total / closed / open / half-open 计数 |
| 事件历史 | ✅ | 按 targetKey 查询最近事件 |
| 获取全部状态 | ✅ | DB 全量状态导出 |

---

## 三、API 端点

所有端点注册在 `/v1/circuit-breakers` 前缀（routes.ts 第 1330 行）。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 列出所有熔断器 |
| GET | `/summary` | 汇总统计 |
| GET | `/:targetKey` | 获取熔断器详情 + 最近 20 条事件 |
| POST | `/` | 注册新熔断器 |
| PUT | `/:targetKey/config` | 更新配置 |
| POST | `/:targetKey/reset` | 重置为 CLOSED |
| POST | `/:targetKey/trip` | 手动跳闸为 OPEN |
| GET | `/:targetKey/events` | 获取事件历史 |

### 路由认证

所有端点配置了 `authenticateUser` 和 `requirePermission({ resource: 'circuit-breaker', action: 'read' | 'write' })`。

### 特殊处理

- 服务未初始化时返回 `ServiceUnavailableError`
- 查询不存在的 targetKey 返回 `NotFoundError`
- 注册缺少 targetKey 返回 `ValidationError`

---

## 四、依赖关系

| 依赖类型 | 依赖模块 | 说明 |
|----------|----------|------|
| 内部依赖 | `../../utils/rate-limit-circuit-breaker` | CircuitBreaker 基础类 + CircuitBreakerConfig 类型 |
| 内部依赖 | `../../errors` | OrionError / 各类错误 |
| 内部依赖 | `../../db/base-repository` | BaseRepository 基类 |
| 内部依赖 | `../../utils/logger` | 日志工具 |
| 运行时依赖 | PostgreSQL | circuit_breaker_configs/states/events 三张表 |

### 设计亮点：三层降级策略

```
DB 可用 → 使用 PostgreSQL Repository（权威数据源）
DB 不可用 → 使用内存 Map（registry + memoryStateStore）
首次启动无 DB → 创建 fakeDb（所有查询返回空结果，不抛出异常）
```

`safeQuery` 工具函数确保任何 DB 操作失败都不会影响熔断器的核心功能，真正实现了"熔断器模块自身的弹性"。

---

## 五、风险与改进建议

### P0 级

| 风险 | 级别 | 建议 |
|------|------|------|
| 无发现 | - | 该模块设计完整，无明显 P0 问题 |

### P1 级

| 风险 | 级别 | 建议 |
|------|------|------|
| **服务工厂全局单例** | P1 | `getCircuitBreakerService()` 返回全局变量，多租户场景下可能需要隔离实例 |
| **pipeline-circuit-breaker 导入 side effect** | P1 | `pipeline-circuit-breaker.ts` 在文件顶部调用 `getCircuitBreakerService()`，如果服务尚未初始化可能返回 null，静默绕过熔断保护 |
| **无前端页面** | P1 | 熔断器仪表盘、状态可视化和手动操作界面缺失 |

### P2 级

| 风险 | 级别 | 建议 |
|------|------|------|
| **事件表缺乏清理机制** | P2 | circuit_breaker_events 无 TTL 或清理策略，长期运行会累积大量历史事件 |
| **缺少批量操作 API** | P2 | 无批量重置/批量配置更新端点 |
| **缺少告警通知** | P2 | 熔断器 OPEN 时无自动告警（如 Slack/邮件通知） |
| **metrics 未导出** | P2 | 熔断器状态变更事件未导出为 Prometheus metrics |

---

## 六、总结

### 总体评价

Circuit Breaker 模块是 Orion 平台中 **设计最完善、实现最优雅** 的模块之一。

**优势**：
- 三层降级策略（DB → 内存 → fakeDB）确保极端条件下的可用性
- Repository 层完整（Config/State/Event 三个独立 Repository）
- Pipeline 集成预配置了 9 个常见外部依赖的熔断参数
- 事件审计完整记录所有状态变更
- 测试覆盖优秀（4 个测试文件，共 1797 行，含 repos 测试 807 行）

**关键发现**：

1. **DB 降级设计优秀**：safeQuery 工具函数使 DB 故障完全不影响熔断器核心功能
2. **Pipeline 集成实用**：预定义了 SCM、Registry、Notification、K8s、Artifact 的熔断配置
3. **与基础工具类解耦**：`circuit-breaker-service.ts` 包装了底层的 `CircuitBreaker` 工具类，增加持久化和注册中心能力
4. **无数据丢失风险**：配置和状态全部持久化到 PostgreSQL，重启可恢复

**建议优先处理**：添加事件表 TTL 清理、集成 Prometheus metrics 导出、开发前端仪表盘。
