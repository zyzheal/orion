# S9 OnCall 值班排班模块设计文档

| 属性 | 值 |
|------|------|
| 模块编号 | S9 |
| 模块名称 | OnCall Scheduling |
| 状态 | 已实现（MVP） |
| 最后更新 | 2026-05-15 |
| 负责人 | Platform Team |

## 1. 模块概述

OnCall 值班排班模块（S9）为 Orion 平台提供值班人员管理、轮换排班、代班覆盖和升级规则的核心能力。该模块支撑告警路由的值班人员查找、事故升级链的执行、以及运维团队的排班可视化。

### 1.1 核心功能

- **排班管理（Schedule CRUD）**：创建/查询/删除值班排班，支持每日（daily）、每周（weekly）、每月（monthly）三种轮换周期。
- **当前值班人员查询**：基于时间窗口计算当前值班人员，支持代班覆盖（Override）优先级判定。
- **代班覆盖（Override）**：临时替换值班人员，支持指定时间范围和原因记录。
- **升级规则（Escalation）**：配置多级升级链，当某级别在超时未响应时自动升级到下一级。
- **团队成员管理**：排班维度的团队成员列表，支持多时区。

### 1.2 设计原则

- **时间窗口优先**：值班人员判定基于 Assignment 时间区间覆盖，而非动态计算。
- **Override 优先**：存在活跃代班时，代班人员覆盖原始排班人员。
- **PostgreSQL 持久化**：所有数据通过 Repository 模式写入 PostgreSQL，内存 Map 仅作为测试/降级兜底。

## 2. 架构设计

### 2.1 分层架构

```
┌──────────────────────────────────────────────────────┐
│  Frontend (React + Ant Design)                       │
│  orion-frontend/src/pages/OnCall/index.tsx           │
│  orion-frontend/src/api/oncall.ts                    │
├──────────────────────────────────────────────────────┤
│  API Routes (Fastify)                                │
│  orion-platform-service/src/api/oncall-routes.ts     │
│  Prefix: /api/v1/oncall                              │
├──────────────────────────────────────────────────────┤
│  Service Layer                                       │
│  orion-platform-service/src/services/scheduler/      │
│    OnCallService.ts                                  │
│    types.ts                                          │
├──────────────────────────────────────────────────────┤
│  Repository Layer                                    │
│  orion-platform-service/src/repositories/            │
│    OnCallScheduleRepository.ts                       │
│    OnCallAssignmentRepository.ts                     │
│    OnCallOverrideRepository.ts                       │
├──────────────────────────────────────────────────────┤
│  PostgreSQL                                          │
│  Tables: oncall_schedules, oncall_assignments,       │
│          oncall_overrides                            │
└──────────────────────────────────────────────────────┘
```

### 2.2 请求链路

```
Frontend GET /api/v1/oncall/schedules/:id/current
  → oncall-routes.ts: Fastify handler
    → OnCallService.getCurrentOnCall(scheduleId)
      → OnCallOverrideRepository.findActiveAtTime()    -- 检查代班
      → OnCallAssignmentRepository.findByScheduleAndTime() -- 查找排班分配
      → getEscalationTargets()                          -- 计算升级目标
    → 返回 OnCallCheckResult
```

### 2.3 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + Ant Design 5 + dayjs |
| API 网关 | Fastify（Node.js） |
| 后端服务 | TypeScript + pino 日志 |
| 持久化 | PostgreSQL + BaseRepository |
| 迁移 | 纯 SQL Migration (035) |

## 3. API 端点

所有端点挂载于 `/api/v1/oncall` 前缀下。

### 3.1 创建排班

```
POST /api/v1/oncall/schedules
```

**请求体：**

```json
{
  "name": "平台核心服务值班",
  "timezone": "Asia/Shanghai",
  "rotationType": "weekly",
  "teamMembers": ["dev-001", "dev-002", "dev-003"],
  "rotationStartHour": 9,
  "escalations": [
    { "level": 1, "timeoutMinutes": 15, "targets": ["dev-001"] },
    { "level": 2, "timeoutMinutes": 30, "targets": ["dev-002"] }
  ]
}
```

