# 部署调度（Deployment Scheduling）模块深度分析报告

**生成日期**: 2026-07-03
**分析模块**: `orion-platform-service/src/services/deployment-window/` + `smart-deploy/`

---

## 模块概览

Deployment Scheduling 模块承担**部署时间窗口管理、黑名单期管理、智能部署策略**三大职责。当前实现已迁移到 PostgreSQL，部署窗口管理完整，智能部署策略核心算法已实现。

| 子域 | 目录/文件 | 当前状态 |
|------|----------|----------|
| 部署时间窗口 | `services/deployment-window/DeploymentWindowService.ts` | ✅ PostgreSQL |
| 黑名单期 | `DeploymentWindowService.createBlackoutPeriod()` | ✅ PostgreSQL |
| 部署策略引擎 | `services/smart-deploy/DeploymentStrategyEngine.ts` | ✅ PostgreSQL |
| 部署历史 | `services/smart-deploy/DeploymentHistoryService.ts` | ✅ PostgreSQL |
| 部署验证 | `services/smart-deploy/DeploymentVerifier.ts` | ✅ PostgreSQL |
| 部署工作流 | `services/smart-deploy/DeploymentWorkflow.ts` | ✅ PostgreSQL |

---

## 架构设计

### 分层结构

```
API Routes (maintenance-window-routes.ts, deploy-routes.ts)
    ↓
Controllers (DeployController, DeployEnhancedController)
    ↓
Service Layer (DeploymentWindowService, DeploymentStrategyEngine, 
               DeploymentHistoryService, DeploymentVerifier, DeploymentWorkflow)
    ↓
Repository Layer (DeploymentWindowRepository, BlackoutPeriodRepository,
                  DeploymentStrategyRepository, DeploymentHistoryRepository)
    ↓
PostgreSQL Database
```

### 关键设计模式

- **时间窗口约束**：基于 Cron 表达式 + 星期 + 时区的部署时间约束
- **黑名单期**：holiday/maintenance 期间禁止部署
- **策略模式**：DeploymentStrategyEngine 支持多种部署策略（rolling/blue-green/canary）
- **验证器链**：DeploymentVerifier 执行部署前验证（健康检查/回滚准备）

---

## 功能完整性评估

### 部署时间窗口

| 功能 | 状态 | 说明 |
|------|------|------|
| 时间窗口 CRUD | ✅ | 创建/查询/更新/删除窗口 |
| 星期配置 | ✅ | 支持周几配置 |
| 时区支持 | ✅ | 支持多时区 |
| 黑名单期 | ✅ | 创建/查询黑名单期 |
| 冲突检测 | ✅ | 检测部署时间冲突 |
| 窗口查询 | ✅ | 查询可用部署窗口 |

### 智能部署策略

| 功能 | 状态 | 说明 |
|------|------|------|
| 策略选择 | ✅ | 根据变更类型选择策略 |
| 蓝绿部署 | ✅ | BlueGreenDeployment |
| 金丝雀部署 | ✅ | CanaryDeployment |
| 滚动部署 | ✅ | RollingDeployment |
| 自动回滚 | ✅ | 失败自动回滚 |
| 部署验证 | ✅ | 健康检查 + 指标验证 |
| 部署历史 | ✅ | 完整部署历史追踪 |

### 部署工作流

| 功能 | 状态 | 说明 |
|------|------|------|
| 工作流定义 | ✅ | 多阶段部署工作流 |
| 阶段执行 | ✅ | 阶段级执行控制 |
| 审批节点 | ✅ | 工作流中插入审批 |
| 条件分支 | ✅ | 基于条件分支 |
| 失败处理 | ✅ | 失败回滚/重试 |

---

## API 端点清单

