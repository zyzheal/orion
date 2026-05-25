# FinOps 成本优化模块完整设计（FinOps Complete Design）

> 文档日期：2026-05-22
> 状态：设计完成，待实现
> 关联 DDL：现有 `031_create_cost_tables.sql`、`094_cost_operations.sql`、`156_pipeline_budget.sql`
> 菜单归属：治理（`/governance`），图标 `SafetyCertificateOutlined`

---

## 1. 功能设计（后端）

### 1.1 业务闭环

FinOps 模块实现"采集→归因→分析→优化→预算"五步闭环：

```
成本数据源（AI API 调用 / Pipeline 运行 / 多云账单）
        │
        ▼ (采集 + 标准化)
  Cost Collection ───────────────► cost_records
        │
        ▼ (维度打标 + 分摊)
  Cost Attribution ──────────────► 按项目/团队/环境/标签归因
        │
        ▼ (时序分析 + 异常检测)
  Analysis & Anomaly Detection ──► cost_anomalies
        │
        ▼ (规则引擎 + 机器学习建议)
  Optimization Recommendations ──► 闲置资源/降配/预留实例
        │
        ▼ (预算门禁 + 预警)
  Budget Enforcement ────────────► budgets + cost_budget_guards
```

**闭环触发关系**：
- 新成本记录写入 → 自动更新 budget 的 `spent` 字段
- 超预算 80% → 触发 warning 告警
- 超预算 95% → 触发 critical 告警 + 可能阻断 Pipeline
- 异常检测发现偏差 > 50% → 写入 `cost_anomalies` + 通知

### 1.2 现有表分析

| 表名 | 迁移编号 | 字段数 | 用途 |
|------|----------|--------|------|
| `budgets` | 031 | 10 | 预算定义（租户/项目/用户维度） |
| `cost_records` (031) | 031 | 13 | AI 模型调用成本记录 |
| `cost_records` (094) | 094 | 8 | Pipeline 运行成本记录（租户隔离版） |
| `alert_rules` | 031 | 9 | 预算告警规则 |
| `cost_anomalies` | 094 | 10 | 成本异常检测记录 |
| `cost_budget_guards` | 094 | 8 | Pipeline 预算门禁 |
| `model_pricing` | 031 | 8 | AI 模型定价表 |
| `multi_cloud_cost` | 113 | 12 | 多云成本（跨云维度） |
| `pipeline_budgets` | 156 | — | Pipeline 预算（需确认结构） |

**注意**：`cost_records` 在两个迁移中定义，094 版本为租户隔离增强版，实际使用以 094 版本为准。

**不足**：
1. 缺少成本优化建议存储表
2. 缺少成本预测表
3. 缺少 ROI 分析表
4. 缺少资源利用率与成本关联表

### 1.3 需新建表

#### 迁移 197：FinOps 增强表

