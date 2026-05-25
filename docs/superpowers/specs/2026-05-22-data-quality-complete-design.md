# 数据质量平台完整功能设计

> 创建日期：2026-05-22
> 迁移编号：190
> 新建表：`data_quality_rules`, `data_quality_reports`
> 已有后端表：`data_pipelines`(100), `quality_gates`(086/138)

---

## 1. 功能设计（后端）

### 1.1 业务闭环

```
数据源接入 → 规则定义 → 检测调度 → 质量检测 → 报告生成 → 问题跟踪 → 趋势分析
```

**闭环流程**：

1. **数据源接入**：通过已有的 `data_pipelines` 管理数据源连接（JDBC/REST/S3/Hive）
2. **规则定义**：在 `data_quality_rules` 中定义检测规则，关联到 pipeline/stage
3. **检测调度**：通过 `data_pipeline.schedule`（cron）或事件触发器自动执行检测
4. **质量检测**：执行 SQL/代码规则，将结果写入 `data_quality_reports`
5. **报告生成**：聚合检测结果，计算质量评分，生成可视化报告
6. **问题跟踪**：规则失败时生成质量事件，分配责任人并跟踪处理状态
7. **趋势分析**：基于历史报告数据绘制评分趋势曲线

**与已有组件集成**：

| 已有组件 | 集成方式 |
|---------|---------|
| `data_pipelines` | 质量检测作为 pipeline 的 validate stage 执行，复用 pipeline 调度 |
| `quality_gates` | 质量评分低于阈值时阻断 pipeline 执行（blocking gate） |
| `data_quality_rules`（现有 Service） | 扩展现有 `DataQualityService`，新增报告生成和评分算法 |
| `event_bus` | 检测完成/失败事件发布到 EventBus，触发告警和工单 |

### 1.2 质量规则类型

#### 1.2.1 规则分类体系

| 大类 | 小类 | 规则标识 | 描述 |
|-----|------|---------|------|
| **完整性** | 非空检查 | `not_null` | 指定字段不允许为 NULL/空串 |
| | 行数阈值 | `row_count_min` | 表行数不低于阈值 |
| | 行数范围 | `row_count_range` | 表行数在 [min, max] 范围内 |
| | 字段完整率 | `completeness_rate` | 字段非空比例 >= threshold |
| **一致性** | 格式校验 | `format_pattern` | 字段值匹配正则表达式 |
| | 枚举值检查 | `enum_values` | 字段值属于指定枚举集合 |
| | 跨表一致性 | `cross_table_consistency` | 两表关联字段一致性检查 |
| | 唯一性 | `unique` | 字段值在表中唯一 |
| | 外键引用 | `referential` | 字段值存在于引用表中 |
| **准确性** | 数值范围 | `numeric_range` | 数值字段在 [min, max] 范围内 |
| | 逻辑约束 | `logical_constraint` | 字段间逻辑关系（如 end_date >= start_date） |
| | 异常值检测 | `outlier_detection` | 基于 IQR/Z-Score 的异常值 |
| **及时性** | 数据延迟 | `freshness` | 数据最新更新时间距现在不超过阈值 |
| | 更新频率 | `update_frequency` | 单位时间内更新次数 >= threshold |
| **自定义** | SQL 脚本 | `custom_sql` | 自定义 SQL 检测语句 |
| | 代码函数 | `custom_function` | 自定义检测函数名 |

#### 1.2.2 每种规则的 SQL/代码实现

**not_null**：
```sql
SELECT COUNT(*) AS total,
       SUM(CASE WHEN ${target_field} IS NULL OR ${target_field} = '' THEN 1 ELSE 0 END) AS failures
FROM ${table_name}
WHERE ${condition};
-- failure_rate = failures / total
```

**row_count_min**：
```sql
SELECT COUNT(*) AS row_count FROM ${table_name} WHERE ${condition};
-- passed = row_count >= min_value
```

**row_count_range**：
```sql
SELECT COUNT(*) AS row_count FROM ${table_name} WHERE ${condition};
-- passed = row_count >= min_value AND row_count <= max_value
```

**completeness_rate**：
```sql
SELECT COUNT(*) AS total,
       SUM(CASE WHEN ${target_field} IS NOT NULL AND ${target_field} != '' THEN 1 ELSE 0 END) AS filled
FROM ${table_name} WHERE ${condition};
-- completeness = filled / total, passed = completeness >= threshold
```

**format_pattern**：
```sql
SELECT COUNT(*) AS total,
       SUM(CASE WHEN ${target_field} !~ '${pattern}' THEN 1 ELSE 0 END) AS failures
FROM ${table_name} WHERE ${condition};
-- PostgreSQL ~ 为正则匹配操作符
```

**enum_values**：
```sql
SELECT COUNT(*) AS total,
       SUM(CASE WHEN ${target_field} NOT IN (${enum_list}) THEN 1 ELSE 0 END) AS failures
FROM ${table_name} WHERE ${condition} AND ${target_field} IS NOT NULL;
```

**cross_table_consistency**：
```sql
SELECT COUNT(*) AS total,
       SUM(CASE WHEN b.${ref_field} IS NULL THEN 1 ELSE 0 END) AS failures
FROM ${table_name} a
LEFT JOIN ${ref_table} b ON a.${target_field} = b.${ref_field}
WHERE ${condition};
-- failure_rate = failures / total
```

**unique**：
```sql
SELECT COUNT(*) AS total,
       (SELECT COUNT(*) FROM (SELECT DISTINCT ${target_field} FROM ${table_name} WHERE ${condition} AND ${target_field} IS NOT NULL) sub) AS distinct_count
FROM ${table_name} WHERE ${condition} AND ${target_field} IS NOT NULL;
-- duplicates = total - distinct_count, passed = duplicates == 0
```

**referential**：
```sql
SELECT COUNT(*) AS total,
       SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM ${ref_table} r WHERE r.${ref_field} = a.${target_field}) THEN 1 ELSE 0 END) AS failures
FROM ${table_name} a WHERE ${condition};
```

**numeric_range**：
```sql
SELECT COUNT(*) AS total,
       SUM(CASE WHEN ${target_field} < ${min} OR ${target_field} > ${max} THEN 1 ELSE 0 END) AS failures
FROM ${table_name} WHERE ${condition} AND ${target_field} IS NOT NULL;
```

**logical_constraint**：
```sql
-- condition 为自定义表达式，如 "end_date >= start_date"
SELECT COUNT(*) AS total,
       SUM(CASE WHEN NOT (${constraint_expression}) THEN 1 ELSE 0 END) AS failures
FROM ${table_name} WHERE ${condition};
```

**outlier_detection (IQR)**：
```sql
WITH stats AS (
  SELECT PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ${target_field}) AS q1,
         PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ${target_field}) AS q3
  FROM ${table_name} WHERE ${condition}
)
SELECT COUNT(*) AS total,
       SUM(CASE WHEN ${target_field} < q1 - ${iqr_multiplier} * (q3 - q1)
                OR ${target_field} > q3 + ${iqr_multiplier} * (q3 - q1) THEN 1 ELSE 0 END) AS outliers
FROM ${table_name}, stats WHERE ${condition};
```

**freshness**：
```sql
SELECT MAX(${timestamp_field}) AS latest_time FROM ${table_name} WHERE ${condition};
-- delay_minutes = EXTRACT(EPOCH FROM (NOW() - latest_time)) / 60
-- passed = delay_minutes <= max_delay_minutes
```

**update_frequency**：
```sql
SELECT COUNT(*) AS update_count FROM ${table_name}
WHERE ${condition} AND ${timestamp_field} >= NOW() - INTERVAL '${period}';
-- passed = update_count >= min_count
```

**custom_sql**：
```sql
-- 直接执行用户定义的 SQL，要求返回 pass_count, fail_count, total 三个列
${user_defined_sql}
```

### 1.3 检测调度

#### 1.3.1 三种调度模式

| 模式 | 触发方式 | 实现机制 | 适用场景 |
|------|---------|---------|---------|
| **定时检测** | cron 表达式 | 复用现有 cron 调度器，注册 quality_check 任务类型 | 每日/每周数据质量巡检 |
| **触发式检测** | 数据到达事件 | 监听 EventBus `data_pipeline.completed` 事件，自动触发关联规则检测 | 数据管道完成后自动验证 |
| **手动检测** | 用户点击按钮 | API `POST /v1/data-quality/rules/:id/execute` | 临时排查、规则调试 |

#### 1.3.2 调度配置结构

```typescript
interface QualityCheckSchedule {
  ruleId: string;
  mode: 'cron' | 'event' | 'manual';
  // cron 模式
  cronExpression?: string;       // "0 2 * * *" 每天凌晨2点
  timezone?: string;             // "Asia/Shanghai"
  // event 模式
  triggerEvent?: string;         // "data_pipeline.completed"
  triggerFilter?: Record<string, string>; // 事件过滤条件 { pipelineId: "dp-123" }
  // 通用
  enabled: boolean;
  lastTriggeredAt?: Date;
  nextTriggerAt?: Date;
}
```

#### 1.3.3 事件驱动检测流程

```
1. Pipeline 执行完成 → EventBus 发布 data_pipeline.completed 事件
2. DataQualityScheduler 监听事件，查找关联的质量规则（pipelineId/stageId 匹配）
3. 对每个 enabled 规则执行 detect() 方法
4. 将检测结果写入 data_quality_reports
5. 如果规则 severity=critical 且检测失败 → 发布 quality_check.failed 事件
6. 告警服务订阅 quality_check.failed → 发送通知/创建工单
```

### 1.4 质量评分

#### 1.4.1 单表质量评分算法

```
单表质量分数 = SUM(规则得分 * 规则权重) / SUM(规则权重) * 100

规则得分计算：
- passed: 100 分
- warning: 60 分
- failed: 0 分

权重配置：
- critical 规则: 权重 = 3
- warning 规则: 权重 = 2
- info 规则: 权重 = 1
```

#### 1.4.2 数据源整体评分

```
数据源评分 = 该数据源下所有表评分的加权平均

权重因子：
- 表的行数越多，权重越大（log10(row_count)）
- 被标记为关键表的权重 * 2
```

#### 1.4.3 评分等级映射

| 评分区间 | 等级 | 颜色 | 含义 |
|---------|------|------|------|
| 90-100 | A | green | 优秀 |
| 80-89 | B | blue | 良好 |
| 70-79 | C | yellow | 一般，需关注 |
| 60-69 | D | orange | 较差，需整改 |
| 0-59 | F | red | 不合格，立即处理 |

#### 1.4.4 趋势分析

```typescript
interface QualityTrend {
  date: string;          // YYYY-MM-DD
  score: number;         // 0-100
  grade: string;         // A/B/C/D/F
  ruleCount: number;     // 检测规则数
  checkCount: number;    // 检测执行次数
  failCount: number;     // 失败次数
}
```

前端使用 Ant Design `Line` 图表渲染 30 天评分趋势曲线。

### 1.5 问题跟踪

#### 1.5.1 质量事件记录

每次规则检测失败时生成一条质量事件（存储在 `data_quality_reports.failed_checks` JSONB 字段中）：

