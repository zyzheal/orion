# 调度器服务 Spec 文档

**生成日期**: 2026-07-02
**状态**: 已实现
**成熟度**: L2（功能完整）

---

## 一、服务定位

调度器服务（Scheduler Service）是 Orion 平台的定时任务调度与值班排班基础设施，包含两个核心领域：

1. **Cron 定时任务调度（Cron Job Scheduling）**：支持标准 5 字段 Cron 表达式（`minute hour day month weekday`）解析与调度，提供任务的完整 CRUD 生命周期管理、手动执行、暂停/恢复/禁用状态控制，以及执行历史记录追踪。
2. **值班排班管理（On-Call Scheduling）**：管理运维团队的值班排班，支持每日/每周/每月三种轮换周期、代班覆盖（Override）、多级升级规则（Escalation），以及实时值班人员查询。

**设计理念**：
- **多租户隔离**：所有数据按 `tenant_id` 分区，请求从 JWT claims 中提取 tenant_id。
- **分布式锁定**：使用 PostgreSQL 原生 Advisory Lock 实现调度器 tick 循环的分布式互斥，防止多实例重复执行。
- **自包含调度循环**：服务内嵌后台 goroutine tick 循环（60s 间隔），无需外部 Cron 触发器。
- **Go 微服务蓝图**：作为 47 个 Go 微服务之一，采用标准四层架构（Handler → Service → Repository → PostgreSQL），使用 `go-common` 共享库。

**在 Orion 架构中的位置**：
- 属于基础设施层微服务（Go 微服务蓝图）
- 上游：`orion-platform-service`（触发定时任务）、用户手动操作（通过 API）
- 下游：`orion-frontend`（管理控制台）、内部任务执行器
- 对应平台单体实现中的 `CronSchedulerService` 和 `OnCallService`（`orion-platform-service/src/services/scheduler/`）

**与平台单体实现的差异**：
- **语言栈**：Go（微服务蓝图）vs TypeScript（平台单体）
- **分布式锁**：PostgreSQL Advisory Lock（Go）vs Redis SET NX（TypeScript）
- **Cron 解析**：自实现 5 字段解析器（Go）vs `cron-parser` 库（TypeScript）
- **降级模式**：Go 版无 In-memory 降级，始终依赖 PostgreSQL
- **OnCall schedule ID**：Go 版使用 `schedule_{timestamp}` 格式字符串主键 vs 平台 UUID

---

## 二、验收标准

### 2.1 Cron 任务管理

| 编号 | 验收标准 | 优先级 | 验证方式 |
|------|---------|--------|---------|
| ACC-01 | POST /api/v1/jobs 创建任务，必填字段校验（name, type），type 为 cron/once/interval，返回 201 + job 对象 | P0 | 集成测试 |
| ACC-02 | GET /api/v1/jobs 列出租户下所有任务，支持分页（page, page_size 默认 1/20，最大 100） | P0 | 集成测试 |
| ACC-03 | GET /api/v1/jobs/:id 查询单个任务详情，不存在返回 404 | P0 | 集成测试 |
| ACC-04 | PUT /api/v1/jobs/:id 更新任务（支持部分更新 name/description/cron_expr/interval_sec/max_runs/status） | P0 | 集成测试 |
| ACC-05 | DELETE /api/v1/jobs/:id 删除任务，不存在返回 404 | P0 | 集成测试 |
| ACC-06 | GET /api/v1/jobs/count 返回租户下任务总数 | P1 | 集成测试 |
| ACC-07 | POST /api/v1/jobs/:id/execute 手动触发任务执行，返回 JobRun 对象 | P0 | 集成测试 |
| ACC-08 | POST /api/v1/jobs/:id/pause 暂停活跃任务（active→paused），非活跃状态返回 400 | P0 | 集成测试 |
| ACC-09 | POST /api/v1/jobs/:id/resume 恢复暂停任务（paused→active），非暂停状态返回 400 | P0 | 集成测试 |
| ACC-10 | POST /api/v1/jobs/:id/disable 禁用任务（任何状态→disabled），已禁用返回 400 | P1 | 集成测试 |
| ACC-11 | GET /api/v1/jobs/:id/runs 获取任务执行历史，默认 limit=20 | P0 | 集成测试 |
| ACC-12 | GET /api/v1/jobs/runs/history 获取租户级执行历史，支持 ?job_id= 过滤，默认 limit=50 | P1 | 集成测试 |

### 2.2 值班排班管理

| 编号 | 验收标准 | 优先级 | 验证方式 |
|------|---------|--------|---------|
| ACC-13 | POST /api/v1/oncall/schedules 创建排班，必填字段 name/timezone/rotation_type/team_members(min=1)，返回 201 | P0 | 集成测试 |
| ACC-14 | GET /api/v1/oncall/schedules 列出租户下所有排班 | P0 | 集成测试 |
| ACC-15 | GET /api/v1/oncall/schedules/:id 查询排班详情，不存在返回 404 | P0 | 集成测试 |
| ACC-16 | DELETE /api/v1/oncall/schedules/:id 删除排班，级联清理 assignments 和 overrides，不存在返回 404 | P0 | 集成测试 |
| ACC-17 | GET /api/v1/oncall/schedules/:id/on-call 查询当前值班人员（Override 优先→Assignment→Fallback） | P0 | 集成测试 |
| ACC-18 | GET /api/v1/oncall/schedules/:id/assignments 获取排班的所有分配记录 | P1 | 集成测试 |
| ACC-19 | POST /api/v1/oncall/schedules/:id/overrides 创建代班，校验 original_user_id/override_user_id/start_time/end_time，end_time 须晚于 start_time | P0 | 集成测试 |

### 2.3 系统与安全