```sql
-- 197: FinOps Enhancement
-- 成本优化建议、成本预测、ROI 分析、资源利用率

-- cost_optimization_recommendations 表（成本优化建议）
CREATE TABLE IF NOT EXISTS cost_optimization_recommendations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  resource_type     VARCHAR(100) NOT NULL,                  -- compute, storage, database, ai_model, pipeline
  resource_id       VARCHAR(200),
  recommendation_type VARCHAR(50) NOT NULL,                  -- idle_resource, rightsizing, reserved_instance, spot_instance, cleanup, schedule
  description       TEXT NOT NULL,
  current_cost      DECIMAL(10, 2) NOT NULL,
  estimated_savings DECIMAL(10, 2) NOT NULL,
  savings_percent   DECIMAL(5, 2),
  confidence        DECIMAL(3, 2) NOT NULL DEFAULT 0.50,    -- 0.00 - 1.00 置信度
  priority          VARCHAR(20) NOT NULL DEFAULT 'medium',   -- low, medium, high, critical
  status            VARCHAR(30) NOT NULL DEFAULT 'pending',  -- pending, accepted, rejected, applied, expired
  applied_at        TIMESTAMPTZ,
  applied_by        VARCHAR(100),
  rejection_reason  TEXT,
  expires_at        TIMESTAMPTZ,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX idx_cost_opt_rec_tenant ON cost_optimization_recommendations(tenant_id);
CREATE INDEX idx_cost_opt_rec_type ON cost_optimization_recommendations(recommendation_type);
CREATE INDEX idx_cost_opt_rec_status ON cost_optimization_recommendations(status);
CREATE INDEX idx_cost_opt_rec_priority ON cost_optimization_recommendations(priority);
CREATE INDEX idx_cost_opt_rec_savings ON cost_optimization_recommendations(estimated_savings DESC);
CREATE INDEX idx_cost_opt_rec_expires ON cost_optimization_recommendations(expires_at);

-- cost_forecasts 表（成本预测）
CREATE TABLE IF NOT EXISTS cost_forecasts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  forecast_type     VARCHAR(30) NOT NULL DEFAULT 'monthly',  -- daily, weekly, monthly, quarterly
  scope_type        VARCHAR(30) NOT NULL DEFAULT 'tenant',   -- tenant, project, budget
  scope_id          VARCHAR(100),
  forecast_period   VARCHAR(20) NOT NULL,                    -- YYYY-MM 格式
  predicted_cost    DECIMAL(12, 2) NOT NULL,
  lower_bound       DECIMAL(12, 2),                         -- 95% 置信区间下界
  upper_bound       DECIMAL(12, 2),                         -- 95% 置信区间上界
  algorithm         VARCHAR(30) NOT NULL,                    -- linear_regression, exponential_smoothing, seasonal_decomp
  actual_cost       DECIMAL(12, 2),                         -- 实际值（事后回填）
  accuracy_score    DECIMAL(5, 2),                          -- 预测准确率 (0-100)
  breakdown         JSONB NOT NULL DEFAULT '{}',            -- 按维度拆解
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cost_forecasts_tenant ON cost_forecasts(tenant_id);
CREATE INDEX idx_cost_forecasts_period ON cost_forecasts(forecast_period);
CREATE INDEX idx_cost_forecasts_scope ON cost_forecasts(scope_type, scope_id);
CREATE INDEX idx_cost_forecasts_accuracy ON cost_forecasts(accuracy_score DESC);

-- cost_roi_analysis 表（ROI 分析）
CREATE TABLE IF NOT EXISTS cost_roi_analysis (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  analysis_type     VARCHAR(50) NOT NULL,                    -- pipeline_roi, ai_model_roi, infrastructure_roi
  scope_id          VARCHAR(100),                           -- pipeline_id / model_name / etc.
  scope_name        VARCHAR(200) NOT NULL,
  period            VARCHAR(20) NOT NULL,                    -- YYYY-MM
  total_cost        DECIMAL(12, 2) NOT NULL,
  total_benefit     DECIMAL(12, 2) NOT NULL DEFAULT 0,       -- 收益（分钟节省、故障减少等折现）
  roi_percent       DECIMAL(5, 2),                          -- (benefit - cost) / cost * 100
  payback_months    DECIMAL(5, 2),                          -- 回收月数
  metrics           JSONB NOT NULL DEFAULT '{}',            -- 原始指标
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cost_roi_tenant ON cost_roi_analysis(tenant_id);
CREATE INDEX idx_cost_roi_type ON cost_roi_analysis(analysis_type);
CREATE INDEX idx_cost_roi_period ON cost_roi_analysis(period);
CREATE INDEX idx_cost_roi_roi ON cost_roi_analysis(roi_percent DESC);

-- cost_attribution_tags 表（成本归因标签映射）
CREATE TABLE IF NOT EXISTS cost_attribution_tags (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tag_key           VARCHAR(200) NOT NULL,                   -- 如 cost-center, team, project
  tag_value         VARCHAR(500) NOT NULL,
  attribution_type  VARCHAR(30) NOT NULL,                    -- project, team, environment, department
  cost_multiplier   DECIMAL(5, 2) NOT NULL DEFAULT 1.00,     -- 分摊系数
  status            VARCHAR(30) NOT NULL DEFAULT 'active',
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cost_attr_tenant ON cost_attribution_tags(tenant_id);
CREATE INDEX idx_cost_attr_type ON cost_attribution_tags(attribution_type);
CREATE INDEX idx_cost_attr_key ON cost_attribution_tags(tag_key);
CREATE INDEX idx_cost_attr_status ON cost_attribution_tags(status);

-- updated_at 触发器
CREATE TRIGGER set_cost_opt_recommendations_updated_at
  BEFORE UPDATE ON cost_optimization_recommendations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_cost_forecasts_updated_at
  BEFORE UPDATE ON cost_forecasts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_cost_attribution_tags_updated_at
  BEFORE UPDATE ON cost_attribution_tags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE cost_optimization_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_roi_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_attribution_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_cost_opt ON cost_optimization_recommendations
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_cost_forecasts ON cost_forecasts
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_cost_roi ON cost_roi_analysis
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_cost_attr ON cost_attribution_tags
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
```