```typescript
interface QualityIssue {
  id: string;
  ruleId: string;
  ruleName: string;
  detectedAt: Date;
  severity: 'critical' | 'warning' | 'info';
  targetType: 'table' | 'column' | 'row' | 'pipeline';
  targetName: string;         // 表名/列名
  failureRate: number;        // 失败比例
  failureSamples: unknown[];  // 失败样本（最多 10 条）
  errorMessage?: string;      // SQL 执行错误信息
  assignedTo?: string;        // 责任人 user ID
  status: 'open' | 'investigating' | 'fixed' | 'accepted' | 'closed';
  rootCause?: string;         // 根因分析
  resolution?: string;        // 解决措施
  fixedAt?: Date;
}
```

#### 1.5.2 严重级别

| 级别 | 触发条件 | 默认行为 |
|------|---------|---------|
| **critical** | 关键规则失败，failure_rate > 5% | 阻断 pipeline + 立即告警 + 自动创建工单 |
| **warning** | 非关键规则失败，failure_rate > 1% | 发送通知 + 记录事件 |
| **info** | 信息类规则异常 | 仅记录事件 |

#### 1.5.3 处理状态流转

```
open → investigating → fixed → closed
  ↓                      ↓
accepted (接受风险)       open (重新打开)
```

### 1.6 报告生成

#### 1.6.1 报告类型

| 类型 | 标识 | 内容 | 生成时机 |
|------|------|------|---------|
| **单次检测报告** | `single_run` | 一次规则执行的完整结果 | 每次检测完成后自动生成 |
| **日报** | `daily` | 当日所有检测汇总 + 评分 | 每日 00:00 自动生成 |
| **周报** | `weekly` | 本周趋势 + Top N 问题 | 每周一 08:00 自动生成 |
| **月报** | `monthly` | 本月质量评分变化 + 整改统计 | 每月 1 日 08:00 自动生成 |

#### 1.6.2 报告数据结构

```typescript
interface DataQualityReport {
  id: string;
  tenantId: string;
  pipelineId?: string;
  reportType: 'single_run' | 'daily' | 'weekly' | 'monthly';
  periodStart: Date;
  periodEnd: Date;
  overallScore: number;      // 综合评分 0-100
  overallGrade: string;      // A/B/C/D/F
  totalRules: number;        // 规则总数
  rulesPassed: number;       // 通过的规则数
  rulesFailed: number;       // 失败的规则数
  rulesWarning: number;      // 告警的规则数
  totalChecks: number;       // 检测执行总数
  totalRecords: number;      // 检测的总记录数
  failedChecks: QualityIssue[]; // 失败详情
  trendScore?: number;       // 较上一周期的评分变化（可正可负）
  topIssues: QualityIssue[]; // Top N 问题
  generatedAt: Date;
  createdBy?: string;        // 'system' 表示自动生成
}
```

#### 1.6.3 报告内容模块

1. **评分概览**：综合评分、等级、趋势箭头
2. **规则执行统计**：按类型/严重级别分组的柱状图
3. **Top 10 问题表**：按 failure_rate 排序的问题列表
4. **评分趋势图**：30 天评分折线图
5. **数据源排名**：按质量评分排序的数据源列表
6. **整改建议**：基于规则失败模式的 AI 建议

### 1.7 外部依赖

| 依赖 | 用途 | 依赖类型 |
|------|------|---------|
| **PostgreSQL** | 规则/报告持久化 | 必需 |
| **data_pipelines 模块** | 数据源连接和管道执行 | 必需（已有） |
| **quality_gates 模块** | 质量阻断策略 | 可选集成 |
| **Cron 调度器** | 定时检测任务 | 可选（已有 cron 模块） |
| **EventBus** | 事件驱动检测触发 | 可选（已有 event_bus） |
| **Notification 服务** | 告警通知 | 可选（已有 notification 模块） |
| **AI Agent** | 根因分析和整改建议 | 可选增强 |

**不依赖外部数据源**：所有检测在当前租户的 PostgreSQL 数据库内执行，不涉及外部数据库连接（外部数据源通过 data_pipelines 的 ETL 同步后检测）。

### 1.8 权限模型

```
Resource: data_quality

Action      | 角色                                    | 说明
-----------|-----------------------------------------|------
read       | 所有已认证用户                            | 查看报告/规则/仪表盘
write      | platform_admin, data_owner, data_steward | 创建/编辑规则
execute    | platform_admin, data_owner                | 手动触发检测
delete     | platform_admin                           | 删除规则/报告
admin      | platform_admin                           | 配置调度/分配责任人
```

**租户隔离**：所有 API 查询自动过滤 `tenant_id`，RLS 策略确保租户间数据不可见。

**数据所有权**：通过 `data_quality_rules.created_by` 字段追踪创建者，支持按数据域分配 data_owner。

---

## 2. DDL 设计（迁移 190）

### 2.1 190_create_data_quality_tables.sql

```sql
-- Migration: 190_create_data_quality_tables
-- Description: 数据质量平台 — 规则定义和检测报告表
-- Created: 2026-05-22

-- ============================================================
-- 1. 数据质量规则表
-- ============================================================
CREATE TABLE IF NOT EXISTS data_quality_rules (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,

    -- 关联
    pipeline_id         UUID,                           -- 关联 data_pipelines
    stage_id            VARCHAR(100),                   -- Pipeline stage ID

    -- 规则基本信息
    name                VARCHAR(200) NOT NULL,
    description         TEXT,
    rule_type           VARCHAR(30) NOT NULL,            -- not_null, unique, range, format_pattern, enum_values, cross_table_consistency, numeric_range, logical_constraint, outlier_detection, freshness, update_frequency, custom_sql, custom_function, completeness_rate, row_count_min, row_count_range, referential
    severity            VARCHAR(20) NOT NULL DEFAULT 'warning', -- critical, warning, info

    -- 检测目标
    target_table        VARCHAR(200) NOT NULL,           -- 检测的表名
    target_field        VARCHAR(200),                    -- 检测的列名（可为空）
    target_condition    TEXT,                            -- WHERE 过滤条件

    -- 规则配置（JSONB，根据 rule_type 存储不同结构）
    condition           JSONB DEFAULT '{}',              -- 规则参数
    weight              INTEGER DEFAULT 2,               -- 评分权重 1-5

    -- 调度配置
    schedule_mode       VARCHAR(20) NOT NULL DEFAULT 'manual', -- cron, event, manual
    cron_expression     VARCHAR(100),                    -- cron 模式专用
    timezone            VARCHAR(50) DEFAULT 'Asia/Shanghai',
    trigger_event       VARCHAR(100),                    -- event 模式专用
    trigger_filter      JSONB DEFAULT '{}',              -- 事件过滤条件

    -- 状态
    enabled             BOOLEAN NOT NULL DEFAULT true,
    created_by          VARCHAR(100) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for data_quality_rules
CREATE INDEX idx_dqr_tenant ON data_quality_rules(tenant_id);
CREATE INDEX idx_dqr_pipeline ON data_quality_rules(pipeline_id);
CREATE INDEX idx_dqr_type ON data_quality_rules(rule_type);
CREATE INDEX idx_dqr_severity ON data_quality_rules(severity);
CREATE INDEX idx_dqr_enabled ON data_quality_rules(enabled) WHERE enabled = true;
CREATE INDEX idx_dqr_schedule ON data_quality_rules(schedule_mode, enabled) WHERE schedule_mode != 'manual';

-- Comments
COMMENT ON TABLE data_quality_rules IS '数据质量检测规则定义';
COMMENT ON COLUMN data_quality_rules.condition IS '规则参数，根据 rule_type 存储不同结构：not_null={}, range={min,max}, format_pattern={pattern}, enum_values={values}, cross_table_consistency={ref_table,ref_field}, numeric_range={min,max}, logical_constraint={expression}, outlier_detection={iqr_multiplier}, freshness={max_delay_minutes,timestamp_field}, update_frequency={period,min_count}, custom_sql={sql}, custom_function={function_name}, completeness_rate={threshold}, row_count_min={min_value}, row_count_range={min_value,max_value}, referential={ref_table,ref_field}';
COMMENT ON COLUMN data_quality_rules.weight IS '评分权重，1-5，默认 2';

-- ============================================================
-- 2. 数据质量检测报告表
-- ============================================================
CREATE TABLE IF NOT EXISTS data_quality_reports (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,

    -- 关联
    pipeline_id         UUID,
    rule_id             UUID REFERENCES data_quality_rules(id) ON DELETE SET NULL,

    -- 报告信息
    report_type         VARCHAR(20) NOT NULL DEFAULT 'single_run', -- single_run, daily, weekly, monthly
    period_start        TIMESTAMPTZ,
    period_end          TIMESTAMPTZ,

    -- 检测结果
    status              VARCHAR(20) NOT NULL DEFAULT 'completed', -- pending, running, completed, failed
    overall_score       NUMERIC(5, 2),                   -- 0.00-100.00
    overall_grade       VARCHAR(1),                      -- A/B/C/D/F

    -- 统计
    total_rules         INTEGER DEFAULT 0,
    rules_passed        INTEGER DEFAULT 0,
    rules_failed        INTEGER DEFAULT 0,
    rules_warning       INTEGER DEFAULT 0,
    total_checks        INTEGER DEFAULT 0,
    total_records       BIGINT DEFAULT 0,                -- 检测的总数据行数

    -- 失败详情（JSONB 数组）
    failed_checks       JSONB DEFAULT '[]',              -- QualityIssue[]

    -- 趋势
    trend_score         NUMERIC(5, 2),                   -- 较上一周期的评分变化

    -- 生成信息
    generated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          VARCHAR(100) DEFAULT 'system',

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for data_quality_reports
CREATE INDEX idx_dqrp_tenant ON data_quality_reports(tenant_id);
CREATE INDEX idx_dqrp_pipeline ON data_quality_reports(pipeline_id);
CREATE INDEX idx_dqrp_rule ON data_quality_reports(rule_id);
CREATE INDEX idx_dqrp_type ON data_quality_reports(report_type);
CREATE INDEX idx_dqrp_status ON data_quality_reports(status);
CREATE INDEX idx_dqrp_grade ON data_quality_reports(overall_grade);
CREATE INDEX idx_dqrp_generated ON data_quality_reports(generated_at DESC);
CREATE INDEX idx_dqrp_period ON data_quality_reports(period_start, period_end);
CREATE INDEX idx_dqrp_tenant_period ON data_quality_reports(tenant_id, generated_at DESC);

-- Comments
COMMENT ON TABLE data_quality_reports IS '数据质量检测报告和事件记录';
COMMENT ON COLUMN data_quality_reports.failed_checks IS '失败详情数组，每项包含：{id, ruleId, ruleName, detectedAt, severity, targetType, targetName, failureRate, failureSamples, errorMessage, assignedTo, status, rootCause, resolution, fixedAt}';
COMMENT ON COLUMN data_quality_reports.trend_score IS '较上一报告周期的评分变化，正数表示提升，负数表示下降';

-- ============================================================
-- 3. Updated At Trigger Function
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER set_dqr_updated_at
    BEFORE UPDATE ON data_quality_rules
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_dqrp_updated_at
    BEFORE UPDATE ON data_quality_reports
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
```

