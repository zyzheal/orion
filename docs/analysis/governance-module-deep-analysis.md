# Governance（治理）模块深度分析报告

**生成日期**: 2026-07-03
**分析模块**: `orion-platform-service/src/services/policy/`、`docs/services/governance/`

---

## 模块概述

Governance 模块承担 **策略管理、策略评估、策略豁免、违规处理** 四大职责。当前实现处于**功能完整、待前端集成**阶段：核心策略引擎和评估逻辑已实现，但前端页面和 API 管理集成待完善。

| 子域 | 目录/文件 | 当前状态 |
|------|----------|----------|
| 策略管理 | `PolicyService.ts` + `PolicyRepository.ts` | ✅ 完整（PostgreSQL） |
| 策略评估 | `PolicyEvaluationService.ts` | ✅ 完整 |
| 策略豁免 | `ExemptionService.ts` | ✅ 完整（PostgreSQL） |
| 违规处理 | `PolicyViolationService.ts` | ✅ 完整（PostgreSQL） |
| 策略覆盖 | `PolicyOverrideService.ts` | ✅ 完整 |
| OPA 集成 | 设计文档存在 | ⚠️ 设计阶段，未实现 |

---

## 架构设计

### 分层结构

```
API Routes (待补充)
    ↓
Service Layer (PolicyService, PolicyEvaluationService, ExemptionService)
    ↓
Repository Layer (PolicyRepository)
    ↓
PostgreSQL (policies, policy_evaluations, exemptions, violations)
```

### 关键设计模式

- **策略模式**：`PolicyEvaluationService` 实现策略评估引擎
- **豁免模式**：`ExemptionService` 管理策略豁免
- **违规模式**：`PolicyViolationService` 处理违规事件
- **覆盖模式**：`PolicyOverrideService` 处理策略覆盖

---

## 功能完整性评估

### 策略管理

| 功能 | 状态 | 说明 |
|------|------|------|
| 策略 CRUD | ✅ | 支持多类型策略 |
| 策略版本 | ❌ | 未实现版本管理 |
| 策略导入/导出 | ❌ | 未实现 |
| 策略模板 | ❌ | 未实现 |

### 策略评估

| 功能 | 状态 | 说明 |
|------|------|------|
| 实时评估 | ✅ | 策略变更实时评估 |
| 批量评估 | ✅ | 批量资源评估 |
| 评估历史 | ✅ | 评估结果持久化 |
| 评估报告 | ✅ | 生成评估报告 |

### 策略豁免

| 功能 | 状态 | 说明 |
|------|------|------|
| 豁免申请 | ✅ | 支持提交豁免申请 |
| 豁免审批 | ✅ | 支持审批流 |
| 豁免到期 | ✅ | 自动过期 |
| 豁免审计 | ✅ | 记录豁免历史 |

### 违规处理

| 功能 | 状态 | 说明 |
|------|------|------|
| 违规检测 | ✅ | 实时检测违规 |
| 违规通知 | ⚠️ | 检测到违规，通知待集成 |
| 违规整改 | ❌ | 未实现整改跟踪 |
| 违规统计 | ✅ | 统计违规趋势 |

### OPA 集成

| 功能 | 状态 | 说明 |
|------|------|------|
| Rego 策略 | ❌ | 未实现 |
| OPA 服务 | ❌ | 未部署 |
| 策略同步 | ❌ | 未实现 |

---

## API 端点清单