### 1.4 核心功能

#### 1.4.1 成本归因分析

**功能**：将原始成本记录按多维度打标，实现成本分摊与追溯。

**归因维度**：

| 维度 | 数据来源 | 示例 |
|------|----------|------|
| 项目 | `cost_records.project_id` → projects 表 | ProjectAlpha |
| 团队 | cost_attribution_tags 映射 | TeamFrontend |
| 环境 | cost_records.metadata.env | prod/staging/dev |
| 租户 | cost_records.tenant_id | TenantA |
| 用户 | cost_records.user_id | user123 |
| 模块 | cost_records.module_type | pipeline/ai-agent/chat |
| 云提供商 | multi_cloud_cost.cloud_provider | AWS/Azure |

**归因计算逻辑**：
1. 直接归因：成本记录已有 `project_id`/`user_id` 的直接归属
2. 标签归因：通过 `cost_attribution_tags` 表的标签匹配
3. 比例分摊：共享资源（如 K8s 集群）按 `cost_multiplier` 分摊
4. 未归因成本：归入 `unattributed` 类别，标记待处理

**实现代码位置**：
- Service: `orion-platform-service/src/services/finops/CostAttributionService.ts`
- Controller: `orion-platform-service/src/api/controllers/FinOpsController.ts`
- Routes: `orion-platform-service/src/api/finops-routes.ts`

#### 1.4.2 成本预测与预算规划

**功能**：基于历史成本数据，使用统计模型预测未来成本，辅助预算规划。

**预测算法**（复用容量规划模块的算法库）：

| 场景 | 算法 | 数据要求 | 预测窗口 |
|------|------|----------|----------|
| 短期趋势 | 线性回归 | 近 30 天 >= 15 数据点 | 7-30 天 |
| 季节性模式 | Holt-Winters | 近 90 天 >= 30 数据点 | 30-90 天 |
| 数据不足 | 移动平均 MA-7 | < 15 数据点 | 7 天 |

**预算规划流程**：
1. 基于预测值生成预算建议（预测值 * 1.2 作为建议预算）
2. 用户可调整建议预算并创建/更新 `budgets` 记录
3. 预算与告警规则联动（`alert_rules`）

**预测准确率评估**：
- 每月回填上月 `actual_cost`
- 计算 `accuracy_score = max(0, 100 - MAPE)`
- 低准确率（< 60）自动切换算法

#### 1.4.3 成本优化建议

**功能**：自动扫描闲置资源、降配机会、预留实例优惠，生成优化建议。

**建议类型与检测规则**：

| 建议类型 | 检测规则 | 优先级 | 置信度 |
|----------|----------|--------|--------|
| idle_resource | 近 30 天 CPU < 5% 且无网络流量 | high | 0.95 |
| idle_resource | 近 30 天 AI 模型调用次数 = 0 | high | 0.99 |
| rightsizing | P95 CPU < 30% 且 P95 内存 < 40% | medium | 0.80 |
| reserved_instance | 稳定运行 > 90 天的计算实例 | high | 0.90 |
| spot_instance | 可容忍中断的批处理任务 | medium | 0.75 |
| cleanup | terminated 状态 > 14 天的资源 | high | 0.95 |
| schedule | 非工作时间（22:00-06:00）有稳定运行的 dev 环境资源 | medium | 0.85 |

