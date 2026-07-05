# Spec: 风险 (Risk)

> **日期**: 2026-07-03
> **状态**: 编写中
> **能力域**: 风险管理
> **目标成熟度**: L1 → L2
> **关键交付**: 风险识别、评分引擎、评估流程、缓解计划、风险报告

## 一、功能描述

### 1.1 现状评估 (L1)

Orion 当前已实现（Go 微服务 `orion-risk-svc-go`）：
- 风险 CRUD（RiskService + RiskRepository）
- 风险评分引擎（ScoringWeights/TechnicalWeights/HistoricalWeights）
- 风险评估（Assessment 模型）
- 风险评分计算（DefaultWeights）
- 多租户隔离
- OpenTelemetry 追踪

**不足**：
- 无风险缓解计划
- 无风险趋势追踪
- 无风险关联（关联工单/变更/CI）
- 无风险阈值告警
- 无风险报告
- 无风险热力图
- 无风险审批流程

### 1.2 Phase 1 目标 (L2)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 缓解计划 | 风险缓解措施 + 执行追踪 | L2 |
| 风险评分 | 多维度自动评分 + 权重配置 | L2 |
| 评估流程 | 定期评估 + 评审 + 审批 | L2 |
| 风险报告 | 风险热力图 + 趋势图 + 报告 | L2 |
| 阈值告警 | 高风险自动告警 + 升级 | L2 |
| 关联管理 | 关联工单/变更/CMDB CI | L2 |

## 二、验收标准

### 2.1 风险管理

| # | 标准 | 验证方式 |
|---|------|----------|
| RK1 | 支持创建风险（name/description/category/probability/impact） | API 测试 |
| RK2 | 风险分类：技术/业务/安全/合规/运营 | API 测试 |
| RK3 | 风险级别自动计算（概率 × 影响 = 风险值） | API 测试 |
| RK4 | 风险状态：identified/assessing/mitigating/monitoring/closed | API 测试 |
| RK5 | 风险可分配给责任人 | API 测试 |
| RK6 | 多租户隔离 | 集成测试 |
| RK7 | 风险创建时间线 | API 测试 |

### 2.2 评分引擎

| # | 标准 | 验证方式 |
|---|------|----------|
| RK8 | 评分维度：技术（变更大小/复杂度/依赖数/测试覆盖率） | API 测试 |
| RK9 | 评分维度：历史（失败率/近7天事故/MTTR） | API 测试 |
| RK10 | 评分维度：组织（团队经验/评审完整度/时段） | API 测试 |
| RK11 | 权重可配置（总分 1.0） | API 测试 |
| RK12 | 自动计算风险分数（0-100） | API 测试 |
| RK13 | 高风险（>80）自动标记 | API 测试 |
| RK14 | 评分历史记录 | API 测试 |

### 2.3 缓解计划

| # | 标准 | 验证方式 |
|---|------|----------|
| RK15 | 风险关联缓解措施（description/owner/status） | API 测试 |
| RK16 | 缓解状态：planned/in_progress/completed/blocked | API 测试 |
| RK17 | 缓解措施可更新/删除 | API 测试 |
| RK18 | 缓解完成自动更新风险状态 | API 测试 |
| RK19 | 缓解措施截止日期提醒 | API 测试 |
| RK20 | 缓解措施执行审计日志 | 单元测试 |

### 2.4 评估流程

| # | 标准 | 验证方式 |
|---|------|----------|
| RK21 | 定期评估：每月/每季度自动触发 | 集成测试 |
| RK22 | 评估记录：评估人/日期/分数/备注 | API 测试 |
| RK23 | 评估前后分数对比 | API 测试 |
| RK24 | 评估结果变化告警（分数上升 > 20） | 集成测试 |
| RK25 | 评估可撤销/重新评估 | API 测试 |

### 2.5 阈值告警

| # | 标准 | 验证方式 |
|---|------|----------|
| RK26 | 风险分数 > 80 自动触发 high 告警 | 集成测试 |
| RK27 | 风险分数 > 95 自动触发 critical 告警 | 集成测试 |
| RK28 | 告警含风险详情 + 建议措施 | API 测试 |
| RK29 | 高风险自动通知风险管理员 | 集成测试 |
| RK30 | 告警升级：24h 未处理升级上级 | 集成测试 |

### 2.6 报告与关联

