# S12 定时任务调度管理（Cron Scheduler）设计文档

| 字段 | 内容 |
|------|------|
| **模块编号** | S12 |
| **模块名称** | Cron Scheduler Management（定时任务调度管理） |
| **路由前缀** | `/api/v1/cron` |
| **服务层** | `CronSchedulerService` + `DistributedLockService` |
| **前端页面** | `/console/cron` — `CronManagement` |
| **状态** | 已实现（PostgreSQL 持久化 + In-memory 降级） |
| **最后更新** | 2026-05-15 |

---

## 1. 模块概述

S12 定时任务调度管理模块为 Orion 平台提供**分布式 Cron 定时任务调度**能力，用于支持周期性运维操作、数据清理、报告生成、Pipeline 触发等场景。

### 1.1 设计目标

- 提供标准 5 字段 Cron 表达式（`minute hour day month weekday`）解析与校验
- 支持定时任务的完整 CRUD 生命周期管理
- 多实例部署下通过**分布式锁**防止重复执行
- 完整的执行历史记录与状态追踪
- 同时支持 PostgreSQL 持久化与无数据库环境下的 In-memory 降级模式

### 1.2 核心功能

| 功能 | 说明 |
|------|------|
| Cron Job CRUD | 创建、查询、更新、删除定时任务 |
| 任务启用/禁用 | 动态控制任务是否参与调度 |
| 手动执行 | 绕过调度计划立即触发任务执行 |
| Cron 表达式校验 | 基于 `cron-parser` 库进行实时验证 |
| 执行历史 | 记录每次执行的起止时间、状态、输出与错误信息 |
| 运行状态 | 实时查看正在执行的任务列表 |
| 分布式锁 | 防止多实例部署下同一任务重复执行 |

---

## 2. 架构设计