**建议生命周期**：
```
pending ──accept──► accepted ──apply──► applied
   │                    │
   │                    └──reject──► rejected (终态)
   │
   └─expire──► expired (超过 expires_at)
```

**节省金额计算**：
- `estimated_savings = current_cost * 优化系数`
- 优化系数根据建议类型设定：idle=1.0, rightsizing=0.4, reserved=0.6, spot=0.7, cleanup=1.0, schedule=0.5

**实现代码位置**：
- Service: `orion-platform-service/src/services/finops/CostOptimizationService.ts`
- 定时任务: `orion-platform-service/src/services/finops/OptimizationScheduler.ts`

#### 1.4.4 ROI 分析

**功能**：计算各项投资的投入产出比，辅助决策。

**ROI 计算维度**：

| 分析类型 | 成本项 | 收益项 | ROI 公式 |
|----------|--------|--------|----------|
| Pipeline ROI | Pipeline 运行成本 | 节省的手工操作时间 × 时薪 | `(benefit - cost) / cost` |
| AI Model ROI | API 调用成本 | 替代人工小时数 × 时薪 | 同上 |
| Infrastructure ROI | 基础设施成本 | 支持的交付价值（story points） | 同上 |

**收益量化方式**：
- 时间节省：`节省分钟数 / 60 × 时薪（默认 $50/h，可配置）`
- 故障减少：`减少的故障次数 × 平均故障成本`
- 效率提升：`提效百分比 × 团队人力成本`

### 1.5 外部依赖

| 依赖 | 用途 | 已有/需新建 | 回退策略 |
|------|------|-------------|----------|
| Prometheus | 资源利用率指标采集 | 已有 `PrometheusClient` | 仅使用成本记录数据 |
| 多云成本 API | 云厂商账单同步 | 已有 MultiCloudCostService | 仅使用本地成本记录 |
| PostgreSQL | 数据存储 | 已有连接池 | 启动失败 |
| NATS EventBus | 成本事件通知 | 已有 | 降级为日志 |
| 定时任务调度 | 预测/建议生成 | 已有 `CronSchedulerService` | 手动触发 |

### 1.6 权限模型

| 角色 | 查看成本 | 查看归因 | 查看预测 | 管理预算 | 应用优化 | 查看 ROI | 修改归因标签 |
|------|----------|----------|----------|----------|----------|----------|-------------|
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| PlatformAdmin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| FinOpsAdmin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| FinOpsViewer | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Developer | ✅ (仅自己的) | ✅ (仅自己的) | ❌ | ❌ | ❌ | ❌ | ❌ |
| FinanceViewer | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |

**API 权限映射**：

| 路由 | 权限要求 |
|------|----------|
| GET `/finops/cost` | `finops:read` |
| GET `/finops/cost/attribution` | `finops:read` |
| GET `/finops/cost/forecast` | `finops:read` |
| POST `/finops/cost/forecast/run` | `finops:execute` |
| GET `/finops/optimization` | `finops:read` |
| POST `/finops/optimization/:id/apply` | `finops:execute` |
| GET `/finops/roi` | `finops:read` |
| GET `/finops/budgets` | `finops:read` |
| POST `/finops/budgets` | `finops:admin` |
| PUT `/finops/budgets/:id` | `finops:admin` |
| DELETE `/finops/budgets/:id` | `finops:admin` |
| GET `/finops/attribution-tags` | `finops:read` |
| POST `/finops/attribution-tags` | `finops:admin` |

### 1.7 定时任务

| 任务 | Cron | 功能 | 超时 |
|------|------|------|------|
| CostAttributionCalc | `0 1 * * *` | 每日计算成本归因 | 300s |
| ForecastRunner | `0 3 1 * *` | 每月 1 日 03:00 运行预测 | 600s |
| OptimizationScanner | `0 4 * * 1` | 每周一 04:00 扫描优化建议 | 900s |
| BudgetStatusUpdate | `*/30 * * * *` | 每 30min 更新预算使用率 | 60s |
| AnomalyDetector | `0 */2 * * *` | 每 2h 检测成本异常 | 120s |
| ROICalculation | `0 5 1 * *` | 每月 1 日 05:00 计算 ROI | 300s |
| ExpiredRecommendationClean | `0 6 * * *` | 清理过期建议 | 30s |

