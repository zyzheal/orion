# Spec: 定时任务 (Cron)

> **日期**: 2026-07-03
> **状态**: 编写中
> **能力域**: 任务调度
> **目标成熟度**: L1.5 → L2.5
> **关键交付**: Cron 作业、On-Call 排班、超时覆盖、执行历史、告警

## 一、功能描述

### 1.1 现状评估 (L1.5)

Orion 当前已实现（Go 微服务 `orion-cron-svc-go`）：
- Cron 作业 CRUD（Service + Repository）
- Cron 表达式解析（robfig/cron）
- 调度器生命周期管理（Start/Stop）
- 作业启用/禁用
- On-Call 排班基础（oncall_schedules 表）
- 多租户隔离（tenant_id 过滤）
- OpenTelemetry 追踪

**不足**：
- 无作业执行历史记录
- 无作业超时控制
- 无作业重试策略
- 无作业依赖关系
- 无 On-Call 自动分配算法
- 无 On-Call 升级策略
- 无作业执行告警
- 无作业执行指标（成功率/耗时）

### 1.2 Phase 1 目标 (L2.5)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 执行历史 | 作业执行记录、状态、耗时、日志 | L2 |
| 超时控制 | 作业超时自动终止、告警 | L2 |
| 重试策略 | 失败自动重试（指数退避） | L2 |
| On-Call 排班 | 自动分配算法、升级策略、休息日 | L2.5 |
| 作业告警 | 执行失败/超时告警 | L2 |
| 执行指标 | 成功率/耗时/频率统计 | L2 |

## 二、验收标准

### 2.1 Cron 作业管理

| # | 标准 | 验证方式 |
|---|------|----------|
| CR1 | 支持创建 Cron 作业（name + cron expression + payload） | API 测试 |
| CR2 | 支持标准 5 段 Cron 表达式（秒/分/时/日/月/周） | API 测试 |
| CR3 | 支持一次性作业（at 指定时间执行） | API 测试 |
| CR4 | 作业可启用/禁用，禁用后不执行 | API 测试 |
| CR5 | 作业可更新（不影响已调度的执行） | API 测试 |
| CR6 | 作业可删除，删除后不再执行 | API 测试 |
| CR7 | 多租户隔离：每个租户的作业独立 | 集成测试 |

### 2.2 执行历史

| # | 标准 | 验证方式 |
|---|------|----------|
| CR8 | 每次作业执行记录执行历史（状态/耗时/结果） | API 测试 |
| CR9 | 执行状态：success/failed/timeout/skipped | API 测试 |
| CR10 | 执行历史按时间倒序，分页查询 | API 测试 |
| CR11 | 保留最近 1000 条执行历史，超出自动清理 | 单元测试 |
| CR12 | 执行结果存储（JSON，最大 10KB） | API 测试 |

### 2.3 超时与重试

| # | 标准 | 验证方式 |
|---|------|----------|
| CR13 | 每个作业可配置超时时间（默认 300s） | API 测试 |
| CR14 | 超时自动终止执行，记录 timeout 状态 | 集成测试 |
| CR15 | 失败自动重试，默认 3 次，间隔 60s | 集成测试 |
| CR16 | 重试策略支持指数退避 | API 测试 |
| CR17 | 达到最大重试次数后标记 failed 并告警 | 集成测试 |
| CR18 | 重试事件记录审计日志 | 单元测试 |

### 2.4 On-Call 排班

| # | 标准 | 验证方式 |
|---|------|----------|
| OC1 | 支持创建 On-Call 排班（人员 + 时间段） | API 测试 |
| OC2 | 排班支持轮换模式（daily/weekly/monthly） | API 测试 |
| OC3 | 排班支持休息日配置 | API 测试 |
| OC4 | 自动计算当前 On-Call 人员 | 集成测试 |
| OC5 | 排班重叠检测：同一时段不可重复 | API 测试 |
| OC6 | 支持手动覆盖（override）指定时段 | API 测试 |
| OC7 | 升级策略：超过 N 次未响应自动升级上级 | 集成测试 |
| OC8 | 升级后通知 On-Call + 上级 | 集成测试 |

### 2.5 作业告警

