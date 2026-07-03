# Policy 模块深度分析

**生成日期**: 2026-07-02  
**分析范围**: `orion-platform-service/src/services/policy/` + `src/api/policy-routes.ts` + `abac-policy-routes.ts` + `branch-policy-routes.ts` + `notification-policy-routes.ts`  
**模块标签**: OPA 策略引擎, ABAC, 质量门禁, 合规

---

## 一、现状概述

### 模块定位

Policy 模块是 Orion 的策略引擎核心，提供基于 OPA (Open Policy Agent) 的策略定义、评估、合规检查和豁免管理。覆盖 4 个策略域：通用策略 (policy)、ABAC 访问控制 (abac-policy)、分支策略 (branch-policy)、通知策略 (notification-policy)。

### 文件结构

| 文件 | 行数 | 职责 |
|------|------|------|
| `services/policy/PolicyService.ts` | - | 策略定义 CRUD + OPA Rego 评估 |
| `services/policy/PolicyEvaluationService.ts` | 461 | 策略评估编排、合规状态、强制执行摘要 |
| `services/policy/PolicyRepository.ts` | 101 | 策略定义和评估的数据库层 |
| `services/policy/PolicyOverrideService.ts` | 259 | 策略覆盖（Override）CRUD + 吊销 + 过期管理 |
| `services/policy/ExemptionService.ts` | 278 | 质量门禁豁免（Exemption）全生命周期 |
| `services/policy/PolicyViolationService.ts` | - | 违规记录管理 |
| `services/policy/QualityGateTrendService.ts` | - | 质量门禁趋势分析 |
| `services/policy/index.ts` | - | barrel 导出 |
| `api/policy-routes.ts` | - | 通用策略路由（主路由） |
| `api/abac-policy-routes.ts` | - | ABAC 策略路由 |
| `api/branch-policy-routes.ts` | - | 分支策略路由 |
| `api/notification-policy-routes.ts` | - | 通知策略路由 |

### 核心数据模型

- **PolicyDefinition**: id, name, resource, action, effect (allow/deny), rego_code, enabled
- **PolicyBundle**: id, version, policies[]
- **PolicyEvaluation**: id, policyId, runId, decision, eval_input, result
- **PolicyOverride**: id, policyId, status (active/revoked/expired), approvedBy, expiresAt, scope
- **Exemption**: id, violationId, policyId, status (pending/approved/rejected/expired/revoked), approvalChain[]
- **PolicyViolationEntity**: policy_id, evaluation_id, status

### 持久化方式

✅ 全部使用 PostgreSQL Repository 模式：
- `PolicyRepository`（policies + policy_evaluations）
- `PolicyEvaluationRepository`
- `PolicyViolationRepository`
- `PolicyOverrideRepository`

`ExemptionService` 使用原始 SQL 查询直接操作 `policy_exemptions` 表。

---

## 二、功能矩阵

| 功能点 | 状态 | 说明 |
|--------|------|------|
| 策略定义 CRUD | ✅ | 创建/查询/更新/删除，支持 Rego 代码 |
| 策略评估 | ⚠️ | **Mock 实现**：始终返回 `allowed: true`，无真实 OPA 评估 |
| 批量评估 | ⚠️ | 串行遍历调用 evaluate()，性能差 |
| 合规状态 | ✅ | 按策略和时间段计算合规率 |
| 强制执行摘要 | ✅ | 活跃/已解决违规统计 |
| 策略覆盖（Override） | ✅ | 完整 CRUD + 吊销 + 自动过期 |
| 质量门禁豁免 | ✅ | 提交→审批→吊销→自动过期，含审批链 |
| 豁免活跃检查 | ✅ | 检查违规是否有活跃豁免 |
| ABAC 策略路由 | ✅ | 独立路由文件 |
| 分支策略路由 | ✅ | 独立路由文件 |
| 通知策略路由 | ✅ | 独立路由文件 |
| 违规管理 | ✅ | 状态更新（waive/resolve）、按策略/状态查询 |
| 趋势分析 | ✅ | QualityGateTrendService |

---

## 三、API 端点

### 通用策略 (policy-routes.ts)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 策略列表 |
| POST | `/` | 创建策略 |
| GET | `/:id` | 策略详情 |
| PUT | `/:id` | 更新策略 |
| DELETE | `/:id` | 删除策略 |
| POST | `/:id/evaluate` | 评估策略 |
| GET | `/evaluations` | 评估列表 |
| GET | `/evaluations/:id` | 评估详情 |
| GET | `/evaluations/:id/violations` | 评估违规 |
| POST | `/test` | 测试策略 |
| POST | `/:id/toggle` | 启用/禁用 |
| GET | `/overrides` | 覆盖列表 |
| POST | `/overrides` | 创建覆盖 |
| GET | `/overrides/:id` | 覆盖详情 |
| PUT | `/overrides/:id` | 更新覆盖 |
| DELETE | `/overrides/:id` | 删除覆盖 |
| POST | `/overrides/:id/revoke` | 吊销覆盖 |
| GET | `/exemptions` | 豁免列表 |
| POST | `/exemptions` | 提交豁免 |
| GET | `/exemptions/:id` | 豁免详情 |
| POST | `/exemptions/:id/review` | 审批豁免 |
| POST | `/exemptions/:id/revoke` | 吊销豁免 |
| POST | `/exemptions/expire` | 自动过期 |
| GET | `/compliance` | 合规状态 |
| GET | `/enforcement` | 强制摘要 |
| GET | `/bundles` | Bundle 列表 |
| POST | `/bundles` | 创建 Bundle |
| GET | `/bundles/:id` | Bundle 详情 |
| DELETE | `/bundles/:id` | 删除 Bundle |
| POST | `/bundles/:id/sync` | 同步 Bundle |