| 编号 | 验收标准 | 优先级 | 验证方式 |
|------|---------|--------|---------|
| ACC-20 | 所有写入操作（POST/PUT/DELETE）校验 JWT 权限，Jobs 使用 scheduler:write/delete/execute，Schedules 使用 scheduler:write/delete | P0 | 安全测试 |
| ACC-21 | 所有数据按 tenant_id 隔离，请求从 JWT claims 中提取 tenant_id | P0 | 集成测试 |
| ACC-22 | 健康检查端点 GET /healthz 返回 200 | P0 | 冒烟测试 |
| ACC-23 | 启动时自动执行 DB migration（migrations 目录存在时） | P0 | 冒烟测试 |
| ACC-24 | 输入校验失败时返回 400 + 具体错误信息 | P1 | 集成测试 |
| ACC-25 | 资源不存在时返回 404 + 语义化错误 | P1 | 集成测试 |
| ACC-26 | 调度器启动后后台 tick 循环每 60s 自动执行，检测到期任务并触发 | P1 | 集成测试 |
| ACC-27 | 调度器 tick 使用 PostgreSQL Advisory Lock 防多实例重复执行 | P1 | 集成测试 |
| ACC-28 | PaginatedRequest 分页参数默认值正确（page=1, page_size=20, max=100），小于 1 时重置为默认值 | P2 | 单元测试 |
| ACC-29 | JobStatus 常量正确：active/paused/disabled | P2 | 单元测试 |
| ACC-30 | JobType 常量正确：cron/once/interval | P2 | 单元测试 |

---

## 三、API 设计

### 3.1 端点总览

基础路径：`/api/v1`

#### Cron 任务管理

| 方法 | 路径 | 功能说明 | 请求参数 | 响应 | 权限 |
|------|------|---------|---------|------|------|
| POST | `/jobs` | 创建定时任务 | Body: `CreateJobRequest` | 201: `Job` | `scheduler:write` |
| GET | `/jobs` | 列出租户下所有任务 | Query: `?page=,page_size=` | 200: `{data: [Job]}` | 认证 |
| GET | `/jobs/count` | 获取任务总数 | - | 200: `{count: int}` | 认证 |
| GET | `/jobs/:id` | 获取单个任务详情 | Path: `id` | 200: `Job` | 认证 |
| PUT | `/jobs/:id` | 更新任务 | Path: `id`, Body: `UpdateJobRequest` | 200: `{message: "updated"}` | `scheduler:write` |
| DELETE | `/jobs/:id` | 删除任务 | Path: `id` | 200: `{message: "deleted"}` | `scheduler:delete` |
| POST | `/jobs/:id/execute` | 手动触发执行 | Path: `id` | 200: `JobRun` | `scheduler:execute` |
| POST | `/jobs/:id/pause` | 暂停任务 | Path: `id` | 200: `{message: "paused"}` | `scheduler:execute` |
| POST | `/jobs/:id/resume` | 恢复任务 | Path: `id` | 200: `{message: "resumed"}` | `scheduler:execute` |
| POST | `/jobs/:id/disable` | 禁用任务 | Path: `id` | 200: `{message: "disabled"}` | `scheduler:write` |
| GET | `/jobs/:id/runs` | 获取任务执行历史 | Path: `id`, Query: `?limit=` | 200: `{data: [JobRun]}` | 认证 |
| GET | `/jobs/runs/history` | 获取租户级执行历史 | Query: `?job_id=&limit=` | 200: `{data: [JobRun]}` | 认证 |

#### 值班排班管理

| 方法 | 路径 | 功能说明 | 请求参数 | 响应 | 权限 |
|------|------|---------|---------|------|------|
| POST | `/oncall/schedules` | 创建排班 | Body: `CreateScheduleRequest` | 201: `OnCallSchedule` | `scheduler:write` |
| GET | `/oncall/schedules` | 列出租户下所有排班 | - | 200: `{data: [OnCallSchedule]}` | 认证 |
| GET | `/oncall/schedules/:id` | 获取排班详情 | Path: `id` | 200: `OnCallSchedule` | 认证 |
| DELETE | `/oncall/schedules/:id` | 删除排班 | Path: `id` | 200: `{message: "deleted"}` | `scheduler:delete` |
| GET | `/oncall/schedules/:id/on-call` | 查询当前值班人员 | Path: `id` | 200: `OnCallCheckResult` | 认证 |
| GET | `/oncall/schedules/:id/assignments` | 获取排班的分配记录 | Path: `id` | 200: `{data: [OnCallAssignment]}` | 认证 |
| POST | `/oncall/schedules/:id/overrides` | 创建代班 | Path: `id`, Body: `CreateOverrideRequest` | 201: `OnCallOverride` | `scheduler:write` |

#### 系统

| 方法 | 路径 | 功能说明 | 权限 |
|------|------|---------|------|
| GET | `/healthz` | 健康检查 | 无 |

### 3.2 请求/响应示例

**创建定时任务**：

```bash
POST /api/v1/jobs
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "name": "每日数据清理",
  "description": "清理 30 天前的过期记录",
  "type": "cron",
  "cron_expr": "0 2 * * *",
  "max_runs": null
}
```

响应 (201)：

```json
{
  "id": "a1b2c3d4-...",
  "tenant_id": "t-123",
  "name": "每日数据清理",
  "description": "清理 30 天前的过期记录",
  "type": "cron",
  "cron_expr": "0 2 * * *",
  "interval_sec": null,
  "status": "active",
  "last_run_at": null,
  "next_run_at": "2026-07-03T02:00:00Z",
  "run_count": 0,
  "max_runs": null,
  "created_at": "2026-07-02T10:00:00Z",
  "updated_at": "2026-07-02T10:00:00Z"
}
```