### 2.2 190_rollback_data_quality_tables.sql

```sql
-- Rollback: 190_create_data_quality_tables
-- Drops data quality tables and triggers

DROP TRIGGER IF EXISTS set_dqr_updated_at ON data_quality_rules;
DROP TRIGGER IF EXISTS set_dqrp_updated_at ON data_quality_reports;
DROP FUNCTION IF EXISTS trigger_set_updated_at();

DROP TABLE IF EXISTS data_quality_reports;
DROP TABLE IF EXISTS data_quality_rules;
```

---

## 3. API 设计

### 3.1 路由注册

在 `orion-platform-service/src/api/routes.ts` 中新增：

```typescript
import dataQualityRoutes from './data-quality-routes';
// ...
await registerWithRoleGuard(app, dataQualityRoutes, '/data-quality', {
  database: options.database,
});
```

### 3.2 端点清单

所有端点挂载在 `/v1/data-quality` 前缀下。

#### 规则管理

| 方法 | 路径 | 权限 | 描述 |
|------|------|------|------|
| GET | `/rules` | `data_quality:read` | 获取规则列表（?pipelineId=&type=&severity=&enabled=） |
| POST | `/rules` | `data_quality:write` | 创建质量规则 |
| GET | `/rules/:id` | `data_quality:read` | 获取规则详情 |
| PUT | `/rules/:id` | `data_quality:write` | 更新规则 |
| DELETE | `/rules/:id` | `data_quality:delete` | 删除规则 |
| POST | `/rules/:id/toggle` | `data_quality:write` | 启用/禁用规则 |
| POST | `/rules/:id/execute` | `data_quality:execute` | 手动触发规则检测 |
| GET | `/rules/:id/history` | `data_quality:read` | 获取规则检测历史 |
| POST | `/rules/batch-toggle` | `data_quality:admin` | 批量启用/禁用规则 |
| GET | `/rules/templates` | `data_quality:read` | 获取规则模板列表（预定义规则） |

#### 报告管理

| 方法 | 路径 | 权限 | 描述 |
|------|------|------|------|
| GET | `/reports` | `data_quality:read` | 获取报告列表（?type=&grade=&periodStart=&periodEnd=&page=&perPage=） |
| POST | `/reports` | `data_quality:write` | 手动生成报告（指定 pipeline 和报告类型） |
| GET | `/reports/:id` | `data_quality:read` | 获取报告详情 |
| DELETE | `/reports/:id` | `data_quality:delete` | 删除报告 |
| GET | `/reports/stats` | `data_quality:read` | 获取报告统计（规则通过率、评分分布） |

#### 评分与趋势

| 方法 | 路径 | 权限 | 描述 |
|------|------|------|------|
| GET | `/scores/overview` | `data_quality:read` | 获取质量评分概览（当前评分、等级、趋势） |
| GET | `/scores/trend` | `data_quality:read` | 获取评分趋势数据（?days=30&pipelineId=） |
| GET | `/scores/by-source` | `data_quality:read` | 按数据源/表排名 |

#### 问题跟踪

| 方法 | 路径 | 权限 | 描述 |
|------|------|------|------|
| GET | `/issues` | `data_quality:read` | 获取问题列表（?status=&severity=&assignedTo=&page=&perPage=） |
| GET | `/issues/:id` | `data_quality:read` | 获取问题详情 |
| PUT | `/issues/:id/assign` | `data_quality:admin` | 分配责任人 |
| PUT | `/issues/:id/status` | `data_quality:write` | 更新处理状态 |
| PUT | `/issues/:id/resolve` | `data_quality:write` | 标记解决（填写 rootCause + resolution） |

#### 调度管理

| 方法 | 路径 | 权限 | 描述 |
|------|------|------|------|
| GET | `/schedules` | `data_quality:read` | 获取调度配置列表 |
| POST | `/schedules` | `data_quality:admin` | 创建/更新调度配置 |
| PUT | `/schedules/:ruleId` | `data_quality:admin` | 更新规则调度配置 |

### 3.3 请求/响应示例

**创建规则**：

```json
// POST /v1/data-quality/rules
{
  "pipelineId": "dp-123",
  "name": "用户表邮箱格式校验",
  "description": "检查 users 表中 email 字段是否符合邮箱格式",
  "ruleType": "format_pattern",
  "severity": "critical",
  "targetTable": "users",
  "targetField": "email",
  "targetCondition": "created_at >= '2026-01-01'",
  "condition": { "pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$" },
  "weight": 3,
  "scheduleMode": "cron",
  "cronExpression": "0 2 * * *",
  "timezone": "Asia/Shanghai"
}

// Response 201
{
  "id": "dqr-abc-123",
  "tenantId": "t-001",
  "pipelineId": "dp-123",
  "name": "用户表邮箱格式校验",
  "ruleType": "format_pattern",
  "severity": "critical",
  "targetTable": "users",
  "targetField": "email",
  "enabled": true,
  "scheduleMode": "cron",
  "cronExpression": "0 2 * * *",
  "createdAt": "2026-05-22T10:00:00Z"
}
```

**获取评分趋势**：

```
GET /v1/data-quality/scores/trend?days=30&pipelineId=dp-123

// Response 200
{
  "data": [
    { "date": "2026-04-22", "score": 87.5, "grade": "B", "ruleCount": 12, "checkCount": 24, "failCount": 1 },
    { "date": "2026-04-23", "score": 91.2, "grade": "A", "ruleCount": 12, "checkCount": 24, "failCount": 0 },
    // ...
  ],
  "trend": "+3.7",
  "currentScore": 92.1,
  "currentGrade": "A"
}
```

**更新问题状态**：

```json
// PUT /v1/data-quality/issues/:id/status
{
  "status": "investigating"
}

// PUT /v1/data-quality/issues/:id/resolve
{
  "status": "fixed",
  "rootCause": "数据导入脚本未处理空值情况",
  "resolution": "修复导入脚本 v2.1.0，增加空值过滤逻辑"
}
```

---

## 4. 后端服务设计

### 4.1 DataQualityRuleService

```typescript
// orion-platform-service/src/services/data-quality/DataQualityRuleService.ts
// 扩展现有 DataQualityService

interface DataQualityRuleService {
  // CRUD
  createRule(tenantId, input): Promise<DataQualityRule>
  getRules(tenantId, filters): Promise<DataQualityRule[]>
  getRule(id): Promise<DataQualityRule | null>
  updateRule(id, updates, updatedBy): Promise<DataQualityRule>
  deleteRule(id): Promise<boolean>
  toggleRule(id): Promise<DataQualityRule>

  // 执行
  executeRule(ruleId, data?, executionId?): Promise<ValidationResult>
  executePipelineRules(tenantId, pipelineId): Promise<ValidationResult[]>

  // 规则模板
  getRuleTemplates(): Promise<RuleTemplate[]>
}
```

### 4.2 DataQualityReportService

```typescript
// orion-platform-service/src/services/data-quality/DataQualityReportService.ts

interface DataQualityReportService {
  // 报告
  createReport(input): Promise<DataQualityReport>
  getReports(tenantId, filters): Promise<DataQualityReport[]>
  getReport(id): Promise<DataQualityReport | null>
  generateReport(tenantId, type, period): Promise<DataQualityReport>

  // 评分
  getScoreOverview(tenantId, pipelineId?): Promise<ScoreOverview>
  getScoreTrend(tenantId, days, pipelineId?): Promise<QualityTrend[]>
  getScoresBySource(tenantId, limit?): Promise<SourceScore[]>

  // 问题
  getIssues(tenantId, filters): Promise<QualityIssue[]>
  getIssue(id): Promise<QualityIssue | null>
  assignIssue(id, assignedTo): Promise<QualityIssue>
  updateIssueStatus(id, status): Promise<QualityIssue>
  resolveIssue(id, rootCause, resolution): Promise<QualityIssue>

  // 统计
  getReportStats(tenantId): Promise<ReportStats>
}
```

### 4.3 DataQualityScheduler

```typescript
// orion-platform-service/src/services/data-quality/DataQualityScheduler.ts
// 定时调度 + 事件驱动

interface DataQualityScheduler {
  start(): Promise<void>
  stop(): Promise<void>
  registerCronJobs(): Promise<void>
  handlePipelineCompleted(event: DataPipelineCompletedEvent): Promise<void>
}
```

---

## 5. 页面交互设计（前端）

### 5.1 页面清单与路由

| 页面 | 路由 | 组件文件 | 描述 |
|------|------|---------|------|
| 质量仪表盘 | `/data-quality/dashboard` | `DataQualityDashboard` | 总览：评分、趋势、Top 问题 |
| 规则列表 | `/data-quality/rules` | `DataQualityRules` | 规则 CRUD 列表 |
| 创建/编辑规则 | `/data-quality/rules/new`, `/data-quality/rules/:id/edit` | `DataQualityRuleEditor` | 规则表单 |
| 检测报告 | `/data-quality/reports` | `DataQualityReports` | 报告列表 |
| 报告详情 | `/data-quality/reports/:id` | `DataQualityReportDetail` | 报告详情 + 趋势图 |
| 问题跟踪 | `/data-quality/issues` | `DataQualityIssues` | 质量问题列表 |
| 问题详情 | `/data-quality/issues/:id` | `DataQualityIssueDetail` | 问题详情 + 处理 |

### 5.2 路由注册

在 `orion-frontend/src/router/routes.tsx` 中新增：

```tsx
// 数据质量平台
{
  path: '/data-quality',
  element: React.lazy(() => import('@/pages/data-quality/DataQualityLayout')),
  protected: true,
  children: [
    {
      index: true,
      element: React.createElement(Navigate, { to: '/data-quality/dashboard', replace: true }),
    },
    {
      path: '/data-quality/dashboard',
      element: React.lazy(() => import('@/pages/data-quality/DataQualityDashboard')),
      protected: true,
    },
    {
      path: '/data-quality/rules',
      element: React.lazy(() => import('@/pages/data-quality/DataQualityRules')),
      protected: true,
    },
    {
      path: '/data-quality/rules/new',
      element: React.lazy(() => import('@/pages/data-quality/DataQualityRuleEditor')),
      protected: true,
    },
    {
      path: '/data-quality/rules/:id/edit',
      element: React.lazy(() => import('@/pages/data-quality/DataQualityRuleEditor')),
      protected: true,
    },
    {
      path: '/data-quality/reports',
      element: React.lazy(() => import('@/pages/data-quality/DataQualityReports')),
      protected: true,
    },
    {
      path: '/data-quality/reports/:id',
      element: React.lazy(() => import('@/pages/data-quality/DataQualityReportDetail')),
      protected: true,
    },
    {
      path: '/data-quality/issues',
      element: React.lazy(() => import('@/pages/data-quality/DataQualityIssues')),
      protected: true,
    },
    {
      path: '/data-quality/issues/:id',
      element: React.lazy(() => import('@/pages/data-quality/DataQualityIssueDetail')),
      protected: true,
    },
  ],
},
```

