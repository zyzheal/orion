# Chaos Engineering 深度分析报告

**生成日期**: 2026-07-02
**分析模块**: `orion-platform-service/src/services/chaos-engineering/`
**路由文件**: `chaos-routes.ts`、`chaos-enhanced-routes.ts`
**迁移文件**: `083_create_chaos_engineering.sql`、`147_create_chaos_engineering_tables.sql`

---

## 一、现状概述

### 模块定位

Chaos Engineering 模块承担 **混沌实验管理、故障注入执行、韧性评分、预发布验证** 四大职责。当前实现呈现实体完整、双路由注册的特征：核心业务逻辑完整，PostgreSQL 持久化覆盖实验和运行记录，但部分执行引擎（ChaosExecutor、FaultInjector）的状态管理仍使用内存 Map。

### 文件结构

| 子域 | 文件 | 当前状态 |
|------|------|----------|
| 实验管理 | `ChaosExperimentService.ts` | ✅ 完整（PostgreSQL） |
| 实验 Repository | `ChaosExperimentService.ts` 内嵌 | ✅ 完整（PostgreSQL） |
| K8s 执行器 | `ChaosExecutor.ts` | ⚠️ 内存状态 + kubectl 模拟 |
| 故障注入引擎 | `FaultInjector.ts` | ⚠️ 内存状态 + EventEmitter |
| 故障类型库 | `ChaosFaultLibrary.ts` | ✅ 静态定义 |
| 恢复验证 | `ChaosRecoveryValidator.ts` | ⚠️ 模拟实现（总是返回 passed） |
| 基础韧性评分 | `ResilienceScoreCalculator.ts` | ✅ 完整（PostgreSQL） |
| 增强韧性评分 | `ResilienceScoringService.ts` | ✅ 完整（PostgreSQL） |
| Barrel 导出 | `index.ts` | ✅ 完整导出 |

### 核心数据模型

**chaos_experiments**（迁移 083 + 147 两套，实际使用 083 版本）：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | 主键 |
| tenant_id | UUID NOT NULL | 租户 ID |
| name | VARCHAR(200) | 实验名称 |
| scope | JSONB | 实验范围（tenant_id, service_id, environment） |
| faults | JSONB | 故障定义数组 |
| status | VARCHAR(20) | draft / active / completed / archived |
| auto_rollback | BOOLEAN | 自动回滚开关 |

**chaos_runs**（迁移 083 版本）：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | 主键 |
| experiment_id | UUID FK | 关联实验 |
| status | VARCHAR(20) | running / completed / failed / rolled_back |
| timeline | JSONB | 事件时间线 |
| metrics | JSONB | 运行指标（mttr_ms, affected_services, error_count, recovered） |

**resilience_scores**（迁移 083）：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | 主键 |
| tenant_id | UUID FK | 租户 ID |
| service_id | UUID | 服务 ID |
| score | INT (0-100) | 韧性评分 |
| mttr_ms | INT | 平均恢复时间 |
| success_rate | DECIMAL(5,4) | 成功率 |
| error_budget | DECIMAL(5,4) | 错误预算 |

**resilience_scores_enhanced**（代码中引用，迁移文件未找到定义）：

| 字段 | 类型 | 说明 |
|------|------|------|
| overall_score | INT | 综合评分 |
| experiment_success_rate | DECIMAL | 实验成功率 |
| recovery_time_score | INT | 恢复时间评分 |
| blast_radius_score | INT | 爆炸半径评分 |
| fault_coverage_score | INT | 故障覆盖率评分 |

**chaos_schedules**（代码中引用，迁移文件未找到明确定义）：

| 字段 | 类型 | 说明 |
|------|------|------|
| experiment_id | UUID FK | 关联实验 |
| cron_expression | VARCHAR | Cron 表达式 |
| enabled | BOOLEAN | 是否启用 |
| max_runs | INT | 最大运行次数 |

---

## 二、功能矩阵

### 实验管理

| 功能点 | 状态 | 说明 |
|--------|------|------|
| 实验 CRUD | ✅ | Create/Read/Update/List 完整，PostgreSQL 持久化 |
| 激活/归档 | ✅ | 状态机：draft → active → archived |
| 实验运行 | ✅ | 创建 run 记录，支持 dry_run 模式 |
| 运行回滚 | ✅ | 手动回滚，记录事件时间线 |
| 预发布验证 | ✅ | 自动创建标准实验并执行 |
| 生产环境安全防护 | ⚠️ | 仅 warn 日志，无实际阻断机制 |

### 故障注入

| 功能点 | 状态 | 说明 |
|--------|------|------|
| CPU 飙升注入 | ⚠️ | ChaosExecutor 实现，模拟 + kubectl 尝试，无持久化 |
| 内存泄漏注入 | ⚠️ | 同上，模拟实现 |
| 网络延迟注入 | ⚠️ | 同上，模拟实现 |
| 服务宕机注入 | ⚠️ | 同上，模拟实现 |
| 磁盘满注入 | ⚠️ | ChaosExecutor 未实现磁盘，FaultInjector 有模拟 |
| 自动恢复调度 | ⚠️ | FaultInjector 用 setTimeout 定时恢复（进程级） |
| 注入状态查询 | ⚠️ | 内存 Map 查询，重启后丢失 |