### ABAC 策略 (abac-policy-routes.ts)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/abac/policies` | ABAC 策略列表 |
| POST | `/abac/policies` | 创建 ABAC 策略 |
| GET | `/abac/policies/:id` | ABAC 策略详情 |
| PUT | `/abac/policies/:id` | 更新 ABAC 策略 |
| DELETE | `/abac/policies/:id` | 删除 ABAC 策略 |
| POST | `/abac/evaluate` | 评估 ABAC |

### 分支策略 (branch-policy-routes.ts)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/branch-policies` | 分支策略列表 |
| POST | `/branch-policies` | 创建分支策略 |
| GET | `/branch-policies/:id` | 分支策略详情 |
| PUT | `/branch-policies/:id` | 更新分支策略 |
| DELETE | `/branch-policies/:id` | 删除分支策略 |

### 通知策略 (notification-policy-routes.ts)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/notification-policies` | 通知策略列表 |
| POST | `/notification-policies` | 创建通知策略 |
| GET | `/notification-policies/:id` | 通知策略详情 |
| PUT | `/notification-policies/:id` | 更新通知策略 |
| DELETE | `/notification-policies/:id` | 删除通知策略 |

---

## 四、依赖关系

### 内部依赖

- `PolicyEvaluationService` → `PolicyEvaluationRepository`, `PolicyViolationRepository`
- `PolicyOverrideService` → `PolicyOverrideRepository`
- `ExemptionService` → 直接 SQL 操作 `policy_exemptions` 表
- `PolicyController`, `PolicyEvaluationController` → 对应 Service

### 外部依赖

- `DatabasePool`（所有 Service）
- `errors.ts`（`OrionError`, `ErrorCode`）
- `utils/logger.ts`
- `db/tenant-context-storage.ts`（获取当前租户）

### 测试覆盖

✅ 7 个测试文件:
- `__tests__/PolicyService.test.ts`
- `__tests__/PolicyRepository.test.ts`
- `__tests__/PolicyEvaluationService.test.ts`
- `__tests__/PolicyOverrideService.test.ts`
- `__tests__/ExemptionService.test.ts`
- `__tests__/PolicyViolationService.test.ts`
- `__tests__/QualityGateTrendService.test.ts`
- `__tests__/index.test.ts`

---

## 五、风险与改进建议

| 风险 | 级别 | 建议 |
|------|------|------|
| **策略评估是 Mock**：`evaluate()` 始终返回 `allowed: true`，无真实 OPA Rego 执行 | **P0** | 集成 `@openpolicyagent/opa-wasm` 或 OPA REST API 执行 Rego 策略 |
| **合规检查数据准确性**：由于评估始终允许，合规率永远 100% | **P0** | 修复 OPA 集成后，合规报告才能反映真实状态 |
| **无策略版本控制**：更新策略直接覆盖，无法回滚 | **P1** | 引入策略版本管理，支持回滚到历史版本 |
| **ExemptionService 使用原始 SQL**：未统一到 Repository 模式 | **P1** | 创建 `PolicyExemptionRepository` 替代直接 SQL |
| **评估性能问题**：`evaluateBatch()` 串行遍历，大并发场景性能差 | **P1** | 改为并行评估（Promise.all），带超时控制 |
| **无策略依赖分析**：无法查看策略被哪些资源引用 | **P2** | 增加策略使用分析 |
| **4 个策略域未统一**：每种策略有独立路由文件，数据模型不统一 | **P2** | 抽象策略基类，统一策略管理界面 |
| **Bundle 功能不完整**：Bundle CRUD 有但未与评估流程集成 | **P2** | Bundle 内容应包含实际策略引用 |

---

## 六、总结

Policy 模块是 Orion 中**功能最丰富的模块之一**：7 个 Service 文件、4 个路由文件、完整的 Override 和 Exemption 流程、7 个测试文件。策略管理生命周期（定义→评估→违规→覆盖→豁免→过期）设计完整。

**致命短板是策略评估始终返回 `allowed: true`（P0）**——所有合规报告、强制执行数据都基于虚假的"全部允许"结果。没有真实 OPA 集成，整个模块只是一个策略管理界面，无法实际执行访问控制或合规检查。