### 5.3 前端 API 客户端

文件：`orion-frontend/src/api/data-quality.ts`

```typescript
import { api } from './client';

// ---- Types ----

export type RuleType =
  | 'not_null' | 'unique' | 'numeric_range' | 'format_pattern' | 'enum_values'
  | 'cross_table_consistency' | 'logical_constraint' | 'outlier_detection'
  | 'freshness' | 'update_frequency' | 'custom_sql' | 'custom_function'
  | 'completeness_rate' | 'row_count_min' | 'row_count_range' | 'referential';

export type RuleSeverity = 'critical' | 'warning' | 'info';
export type ScheduleMode = 'cron' | 'event' | 'manual';
export type ReportType = 'single_run' | 'daily' | 'weekly' | 'monthly';
export type ReportGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export type IssueStatus = 'open' | 'investigating' | 'fixed' | 'accepted' | 'closed';

export interface DataQualityRule {
  id: string;
  tenantId: string;
  pipelineId?: string;
  stageId?: string;
  name: string;
  description?: string;
  ruleType: RuleType;
  severity: RuleSeverity;
  targetTable: string;
  targetField?: string;
  targetCondition?: string;
  condition: Record<string, unknown>;
  weight: number;
  scheduleMode: ScheduleMode;
  cronExpression?: string;
  timezone?: string;
  triggerEvent?: string;
  triggerFilter?: Record<string, string>;
  enabled: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRuleInput {
  pipelineId?: string;
  name: string;
  description?: string;
  ruleType: RuleType;
  severity?: RuleSeverity;
  targetTable: string;
  targetField?: string;
  targetCondition?: string;
  condition: Record<string, unknown>;
  weight?: number;
  scheduleMode?: ScheduleMode;
  cronExpression?: string;
  timezone?: string;
  triggerEvent?: string;
  triggerFilter?: Record<string, string>;
}

export interface DataQualityReport {
  id: string;
  tenantId: string;
  pipelineId?: string;
  ruleId?: string;
  reportType: ReportType;
  periodStart?: string;
  periodEnd?: string;
  status: string;
  overallScore?: number;
  overallGrade?: ReportGrade;
  totalRules: number;
  rulesPassed: number;
  rulesFailed: number;
  rulesWarning: number;
  totalChecks: number;
  totalRecords: number;
  failedChecks: unknown[];
  trendScore?: number;
  generatedAt: string;
  createdBy?: string;
}

export interface QualityIssue {
  id: string;
  ruleId: string;
  ruleName: string;
  detectedAt: string;
  severity: RuleSeverity;
  targetType: string;
  targetName: string;
  failureRate: number;
  failureSamples: unknown[];
  errorMessage?: string;
  assignedTo?: string;
  status: IssueStatus;
  rootCause?: string;
  resolution?: string;
  fixedAt?: string;
}

export interface ScoreOverview {
  currentScore: number;
  currentGrade: ReportGrade;
  trend: string;
  ruleCount: number;
  totalChecks: number;
  passRate: number;
}

export interface QualityTrend {
  date: string;
  score: number;
  grade: ReportGrade;
  ruleCount: number;
  checkCount: number;
  failCount: number;
}

export interface SourceScore {
  name: string;
  score: number;
  grade: ReportGrade;
  ruleCount: number;
}

export interface RuleTemplate {
  type: RuleType;
  name: string;
  description: string;
  defaultSeverity: RuleSeverity;
  defaultCondition: Record<string, unknown>;
}

// ---- Rules CRUD ----

export function getRules(params?: { pipelineId?: string; ruleType?: string; severity?: string; enabled?: boolean }) {
  return api.get<DataQualityRule[]>('/v1/data-quality/rules', { params });
}

export function getRule(id: string) {
  return api.get<DataQualityRule>(`/v1/data-quality/rules/${id}`);
}

export function createRule(data: CreateRuleInput) {
  return api.post<DataQualityRule>('/v1/data-quality/rules', data);
}

export function updateRule(id: string, data: Partial<CreateRuleInput>) {
  return api.put<DataQualityRule>(`/v1/data-quality/rules/${id}`, data);
}

export function deleteRule(id: string) {
  return api.delete(`/v1/data-quality/rules/${id}`);
}

export function toggleRule(id: string) {
  return api.post<DataQualityRule>(`/v1/data-quality/rules/${id}/toggle`);
}

export function executeRule(id: string) {
  return api.post(`/v1/data-quality/rules/${id}/execute`);
}

export function getRuleHistory(id: string, params?: { page?: number; perPage?: number }) {
  return api.get(`/v1/data-quality/rules/${id}/history`, { params });
}

export function getRuleTemplates() {
  return api.get<RuleTemplate[]>('/v1/data-quality/rules/templates');
}

export function batchToggleRules(ids: string[], enabled: boolean) {
  return api.post('/v1/data-quality/rules/batch-toggle', { ids, enabled });
}

// ---- Reports ----

export function getReports(params?: { reportType?: string; grade?: string; periodStart?: string; periodEnd?: string; page?: number; perPage?: number }) {
  return api.get<DataQualityReport[]>('/v1/data-quality/reports', { params });
}

export function getReport(id: string) {
  return api.get<DataQualityReport>(`/v1/data-quality/reports/${id}`);
}

export function generateReport(data: { reportType: ReportType; pipelineId?: string }) {
  return api.post<DataQualityReport>('/v1/data-quality/reports', data);
}

export function deleteReport(id: string) {
  return api.delete(`/v1/data-quality/reports/${id}`);
}

export function getReportStats() {
  return api.get('/v1/data-quality/reports/stats');
}

// ---- Scores & Trends ----

export function getScoreOverview(params?: { pipelineId?: string }) {
  return api.get<ScoreOverview>('/v1/data-quality/scores/overview', { params });
}

export function getScoreTrend(params?: { days?: number; pipelineId?: string }) {
  return api.get<{ data: QualityTrend[]; trend: string; currentScore: number; currentGrade: ReportGrade }>(
    '/v1/data-quality/scores/trend', { params }
  );
}

export function getScoresBySource(params?: { limit?: number }) {
  return api.get<SourceScore[]>('/v1/data-quality/scores/by-source', { params });
}

// ---- Issues ----

export function getIssues(params?: { status?: string; severity?: string; assignedTo?: string; page?: number; perPage?: number }) {
  return api.get<QualityIssue[]>('/v1/data-quality/issues', { params });
}

export function getIssue(id: string) {
  return api.get<QualityIssue>(`/v1/data-quality/issues/${id}`);
}

export function assignIssue(id: string, assignedTo: string) {
  return api.put<QualityIssue>(`/v1/data-quality/issues/${id}/assign`, { assignedTo });
}

export function updateIssueStatus(id: string, status: IssueStatus) {
  return api.put<QualityIssue>(`/v1/data-quality/issues/${id}/status`, { status });
}

export function resolveIssue(id: string, rootCause: string, resolution: string) {
  return api.put<QualityIssue>(`/v1/data-quality/issues/${id}/resolve`, { rootCause, resolution });
}
```

### 5.4 页面详细交互设计

#### 5.4.1 质量仪表盘 `/data-quality/dashboard`

文件：`orion-frontend/src/pages/data-quality/DataQualityDashboard.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { Title, Typography, Row, Col, Card, Statistic, Select, Spin } from 'antd';
import { RadarChartOutlined, TrendingUpOutlined, WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { Line, Column } from '@ant-design/charts';
import { colors } from '@/tokens/colors';
import { componentRadius } from '@/tokens/radius';
import { spacing } from '@/tokens/spacing';
import { getScoreOverview, getScoreTrend, getScoresBySource, type ScoreOverview, type QualityTrend, type SourceScore } from '@/api/data-quality';
import { useSearchParams } from 'react-router-dom';

const { Text } = Typography;

const DataQualityDashboard: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [overview, setOverview] = useState<ScoreOverview | null>(null);
  const [trendData, setTrendData] = useState<QualityTrend[]>([]);
  const [sourceScores, setSourceScores] = useState<SourceScore[]>([]);
  const [pipelineId, setPipelineId] = useState<string | undefined>(searchParams.get('pipelineId') || undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const [ov, tr, sc] = await Promise.all([
          getScoreOverview(pipelineId ? { pipelineId } : undefined),
          getScoreTrend({ days: 30, pipelineId }),
          getScoresBySource({ limit: 10 }),
        ]);
        setOverview(ov.data);
        setTrendData(tr.data.data);
        setSourceScores(sc.data);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [pipelineId]);

  if (loading) return <Spin style={{ display: 'block', margin: '80px auto' }} />;

  const scoreColor = overview
    ? overview.currentScore >= 90 ? colors.success[500]
    : overview.currentScore >= 80 ? colors.primary[500]
    : overview.currentScore >= 70 ? colors.warning[500]
    : colors.error[500]
    : '#000';

  return (
    <div style={{ padding: spacing.lg }}>
      {/* 标题 */}
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <RadarChartOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        数据质量仪表盘
      </Title>
      <Text style={{ color: colors.neutral[500], marginBottom: spacing.md, display: 'block' }}>
        综合评分与趋势分析
      </Text>

      {/* 筛选 */}
      <div style={{ marginBottom: spacing.md }}>
        <Select
          placeholder="按数据管道筛选"
          allowClear
          value={pipelineId}
          onChange={setPipelineId}
          style={{ width: 240 }}
          options={[{ value: 'dp-123', label: '用户数据同步' }, { value: 'dp-456', label: '订单数据导入' }]}
        />
      </div>

      {/* 评分卡片 */}
      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <Card style={{ borderRadius: componentRadius.card, boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}>
            <Statistic
              title="综合评分"
              value={overview?.currentScore ?? 0}
              suffix="/ 100"
              valueStyle={{ color: scoreColor, fontSize: 32, fontWeight: 600 }}
            />
            <Text type="secondary" style={{ marginLeft: spacing.xs }}>
              等级: {overview?.currentGrade ?? '-'}
            </Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: componentRadius.card, boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}>
            <Statistic
              title="趋势"
              value={overview?.trend ?? '0'}
              prefix={<TrendingUpOutlined style={{ color: Number(overview?.trend) >= 0 ? colors.success[500] : colors.error[500] }} />}
              suffix="分"
              valueStyle={{ color: Number(overview?.trend) >= 0 ? colors.success[500] : colors.error[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: componentRadius.card, boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}>
            <Statistic
              title="规则通过率"
              value={(overview?.passRate ?? 0) * 100}
              prefix={<CheckCircleOutlined style={{ color: colors.success[500] }} />}
              suffix="%"
              valueStyle={{ color: colors.success[500] }}
              precision={1}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: componentRadius.card, boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}>
            <Statistic
              title="活跃规则数"
              value={overview?.ruleCount ?? 0}
              prefix={<WarningOutlined style={{ color: colors.warning[500] }} />}
              valueStyle={{ color: colors.neutral[900] }}
            />
          </Card>
        </Col>
      </Row>

      {/* 趋势图 */}
      <Card title="30 天评分趋势" style={{ borderRadius: componentRadius.card, marginBottom: spacing.md, boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}>
        <Line
          data={trendData.map(d => ({ date: d.date, score: d.score, grade: d.grade }))}
          xField="date"
          yField="score"
          seriesField="grade"
          height={280}
          smooth
          color={[colors.success[500], colors.primary[500], colors.warning[500], colors.error[500], '#f5222d']}
        />
      </Card>

      {/* 数据源排名 */}
      <Card title="数据源质量排名" style={{ borderRadius: componentRadius.card, boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}>
        <Column
          data={sourceScores}
          xField="name"
          yField="score"
          height={300}
          color={colors.primary[500]}
        />
      </Card>
    </div>
  );
};

export default DataQualityDashboard;
```