| # | 标准 | 验证方式 |
|---|------|----------|
| CA1 | 作业执行失败自动触发告警 | 集成测试 |
| CA2 | 作业连续失败 3 次升级告警级别 | 集成测试 |
| CA3 | 告警含作业名/失败原因/执行ID/时间 | API 测试 |
| CA4 | 告警渠道：邮件/钉钉/企微 | 集成测试 |
| CA5 | 告警可静默（维护窗口期） | API 测试 |

### 2.6 执行指标

| # | 标准 | 验证方式 |
|---|------|----------|
| CI1 | 作业执行成功率统计（按天/周/月） | API 测试 |
| CI2 | 作业平均执行耗时 | API 测试 |
| CI3 | 作业执行频率统计（每小时/每天） | API 测试 |
| CI4 | 最慢 Top 10 作业 | API 测试 |
| CI5 | 失败率趋势图 | 前端验证 |
| CI6 | 作业执行仪表盘 | 前端验证 |

## 三、API 设计

```
Base: /api/v1/cron
```

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/jobs` | 创建作业 |
| GET | `/jobs` | 作业列表 |
| GET | `/jobs/:id` | 作业详情 |
| PUT | `/jobs/:id` | 更新作业 |
| DELETE | `/jobs/:id` | 删除作业 |
| POST | `/jobs/:id/enable` | 启用作业 |
| POST | `/jobs/:id/disable` | 禁用作业 |
| GET | `/jobs/:id/executions` | 执行历史 |
| GET | `/executions/:executionId` | 执行详情 |
| POST | `/executions/:executionId/cancel` | 取消执行 |
| POST | `/oncall/schedules` | 创建排班 |
| GET | `/oncall/schedules` | 排班列表 |
| PUT | `/oncall/schedules/:id` | 更新排班 |
| DELETE | `/oncall/schedules/:id` | 删除排班 |
| GET | `/oncall/current` | 当前 On-Call 人员 |
| POST | `/oncall/override` | 手动覆盖 |
| GET | `/statistics` | 执行统计 |
| GET | `/dashboard` | 作业仪表盘 |

## 四、数据模型

```sql
-- Cron 作业
CREATE TABLE IF NOT EXISTS cron_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  cron_expression VARCHAR(100) NOT NULL,
  payload         JSONB DEFAULT '{}',
  timeout_sec     INT DEFAULT 300,
  max_retries     INT DEFAULT 3,
  retry_interval  INT DEFAULT 60,
  enabled         BOOLEAN DEFAULT true,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 执行历史
CREATE TABLE IF NOT EXISTS cron_executions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES cron_jobs(id) ON DELETE CASCADE,
  status          VARCHAR(20) DEFAULT 'running',
  result          JSONB,
  error_message   TEXT,
  started_at      TIMESTAMPTZ DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  duration_ms     INT
);

-- On-Call 排班
CREATE TABLE IF NOT EXISTS oncall_schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  name            VARCHAR(200) NOT NULL,
  rotation        VARCHAR(20) DEFAULT 'weekly',
  members         UUID[] NOT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE,
  timezone        VARCHAR(50) DEFAULT 'UTC',
  rest_days       INT[] DEFAULT '{}',
  escalation_rules JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- On-Call 覆盖
CREATE TABLE IF NOT EXISTS oncall_overrides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id     UUID NOT NULL REFERENCES oncall_schedules(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id),
  start_at        TIMESTAMPTZ NOT NULL,
  end_at          TIMESTAMPTZ NOT NULL,
  reason          TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cron_jobs_tenant ON cron_jobs(tenant_id, enabled);
CREATE INDEX idx_cron_executions_job ON cron_executions(job_id, started_at DESC);
CREATE INDEX idx_oncall_schedules_tenant ON oncall_schedules(tenant_id);
```

## 五、前端设计

**路由**: `/cron`

主要页面：
- 作业列表页：Cron 作业列表、启用/禁用
- 作业详情页：配置、执行历史
- On-Call 排班页：排班表、当前人员
- 排班管理页：创建/编辑排班、覆盖管理
- 仪表盘页：成功率/耗时/失败率图表

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 20 | CronService、OnCallService、ExecutionService |
| 集成测试 | 6 | 创建→执行→超时→重试→告警闭环 |
| 前端测试 | 4 | 作业列表、排班表、仪表盘 |

---
_文档版本: v1.0 | 创建日期: 2026-07-03 | 状态: 编写中_