### 故障类型库

| 功能点 | 状态 | 说明 |
|--------|------|------|
| 故障类型定义 | ✅ | 8 种故障类型完整定义 |
| 配置模板生成 | ✅ | 按故障类型生成默认配置 |
| 配置校验 | ✅ | 参数范围和必填项校验 |

### 韧性评分

| 功能点 | 状态 | 说明 |
|--------|------|------|
| 基础评分计算 | ✅ | 4 因子加权（MTTR 25%/成功率 30%/错误预算 25%/恢复 20%） |
| 评分历史趋势 | ✅ | improving/stable/degrading 趋势判断 |
| 评分明细与建议 | ✅ | 自动生成改进建议 |
| 租户级汇总 | ✅ | 各服务评分 + 最弱服务识别 |
| 增强评分 | ✅ | 4 维度（实验成功率 30%/恢复时间 25%/爆炸半径 20%/故障覆盖 25%） |
| 故障覆盖分析 | ✅ | 统计未测试的故障类型 |

### 实验调度

| 功能点 | 状态 | 说明 |
|--------|------|------|
| 定时调度创建 | ✅ | 基于 cron 表达式 |
| 调度启用/禁用 | ✅ | toggle 控制 |
| 到期调度查询 | ✅ | 查询到期未执行的调度 |
| 调度运行记录 | ✅ | 更新 current_runs / last_run_at |

### 预发布验证

| 功能点 | 状态 | 说明 |
|--------|------|------|
| 预部署检查 | ✅ | 基于最近实验结果的验证门控 |
| 最低实验次数检查 | ✅ | 要求最近 30 天 ≥3 次实验 |
| 评分阈值 | ✅ | 默认 70 分通过线 |
| 阻塞原因输出 | ✅ | 未通过时输出明确原因 |

### 恢复验证

| 功能点 | 状态 | 说明 |
|--------|------|------|
| 恢复验证 | ❌ | ChaosRecoveryValidator 始终返回 passed，无真实检测 |
| 系统健康检查 | ❌ | 始终返回 passed |
| 恢复报告 | ❌ | 基于模拟数据 |

---

## 三、API 端点

### chaos-routes.ts（主路由组）

| 方法 | 路径 | 控制器 | 说明 |
|------|------|--------|------|
| POST | `/experiments` | createExperiment | 创建实验 |
| GET | `/experiments` | listExperiments | 列表查询 |
| GET | `/experiments/:id` | getExperiment | 获取详情 |
| PUT | `/experiments/:id` | updateExperiment | 更新实验 |
| POST | `/experiments/:id/activate` | activateExperiment | 激活实验 |
| POST | `/experiments/:id/archive` | archiveExperiment | 归档实验 |
| POST | `/experiments/:id/run` | runExperiment | 运行实验 |
| GET | `/runs/:runId` | getRun | 获取运行详情 |
| POST | `/runs/:runId/rollback` | rollbackRun | 回滚运行 |
| POST | `/inject/cpu-spike` | executeCPUSpike | 直接 CPU 注入 |
| POST | `/inject/memory-leak` | executeMemoryLeak | 直接内存注入 |
| POST | `/inject/network-latency` | executeNetworkLatency | 直接网络延迟注入 |
| POST | `/inject/service-down` | executeServiceDown | 直接服务宕机注入 |
| GET | `/experiments-running` | getRunningExperiments | 运行中实验列表 |
| POST | `/recover/:experimentId` | recoverExperiment | 恢复实验 |
| POST | `/validate-recovery/:experimentId` | validateRecovery | 验证恢复 |
| GET | `/recovery-report/:experimentId` | generateRecoveryReport | 恢复报告 |
| POST | `/pre-release-verify` | preReleaseVerify | 预发布验证 |

### chaos-enhanced-routes.ts（增强路由组）

| 方法 | 路径 | 控制器 | 说明 |
|------|------|--------|------|
| POST | `/experiments` | createExperiment | 创建实验（使用增强错误处理） |
| GET | `/experiments` | listExperiments | 列表查询 |
| GET | `/experiments/:id` | getExperiment | 获取详情 |
| POST | `/experiments/:id/run` | runExperiment | 运行实验 |
| POST | `/experiments/:id/inject` | faultInjector.inject | 注入故障 |
| POST | `/experiments/:id/stop` | rollbackRun | 停止实验 |
| GET | `/experiments/:id/status` | getExperiment | 获取状态 |
| GET | `/experiments/:id/recovery` | getExperiment | 获取恢复状态 |
| GET | `/faults` | 硬编码列表 | 故障类型列表 |
| POST | `/faults/:type/config-template` | 硬编码模板 | 获取配置模板 |