| # | 标准 | 验证方式 |
|---|------|----------|
| RK31 | 风险热力图（概率-影响矩阵） | 前端验证 |
| RK32 | 风险趋势图（每周/每月风险分数变化） | 前端验证 |
| RK33 | 风险分布统计（按分类/级别） | API 测试 |
| RK34 | 月度风险报告 | API 测试 |
| RK35 | 风险可关联工单/变更/CI | API 测试 |
| RK36 | 关联资源可查看 | API 测试 |

## 三、API 设计

```
Base: /api/v1/risk
```

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/risks` | 创建风险 |
| GET | `/risks` | 风险列表 |
| GET | `/risks/:id` | 风险详情 |
| PUT | `/risks/:id` | 更新风险 |
| DELETE | `/risks/:id` | 删除风险 |
| POST | `/risks/:id/score` | 计算评分 |
| GET | `/risks/:id/score/history` | 评分历史 |
| POST | `/risks/:id/mitigations` | 添加缓解措施 |
| GET | `/risks/:id/mitigations` | 缓解措施列表 |
| PUT | `/mitigations/:id` | 更新缓解措施 |
| POST | `/risks/:id/assessments` | 创建评估 |
| GET | `/risks/:id/assessments` | 评估历史 |
| GET | `/risks/:id/relations` | 关联资源 |
| POST | `/risks/:id/relations` | 添加关联 |
| GET | `/statistics` | 风险统计 |
| GET | `/statistics/heatmap` | 热力图数据 |
| GET | `/reports/monthly` | 月度报告 |
| GET | `/alerts` | 风险告警 |

## 四、数据模型

```sql
-- 风险
CREATE TABLE IF NOT EXISTS risks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  category        VARCHAR(50) DEFAULT 'technical',
  probability     DECIMAL(5,2) DEFAULT 0.5,
  impact          DECIMAL(5,2) DEFAULT 0.5,
  risk_score      DECIMAL(5,2) GENERATED ALWAYS AS (probability * impact * 100) STORED,
  risk_level      VARCHAR(20) GENERATED ALWAYS AS (
    CASE WHEN probability * impact * 100 >= 80 THEN 'critical'
         WHEN probability * impact * 100 >= 60 THEN 'high'
         WHEN probability * impact * 100 >= 40 THEN 'medium'
         ELSE 'low' END
  ) STORED,
  status          VARCHAR(20) DEFAULT 'identified',
  owner_id        UUID REFERENCES users(id),
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 风险评分历史
CREATE TABLE IF NOT EXISTS risk_score_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id         UUID NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  score           DECIMAL(5,2) NOT NULL,
  weights_used    JSONB DEFAULT '{}',
  assessed_by     UUID REFERENCES users(id),
  assessed_at     TIMESTAMPTZ DEFAULT now()
);

-- 缓解措施
CREATE TABLE IF NOT EXISTS risk_mitigations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id         UUID NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  description     TEXT NOT NULL,
  owner_id        UUID REFERENCES users(id),
  status          VARCHAR(20) DEFAULT 'planned',
  due_date        DATE,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 风险评估
CREATE TABLE IF NOT EXISTS risk_assessments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id         UUID NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  probability     DECIMAL(5,2),
  impact          DECIMAL(5,2),
  score           DECIMAL(5,2),
  notes           TEXT,
  assessed_by     UUID REFERENCES users(id),
  assessed_at     TIMESTAMPTZ DEFAULT now()
);

-- 风险关联
CREATE TABLE IF NOT EXISTS risk_relations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id         UUID NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  target_type     VARCHAR(50) NOT NULL,
  target_id       UUID NOT NULL,
  relation_type   VARCHAR(50) DEFAULT 'related',
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(risk_id, target_type, target_id)
);

CREATE INDEX idx_risks_tenant ON risks(tenant_id, risk_level);
CREATE INDEX idx_risks_status ON risks(status);
CREATE INDEX idx_risks_score ON risks(risk_score DESC);
```

## 五、前端设计

**路由**: `/risk`

主要页面：
- 风险列表页：按级别/分类筛选
- 风险详情页：评分/缓解措施/评估历史
- 热力图页：概率-影响矩阵
- 趋势图页：风险分数变化
- 报告页：月度风险报告
- 评估页：评估表单

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 20 | RiskService、ScoreEngine、MitigationService |
| 集成测试 | 6 | 创建→评分→缓解→评估→告警→报告闭环 |
| 前端测试 | 4 | 风险列表、热力图、趋势图、报告 |

---
_文档版本: v1.0 | 创建日期: 2026-07-03 | 状态: 编写中_
