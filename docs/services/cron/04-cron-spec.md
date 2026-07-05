# 定时任务服务 Spec 文档

**生成日期**: 2026-07-03
**状态**: 编写中
**成熟度**: L1（初始定义）

---

## 一、服务定位

> **基于代码实现提炼的服务定义与能力边界**

### 1.1 业务定义

`cron-svc-go` 是 Orion 平台的 **定时任务调度与值班排班服务**，提供两个核心功能域：

| 功能域 | 说明 |
|--------|------|
| **定时任务 (CronJob)** | 基于 Cron 表达式的周期性任务调度。支持任务的创建、编辑、启停、手动执行、执行历史追溯 |
| **值班排班 (OnCall Schedule)** | 团队值班轮转管理。支持配置轮转周期（日/周/月）、当前值班人查询、替班覆盖（Override）、升级策略 |

### 1.2 定位层次

| 维度 | 描述 |
|------|------|
| 系统层级 | 基础设施编排层 — 时序触发引擎 |
| 所在项目 | Orion 平台 |
| 部署形态 | 独立 Go 微服务 (orion-cron-svc-go)，通过 Gin HTTP 对外暴露 API |
| 数据存储 | PostgreSQL（任务定义 + 执行记录 + 排班数据） |
| 缓存依赖 | Redis（JWT 鉴权黑名单校验） |
| 注册发现 | 通过 API Gateway 对外暴露，健康检查端点 `/healthz` |

### 1.3 核心工作流

```
调度循环 (每 60s tick):
  ┌─────────────┐
  │ 加载所有     │
  │ 已启用任务   │  ← repository.FindEnabledCronJobs()
  └──────┬──────┘
         ↓
  ┌─────────────────┐
  │ 计算每个任务是否 │  ← shouldExecute() 解析 Cron 表达式
  │ 到执行时间     │     检查前一次调度时间是否在 tick 窗口 (60s+5s容忍)
  └──────┬─────────┘
         ↓ (已到期)
  ┌─────────────────────┐
  │ 异步执行任务        │  ← ExecuteJob() 协程
  │ 记录执行开始 (running) │
  │ 执行 executeTask()   │
  │ 记录执行结果 (success/failed) │
  │ 更新 last_run_at/status/next_run_at │
  └─────────────────────┘
```

### 1.4 与 Orion 平台其他服务的关系

| 服务 | 关系 |
|------|------|
| `orion-api-gateway` | API 请求通过网关反向代理，网关处理公共鉴权 / CORS / 日志 |
| `orion-go-common` | 共享库：数据库连接、Redis 客户端、中间件（鉴权/日志/恢复/CORS） |
| `orion-platform-service` | 作为编排中心，可消费 cron-svc 的定时任务结果或触发任务执行 |

---

## 二、验收标准

| 编号 | 验收标准 | 优先级 | 验证方式 |
|------|---------|--------|---------|
| CRON-01 | 支持基于 Cron 表达式的定时任务定义（5 位标准格式） | P0 | 创建 CronJob 后验证定时触发 |
| CRON-02 | 提供任务的完整 CRUD（增删改查）API | P0 | API 测试 |
| CRON-03 | 提供任务的启用/禁用控制 | P0 | 启用后任务被调度，禁用后不被调度 |
| CRON-04 | 支持任务的手动立即执行 | P0 | POST /execute 返回执行记录 |
| CRON-05 | 记录每次执行的历史（状态、输出、错误） | P0 | GET /executions 返回历史列表 |
| CRON-06 | 调度器自动循环检查到期任务（60s tick） | P0 | 观察日志确认 tick 循环执行 |
| CRON-07 | 启动时从 DB 恢复已启用任务 | P0 | 服务重启后任务继续被调度 |
| CRON-08 | 多租户隔离：所有资源以 `tenant_id` 为 scope | P0 | 跨租户不可见 |
| CRON-09 | 提供值班排班管理（创建/查询/删除） | P1 | API 测试 |
| CRON-10 | 支持三种轮转周期：daily / weekly / monthly | P1 | 创建不同周期，检查 assignment 时间范围 |
| CRON-11 | 支持查询当前值班人（含 override 优先） | P1 | API 测试 |
| CRON-12 | 支持值班替班覆盖（Override），含时间范围 | P1 | 创建 override 后，当前值班返回 override 用户 |
| CRON-13 | 支持升级策略（Escalation），多级别超时通知 | P1 | 模型定义支持，集成待验证 |
| CRON-14 | 调度器的启停控制 | P1 | API 可控制调度循环启停 |
| CRON-15 | 查询当前正在运行的任务列表 | P1 | GET /scheduler/running |
| CRON-16 | 创建任务时校验 Cron 表达式合法性 | P0 | 非法表达式返回 400 |
| CRON-17 | 更新任务时校验 Cron 表达式（如有修改） | P0 | 非法表达式返回 400 |
| CRON-18 | 权限控制：写/删除/执行操作需对应 permission | P0 | 无权限返回 403 |
| CRON-19 | 健康检查端点 `/healthz` | P0 | 返回 200 |
| CRON-20 | 相同任务不会并发执行（runningJobIDs 锁保护） | P0 | 同时触发时跳过已在执行的任务 |

