# 研效度量中心（Efficacy Metrics Hub）设计方案

> **日期**: 2026-08-06
> **状态**: Draft for Review
> **方案**: 独立一级菜单模块，聚合型门户，渐进到完整型

---

## 1. 背景与问题

### 1.1 现状

Orion 平台已在 8 个独立页面分散了研效相关能力，但没有统一入口：

| 已有页面 | 路径 | 覆盖维度 |
|---------|------|---------|
| DORA 效能看板 | `/efficiency-dashboard` | DORA 四指标、团队对比、趋势 |
| 执行层看板 | `/dashboard/executive` | 全局 KPI 聚合 |
| 经理看板 | `/dashboard/manager` | 团队效能分析 |
| 风险看板 | `/risk-dashboard` | 风险识别预警 |
| 合规管理 | `/compliance` | 安全合规 |
| API 治理 | `/api-governance` | API 合同合规 |
| FinOps 成本 | `/finops-dashboard` | 成本治理 |
| Pipeline 分析 | `/pipeline-runs/analytics` | 成功率/耗时/瓶颈 |
| 弹性评分 | `/resilience-score` | 系统弹性评估 |

### 1.2 缺失维度

以下关键研效维度当前**完全缺失**或**严重碎片化**：

1. **端到端 (E2E)** — 从 Commit→Build→Test→Deploy→Production 的全链路交付周期可视化
2. **管理域对标** — 按团队/产品线/部门的多维度研效对比
3. **工程域深度** — 代码质量、测试覆盖率、开发速度等工程效率指标
4. **合规度量 KPI** — 政策遵守率、SLA 达成率等可度量指标
5. **AI 智研提效** — AI 对研发效率提升的量化度量（AI 辅助代码采纳率、PR Review 时间缩短比例）
6. **风险与技术债务** — 风险看板与技术债务、安全扫描结果、质量门禁打通不足

### 1.3 目标

构建一个**统一的研效度量中心**，将上述 6 大域聚合到一个入口，提供横向对比、整体评分、趋势分析和跨域告警能力。

---

## 2. 设计方案

### 2.1 模块定位

新增第九个一级菜单模块「效能度量」，路径 `/efficacy-metrics`。

**设计原则**：
- 聚合现有数据，不重复已有页面功能
- 跨域横向对比，提供整体视角
- 渐进式建设：Phase 1 聚合门户 → Phase 2 补齐缺失域

### 2.2 菜单与路由

在 `menuConfigStore.ts` 新增模块：

```typescript
'/efficacy-metrics': {
  key: '/efficacy-metrics',
  label: '效能度量',
  description: '跨域研效指标聚合与分析',
  systemTitle: '效能度量中心',
  systemDescription: '端到端、管理域、工程域、合规域、AI提效、风险看板六大域统一度量',
  enabled: true,
  children: [
    { key: '/efficacy-metrics', label: '度量总览', description: '六域整体评分与趋势', category: '总览', enabled: true },
    { key: '/efficacy-metrics/e2e', label: '端到端链路', description: 'Commit→Prod 全链路周期', category: '端到端', enabled: true },
    { key: '/efficacy-metrics/management', label: '管理域', description: '团队/产品线效能对标', category: '管理域', enabled: true },
    { key: '/efficacy-metrics/engineering', label: '工程域', description: 'DORA + 工程效率深度', category: '工程域', enabled: true },
    { key: '/efficacy-metrics/compliance', label: '合规域', description: '合规率与SLA达成度量', category: '合规域', enabled: true },
    { key: '/efficacy-metrics/ai-efficiency', label: 'AI智研提效', description: 'AI辅助研发效能度量', category: 'AI提效', enabled: true },
    { key: '/efficacy-metrics/risk', label: '风险看板', description: '风险+技术债务+质量门禁', category: '风险域', enabled: true },
  ],
}
```

### 2.3 路由注册

在 `routes.tsx` 注册 7 个路由：

```typescript
{
  path: '/efficacy-metrics',
  element: React.lazy(() => import('@/pages/EfficacyMetrics')),
  protected: true,
},
{
  path: '/efficacy-metrics/e2e',
  element: React.lazy(() => import('@/pages/EfficacyMetrics/E2EAnalysis')),
  protected: true,
},
{
  path: '/efficacy-metrics/management',
  element: React.lazy(() => import('@/pages/EfficacyMetrics/ManagementView')),
  protected: true,
},
{
  path: '/efficacy-metrics/engineering',
  element: React.lazy(() => import('@/pages/EfficacyMetrics/EngineeringView')),
  protected: true,
},
{
  path: '/efficacy-metrics/compliance',
  element: React.lazy(() => import('@/pages/EfficacyMetrics/ComplianceView')),
  protected: true,
},
{
  path: '/efficacy-metrics/ai-efficiency',
  element: React.lazy(() => import('@/pages/EfficacyMetrics/AIefficiencyView')),
  protected: true,
},
{
  path: '/efficacy-metrics/risk',
  element: React.lazy(() => import('@/pages/EfficacyMetrics/RiskView')),
  protected: true,
},
```