**交互链审查**：

| 元素 | 交互 | 反馈 |
|------|------|------|
| 数据管道筛选 Select | onChange 重新加载数据 | loading 状态 + 数据刷新 |
| 评分统计卡片 | 只读展示 | 无交互，数值颜色反映等级 |
| 趋势图表 | 悬浮 tooltip 显示详细信息 | Ant Design Charts 内置交互 |
| 数据源排名图 | 点击柱状图可筛选 | 可扩展跳转到对应规则列表 |

#### 5.4.2 质量规则列表 `/data-quality/rules`

文件：`orion-frontend/src/pages/data-quality/DataQualityRules.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Input, Select, Popconfirm, Modal, Form, message, Empty, Spin, Typography, Dropdown } from 'antd';
import { PlusOutlined, SearchOutlined, FilterOutlined, EditOutlined, DeleteOutlined, PoweroffOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { colors } from '@/tokens/colors';
import { componentRadius } from '@/tokens/radius';
import { spacing } from '@/tokens/spacing';
import { getRules, deleteRule, toggleRule, executeRule, type DataQualityRule } from '@/api/data-quality';

const { Title, Text } = Typography;
const { Search } = Input;

const severityColorMap: Record<string, string> = {
  critical: colors.error[500],
  warning: colors.warning[500],
  info: colors.info[500],
};

const typeLabelMap: Record<string, string> = {
  not_null: '非空检查', unique: '唯一性', numeric_range: '数值范围',
  format_pattern: '格式校验', enum_values: '枚举值检查', cross_table_consistency: '跨表一致性',
  logical_constraint: '逻辑约束', outlier_detection: '异常值检测', freshness: '数据延迟',
  update_frequency: '更新频率', custom_sql: '自定义 SQL', custom_function: '自定义函数',
  completeness_rate: '完整率', row_count_min: '最小行数', row_count_range: '行数范围', referential: '外键引用',
};

const DataQualityRules: React.FC = () => {
  const navigate = useNavigate();
  const [rules, setRules] = useState<DataQualityRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [severityFilter, setSeverityFilter] = useState<string | undefined>();
  const [executingId, setExecutingId] = useState<string | null>(null);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await getRules({ ruleType: typeFilter, severity: severityFilter });
      setRules(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRules(); }, [typeFilter, severityFilter]);

  const filteredRules = rules.filter(r =>
    r.name.toLowerCase().includes(searchText.toLowerCase()) ||
    r.targetTable.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    try {
      await deleteRule(id);
      message.success('规则已删除');
      fetchRules();
    } catch {
      message.error('删除失败');
    }
  };

  const handleToggle = async (id: string) => {
    try {
      const res = await toggleRule(id);
      message.success(res.data.enabled ? '规则已启用' : '规则已禁用');
      fetchRules();
    } catch {
      message.error('操作失败');
    }
  };

  const handleExecute = async (id: string) => {
    setExecutingId(id);
    try {
      await executeRule(id);
      message.success('检测已触发，请查看报告');
    } catch {
      message.error('触发检测失败');
    } finally {
      setExecutingId(null);
    }
  };

  const columns = [
    {
      title: '规则名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: DataQualityRule) => (
        <a onClick={() => navigate(`/data-quality/rules/${record.id}/edit`)} style={{ color: colors.primary[500] }}>
          {text}
        </a>
      ),
    },
    {
      title: '规则类型',
      dataIndex: 'ruleType',
      key: 'ruleType',
      width: 140,
      render: (v: string) => <Tag>{typeLabelMap[v] || v}</Tag>,
    },
    {
      title: '严重级别',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (v: string) => (
        <Tag color={severityColorMap[v]}>{v === 'critical' ? '严重' : v === 'warning' ? '警告' : '信息'}</Tag>
      ),
    },
    {
      title: '检测目标',
      key: 'target',
      render: (_: unknown, record: DataQualityRule) => (
        <Text copyable={{ text: record.targetTable }}>
          {record.targetTable}{record.targetField ? `.${record.targetField}` : ''}
        </Text>
      ),
    },
    {
      title: '调度模式',
      dataIndex: 'scheduleMode',
      key: 'scheduleMode',
      width: 100,
      render: (v: string) => (
        <Tag color={v === 'cron' ? 'blue' : v === 'event' ? 'purple' : 'default'}>
          {v === 'cron' ? '定时' : v === 'event' ? '事件' : '手动'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (v: boolean) => (
        <Tag color={v ? 'success' : 'default'}>{v ? '启用' : '禁用'}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_: unknown, record: DataQualityRule) => (
        <Space>
          <Button type="link" size="small" icon={<PlayCircleOutlined />}
            loading={executingId === record.id}
            onClick={() => handleExecute(record.id)}
            disabled={!record.enabled}
          >
            执行
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />}
            onClick={() => navigate(`/data-quality/rules/${record.id}/edit`)}
          >
            编辑
          </Button>
          <Popconfirm title="确认删除此规则？" onConfirm={() => handleDelete(record.id)} okText="确认" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
          <Button type="link" size="small"
            onClick={() => handleToggle(record.id)}
            icon={<PoweroffOutlined />}
          >
            {record.enabled ? '禁用' : '启用'}
          </Button>
        </Space>
      ),
    },
  ];

  if (loading) return <Spin style={{ display: 'block', margin: '80px auto' }} />;

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <FilterOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        质量规则
      </Title>
      <Text style={{ color: colors.neutral[500], marginBottom: spacing.md, display: 'block' }}>
        管理和配置数据质量检测规则
      </Text>

      {/* 操作栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Space>
          <Search placeholder="搜索规则名称或表名" allowClear
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 300 }}
          />
          <Select placeholder="规则类型" allowClear value={typeFilter} onChange={setTypeFilter} style={{ width: 160 }}
            options={Object.entries(typeLabelMap).map(([k, v]) => ({ value: k, label: v }))}
          />
          <Select placeholder="严重级别" allowClear value={severityFilter} onChange={setSeverityFilter} style={{ width: 140 }}
            options={[{ value: 'critical', label: '严重' }, { value: 'warning', label: '警告' }, { value: 'info', label: '信息' }]}
          />
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/data-quality/rules/new')}>
          创建规则
        </Button>
      </div>

      {/* 表格 */}
      <Table
        columns={columns}
        dataSource={filteredRules}
        rowKey="id"
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条规则` }}
        locale={{ emptyText: <Empty description="暂无质量规则" image={Empty.PRESENTED_IMAGE_SIMPLE}>
          <Button type="primary" onClick={() => navigate('/data-quality/rules/new')}>创建第一条规则</Button>
        </Empty> }}
      />
    </div>
  );
};

export default DataQualityRules;
```

**CRUD 审查**：

| 操作 | 入口 | 状态 |
|------|------|------|
| Create | "创建规则" 按钮 → `/rules/new` | 有 |
| Read | 列表 + 名称点击查看详情 | 有 |
| Update | "编辑" 按钮 → `/rules/:id/edit` | 有 |
| Delete | "删除" 按钮 + Popconfirm 二次确认 | 有 |
| Execute | "执行" 按钮（手动触发检测） | 有 |
| Toggle | "启用/禁用" 按钮 | 有 |

**交互链审查**：

| 元素 | 交互 | 反馈 |
|------|------|------|
| 搜索框 | onChange 实时过滤 | 前端过滤，即时响应 |
| 规则类型/严重级别筛选 | onChange 重新请求后端 | loading 状态 + 数据刷新 |
| 规则名称链接 | onClick 跳转编辑页 | 路由导航 |
| 执行按钮 | onClick 触发检测 | loading 状态 + message.success/error |
| 编辑按钮 | onClick 跳转编辑页 | 路由导航 |
| 删除按钮 | Popconfirm 确认 → delete API | message.success/error + 刷新列表 |
| 启用/禁用按钮 | onClick 切换状态 | message.success/error + 刷新列表 |
| 空状态 | Empty + 引导按钮 | 有引导文字和创建按钮 |

#### 5.4.3 规则创建/编辑 `/data-quality/rules/new`, `/data-quality/rules/:id/edit`

文件：`orion-frontend/src/pages/data-quality/DataQualityRuleEditor.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { Form, Input, Select, Button, Card, Space, message, Spin, Typography } from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { colors } from '@/tokens/colors';
import { componentRadius } from '@/tokens/radius';
import { spacing } from '@/tokens/spacing';
import { getRule, createRule, updateRule, getRuleTemplates, type RuleType, type RuleSeverity, type ScheduleMode } from '@/api/data-quality';

const { Title } = Typography;
const { TextArea } = Input;