**创建值班排班**：

```bash
POST /api/v1/oncall/schedules
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "name": "核心服务值班",
  "timezone": "Asia/Shanghai",
  "rotation_type": "weekly",
  "team_members": ["user-001", "user-002", "user-003"],
  "rotation_start_hour": 9,
  "escalations": [
    {"level": 1, "timeout_minutes": 15, "targets": ["user-001"]},
    {"level": 2, "timeout_minutes": 30, "targets": ["user-002"]}
  ]
}
```

响应 (201)：

```json
{
  "id": "schedule_1748858400000000000",
  "tenant_id": "t-123",
  "name": "核心服务值班",
  "timezone": "Asia/Shanghai",
  "rotation_type": "weekly",
  "rotation_start_hour": 9,
  "team_members": ["user-001", "user-002", "user-003"],
  "start_date": "2026-07-02T10:00:00Z",
  "end_date": null,
  "escalations": [
    {"level": 1, "timeout_minutes": 15, "targets": ["user-001"]},
    {"level": 2, "timeout_minutes": 30, "targets": ["user-002"]}
  ],
  "created_at": "2026-07-02T10:00:00Z",
  "updated_at": "2026-07-02T10:00:00Z"
}
```

**查询当前值班人员**：

```bash
GET /api/v1/oncall/schedules/schedule_1748858400000000000/on-call
Authorization: Bearer <jwt>
```

响应 (200)：

```json
{
  "is_on_call": true,
  "primary_user_id": "user-002",
  "escalation_targets": ["user-001", "user-003"]
}
```

**手动触发执行**：

```bash
POST /api/v1/jobs/a1b2c3d4-.../execute
Authorization: Bearer <jwt>
```

响应 (200)：

```json
{
  "id": "run-uuid-...",
  "job_id": "a1b2c3d4-...",
  "status": "success",
  "error": null,
  "started_at": "2026-07-02T10:05:00Z",
  "ended_at": "2026-07-02T10:05:00.150Z",
  "duration_ms": 150
}
```

---

## 四、数据模型

### 4.1 领域模型总览

```
┌──────────────────────────────────────────────────────────────┐
│                   调度器服务 (scheduler-svc-go)                │
│                                                              │
│  ┌─────────────────────────┐  ┌──────────────────────────┐   │
│  │   Cron 域                │  │   On-Call 域              │   │
│  │                          │  │                          │   │
│  │  Job ──── 1:N ──── JobRun│  │  OnCallSchedule          │   │
│  │                          │  │    ├── OnCallAssignment   │   │
│  │  状态: active /          │  │    ├── OnCallOverride     │   │
│  │        paused / disabled │  │    └── EscalationRule     │   │
│  │  类型: cron / once /     │  │                          │   │
│  │        interval          │  │  轮换: daily / weekly /   │   │
│  │                          │  │       monthly             │   │
│  └─────────────────────────┘  └──────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 Cron 任务表 (jobs)

对应数据库表 `jobs`（Migration 001）。

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK, DEFAULT gen_random_uuid() | 主键 |
| tenant_id | UUID | NOT NULL | 租户标识 |
| name | VARCHAR(255) | NOT NULL | 任务名称 |
| description | TEXT | NULL | 任务描述 |
| type | VARCHAR(50) | NOT NULL, DEFAULT 'cron' | 任务类型：cron/once/interval |
| cron_expr | VARCHAR(100) | NULL | Cron 表达式（5 字段），type=cron 时必填 |
| interval_sec | INT | NULL | 间隔秒数，type=interval 时必填 |
| status | VARCHAR(50) | NOT NULL, DEFAULT 'active' | 状态：active/paused/disabled |
| last_run_at | TIMESTAMPTZ | NULL | 上次执行时间 |
| next_run_at | TIMESTAMPTZ | NULL | 下次计划执行时间 |
| run_count | INT | NOT NULL, DEFAULT 0 | 累计执行次数 |
| max_runs | INT | NULL | 最大执行次数（nil 表示无限制） |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 更新时间 |

**索引**：

| 索引名 | 字段 | 类型 |
|--------|------|------|
| idx_jobs_tenant_id | tenant_id | B-tree |
| idx_jobs_status | status | B-tree |
| idx_jobs_next_run | next_run_at | 部分索引，WHERE status = 'active' |

### 4.3 任务执行记录表 (job_runs)

对应数据库表 `job_runs`（Migration 001）。

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK, DEFAULT gen_random_uuid() | 主键 |
| job_id | UUID | FK → jobs(id) ON DELETE CASCADE | 关联任务 |
| status | VARCHAR(50) | NOT NULL | 执行状态：running/success/failed |
| error | TEXT | NULL | 错误信息 |
| started_at | TIMESTAMPTZ | NOT NULL | 开始时间 |
| ended_at | TIMESTAMPTZ | NULL | 结束时间 |
| duration_ms | BIGINT | NOT NULL, DEFAULT 0 | 执行耗时（毫秒） |

**索引**：

| 索引名 | 字段 | 用途 |
|--------|------|------|
| idx_job_runs_job_id | job_id | 按任务查询执行历史 |

### 4.4 值班排班表 (oncall_schedules)

对应数据库表 `oncall_schedules`（Migration 001）。

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | VARCHAR(128) | PK | 排班标识（schedule_{timestamp}） |
| name | VARCHAR(255) | NOT NULL | 排班名称 |
| timezone | VARCHAR(64) | NOT NULL, DEFAULT 'UTC' | IANA 时区标识 |
| rotation_type | VARCHAR(20) | NOT NULL, DEFAULT 'daily' | 轮换类型：daily/weekly/monthly |
| rotation_start_hour | INT | NOT NULL, DEFAULT 9 | 轮换起始小时（0-23） |
| team_members | JSONB | NOT NULL, DEFAULT '[]' | 团队成员 ID 列表 |
| start_date | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 排班生效时间 |
| end_date | TIMESTAMPTZ | NULL | 排班结束时间 |
| escalations | JSONB | NOT NULL, DEFAULT '[]' | 升级规则数组 |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 更新时间 |

### 4.5 值班分配表 (oncall_assignments)

对应数据库表 `oncall_assignments`（Migration 001）。

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | VARCHAR(128) | PK | 分配标识（assign_{timestamp}_{index}） |
| schedule_id | VARCHAR(128) | FK → oncall_schedules(id) ON DELETE CASCADE | 所属排班 |
| user_id | VARCHAR(128) | NOT NULL | 值班人员 ID |
| start_time | TIMESTAMPTZ | NOT NULL | 值班起始 |
| end_time | TIMESTAMPTZ | NOT NULL | 值班截止 |

**索引**：

| 索引名 | 字段 | 用途 |
|--------|------|------|
| idx_oncall_assignments_schedule | schedule_id | 按排班查询 |
| idx_oncall_assignments_time | schedule_id, start_time, end_time | 时间窗口查询 |

### 4.6 代班覆盖表 (oncall_overrides)

对应数据库表 `oncall_overrides`（Migration 001）。

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | VARCHAR(128) | PK | 代班标识（override_{timestamp}） |
| schedule_id | VARCHAR(128) | FK → oncall_schedules(id) ON DELETE CASCADE | 所属排班 |
| original_user_id | VARCHAR(128) | NOT NULL | 原始值班人员 |
| override_user_id | VARCHAR(128) | NOT NULL | 代班人员 |
| start_time | TIMESTAMPTZ | NOT NULL | 代班起始 |
| end_time | TIMESTAMPTZ | NOT NULL | 代班截止 |
| reason | TEXT | NULL | 代班原因 |

**索引**：

| 索引名 | 字段 | 用途 |
|--------|------|------|
| idx_oncall_overrides_schedule | schedule_id | 按排班查询 |
| idx_oncall_overrides_time | schedule_id, start_time, end_time | 时间窗口查询 |

### 4.7 Go 结构体定义

```go
// ── Job Status ──
type JobStatus string
const (
    JobActive   JobStatus = "active"
    JobPaused   JobStatus = "paused"
    JobDisabled JobStatus = "disabled"
)