**校验规则：**

| 字段 | 校验 | 错误码 |
|------|------|--------|
| name | 必填，字符串 | `NAME_REQUIRED` |
| timezone | 必填，字符串 | `TIMEZONE_REQUIRED` |
| rotationType | 必填，枚举 daily/weekly/monthly | `INVALID_ROTATION_TYPE` |
| teamMembers | 必填，非空数组 | `TEAM_MEMBERS_REQUIRED` |
| rotationStartHour | 可选，0-23 | `INVALID_ROTATION_START_HOUR` |

**响应（200）：**

```json
{
  "id": "schedule_<uuid>",
  "name": "平台核心服务值班",
  "timezone": "Asia/Shanghai",
  "rotationType": "weekly",
  "rotationStartHour": 9,
  "teamMembers": ["dev-001", "dev-002", "dev-003"],
  "startDate": "2026-05-15T09:00:00.000Z",
  "escalations": [
    { "level": 1, "timeoutMinutes": 15, "targets": ["dev-001"] },
    { "level": 2, "timeoutMinutes": 30, "targets": ["dev-002"] }
  ],
  "createdAt": "2026-05-15T09:00:00.000Z",
  "updatedAt": "2026-05-15T09:00:00.000Z"
}
```

### 3.2 查询排班列表

```
GET /api/v1/oncall/schedules
```

**响应（200）：**

```json
{
  "schedules": [
    {
      "id": "schedule_<uuid>",
      "name": "平台核心服务值班",
      "timezone": "Asia/Shanghai",
      "rotationType": "weekly",
      "teamMembers": ["dev-001", "dev-002", "dev-003"],
      "escalations": [],
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

### 3.3 查询排班详情

```
GET /api/v1/oncall/schedules/:id
```

**响应（200）：** 同创建响应结构。**404** 返回 `{ "error": "NOT_FOUND" }`。

### 3.4 查询当前值班人员

```
GET /api/v1/oncall/schedules/:id/current
```

**响应（200）：**

```json
{
  "isOnCall": true,
  "primaryUserId": "dev-002",
  "escalationTargets": ["dev-001", "dev-003"]
}
```

### 3.5 创建代班

```
POST /api/v1/oncall/overrides
```

**请求体：**

```json
{
  "scheduleId": "schedule_<uuid>",
  "originalUserId": "dev-001",
  "overrideUserId": "dev-003",
  "startTime": "2026-05-20T09:00:00+08:00",
  "endTime": "2026-05-22T09:00:00+08:00",
  "reason": "年假"
}
```

**响应（200）：**

```json
{
  "id": "override_<uuid>",
  "scheduleId": "schedule_<uuid>",
  "originalUserId": "dev-001",
  "overrideUserId": "dev-003",
  "startTime": "2026-05-20T01:00:00.000Z",
  "endTime": "2026-05-22T01:00:00.000Z",
  "reason": "年假"
}
```

### 3.6 删除排班

```
DELETE /api/v1/oncall/schedules/:id
```

**响应（200）：** `{ "success": true }`。**404** 返回 `{ "error": "NOT_FOUND" }`。

删除操作级联清理：同时删除该排班下的所有 Assignment 和 Override 记录（PostgreSQL `ON DELETE CASCADE` + 应用层双重清理）。

## 4. 数据模型

### 4.1 数据库表结构（Migration 035）

#### oncall_schedules

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK, DEFAULT gen_random_uuid() | 排班唯一标识 |
| name | VARCHAR(200) | NOT NULL | 排班名称 |
| timezone | VARCHAR(100) | NOT NULL | IANA 时区标识 |
| rotation_type | VARCHAR(20) | NOT NULL | daily / weekly / monthly |
| rotation_start_hour | INT | NOT NULL, DEFAULT 9 | 轮换起始小时（0-23） |
| team_members | UUID[] | NOT NULL, DEFAULT '{}' | 团队成员 UUID 数组 |
| start_date | TIMESTAMPTZ | NOT NULL, DEFAULT now() | 排班生效时间 |
| escalations | JSONB | NOT NULL, DEFAULT '[]' | 升级规则数组 |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | 创建时间 |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | 更新时间 |

**索引：**

- `idx_oncall_schedules_name` ON name

#### oncall_assignments

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | 分配唯一标识 |
| schedule_id | UUID | FK → oncall_schedules(id), ON DELETE CASCADE | 所属排班 |
| user_id | UUID | NOT NULL | 值班人员 |
| start_time | TIMESTAMPTZ | NOT NULL | 生效起始 |
| end_time | TIMESTAMPTZ | NOT NULL | 生效截止 |

**索引：**

- `idx_oncall_assignments_schedule` ON schedule_id
- `idx_oncall_assignments_time` ON (start_time, end_time)
- `idx_oncall_assignments_user` ON user_id

#### oncall_overrides

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | 代班唯一标识 |
| schedule_id | UUID | FK → oncall_schedules(id), ON DELETE CASCADE | 所属排班 |
| original_user_id | UUID | NOT NULL | 原始值班人员 |
| override_user_id | UUID | NOT NULL | 代班人员 |
| start_time | TIMESTAMPTZ | NOT NULL | 代班起始 |
| end_time | TIMESTAMPTZ | NOT NULL | 代班截止 |
| reason | TEXT | 可空 | 代班原因 |

**索引：**

- `idx_oncall_overrides_schedule` ON schedule_id
- `idx_oncall_overrides_time` ON (start_time, end_time)

### 4.2 TypeScript 领域模型

```typescript
interface OnCallSchedule {
  id: string;
  name: string;
  timezone: string;
  rotationType: 'daily' | 'weekly' | 'monthly';
  rotationStartHour: number;
  teamMembers: string[];
  startDate: Date;
  endDate?: Date;
  escalations: EscalationRule[];
  createdAt: Date;
  updatedAt: Date;
}