---

## 三、API 设计

### 3.1 全局约定

| 属性 | 值 |
|------|-----|
| 基础路径 | `/api/v1` |
| 鉴权方式 | JWT Bearer Token (`auth.Auth` 中间件)，白名单：`/healthz` |
| 权限模型 | 细粒度 RBAC：`cron:write` / `cron:delete` / `cron:execute` |
| 租户隔离 | 从 JWT 解析 `tenant_id`，所有查询带 tenant_id 过滤 |
| 分页参数 | `page` (默认 1), `page_size` (默认 20，最大 100) |
| 响应格式 | JSON |
| 错误格式 | `{"error": "<错误描述>"}` |

### 3.2 定时任务 API

| 方法 | 路径 | 功能说明 | 请求参数 | 响应 |
|------|------|---------|---------|------|
| POST | `/api/v1/cron-jobs` | 创建定时任务 | Body: `{name, schedule, command, payload?}` | `201` CronJob JSON |
| GET | `/api/v1/cron-jobs` | 获取任务列表（分页） | Query: `page, page_size` | `200 {data: CronJob[]}` |
| GET | `/api/v1/cron-jobs/count` | 获取任务总数 | - | `200 {count: number}` |
| GET | `/api/v1/cron-jobs/:id` | 获取单个任务详情 | - | `200` CronJob JSON |
| PUT | `/api/v1/cron-jobs/:id` | 更新任务定义 | Body: `{name?, schedule?, command?, payload?}` | `200 {message: "updated"}` |
| DELETE | `/api/v1/cron-jobs/:id` | 删除任务 | - | `200 {message: "deleted"}` |
| PUT | `/api/v1/cron-jobs/:id/enable` | 启用任务 | - | `200 {message: "enabled"}` |
| PUT | `/api/v1/cron-jobs/:id/disable` | 禁用任务（清空 next_run_at） | - | `200 {message: "disabled"}` |
| POST | `/api/v1/cron-jobs/:id/execute` | 手动立即执行任务 | - | `200` CronExecution JSON |
| GET | `/api/v1/cron-jobs/:id/executions` | 获取任务执行历史（分页） | Query: `page, page_size` | `200 {data: CronExecution[]}` |

### 3.3 调度器控制 API

| 方法 | 路径 | 功能说明 | 请求参数 | 响应 |
|------|------|---------|---------|------|
| POST | `/api/v1/scheduler/start` | 启动调度循环 | - | `200 {message: "scheduler started"}` |
| POST | `/api/v1/scheduler/stop` | 停止调度循环 | - | `200 {message: "scheduler stopped"}` |
| GET | `/api/v1/scheduler/running` | 获取正在执行的任务 ID 列表 | - | `200 {running_jobs: string[]}` |

### 3.4 值班排班 API

| 方法 | 路径 | 功能说明 | 请求参数 | 响应 |
|------|------|---------|---------|------|
| POST | `/api/v1/oncall-schedules` | 创建值班排班 | Body: `{name, timezone?, rotation_type, rotation_start_hour?, team_members, escalations?}` | `201` OnCallSchedule JSON |
| GET | `/api/v1/oncall-schedules` | 获取排班列表 | - | `200 {data: OnCallSchedule[]}` |
| GET | `/api/v1/oncall-schedules/:id` | 获取排班详情 | - | `200` OnCallSchedule JSON |
| DELETE | `/api/v1/oncall-schedules/:id` | 删除排班（含关联 assignments / overrides） | - | `200 {message: "deleted"}` |
| GET | `/api/v1/oncall-schedules/:id/current` | 查询当前值班人 | - | `200 {is_on_call, primary_user_id, escalation_targets}` |
| POST | `/api/v1/oncall-schedules/:id/overrides` | 创建替班覆盖 | Body: `{original_user_id, override_user_id, start_time, end_time, reason?}` | `201` OnCallOverride JSON |

