# Spec: 治理服务 (Governance)

> **日期**: 2026-07-04
> **状态**: 编写中
> **能力域**: API 治理 / 策略管理 / 合规
> **目标成熟度**: L2 → L3
> **关键交付**: 策略管理、策略评估、违规管理、豁免审批、API 合约、版本管理

## 1. 模块概述

### 1.1 功能描述

Orion 当前已实现（Go 微服务 `orion-governance-svc-go`）：
- 策略管理（Policy：name/category/rego_path/gate_id/severity/enabled/metadata）
- 策略包（PolicyBundle：policies/version/active）
- 策略评估（PolicyEvaluation：input_context/result/evaluated_at/evaluation_ms）
- 策略评估结果（EvaluationResult：allowed/result/evaluated_at）
- 违规管理（PolicyViolation：severity/message/resource_type/resource_id/status）
- 违规统计（ViolationStats：by_severity/by_status/by_policy/recent_trend）
- 策略豁免（PolicyOverride：reason/approved_by/approved_at/status/expires_at/revoked_at）
- 豁免审批链（ApprovalChainEntry）
- API 合约（APIContract：service_name/endpoint/method/version/spec/schema/status）
- 合约违规（ContractViolation：violation_type/description/severity/sample_data）
- 兼容性检查（CompatibilityCheckResult：breaking_changes/non_breaking_changes）
- 影响分析（ImpactAnalysisResult：impacted_services/impacted_clients/migration_suggestions）
- API 版本管理（APIVersion：version_tag/version/definition/status/deprecation_date/retirement_date）
- 治理规则（GovernanceRule：rule_type/config/enabled）
- 治理评估结果（GovernanceEvaluationResult）
- 质量门禁趋势（PassRateTrendPoint）
- 多租户隔离
- OpenTelemetry 追踪

### 1.2 架构

- **框架**: Gin HTTP
- **分层**: handler → service → repository → PostgreSQL
- **认证**: RequirePermission("governance", "write") / RequirePermission("governance", "delete")
- **多租户**: 所有查询通过 tenant_id 过滤

### 1.3 与 TypeScript 实现的差异

N/A（无 TS 实现）

## 2. API 端点

```
Base: /api/v1/governance
```

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| POST | `/policies` | 创建策略 | governance:write |
| GET | `/policies` | 策略列表 | - |
| GET | `/policies/:id` | 策略详情 | - |
| DELETE | `/policies/:id` | 删除策略 | governance:delete |
| GET | `/count` | 策略总数 | - |
| POST | `/evaluate` | 评估策略 | - |
| GET | `/violations` | 违规列表 | - |
| POST | `/violations` | 记录违规 | governance:write |
| PUT | `/violations/:id` | 更新违规状态 | governance:write |
| GET | `/violations/stats` | 违规统计 | - |
| POST | `/overrides` | 创建豁免 | governance:write |
| PUT | `/overrides/:id` | 更新豁免 | governance:write |
| POST | `/exemptions` | 申请豁免 | governance:write |
| POST | `/exemptions/:id/review` | 审批豁免 | governance:write |
| POST | `/contracts` | 创建 API 合约 | governance:write |
| PUT | `/contracts/:id` | 更新 API 合约 | governance:write |
| GET | `/contracts/:id/verify` | 验证合约 | - |
| GET | `/contracts/:id/compatibility` | 兼容性检查 | - |
| GET | `/contracts/:id/impact` | 影响分析 | - |
| POST | `/versions` | 创建 API 版本 | governance:write |
| PUT | `/versions/:id/status` | 更新版本状态 | governance:write |
| POST | `/rules` | 创建治理规则 | governance:write |
| PUT | `/rules/:id` | 更新治理规则 | governance:write |

## 3. 数据模型

### 3.1 Policy（策略）