interface EscalationRule {
  level: number;          // 升级级别 (1-based)
  timeoutMinutes: number; // 超时分钟数
  targets: string[];      // 目标用户 ID 列表
}

interface OnCallAssignment {
  id: string;
  scheduleId: string;
  userId: string;
  startTime: Date;
  endTime: Date;
}

interface OnCallOverride {
  id: string;
  scheduleId: string;
  originalUserId: string;
  overrideUserId: string;
  startTime: Date;
  endTime: Date;
  reason?: string;
}

interface OnCallCheckResult {
  isOnCall: boolean;
  primaryUserId?: string;
  escalationTargets?: string[];
}
```

### 4.3 实体层与领域层映射

Repository 层使用 `OnCallScheduleEntity`（snake_case 列名映射），Service 层通过 `mapEntityToSchedule()` 转换为领域模型 `OnCallSchedule`。Escalation 在 Entity 层存储为 `Array<{ userId: string; delay: number }>`，映射时展开为 `EscalationRule`。

## 5. 轮换算法

### 5.1 排班生成（generateAssignments）

创建排班时，`generateAssignments()` 根据轮换类型自动生成 Assignment 记录：

```
输入: schedule.teamMembers = [U1, U2, U3], rotationType = weekly
输出:
  Assignment[0]: U1, [now, now+7d)
  Assignment[1]: U2, [now+7d, now+14d)
  Assignment[2]: U3, [now+14d, now+21d)