### 2.1 分层架构

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (React)                     │
│  CronManagement ─── api/cron.ts ───→ /api/v1/cron/*     │
└────────────────────────────┬────────────────────────────┘
                             │ HTTP
┌────────────────────────────▼────────────────────────────┐
│              API Routes (Fastify)                        │
│  cron-routes.ts — 15 个端点                              │
└────────────────────────────┬────────────────────────────┘
                             │ 直接调用
┌────────────────────────────▼────────────────────────────┐
│            CronSchedulerService                          │
│  ├── Job CRUD (addJob / getJobs / removeJob)            │
│  ├── 调度循环 (60s tick → checkAndExecuteJobs)           │
│  ├── 执行引擎 (runJob → executeTask)                     │
│  └── Cron 表达式解析 (cron-parser)                       │
└──────┬──────────────────────────────┬───────────────────┘
       │ 直接调用                     │ 直接调用
┌──────▼──────────────┐  ┌───────────▼───────────────────┐
│  CronJobRepository   │  │ CronExecutionRepository       │
│  (PostgreSQL)        │  │ (PostgreSQL)                  │
│                      │  │                               │
│  In-memory fallback  │  │ In-memory fallback            │
└──────────────────────┘  └───────────────────────────────┘
       │
       │ 依赖（预留）
┌──────▼──────────────┐
│ DistributedLockService│
│  ├── acquireLock     │
│  ├── releaseLock     │
│  ├── tryLock         │
│  ├── renewLock       │
│  └── executeWithLock │
│                      │
│  Redis (生产环境)     │
│  Mock Redis (测试)   │
└──────────────────────┘
```

### 2.2 数据流

```
创建任务 → POST /jobs → CronSchedulerService.addJob()
                                      │
                          ┌───────────▼────────────┐
                          │  1. cron-parser 校验    │
                          │  2. 计算 nextRunAt      │
                          │  3. CronJobRepository   │
                          │     .create() (fire-and-│
                          │     forget)              │
                          │  4. 写入内存 jobs Map    │
                          └────────────────────────┘

调度循环 → 每 60s tick → checkAndExecuteJobs()
                          │
              ┌───────────▼────────────┐
              │ 1. 获取所有 enabled job │
              │ 2. shouldExecuteJob()   │
              │    - cron-parser.prev() │
              │    - diff < 65s 则执行  │
              │ 3. runJob()             │
              │    - 创建执行记录        │
              │    - 执行任务            │
              │    - 更新 lastRunAt     │
              │    - 更新 nextRunAt     │
              └────────────────────────┘
```

---

## 3. Cron 表达式解析与校验

### 3.1 表达式格式

采用标准 5 字段 Cron 表达式：

```
┌──────────── 分钟 (0 - 59)
│ ┌────────── 小时 (0 - 23)
│ │ ┌──────── 日期 (1 - 31)
│ │ │ ┌────── 月份 (1 - 12)
│ │ │ │ ┌──── 星期 (0 - 7, 0 和 7 均为周日)
│ │ │ │ │
* * * * *
```

### 3.2 解析引擎

使用 `cron-parser` 库进行表达式解析，关键特性：

| 特性 | 说明 |
|------|------|
| 时区 | 固定使用 `UTC` 时区（`tz: 'UTC'`） |
| 校验时机 | `addJob()` 时调用 `CronExpressionParser.parse()` 进行严格校验 |
| 下次执行时间 | `computeNextRun()` 通过 `interval.next()` 计算 |
| 调度判定 | `shouldExecuteJob()` 通过 `interval.prev()` 反推上一次计划时间 |

### 3.3 调度判定算法

```typescript
shouldExecuteJob(job, now):
  1. 使用 cron-parser 解析表达式，以 now 为当前时间
  2. 调用 interval.prev() 获取上一次计划触发时间
  3. 计算 now - prev 的时间差
  4. 若差值 < DEFAULT_TICK_MS + 5000ms (即 65s)，则执行
```

**设计理由**：由于采用轮询模式（非精确定时器），需要在 tick 窗口内（60s ± 5s 容差）判断是否需要触发，而非精确匹配某一秒。

### 3.4 支持的表达式语法

| 语法 | 示例 | 说明 |
|------|------|------|
| 单值 | `0 2 * * *` | 每天凌晨 2:00 |
| 逗号 | `0,30 * * * *` | 每小时的 0 分和 30 分 |
| 范围 | `0 9-17 * * 1-5` | 工作日 9-17 点整点 |
| 步长 | `*/5 * * * *` | 每 5 分钟 |
| 步长+范围 | `0 9-17/2 * * *` | 9-17 点每 2 小时 |

---

## 4. 分布式锁机制

### 4.1 设计目的

在多实例部署环境下，同一 Cron 任务可能在多个服务实例的同一 tick 中被判定为"需要执行"，分布式锁确保**同一任务在同一时刻仅由一个实例执行**。

### 4.2 锁实现

```
Redis SET NX + EX 原子操作
```

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `ttl` | 30,000ms | 锁自动过期时间，防止死锁 |
| `retryCount` | 3 | 获取锁失败后的重试次数 |
| `retryDelay` | 1,000ms | 重试间隔 |

### 4.3 核心方法

| 方法 | 说明 | 返回值 |
|------|------|--------|
| `acquireLock(key, options)` | 带重试的阻塞式加锁 | `Promise<Lock>` |
| `tryLock(key, ttl?)` | 非阻塞式尝试加锁 | `Promise<Lock \| null>` |
| `releaseLock(key, value)` | 通过 Lua 脚本原子释放锁 | `Promise<void>` |
| `renewLock(lock, ttl?)` | 锁续期 | `Promise<void>` |
| `isLocked(key)` | 检查锁是否存在 | `Promise<boolean>` |
| `getLockInfo(key)` | 获取锁信息（含 TTL） | `Promise<{exists, ttl}>` |
| `executeWithLock(key, op, opts)` | 带锁的执行模板方法 | `Promise<T>` |

### 4.4 锁释放安全

使用 Lua 脚本确保只有锁的持有者才能释放锁：

```lua
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
```

### 4.5 降级策略

当 Redis 不可用时，`DistributedLockService` 自动降级为 Mock Redis 客户端（基于 `Map` 的内存实现），确保测试环境和单实例部署正常工作。

> **注意**：当前 `CronSchedulerService` 的 `runJob()` 尚未集成 `DistributedLockService`，这是已知的待完善项。

---

## 5. API 端点

路由前缀：`/api/v1/cron`

### 5.1 Cron Job 管理

| 方法 | 路径 | 说明 | 状态码 |
|------|------|------|--------|
| `POST` | `/jobs` | 创建定时任务 | 201 / 400 |
| `GET` | `/jobs` | 获取所有定时任务列表 | 200 |
| `GET` | `/jobs/:id` | 获取单个定时任务详情 | 200 / 404 |
| `PUT` | `/jobs/:id` | 更新定时任务 | 200 / 404 |
| `DELETE` | `/jobs/:id` | 删除定时任务 | 200 |
| `POST` | `/jobs/:id/enable` | 启用定时任务 | 200 |
| `POST` | `/jobs/:id/disable` | 禁用定时任务 | 200 |

### 5.2 执行控制

| 方法 | 路径 | 说明 | 状态码 |
|------|------|------|--------|
| `POST` | `/jobs/:id/execute` | 手动触发执行 | 200 / 500 |
| `GET` | `/executions` | 获取执行历史（可选 `?jobId=` 过滤） | 200 |
| `GET` | `/executions/:executionId` | 获取单次执行详情 | 200 / 404 |
| `GET` | `/running` | 获取正在运行的任务 ID 列表 | 200 |

### 5.3 调度器控制

| 方法 | 路径 | 说明 | 状态码 |
|------|------|------|--------|
| `GET` | `/status` | 获取调度器状态 | 200 |
| `POST` | `/start` | 启动调度器 | 200 |
| `POST` | `/stop` | 停止调度器 | 200 |

### 5.4 请求/响应示例

**创建定时任务**

```bash
POST /api/v1/cron/jobs
Content-Type: application/json