---

## 2. 页面交互设计（前端）

### 2.1 页面清单与路由

| 页面 | 路由 | 优先级 | 对应后端 API |
|------|------|--------|-------------|
| 成本概览 | `/governance/finops/overview` | P0 | GET `/finops/cost/summary` |
| 归因分析 | `/governance/finops/attribution` | P0 | GET `/finops/cost/attribution` |
| 优化建议 | `/governance/finops/optimization` | P0 | GET/POST `/finops/optimization` |
| 预算规划 | `/governance/finops/budgets` | P1 | GET/POST/PUT/DELETE `/finops/budgets` |
| 成本预测 | `/governance/finops/forecast` | P1 | GET/POST `/finops/cost/forecast` |
| ROI 分析 | `/governance/finops/roi` | P1 | GET `/finops/roi` |

### 2.2 页面 1：成本概览（/governance/finops/overview）

**页面标题**：

```tsx
<Title level={2} style={{ marginBottom: spacing.sm }}>
  <SafetyCertificateOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
  成本优化
</Title>
<Typography.Text style={{ color: colors.neutral[500], fontSize: 14 }}>
  成本归因、优化建议与预算管控
</Typography.Text>
```

**布局结构**：4 统计卡片 + 成本趋势图 + Top5 成本贡献 + 优化建议摘要 + 预算水位

**统计卡片（4 个）**：

| 卡片 | 数据 | 交互 |
|------|------|------|
| 本月总成本 | `GET /cost/summary` 本月 | 点击跳转归因分析 |
| 预算使用率 | `GET /budgets` 聚合 | 颜色随使用率变化（<80%绿，80-95%橙，>95%红） |
| 可节省金额 | `GET /optimization?status=pending` 求和 | 点击跳转优化建议 |
| 活跃异常数 | `GET /cost/anomalies?resolved=false` | 点击展开异常列表 |

**成本趋势图**（近 12 个月）：
- 柱状图显示月度总成本
- 折线叠加预算线
- 标注异常月份（红色标记）

**Top5 成本贡献**：
- 按项目/团队维度排序
- Progress 条显示占比
- 点击展开该维度的子项

**优化建议摘要**：
- Card 展示待处理的优化建议数量 + 预估节省金额
- 列表前 3 条高优先级建议
- "查看全部"按钮跳转优化建议页

**预算水位**：
- 每个预算一个 Progress 条
- 颜色：正常 < 80% → 绿色；80-95% → 橙色；> 95% → 红色
- 超预算时显示 Alert 组件

### 2.3 页面 2：归因分析（/governance/finops/attribution）

**布局结构**：维度切换 Tabs + 归因图表 + 明细表

**维度切换 Tabs**：

```tsx
<Tabs activeKey={dimension} onChange={setDimension}>
  <TabPane tab="按项目" key="project" />
  <TabPane tab="按团队" key="team" />
  <TabPane tab="按环境" key="environment" />
  <TabPane tab="按用户" key="user" />
  <TabPane tab="按模块" key="module" />
  <TabPane tab="按云提供商" key="provider" />
</Tabs>
```

**归因饼图/树图**：
- 使用 ECharts 树图（Treemap）显示各维度成本占比
- 点击子节点 → 下钻到子维度
- 颜色深浅表示成本大小

**归因明细表**：
| 列 | 内容 |
|----|------|
| 维度值 | 项目名/团队名等 |
| 成本金额 | 带千分位格式化 |
| 占比 | 百分比 |
| 较上月变化 | 带 ↑↓ 箭头 + 红绿色 |
| 单位成本 | 人均成本 / 每实例成本 |
| 未归因 | 标记未归入此维度的成本 |
| 操作 | 查看明细 |

**时间范围选择器**：
- RangePicker 选择日期范围
- 快捷按钮：近 7 天 / 近 30 天 / 本月 / 上月 / 自定义

