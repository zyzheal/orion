# 变更智能与变更请求（Change Intelligence & Change Request）模块深度分析报告

**生成日期**: 2026-07-03
**分析模块**: `orion-platform-service/src/services/change-intelligence/` + `change-request/` + 相关路由

---

## 模块概览

Change Intelligence & Change Request 模块承担**变更影响分析、变更风险评估、变更请求全生命周期管理**三大职责。当前实现已迁移到 PostgreSQL，AI 驱动的变更智能分析是核心亮点。

| 子域 | 目录/文件 | 当前状态 |
|------|----------|----------|
| 变更智能分析 | `services/change-intelligence/ChangeIntelligenceService.ts` | ✅ PostgreSQL |
| 影响服务识别 | `ChangeIntelligenceService.analyze()` | ✅ 受影响服务识别 |
| 历史变更匹配 | `HistoricalMatchRepository` | ✅ PostgreSQL |
| 风险因子计算 | `RiskFactorRepository` | ✅ PostgreSQL |
| 爆炸半径计算 | `BlastRadiusCalculator` | ✅ 算法实现 |
| 变更请求 | `services/change-request/ChangeRequestService.ts` | ✅ PostgreSQL |
| 变更审批 | `ChangeApprovalRepository` | ✅ PostgreSQL |
| 变更执行 | `ChangeExecutionRepository` | ✅ PostgreSQL |

---

## 架构设计

### 分层结构

```
API Routes (change-intelligence-routes.ts, change-routes.ts, change-request-routes.ts)
    ↓
Controllers (ChangeIntelligenceController)
    ↓
Service Layer (ChangeIntelligenceService, ChangeRequestService)
    ↓
Repository Layer (ChangeIntelligenceRepository, AffectedServiceRepository, 
                   RiskFactorRepository, HistoricalMatchRepository,
                   ChangeRequestRepository, ChangeApprovalRepository, 
                   ChangeExecutionRepository)
    ↓
PostgreSQL Database
```

### 关键设计模式

- **AI 变更分析**：ChangeIntelligenceService 综合分析变更内容，生成影响报告
- **爆炸半径计算**：基于依赖图计算变更影响的服务范围
- **历史相似匹配**：通过 HistoricalMatchRepository 匹配历史相似变更
- **变更状态机**：ChangeRequest 经历 draft → submitted → approved → executing → completed

---

## 功能完整性评估

### 变更智能分析

| 功能 | 状态 | 说明 |
|------|------|------|
| 变更影响分析 | ✅ | 分析代码变更影响 |
| 受影响服务识别 | ✅ | 识别受影响的服务列表 |
| 爆炸半径计算 | ✅ | 计算 blast radius |
| 风险因子评估 | ✅ | 多维度风险因子 |
| 历史变更匹配 | ✅ | 匹配历史相似变更 |
| 风险等级计算 | ✅ | computeRiskLevel() |
| 智能报告生成 | ✅ | ChangeIntelligenceReport |

### 变更请求管理

| 功能 | 状态 | 说明 |
|------|------|------|
| 变更请求 CRUD | ✅ | 创建/查询/更新/删除 |
| 变更审批流 | ✅ | 多级审批 |
| 审批记录 | ✅ | ChangeApprovalRepository |
| 执行追踪 | ✅ | ChangeExecutionRepository |
| 状态流转 | ✅ | draft → submitted → approved → executing → completed |
| 关联部署 | ✅ | 关联 Deployment |
| 关联 Pipeline | ✅ | 关联 Pipeline Run |

---

## API 端点清单