{
  "id": "daily-cleanup",
  "name": "每日数据清理",
  "schedule": "0 2 * * *",
  "task": "data-cleanup",
  "enabled": true
}
```

```json
{
  "success": true,
  "message": "Cron job added successfully",
  "data": { "jobId": "daily-cleanup" }
}
```

**获取调度器状态**

```bash
GET /api/v1/cron/status
```

```json
{
  "success": true,
  "data": {
    "totalJobs": 5,
    "runningJobs": 1,
    "runningJobIds": ["hourly-metrics"]
  }
}
```

**手动触发执行**

```bash
POST /api/v1/cron/jobs/daily-cleanup/execute
```

```json
{
  "success": true,
  "data": {
    "executionId": "exec_1745524800000_daily-cleanup",
    "jobId": "daily-cleanup",
    "startedAt": "2026-05-15T02:00:00.000Z",
    "completedAt": "2026-05-15T02:00:03.245Z",
    "status": "success",
    "output": "Task \"data-cleanup\" executed successfully"
  }
}
```

---

## 6. 数据模型

### 6.1 CronJob（定时任务）

对应数据库表 `cron_jobs`（Migration 036）。

```typescript
interface CronJob {
  id: string;           // UUID，主键
  name: string;         // 任务名称（唯一约束，VARCHAR(200)）
  schedule: string;     // Cron 表达式（VARCHAR(100)）
  task: string;         // 任务处理器标识（对应 DB handler 字段）
  enabled: boolean;     // 是否启用
  createdAt: string;    // 创建时间（ISO 8601）
  updatedAt: string;    // 更新时间（ISO 8601）
  lastRunAt?: string;   // 上次执行时间
  nextRunAt?: string;   // 下次计划执行时间
  lastRunStatus?: string; // 上次执行状态 ('success' | 'failed')
  payload?: Record<string, unknown>; // 任务参数（JSONB）
}
```

**数据库字段映射**：

| DB 字段 | 类型 | 约束 | 说明 |
|---------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | 主键 |
| `name` | VARCHAR(200) | NOT NULL, UNIQUE | 任务名称 |
| `schedule` | VARCHAR(100) | NOT NULL | Cron 表达式 |
| `handler` | VARCHAR(200) | NOT NULL | 处理器标识 |
| `payload` | JSONB | NOT NULL DEFAULT '{}' | 任务参数 |
| `enabled` | BOOLEAN | NOT NULL DEFAULT true | 是否启用 |
| `last_run_at` | TIMESTAMPTZ | NULL | 上次执行时间 |
| `last_run_status` | VARCHAR(20) | NULL | 上次执行状态 |
| `next_run_at` | TIMESTAMPTZ | NULL | 下次计划执行时间 |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | 创建时间 |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | 更新时间 |

**索引**：`idx_cron_jobs_enabled` — 部分索引 `WHERE enabled = true`。

### 6.2 CronExecutionEntity（执行记录）

对应数据库表 `cron_executions`（Migration 036）。

```typescript
interface CronExecutionEntity {
  id: string;            // UUID，主键
  jobId: string;         // 关联 cron_jobs.id（外键，ON DELETE CASCADE）
  startedAt: Date;       // 开始时间
  completedAt?: Date;    // 完成时间
  status: string;        // 'running' | 'completed' | 'failed' | 'cancelled'
  result?: Record<string, any>; // 执行结果（JSONB）
  errorMessage?: string; // 错误信息
}
```

**索引**：

| 索引名 | 字段 | 用途 |
|--------|------|------|
| `idx_cron_executions_job` | `job_id` | 按任务查询执行历史 |
| `idx_cron_executions_status` | `status` | 查询正在运行的执行记录 |
| `idx_cron_executions_started` | `started_at DESC` | 按时间倒序排列 |

### 6.3 LockEntry（分布式锁条目）

存储在 Redis 中，非持久化。

```typescript
interface Lock {
  key: string;      // 锁标识，格式为 "lock:{key}"
  acquiredAt: Date; // 获取时间
  ttl?: number;     // 生存时间（毫秒）
  release(): Promise<void>; // 释放方法
}
```

### 6.4 前端 CronJob 类型

前端 API 客户端定义的类型（`api/cron.ts`）与后端略有差异：

```typescript
interface CronJob {  // 前端定义
  id: string;
  name: string;
  schedule: string;
  command: string;    // 对应后端 task/handler
  enabled: boolean;
  status: 'running' | 'idle' | 'error' | 'disabled';
  lastRunAt?: string;
  nextRunAt?: string;
  lastError?: string;
  runCount: number;   // 前端特有，后端无此字段
  createdAt: string;
  updatedAt: string;
}
```

> **差异说明**：前端使用 `command` 字段名对应后端 `task`/`handler`，前端增加了 `status` 枚举和 `runCount` 计数器，这些字段在后端响应中尚未完全映射。

---

## 7. 执行生命周期

### 7.1 完整执行流程

```
┌─────────────┐
│ Scheduler   │
│ Tick (60s)  │
└──────┬──────┘
       │
       ▼