### 2.4 页面 3：优化建议（/governance/finops/optimization）

**布局结构**：摘要统计 + 过滤栏 + 建议列表

**摘要统计**：
- 待处理建议数 + 预估总节省金额（大字号）
- 已应用建议数 + 实际节省金额
- 已拒绝/过期建议数

**过滤栏**：
```tsx
<Space style={{ marginBottom: spacing.md }}>
  <Select placeholder="建议类型" value={typeFilter} onChange={setTypeFilter} style={{ width: 180 }} allowClear
    options={[
      { label: '闲置资源', value: 'idle_resource' },
      { label: '降配建议', value: 'rightsizing' },
      { label: '预留实例', value: 'reserved_instance' },
      { label: 'Spot 实例', value: 'spot_instance' },
      { label: '清理资源', value: 'cleanup' },
      { label: '定时调度', value: 'schedule' },
    ]}
  />
  <Select placeholder="优先级" value={priorityFilter} onChange={setPriorityFilter} style={{ width: 140 }} allowClear
    options={[
      { label: '紧急', value: 'critical' },
      { label: '高', value: 'high' },
      { label: '中', value: 'medium' },
      { label: '低', value: 'low' },
    ]}
  />
  <Select placeholder="状态" value={statusFilter} onChange={setStatusFilter} style={{ width: 140 }} allowClear
    options={[
      { label: '待处理', value: 'pending' },
      { label: '已接受', value: 'accepted' },
      { label: '已应用', value: 'applied' },
      { label: '已拒绝', value: 'rejected' },
      { label: '已过期', value: 'expired' },
    ]}
  />
  <Button onClick={handleScan} loading={scanning} icon={<SearchOutlined />}>
    重新扫描
  </Button>
</Space>
```

**建议列表（Table）**：

| 列 | 宽度 | 内容 |
|----|------|------|
| 类型 | 120px | 图标 + 类型文字 Tag |
| 资源 | 200px | 资源类型 + 名称 |
| 描述 | 280px | 建议描述，省略显示 |
| 当前成本 | 100px | `$XXX.XX/月` |
| 预估节省 | 120px | 绿色粗体 `$XXX.XX/月` |
| 节省比例 | 80px | `XX%` |
| 置信度 | 80px | Progress 条 |
| 优先级 | 80px | 彩色 Tag |
| 到期时间 | 120px | 过期标红 |
| 操作 | 140px | 接受 / 拒绝 / 详情 |

**操作交互**：
- "接受" → Popconfirm → 调用 `POST /optimization/:id/apply` → loading → success → 刷新
- "拒绝" → Modal 输入拒绝原因 → 调用 API → 状态变 rejected
- "重新扫描" → Popconfirm → `POST /optimization/scan` → 后台运行 → 通知完成

**建议详情（Drawer）**：
- 基本信息卡片
- 详细分析数据
- 当前资源配置 vs 建议配置对比
- 执行预览（应用后预期效果）

### 2.5 页面 4：预算规划（/governance/finops/budgets）

**布局结构**：预算列表 + 创建/编辑表单

**预算列表**：
- Table 列：名称、类型、范围、周期、预算金额、已用金额、使用率、状态、操作
- 使用率列：Progress 条 + 颜色
- 操作：编辑、查看明细、删除
- 创建按钮：右上角

**创建/编辑预算表单（Modal）**：
- 预算名称（Input，必填）
- 类型（Select：tenant/project/user，必填）
- 范围（根据类型动态加载）
- 周期（Radio：daily/weekly/monthly/quarterly/yearly）
- 预算金额（InputNumber，必填，精度 2）
- 告警阈值（Slider：warning 80%, critical 95%, hard limit 100%）
- 通知接收人（Select tags：邮箱/用户名）
- 保存按钮 + loading 状态

**预算明细（Drawer）**：
- 预算基本信息
- 成本消耗趋势（按日/周）
- 告警历史（时间线）
- 关联的告警规则列表

### 2.6 页面 5：成本预测（/governance/finops/forecast）

**布局结构**：预测配置 + 预测图表 + 准确率表

