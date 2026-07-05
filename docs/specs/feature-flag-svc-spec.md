# Spec: 功能开关服务 (FeatureFlag)

> **日期**: 2026-07-04
> **状态**: 编写中
> **能力域**: 功能发布/灰度
> **目标成熟度**: L2 → L2.5
> **关键交付**: 功能开关 CRUD、灰度策略、目标规则、批量评估、变更审计

## 1. 模块概述

### 1.1 功能描述

Orion 当前已实现（Go 微服务 `orion-feature-flag-svc-go`）：
- 功能开关 CRUD（FeatureFlagService + FeatureFlagRepository）
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

### 1.2 架构

- **框架**: Gin HTTP
- **分层**: handler → service → repository → PostgreSQL
- **认证**: RequirePermission("feature_flag", "write") / RequirePermission("feature_flag", "delete")
- **多租户**: 所有查询通过 tenant_id 过滤

### 1.3 与 TypeScript 实现的差异

N/A（无 TS 实现）

## 2. API 端点

```
Base: /api/v1/flags
```

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| POST | `/` | 创建开关 | feature_flag:write |
| GET | `/` | 开关列表（含筛选） | - |
| GET | `/search` | 全文搜索 | - |
| GET | `/count` | 开关总数 | - |
| GET | `/:id` | 开关详情 | - |
| PUT | `/:id` | 更新开关 | feature_flag:write |
| DELETE | `/:id` | 删除开关 | feature_flag:delete |
| PUT | `/:id/rollout` | 设置灰度百分比 | feature_flag:write |
| GET | `/:id/toggle-history` | 变更历史 | - |
| POST | `/evaluate` | 评估开关 | feature_flag:write |
| POST | `/evaluate/batch` | 批量评估 | feature_flag:write |

## 3. 数据模型

### 3.1 FeatureFlag（功能开关）

| 字段 | 类型 | 描述 |
|------|------|------|
| id | string | 主键 |
| tenant_id | string | 租户 ID |
| name | string | 开关名称 |
| key | string | 唯一标识 key |
| description | string | 描述 |
| status | FeatureFlagStatus | 状态（active/inactive/archived） |
| default_value | bool | 默认值 |
| rollout_pct | int | 灰度百分比（0-100） |
| rollout_strategy | RolloutStrategy | 灰度策略（percentage/targeted/gradual） |
| targeting_rules | JSONArray | 目标规则 |
| environments | StringArray | 环境列表 |
| tags | StringArray | 标签 |
| created_by | string | 创建人 |
| updated_by | string | 更新人 |
| created_at | time.Time | 创建时间 |
| updated_at | time.Time | 更新时间 |

### 3.2 FlagToggleRecord（变更审计）

| 字段 | 类型 | 描述 |
|------|------|------|
| id | string | 主键 |
| flag_id | string | 关联开关 ID |
| old_value | bool | 旧值 |
| new_value | bool | 新值 |
| changed_by | string | 变更人 |
| reason | string | 变更原因 |
| changed_at | time.Time | 变更时间 |

## 4. 验收标准

| 编号 | 标准 | 验证方式 |
|------|------|----------|
| FF-01 | 支持创建开关（name/key/description/default_value/rollout_strategy） | API 测试 |
| FF-02 | 开关 key 租户级唯一 | API 测试 |
| FF-03 | 开关状态：active/inactive/archived | API 测试 |
| FF-04 | 支持更新开关（partial update） | API 测试 |
| FF-05 | 支持删除开关（需确认） | API 测试 |
| FF-06 | 多租户隔离 | 集成测试 |
| FF-07 | 开关创建者/更新者记录 | API 测试 |
| FF-08 | 支持百分比灰度（rollout_pct 0-100） | API 测试 |
| FF-09 | 支持目标灰度（targeted：按用户属性匹配） | API 测试 |
| FF-10 | 支持渐进灰度（gradual：按时间/比例递增） | API 测试 |
| FF-11 | 目标规则支持操作符：equals/contains/in/regex/gt/lt | API 测试 |
| FF-12 | 目标规则按属性匹配（user_id/email/region/plan） | API 测试 |
| FF-13 | 环境级开关（environments 列表） | API 测试 |
| FF-14 | 支持按 key 评估开关（Evaluate） | API 测试 |
| FF-15 | 评估输入：flag_key/environment/user_id/attributes | API 测试 |
| FF-16 | 评估输出：enabled/reason/flag_id/evaluated_at | API 测试 |
| FF-17 | 支持批量评估（EvaluateBatch） | API 测试 |
| FF-18 | 未找到开关返回 default_value | API 测试 |
| FF-19 | 目标规则匹配优先级高于百分比 | API 测试 |
| FF-20 | 支持全文搜索（name/key/description） | API 测试 |
| FF-21 | 按状态筛选（active/inactive/archived） | API 测试 |
| FF-22 | 按环境筛选 | API 测试 |
| FF-23 | 开关总数统计（Count） | API 测试 |
| FF-24 | 列表分页（page/page_size） | API 测试 |
| FF-25 | 开关变更记录审计（FlagToggleRecord） | API 测试 |
| FF-26 | 审计含 old_value/new_value/changed_by/reason | API 测试 |
| FF-27 | 审计时间戳（changed_at） | API 测试 |
| FF-28 | 支持查询开关变更历史（ToggleHistory） | API 测试 |

## 5. 测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 20 | FeatureFlagService、EvaluationService、ToggleHistoryService |
| 集成测试 | 6 | 创建→评估→更新→审计→搜索→删除闭环 |
| 前端测试 | 4 | 开关列表、详情、评估、历史 |