```

算法流程：

1. 从当前时间 `now` 开始。
2. 遍历 `teamMembers` 数组，按索引取模 `i % teamMembers.length` 轮询分配。
3. 调用 `getEndOfRotation()` 计算当前 Assignment 的截止时间：
   - `daily` → `start + 1 day`
   - `weekly` → `start + 7 days`
   - `monthly` → `start + 1 month`
4. 下一个 Assignment 的起始时间 = 上一个的截止时间。
5. 生成 `teamMembers.length` 个 Assignment 后停止。

**关键代码片段：**

```typescript
for (let i = 0; i < schedule.teamMembers.length; i++) {
  const userId = schedule.teamMembers[i % schedule.teamMembers.length];
  const endTime = this.getEndOfRotation(schedule.rotationType, current);
  // ... create assignment
  current = endTime;
}
```

### 5.2 当前值班人员查询（getCurrentOnCall）

查询流程为三段式优先级判定：

```
1. 检查 Override  ──────────────────────────────────► 存在？ 返回 overrideUserId
2. 检查 Assignment ──────────────────────────────────► 存在？ 返回 assignment.userId
3. Fallback ────────────────────────────────────────► 返回 teamMembers[0]，isOnCall=false
```

**详细流程：**

1. **Override 优先**：调用 `OnCallOverrideRepository.findActiveAtTime(scheduleId, now)`，查询 `start_time <= now AND end_time > now` 的活跃代班。存在则直接返回 `overrideUserId`。
2. **Assignment 覆盖**：调用 `OnCallAssignmentRepository.findByScheduleAndTime(scheduleId, now)`，查询 `start_time <= now AND end_time > now` 的 Assignment。存在则返回 `userId`。
3. **内存兜底**：若 Repository 查询无结果（或环境无 DB），遍历内存 `assignments` Map 进行相同时间区间匹配。
4. **最终 Fallback**：若以上均无匹配，返回 `teamMembers[0]` 但设置 `isOnCall: false`，并记录 warn 日志。

### 5.3 当前实现的局限性

- **单次生成**：Assignment 仅在 `createSchedule` 时生成一轮（覆盖 `teamMembers.length` 个周期），之后不会自动续期。生产环境需要补充定时任务（如 Cron）来持续生成未来 Assignment。
- **简化逻辑**：当前 `getCurrentOnCall` 在无匹配时返回 `teamMembers[0]` 作为兜底，生产环境应改为更智能的回溯查找（回溯到最近一个有效 Assignment）。

## 6. 前端页面结构

### 6.1 页面布局

文件：`orion-frontend/src/pages/OnCall/index.tsx`

```
┌──────────────────────────────────────────────────────────┐
│  OnCall 值班管理                           [刷新] [创建排班] │
├──────────────────────────────────────────────────────────┤
│  Table: 排班列表                                           │
│  ┌──────┬──────┬────────┬────────┬──────┬──────┬────────┐ │
│  │排班名│轮换方式│当前值班│团队成员│开始时间│升级规则│操作    │ │
│  ├──────┼──────┼────────┼────────┼──────┼──────┼────────┤ │
│  │核心服务│每周  │张三 ✓ │张三 李四│05-01 │1级   │详情 代班│ │
│  │      │      │        │王五 +1 │      │      │删除    │ │
│  └──────┴──────┴────────┴────────┴──────┴──────┴────────┘ │
├──────────────────────────────────────────────────────────┤
│  Modal: 创建排班                                           │
│  排班名称 / 时区 / 轮换方式 / 团队成员 / 轮换开始时间       │
├──────────────────────────────────────────────────────────┤
│  Modal: 设置代班                                           │
│  原始值班人员 / 代班人员 / 开始时间 / 结束时间 / 代班原因   │
├──────────────────────────────────────────────────────────┤
│  Drawer: 排班详情                                          │
│  基本信息 → 即将到来的排班 → 升级规则 → 代班记录           │
└──────────────────────────────────────────────────────────┘
```

### 6.2 页面组件拆解

| 组件 | 用途 |
|------|------|
| `PageSkeleton` | 初始加载时的骨架屏 |
| `AntTable` | 排班列表，包含 7 列（排班名称、轮换方式、当前值班、团队成员、开始时间、升级规则、操作） |
| `Modal`（创建排班） | 表单包含名称、时区（7 个预置选项）、轮换方式、团队成员（逗号分隔 ID 输入）、轮换开始时间（0-23 下拉） |
| `Modal`（设置代班） | 表单包含原始/代班人员选择、时间范围、代班原因 |
| `Drawer`（排班详情） | Descriptions 展示基本信息，Timeline 展示排班记录和代班记录，Descriptions 展示升级规则 |

### 6.3 状态管理

- **用户映射（userMap）**：页面加载时调用 `listUsers()` 获取真实用户信息，失败时使用内置 `FALLBACK_USERS` 兜底。
- **当前值班状态（currentOnCall）**：为每个 schedule 独立调用 `getCurrentOnCall`，结果以 `Record<scheduleId, CurrentOnCallResult>` 存储。
- **数据加载**：`loadData()` 获取排班列表 → `useEffect` 遍历加载每个排班的当前值班人员。

### 6.4 API 客户端

文件：`orion-frontend/src/api/oncall.ts`

| 函数 | 方法 | 路径 | 返回类型 |
|------|------|------|----------|
| `getSchedules()` | GET | `/v1/oncall/schedules` | `ScheduleListResponse` |
| `getSchedule(id)` | GET | `/v1/oncall/schedules/:id` | `OnCallSchedule` |
| `createSchedule(data)` | POST | `/v1/oncall/schedules` | `OnCallSchedule` |
| `deleteSchedule(id)` | DELETE | `/v1/oncall/schedules/:id` | void |
| `getCurrentOnCall(id)` | GET | `/v1/oncall/schedules/:id/current` | `CurrentOnCallResult` |
| `createOverride(data)` | POST | `/v1/oncall/overrides` | `OnCallOverride` |

## 7. 集成点

### 7.1 告警路由集成

告警系统（Alert Service）在处理告警时，通过调用 `getCurrentOnCall(scheduleId)` 获取当前值班人员，作为告警通知的第一接收人。

```
Alert Triggered
  → AlertService.resolveTarget(alert)
    → OnCallService.getCurrentOnCall(alert.scheduleId)
      → 返回 primaryUserId + escalationTargets
    → 发送通知到 primaryUserId