**预测配置**：
- 范围选择（tenant/project/budget）
- 预测周期（未来 1/3/6 个月）
- 运行预测按钮

**预测图表**：
- 历史成本折线（实线）
- 预测值折线（虚线）
- 置信区间阴影带（半透明填充）
- 预算参考线

**准确率表**：
- 显示历史预测的准确率
- 列：预测期间、预测值、实际值、偏差、准确率、使用算法
- 按时间倒序

### 2.7 页面 6：ROI 分析（/governance/finops/roi）

**布局结构**：分析维度 Tabs + ROI 卡片 + 明细表

**分析维度 Tabs**：Pipeline / AI Model / Infrastructure

**ROI 卡片**：
- 大字号显示 ROI 百分比
- 绿/橙/红颜色表示正/中/负 ROI
- 总成本、总收益、回收月数

**明细表**：
| 列 | 内容 |
|----|------|
| 名称 | Pipeline 名 / 模型名 |
| 周期 | YYYY-MM |
| 总成本 | 金额 |
| 总收益 | 金额（折现值） |
| ROI | 百分比 + 颜色 |
| 回收月数 | X 个月 |
| 趋势 | 近 3 月 ROI 迷你图 |
| 操作 | 查看详情 |

---

## 3. API 设计

### 3.1 成本管理

| Method | Path | 描述 | 权限 |
|--------|------|------|------|
| GET | `/api/v1/finops/cost` | 成本列表（分页/过滤） | `finops:read` |
| GET | `/api/v1/finops/cost/summary` | 成本摘要（总览统计） | `finops:read` |
| GET | `/api/v1/finops/cost/trend` | 成本趋势（时序数据） | `finops:read` |
| GET | `/api/v1/finops/cost/attribution` | 归因分析（多维度） | `finops:read` |
| GET | `/api/v1/finops/cost/anomalies` | 异常列表 | `finops:read` |
| POST | `/api/v1/finops/cost/anomalies/:id/resolve` | 标记异常已解决 | `finops:execute` |

### 3.2 优化建议

| Method | Path | 描述 | 权限 |
|--------|------|------|------|
| GET | `/api/v1/finops/optimization` | 建议列表 | `finops:read` |
| GET | `/api/v1/finops/optimization/summary` | 建议摘要 | `finops:read` |
| POST | `/api/v1/finops/optimization/scan` | 手动触发扫描 | `finops:execute` |
| POST | `/api/v1/finops/optimization/:id/apply` | 应用建议 | `finops:execute` |
| POST | `/api/v1/finops/optimization/:id/reject` | 拒绝建议 | `finops:execute` |
| DELETE | `/api/v1/finops/optimization/:id` | 删除建议 | `finops:admin` |

### 3.3 预算管理

| Method | Path | 描述 | 权限 |
|--------|------|------|------|
| GET | `/api/v1/finops/budgets` | 预算列表 | `finops:read` |
| GET | `/api/v1/finops/budgets/:id` | 预算详情 | `finops:read` |
| POST | `/api/v1/finops/budgets` | 创建预算 | `finops:admin` |
| PUT | `/api/v1/finops/budgets/:id` | 更新预算 | `finops:admin` |
| DELETE | `/api/v1/finops/budgets/:id` | 删除预算 | `finops:admin` |
| GET | `/api/v1/finops/budgets/:id/details` | 预算消耗明细 | `finops:read` |
| GET | `/api/v1/finops/budgets/:id/alerts` | 预算告警历史 | `finops:read` |

### 3.4 预测与分析

| Method | Path | 描述 | 权限 |
|--------|------|------|------|
| GET | `/api/v1/finops/cost/forecast` | 预测列表 | `finops:read` |
| POST | `/api/v1/finops/cost/forecast/run` | 运行预测 | `finops:execute` |
| GET | `/api/v1/finops/roi` | ROI 分析列表 | `finops:read` |
| POST | `/api/v1/finops/roi/calculate` | 手动计算 ROI | `finops:execute` |
| GET | `/api/v1/finops/attribution-tags` | 归因标签列表 | `finops:read` |
| POST | `/api/v1/finops/attribution-tags` | 创建归因标签 | `finops:admin` |
| PUT | `/api/v1/finops/attribution-tags/:id` | 更新归因标签 | `finops:admin` |
| DELETE | `/api/v1/finops/attribution-tags/:id` | 删除归因标签 | `finops:admin` |

