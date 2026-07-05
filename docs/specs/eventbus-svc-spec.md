# Spec: 功能开关服务 (FeatureFlag)

> **日期**: 2026-07-03
> **状态**: 编写中
> **能力域**: 功能发布/灰度
> **目标成熟度**: L2 → L2.5
> **关键交付**: 功能开关 CRUD、灰度策略、目标规则、批量评估、变更审计

## 一、功能描述

### 1.1 现状评估 (L2)

Orion 当前已实现（Go 微服务 `orion-feature-flag-svc-go`）：
- 功能开关 CRUD（Service + Repository）
- 开关状态管理（active/inactive/archived）
- 灰度策略（percentage/targeted/gradual）
- 目标规则（TargetingRule：attribute/operator/value）
- 环境管理（environments：按环境开关）
- 标签管理（tags）
- 开关评估（Evaluate：按 key/environment/user/attributes）
- 批量评估（EvaluateBatch）
- 灰度百分比设置（SetRolloutPercentage）
- 开关变更审计（FlagToggleRecord：old_value/new_value/changed_by/reason）
- 开关搜索（按名称/key/描述全文搜索）
- 多租户隔离
- OpenTelemetry 追踪

**不足**：
- 无开关依赖管理（开关 A 依赖 开关 B）
- 无开关继承（项目级→服务级→环境级）
- 无开关变更通知（Webhook/Slack）
- 无开关 A/B 测试集成
- 无开关使用统计（评估次数/启用率）
- 无开关审批流程（生产开关变更审批）
- 无开关版本历史（每次变更的快照）
- 无开关 kill switch（全局一键关闭）

### 1.2 Phase 1 目标 (L2.5)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 开关依赖 | 开关间依赖关系管理 | L2.5 |
| 变更通知 | Webhook/Slack 通知 | L2 |
| 使用统计 | 评估次数/启用率/趋势 | L2.5 |
| 审批流程 | 生产开关变更审批 | L2 |
| Kill Switch | 全局一键关闭/开启 | L2 |
| 版本历史 | 每次变更快照对比 | L2.5 |

## 二、验收标准

### 2.1 功能开关基础

| # | 标准 | 验证方式 |
|---|------|----------|
| FF1 | 支持创建开关（name/key/description/default_value/rollout_strategy） | API 测试 |
| FF2 | 开关 key 租户级唯一 | API 测试 |
| FF3 | 开关状态：active/inactive/archived | API 测试 |
| FF4 | 支持更新开关（partial update） | API 测试 |
| FF5 | 支持删除开关（需确认） | API 测试 |
| FF6 | 多租户隔离 | 集成测试 |
| FF7 | 开关创建者/更新者记录 | API 测试 |

### 2.2 灰度与目标规则

| # | 标准 | 验证方式 |
|---|------|----------|
| FF8 | 支持百分比灰度（rollout_pct 0-100） | API 测试 |
| FF9 | 支持目标灰度（targeted：按用户属性匹配） | API 测试 |
| FF10 | 支持渐进灰度（gradual：按时间/比例递增） | API 测试 |
| FF11 | 目标规则支持操作符：equals/contains/in/regex/gt/lt | API 测试 |
| FF12 | 目标规则按属性匹配（user_id/email/region/plan） | API 测试 |
| FF13 | 环境级开关（environments 列表） | API 测试 |

### 2.3 开关评估

| # | 标准 | 验证方式 |
|---|------|----------|
| FF14 | 支持按 key 评估开关（Evaluate） | API 测试 |
| FF15 | 评估输入：flag_key/environment/user_id/attributes | API 测试 |
| FF16 | 评估输出：enabled/reason/flag_id/evaluated_at | API 测试 |
| FF17 | 支持批量评估（EvaluateBatch） | API 测试 |
| FF18 | 未找到开关返回 default_value | API 测试 |
| FF19 | 目标规则匹配优先级高于百分比 | API 测试 |

### 2.4 搜索与统计

| # | 标准 | 验证方式 |
|---|------|----------|
| FF20 | 支持全文搜索（name/key/description） | API 测试 |
| FF21 | 按状态筛选（active/inactive/archived） | API 测试 |
| FF22 | 按环境筛选 | API 测试 |
| FF23 | 开关总数统计（Count） | API 测试 |
| FF24 | 列表分页（page/page_size） | API 测试 |