| 字段 | 类型 | 描述 |
|------|------|------|
| id | string | 主键 |
| tenant_id | string | 租户 ID |
| name | string | 策略名称 |
| description | *string | 描述 |
| category | string | 分类（security/cost/quality/governance） |
| rego_path | string | Rego 策略路径 |
| gate_id | *string | 质量门禁 ID |
| severity | string | 严重程度（block/warning/info） |
| enabled | bool | 是否启用 |
| metadata | JSONB | 元数据 |
| created_at | time.Time | 创建时间 |
| updated_at | time.Time | 更新时间 |

### 3.2 PolicyViolation（违规）

| 字段 | 类型 | 描述 |
|------|------|------|
| id | string | 主键 |
| evaluation_id | *string | 关联评估 ID |
| policy_id | *string | 关联策略 ID |
| severity | string | 严重程度（critical/high/medium/low/info） |
| message | string | 违规消息 |
| resource_type | *string | 资源类型 |
| resource_id | *string | 资源 ID |
| status | string | 状态（open/acknowledged/resolved/waived） |
| created_at | time.Time | 创建时间 |

### 3.3 APIContract（API 合约）

| 字段 | 类型 | 描述 |
|------|------|------|
| id | string | 主键 |
| tenant_id | string | 租户 ID |
| service_name | string | 服务名称 |
| name | string | 合约名称 |
| description | *string | 描述 |
| endpoint | string | API 端点 |
| method | string | HTTP 方法 |
| version | string | 版本 |
| spec | JSONB | 规范定义 |
| schema | JSONB | Schema 定义 |
| status | string | 状态 |
| last_verified_at | *time.Time | 最后验证时间 |
| created_at | time.Time | 创建时间 |
| updated_at | time.Time | 更新时间 |

## 4. 验收标准

| 编号 | 标准 | 验证方式 |
|------|------|----------|
| GOV-01 | 支持创建策略（name/category/rego_path/severity） | API 测试 |
| GOV-02 | 支持查询策略列表（ tenant_id 隔离） | API 测试 |
| GOV-03 | 支持更新策略（enabled/metadata/severity） | API 测试 |
| GOV-04 | 支持删除策略 | API 测试 |
| GOV-05 | 策略分类：security/cost/quality/governance | API 测试 |
| GOV-06 | 策略严重程度：block/warning/info | API 测试 |
| GOV-07 | 多租户隔离 | 集成测试 |
| GOV-08 | 支持策略评估（PolicyEvaluation） | API 测试 |
| GOV-09 | 评估结果含 allowed/result/evaluated_at | API 测试 |
| GOV-10 | 支持记录违规（PolicyViolation） | API 测试 |
| GOV-11 | 违规状态：open/acknowledged/resolved/waived | API 测试 |
| GOV-12 | 违规严重程度：critical/high/medium/low/info | API 测试 |
| GOV-13 | 支持违规统计（ViolationStats） | API 测试 |
| GOV-14 | 支持创建豁免（PolicyOverride） | API 测试 |
| GOV-15 | 豁免状态：active/revoked/expired | API 测试 |
| GOV-16 | 支持创建 API 合约（APIContract） | API 测试 |
| GOV-17 | 支持验证合约合规性 | API 测试 |
| GOV-18 | 支持兼容性检查（BreakingChange） | API 测试 |
| GOV-19 | 支持影响分析（ImpactedService/ImpactedClient） | API 测试 |
| GOV-20 | 支持 API 版本管理（APIVersion） | API 测试 |
| GOV-21 | 版本状态：draft/active/deprecated/retired | API 测试 |
| GOV-22 | 支持创建治理规则（GovernanceRule） | API 测试 |
| GOV-23 | 治理规则类型：rate_limit/auth_required/versioning/documentation/naming/response_format | API 测试 |

## 5. 测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 25 | PolicyService、ViolationService、ContractService、OverrideService |
| 集成测试 | 8 | 策略→评估→违规→豁免→合约→版本闭环 |
| 前端测试 | 4 | 策略列表、违规详情、合约管理、版本管理 |