const DataQualityRuleEditor: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ruleType, setRuleType] = useState<RuleType | undefined>();
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('manual');

  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      getRule(id!).then(res => {
        form.setFieldsValue(res.data);
        setRuleType(res.data.ruleType);
        setScheduleMode(res.data.scheduleMode);
      }).finally(() => setLoading(false));
    }
  }, [id]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (isEdit) {
        await updateRule(id!, values);
        message.success('规则已更新');
      } else {
        await createRule(values);
        message.success('规则已创建');
      }
      navigate('/data-quality/rules');
    } catch {
      message.error(isEdit ? '更新失败' : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 根据 ruleType 渲染动态表单字段
  const renderConditionFields = () => {
    switch (ruleType) {
      case 'not_null':
        return <></>; // 无需额外配置
      case 'numeric_range':
        return (
          <>
            <Form.Item label="最小值" name={['condition', 'min']} rules={[{ type: 'number' }]}>
              <Input type="number" placeholder="可选" style={{ maxWidth: 700 }} />
            </Form.Item>
            <Form.Item label="最大值" name={['condition', 'max']} rules={[{ type: 'number' }]}>
              <Input type="number" placeholder="可选" style={{ maxWidth: 700 }} />
            </Form.Item>
          </>
        );
      case 'format_pattern':
        return (
          <Form.Item label="正则表达式" name={['condition', 'pattern']}
            rules={[{ required: true, message: '请输入正则表达式' }]}>
            <Input placeholder="^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$" style={{ maxWidth: 700 }} />
          </Form.Item>
        );
      case 'enum_values':
        return (
          <Form.Item label="枚举值列表" name={['condition', 'values']}
            rules={[{ required: true, message: '请输入枚举值，逗号分隔' }]}>
            <Input placeholder="value1, value2, value3" style={{ maxWidth: 700 }} />
          </Form.Item>
        );
      case 'cross_table_consistency':
      case 'referential':
        return (
          <>
            <Form.Item label="引用表" name={['condition', 'ref_table']} rules={[{ required: true, message: '请输入引用表名' }]}>
              <Input placeholder="ref_table_name" style={{ maxWidth: 700 }} />
            </Form.Item>
            <Form.Item label="引用字段" name={['condition', 'ref_field']} rules={[{ required: true, message: '请输入引用字段名' }]}>
              <Input placeholder="ref_field_name" style={{ maxWidth: 700 }} />
            </Form.Item>
          </>
        );
      case 'outlier_detection':
        return (
          <Form.Item label="IQR 倍数" name={['condition', 'iqr_multiplier']} initialValue={1.5}
            rules={[{ required: true, type: 'number' }]}>
            <Input type="number" step={0.1} style={{ maxWidth: 700 }} />
          </Form.Item>
        );
      case 'freshness':
        return (
          <>
            <Form.Item label="时间字段" name={['condition', 'timestamp_field']} rules={[{ required: true, message: '请输入时间字段名' }]}>
              <Input placeholder="updated_at" style={{ maxWidth: 700 }} />
            </Form.Item>
            <Form.Item label="最大延迟（分钟）" name={['condition', 'max_delay_minutes']} rules={[{ required: true, type: 'number' }]}>
              <Input type="number" style={{ maxWidth: 700 }} />
            </Form.Item>
          </>
        );
      case 'update_frequency':
        return (
          <>
            <Form.Item label="统计周期" name={['condition', 'period']} initialValue="1 hour"
              rules={[{ required: true }]}>
              <Input placeholder="1 hour / 1 day" style={{ maxWidth: 700 }} />
            </Form.Item>
            <Form.Item label="最小更新次数" name={['condition', 'min_count']} rules={[{ required: true, type: 'number' }]}>
              <Input type="number" style={{ maxWidth: 700 }} />
            </Form.Item>
          </>
        );
      case 'custom_sql':
        return (
          <Form.Item label="SQL 检测语句" name={['condition', 'sql']} rules={[{ required: true, message: '请输入 SQL 语句' }]}>
            <TextArea rows={6} placeholder="SELECT COUNT(*) AS total, ... 必须返回 total, pass_count, fail_count" style={{ maxWidth: 700 }} />
          </Form.Item>
        );
      case 'completeness_rate':
        return (
          <Form.Item label="完整率阈值" name={['condition', 'threshold']} initialValue={0.9}
            rules={[{ required: true, type: 'number', min: 0, max: 1 }]}>
            <Input type="number" step={0.1} min={0} max={1} style={{ maxWidth: 700 }} />
          </Form.Item>
        );
      case 'row_count_min':
        return (
          <Form.Item label="最小行数" name={['condition', 'min_value']} rules={[{ required: true, type: 'number' }]}>
            <Input type="number" style={{ maxWidth: 700 }} />
          </Form.Item>
        );
      case 'row_count_range':
        return (
          <>
            <Form.Item label="最小行数" name={['condition', 'min_value']} rules={[{ required: true, type: 'number' }]}>
              <Input type="number" style={{ maxWidth: 700 }} />
            </Form.Item>
            <Form.Item label="最大行数" name={['condition', 'max_value']} rules={[{ required: true, type: 'number' }]}>
              <Input type="number" style={{ maxWidth: 700 }} />
            </Form.Item>
          </>
        );
      default:
        return <></>;
    }
  };

  if (loading) return <Spin style={{ display: 'block', margin: '80px auto' }} />;

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <ArrowLeftOutlined style={{ marginRight: 12, color: colors.primary[500], cursor: 'pointer' }}
          onClick={() => navigate('/data-quality/rules')} />
        {isEdit ? '编辑质量规则' : '创建质量规则'}
      </Title>

      <Card style={{ borderRadius: componentRadius.card, maxWidth: 700, boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}>
        <Form form={form} layout="vertical" style={{ maxWidth: 700 }}>
          <Form.Item label="规则名称" name="name" rules={[{ required: true, message: '请输入规则名称' }]}>
            <Input placeholder="例：用户表邮箱格式校验" />
          </Form.Item>

          <Form.Item label="描述" name="description">
            <TextArea rows={2} placeholder="规则用途说明" />
          </Form.Item>

          <Form.Item label="检测目标表" name="targetTable" rules={[{ required: true, message: '请输入表名' }]}>
            <Input placeholder="例：users" />
          </Form.Item>

          <Form.Item label="检测目标字段" name="targetField">
            <Input placeholder="留空表示检测全表" />
          </Form.Item>

          <Form.Item label="过滤条件 (WHERE)" name="targetCondition">
            <Input placeholder="例：created_at >= '2026-01-01'" />
          </Form.Item>

          <Form.Item label="规则类型" name="ruleType" rules={[{ required: true, message: '请选择规则类型' }]}>
            <Select onChange={(v: RuleType) => setRuleType(v)} options={[
              { label: '非空检查', value: 'not_null' },
              { label: '唯一性', value: 'unique' },
              { label: '数值范围', value: 'numeric_range' },
              { label: '格式校验', value: 'format_pattern' },
              { label: '枚举值检查', value: 'enum_values' },
              { label: '跨表一致性', value: 'cross_table_consistency' },
              { label: '逻辑约束', value: 'logical_constraint' },
              { label: '异常值检测', value: 'outlier_detection' },
              { label: '数据延迟', value: 'freshness' },
              { label: '更新频率', value: 'update_frequency' },
              { label: '自定义 SQL', value: 'custom_sql' },
              { label: '完整率', value: 'completeness_rate' },
              { label: '最小行数', value: 'row_count_min' },
              { label: '行数范围', value: 'row_count_range' },
              { label: '外键引用', value: 'referential' },
            ]} />
          </Form.Item>

          <Form.Item label="严重级别" name="severity" initialValue="warning">
            <Select options={[
              { label: '严重 (critical)', value: 'critical' },
              { label: '警告 (warning)', value: 'warning' },
              { label: '信息 (info)', value: 'info' },
            ]} />
          </Form.Item>

          <Form.Item label="评分权重 (1-5)" name="weight" initialValue={2}>
            <Select options={[
              { label: '1 - 最低', value: 1 },
              { label: '2 - 默认', value: 2 },
              { label: '3 - 较高', value: 3 },
              { label: '4 - 高', value: 4 },
              { label: '5 - 最高', value: 5 },
            ]} />
          </Form.Item>

          {/* 动态条件字段 */}
          {renderConditionFields()}

          <Form.Item label="调度模式" name="scheduleMode" initialValue="manual">
            <Select onChange={(v: ScheduleMode) => setScheduleMode(v)} options={[
              { label: '手动触发', value: 'manual' },
              { label: '定时检测 (Cron)', value: 'cron' },
              { label: '事件触发', value: 'event' },
            ]} />
          </Form.Item>

          {scheduleMode === 'cron' && (
            <>
              <Form.Item label="Cron 表达式" name="cronExpression" rules={[{ required: true, message: '请输入 Cron 表达式' }]}>
                <Input placeholder="0 2 * * * (每天凌晨2点)" />
              </Form.Item>
              <Form.Item label="时区" name="timezone" initialValue="Asia/Shanghai">
                <Select options={[{ label: 'Asia/Shanghai', value: 'Asia/Shanghai' }, { label: 'UTC', value: 'UTC' }]} />
              </Form.Item>
            </>
          )}

          {scheduleMode === 'event' && (
            <Form.Item label="触发事件" name="triggerEvent" rules={[{ required: true, message: '请输入事件名称' }]}>
              <Input placeholder="data_pipeline.completed" />
            </Form.Item>
          )}
        </Form>

        <div style={{ marginTop: spacing.lg, display: 'flex', justifyContent: 'flex-end', gap: spacing.sm }}>
          <Button onClick={() => navigate('/data-quality/rules')}>取消</Button>
          <Button type="primary" icon={<SaveOutlined />} loading={submitting} onClick={handleSubmit}>
            保存
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default DataQualityRuleEditor;
```

**CRUD 审查**：

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 字段可编辑性 | 有 | 所有字段使用 Form.Item + Input/Select |
| 校验规则 | 有 | 必填项有 rules，数值字段有 type: 'number' |
| 保存按钮 | 有 | 底部固定，调用 create/update API |
| 失败提示 | 有 | catch 中 message.error |
| 成功提示 | 有 | message.success + 跳转列表 |
| Loading 状态 | 有 | submitting 时按钮 loading |

#### 5.4.4 检测报告列表 `/data-quality/reports`

文件：`orion-frontend/src/pages/data-quality/DataQualityReports.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { Table, Tag, Space, Button, Select, DatePicker, message, Empty, Spin, Typography } from 'antd';
import { EyeOutlined, FileTextOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { colors } from '@/tokens/colors';
import { componentRadius } from '@/tokens/radius';
import { spacing } from '@/tokens/spacing';
import { getReports, generateReport, type DataQualityReport } from '@/api/data-quality';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const gradeColorMap: Record<string, string> = {
  A: colors.success[500], B: colors.primary[500], C: colors.warning[500],
  D: '#fa8c16', F: colors.error[500],
};

const DataQualityReports: React.FC = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<DataQualityReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string | undefined>();

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await getReports({ reportType: typeFilter });
      setReports(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReports(); }, [typeFilter]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateReport({ reportType: 'single_run' });
      message.success('报告已生成');
      fetchReports();
    } catch {
      message.error('生成报告失败');
    } finally {
      setGenerating(false);
    }
  };

  const columns = [
    {
      title: '报告类型',
      dataIndex: 'reportType',
      key: 'reportType',
      width: 100,
      render: (v: string) => (
        <Tag color={v === 'single_run' ? 'blue' : v === 'daily' ? 'green' : v === 'weekly' ? 'purple' : 'orange'}>
          {v === 'single_run' ? '单次检测' : v === 'daily' ? '日报' : v === 'weekly' ? '周报' : '月报'}
        </Tag>
      ),
    },
    {
      title: '综合评分',
      key: 'score',
      width: 120,
      render: (_: unknown, record: DataQualityReport) => (
        <Tag color={gradeColorMap[record.overallGrade || 'F']} style={{ fontSize: 16, fontWeight: 600, padding: '4px 12px' }}>
          {record.overallScore != null ? record.overallScore.toFixed(1) : '-'}
          {record.overallGrade ? ` (${record.overallGrade})` : ''}
        </Tag>
      ),
    },
    {
      title: '规则通过/失败',
      key: 'stats',
      width: 160,
      render: (_: unknown, record: DataQualityReport) => (
        <Space>
          <Tag color="success">{record.rulesPassed} 通过</Tag>
          {record.rulesFailed > 0 && <Tag color="error">{record.rulesFailed} 失败</Tag>}
          {record.rulesWarning > 0 && <Tag color="warning">{record.rulesWarning} 警告</Tag>}
        </Space>
      ),
    },
    {
      title: '趋势',
      dataIndex: 'trendScore',
      key: 'trend',
      width: 100,
      render: (v: number | null) => {
        if (v == null) return '-';
        const color = v >= 0 ? colors.success[500] : colors.error[500];
        return <Text style={{ color, fontWeight: 600 }}>{v > 0 ? '+' : ''}{v.toFixed(1)}</Text>;
      },
    },
    {
      title: '检测时间',
      dataIndex: 'generatedAt',
      key: 'generatedAt',
      width: 180,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: DataQualityReport) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/data-quality/reports/${record.id}`)}>
          查看
        </Button>
      ),
    },
  ];

  if (loading) return <Spin style={{ display: 'block', margin: '80px auto' }} />;

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <FileTextOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        质量检测报告
      </Title>
      <Text style={{ color: colors.neutral[500], marginBottom: spacing.md, display: 'block' }}>
        查看数据质量检测结果和趋势
      </Text>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Select placeholder="报告类型" allowClear value={typeFilter} onChange={setTypeFilter} style={{ width: 160 }}
          options={[
            { value: 'single_run', label: '单次检测' },
            { value: 'daily', label: '日报' },
            { value: 'weekly', label: '周报' },
            { value: 'monthly', label: '月报' },
          ]}
        />
        <Button type="primary" icon={<PlusOutlined />} loading={generating} onClick={handleGenerate}>
          生成报告
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={reports}
        rowKey="id"
        pagination={{ pageSize: 20, showTotal: (t: number) => `共 ${t} 份报告` }}
        locale={{ emptyText: <Empty description="暂无检测报告" /> }}
      />
    </div>
  );
};

export default DataQualityReports;
```

#### 5.4.5 报告详情 `/data-quality/reports/:id`

文件：`orion-frontend/src/pages/data-quality/DataQualityReportDetail.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { Card, Spin, Tag, Descriptions, Table, Space, Typography, Button, Empty } from 'antd';
import { ArrowLeftOutlined, TrendingUpOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { colors } from '@/tokens/colors';
import { componentRadius } from '@/tokens/radius';
import { spacing } from '@/tokens/spacing';
import { getReport, type DataQualityReport } from '@/api/data-quality';

const { Title, Text, Paragraph } = Typography;

const gradeColorMap: Record<string, string> = {
  A: colors.success[500], B: colors.primary[500], C: colors.warning[500],
  D: '#fa8c16', F: colors.error[500],
};

const DataQualityReportDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<DataQualityReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getReport(id!).then(res => setReport(res.data)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spin style={{ display: 'block', margin: '80px auto' }} />;
  if (!report) return <Empty description="报告不存在" />;

  const scoreColor = gradeColorMap[report.overallGrade || 'F'];

  const failureColumns = [
    { title: '规则名称', dataIndex: 'ruleName', key: 'ruleName' },
    {
      title: '严重级别', dataIndex: 'severity', key: 'severity', width: 100,
      render: (v: string) => <Tag color={gradeColorMap[v === 'critical' ? 'F' : v === 'warning' ? 'C' : 'A']}>
        {v === 'critical' ? '严重' : v === 'warning' ? '警告' : '信息'}
      </Tag>,
    },
    { title: '目标', dataIndex: 'targetName', key: 'targetName' },
    {
      title: '失败率', dataIndex: 'failureRate', key: 'failureRate', width: 100,
      render: (v: number) => <Text style={{ color: v > 0.1 ? colors.error[500] : colors.warning[500] }}>
        {(v * 100).toFixed(1)}%
      </Text>,
    },
    {
      title: '处理状态', dataIndex: 'status', key: 'status', width: 100,
      render: (v: string) => <Tag color={v === 'open' ? 'error' : v === 'fixed' ? 'success' : 'default'}>
        {v}
      </Tag>,
    },
    {
      title: '责任人', dataIndex: 'assignedTo', key: 'assignedTo', width: 100,
      render: (v: string) => v || <Text type="secondary">未分配</Text>,
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <ArrowLeftOutlined style={{ marginRight: 12, color: colors.primary[500], cursor: 'pointer' }}
          onClick={() => navigate('/data-quality/reports')} />
        报告详情
      </Title>
      <Text style={{ color: colors.neutral[500], marginBottom: spacing.md, display: 'block' }}>
        生成时间：{dayjs(report.generatedAt).format('YYYY-MM-DD HH:mm:ss')}
      </Text>

      {/* 评分卡片 */}
      <Card style={{ borderRadius: componentRadius.card, marginBottom: spacing.md, boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}>
        <Descriptions column={4} bordered>
          <Descriptions.Item label="综合评分">
            <Text style={{ color: scoreColor, fontSize: 24, fontWeight: 600 }}>
              {report.overallScore != null ? report.overallScore.toFixed(1) : '-'}
            </Text>
            <Tag color={scoreColor} style={{ marginLeft: spacing.sm }}>{report.overallGrade}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="趋势">
            {report.trendScore != null ? (
              <Space>
                <TrendingUpOutlined style={{ color: report.trendScore >= 0 ? colors.success[500] : colors.error[500] }} />
                <Text style={{ color: report.trendScore >= 0 ? colors.success[500] : colors.error[500] }}>
                  {report.trendScore > 0 ? '+' : ''}{report.trendScore.toFixed(1)}
                </Text>
              </Space>
            ) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="检测记录数">
            {report.totalRecords.toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label="报告类型">
            <Tag>{report.reportType}</Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 统计 */}
      <Card title="检测统计" style={{ borderRadius: componentRadius.card, marginBottom: spacing.md, boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}>
        <Space size={spacing.md}>
          <Tag icon={<CheckCircleOutlined />} color="success">{report.rulesPassed} 条规则通过</Tag>
          {report.rulesFailed > 0 && <Tag icon={<WarningOutlined />} color="error">{report.rulesFailed} 条规则失败</Tag>}
          {report.rulesWarning > 0 && <Tag color="warning">{report.rulesWarning} 条规则警告</Tag>}
        </Space>
      </Card>

      {/* 失败详情 */}
      <Card title={`失败详情 (${report.failedChecks?.length || 0})`} style={{ borderRadius: componentRadius.card, boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}>
        {report.failedChecks && report.failedChecks.length > 0 ? (
          <Table columns={failureColumns} dataSource={report.failedChecks} rowKey="id" pagination={false} />
        ) : (
          <Empty description="所有规则均通过" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>
    </div>
  );
};

export default DataQualityReportDetail;
```

#### 5.4.6 质量问题跟踪 `/data-quality/issues`

文件：`orion-frontend/src/pages/data-quality/DataQualityIssues.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { Table, Tag, Space, Select, Button, Modal, Form, Input, message, Empty, Spin, Typography } from 'antd';
import { EyeOutlined, FilterOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { colors } from '@/tokens/colors';
import { componentRadius } from '@/tokens/radius';
import { spacing } from '@/tokens/spacing';
import { getIssues, updateIssueStatus, resolveIssue, type QualityIssue } from '@/api/data-quality';

const { Title, Text } = Typography;
const { TextArea } = Input;

const statusColorMap: Record<string, string> = {
  open: 'error', investigating: 'processing', fixed: 'success', accepted: 'warning', closed: 'default',
};

const DataQualityIssues: React.FC = () => {
  const navigate = useNavigate();
  const [issues, setIssues] = useState<QualityIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [severityFilter, setSeverityFilter] = useState<string | undefined>();

  const fetchIssues = async () => {
    setLoading(true);
    try {
      const res = await getIssues({ status: statusFilter, severity: severityFilter });
      setIssues(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIssues(); }, [statusFilter, severityFilter]);

  const columns = [
    {
      title: '规则名称',
      dataIndex: 'ruleName',
      key: 'ruleName',
      render: (text: string) => <a style={{ color: colors.primary[500] }}>{text}</a>,
    },
    {
      title: '严重级别',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (v: string) => <Tag color={v === 'critical' ? 'error' : v === 'warning' ? 'warning' : 'default'}>
        {v}
      </Tag>,
    },
    {
      title: '目标',
      dataIndex: 'targetName',
      key: 'targetName',
    },
    {
      title: '失败率',
      dataIndex: 'failureRate',
      key: 'failureRate',
      width: 100,
      render: (v: number) => <Text style={{ color: v > 0.1 ? colors.error[500] : colors.warning[500] }}>
        {(v * 100).toFixed(1)}%
      </Text>,
    },
    {
      title: '处理状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (v: string) => <Tag color={statusColorMap[v]}>
        {v === 'open' ? '待处理' : v === 'investigating' ? '处理中' : v === 'fixed' ? '已修复' : v === 'accepted' ? '已接受' : '已关闭'}
      </Tag>,
    },
    {
      title: '责任人',
      dataIndex: 'assignedTo',
      key: 'assignedTo',
      width: 100,
      render: (v: string) => v || <Text type="secondary">未分配</Text>,
    },
    {
      title: '检测时间',
      dataIndex: 'detectedAt',
      key: 'detectedAt',
      width: 180,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_: unknown, record: QualityIssue) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/data-quality/issues/${record.id}`)}>
            详情
          </Button>
          {record.status === 'open' && (
            <Button type="link" size="small" onClick={() => {
              updateIssueStatus(record.id, 'investigating').then(() => {
                message.success('状态已更新');
                fetchIssues();
              });
            }}>
              开始处理
            </Button>
          )}
        </Space>
      ),
    },
  ];

  if (loading) return <Spin style={{ display: 'block', margin: '80px auto' }} />;

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <FilterOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        质量问题跟踪
      </Title>
      <Text style={{ color: colors.neutral[500], marginBottom: spacing.md, display: 'block' }}>
        跟踪和处理数据质量检测发现的问题
      </Text>

      <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.md }}>
        <Select placeholder="处理状态" allowClear value={statusFilter} onChange={setStatusFilter} style={{ width: 140 }}
          options={[
            { value: 'open', label: '待处理' },
            { value: 'investigating', label: '处理中' },
            { value: 'fixed', label: '已修复' },
            { value: 'accepted', label: '已接受' },
            { value: 'closed', label: '已关闭' },
          ]}
        />
        <Select placeholder="严重级别" allowClear value={severityFilter} onChange={setSeverityFilter} style={{ width: 140 }}
          options={[{ value: 'critical', label: '严重' }, { value: 'warning', label: '警告' }, { value: 'info', label: '信息' }]}
        />
      </div>

      <Table
        columns={columns}
        dataSource={issues}
        rowKey="id"
        pagination={{ pageSize: 20, showTotal: (t: number) => `共 ${t} 个问题` }}
        locale={{ emptyText: <Empty description="暂无质量问题" /> }}
      />
    </div>
  );
};