// ── Job Type ──
type JobType string
const (
    JobTypeCron     JobType = "cron"
    JobTypeOnce     JobType = "once"
    JobTypeInterval JobType = "interval"
)

// ── Job ──
type Job struct {
    ID          string     `db:"id" json:"id"`
    TenantID    string     `db:"tenant_id" json:"tenant_id"`
    Name        string     `db:"name" json:"name"`
    Description string     `db:"description" json:"description"`
    Type        JobType    `db:"type" json:"type"`
    CronExpr    *string    `db:"cron_expr" json:"cron_expr,omitempty"`
    IntervalSec *int       `db:"interval_sec" json:"interval_sec,omitempty"`
    Status      JobStatus  `db:"status" json:"status"`
    LastRunAt   *time.Time `db:"last_run_at" json:"last_run_at,omitempty"`
    NextRunAt   *time.Time `db:"next_run_at" json:"next_run_at,omitempty"`
    RunCount    int        `db:"run_count" json:"run_count"`
    MaxRuns     *int       `db:"max_runs" json:"max_runs,omitempty"`
    CreatedAt   time.Time  `db:"created_at" json:"created_at"`
    UpdatedAt   time.Time  `db:"updated_at" json:"updated_at"`
}

// ── JobRun ──
type JobRun struct {
    ID         string     `db:"id" json:"id"`
    JobID      string     `db:"job_id" json:"job_id"`
    Status     string     `db:"status" json:"status"`
    Error      *string    `db:"error" json:"error,omitempty"`
    StartedAt  time.Time  `db:"started_at" json:"started_at"`
    EndedAt    *time.Time `db:"ended_at" json:"ended_at,omitempty"`
    DurationMs int64      `db:"duration_ms" json:"duration_ms"`
}

// ── On-Call Schedule ──
type OnCallSchedule struct {
    ID                string           `db:"id" json:"id"`
    TenantID          string           `db:"tenant_id" json:"tenant_id"`
    Name              string           `db:"name" json:"name"`
    Timezone          string           `db:"timezone" json:"timezone"`
    RotationType      RotationType     `db:"rotation_type" json:"rotation_type"`
    RotationStartHour int              `db:"rotation_start_hour" json:"rotation_start_hour"`
    TeamMembers       []string         `db:"team_members" json:"team_members"`
    StartDate         time.Time        `db:"start_date" json:"start_date"`
    EndDate           *time.Time       `db:"end_date" json:"end_date,omitempty"`
    Escalations       []EscalationRule `db:"escalations" json:"escalations"`
    CreatedAt         time.Time        `db:"created_at" json:"created_at"`
    UpdatedAt         time.Time        `db:"updated_at" json:"updated_at"`
}

// ── EscalationRule ──
type EscalationRule struct {
    Level          int      `json:"level"`
    TimeoutMinutes int      `json:"timeout_minutes"`
    Targets        []string `json:"targets"`
}

// ── OnCallAssignment ──
type OnCallAssignment struct {
    ID         string    `db:"id" json:"id"`
    TenantID   string    `db:"tenant_id" json:"tenant_id"`
    ScheduleID string    `db:"schedule_id" json:"schedule_id"`
    UserID     string    `db:"user_id" json:"user_id"`
    StartTime  time.Time `db:"start_time" json:"start_time"`
    EndTime    time.Time `db:"end_time" json:"end_time"`
}