### 3.5 健康检查

| 方法 | 路径 | 功能说明 | 权限 |
|------|------|---------|------|
| GET | `/healthz` | 服务存活检测 | 免鉴权 |

### 3.6 请求/数据样例

**创建 CronJob**:
```bash
POST /api/v1/cron-jobs
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "name": "每日数据清理",
  "schedule": "0 2 * * *",
  "command": "/scripts/cleanup.sh",
  "payload": {"retention_days": 30}
}
```

**响应**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "tenant-abc",
  "name": "每日数据清理",
  "schedule": "0 2 * * *",
  "command": "/scripts/cleanup.sh",
  "payload": {"retention_days": 30},
  "enabled": true,
  "next_run_at": "2026-07-04T02:00:00Z",
  "created_at": "2026-07-03T10:00:00Z",
  "updated_at": "2026-07-03T10:00:00Z"
}
```

**查询当前值班**:
```bash
GET /api/v1/oncall-schedules/schedule_xxx/current
```

**响应**:
```json
{
  "is_on_call": true,
  "primary_user_id": "user-zhangsan",
  "escalation_targets": ["user-lisi", "user-wangwu"]
}
```

---

## 四、数据模型

### 4.1 表结构概览

| 表名 | 用途 | 核心字段 |
|------|------|---------|
| `cron_jobs` | 定时任务定义 | id, tenant_id, name, schedule, command, payload, enabled, last_run_at, last_run_status, next_run_at, timestamps |
| `cron_executions` | 任务执行记录 | id, job_id, started_at, completed_at, status, output, error |
| `oncall_schedules` | 值班排班定义 | id, tenant_id, name, timezone, rotation_type, rotation_start_hour, team_members, start_date, end_date, escalations, timestamps |
| `oncall_assignments` | 排班轮转分配 | id, schedule_id, user_id, start_time, end_time |
| `oncall_overrides` | 替班覆盖记录 | id, schedule_id, original_user_id, override_user_id, start_time, end_time, reason |

### 4.2 实体字段详解

**CronJob** (`cron_jobs`)

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | VARCHAR(36) | PK | UUID |
| tenant_id | VARCHAR(64) | NOT NULL | 租户 ID，多租户隔离键 |
| name | VARCHAR(255) | NOT NULL | 任务名称 |
| schedule | VARCHAR(100) | NOT NULL | 5 位标准 Cron 表达式 (`分 时 日 月 周`) |
| command | VARCHAR(500) | NOT NULL | 执行的命令/任务标识符 |
| payload | JSONB | - | 执行时的附加参数 |
| enabled | BOOLEAN | NOT NULL, DEFAULT TRUE | 是否启用 |
| last_run_at | TIMESTAMPTZ | - | 最近执行时间 |
| last_run_status | VARCHAR(20) | - | 最近执行状态 (success/failed) |
| next_run_at | TIMESTAMPTZ | - | 下次计划执行时间 |
| created_at | TIMESTAMPTZ | NOT NULL | 创建时间 |
| updated_at | TIMESTAMPTZ | NOT NULL | 最后更新时间 |

**CronExecution** (`cron_executions`)

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | VARCHAR(64) | PK | 格式：`exec_{unixms}_{jobID}` |
| job_id | VARCHAR(36) | FK → cron_jobs.id | 关联任务 |
| started_at | TIMESTAMPTZ | NOT NULL | 执行开始时间 |
| completed_at | TIMESTAMPTZ | - | 执行完成时间 |
| status | VARCHAR(20) | NOT NULL | 状态: `running`/`success`/`failed` |
| output | TEXT | - | 执行输出 |
| error | TEXT | - | 错误信息 |

**OnCallSchedule** (`oncall_schedules`)

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | VARCHAR(64) | PK | 格式：`schedule_{uuid}` |
| tenant_id | VARCHAR(64) | NOT NULL | 租户 ID |
| name | VARCHAR(255) | NOT NULL | 排班名称 |
| timezone | VARCHAR(64) | NOT NULL, DEFAULT 'UTC' | 时区 |
| rotation_type | VARCHAR(20) | NOT NULL | 轮转类型: `daily`/`weekly`/`monthly` |
| rotation_start_hour | INT | NOT NULL, DEFAULT 9 | 轮转开始时间（小时） |
| team_members | JSONB (StringSlice) | NOT NULL | 团队成员 ID 列表 |
| start_date | TIMESTAMPTZ | NOT NULL | 排班生效日期 |
| end_date | TIMESTAMPTZ | - | 排班结束日期 |
| escalations | JSONB (EscalationSlice) | DEFAULT '[]' | 升级策略列表 |
| created_at | TIMESTAMPTZ | NOT NULL | 创建时间 |
| updated_at | TIMESTAMPTZ | NOT NULL | 更新时间 |

**OnCallAssignment** (`oncall_assignments`)

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | VARCHAR(64) | PK | 格式：`assign_{uuid}` |
| schedule_id | VARCHAR(64) | FK → oncall_schedules.id | 排班 ID |
| user_id | VARCHAR(64) | NOT NULL | 值班人 ID |
| start_time | TIMESTAMPTZ | NOT NULL | 值班开始时间 |
| end_time | TIMESTAMPTZ | NOT NULL | 值班结束时间 |

**OnCallOverride** (`oncall_overrides`)

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | VARCHAR(64) | PK | 格式：`override_{uuid}` |
| schedule_id | VARCHAR(64) | FK → oncall_schedules.id | 排班 ID |
| original_user_id | VARCHAR(64) | NOT NULL | 被替换的值班人 |
| override_user_id | VARCHAR(64) | NOT NULL | 替班人 |
| start_time | TIMESTAMPTZ | NOT NULL | 替班开始时间 |
| end_time | TIMESTAMPTZ | NOT NULL | 替班结束时间 |
| reason | TEXT | - | 替班原因 |

### 4.3 EscalationRule（内嵌类型）

| 字段 | 类型 | 说明 |
|------|------|------|
| level | INT | 升级级别 (1-based) |
| timeout_minutes | INT | 超时时间（分钟） |
| targets | STRING[] | 升级通知目标用户 ID 列表 |

### 4.4 PaginatedRequest（通用分页辅助）

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | INT (form) | 1 | 页码 |
| page_size | INT (form) | 20 | 每页数量，最大值 100 |

### 4.5 关键索引建议

> 基于 Repository 层 SQL 分析

| 表 | 索引字段 | 理由 |
|------|---------|------|
| cron_jobs | (tenant_id, created_at DESC) | ListCronJobs 排序 |
| cron_jobs | (enabled, created_at) | FindEnabledCronJobs 全表扫描 |
| cron_jobs | (id, tenant_id) | GetByID 过滤 + 租户隔离 |
| cron_executions | (job_id, started_at DESC) | GetExecutionHistory 排序 |
| oncall_schedules | (tenant_id, created_at DESC) | ListOnCallSchedules 排序 |
| oncall_assignments | (schedule_id, start_time, end_time) | FindActiveAssignment 时间范围查询 |
| oncall_overrides | (schedule_id, start_time, end_time) | FindActiveOverride 时间范围查询 |

---

## 五、依赖与集成

### 5.1 直接依赖

| 依赖 | 用途 | 版本/来源 |
|------|------|----------|
| Go | 运行时 | 1.21+ |
| `github.com/gin-gonic/gin` | HTTP 框架 | v1.x |
| `github.com/jmoiron/sqlx` | PostgreSQL 数据库操作 | v1.x |
| `github.com/robfig/cron/v3` | Cron 表达式解析与调度时间计算 | v3.x |
| `github.com/google/uuid` | UUID 生成 | v1.x |
| `orion/go-common/pkg/database` | 数据库连接与迁移管理 | 内部 |
| `orion/go-common/pkg/redis` | Redis 客户端（JWT 黑名单） | 内部 |
| `orion/go-common/pkg/auth` | JWT 鉴权中间件 + RBAC | 内部 |
| `orion/go-common/pkg/middleware` | 通用中间件（日志/恢复/CORS/健康检查） | 内部 |
| `orion/go-common/pkg/logger` | 结构化日志 (zap) | 内部 |

### 5.2 基础设施依赖

| 组件 | 用途 | 说明 |
|------|------|------|
| PostgreSQL | 主数据存储 | 存储任务定义、执行历史、排班数据 |
| Redis | JWT 黑名单缓存 | 用于 JWT 登出后的 Token 校验 |
| API Gateway | 外部 API 入口 | Gateway 反向代理到本服务 |

### 5.3 环境变量

| 变量 | 默认值 | 必填 | 说明 |
|------|--------|------|------|
| `PORT` | `8080` | - | HTTP 监听端口 |
| `DB_HOST` | `localhost` | - | PostgreSQL 主机 |
| `DB_PORT` | `5432` | - | PostgreSQL 端口 |
| `DB_USER` | - | **是** | PostgreSQL 用户名 |
| `DB_PASSWORD` | - | **是** | PostgreSQL 密码 |
| `DB_NAME` | `orion_cron` | - | PostgreSQL 数据库名 |
| `DB_SSLMODE` | `disable` | - | PostgreSQL SSL 模式 |
| `JWT_SECRET` | `change-me-in-production` | - | JWT 签名密钥 |
| `REDIS_ADDR` | `localhost:6379` | - | Redis 地址 |

### 5.4 集成说明

- **鉴权集成**: 使用 `orion/go-common/pkg/auth`，JWT token 通过 Redis 校验黑名单，支持细粒度 RBAC。定时任务和排班 API 通过 `auth.RequirePermission("cron", "<action>")` 保护写/删/执行操作。
- **健康检查**: Gateway 通过 `/healthz` 轮询服务存活状态。
- **日志集成**: 使用 `go-common/pkg/logger` (zap 包装)，格式与 Orion 平台统一。
- **数据库迁移**: 使用 `database.RunMigrations()` 自动执行 `migrations/` 目录下 SQL 迁移文件。

---

## 六、注意事项

### 6.1 架构约束

1. **调度器单进程运行**：当前调度器在进程内通过 `time.Ticker` + 协程实现，不支持分布式协调。多实例部署会导致任务重复执行。后续需引入分布式锁（如 Redis Redlock）或基于 PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED` 实现 leader election。

