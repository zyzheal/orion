# 运营支持（Operations Support）模块深度分析报告

**生成日期**: 2026-07-03
**分析模块**: `orion-platform-service/src/services/backup/` + `capacity/` + `project/` + `migration/` + `rdm/` + `cost/` + `multi-cloud/` + `federated-authz/` + `session/`

---

## 模块概览

Operations Support 模块承担**备份管理、容量规划、项目管理、迁移工具、RDM（需求/缺陷管理）、成本管理、多云管理、联邦授权、会话管理**九大职责。各子域完成度差异较大，核心 CRUD 功能基本完整，但业务深度各异。

| 子域 | 目录/文件 | 当前状态 |
|------|----------|----------|
| 备份管理 | `services/backup/BackupService.ts` + 3 Repository | ✅ PostgreSQL |
| 容量规划 | `services/capacity/CapacityService.ts` | ✅ PostgreSQL |
| 项目管理 | `services/project/ProjectService.ts` + `ProjectRepository.ts` | ✅ PostgreSQL |
| 迁移工具 | `services/migration/MigrationService.ts` | ⚠️ 单文件，基础实现 |
| RDM | `services/rdm/SprintBoardService.ts` + 2 Repository | ✅ PostgreSQL |
| 成本管理 | `services/cost/CostAnomalyDetectionService.ts` + 3 Service | ✅ PostgreSQL |
| 多云管理 | `services/multi-cloud/MultiCloudAdvancedService.ts` + 2 Service | ✅ PostgreSQL |
| 联邦授权 | `services/federated-authz/` | ❌ 空目录 |
| 会话管理 | `services/session/SessionService.ts` + `SessionRepository.ts` | ✅ PostgreSQL |

---

## 架构设计

### 分层结构

```
API Routes (backup-routes.ts, capacity-routes.ts, project-routes.ts, 
            cost-routes.ts, multi-cloud-routes.ts, session-routes.ts)
    ↓
Controllers (BackupController, CostController, MultiCloudController, SessionController)
    ↓
Service Layer (BackupService, CapacityService, ProjectService, 
               SprintBoardService, CostAnomalyDetectionService, 
               MultiCloudAdvancedService, SessionService)
    ↓
Repository Layer (BackupRepository, BackupPlanRepository, BackupScheduler,
                  ProjectRepository, SprintRepository, SprintTicketRepository,
                  VulnerabilityRepository, CostCalculator, etc.)
    ↓
PostgreSQL Database
```

### 关键设计模式

- **Repository Pattern**：所有子域均使用 PostgreSQL Repository
- **定时任务**：BackupScheduler 实现自动备份调度
- **成本异常检测**：CostAnomalyDetectionService 实现成本异常识别
- **多云抽象**：MultiCloudAdvancedService 统一多云 Provider 接口

---

## 功能完整性评估

### 备份管理

| 功能 | 状态 | 说明 |
|------|------|------|
| 备份计划 CRUD | ✅ | BackupPlanRepository |
| 备份执行 | ✅ | 手动/定时备份 |
| 备份恢复 | ✅ | 从备份恢复 |
| 备份调度 | ✅ | BackupScheduler 定时触发 |
| 备份历史 | ✅ | 备份记录查询 |
| 存储策略 | ⚠️ | 仅基础实现 |

### 容量规划

| 功能 | 状态 | 说明 |
|------|------|------|
| 容量预测 | ✅ | 基于历史数据预测 |
| 资源使用率 | ✅ | CPU/内存/磁盘监控 |
| 容量报告 | ✅ | 容量分析报告 |
| 告警阈值 | ⚠️ | 基础阈值支持 |

### 项目管理

| 功能 | 状态 | 说明 |
|------|------|------|
| 项目 CRUD | ✅ | 项目创建/查询/更新 |
| 项目成员 | ✅ | 成员管理 |
| 项目配置 | ✅ | 项目级配置 |
| 项目统计 | ⚠️ | 基础统计 |

### RDM（需求/缺陷/敏捷）

| 功能 | 状态 | 说明 |
|------|------|------|
| Sprint 管理 | ✅ | Sprint CRUD |
| Sprint 看板 | ✅ | SprintBoardService |
| 工单关联 | ✅ | SprintTicketRepository |
| 迭代统计 | ✅ | Sprint 统计 |

### 成本管理

| 功能 | 状态 | 说明 |
|------|------|------|
| 成本计算 | ✅ | CostCalculator |
| 预算管理 | ✅ | BudgetService |
| 异常检测 | ✅ | CostAnomalyDetectionService |
| 成本分配 | ✅ | CostBudgetGuardService |
| 成本报告 | ⚠️ | 基础报告 |

### 多云管理

| 功能 | 状态 | 说明 |
|------|------|------|
| 多云 Provider | ✅ | AWS/GCP/Azure 抽象 |
| 云服务同步 | ✅ | CloudSyncService |
| 资源抽象 | ✅ | ResourceAbstractionService |
| 高级多云 | ✅ | MultiCloudAdvancedService |

### 会话管理

| 功能 | 状态 | 说明 |
|------|------|------|
| 会话创建 | ✅ | 登录创建会话 |
| 会话查询 | ✅ | 多条件查询 |
| 会话失效 | ✅ | 登出/过期失效 |
| 会话统计 | ✅ | 活跃会话统计 |

---

## API 端点清单

### 备份（`/api/v1/backup`）

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/plans` | 创建备份计划 |
| GET | `/plans` | 计划列表 |
| POST | `/execute/:planId` | 执行备份 |
| GET | `/history` | 备份历史 |
| POST | `/restore/:backupId` | 恢复备份 |
| GET | `/status/:backupId` | 备份状态 |

### 容量（`/api/v1/capacity`）

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/predictions` | 容量预测 |
| GET | `/utilization` | 资源使用率 |
| GET | `/reports` | 容量报告 |
| POST | `/thresholds` | 配置告警阈值 |