// ── OnCallOverride ──
type OnCallOverride struct {
    ID             string     `db:"id" json:"id"`
    TenantID       string     `db:"tenant_id" json:"tenant_id"`
    ScheduleID     string     `db:"schedule_id" json:"schedule_id"`
    OriginalUserID string     `db:"original_user_id" json:"original_user_id"`
    OverrideUserID string     `db:"override_user_id" json:"override_user_id"`
    StartTime      time.Time  `db:"start_time" json:"start_time"`
    EndTime        time.Time  `db:"end_time" json:"end_time"`
    Reason         *string    `db:"reason" json:"reason,omitempty"`
}

// ── OnCallCheckResult ──
type OnCallCheckResult struct {
    IsOnCall          bool     `json:"is_on_call"`
    PrimaryUserID     *string  `json:"primary_user_id,omitempty"`
    EscalationTargets []string `json:"escalation_targets,omitempty"`
}
```

---

## 五、架构设计

### 5.1 四层架构

```
┌──────────────────────────────────────────────────────────────────────┐
│                       cmd/server/main.go                             │
│  Config Load → DB Connect → Migration → Wire DI → Start Tick → Gin  │
└──┬──────────────────────────────┬──────────────────────────┬─────────┘
   │                              │                          │
   ▼                              ▼                          ▼
┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐
│  Handler Layer     │  │  Handler Layer     │  │  Handler Layer     │
│  handler.go        │  │  handler.go        │  │  handler.go        │
│  ─ Job CRUD       │  │  ─ OnCall CRUD     │  │  ─ System          │
│  ─ Execute/Pause  │  │  ─ CurrentOnCall   │  │  ─ Healthz         │
│  ─ Resume/Disable │  │  ─ Assignments     │  │                    │
│  ─ History        │  │  ─ Overrides       │  │                    │
└────────┬───────────┘  └────────┬───────────┘  └────────────────────┘
         │                       │
         ▼                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        Service Layer                                 │
│  ┌──────────────────────────────────────────────────────┐           │
│  │  SchedulerService                                     │           │
│  │  ├── Job CRUD (Create / GetByID / List / Update /    │           │
│  │  │             Delete / Count)                       │           │
│  │  ├── Status transitions (Pause / Resume / Disable)   │           │
│  │  ├── Execution (ExecuteJob / RecordRun)              │           │
│  │  ├── Tick loop (Start / Stop / tick)                 │           │
│  │  └── Cron computation (computeNextRun / NextCronTime)│           │
│  ├──────────────────────────────────────────────────────┤           │
│  │  OnCallService                                        │           │
│  │  ├── Schedule CRUD (Create / List / Get / Delete)    │           │
│  │  ├── Current on-call resolution (Override→Assign→FB) │           │
│  │  ├── Override management (CreateOverride)            │           │
│  │  ├── Assignment generation (generateAssignments)     │           │
│  │  └── Escalation target computation                   │           │
│  ├──────────────────────────────────────────────────────┤           │
│  │  DistributedLockService                               │           │
│  │  ├── AcquireLock (with retry)                        │           │
│  │  ├── ReleaseLock                                     │           │
│  │  └── ExecuteWithLock (template method)               │           │
│  └──────────────────────────────────────────────────────┘           │
└────────────────────────┬─────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     Repository Layer                                 │
│  SchedulerRepository                                                 │
│  ├── Jobs: CreateJob / GetJobByID / ListJobs / UpdateJob /          │
│  │         UpdateJobStatus / UpdateJobNextRun / UpdateJobRunInfo /  │
│  │         Delete / Count / FindJobsDueForExecution /               │
│  │         GetDistinctTenantIDs                                     │
│  ├── JobRuns: CreateJobRun / CompleteJobRun / GetJobRuns /          │
│  │           GetExecutionHistory                                    │
│  ├── Schedules: CreateSchedule / ListSchedules / GetScheduleByID /  │
│  │             DeleteSchedule                                       │
│  ├── Assignments: CreateAssignment / FindActiveAssignment /         │
│  │               ListAssignments / DeleteAssignmentsByScheduleID    │
│  ├── Overrides: CreateOverride / FindActiveOverride /               │
│  │              DeleteOverridesByScheduleID                         │
│  └── Locks: AcquireAdvisoryLock / ReleaseAdvisoryLock              │
└────────────────────────┬─────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     PostgreSQL                                       │
│  Tables: jobs, job_runs, oncall_schedules, oncall_assignments,      │
│          oncall_overrides                                           │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.2 请求链路

```
创建定时任务:
  POST /api/v1/jobs
  → auth.Auth(JWT 校验 + tenant_id 提取)
    → auth.RequirePermission("scheduler", "write")
      → handler.CreateJob()
        → schedulerSvc.CreateJob(ctx, &job)
          → job.Status default = "active"
          → computeNextRun(job) 计算首次执行时间
          → repo.CreateJob(ctx, j) INSERT INTO jobs ...

查询当前值班人员:
  GET /api/v1/oncall/schedules/:id/on-call
  → auth.Auth(JWT 校验 + tenant_id 提取)
    → handler.GetCurrentOnCall()
      → onCallSvc.GetCurrentOnCall(ctx, tenantID, scheduleID)
        1. repo.FindActiveOverride(scheduleID, now)  ← 检查代班
        2. 未命中 → repo.FindActiveAssignment(scheduleID, now)  ← 检查分配
        3. 未命中 → 返回 teamMembers[0] 作为 fallback
        4. 计算 escalationTargets(除当前值班外其他成员)
      → 返回 OnCallCheckResult
```

