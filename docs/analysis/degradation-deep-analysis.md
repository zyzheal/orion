# Degradation 深度分析报告

**生成日期**: 2026-07-02
**分析模块**: `orion-platform-service/src/services/degradation/` + `orion-platform-service/src/services/degradation-config/`
**路由文件**: `degradation-routes.ts`
**迁移文件**: `082_create_ai_model_versions.sql`（degradation_configs）、`196_map_to_postgres_migration.sql`（auto_recovery_records）、`0297_auto_recovery_degraded_state_persistence.sql`（degraded_state）

---

## 一、现状概述

### 模块定位

Degradation 模块由两个子服务组成，承担 **AI Provider 降级自动恢复** 和 **降级策略动态配置** 两大职责：

- **degradation**（AutoRecoveryService）：监控降级的 AI Provider，定时尝试恢复，跟踪恢复尝试和成功率
- **degradation-config**（DegradationConfigService）：管理按场景（scenario）划分的降级策略配置，支持运行时热更新，具备审计日志

### 文件结构

| 子域 | 目录/文件 | 当前状态 |
|------|----------|----------|
| 自动恢复服务 | `degradation/AutoRecoveryService.ts` | ✅ 完整（PostgreSQL + EventEmitter） |
| 自动恢复导出 | `degradation/index.ts` | ✅ 完整 |
| 降级配置服务 | `degradation-config/DegradationConfigService.ts` | ✅ 完整（PostgreSQL + 审计日志） |
| 降级配置导出 | `degradation-config/index.ts` | ✅ 完整 |

### 核心数据模型

**degradation_configs**（迁移 082）：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | 主键 |
| tenant_id | UUID FK | 租户 ID |
| scenario | VARCHAR(100) UNIQUE | 场景名称（如 risk-assessment, test-selection, code-review） |
| strategy | VARCHAR(50) | 降级策略：rule-engine / template / cache / manual / default |
| fallback_strategies | TEXT[] | 回退策略列表 |
| rule_set | JSONB | 规则集 |
| template_name | VARCHAR(100) | 模板名称 |
| cache_ttl | INT DEFAULT 300 | 缓存 TTL（秒） |
| notify_on_degradation | BOOLEAN | 是否发送降级通知 |
| default_response | JSONB | 默认响应 |

**degradation_config_audit**（代码中引用，迁移文件未找到定义）：

| 字段 | 类型 | 说明 |
|------|------|------|
| scenario | VARCHAR(100) | 场景名称 |
| action | VARCHAR(20) | create / update / delete / import / export |
| old_config / new_config | JSONB | 变更前后的配置快照 |
| created_by | VARCHAR | 操作人 |

**auto_recovery_records**（迁移 196）：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | 主键 |
| provider_id | VARCHAR(200) | Provider 标识 |
| attempted_at | TIMESTAMPTZ | 尝试时间 |
| success | BOOLEAN | 是否成功 |
| success_rate | DECIMAL | 当前成功率 |
| recovered_at | TIMESTAMPTZ | 恢复时间 |

**auto_recovery_degraded_state**（迁移 0297）：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | 主键 |
| provider_id | VARCHAR(200) UNIQUE | Provider 标识 |
| degraded_at | TIMESTAMPTZ | 降级时间 |
| last_success_rate | DECIMAL | 上次成功率 |
| attempt_count | INT | 尝试次数 |

---

## 二、功能矩阵

### 自动恢复服务（degradation/AutoRecoveryService）

| 功能点 | 状态 | 说明 |
|--------|------|------|
| 定时监控启动 | ✅ | setInterval 定期检查降级 Provider |
| 恢复候选检查 | ✅ | 根据 minRecoveryTime 判断是否可恢复 |
| 最大尝试次数 | ✅ | 默认 3 次，达到后不再尝试 |
| 成功率探测 | ⚠️ | probeProvider 使用模拟数据（默认返回 0.6） |
| 恢复尝试记录 | ✅ | 写入 auto_recovery_records 表 |
| 降级状态管理 | ✅ | DegradedStateRepository 管理降级列表 |
| 恢复成功/失败事件 | ✅ | EventEmitter 发送 recovery:success / recovery:failed |
| 整体成功率跟踪 | ✅ | 目标 >80%，基于所有尝试统计 |
| Provider 成功率更新 | ✅ | 外部可调用更新 |
| 手动清除降级 | ✅ | 管理员可手动清除 |
| 重置尝试计数 | ✅ | 删除所有历史记录 |
| 停止监控 | ✅ | 清理定时器 |

### 降级配置服务（degradation-config/DegradationConfigService）

| 功能点 | 状态 | 说明 |
|--------|------|------|
| 默认配置初始化 | ✅ | risk-assessment / test-selection / code-review 三个场景预置 |
| 按场景查询配置 | ✅ | findByScenario |
| 配置列表 | ✅ | listAll |
| 配置创建/更新 | ✅ | 支持 upsert 语义（不存在则创建） |
| 配置删除 | ✅ | 硬删除 |
| 配置导入 | ✅ | 批量导入 + 逐条错误报告 |
| 配置导出 | ✅ | 全量导出 |
| 配置校验 | ✅ | 策略名称/cache_ttl/scenario 名称格式校验 |
| 审计日志 | ✅ | 所有变更操作记录到 degradation_config_audit |
| 获取活跃策略 | ✅ | 返回 primary + fallbacks |