┌─────────────────┐     否     ┌──────────────┐
│ Job enabled?    │───────────▶│ Skip this job│
└──────┬──────────┘            └──────────────┘
       │ 是
       ▼
┌─────────────────────┐     是     ┌─────────────────┐
│ Already running?    │───────────▶│ Skip (in-flight)│
│ (runningJobIds set) │            └─────────────────┘
└──────┬──────────────┘
       │ 否
       ▼
┌──────────────────────┐     否     ┌──────────────┐
│ shouldExecuteJob()   │───────────▶│ Skip (not yet)│
│ prev diff < 65s?     │            └──────────────┘
└──────┬───────────────┘
       │ 是
       ▼
┌──────────────────────────────────────────────────┐
│                   runJob()                        │
│                                                   │
│  1. 生成 executionId: exec_{timestamp}_{jobId}    │
│  2. 添加 runningJobIds                            │
│  3. 创建执行记录 → CronExecutionRepository.create │
│  4. 执行任务 → executeTask(job)                   │
│  5. 成功路径:                                      │
│     - status = 'success'                          │
│     - 更新 job.lastRunAt / lastRunStatus           │
│     - 更新 job.nextRunAt (computeNextRun)          │
│     - Repository.complete() + updateLastRun()     │
│  6. 失败路径:                                      │
│     - status = 'failed' + error message           │
│     - 更新 job.lastRunAt / lastRunStatus           │
│     - Repository.complete(failed) + updateLastRun │
│  7. finally: 移除 runningJobIds                   │
└──────────────────────────────────────────────────┘
```

### 7.2 状态转移

```
         创建
          │
          ▼
   ┌─────────────┐
   │    idle     │◀────────────────────┐
   └──────┬──────┘                     │
          │ execute (手动或调度)        │ 完成
          ▼                            │
   ┌─────────────┐  ┌─────────────────┐│
   │   running   │─▶│ success/failed  ││
   └─────────────┘  └────────┬────────┘│
                             │ 重新调度│
                             └─────────┘