2. **executeTask 为模拟实现**: `Service.executeTask()` 当前仅返回成功消息（`fmt.Sprintf("Task %q executed successfully at ...")`），未真正调用外部命令或触发业务逻辑。需根据具体需求对接真实任务执行器（Shell 执行、HTTP 回调、gRPC 调用等）。

3. **时间精度**: 调度 tick 间隔为 60 秒，`shouldExecute()` 加 5 秒容忍窗口。这意味着任务的执行时间有最多约 65 秒的延迟。对时间敏感的任务需考虑此误差范围或缩短 tick 间隔。

4. **Cron 表达式只支持 5 位**: 使用 `cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow`，不支持秒级和年段。

### 6.2 安全约束

5. **JWT_SECRET 默认值**: 默认值为 `change-me-in-production`，生产环境必须通过环境变量覆盖，否则存在 JWT 伪造风险。

6. **权限模型**: 当前排班查询接口（ListOnCallSchedules, GetOnCallSchedule）未设置 `auth.RequirePermission`，未配置细粒度 ACL。生产部署前需确认是否开放给所有认证用户。

7. **DB_USER / DB_PASSWORD 为必需环境变量**：缺失时服务 panic 启动失败，属预期设计，但需确保生产环境正确注入。

### 6.3 运维注意事项