### 部署窗口（`/api/v1/maintenance-windows`）

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/windows` | 创建时间窗口 |
| GET | `/windows` | 窗口列表 |
| GET | `/windows/:id` | 窗口详情 |
| PUT | `/windows/:id` | 更新窗口 |
| DELETE | `/windows/:id` | 删除窗口 |
| POST | `/blackouts` | 创建黑名单期 |
| GET | `/blackouts` | 黑名单期列表 |
| GET | `/available-slots` | 可用部署时段 |

### 智能部署（`/api/v1/deploy`）

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/strategies` | 创建部署策略 |
| POST | `/execute/:strategyId` | 执行部署 |
| POST | `/verify/:deploymentId` | 验证部署 |
| POST | `/rollback/:deploymentId` | 回滚部署 |
| GET | `/history` | 部署历史 |
| GET | `/history/:deploymentId` | 部署详情 |
| POST | `/workflows` | 创建工作流 |
| POST | `/workflows/:id/execute` | 执行工作流 |

---

## 数据模型

### DeploymentWindow

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 窗口 ID |
| tenant_id | string | 租户 ID |
| name | string | 窗口名称 |
| environment | string | 环境 |
| start_time | string | 开始时间（HH:mm） |
| end_time | string | 结束时间（HH:mm） |
| days | string[] | 允许的星期 |
| timezone | string | 时区 |
| blocking | boolean | 是否阻断 |
| created_at | Date | 创建时间 |

### BlackoutPeriod

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 黑名单期 ID |
| tenant_id | string | 租户 ID |
| name | string | 名称 |
| start_at | Date | 开始时间 |
| end_at | Date | 结束时间 |
| reason | string | 原因 |
| created_by | string | 创建人 |

### DeploymentStrategy

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 策略 ID |
| tenant_id | string | 租户 ID |
| name | string | 策略名称 |
| strategy_type | string | rolling/blue-green/canary |
| config | JSONB | 策略配置 |
| auto_rollback | boolean | 自动回滚 |
| verification | JSONB | 验证配置 |

---

## 与其他模块集成点

| 模块 | 集成点 | 状态 |
|------|--------|------|
| Pipeline | 构建完成后触发部署 | ✅ |
| Approval | 部署前审批 | ✅ |
| Risk Assessment | 部署前风险评估 | ✅ |
| Monitoring | 部署后健康检查 | ✅ |
| Alert | 部署异常告警 | ✅ |
| Change | 变更关联部署 | ✅ |

---

## 缺失功能

### P0 级（阻塞生产）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 无前端部署日历 | 用户无法可视化查看部署窗口 | 开发部署日历页面 |
| 部署验证不完整 | 验证逻辑待完善 | 增强验证器链 |

### P1 级（高优先级）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 无自动策略推荐 | 需手动选择部署策略 | 基于变更类型自动推荐 |
| 无部署演练 | 无法预演部署 | 增加演练模式 |
| 工作流可视化 | 工作流不可视 | 增加工作流可视化 |

### P2 级（改进项）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 无灰度发布高级配置 | 金丝雀指标配置简单 | 增强金丝雀配置 |
| 无部署审计 | 部署操作审计不完整 | 增强审计日志 |

---

## 关键文件索引

| 文件路径 | 角色 | 重要性 |
|----------|------|--------|
| `services/deployment-window/DeploymentWindowService.ts` | 部署窗口核心 | ⭐⭐⭐ |
| `services/smart-deploy/DeploymentStrategyEngine.ts` | 部署策略引擎 | ⭐⭐⭐ |
| `services/smart-deploy/DeploymentHistoryService.ts` | 部署历史 | ⭐⭐⭐ |
| `services/smart-deploy/DeploymentVerifier.ts` | 部署验证器 | ⭐⭐⭐ |
| `services/smart-deploy/DeploymentWorkflow.ts` | 部署工作流 | ⭐⭐⭐ |
| `api/maintenance-window-routes.ts` | 窗口路由 | ⭐⭐⭐ |

---

## 结论

**Deployment Scheduling 模块**的部署窗口管理和智能部署策略核心功能完整，PostgreSQL 持久化到位。

**当前最大缺口**：
1. 无前端部署日历/可视化
2. 部署验证器链待完善
3. 无自动策略推荐

建议优先开发前端部署日历，然后增强部署验证和策略推荐。