---

## 三、API 端点

所有端点注册在 `/degradation` 前缀（routes.ts 第 1314 行）。

### degradation-routes.ts

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/status` | 恢复服务状态（降级列表/配置/成功率） |
| GET | `/config` | 获取 AutoRecovery 配置 |
| GET | `/stats/:providerId` | 获取指定 Provider 恢复统计 |
| GET | `/degraded` | 获取降级 Provider 列表 |
| POST | `/update-rate` | 更新 Provider 成功率（需 admin 角色） |
| GET | `/stats` | 获取所有 Provider 恢复统计 |
| GET | `/success-rate` | 获取整体成功率 |

### 路由认证

所有端点配置了 `authenticateUser`（通过 `addHook('onRequest', ...)` 批量应用）。各端点附加了 `requirePermission({ resource: 'degradation', action: 'read' | 'manage' })`。

**注意**：degradation-config 的服务（DegradationConfigService）虽然有完整 CRUD，但 **未暴露 API 路由**。目前只有 degradation-routes.ts 中 AutoRecoveryService 的端点被注册。

---

## 四、依赖关系

| 依赖类型 | 依赖模块 | 说明 |
|----------|----------|------|
| 内部依赖 | `../../utils/logger` | 日志工具 |
| 内部依赖 | `../../errors` | OrionError 等 |
| 内部依赖 | `../database` | DatabasePool（PostgreSQL 连接池） |
| 内部依赖 | `../../repositories/AutoRecoveryRecordRepository` | 恢复记录仓储 |
| 内部依赖 | `../../repositories/DegradedStateRepository` | 降级状态仓储 |
| 外部依赖 | `events` (EventEmitter) | 事件发布机制 |
| 外部依赖 | `uuid` | UUID 生成 |
| 运行时依赖 | PostgreSQL | 4 张表（degradation_configs / degradation_config_audit / auto_recovery_records / auto_recovery_degraded_state） |

---

## 五、风险与改进建议

### P0 级

| 风险 | 级别 | 建议 |
|------|------|------|
| **DegradationConfigService 无 API 路由** | P0 | `degradation-config/DegradationConfigService.ts` 实现了完整的配置管理 CRUD、导入导出、审计日志，但没有任何 API 端点暴露这些功能。前端无法使用这些能力。需要添加对应的路由文件或在 degradation-routes.ts 中补充端点。 |
| **degradation_config_audit 表可能缺失** | P0 | 代码中引用了 `degradation_config_audit` 表，但迁移文件中未找到该表的正式定义。如果表不存在，所有配置变更操作都会失败。 |

### P1 级

| 风险 | 级别 | 建议 |
|------|------|------|
| **probeProvider 模拟实现** | P1 | `AutoRecoveryService.probeProvider()` 返回固定的 0.6 或从 DB 读取历史数据，没有真实的 Provider 健康探测。降级恢复决策基于猜测而非实际检测。 |
| **degradation-routes 中多处未返回值** | P1 | 路由处理函数中使用 `handleError(reply, ...)` 后缺少 `return` 语句，可能导致 Fastify 继续执行后续代码，引发重复发送响应头错误。 |
| **降级配置初始化失败不影响启动** | P1 | `initializeDefaults()` 的异常仅在 logger.error 中记录，初始化失败对调用方透明，可能导致空配置状态。 |

### P2 级

| 风险 | 级别 | 建议 |
|------|------|------|
| **AutoRecovery 配置不支持热更新** | P2 | AutoRecoveryConfig 只在构造时设置，运行时无法通过 API 更新 |
| **缺少监控告警集成** | P2 | 降级事件未集成 Notification 模块发送告警 |
| **无前端页面** | P2 | 降级状态仪表盘、配置管理、手动恢复操作均无可视化界面 |
| **degradation-config 审计日志无清理** | P2 | 审计日志无限增长，无 TTL 策略 |

---

## 六、总结

### 总体评价

Degradation 模块由两个独立的子服务组成，设计目的明确，但存在 **功能与接口不匹配** 的问题。

**优势**：
- AutoRecoveryService 设计完整（定时监控 → 尝试恢复 → 记录 → 事件通知）
- DegradationConfigService 具备企业级特性（审计日志、验证、导入/导出）
- 数据层全部使用 PostgreSQL 持久化
- 测试覆盖优秀（5 个测试文件，共 3390 行，含 comprehensive test 767 行）

**关键发现**：

1. **DegradationConfigService 有服务无路由**：完整的配置管理能力无法通过 API 使用，是最紧迫的问题
2. **config_audit 表定义缺失**：需要确认此表是否存在或创建迁移
3. **两个子服务业务关联弱**：AutoRecoveryService 管理 Provider 降级恢复，DegradationConfigService 管理 AI 场景的降级策略配置，两者在代码层面没有直接关联
4. **模拟探测限制价值**：没有真实的 Provider 健康检测，恢复决策的准确性无法保证

**建议优先处理**：补充 DegradationConfigService 的 API 路由、确认 config_audit 表状态、替换 probeProvider 为真实健康检测。