8. **迁移目录**: `migrations/` 目录不存在时跳过迁移执行（main.go 中 `os.Stat` 判断），不会报错退出。首次部署需确保迁移文件就绪。

9. **日志输出**: 使用 `go-common/pkg/logger`（zap 结构化日志）与 `log.Printf` 混合。`log.Printf` 是内建 logger，格式与 zap 不统一。建议未来统一使用 zap。

10. **无限流 / 熔断**: 当前未集成请求限流和熔断机制，在高并发场景下可能影响上游服务。

### 6.4 待完善功能

11. **任务失败重试**: 当前执行失败仅记录状态，无自动重试策略。

12. **任务超时控制**: 当前 `executeTask` 无超时 context，长时间运行的任务可能无限阻塞。

13. **通知 / 告警**: 任务执行失败无通知集成。后续可对接 Orion 通知服务。

14. **排班 assignment 自动续期**: `generateAssignments` 仅在创建排班时一次性生成。需定时任务或触发器自动在 assignment 过期后生成下一轮。

15. **排班 Update 缺失**: OnCallSchedule 当前仅支持 Create / Get / List / Delete，无 Update API（PUT）。模型中也未定义 `UpdateOnCallScheduleRequest`。

16. **已执行任务的 payload 修改**

: 修改任务 payload 后，正在执行中的任务不受影响，但这是合理行为。确保文档明确。

17. **执行历史清理**: 随运行时间增长，`cron_executions` 表数据会持续膨胀。需实现数据保留策略（如删除 90 天前的记录）或归档机制。