### 5.3 调度器 Tick 循环

```
schedulerSvc.Start(ctx)
  → 创建 ticker (60s 间隔)
  → 启动 goroutine:
    → 立即执行第一次 tick
    → 循环:
      select {
        case <-ticker.C:  → tick()
        case <-done:      return
        case <-ctx.Done(): return
      }

tick():
  1. AcquireAdvisoryLock("scheduler_tick")  ← 分布式互斥
  2. 未获取到锁 → 跳过（其他实例在执行）
  3. 获取到锁:
    a. GetDistinctTenantIDs()  ← 获取所有有活跃任务的租户
    b. 对每个租户:
      i.   FindJobsDueForExecution(tenantID, now)  ← 查询应执行的任务
      ii.  对每个到期任务:
        - executeTask(job)  ← 执行任务（当前为占位实现，仅日志）
        - RecordRun(ctx, tenantID, jobID, status, ...)  ← 记录执行
        - computeNextRun(job)  ← 计算下次执行时间
        - repo.UpdateJobNextRun(...)  ← 持久化下次执行时间
  4. ReleaseAdvisoryLock("scheduler_tick")
```

### 5.4 值班排班轮换算法

**排班生成 (generateAssignments)**：

创建排班时，自动按轮换类型生成所有团队成员的 Assignment 记录：

```
输入: teamMembers = [U1, U2, U3], rotationType = weekly
输出:
  Assignment[0]: U1, [2026-07-02T09:00:00, 2026-07-09T09:00:00)
  Assignment[1]: U2, [2026-07-09T09:00:00, 2026-07-16T09:00:00)
  Assignment[2]: U3, [2026-07-16T09:00:00, 2026-07-23T09:00:00)
```

轮换周期持续时间：
- `daily` → `start + 1 day`
- `weekly` → `start + 7 days`
- `monthly` → `start + 1 month`

**当前值班人员查询 (GetCurrentOnCall)**——三段式优先级判定：

```
1. Override 优先: FindActiveOverride(scheduleID, now)
   → 有活跃代班? → 返回 overrideUserID
2. Assignment 覆盖: FindActiveAssignment(scheduleID, now)
   → 有活跃分配? → 返回 userID
3. Fallback: 返回 teamMembers[0], isOnCall=false
```

### 5.5 分布式锁机制

使用 PostgreSQL 原生 Advisory Lock 实现分布式互斥：

| 方法 | 说明 |
|------|------|
| `AcquireAdvisoryLock(key)` | 调用 `pg_try_advisory_lock(hashKey)` 非阻塞尝试加锁 |
| `ReleaseAdvisoryLock(key)` | 调用 `pg_advisory_unlock(hashKey)` 释放锁 |
| `hashStringToInt64(key)` | 将字符串 key 哈希为 int64（FNV-1a 风格哈希） |

锁使用场景：
- **Scheduler tick**: tick 循环尝试获取 `"scheduler_tick"` 锁，防止多实例重复调度
- **DistributedLockService**: 通用模板方法 `ExecuteWithLock`，支持重试（默认 3 次，间隔 1s）

> 注意：当前 DistributedLockService 的 `AcquireLock` 仅为通用封装，**未直接集成到 ExecuteJob 方法中**。生产环境应在执行关键任务时通过 `ExecuteWithLock` 防止重复执行。

---

## 六、技术栈

| 层级 | 技术 |
|------|------|
| HTTP 框架 | Gin v1.10 |
| 数据库驱动 | jmoiron/sqlx + lib/pq (PostgreSQL) |
| 数据库 | PostgreSQL (通过 go-common database 包) |
| 缓存/锁 | PostgreSQL Advisory Lock（内置）+ Redis（通过 go-common redis 包，用于 JWT token 验证） |
| 配置管理 | spf13/viper（环境变量驱动） |
| 日志 | go.uber.org/zap（通过 go-common logger 包） |
| 认证 | go-common auth 包（JWT + Redis 校验，全局中间件 + 细粒度权限） |
| 中间件 | go-common: Recovery, RequestID, StructuredLogger, CORS, HealthCheck |
| 编译 | Go 1.25 |
| 测试 | Go 标准 testing 包 |

---

## 七、配置项

通过环境变量加载，默认值由 viper 管理：

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| `SERVER_PORT` | `8087` | HTTP 服务端口 |
| `DB_HOST` | `localhost` | PostgreSQL 主机 |
| `DB_PORT` | `5432` | PostgreSQL 端口 |
| `DB_USER` | `postgres` | 数据库用户 |
| `DB_PASSWORD` | `postgres` | 数据库密码 |
| `DB_NAME` | `orion_scheduler` | 数据库名 |
| `DB_SSL_MODE` | `disable` | SSL 模式 |
| `JWT_SECRET` | - | JWT 签名密钥（必需） |
| `REDIS_ADDR` | - | Redis 地址（用于 JWT token 校验） |

---

## 八、项目结构

```
orion-scheduler-svc-go/
├── cmd/
│   └── server/
│       └── main.go                    # 入口：配置加载、DB 连接、Migration、DI 注入、Gin 启动
├── internal/
│   ├── config/
│   │   └── config.go                  # 配置定义与加载（viper + 环境变量）
│   ├── models/
│   │   ├── models.go                  # 领域模型、DTO、请求/响应结构体
│   │   └── models_test.go             # 模型单元测试
│   ├── repository/
│   │   └── scheduler_repository.go    # 数据访问层（全部 SQL 操作）
│   ├── service/
│   │   ├── scheduler_service.go       # 业务逻辑层（SchedulerService + OnCallService + DistributedLockService + Cron Parser）
│   │   └── service_test.go            # 服务层单元测试
│   └── handler/
│       └── handler.go                 # HTTP Handler + 路由注册
├── migrations/
│   └── 001_create_scheduler_tables.sql  # DDL（5 张表 + 索引）
└── go.mod                             # Go module 定义 (orion/scheduler-svc-go)
```

