# 风险评估（Risk Assessment）模块深度分析报告

**生成日期**: 2026-07-03
**分析模块**: `orion-platform-service/src/services/risk-assessment/` + `risk-engine/`

---

## 模块概览

Risk Assessment 模块承担**部署风险量化评估、风险评分引擎、风险报告生成**三大职责。当前实现已从 Mock 迁移到 PostgreSQL 持久化，包含基于加权因子的规则引擎和基于 XGBoost 的 ML 推理引擎双轨架构。

| 子域 | 目录/文件 | 当前状态 |
|------|----------|----------|
| 风险评分引擎（规则版） | `services/risk-assessment/RiskScoringEngine.ts` | ✅ 完整（PostgreSQL） |
| 风险评估服务 | `services/risk-assessment/RiskAssessmentService.ts` | ✅ 完整（PostgreSQL） |
| 健康检查服务 | `services/risk-assessment/HealthCheckService.ts` | ✅ 完整 |
| 风险评估类型定义 | `services/risk-assessment/types.ts` | ✅ 完整 |
| ML 风险预测引擎 | `services/risk-engine/RiskAssessmentService.ts` | ✅ 完整（XGBoost） |
| PageRank 服务 | `services/risk-engine/PageRankService.ts` | ✅ 完整 |
| 风险预测 Repository | `repositories/RiskAssessmentRepository.ts` + `RiskReportRepository.ts` | ✅ PostgreSQL |
| 风险预测 Repository | `repositories/RiskPredictionRepository.ts` | ✅ PostgreSQL |

---

## 架构设计

### 分层结构

```
API Routes (risk-assessment-routes.ts, risk-engine-routes.ts)
    ↓
Controllers (RiskAssessmentController, RiskEngineController)
    ↓
Service Layer (RiskAssessmentService, RiskScoringEngine, RiskEngineService)
    ↓
Repository Layer (RiskAssessmentRepository, RiskReportRepository, RiskPredictionRepository)
    ↓
PostgreSQL Database
```

### 关键设计模式

- **双轨风险引擎**：规则引擎（RiskScoringEngine）+ ML 引擎（XGBoost）并行，可根据场景选择
- **Repository Pattern**：所有数据访问通过 PostgreSQL Repository，支持 tenant_id 过滤
- **事件驱动**：风险评估完成后发布 `risk.assessment.completed` CloudEvent
- **健康检查集成**：评估前可选运行健康检查，结果纳入风险评分

---

## 功能完整性评估

### 风险评分引擎（规则版）

| 功能 | 状态 | 说明 |
|------|------|------|
| 变更规模评估 | ✅ | 基于文件数 + 代码行数 |
| 变更复杂度评估 | ✅ | 基于变更范围 + 关键依赖 |
| 依赖数量评估 | ✅ | 总依赖数 + 不健康依赖 |
| 测试覆盖评估 | ✅ | 基于历史失败率推断 |
| 历史失败率评估 | ✅ | 直接使用 recentFailureRate |
| 近期事故评估 | ✅ | 事故数量映射到风险分 |
| MTTR 评估 | ✅ | 平均恢复时间映射 |
| 团队经验评估 | ✅ | 基于变更规模 + 失败率推断 |
| 审查完整性评估 | ✅ | 基于变更范围推断 |
| 时间风险评估 | ✅ | 节假日/周末/非工作时间 |
| 风险等级划分 | ✅ | Low/Medium/High/Critical |
| 建议生成 | ✅ | 按优先级排序的建议列表 |
| 权重配置 | ✅ | 支持自定义权重 + 默认配置 |

### 风险评估服务

| 功能 | 状态 | 说明 |
|------|------|------|
| 部署风险评估 | ✅ | assessDeploymentRisk 完整实现 |
| 变更风险评估 | ✅ | assessChangeRisk 完整实现 |
| 评估历史查询 | ✅ | 多条件过滤（targetType/targetId/tenantId） |
| 评估详情 | ✅ | getAssessmentById |
| 报告生成 | ✅ | generateReport + 持久化 |
| 报告历史 | ✅ | getReportHistory |
| 健康检查集成 | ✅ | 可选 runHealthChecks |
| 事件发布 | ✅ | risk.assessment.completed CloudEvent |

### ML 风险预测引擎（risk-engine）

| 功能 | 状态 | 说明 |
|------|------|------|
| XGBoost 推理 | ✅ | 26 维特征输入 |
| SHAP 值解释 | ✅ | shapValues 输出 |
| 预测持久化 | ✅ | RiskPredictionRepository |
| PageRank 分析 | ✅ | 服务依赖图 PageRank |
| 模型版本管理 | ✅ | modelVersion 字段 |
| 置信度输出 | ✅ | confidence 字段 |

---

## API 端点清单

### 风险规则引擎（`/api/v1/risk-assessment`）

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/assess/deployment` | 部署风险评估 |
| POST | `/assess/change` | 变更风险评估 |
| GET | `/assessments` | 评估历史列表 |
| GET | `/assessments/:id` | 评估详情 |
| GET | `/reports` | 报告历史 |
| GET | `/reports/:id` | 报告详情 |
| POST | `/reports/generate` | 生成报告 |
| GET | `/health-check/:targetId` | 运行健康检查 |

### ML 风险引擎（`/api/v1/risk-engine`）

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/predict` | ML 风险预测 |
| POST | `/pagerank` | 服务依赖 PageRank |
| GET | `/predictions/:id` | 预测详情 |
| GET | `/models/versions` | 模型版本列表 |