---

## 3. 页面设计

### 3.1 主面板（`/efficacy-metrics`）

三层布局：

#### 第一层：整体评分卡片

| 组件 | 内容 |
|------|------|
| 综合评分环 | 0-100 总分（6 域各 1 个核心指标加权平均）|
| 评分等级 | Elite (≥80) / High (60-79) / Medium (40-59) / Low (<40) |
| 等级说明 | DORA 基准对照（Elite = 世界级，High = 优秀，Medium = 中等，Low = 待改进）|

#### 第二层：六域概览卡片（2×3 网格）

每个 Card 包含：
- 域名称 + 图标
- 2-3 个核心数字
- 趋势箭头（↑改善 / ↓退化 / →持平，对比上周）
- "查看详情"按钮 → 跳转对应域详情页

| 域 | 核心指标 | 颜色 |
|----|---------|------|
| 端到端 | 平均交付周期、交付成功率 | 蓝色 |
| 管理域 | 活跃团队数、对标排名 | 绿色 |
| 工程域 | DORA 综合等级、失败率 | 紫色 |
| 合规域 | 合规率、SLA 达成率 | 橙色 |
| AI 提效 | AI 采纳率、Review 提速比 | 青色 |
| 风险 | 高危数量、弹性评分 | 红色 |

#### 第三层：跨域趋势图

- 最近 8 周各域评分折线图
- X 轴：周次；Y 轴：0-100 评分
- 6 条不同颜色折线
- 一眼看哪域在退化

### 3.2 域详情页

#### 3.2.1 端到端链路 (`/efficacy-metrics/e2e`)

**核心功能**：可视化单个 Pipeline 从 Commit 到 Production 的全链路耗时。

布局：
- **流水线选择器** — 下拉选择 Pipeline
- **水平甘特图** — Commit → Build → Test → Deploy → Production，每阶段显示耗时
- **统计卡片** — 平均交付周期、交付成功率、最慢阶段（瓶颈）
- **Top 5 慢速交付** — 最近 5 次最慢的全链路执行

**数据源**：`getAllPipelineRuns()` + `getPipelineRunStages()` + `getPipelineRunDetail()`

#### 3.2.2 管理域 (`/efficacy-metrics/management`)

**核心功能**：按团队/产品线/部门的研效对标。

布局：
- **团队筛选** — 下拉选择团队
- **对标表格** — 各团队 DORA 指标横向对比
- **评分排行** — 综合评分排名
- **开发者画像** — 团队内 Top 贡献者

**数据源**：`getTeamComparison()` + `getDeveloperProfiles()` + `getDoraMetrics()`

#### 3.2.3 工程域 (`/efficacy-metrics/engineering`)

**核心功能**：DORA 深度 + 工程效率。

布局：
- **DORA 四指标卡片** — 发布频率、变更前置时间、MTTR、失败率
- **等级评估** — 对照 DORA Benchmark 标注等级
- **瓶颈分析** — 自动识别瓶颈环节
- **改进建议** — 基于数据的 actionable 建议

**数据源**：`getEfficiencyDashboard()` + `getBottlenecks()` + `getDoraBenchmarks()`

#### 3.2.4 合规域 (`/efficacy-metrics/compliance`)

**核心功能**：合规率 + SLA 达成度量。

布局：
- **合规仪表盘** — 总体合规率
- **SLA 达成** — SLA 定义 vs 实际达成
- **政策遵守率** — 各政策遵守情况
- **API 合同合规** — API 治理评分

**数据源**：`/api-governance` API + Compliance API

#### 3.2.5 AI 智研提效 (`/efficacy-metrics/ai-efficiency`)

**核心功能**：AI 对研发效率提升的量化度量。

布局：
- **AI 辅助采纳率** — AI 生成的代码被合并的比例
- **PR Review 提速比** — 使用 AI Review 前后的 Review 时间对比
- **AI 成本 vs 提效** — AI 调用成本 vs 节省的工时
- **Agent 调度效率** — Agent 任务完成率、响应时间

**数据源**：AI Cost API + AI Review API + Agent Dashboard API

#### 3.2.6 风险看板 (`/efficacy-metrics/risk`)

**核心功能**：风险 + 技术债务 + 质量门禁聚合。

布局：
- **风险等级分布** — 高/中/低风险数量
- **技术债务热力图** — 按模块展示债务
- **质量门禁** — 构建质量、测试覆盖率门禁
- **弹性评分** — 系统弹性趋势