export default DataQualityIssues;
```

#### 5.4.7 问题详情 `/data-quality/issues/:id`

文件：`orion-frontend/src/pages/data-quality/DataQualityIssueDetail.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { Card, Spin, Descriptions, Tag, Button, Form, Input, Modal, message, Typography, Empty } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { colors } from '@/tokens/colors';
import { componentRadius } from '@/tokens/radius';
import { spacing } from '@/tokens/spacing';
import { getIssue, resolveIssue, updateIssueStatus, type QualityIssue } from '@/api/data-quality';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const DataQualityIssueDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [issue, setIssue] = useState<QualityIssue | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolveModal, setResolveModal] = useState(false);
  const [resolveForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    getIssue(id!).then(res => setIssue(res.data)).finally(() => setLoading(false));
  }, [id]);

  const handleResolve = async () => {
    const values = await resolveForm.validateFields();
    setSubmitting(true);
    try {
      await resolveIssue(id!, values.rootCause, values.resolution);
      message.success('问题已标记解决');
      setResolveModal(false);
      // Refresh
      const res = await getIssue(id!);
      setIssue(res.data);
    } catch {
      message.error('操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spin style={{ display: 'block', margin: '80px auto' }} />;
  if (!issue) return <Empty description="问题不存在" />;

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <ArrowLeftOutlined style={{ marginRight: 12, color: colors.primary[500], cursor: 'pointer' }}
          onClick={() => navigate('/data-quality/issues')} />
        问题详情
      </Title>

      <Card title="基本信息" style={{ borderRadius: componentRadius.card, marginBottom: spacing.md, boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}>
        <Descriptions column={2} bordered>
          <Descriptions.Item label="规则名称">{issue.ruleName}</Descriptions.Item>
          <Descriptions.Item label="严重级别">
            <Tag color={issue.severity === 'critical' ? 'error' : issue.severity === 'warning' ? 'warning' : 'default'}>
              {issue.severity}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="检测目标">{issue.targetName}</Descriptions.Item>
          <Descriptions.Item label="失败率">
            <Text style={{ color: issue.failureRate > 0.1 ? colors.error[500] : colors.warning[500] }}>
              {(issue.failureRate * 100).toFixed(1)}%
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="处理状态">
            <Tag color={issue.status === 'open' ? 'error' : issue.status === 'fixed' ? 'success' : 'default'}>
              {issue.status}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="责任人">{issue.assignedTo || '未分配'}</Descriptions.Item>
          <Descriptions.Item label="检测时间">{dayjs(issue.detectedAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
          {issue.fixedAt && <Descriptions.Item label="修复时间">{dayjs(issue.fixedAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>}
        </Descriptions>
      </Card>

      {/* 失败样本 */}
      {issue.failureSamples && issue.failureSamples.length > 0 && (
        <Card title="失败样本" style={{ borderRadius: componentRadius.card, marginBottom: spacing.md, boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}>
          {issue.failureSamples.map((sample, i) => (
            <Paragraph key={i} copyable={{ text: JSON.stringify(sample, null, 2) }} style={{ marginBottom: spacing.xs }}>
              <Text code>{JSON.stringify(sample)}</Text>
            </Paragraph>
          ))}
        </Card>
      )}

      {/* 解决措施 */}
      {issue.rootCause && (
        <Card title="根因分析" style={{ borderRadius: componentRadius.card, marginBottom: spacing.md, boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}>
          <Paragraph>{issue.rootCause}</Paragraph>
        </Card>
      )}
      {issue.resolution && (
        <Card title="解决措施" style={{ borderRadius: componentRadius.card, marginBottom: spacing.md, boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}>
          <Paragraph>{issue.resolution}</Paragraph>
        </Card>
      )}

      {/* 操作按钮 */}
      <Card style={{ borderRadius: componentRadius.card, boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}>
        <Space>
          {issue.status === 'open' && (
            <Button onClick={() => {
              updateIssueStatus(id!, 'investigating').then(() => {
                message.success('状态已更新为处理中');
                getIssue(id!).then(res => setIssue(res.data));
              });
            }}>
              开始处理
            </Button>
          )}
          {issue.status !== 'fixed' && issue.status !== 'closed' && (
            <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => setResolveModal(true)}>
              标记解决
            </Button>
          )}
        </Space>
      </Card>

      {/* 解决弹窗 */}
      <Modal title="标记问题解决" open={resolveModal} onCancel={() => setResolveModal(false)}
        onOk={handleResolve} confirmLoading={submitting} okText="确认解决" cancelText="取消">
        <Form form={resolveForm} layout="vertical">
          <Form.Item label="根因分析" name="rootCause" rules={[{ required: true, message: '请输入根因分析' }]}>
            <TextArea rows={3} placeholder="问题的根本原因是什么？" />
          </Form.Item>
          <Form.Item label="解决措施" name="resolution" rules={[{ required: true, message: '请输入解决措施' }]}>
            <TextArea rows={3} placeholder="采取了什么措施解决问题？" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DataQualityIssueDetail;
```

### 5.5 Design Token 使用

所有页面严格遵循 CLAUDE.md 中的 Design Token 规范：

| 使用场景 | Token | 值 |
|---------|-------|---|
| 页面标题 | `level={2}` + `colors.primary[500]` 图标 | 20px, `#1f1f1f` |
| 副标题 | `colors.neutral[500]` | `#8c8c8c` |
| 卡片圆角 | `componentRadius.card` | `12px` |
| 卡片阴影 | inline | `0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)` |
| 页面内边距 | `spacing.lg` | `24px` |
| 元素间距 | `spacing.md` / `spacing.sm` | `16px` / `8px` |
| 主按钮 | `type="primary"` | `#3370E6` |
| 链接文字 | `colors.primary[500]` | `#3370E6` |
| 状态色 | `colors.success/warning/error[500]` | `#52c41a` / `#faad14` / `#f5222d` |
| 表单最大宽度 | `maxWidth: 700` | 700px |
| 表格操作 | `<Space>` | 8px 间距 |
| 空状态 | `Empty` + 引导按钮 | Apple/飞书风格 |
| 表单提交 | loading + disabled | 防止重复提交 |
| 删除确认 | `Popconfirm` | 二次确认 |

### 5.6 响应式适配

| 屏幕宽度 | 行为 |
|---------|------|
| >= 1200px | 完整布局，仪表盘 4 列 |
| 768-1199px | 仪表盘 2 列，表单宽度不变 |
| < 768px | 仪表盘 1 列，表格改为响应式折叠 |

---

## 6. 验收标准

### 6.1 后端验收

| 编号 | 验收项 | 标准 |
|------|--------|------|
| B-01 | 迁移 190 执行 | 2 张表成功创建，索引和触发器生效 |
| B-02 | 规则 CRUD API | POST/GET/PUT/DELETE 全部 200/201/404 |
| B-03 | 规则执行 | 对模拟数据执行 not_null/range/pattern 规则，返回正确 ValidationResult |
| B-04 | 评分计算 | 多规则权重加权评分算法正确，边界值（全 pass / 全 fail）计算准确 |
| B-05 | 报告生成 | 单次检测报告包含完整统计和失败详情 |
| B-06 | 租户隔离 | 不同 tenant_id 的规则/报告互不可见 |
| B-07 | 定时调度 | cron 表达式正确触发规则执行 |
| B-08 | 权限校验 | 无 write 权限用户创建规则返回 403 |

### 6.2 前端验收

| 编号 | 验收项 | 标准 |
|------|--------|------|
| F-01 | 页面可访问 | 6 个页面均可通过路由访问，菜单入口可见 |
| F-02 | 规则创建 | 表单填写完整可成功创建，跳转列表 |
| F-03 | 规则编辑 | 点击编辑加载正确数据，修改后保存成功 |
| F-04 | 规则删除 | 二次确认后删除，列表刷新 |
| F-05 | 规则执行 | 手动触发后 message.success，状态更新 |
| F-06 | 报告列表 | 显示报告数据，评分/等级/趋势渲染正确 |
| F-07 | 报告详情 | 显示失败详情表格，统计信息正确 |
| F-08 | 问题跟踪 | 状态筛选、状态更新、解决弹窗均正常 |
| F-09 | 仪表盘 | 评分趋势图渲染正确，数据源排名柱状图正常 |
| F-10 | 空状态 | 无数据时显示 Empty + 引导按钮 |
| F-11 | Design Token | 所有色值/间距/圆角使用 Token，无硬编码 |
| F-12 | Loading 状态 | 所有异步操作有 loading 反馈 |
| F-13 | 错误处理 | 所有 async 操作 catch 并 message.error |
| F-14 | 表单校验 | 必填项有 rules，格式字段有 validator |

### 6.3 集成验收

| 编号 | 验收项 | 标准 |
|------|--------|------|
| I-01 | 与 data_pipelines 集成 | 规则可关联到已有 pipeline |
| I-02 | 与 quality_gates 集成 | 质量评分低于阈值时触发 blocking |
| I-03 | 与 notification 集成 | critical 规则失败时发送通知 |
| I-04 | 与 EventBus 集成 | 检测完成/失败事件正确发布 |

---

## 7. 文件清单

### 新增文件

| 文件路径 | 类型 | 描述 |
|---------|------|------|
| `orion-platform-service/src/db/migrations/190_create_data_quality_tables.sql` | 迁移 | 创建 2 张表 |
| `orion-platform-service/src/db/migrations/190_rollback_data_quality_tables.sql` | 迁移回滚 | 删除表和触发器 |
| `orion-platform-service/src/services/data-quality/DataQualityRuleService.ts` | 服务 | 规则 CRUD + 执行 |
| `orion-platform-service/src/services/data-quality/DataQualityReportService.ts` | 服务 | 报告/评分/问题/趋势 |
| `orion-platform-service/src/services/data-quality/DataQualityScheduler.ts` | 服务 | 调度 + 事件驱动 |
| `orion-platform-service/src/services/data-quality/index.ts` | 索引 | 模块导出 |
| `orion-platform-service/src/api/data-quality-routes.ts` | 路由 | API 端点注册 |
| `orion-platform-service/src/api/controllers/DataQualityController.ts` | 控制器 | 请求处理 |
| `orion-frontend/src/api/data-quality.ts` | API 客户端 | 前端 API 服务 |
| `orion-frontend/src/pages/data-quality/DataQualityLayout.tsx` | 页面 | 布局容器（Tabs 导航） |
| `orion-frontend/src/pages/data-quality/DataQualityDashboard.tsx` | 页面 | 质量仪表盘 |
| `orion-frontend/src/pages/data-quality/DataQualityRules.tsx` | 页面 | 规则列表 |
| `orion-frontend/src/pages/data-quality/DataQualityRuleEditor.tsx` | 页面 | 规则创建/编辑 |
| `orion-frontend/src/pages/data-quality/DataQualityReports.tsx` | 页面 | 报告列表 |
| `orion-frontend/src/pages/data-quality/DataQualityReportDetail.tsx` | 页面 | 报告详情 |
| `orion-frontend/src/pages/data-quality/DataQualityIssues.tsx` | 页面 | 问题列表 |
| `orion-frontend/src/pages/data-quality/DataQualityIssueDetail.tsx` | 页面 | 问题详情 |

### 修改文件

| 文件路径 | 修改内容 |
|---------|---------|
| `orion-platform-service/src/api/routes.ts` | 导入并注册 `dataQualityRoutes` |
| `orion-frontend/src/router/routes.tsx` | 添加 `/data-quality` 路由组（9 条子路由） |