### 推测端点（需验证路由注册）

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/v1/governance/policies` | 创建策略 |
| GET | `/api/v1/governance/policies` | 策略列表 |
| GET | `/api/v1/governance/policies/:id` | 策略详情 |
| PUT | `/api/v1/governance/policies/:id` | 更新策略 |
| DELETE | `/api/v1/governance/policies/:id` | 删除策略 |
| POST | `/api/v1/governance/policies/:id/evaluate` | 执行评估 |
| POST | `/api/v1/governance/exemptions` | 提交豁免 |
| GET | `/api/v1/governance/exemptions` | 豁免列表 |
| POST | `/api/v1/governance/exemptions/:id/approve` | 审批豁免 |
| GET | `/api/v1/governance/violations` | 违规列表 |
| POST | `/api/v1/governance/violations/:id/remediate` | 整改违规 |

**待确认**：路由文件是否存在并注册。

---

## 数据模型

### Policy

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| tenant_id | UUID | 租户 ID |
| name | string | 策略名称 |
| description | text | 策略描述 |
| type | enum | 策略类型 |
| rules | JSONB | 策略规则 |
| scope | JSONB | 适用范围 |
| severity | enum | info/warning/error |
| enabled | boolean | 是否启用 |
| created_at | timestamp | 创建时间 |

### PolicyEvaluation

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| policy_id | UUID | 关联策略 |
| resource_type | string | 资源类型 |
| resource_id | string | 资源 ID |
| result | enum | pass/fail/error |
| details | JSONB | 评估详情 |
| evaluated_at | timestamp | 评估时间 |

### Exemption

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| tenant_id | UUID | 租户 ID |
| policy_id | UUID | 关联策略 |
| resource_id | string | 资源 ID |
| reason | text | 豁免原因 |
| requested_by | UUID | 申请人 |
| approved_by | UUID | 审批人 |
| status | enum | pending/approved/rejected/expired |
| expires_at | timestamp | 过期时间 |

### PolicyViolation

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| tenant_id | UUID | 租户 ID |
| policy_id | UUID | 关联策略 |
| resource_id | string | 资源 ID |
| severity | enum | 严重级别 |
| status | enum | open/remediated/ignored |
| remediated_at | timestamp | 整改时间 |
| remediated_by | UUID | 整改人 |

---

## 依赖关系

| 模块 | 集成点 | 状态 |
|------|--------|------|
| Tenant | 多租户隔离 | ✅ |
| Auth | 认证授权 | ❌ 未接入 |
| Approval | 豁免审批 | ⚠️ 服务层有实现，路由待确认 |
| Notification | 违规通知 | ❌ 未集成 |
| Pipeline | Pipeline 策略评估 | ❌ 未集成 |
| Resource | 资源管理 | ❌ 未集成 |

---

## 问题清单

### P0 级（阻塞生产）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 无认证授权 | 安全风险 | 接入 authenticateUser + requirePermission |
| 无前端页面 | 运维无法使用 | 开发策略管理页面 |
| OPA 未集成 | 策略灵活性受限 | 实现 OPA 集成或完善内置策略引擎 |

### P1 级（高优先级）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 无策略版本管理 | 无法回滚策略变更 | 实现策略版本管理 |
| 无策略模板 | 配置效率低 | 实现策略模板库 |
| 无违规整改跟踪 | 违规无法闭环 | 实现整改跟踪 |
| 无通知集成 | 违规无通知 | 集成 Notification 模块 |

### P2 级（改进项）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 无策略导入/导出 | 迁移困难 | 实现策略导入/导出 |
| 无策略继承 | 配置冗余 | 实现策略继承 |
| 无策略模拟 | 预演风险 | 实现策略模拟执行 |
| 无策略效果分析 | 无法评估策略效果 | 实现策略效果分析 |

---

## 技术债务

| 类别 | 债务项 | 风险 | 建议 |
|------|--------|------|------|
| 无认证授权 | 待确认路由 | 高 | 接入权限中间件 |
| 无前端 | 无管理页面 | 高 | 开发前端页面 |
| OPA 未集成 | 设计文档存在 | 中 | 评估是否需要 OPA |
| 无版本管理 | 未实现 | 中 | 实现版本管理 |
| 无整改跟踪 | 未实现 | 中 | 实现整改闭环 |

---

## 与其他模块集成点

| 模块 | 集成点 | 状态 |
|------|--------|------|
| Tenant | 多租户 | ✅ |
| Auth | 认证授权 | ❌ |
| Approval | 豁免审批 | ⚠️ |
| Notification | 通知 | ❌ |
| Pipeline | Pipeline 评估 | ❌ |
| Resource | 资源管理 | ❌ |

---

## 建议优先级

### Phase 1：基础可用性（1-2 周）

1. 接入 authenticateUser + requirePermission
2. 确认并注册 governance 路由
3. 开发策略管理前端页面
4. 集成 Notification 模块发送违规通知

### Phase 2：功能增强（2-3 周）

5. 实现策略版本管理
6. 实现策略模板库
7. 实现违规整改跟踪
8. 实现策略导入/导出

### Phase 3：企业级特性（4-6 周）

9. 实现策略继承
10. 实现策略模拟执行
11. 实现策略效果分析
12. 与 OPA 集成（如需）

---

## 结论

Governance 模块**核心策略引擎完整**，策略评估、豁免、违规处理均已实现，但存在**集成缺口**（无前端、无通知）和**高级特性缺失**（无版本管理、无 OPA）。

**关键缺失**：认证授权、前端页面、策略版本管理、通知集成。

建议优先接入权限并开发前端，再完善版本管理和高级特性。