**注意**：两个路由文件都注册到 `/chaos` 前缀（routes.ts 第 907 行和 1359 行），存在端点重复注册问题。enhanced 路由的 `POST /experiments` 和 `GET /experiments` 与主路由的相同路径可能冲突，取决于 Fastify 的插件注册顺序。

### 路由认证

所有端点都配置了 `authenticateUser` 中间件，部分创建/执行操作附加了 `requirePermission({ resource: 'chaos-engineering', action: 'create' | 'execute' })` 的权限检查。

---

## 四、依赖关系

| 依赖类型 | 依赖模块 | 说明 |
|----------|----------|------|
| 内部依赖 | `../../utils/logger` | 日志工具 |
| 内部依赖 | `../../errors` | OrionError/ServiceUnavailableError 等 |
| 内部依赖 | `../database` | DatabasePool（PostgreSQL 连接池） |
| 内部依赖 | `../../repositories/ChaosEngineeringRepository` | ChaosExecutor 引用的额外 Repository（与内置 Repository 分离） |
| 内部依赖 | `../../utils/rate-limit-circuit-breaker` | CircuitBreaker 基础类（仅类型引用） |
| 外部依赖 | `child_process` (exec/spawn) | ChaosExecutor 执行 kubectl 命令 |
| 外部依赖 | `events` (EventEmitter) | FaultInjector 的事件机制 |
| 运行时依赖 | kubectl CLI | ChaosExecutor 尝试调用系统 kubectl |
| 运行时依赖 | PostgreSQL | 实验/Run/评分数据持久化 |

---

## 五、风险与改进建议

### P0 级（阻塞生产）

| 风险 | 级别 | 建议 |
|------|------|------|
| **双路由文件注册冲突** | P0 | chaos-routes.ts 和 chaos-enhanced-routes.ts 都注册到 `/chaos` 前缀，端点可能冲突。建议合并为一个路由文件，或统一使用 enhanced 版本。 |
| **ChaosExecutor 内存状态** | P0 | 所有注入状态（experiments Map）存储于内存，进程重启后丢失所有进行中的实验。需要将注入状态持久化到 PostgreSQL。 |
| **FaultInjector 内存状态** | P0 | activeFaults Map 存储于内存，auto-recovery 依赖 setTimeout（进程级），服务重启后所有进行中的故障注入永久丢失。 |
| **恢复验证形同虚设** | P0 | ChaosRecoveryValidator 的所有 health check 始终返回 passed（硬编码），没有真实的系统健康检测逻辑。 |

### P1 级（高优先级）

| 风险 | 级别 | 建议 |
|------|------|------|
| **resilience_scores_enhanced 表未确认** | P1 | `ResilienceScoringService` 写入 `resilience_scores_enhanced` 表，但迁移文件中未找到该表定义，可能导致运行时错误。 |
| **chaos_schedules 表未确认** | P1 | `ResilienceScoringService` 使用 `chaos_schedules` 表，但迁移文件中未找到明确的定义（147 号迁移也未包含）。 |
| **迁移文件存在两套** | P1 | 083 和 147 两个迁移都定义了 chaos_experiments 和 chaos_runs 表，但 schema 不同。083 有 tenant_id FK 约束，147 有更完整的字段。需要确认实际使用的是哪套。 |
| **模拟实现过多** | P1 | ChaosExecutor 的 4 种注入和恢复全部使用模拟回退（simulate* 方法），无法进行真正的混沌工程实验。 |
| **无前端页面** | P1 | 混沌工程实验管理、故障注入、韧性评分均无可视化管理页面。 |

### P2 级（改进项）

| 风险 | 级别 | 建议 |
|------|------|------|
| **生产环境无 real 阻断** | P2 | 代码对 production 环境实验仅 warn 日志，没有实际的审批流程或安全门控 |
| **Cron 解析简化** | P2 | computeNextRun 始终返回 1 小时后，未使用真正的 cron 解析库 |
| **Blast Radius 估算粗糙** | P2 | 仅根据 affected_services 数量线性估算，缺乏实际拓扑数据 |
| **无实验模板库** | P2 | 预发布验证硬编码两种故障，不支持用户自定义验证模板 |

---

## 六、总结

### 总体评价

Chaos Engineering 模块是 Orion 平台中最具完整性的高复杂度模块之一。

**优势**：
- 实验 CRUD 完整实现且使用 PostgreSQL 持久化
- 韧性评分系统设计合理（4 因子加权 + 增强评分）
- 预发布验证门控逻辑完整
- 测试覆盖良好（8 个测试文件，共 1960 行）
- 所有 API 端点已注册并配置认证授权

**关键发现**：

1. **双路由冲突**：两个路由文件注册到同一前缀，需合并或统一
2. **执行层未持久化**：ChaosExecutor 和 FaultInjector 的状态管理依赖进程内存
3. **模拟执行占主导**：故障注入和恢复验证基本都是模拟实现
4. **数据库表定义不统一**：083 和 147 两套迁移 + resilience_scores_enhanced 表未确认

**建议优先处理**：解决双路由冲突、确认 missing 的表定义、将 ChaosExecutor/FaultInjector 状态迁移到 PostgreSQL。