### 项目（`/api/v1/projects`）

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/` | 创建项目 |
| GET | `/` | 项目列表 |
| GET | `/:id` | 项目详情 |
| PUT | `/:id` | 更新项目 |
| DELETE | `/:id` | 删除项目 |
| POST | `/:id/members` | 添加成员 |
| GET | `/:id/members` | 成员列表 |

### 成本（`/api/v1/cost`）

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/overview` | 成本概览 |
| GET | `/budgets` | 预算列表 |
| GET | `/anomalies` | 异常检测 |
| GET | `/trends` | 成本趋势 |
| POST | `/allocations` | 成本分配 |

### 多云（`/api/v1/multi-cloud`）

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/providers` | 云 Provider 列表 |
| GET | `/resources` | 资源列表 |
| POST | `/sync/:provider` | 同步云资源 |
| GET | `/cost/:provider` | 云成本 |
| POST | `/deploy/:provider` | 多云部署 |

### 会话（`/api/v1/sessions`）

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/active` | 活跃会话 |
| GET | `/user/:userId` | 用户会话 |
| DELETE | `/:sessionId` | 失效会话 |
| GET | `/statistics` | 会话统计 |

---

## 数据模型

### BackupPlan

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 计划 ID |
| tenant_id | string | 租户 ID |
| name | string | 计划名称 |
| schedule | string | Cron 表达式 |
| retention_days | integer | 保留天数 |
| storage_target | string | 存储目标 |
| enabled | boolean | 是否启用 |

### BackupRecord

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 备份 ID |
| plan_id | UUID | 关联计划 |
| tenant_id | string | 租户 ID |
| status | string | 备份状态 |
| size_bytes | bigint | 备份大小 |
| started_at | timestamp | 开始时间 |
| completed_at | timestamp | 完成时间 |
| error | text | 错误信息 |

### Project

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 项目 ID |
| tenant_id | string | 租户 ID |
| name | string | 项目名称 |
| description | text | 项目描述 |
| status | string | 项目状态 |
| visibility | string | 可见性 |
| created_by | string | 创建人 |
| created_at | timestamp | 创建时间 |

### Session

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 会话 ID |
| tenant_id | string | 租户 ID |
| user_id | string | 用户 ID |
| token | string | 会话令牌 |
| ip_address | string | IP 地址 |
| user_agent | string | User Agent |
| expires_at | timestamp | 过期时间 |
| last_activity | timestamp | 最后活动 |

---

## 与其他模块集成点

| 模块 | 集成点 | 状态 |
|------|--------|------|
| Pipeline | 构建后自动备份 | ⚠️ 未对接 |
| Deploy | 部署前备份 | ⚠️ 未对接 |
| Cost | 成本数据来源 | ✅ |
| Multi-Cloud | 多云资源同步 | ✅ |
| Auth | 会话管理 | ✅ |
| Tenant | 租户隔离 | ✅ |

---

## 缺失功能

### P0 级（阻塞生产）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 联邦授权空实现 | `federated-authz/` 为空目录 | 删除或实现 |
| 迁移工具基础 | MigrationService 为单文件基础实现 | 完善迁移逻辑 |

### P1 级（高优先级）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 备份恢复不完整 | 恢复逻辑待验证 | 完整测试恢复流程 |
| 容量预测不准确 | 基于简单线性预测 | 接入时序预测模型 |
| 多云部署未完成 | 部署逻辑待完善 | 完成多云部署编排 |

### P2 级（改进项）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 成本异常检测简单 | 基于阈值，无 ML | 接入异常检测算法 |
| 会话并发限制 | 无单用户会话数限制 | 增加并发控制 |
| 无备份加密 | 备份数据未加密 | 增加加密支持 |

---

## 技术债务

| 类别 | 债务项 | 风险 | 建议 |
|------|--------|------|------|
| 联邦授权空实现 | 空目录 | 低 | 删除或实现 |
| 迁移工具简单 | MigrationService 为单文件 | 中 | 完善迁移逻辑 |
| 容量预测简单 | 线性预测不准确 | 中 | 接入时序模型 |

---

## 关键文件索引

| 文件路径 | 角色 | 重要性 |
|----------|------|--------|
| `services/backup/BackupService.ts` | 备份核心服务 | ⭐⭐⭐ |
| `services/backup/BackupScheduler.ts` | 备份调度 | ⭐⭐⭐ |
| `services/capacity/CapacityService.ts` | 容量规划 | ⭐⭐⭐ |
| `services/project/ProjectService.ts` | 项目管理 | ⭐⭐ |
| `services/rdm/SprintBoardService.ts` | 敏捷看板 | ⭐⭐⭐ |
| `services/cost/CostAnomalyDetectionService.ts` | 成本异常检测 | ⭐⭐⭐ |
| `services/cost/CostCalculator.ts` | 成本计算 | ⭐⭐⭐ |
| `services/multi-cloud/MultiCloudAdvancedService.ts` | 多云高级服务 | ⭐⭐⭐ |
| `services/session/SessionService.ts` | 会话管理 | ⭐⭐⭐ |
| `repositories/SessionRepository.ts` | 会话数据访问 | ⭐⭐⭐ |

---

## 结论

**Operations Support 模块**的 8 个子域中，7 个已完成 PostgreSQL 持久化，核心 CRUD 功能完整。

**当前最大缺口**：
1. `federated-authz/` 为空目录，需删除或实现
2. `migration/` 工具为单文件基础实现
3. 各子域无前端页面（除部分集成在其他页面）

建议清理空目录，完善迁移工具，然后根据业务优先级开发前端页面。