**数据源**：`risk.ts` API + Resilience Score API + Quality Gate API

---

## 4. 数据源映射（现有 API）

| 域 | 后端服务 | 前端 API 文件 | 关键函数 | 是否需要新 API |
|---|---------|-------------|---------|---------------|
| 工程域 | `internal/efficiency` | `api/efficiency.ts` | `getEfficiencyDashboard()`, `getDoraMetrics()`, `getTeamComparison()`, `getBottlenecks()`, `getDoraBenchmarks()`, `getDeveloperProfiles()` | 否 |
| 端到端 | 聚合 | `api/pipelineRuns.ts` + `api/pipelines.ts` | `getAllPipelineRuns()`, `getPipelineRunDetail()`, `getPipelineRunStages()` | 否 |
| 管理域 | 聚合 | `api/efficiency.ts` | `getTeamComparison()`, `getDeveloperProfiles()`, `getDoraMetrics()` | 否 |
| 合规域 | `internal/compliance` + `api-governance` | `api/compliance.ts` + API governance | — | 否 |
| 风险 | `internal/risk` + `resilience-score` | `api/risk.ts` | — | 否 |
| AI 提效 | 聚合 | `api/ai-cost` + `api/ai-review` + `api/efficiency.ts` | — | 否 |

**结论：Phase 1 完全不需要新建后端 API**。所有数据均可从现有 API 聚合。

---

## 5. 实施计划

### Phase 1: 聚合门户（2-3 天）

| 步骤 | 内容 |
|------|------|
| 1 | 创建 `EfficacyMetrics` 主页面 — 整体评分 + 6 域概览卡片 + 跨域趋势 |
| 2 | 创建工程域详情页 — DORA 深度 + 瓶颈分析 |
| 3 | 创建端到端详情页 — 全链路甘特图 + 统计 |
| 4 | 创建 AI 提效详情页 — 采纳率 + 提速比 |
| 5 | 注册路由 + 菜单配置 + 图标映射 |
| 6 | 聚合评分逻辑 + 趋势数据聚合 |

### Phase 2: 补齐域（后续）

| 步骤 | 内容 |
|------|------|
| 7 | 管理域详情页 — 团队对标 + 开发者画像 |
| 8 | 合规域详情页 — 合规率 + SLA 达成 |
| 9 | 风险看板详情页 — 风险聚合 + 质量门禁 |
| 10 | 可选：聚合评分 API `GET /api/v1/efficacy/score` |

---

## 6. 组件结构

```
src/pages/EfficacyMetrics/
├── index.tsx              # 主面板：评分环 + 6域卡片 + 跨域趋势
├── E2EAnalysis.tsx        # 端到端链路分析
├── EngineeringView.tsx    # 工程域深度
├── AIefficiencyView.tsx   # AI 智研提效
├── ManagementView.tsx     # 管理域（Phase 2）
├── ComplianceView.tsx     # 合规域（Phase 2）
├── RiskView.tsx           # 风险看板（Phase 2）
└── components/
    ├── DomainCard.tsx     # 六域概览卡片组件
    ├── ScoreRing.tsx      # 整体评分环组件
    └── TrendChart.tsx     # 跨域趋势折线图
```

---

## 7. 关键技术决策

### 7.1 整体评分算法

各域评分 = 该域核心指标标准化到 0-100 分：
- 工程域 = DORA 综合等级（Elite=100, High=75, Medium=50, Low=25）
- 端到端 = 交付成功率
- 管理域 = 活跃团队数对标
- 合规域 = 合规率
- AI 提效 = AI 采纳率
- 风险 = 弹性评分

总分 = 各域评分的加权平均（各域权重等分，后续可按业务调整）

### 7.2 数据聚合策略

前端聚合（Phase 1）：各域 API 调用后在前端计算评分，无需新后端服务。

后端聚合（Phase 2）：如需要实时聚合或离线计算，可新增 `/api/v1/efficacy/score` 端点。

### 7.3 图表库

使用 Ant Design 内置图表 + Recharts（与现有页面保持一致）。
跨域趋势图：6 条折线，按域着色。

### 7.4 权限

模块统一权限：`{ resource: 'efficacy-metrics', action: 'read' }`
各域详情页可继承模块级权限，不做细粒度区分。

---

## 8. 验证标准

- [ ] 主面板加载 6 域数据无报错
- [ ] 整体评分算法正确（各域 0-100 分，总分加权）
- [ ] 6 域卡片显示核心指标 + 趋势箭头
- [ ] 跨域趋势图显示 8 周数据
- [ ] 三个独立域详情页可正常导航和数据加载
- [ ] 菜单配置正确显示在侧边栏
- [ ] `tsc --noEmit` 零错误
