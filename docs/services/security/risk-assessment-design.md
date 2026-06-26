# Risk Assessment Service Design

> 状态: ✅ 后端已实现 | 数据存储: PostgreSQL Repository 模式
> 创建日期: 2026-04-23 | 关联: M4 安全审计中心

---

## 1. 服务概述

Risk Assessment Service (风险评估服务) 是 Orion 平台安全审计中心的核心组件，负责对部署变更、配置漂移、安全事件进行风险评估和评分。

## 2. 代码位置

```
orion-platform-service/src/services/risk-assessment/
├── HealthCheckService.ts      # 健康检查服务
├── RiskAssessmentService.ts   # 风险评估主服务
├── RiskEventSubscriber.ts     # 风险事件订阅
├── RiskScoringEngine.ts       # 风险评分引擎
├── types.ts                   # 类型定义
└── index.ts                   # 模块导出
```

## 3. 核心功能

### 3.1 RiskAssessmentService

| 功能 | 说明 | 状态 |
|------|------|------|
| assessDeploymentRisk() | 部署变更风险评估 | ✅ Mock |
| assessConfigDrift() | 配置漂移风险评估 | ✅ Mock |
| getRiskHistory() | 获取风险历史记录 | ✅ Mock |
| calculateRiskScore() | 计算风险评分 | ✅ Mock |

### 3.2 RiskScoringEngine

| 功能 | 说明 |
|------|------|
| calculateBaseScore() | 计算基础风险分 |
| applyContextFactors() | 应用上下文因子 |
| generateRiskLevel() | 生成风险等级 (LOW/MEDIUM/HIGH/CRITICAL) |

### 3.3 HealthCheckService

| 功能 | 说明 |
|------|------|
| checkServiceHealth() | 服务健康检查 |
| getSystemRiskStatus() | 获取系统风险状态 |

## 4. 已知问题

- ⚠️ 数据存储使用 `Map()` 内存模拟，重启后数据丢失
- ⚠️ 风险评分算法为 Mock 实现，无真实机器学习模型
- ⚠️ 需与 M4 安全审计中心集成，补充数据库持久化

## 5. API 路由

当前无独立路由文件，风险评估功能通过 `ai-security-routes.ts` 和 `risk-routes.ts` 提供。

## 6. 后续计划

- [ ] 将数据存储迁移至 PostgreSQL
- [ ] 集成真实 ML 风险评分模型
- [ ] 添加实时风险监控仪表盘
- [ ] 与 M17 自愈引擎联动