---

## 数据模型

### RiskAssessment（风险评估）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 评估 ID |
| tenant_id | string | 租户 ID |
| name | string | 评估名称 |
| type | string | 评估类型（deployment/change） |
| target_type | string | 目标类型 |
| target_id | string | 目标 ID |
| score | number | 风险分数（0-100） |
| risk_level | string | 风险等级 |
| findings | JSONB | 风险因子 |
| status | string | 评估状态 |
| created_at | timestamp | 创建时间 |

### RiskReport（风险报告）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 报告 ID |
| tenant_id | string | 租户 ID |
| assessment_id | UUID | 关联评估 ID |
| risk_score | number | 风险分数 |
| risk_level | string | 风险等级 |
| can_deploy | boolean | 是否可部署 |
| critical_risk_count | integer | 关键风险数 |
| summary | JSONB | 报告摘要 |
| details | JSONB | 详细分析 |
| recommendations | JSONB[] | 建议列表 |
| generated_at | timestamp | 生成时间 |

### RiskPrediction（ML 预测）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 预测 ID |
| tenant_id | string | 租户 ID |
| target_type | string | 目标类型 |
| target_id | string | 目标 ID |
| risk_score | float | 风险分数（0-1） |
| risk_level | string | 风险等级 |
| confidence | float | 置信度 |
| shap_values | JSONB | SHAP 解释值 |
| model_version | string | 模型版本 |
| features | JSONB | 输入特征 |
| created_at | timestamp | 预测时间 |

---

## 与其他模块集成点

| 模块 | 集成点 | 状态 |
|------|--------|------|
| Deploy | 部署前风险评估 assessDeploymentRisk | ✅ |
| Change | 变更风险评估 assessChangeRisk | ✅ |
| Pipeline | 关联 pipeline_runs | ✅ |
| Health Check | 预部署健康检查 | ✅ |
| Event Bus | 发布 risk.assessment.completed 事件 | ✅ |
| Approval | 高风险自动触发审批 | ✅ 服务层有实现 |
| Monitoring | 获取服务健康指标 | ✅ |

---

## 缺失功能

### P0 级（阻塞生产）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 无前端页面 | 用户无法可视化风险评估 | 开发风险仪表板页面 |
| ML 模型未集成 | risk-engine 的 XGBoost 预测未在生产环境使用 | 完成模型训练 + 服务集成 |
| 无历史趋势分析 | 无法查看风险趋势变化 | 增加时间序列分析 |

### P1 级（高优先级）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 无审批流集成 | 高风险部署未自动阻止 | 与 Approval 模块联动 |
| 无自定义风险因子 | 用户无法添加行业特定风险因子 | 增加风险因子配置接口 |
| 无风险热力图 | 无法可视化服务风险分布 | 增加拓扑图 + 风险热力 |

### P2 级（改进项）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 权重配置硬编码 | 默认权重不适合所有团队 | 增加权重管理界面 |
| 无 A/B 测试对比 | 无法对比规则引擎 vs ML 引擎效果 | 增加预测对比报告 |
| 无告警集成 | 高风险未通知负责人 | 与 Alert 模块联动 |

---

## 技术债务

| 类别 | 债务项 | 风险 | 建议 |
|------|--------|------|------|
| 双引擎维护成本 | RiskScoringEngine + RiskEngineService 两套实现 | 中 | 统一接口，后端可切换 |
| 模型版本管理 | XGBoost 模型无版本追踪 | 中 | 增加 ModelVersion 集成 |
| 事件发布可选 | eventBus 为可选依赖，静默失败 | 低 | 强制事件总线连接 |

---

## 关键文件索引

| 文件路径 | 角色 | 重要性 |
|----------|------|--------|
| `services/risk-assessment/RiskAssessmentService.ts` | 风险评估核心服务 | ⭐⭐⭐ |
| `services/risk-assessment/RiskScoringEngine.ts` | 规则风险评分引擎 | ⭐⭐⭐ |
| `services/risk-assessment/HealthCheckService.ts` | 部署前健康检查 | ⭐⭐⭐ |
| `services/risk-engine/RiskAssessmentService.ts` | ML 风险预测服务 | ⭐⭐⭐ |
| `services/risk-engine/PageRankService.ts` | 服务依赖 PageRank | ⭐⭐ |
| `repositories/RiskAssessmentRepository.ts` | 评估数据访问 | ⭐⭐⭐ |
| `repositories/RiskReportRepository.ts` | 报告数据访问 | ⭐⭐⭐ |
| `repositories/RiskPredictionRepository.ts` | 预测数据访问 | ⭐⭐⭐ |

---

## 结论

**Risk Assessment 模块**是 Orion 平台的核心决策支持模块，已完成从 Map 到 PostgreSQL 的迁移，规则引擎和 ML 引擎双轨架构完整。

**当前最大缺口**：
1. 无前端可视化页面（用户无法使用）
2. ML 引擎（XGBoost）未完成集成训练
3. 与 Approval 模块的联动仅停留在服务层，路由未完全打通

建议优先补齐前端可视化，然后完成 ML 模型集成训练。