```

### 7.2 事故升级集成

Incident Service 在事故处理超时后，根据 EscalationRule 逐级升级通知：

```
Incident Created (assigned to L1)
  → Timer: L1.timeoutMinutes elapsed
    → EscalationService.escalate(incident, level=2)
      → OnCallService.getEscalationTargets(schedule, currentAssignee)
        → 返回 [除当前人员外的其他团队成员]
      → 通知 L2 目标人员
```

当前实现中，`getEscalationTargets()` 简单返回团队中除当前值班人员外的所有成员。生产环境应结合 `EscalationRule.level` 和 `timeoutMinutes` 实现精确的逐级升级。

### 7.3 用户服务集成

前端通过 `listUsers()` API 获取用户信息用于人员名称解析。后端 Repository 直接使用 `userId`（UUID），不依赖外部用户服务。

### 7.4 RLS 策略

Migration 127 和 145 对 OnCall 相关表启用了 Row-Level Security（RLS），确保多租户环境下的数据隔离。

## 8. Repository 层详细设计

### 8.1 OnCallScheduleRepository

继承 `BaseRepository<OnCallScheduleEntity>`，表名 `oncall_schedules`。

| 方法 | 说明 | SQL |
|------|------|-----|
| `findById(id)` | 按 ID 查询（继承自 BaseRepository） | |
| `findAll()` | 查询全部（继承自 BaseRepository） | |
| `create(entity)` | 创建记录（继承自 BaseRepository） | |
| `delete(id)` | 删除记录（继承自 BaseRepository） | |
| `findByTimezone(tz)` | 按时区查询 | `WHERE timezone = $1` |
| `findByTeamMember(userId)` | 按成员查询 | `WHERE $1 = ANY(team_members)` |
| `findByRotationType(type)` | 按轮换类型查询 | `WHERE rotation_type = $1` |
| `updateEscalations(id, esc)` | 更新升级规则 | `SET escalations = $1` |

### 8.2 OnCallAssignmentRepository

继承 `BaseRepository<OnCallAssignmentEntity>`，表名 `oncall_assignments`。

| 方法 | 说明 | SQL |
|------|------|-----|
| `findByScheduleId(scheduleId)` | 按排班查询所有分配 | `WHERE schedule_id = $1 ORDER BY start_time ASC` |
| `findByScheduleAndTime(scheduleId, time)` | 按排班+时间查询活跃分配 | `WHERE schedule_id = $1 AND start_time <= $2 AND end_time > $2 LIMIT 1` |
| `deleteByScheduleId(scheduleId)` | 按排批量删除 | `DELETE WHERE schedule_id = $1` |

### 8.3 OnCallOverrideRepository

继承 `BaseRepository<OnCallOverrideEntity>`，表名 `oncall_overrides`。

| 方法 | 说明 | SQL |
|------|------|-----|
| `findByScheduleId(scheduleId)` | 按排班查询所有代班 | `WHERE schedule_id = $1 ORDER BY start_time ASC` |
| `findActiveAtTime(scheduleId, time)` | 查询指定时间的活跃代班 | `WHERE schedule_id = $1 AND start_time <= $2 AND end_time > $2 LIMIT 1` |
| `deleteByScheduleId(scheduleId)` | 按排批量删除 | `DELETE WHERE schedule_id = $1` |

## 9. 未来增强计划

### 9.1 高优先级（P0）

| 功能 | 说明 | 当前状态 |
|------|------|----------|
| Assignment 自动续期 | 当前仅生成一轮 Assignment，需要 Cron 定时任务持续生成未来排班 | 未实现 |
| 排班编辑（Update） | 缺少 PUT/PATCH 端点修改排班配置 | 未实现 |
| 代班列表查询 | 缺少 GET /overrides 端点查询代班记录 | 未实现 |
| Assignment 列表查询 | 缺少 GET /schedules/:id/assignments 端点 | 未实现 |

### 9.2 中优先级（P1）

| 功能 | 说明 |
|------|------|
| 多时区精确计算 | 当前 `generateAssignments` 使用本地时间，跨时区排班存在偏差 |
| 升级规则引擎 | EscalationRule 目前仅静态存储，缺乏与 Incident 集成的动态升级执行 |
| 排班日历视图 | 前端增加日历可视化，直观展示轮换时间线 |
| 通知集成 | 轮换切换时自动发送通知（Slack/邮件/钉钉） |
| 重叠检测 | 创建代班时检测时间重叠并拒绝或警告 |

### 9.3 低优先级（P2）

| 功能 | 说明 |
|------|------|
| 负载均衡轮换 | 支持按工作负载而非纯时间轮询分配 |
| 排班模板 | 预置常用排班模板（7×24、5×8 等） |
| 导入/导出 | 支持 CSV/Excel 批量导入排班 |
| 可用性标记 | 团队成员可标记个人不可用时间段，排班时自动跳过 |
| SLA 报告 | 按周期统计值班响应时间、升级次数等指标 |

## 10. 测试覆盖

### 10.1 后端测试

- **单元测试**：`src/services/scheduler/__tests__/OnCallService.test.ts`
- **Repository 测试**：`src/repositories/__tests__/OnCallScheduleRepository.test.ts`

### 10.2 前端测试

- **组件测试**：`orion-frontend/src/pages/OnCall/__tests__/index.test.tsx`

## 11. 相关文件索引

| 文件 | 路径 |
|------|------|
| API 路由 | `orion-platform-service/src/api/oncall-routes.ts` |
| Service | `orion-platform-service/src/services/scheduler/OnCallService.ts` |
| 领域类型 | `orion-platform-service/src/services/scheduler/types.ts` |
| Schedule Repository | `orion-platform-service/src/repositories/OnCallScheduleRepository.ts` |
| Assignment Repository | `orion-platform-service/src/repositories/OnCallAssignmentRepository.ts` |
| Override Repository | `orion-platform-service/src/repositories/OnCallOverrideRepository.ts` |
| DB Migration | `orion-platform-service/src/db/migrations/035_create_oncall_tables.sql` |
| RLS Policy | `orion-platform-service/src/db/migrations/127_enable_rls_remaining_tables.sql` |
| 前端页面 | `orion-frontend/src/pages/OnCall/index.tsx` |
| 前端 API | `orion-frontend/src/api/oncall.ts` |
| 前端测试 | `orion-frontend/src/pages/OnCall/__tests__/index.test.tsx` |