---

## 九、集成点

### 9.1 go-common 共享库

使用 `orion/go-common` 包提供基础设施能力：

| 包 | 用途 |
|----|------|
| `auth` | JWT 认证中间件 + 细粒度权限校验（`RequirePermission`） |
| `database` | PostgreSQL 连接管理 + Migration 自动执行 |
| `redis` | Redis 客户端（当前用于 JWT token 验证） |
| `logger` | 基于 zap 的结构化日志 |
| `middleware` | Recovery / RequestID / StructuredLogger / CORS / HealthCheck |

### 9.2 Cron 自实现解析器

与平台单体使用 `cron-parser` 库不同，Go 版实现了自包含的 5 字段 Cron 表达式解析：

**支持的语法**：

| 语法 | 示例 | 说明 |
|------|------|------|
| `*` | `* * * * *` | 每分钟 |
| `N` | `0 2 * * *` | 每天凌晨 2:00 |
| `N,M` | `0,30 * * * *` | 每小时的 0 分和 30 分 |
| `N-M` | `0 9-17 * * 1-5` | 工作日 9-17 点整点 |
| `*/N` | `*/5 * * * *` | 每 5 分钟 |
| `N-M/S` | `0 9-17/2 * * *` | 9-17 点每 2 小时 |
| 组合 | `0,15,30,45 * * * *` | 每刻钟 |

**算法**：从当前时间 +1 分钟开始，以分钟为步长向前搜索，最长 2 年搜索窗口。5 个字段全部匹配时返回该时间。

### 9.3 OnCall 升级规则集成

`GetCurrentOnCall` 计算结果可用于告警路由和事故升级：

```
告警触发
  → AlertService 调用 GET /oncall/schedules/:id/on-call
    → 返回 primaryUserId + escalationTargets
  → 通知 primaryUserId
  → 超时未响应 → 逐级通知 escalationTargets
```

当前 `getEscalationTargets` 简单返回团队中除当前值班外的所有成员。生产环境应结合 `EscalationRule.level` 和 `timeoutMinutes` 实现精确逐级升级。

### 9.4 Cron 任务与 OnCall 的关系

两个子域共享同一服务进程和数据库实例，但代码层面相互独立。Cron 任务可作为 OnCall 轮换的触发源（如定时生成未来 Assignment），当前尚未实现此连接。

### 9.5 前端集成

对应前端页面：

| 前端页面 | 功能 |
|---------|------|
| `orion-frontend/src/pages/CronManagement/` | Cron 任务管理（列表/创建/编辑/执行/历史） |
| `orion-frontend/src/pages/OnCall/` | 值班排班管理（列表/创建/代班/详情） |

---

## 十、状态转移

### 10.1 Cron Job 状态转移

```
        ┌──────────┐
        │  创建     │
        └────┬─────┘
             │ 默认 active
             ▼
     ┌───────────────┐
     │   active      │◄────────────┐
     └───┬───┬───┬───┘             │
         │   │   │                 │
  pause  │   │   │ disable         │ resume
         ▼   │   ▼                 │
  ┌────────┐ │ ┌──────────┐        │
  │ paused │ │ │ disabled │        │
  └───┬────┘ │ └──────────┘        │
      │      │                     │
      │      │ delete              │
      │      ▼                     │
      │  ┌──────────┐              │
      └─▶│  deleted  │             │
         └──────────┘              │
     resume                        │
     └─────────────────────────────┘
```

| 当前状态 | 可执行操作 |
|---------|-----------|
| active | pause, disable, execute, update, delete |
| paused | resume, disable, update, delete |
| disabled | delete（仅删除，不可恢复） |

### 10.2 JobRun 执行生命周期

```
        手动执行 / 调度器 Tick
                │
                ▼
          ┌─────────┐
          │ running │
          └────┬────┘
               │
       ┌───────┴───────┐
       │               │
       ▼               ▼
  ┌─────────┐     ┌──────────┐
  │ success │     │  failed  │
  └─────────┘     └──────────┘
       │               │
       ▼               ▼
  更新 job:       更新 job:
  last_run_at     last_run_at
  run_count++     last_error
  computeNextRun
```

---

## 十一、测试覆盖

| 测试文件 | 类型 | 覆盖内容 |
|---------|------|---------|
| `internal/models/models_test.go` | 单元测试 | Job 字段验证、JobStatus/JobType 常量、JobRun 字段、CreateJobRequest 字段、PaginatedRequest 默认值 |
| `internal/service/service_test.go` | 单元测试 | Service 层错误常量（ErrJobNotFound、ErrInvalidStatus） |

**当前测试覆盖不足**（已知差距）：
- 缺少 Repository 层集成测试（需 PostgreSQL 测试实例）
- 缺少 Handler 层 HTTP 测试
- 缺少 SchedulerService 的 CreateJob/PauseJob/ResumeJob/ExecuteJob 业务逻辑测试
- 缺少 OnCallService 的轮换算法和 Override 优先级测试
- 缺少 Cron 解析器单元测试（parseCronField / NextCronTime）

---

## 十二、已知局限与未来增强

### 12.1 已知局限