```

### 7.3 异常处理

| 异常场景 | 处理方式 |
|---------|---------|
| Cron 表达式无效 | `addJob()` 时 `cron-parser` 抛出异常，拒绝创建 |
| 任务执行失败 | 捕获异常，记录 `status='failed'` 和 `error` 信息，不影响后续 tick |
| 数据库写入失败 | `fire-and-forget` 模式，仅记录 warn 日志，不影响内存操作 |
| 调度器崩溃 | `setInterval` 内使用 `.catch()` 捕获，不中断调度循环 |
| 锁获取失败 | 重试 3 次后放弃，记录错误日志 |

---

## 8. 前端页面结构

### 8.1 页面路由

- **路径**：`/console/cron`
- **组件**：`orion-frontend/src/pages/CronManagement/index.tsx`
- **权限**：`admin`、`platform_admin`

### 8.2 页面布局

```
┌─────────────────────────────────────────────────────────────┐
│  [ClockIcon] 定时任务管理                        [刷新][新建任务] │
│  Cron Job Management                                        │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│ │ 总任务数: 5  │ │ 已启用: 4    │ │ 运行中: 1    │         │
│ └──────────────┘ └──────────────┘ └──────────────┘         │
├─────────────────────────────────────────────────────────────┤
│  名称    │ 调度表达式 │ 命令        │ 状态 │ 启用 │ 执行次数 │ 上次执行 │ 下次执行 │ 操作   │
│ ────────┼──────────┼────────────┼──────┼──────┼────────┼──────────┼──────────┼────────│
│ daily-  │ 0 2 * * *│ npm run... │ [空闲]│ [是] │ 42     │ 04-29 02:00│ 04-30 02:00│ ▶ ✏️ 🗑️ │
│ cleanup │          │            │      │      │        │           │          │        │
│ hourly- │ */15 * * │ python...  │[运行中]│ [是] │ 128    │ 04-29 14:45│ 04-29 15:00│ ▶ ✏️ 🗑️ │
│ metrics │ * * * *  │            │      │      │        │           │          │        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│         新建/编辑定时任务 (Modal)         │
│ ┌─────────────────────────────────────┐ │
│ │ 名称:     [daily-cleanup________]   │ │
│ │ Cron 表达式: [0 2 * * *__________]  │ │
│ │ 命令:     [npm run cleanup_______]  │ │
│ │           [                       ] │ │
│ │ 启用:     [●] 是                    │ │
│ └─────────────────────────────────────┘ │
│         [取消]          [确定]           │
└─────────────────────────────────────────┘
```

### 8.3 交互功能

| 功能 | 交互方式 | 说明 |
|------|---------|------|
| 创建任务 | 点击「新建任务」打开 Modal | 填写名称、Cron 表达式、命令、启用状态 |
| 编辑任务 | 点击行操作栏编辑图标 | 预填当前值，提交后刷新列表 |
| 删除任务 | 点击行操作栏删除图标 | Popconfirm 二次确认 |
| 手动执行 | 点击行操作栏播放图标 | 立即触发一次执行，运行中时按钮禁用 |
| 刷新 | 点击「刷新」按钮 | 重新加载任务列表和统计信息 |
| 状态标签 | Tag 组件 + 颜色编码 | 运行中(processing) / 空闲(success) / 错误(error) / 已禁用(default) |

### 8.4 状态管理

使用 React `useState` 进行本地状态管理：

```typescript
const [loading, setLoading] = useState(true);      // 加载状态
const [error, setError] = useState<Error | null>(); // 错误信息
const [jobs, setJobs] = useState<CronJob[]>([]);    // 任务列表
const [stats, setStats] = useState<{...} | null>(); // 统计数据
const [modalVisible, setModalVisible] = useState();  // Modal 显隐
const [editingJob, setEditingJob] = useState();      // 当前编辑的任务
```

### 8.5 API 调用层

`orion-frontend/src/api/cron.ts` 封装了 6 个 API 调用方法：

| 函数 | 后端路由 | 说明 |
|------|---------|------|
| `getCronJobs()` | `GET /v1/cron/jobs` | 获取任务列表 |
| `getCronJob(id)` | `GET /v1/cron/jobs/:id` | 获取单个任务 |
| `createCronJob(input)` | `POST /v1/cron/jobs` | 创建任务 |
| `updateCronJob(id, input)` | `PUT /v1/cron/jobs/:id` | 更新任务 |
| `deleteCronJob(id)` | `DELETE /v1/cron/jobs/:id` | 删除任务 |
| `executeCronJob(id)` | `POST /v1/cron/jobs/:id/execute` | 手动执行 |
| `getCronStatus()` | `GET /v1/cron/status` | 获取调度器状态 |

---

## 9. 集成点

### 9.1 Pipeline 触发

Cron 任务可作为 Pipeline 的定时触发源：

- `task`/`handler` 字段可注册为 `pipeline-trigger` 类型的处理器
- 调度器在执行时通过 `executeTask()` 分发到对应的 Pipeline 触发逻辑
- 当前为占位实现（`executeTask()` 仅返回模拟字符串）

### 9.2 维护窗口（Maintenance Window）

Cron 任务与维护窗口的集成设计：

- 在执行任务前检查当前时间是否处于维护窗口期内
- 若处于维护窗口，可配置跳过或延迟执行
- 当前**尚未实现**此集成

### 9.3 事件总线（EventBus）

计划中的事件发布：

| 事件类型 | 触发时机 | 事件内容 |
|---------|---------|---------|
| `cron.job.created` | 任务创建 | jobId, name, schedule |
| `cron.job.deleted` | 任务删除 | jobId |
| `cron.job.enabled` | 任务启用 | jobId |
| `cron.job.disabled` | 任务禁用 | jobId |
| `cron.execution.started` | 执行开始 | executionId, jobId |
| `cron.execution.completed` | 执行成功 | executionId, jobId, duration |
| `cron.execution.failed` | 执行失败 | executionId, jobId, error |

> **当前状态**：EventBus 集成尚未实现（与平台整体 EventBus 未接入 NATS 一致）。

### 9.4 OnCall 排班

`scheduler/` 模块还包含 `OnCallService`（值班排班服务），与 Cron 调度共享 `scheduler/` 模块目录，但两者在代码层面相互独立。OnCall 排班可通过 Cron 任务定期轮换值班人员。

---

## 10. 未来增强

### 10.1 高优先级

| 增强项 | 当前状态 | 说明 |
|--------|---------|------|
| **分布式锁集成** | 未集成 | `runJob()` 尚未调用 `DistributedLockService.acquireLock()` |
| **任务执行器注册表** | 占位 | `executeTask()` 硬编码返回模拟字符串，需实现 handler 注册与分发机制 |
| **执行历史持久化查询** | 部分实现 | `getExecutionHistory()` 仅读取内存，应改为查询 `CronExecutionRepository.findByJobId()` |
| **前端-后端字段映射** | 不一致 | `command` vs `task`/`handler`、`runCount` 缺失等差异需对齐 |

### 10.2 中优先级

| 增强项 | 说明 |
|--------|------|
| **失败重试机制** | 配置化的重试策略（最大重试次数、退避算法） |
| **超时控制** | 任务执行超时自动终止，防止长时间阻塞 |
| **执行并发控制** | 限制同一时刻最多执行的任务数量 |
| **维护窗口集成** | 在维护窗口期间暂停或延迟任务执行 |
| **Cron 表达式可视化** | 前端增加 Cron 表达式人类可读翻译（如 "每天凌晨 2:00"） |

### 10.3 低优先级

| 增强项 | 说明 |
|--------|------|
| **死信队列（DLQ）** | 多次重试失败的任务移入死信队列，支持手动重放 |
| **执行日志聚合** | 每次执行的 stdout/stderr 日志采集与查看 |
| **调度漂移检测** | 监控实际执行时间与计划时间的偏差 |
| **多时区支持** | 当前固定 UTC，支持按任务配置时区 |
| **Cron 预检查** | 创建任务时展示未来 N 次计划执行时间 |
| **任务依赖** | 定义任务间的前置依赖关系（DAG） |
| **EventBus 集成** | 接入 NATS 发布调度事件 |

---

## 附录

### A. 相关文件索引

| 文件 | 路径 |
|------|------|
| API 路由 | `orion-platform-service/src/api/cron-routes.ts` |
| 调度服务 | `orion-platform-service/src/services/scheduler/CronSchedulerService.ts` |
| 分布式锁服务 | `orion-platform-service/src/services/scheduler/DistributedLockService.ts` |
| 模块导出 | `orion-platform-service/src/services/scheduler/index.ts` |
| Job Repository | `orion-platform-service/src/repositories/CronJobRepository.ts` |
| Execution Repository | `orion-platform-service/src/repositories/CronExecutionRepository.ts` |
| 数据库迁移 | `orion-platform-service/src/db/migrations/036_create_cron_tables.sql` |
| 前端页面 | `orion-frontend/src/pages/CronManagement/index.tsx` |
| 前端 API 客户端 | `orion-frontend/src/api/cron.ts` |
| 前端测试 | `orion-frontend/src/pages/CronManagement/__tests__/index.test.tsx` |

### B. 数据库 DDL（Migration 036）

完整表结构参见 `orion-platform-service/src/db/migrations/036_create_cron_tables.sql`。

### C. 依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| `cron-parser` | ^4.x | Cron 表达式解析 |
| `redis` | ^4.x | 分布式锁（可选） |
| `pino` | ^8.x | 日志记录 |
| `fastify` | ^4.x | HTTP 路由框架 |
| `dayjs` | ^1.x | 前端时间格式化 |