### 3.5 告警规则（复用现有 alert_rules）

| Method | Path | 描述 | 权限 |
|--------|------|------|------|
| GET | `/api/v1/finops/alert-rules` | 告警规则列表 | `finops:read` |
| POST | `/api/v1/finops/alert-rules` | 创建告警规则 | `finops:admin` |
| PUT | `/api/v1/finops/alert-rules/:id` | 更新告警规则 | `finops:admin` |
| DELETE | `/api/v1/finops/alert-rules/:id` | 删除告警规则 | `finops:admin` |

---

## 4. 验收标准

### 4.1 功能验收

| # | 验收项 | 验收方法 | 预期结果 |
|---|--------|----------|----------|
| 1 | 成本归因 | 查询归因 API 按项目维度 | 返回各项目成本汇总，总计 = 总成本 |
| 2 | 成本预测 | 手动触发预测 | 生成未来 3 个月预测记录，含置信区间 |
| 3 | 预测准确率 | 回填实际值后查看 | accuracy_score 在 60-100 之间 |
| 4 | 优化建议扫描 | 手动触发扫描 | 生成至少 1 条 pending 建议 |
| 5 | 建议应用 | 接受并应用闲置资源建议 | 状态变为 applied，记录 applied_at |
| 6 | 预算门禁 | 创建预算 + 超阈值成本 | alert_rules 触发，写入通知 |
| 7 | ROI 计算 | 手动触发 ROI 计算 | 生成 ROI 记录，roi_percent 计算正确 |
| 8 | 归因标签 | 创建标签映射 | 影响归因结果，未打标成本归入 unattributed |
| 9 | 成本异常检测 | 注入异常成本数据 | anomaly 记录写入，deviation_percent > 50 |
| 10 | 预算使用率更新 | 30min 后检查 | budgets.spent 字段已更新 |

### 4.2 前端交互验收

| # | 验收项 | 验收方法 | 预期结果 |
|---|--------|----------|----------|
| 1 | 页面标题规范 | 检查所有 6 个页面 | `level={2}` + 图标 + Design Token |
| 2 | 空状态引导 | 无数据时访问 | Empty + 引导按钮（如"开始成本扫描"） |
| 3 | 异步操作反馈 | 创建预算/应用建议 | loading + success/error message |
| 4 | 预算使用率颜色 | 不同使用率进度条 | <80% 绿，80-95% 橙，>95% 红 |
| 5 | 建议接受/拒绝 | 操作建议列表 | 状态正确变化，有确认提示 |
| 6 | 维度切换 | 归因页面切换 Tabs | 图表和表格数据即时更新 |
| 7 | Design Token 使用 | 搜索硬编码色值 | 无硬编码 |
| 8 | CRUD 完整性 | 预算页面 | 创建/查看/编辑/删除齐全 |

### 4.3 后端验收

| # | 验收项 | 验收方法 | 预期结果 |
|---|--------|----------|----------|
| 1 | TypeScript 编译 | `npm run build` | 零 error |
| 2 | ESLint | `npm run lint` | 零 error |
| 3 | 单元测试 | `npm run test` | 覆盖率 >= 80% |
| 4 | RLS 策略 | 切换 tenant_id | 仅返回当前租户数据 |
| 5 | 错误码规范 | 触发错误场景 | `CLIENT.4xx.*` 或 `BIZ.*` 格式 |
| 6 | 权限校验 | 无权限调用 admin API | 403 + `CLIENT.403.FORBIDDEN` |
| 7 | 迁移文件 | 执行 197 迁移 | 4 张表 + RLS + 触发器创建成功 |
| 8 | 预测算法 | 输入测试数据集 | 线性回归和指数平滑返回合理预测值 |
| 9 | 优化建议规则 | 注入测试资源数据 | idle_resource 和 rightsizing 正确触发 |