### 变更智能（`/api/v1/change-intelligence`）

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/analyze` | 分析变更影响 |
| GET | `/reports/:changeId` | 获取变更报告 |
| GET | `/affected-services/:changeId` | 受影响服务 |
| GET | `/historical-matches/:changeId` | 历史相似变更 |
| POST | `/blast-radius` | 计算爆炸半径 |
| GET | `/risk-factors/:changeId` | 风险因子 |

### 变更管理（`/api/v1/changes`）

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/` | 创建变更请求 |
| GET | `/` | 变更列表 |
| GET | `/:id` | 变更详情 |
| PUT | `/:id` | 更新变更 |
| POST | `/:id/submit` | 提交审批 |
| POST | `/:id/approve` | 审批通过 |
| POST | `/:id/reject` | 审批拒绝 |
| POST | `/:id/execute` | 执行变更 |
| POST | `/:id/complete` | 完成变更 |
| GET | `/:id/approvals` | 审批记录 |
| GET | `/:id/executions` | 执行记录 |

---

## 数据模型

### ChangeIntelligenceReport

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 报告 ID |
| change_id | UUID | 关联变更 |
| tenant_id | string | 租户 ID |
| risk_level | string | 风险等级 |
| blast_radius | integer | 爆炸半径 |
| affected_services | JSONB | 受影响服务 |
| risk_factors | JSONB | 风险因子 |
| historical_matches | JSONB | 历史匹配 |
| recommendations | JSONB[] | 建议 |
| generated_at | timestamp | 生成时间 |

### ChangeRequest

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 变更 ID |
| tenant_id | string | 租户 ID |
| title | string | 变更标题 |
| description | text | 变更描述 |
| change_type | string | 变更类型 |
| priority | string | 优先级 |
| status | string | 变更状态 |
| submitter_id | string | 提交人 |
| approver_id | string | 审批人 |
| scheduled_at | timestamp | 计划时间 |
| created_at | timestamp | 创建时间 |

---

## 与其他模块集成点

| 模块 | 集成点 | 状态 |
|------|--------|------|
| Deploy | 变更关联部署 | ✅ |
| Pipeline | 变更关联 Pipeline | ✅ |
| Approval | 变更审批流 | ✅ |
| Risk Assessment | 变更风险评估 | ✅ |
| Code | 代码变更分析 | ✅ |

---

## 缺失功能

### P0 级（阻塞生产）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 无前端变更页面 | 用户无法管理变更请求 | 开发变更管理页面 |
| 审批流未可视化 | 审批状态不透明 | 增加审批可视化 |

### P1 级（高优先级）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 无变更模板 | 重复变更需重复填写 | 增加变更模板 |
| 无变更日历 | 变更时间冲突无法检测 | 增加变更日历视图 |
| 无自动关联 | 需手动关联 Pipeline/Deploy | 自动关联相关资源 |

### P2 级（改进项）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 无变更回顾 | 无法总结变更经验 | 增加变更回顾功能 |
| 无变更 SLA | 变更处理时效不追踪 | 增加 SLA 监控 |

---

## 关键文件索引

| 文件路径 | 角色 | 重要性 |
|----------|------|--------|
| `services/change-intelligence/ChangeIntelligenceService.ts` | 变更智能核心 | ⭐⭐⭐ |
| `services/change-request/ChangeRequestService.ts` | 变更请求核心 | ⭐⭐⭐ |
| `repositories/ChangeIntelligenceRepository.ts` | 智能分析数据访问 | ⭐⭐⭐ |
| `repositories/ChangeRequestRepository.ts` | 变更请求数据访问 | ⭐⭐⭐ |
| `repositories/ChangeApprovalRepository.ts` | 审批数据访问 | ⭐⭐⭐ |
| `repositories/ChangeExecutionRepository.ts` | 执行数据访问 | ⭐⭐⭐ |
| `api/change-intelligence-routes.ts` | 变更智能路由 | ⭐⭐⭐ |
| `api/change-routes.ts` | 变更管理路由 | ⭐⭐⭐ |

---

## 结论

**Change Intelligence & Change Request 模块**的 AI 变更分析和变更请求管理功能完整，PostgreSQL 持久化到位。

**当前最大缺口**：
1. 无前端变更管理页面
2. 无变更日历视图
3. 无变更模板

建议优先开发前端变更管理页面，然后完善变更日历和模板功能。