| 编号 | 局限 | 影响 | 建议修复时间 |
|------|------|------|------------|
| L-01 | `executeTask()` 为占位实现，仅打印日志不执行实际任务 | 任务执行无实际效果 | 短期 |
| L-02 | Assignment 仅在 `createSchedule` 时生成一轮，不会自动续期 | 超过 teamMembers 数量周期的排班无匹配 | 中期 |
| L-03 | 缺少 OnCall 排班的 Update/PATCH 端点 | 排班创建后无法编辑 | 中期 |
| L-04 | 缺少 OnCall Override 的列表/删除查询端点 | 无法审计代班历史 | 中期 |
| L-05 | `DistributedLockService.AcquireLock` 未集成到 `ExecuteJob` | 手动执行无法防重复 | 短期 |
| L-06 | 未检查 `max_runs` 上限（Job 模型有字段但未在 ExecuteJob 中校验） | 有限次任务可能超额执行 | 短期 |

### 12.2 未来增强

| 优先级 | 增强项 | 说明 |
|--------|--------|------|
| P0 | **任务执行器注册表** | 实现 handler 注册分发机制，替代当前空实现 |
| P0 | **max_runs 执行上限校验** | ExecuteJob 前检查 run_count >= max_runs 时拒绝执行 |
| P0 | **ExecuteLock 集成** | ExecuteJob 中调用 DistributedLockService.ExecuteWithLock |
| P1 | **Assignment 自动续期** | 添加定时任务定期生成未来排班 |
| P1 | **OnCall Schedule Update** | 补充 PUT/PATCH 端点 |
| P1 | **Override 列表查询** | 补充 GET /oncall/schedules/:id/overrides 端点 |
| P1 | **Job 类型验证增强** | type=cron 时 cron_expr 必填，type=interval 时 interval_sec 必填 |
| P1 | **执行重试机制** | 失败任务自动重试（可配置次数和退避策略） |
| P2 | **超时控制** | 任务执行超时自动终止 |
| P2 | **Cron 预检查** | 创建任务时展示未来 N 次计划执行时间 |
| P2 | **排班日历视图** | 前端增加日历可视化展示轮换时间线 |
| P2 | **通知集成** | 轮换切换时自动发送通 |
| P2 | **重叠检测** | 创建代班时检测时间重叠并拒绝 |

---

## 附录

### A. 相关文件索引

| 文件 | 路径 |
|------|------|
| 主入口 | `orion-scheduler-svc-go/cmd/server/main.go` |
| 配置 | `orion-scheduler-svc-go/internal/config/config.go` |
| 数据模型 | `orion-scheduler-svc-go/internal/models/models.go` |
| 数据模型测试 | `orion-scheduler-svc-go/internal/models/models_test.go` |
| 仓库层 | `orion-scheduler-svc-go/internal/repository/scheduler_repository.go` |
| 服务层 | `orion-scheduler-svc-go/internal/service/scheduler_service.go` |
| 服务层测试 | `orion-scheduler-svc-go/internal/service/service_test.go` |
| HTTP Handler | `orion-scheduler-svc-go/internal/handler/handler.go` |
| DB Migration | `orion-scheduler-svc-go/migrations/001_create_scheduler_tables.sql` |
| 模块定义 | `orion-scheduler-svc-go/go.mod` |
| 平台 Cron 设计文档 | `docs/services/cron-scheduler-design.md` |
| 平台 OnCall 设计文档 | `docs/services/oncall-scheduling-design.md` |
| 平台 Cron 服务实现 | `orion-platform-service/src/services/scheduler/CronSchedulerService.ts` |
| 平台 OnCall 服务实现 | `orion-platform-service/src/services/scheduler/OnCallService.ts` |

### B. 依赖清单

| 依赖 | 版本 | 用途 |
|------|------|------|
| `github.com/gin-gonic/gin` | v1.10.0 | HTTP 路由框架 |
| `github.com/jmoiron/sqlx` | v1.4.0 | SQL 扩展库 |
| `github.com/spf13/viper` | v1.19.0 | 配置管理 |
| `orion/go-common` | v0.0.0 | 共享库（auth/database/redis/logger/middleware） |
| `github.com/lib/pq` | v1.10.9 | PostgreSQL 驱动 |

### C. 错误码速查

| 错误 | HTTP 状态码 | 触发条件 |
|------|------------|---------|
| `job not found` | 404 | GetJobByID/UpdateJob/DeleteJob/PauseJob/ResumeJob/DisableJob/ExecuteJob 时任务不存在 |
| `invalid status transition` | 500 | PauseJob(非 active)/ResumeJob(非 paused)/DisableJob(已 disabled) |
| `schedule not found` | 404 | GetSchedule/DeleteSchedule 时排班不存在 |
| `validation error` | 500 | CreateSchedule 时 name/team_members 为空 |
| `could not acquire lock` | 500 | AcquireLock 重试后仍失败 |
| `end_time must be after start_time` | 400 | CreateOverride 时时间范围无效 |
| 输入校验错误 | 400 | ShouldBindJSON 失败（缺失必填字段/类型错误） |

### D. 与平台单体实现的差异对照

| 维度 | Go 微服务 (scheduler-svc-go) | 平台单体 (platform-service) |
|------|---------------------------|---------------------------|
| 语言 | Go 1.25 | TypeScript (Node.js) |
| HTTP 框架 | Gin | Fastify |
| ORM/DB 库 | sqlx | TypeORM / BaseRepository |
| Cron 解析器 | 自实现 (5 字段解析器) | cron-parser 库 |
| 分布式锁 | PostgreSQL Advisory Lock | Redis SET NX |
| 降级模式 | 无 (始终 PostgreSQL) | In-memory Map 降级 |
| OnCall ID 格式 | `schedule_{nano}` 字符串 | UUID |
| 多实例调度锁 | pg_try_advisory_lock | Redis 锁 |
| 端口 | 8087 | 3001 (平台单体) |
| 测试覆盖 | 基础常量/模型测试 | 较完整单元测试 + Repository 测试 |