### 2.5 审计与历史

| # | 标准 | 验证方式 |
|---|------|----------|
| FF25 | 开关变更记录审计（FlagToggleRecord） | API 测试 |
| FF26 | 审计含 old_value/new_value/changed_by/reason | API 测试 |
| FF27 | 审计时间戳（changed_at） | API 测试 |
| FF28 | 支持查询开关变更历史（ToggleHistory） | API 测试 |

## 三、API 设计

```
Base: /api/v1/flags
```

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/` | 创建开关 |
| GET | `/` | 开关列表（含筛选） |
| GET | `/search` | 全文搜索 |
| GET | `/count` | 开关总数 |
| GET | `/:id` | 开关详情 |
| PUT | `/:id` | 更新开关 |
| DELETE | `/:id` | 删除开关 |
| PUT | `/:id/rollout` | 设置灰度百分比 |
| GET | `/:id/toggle-history` | 变更历史 |
| POST | `/evaluate` | 评估开关 |
| POST | `/evaluate/batch` | 批量评估 |

## 四、数据模型

```sql
-- 功能开关
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    key VARCHAR(128) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    default_value BOOLEAN NOT NULL DEFAULT false,
    rollout_pct INT NOT NULL DEFAULT 100,
    rollout_strategy VARCHAR(20) NOT NULL DEFAULT 'percentage',
    targeting_rules JSONB NOT NULL DEFAULT '[]',
    environments JSONB NOT NULL DEFAULT '["production"]',
    tags JSONB NOT NULL DEFAULT '[]',
    created_by VARCHAR(128) NOT NULL DEFAULT '',
    updated_by VARCHAR(128) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feature_flags_tenant ON feature_flags(tenant_id);
CREATE UNIQUE INDEX idx_feature_flags_key ON feature_flags(tenant_id, key);
CREATE INDEX idx_feature_flags_status ON feature_flags(tenant_id, status);

-- 变更审计
CREATE TABLE IF NOT EXISTS flag_toggle_history (
    id UUID PRIMARY KEY,
    flag_id UUID NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE,
    old_value BOOLEAN NOT NULL,
    new_value BOOLEAN NOT NULL,
    changed_by VARCHAR(128) NOT NULL DEFAULT '',
    reason TEXT NOT NULL DEFAULT '',
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_flag_toggle_history_flag ON flag_toggle_history(flag_id);

-- 开关依赖（Phase 2）
CREATE TABLE IF NOT EXISTS flag_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    flag_id UUID NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE,
    depends_on_flag_id UUID NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE,
    condition VARCHAR(50) NOT NULL DEFAULT 'required',  -- required/optional/override
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(flag_id, depends_on_flag_id)
);

CREATE INDEX idx_flag_dependencies_flag ON flag_dependencies(flag_id);

-- 开关使用统计（Phase 2）
CREATE TABLE IF NOT EXISTS flag_usage_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_id UUID NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    evaluation_count INT NOT NULL DEFAULT 0,
    enabled_count INT NOT NULL DEFAULT 0,
    by_environment JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(flag_id, date)
);

CREATE INDEX idx_flag_usage_stats_flag ON flag_usage_stats(flag_id);
CREATE INDEX idx_flag_usage_stats_date ON flag_usage_stats(date);
```

## 五、前端设计

**路由**: `/feature-flags`

主要页面：
- 开关列表页：按状态/环境筛选，搜索
- 开关详情页：配置/目标规则/灰度百分比/环境
- 开关编辑页：创建/更新表单
- 评估页：按 key/environment/user 评估
- 变更历史页：审计记录/时间线
- 统计页：评估次数/启用率/趋势

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 20 | FeatureFlagService、EvaluationService、ToggleHistoryService |
| 集成测试 | 6 | 创建→评估→更新→审计→搜索→删除闭环 |
| 前端测试 | 4 | 开关列表、详情、评估、历史 |

---
_文档版本: v1.0 | 创建日期: 2026-07-03 | 状态: 编写中_
