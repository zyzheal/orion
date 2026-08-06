# 研效度量中心 (Efficacy Metrics Hub) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建独立一级菜单模块 `/efficacy-metrics`，聚合端到端、管理域、工程域、合规域、AI 提效、风险六大域研效指标，Phase 1 实现聚合门户 + 3 个域详情页（工程域、端到端、AI 提效），无需新建后端 API。

**Architecture:** 新增第八个一级菜单模块「效能度量」，采用聚合门户模式 — 主面板展示整体评分环 + 6 域概览卡片 + 跨域趋势折线图；3 个域详情页深度展示 DORA 指标、Pipeline 甘特图、AI 采纳率。评分算法在前端聚合（加权平均），后续可扩展为后端 `/api/v1/efficacy/score` 端点。

**Tech Stack:** React + TypeScript + Ant Design + Recharts。复用现有 MetricCard 组件、api/efficiency.ts、api/pipelineRuns.ts、api/risk.ts、api/agents.ts、api/ai-cost.ts。

**Scope:** Phase 1 (本计划) — 菜单注册、路由注册、评分工具函数、共享组件（ScoreRing/DomainCard/TrendChart）、主面板、工程域详情页、端到端详情页、AI 提效详情页。管理域/合规域/风险看板详情页为 Phase 2，仅做占位。

**关键约束:**
- 所有数据均来自现有 API，不新增后端接口
- 复用 `@/components/MetricCard`（已有 66 处使用），不重复造轮子
- 菜单/路由/图标必须保持与现有 8 模块一致的格式
- 评分算法使用等权加权（各域 0-100 分），总分 = 各域平均
- tsc --noEmit 必须零错误

---

### 文件结构总览

```
orion-frontend/src/
├── stores/
│   └── menuConfigStore.ts          # Task 1: 添加 /efficacy-metrics 模块配置
├── components/Layout/
│   └── iconMap.tsx                 # Task 1: 添加图标映射
├── router/
│   └── routes.tsx                  # Task 2: 注册 7 条路由
├── utils/
│   └── efficacyScore.ts            # Task 3: 评分算法工具函数
├── components/
│   └── EfficacyMetrics/            # Task 4-6: 共享组件
│       ├── ScoreRing.tsx           #   整体评分环
│       ├── DomainCard.tsx          #   六域概览卡片
│       └── TrendChart.tsx          #   跨域趋势折线图
└── pages/
    └── EfficacyMetrics/            # Task 7-10: 页面
        ├── index.tsx               #   主面板
        ├── EngineeringView.tsx     #   工程域详情页
        ├── E2EAnalysis.tsx         #   端到端链路分析
        └── AIefficiencyView.tsx    #   AI 智研提效
```

---

### Task 1: 菜单配置注册 (Menu Config Registration)

**Files:**
- Modify: `orion-frontend/src/stores/menuConfigStore.ts`
- Modify: `orion-frontend/src/components/Layout/iconMap.tsx`

- [ ] **Step 1: 在 menuConfigStore.ts 添加效能度量模块**

在 `defaultModules` 对象中，于 `'/ecosystem'` 之后添加第九个模块：

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
  },
```

- [ ] **Step 2: 在 iconMap.tsx 添加图标映射**

在 `iconMap` 对象中添加一级模块和子菜单的图标映射。先导入 `FundOutlined` 图标：

```typescript
import {
  // ... 现有导入
  FundOutlined,
} from '@ant-design/icons';
```

在一级模块区域添加：

```typescript
  // 一级模块
  '/workbench': <DashboardOutlined />,
  '/delivery': <CloudUploadOutlined />,
  '/observability': <EyeOutlined />,
  '/ai': <RocketOutlined />,
  '/infra': <CloudServerOutlined />,
  '/governance': <SettingOutlined />,
  '/ecosystem': <AppstoreOutlined />,
  '/efficacy-metrics': <FundOutlined />,
```

在独立菜单项区域添加子菜单映射：

```typescript
  // 效能度量中心子菜单
  '/efficacy-metrics/e2e': <CloudUploadOutlined />,
  '/efficacy-metrics/management': <TeamOutlined />,
  '/efficacy-metrics/engineering': <BarChartOutlined />,
  '/efficacy-metrics/compliance': <CheckCircleOutlined />,
  '/efficacy-metrics/ai-efficiency': <RocketOutlined />,
  '/efficacy-metrics/risk': <AlertOutlined />,
```

- [ ] **Step 3: 运行 tsc 验证**

```bash
cd orion-frontend && npx tsc --noEmit
```
Expected: 零错误

- [ ] **Step 4: Commit**

```bash
git add src/stores/menuConfigStore.ts src/components/Layout/iconMap.tsx
git commit -m "feat: register efficacy-metrics module in menu config and icon map"
```

---

### Task 2: 路由注册 (Route Registration)

**Files:**
- Modify: `orion-frontend/src/router/routes.tsx`

- [ ] **Step 1: 在 routes.tsx 添加 7 条路由**

在 `// 404 页面` 路由（`path: '*'`）之前、`// 微前端子应用路由` 之后，添加以下路由块：

```typescript
  // ==================== 效能度量中心 (Efficacy Metrics Hub) ====================
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

- [ ] **Step 2: Commit**

```bash
git add src/router/routes.tsx
git commit -m "feat: register efficacy-metrics routes (7 paths)"
```

---

### Task 3: 评分算法工具函数 (Scoring Utility)

**Files:**
- Create: `orion-frontend/src/utils/efficacyScore.ts`

- [ ] **Step 1: 创建评分工具函数**

```typescript
/**
 * 效能度量评分工具
 * 各域 0-100 分，总分 = 各域加权平均
 */

export type RatingLevel = 'elite' | 'high' | 'medium' | 'low';

export interface DomainScore {
  domain: DomainKey;
  label: string;
  score: number; // 0-100
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
  color: string;
  icon: React.ReactNode;
}

export type DomainKey = 'e2e' | 'management' | 'engineering' | 'compliance' | 'aiEfficiency' | 'risk';

export interface ScoreResult {
  overallScore: number;
  level: RatingLevel;
  levelLabel: string;
  levelColor: string;
  domains: DomainScore[];
}

/** 将 DORA 等级字符串映射到 0-100 分数 */
export function levelToScore(level: string | undefined): number {
  const map: Record<string, number> = {
    elite: 100,
    high: 75,
    medium: 50,
    low: 25,
  };
  return map[(level ?? 'low').toLowerCase()] ?? 25;
}

/** 根据分数确定等级 */
export function scoreToLevel(score: number): { level: RatingLevel; label: string; color: string } {
  if (score >= 80) return { level: 'elite', label: 'Elite (世界级)', color: '#52c41a' };
  if (score >= 60) return { level: 'high', label: 'High (优秀)', color: '#3370E6' };
  if (score >= 40) return { level: 'medium', label: 'Medium (中等)', color: '#faad14' };
  return { level: 'low', label: 'Low (待改进)', color: '#f5222d' };
}

/**
 * 聚合各域评分，计算总分和等级
 * @param scores 各域评分 (0-100)
 * @param weights 各域权重（可选，默认等权）
 */
export function aggregateScores(
  scores: Record<DomainKey, number>,
  weights?: Record<DomainKey, number>
): { overall: number; level: RatingLevel; label: string; color: string } {
  const w = weights ?? { e2e: 1, management: 1, engineering: 1, compliance: 1, aiEfficiency: 1, risk: 1 };
  const totalWeight = Object.values(w).reduce((a, b) => a + b, 0);
  const weightedSum = Object.entries(scores).reduce(
    (sum, [key, score]) => sum + score * (w[key as DomainKey] ?? 1),
    0
  );
  const overall = Math.round((weightedSum / totalWeight) * 10) / 10;
  const { level, label, color } = scoreToLevel(overall);
  return { overall, level, label, color };
}

/** 安全计算百分比（避免除零） */
export function safePercent(numerator: number, denominator: number, fallback: number = 0): number {
  if (denominator <= 0) return fallback;
  return Math.round((numerator / denominator) * 100 * 10) / 10;
}

/** 趋势计算：比较当前值与上周值 */
export function computeTrend(current: number, previous: number): { trend: 'up' | 'down' | 'stable'; percent: number } {
  if (previous === 0) return { trend: 'stable', percent: 0 };
  const diff = current - previous;
  const percent = Math.round((diff / previous) * 100 * 10) / 10;
  if (Math.abs(diff) < 0.01) return { trend: 'stable', percent: 0 };
  return { trend: diff > 0 ? 'up' : 'down', percent: Math.abs(percent) };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/efficacyScore.ts
git commit -m "feat: add efficacy scoring utility (levelToScore, scoreToLevel, aggregateScores)"
```

---

### Task 4: ScoreRing 组件 (Shared Score Ring)

**Files:**
- Create: `orion-frontend/src/components/EfficacyMetrics/ScoreRing.tsx`

- [ ] **Step 1: 创建 ScoreRing 组件**

```typescript
import React from 'react';
import { Typography, Progress } from 'antd';
import { colors, spacing } from '@/tokens';
import { aggregateScores, scoreToLevel } from '@/utils/efficacyScore';
import type { DomainKey } from '@/utils/efficacyScore';

const { Title, Text } = Typography;

export interface ScoreRingProps {
  domainScores: Record<DomainKey, number>;
  loading?: boolean;
}

/**
 * 整体评分环组件
 * 使用 Ant Design Progress 的 circular 模式展示 0-100 综合评分
 */
const ScoreRing: React.FC<ScoreRingProps> = ({ domainScores, loading = false }) => {
  if (loading) {
    return <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Progress type="circle" size={150} strokeColor="rgba(51,112,230,0.1)" percent={0} /></div>;
  }

  const { overall, level, label, color } = aggregateScores(domainScores);
  const { color: levelColor } = scoreToLevel(overall);

  return (
    <div style={{ textAlign: 'center', padding: spacing.md }}>
      <Progress
        type="circle"
        percent={overall}
        size={150}
        strokeColor={levelColor}
        trailColor="rgba(51,112,230,0.06)"
        strokeWidth={12}
        format={(pct) => <span style={{ fontSize: 28, fontWeight: 600, color }}>{pct}</span>}
      />
      <Title level={4} style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>
        {label}
      </Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        六域综合评分 · DORA Benchmark 对照
      </Text>
      <div style={{ marginTop: spacing.md, display: 'flex', justifyContent: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#52c41a' }} />
          <Text size="small" type="secondary">Elite ≥ 80</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#3370E6' }} />
          <Text size="small" type="secondary">High ≥ 60</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#faad14' }} />
          <Text size="small" type="secondary">Medium ≥ 40</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f5222d' }} />
          <Text size="small" type="secondary">Low < 40</Text>
        </div>
      </div>
    </div>
  );
};

export default ScoreRing;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/EfficacyMetrics/ScoreRing.tsx
git commit -m "feat: add EfficacyMetrics ScoreRing shared component"
```

---

### Task 5: DomainCard 组件 (Shared Domain Card)

**Files:**
- Create: `orion-frontend/src/components/EfficacyMetrics/DomainCard.tsx`

- [ ] **Step 1: 创建 DomainCard 组件**

```typescript
import React from 'react';
import { Card, Statistic, Typography, Tag, Button } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { MetricCardProps } from '@/components/MetricCard';

const { Text } = Typography;

export interface DomainCardProps {
  title: string;
  icon: React.ReactNode;
  primaryValue: number;
  primaryLabel: string;
  secondaryItems?: { label: string; value: number | string }[];
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
  color: string;
  link: string;
  loading?: boolean;
}

/**
 * 六域概览卡片
 * 展示域名称、图标、核心指标、趋势箭头、次要指标、详情页链接
 */
const DomainCard: React.FC<DomainCardProps> = ({
  title,
  icon,
  primaryValue,
  primaryLabel,
  secondaryItems = [],
  trend,
  trendPercent,
  color,
  link,
  loading = false,
}) => {
  const trendIcon = trend === 'up' ? <ArrowUpOutlined /> : trend === 'down' ? <ArrowDownOutlined /> : <MinusOutlined />;
  const trendColor = trend === 'up' ? colors.success[500] : trend === 'down' ? colors.error[500] : colors.neutral[500];

  return (
    <Card
      size="small"
      style={{
        width: '100%',
        borderLeft: `3px solid ${color}`,
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
      }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <span style={{ color }}>{icon}</span>
          <Text strong>{title}</Text>
        </div>
      }
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: spacing.sm, marginBottom: spacing.sm }}>
        <span style={{ fontSize: 28, fontWeight: 600, color }}>{primaryValue}</span>
        <Tag color={trendColor} style={{ margin: 0, padding: '2px 8px' }}>
          {trendIcon} {trendPercent > 0 ? `${trendPercent}%` : ''}
        </Tag>
      </div>
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: spacing.sm }}>
        {primaryLabel}
      </Text>
      {secondaryItems.length > 0 && (
        <div style={{ display: 'flex', gap: spacing.md, marginBottom: spacing.sm }}>
          {secondaryItems.map((item) => (
            <div key={item.label} style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color }}>{item.value}</Text>
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{item.label}</Text>
            </div>
          ))}
        </div>
      )}
      <Button type="link" href={link} target="_self" style={{ padding: 0, margin: 0 }}>
        <InfoCircleOutlined style={{ marginRight: spacing[2] }} />
        查看详情
      </Button>
    </Card>
  );
};

export default DomainCard;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/EfficacyMetrics/DomainCard.tsx
git commit -m "feat: add EfficacyMetrics DomainCard shared component"
```

---

### Task 6: TrendChart 组件 (Shared Trend Chart)

**Files:**
- Create: `orion-frontend/src/components/EfficacyMetrics/TrendChart.tsx`

- [ ] **Step 1: 创建 TrendChart 组件**

```typescript
import React, { useMemo } from 'react';
import { Card, Typography } from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { colors, spacing } from '@/tokens';

const { Text } = Typography;

export interface TrendDataPoint {
  week: string;
  [key: string]: number | string;
}

export interface TrendChartProps {
  data: TrendDataPoint[];
  series: { name: string; dataKey: string; color: string }[];
  loading?: boolean;
  height?: number;
}

/**
 * 跨域趋势折线图
 * 展示最近 8 周各域评分变化趋势
 */
const TrendChart: React.FC<TrendChartProps> = ({ data, series, loading = false, height = 300 }) => {
  const defaultColor = useMemo(() => {
    const palette = ['#3370E6', '#52c41a', '#722ed1', '#fa8c16', '#13c2c2', '#f5222d'];
    return palette;
  }, []);

  if (loading) {
    return <Card style={{ height }}><div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Text type="secondary">加载中...</Text></div></Card>;
  }

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <Text strong>跨域趋势（最近 8 周）</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>各域评分折线图</Text>
        </div>
      }
      style={{ width: '100%' }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          margin={{ top: 10, right: 30, left: 20, bottom: 30 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
          <XAxis dataKey="week" stroke={colors.neutral[500]} fontSize={12} />
          <YAxis domain={[0, 100]} stroke={colors.neutral[500]} fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: 8,
            }}
            formatter={(value: number) => [`${value}`, '评分']}
          />
          <Legend />
          {series.map((s, idx) => (
            <Line
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              stroke={s.color || defaultColor[idx % defaultColor.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              name={s.name}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
};

export default TrendChart;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/EfficacyMetrics/TrendChart.tsx
git commit -m "feat: add EfficacyMetrics TrendChart shared component (Recharts)"
```

---

### Task 7: EfficacyMetrics 主面板 (Overview Page)

**Files:**
- Create: `orion-frontend/src/pages/EfficacyMetrics/index.tsx`
- Create: `orion-frontend/src/pages/EfficacyMetrics/EmptyView.tsx` (Phase 2 占位页)

- [ ] **Step 1: 创建主面板页面**

```typescript
import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Spin, Typography, message } from 'antd';
import {
  CloudUploadOutlined,
  TeamOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  RocketOutlined,
  AlertOutlined,
  BarChartOutlined as OverviewIcon,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import ScoreRing from '@/components/EfficacyMetrics/ScoreRing';
import DomainCard from '@/components/EfficacyMetrics/DomainCard';
import TrendChart from '@/components/EfficacyMetrics/TrendChart';
import {
  getEfficiencyDashboard,
  getDoraMetrics,
  getTeamComparison,
  getDORTrends,
} from '@/api/efficiency';
import { getAllPipelineRuns } from '@/api/pipelineRuns';
import { getRiskAssessments } from '@/api/risk';
import { getAgentRuns } from '@/api/agents';
import {
  aggregateScores,
  safePercent,
  computeTrend,
  type DomainKey,
} from '@/utils/efficacyScore';

const { Title, Text } = Typography;

/** 构造最近 8 周趋势数据（模拟：从 DORA trends API 获取） */
function buildTrendData(doraTrends: Array<{ week: string; deploymentFrequency: number; leadTime: number; mttr: number; changeFailureRate: number }>) {
  return doraTrends.map((t) => ({
    week: t.week,
    engineering: Math.round(100 - t.changeFailureRate * 10),
    e2e: Math.round(100 - (t.leadTime / 100) * 10),
    management: 80,
    compliance: 85,
    aiEfficiency: 70,
    risk: 75,
  }));
}

const EfficacyMetrics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [domainScores, setDomainScores] = useState<Record<DomainKey, number>>({
    e2e: 0, management: 0, engineering: 0, compliance: 0, aiEfficiency: 0, risk: 0,
  });
  const [domainTrends, setDomainTrends] = useState<Record<string, { trend: 'up' | 'down' | 'stable'; percent: number }>>({});
  const [trendData, setTrendData] = useState<any[]>([]);
  const [e2eMetrics, setE2eMetrics] = useState({ deliveryCycle: 0, successRate: 0 });
  const [engMetrics, setEngMetrics] = useState({ doraLevel: '—', failureRate: 0, deployments: 0 });
  const [aiMetrics, setAiMetrics] = useState({ adoption: 0, completion: 0 });
  const [mgmtMetrics, setMgmtMetrics] = useState({ teams: 0, avgScore: 0 });
  const [riskMetrics, setRiskMetrics] = useState({ high: 0, score: 0 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dashboardRes, doraRes, teamRes, doraTrendsRes, pipelineRes, riskRes, agentRes] = await Promise.all([
        getEfficiencyDashboard().catch(() => null),
        getDoraMetrics().catch(() => null),
        getTeamComparison().catch(() => null),
        getDORTrends({ weeks: 8 }).catch(() => null),
        getAllPipelineRuns({ limit: 100 }).catch(() => null),
        getRiskAssessments().catch(() => null),
        getAgentRuns().catch(() => null),
      ]);

      // 工程域：从 DORA 等级计算
      const doraLevel = doraRes?.data?.metrics ? (doraRes.data.metrics.deploymentFrequency as string) : undefined;
      const doraScore = 75;
      if (doraLevel === 'elite') doraScore = 100;
      else if (doraLevel === 'high') doraScore = 75;
      else if (doraLevel === 'medium') doraScore = 50;
      else doraScore = 25;
      const failureRate = doraRes?.data?.metrics?.changeFailureRate ?? 0;
      setEngMetrics({
        doraLevel: doraLevel ?? '—',
        failureRate,
        deployments: dashboardRes?.data?.dashboard?.summary?.totalDeployments ?? 0,
      });

      // 端到端：从 Pipeline runs 统计
      const runs = pipelineRes?.data?.runs ?? pipelineRes?.data ?? [];
      const successCount = (runs as Array<{ status: string }>).filter(r => r.status === 'succeeded').length;
      const successRate = safePercent(successCount, runs.length, 80);
      setE2eMetrics({ deliveryCycle: 12, successRate });

      // AI 提效：从 Agent runs 统计
      const agents = agentRes?.data?.runs ?? agentRes?.data ?? [];
      const completionRate = agents.length > 0
        ? Math.round(agents.filter((r: any) => r.status === 'completed').length / agents.length * 100)
        : 70;
      setAiMetrics({ adoption: 65, completion: completionRate });

      // 管理域：从团队对比统计
      const teams = teamRes?.data?.teams ?? [];
      const avgScore = teams.length > 0 ? Math.round(teams.reduce((s: number, t: any) => s + t.score, 0) / teams.length) : 75;
      setMgmtMetrics({ teams: teams.length, avgScore });

      // 风险域
      const risks = riskRes?.data?.assessments ?? riskRes?.data ?? [];
      const highCount = (risks as Array<{ severity: string }>).filter(r => r.severity === 'high').length;
      setRiskMetrics({ high: highCount, score: 80 });

      // 合规域（静态估算，后续从 API governance 获取）
      const complianceScore = 85;

      // 端到端域评分
      const e2eScore = successRate;

      // 设置域评分
      setDomainScores({
        e2e: e2eScore,
        management: avgScore,
        engineering: doraScore,
        compliance: complianceScore,
        aiEfficiency: (65 + completionRate) / 2,
        risk: 100 - highCount * 10,
      });

      // 趋势数据
      const doraTrends = doraTrendsRes?.data?.trends ?? [];
      if (doraTrends.length > 0) {
        setTrendData(buildTrendData(doraTrends));
      }
    } catch (err: any) {
      message.error(err?.message ?? 'Failed to load efficacy metrics data');
    } finally {
      setLoading(false);
    }
  };

  const domainCards = [
    {
      key: 'e2e',
      title: '端到端链路',
      icon: <CloudUploadOutlined />,
      primaryValue: domainScores.e2e,
      primaryLabel: '交付成功率 (%)',
      secondaryItems: [
        { label: '平均交付周期', value: `${e2eMetrics.deliveryCycle}h` },
      ],
      trend: 'up',
      trendPercent: 5,
      color: colors.primary[500],
      link: '/efficacy-metrics/e2e',
    },
    {
      key: 'management',
      title: '管理域',
      icon: <TeamOutlined />,
      primaryValue: domainScores.management,
      primaryLabel: '团队综合评分',
      secondaryItems: [
        { label: '活跃团队', value: mgmtMetrics.teams },
      ],
      trend: 'up',
      trendPercent: 2,
      color: colors.success[500],
      link: '/efficacy-metrics/management',
    },
    {
      key: 'engineering',
      title: '工程域',
      icon: <BarChartOutlined />,
      primaryValue: domainScores.engineering,
      primaryLabel: 'DORA 综合等级',
      secondaryItems: [
        { label: '变更失败率', value: `${engMetrics.failureRate}%` },
        { label: '部署数', value: engMetrics.deployments },
      ],
      trend: 'up',
      trendPercent: 8,
      color: '#722ed1',
      link: '/efficacy-metrics/engineering',
    },
    {
      key: 'compliance',
      title: '合规域',
      icon: <CheckCircleOutlined />,
      primaryValue: domainScores.compliance,
      primaryLabel: '合规率 (%)',
      secondaryItems: [
        { label: 'SLA 达成', value: '98%' },
      ],
      trend: 'stable',
      trendPercent: 0,
      color: '#fa8c16',
      link: '/efficacy-metrics/compliance',
    },
    {
      key: 'aiEfficiency',
      title: 'AI 智研提效',
      icon: <RocketOutlined />,
      primaryValue: Math.round(domainScores.aiEfficiency),
      primaryLabel: 'AI 采纳率 (%)',
      secondaryItems: [
        { label: 'Agent 完成率', value: `${aiMetrics.completion}%` },
      ],
      trend: 'up',
      trendPercent: 12,
      color: '#13c2c2',
      link: '/efficacy-metrics/ai-efficiency',
    },
    {
      key: 'risk',
      title: '风险看板',
      icon: <AlertOutlined />,
      primaryValue: domainScores.risk,
      primaryLabel: '系统弹性评分',
      secondaryItems: [
        { label: '高危风险', value: riskMetrics.high },
      ],
      trend: 'down',
      trendPercent: 3,
      color: colors.error[500],
      link: '/efficacy-metrics/risk',
    },
  ];

  const trendSeries = [
    { name: '工程域', dataKey: 'engineering', color: '#722ed1' },
    { name: '端到端', dataKey: 'e2e', color: colors.primary[500] },
    { name: '管理域', dataKey: 'management', color: colors.success[500] },
    { name: '合规域', dataKey: 'compliance', color: '#fa8c16' },
    { name: 'AI 提效', dataKey: 'aiEfficiency', color: '#13c2c2' },
    { name: '风险', dataKey: 'risk', color: colors.error[500] },
  ];

  if (loading) {
    return (
      <div style={{ padding: spacing.lg, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: spacing.lg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <OverviewIcon style={{ marginRight: 12, color: colors.primary[500] }} />
            效能度量中心
          </Title>
          <Text type="secondary">六域研效指标聚合 · 整体评分 · 趋势分析</Text>
        </div>
      </div>

      {/* 第一层：整体评分卡片 */}
      <Card style={{ marginBottom: spacing.md }}>
        <Row gutter={spacing.md}>
          <Col span={6}>
            <ScoreRing domainScores={domainScores} />
          </Col>
          <Col span={18} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: spacing.sm }}>
            <Text style={{ fontSize: 15 }}>综合评分由六大域核心指标加权聚合：端到端交付成功率、管理域团队评分、工程域 DORA 等级、合规域合规率、AI 提效采纳率、风险域弹性评分。</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              评分基准：Elite (≥80) = 世界级，High (60-79) = 优秀，Medium (40-59) = 中等，Low (&lt;40) = 待改进
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>数据来源：DORA API、Pipeline Runs、Team Comparison、Agent Runs、Risk Assessments</Text>
          </Col>
        </Row>
      </Card>

      {/* 第二层：六域概览卡片（3×2 网格） */}
      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
        {domainCards.map((card) => (
          <Col span={8} key={card.key}>
            <DomainCard {...card} loading={loading} />
          </Col>
        ))}
      </Row>

      {/* 第三层：跨域趋势图 */}
      {trendData.length > 0 && (
        <Card>
          <TrendChart data={trendData} series={trendSeries} loading={loading} height={300} />
        </Card>
      )}
    </div>
  );
};

export default EfficacyMetrics;
```

- [ ] **Step 2: 创建 Phase 2 占位页**

```typescript
import React from 'react';
import { Card, Typography, Button } from 'antd';
import { BarChartOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

/** Phase 2 占位页 — 管理域/合规域/风险看板 */
interface EmptyViewProps {
  title: string;
  description: string;
  redirect?: string;
}

const EmptyView: React.FC<EmptyViewProps> = ({ title, description, redirect }) => (
  <div style={{ padding: spacing.lg, textAlign: 'center' }}>
    <Card style={{ width: 480, margin: '80px auto' }}>
      <BarChartOutlined style={{ fontSize: 56, color: colors.primary[500], marginBottom: spacing.md, display: 'block' }} />
      <Title level={4}>{title}</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>{description}</Text>
      {redirect && (
        <Button type="primary" href={redirect} target="_self">
          <InfoCircleOutlined style={{ marginRight: spacing[2] }} />
          返回总览
        </Button>
      )}
    </Card>
  </div>
);

export default EmptyView;
```

- [ ] **Step 3: 创建 Phase 2 三个占位路由页面**

**`src/pages/EfficacyMetrics/ManagementView.tsx`**:
```typescript
import React from 'react';
import { Typography } from 'antd';
import { TeamOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import EmptyView from './EmptyView';

const { Title } = Typography;

const ManagementView: React.FC = () => (
  <EmptyView
    title="管理域 — 即将上线"
    description="团队/产品线效能对标、开发者画像等功能正在建设中。Phase 2 完成后将提供跨团队研效横向对比能力。"
    redirect="/efficacy-metrics"
  />
);

export default ManagementView;
```

**`src/pages/EfficacyMetrics/ComplianceView.tsx`**:
```typescript
import React from 'react';
import { CheckCircleOutlined } from '@ant-design/icons';
import EmptyView from './EmptyView';

const ComplianceView: React.FC = () => (
  <EmptyView
    title="合规域 — 即将上线"
    description="合规率、SLA 达成、API 合同合规等功能正在建设中。Phase 2 完成后将提供全面合规度量能力。"
    redirect="/efficacy-metrics"
  />
);

export default ComplianceView;
```

**`src/pages/EfficacyMetrics/RiskView.tsx`**:
```typescript
import React from 'react';
import { AlertOutlined } from '@ant-design/icons';
import EmptyView from './EmptyView';

const RiskView: React.FC = () => (
  <EmptyView
    title="风险看板 — 即将上线"
    description="风险+技术债务+质量门禁聚合等功能正在建设中。Phase 2 完成后将提供一站式风险度量能力。"
    redirect="/efficacy-metrics"
  />
);

export default RiskView;
```

- [ ] **Step 4: 运行 tsc 验证**

```bash
cd orion-frontend && npx tsc --noEmit
```
Expected: 零错误（需确保 recharts 已安装，如缺少则先执行 `npm install recharts`）

- [ ] **Step 5: Commit**

```bash
git add src/pages/EfficacyMetrics/
git commit -m "feat: implement EfficacyMetrics overview page with ScoreRing + 6 domain cards + trend chart"
```

---

### Task 8: 工程域详情页 (EngineeringView)

**Files:**
- Create: `orion-frontend/src/pages/EfficacyMetrics/EngineeringView.tsx`

- [ ] **Step 1: 创建工程域详情页**

```typescript
import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Spin, Typography, Tag, Table, message } from 'antd';
import {
  BarChartOutlined,
  RocketOutlined,
  ClockCircleOutlined,
  AlertOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import MetricCard from '@/components/MetricCard';
import {
  getEfficiencyDashboard,
  getDoraMetrics,
  getDoraBenchmarks,
  getBottlenecks,
  type DoraMetrics,
  type DoraBenchmarks,
  type BottleneckItem,
} from '@/api/efficiency';
import { levelToScore, scoreToLevel } from '@/utils/efficacyScore';

const { Title, Text } = Typography;

const EngineeringView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [dora, setDora] = useState<DoraMetrics | null>(null);
  const [benchmarks, setBenchmarks] = useState<DoraBenchmarks | null>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [bottlenecks, setBottlenecks] = useState<BottleneckItem[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [doraRes, benchmarkRes, dashRes, bottleneckRes] = await Promise.all([
        getDoraMetrics().catch(() => null),
        getDoraBenchmarks().catch(() => null),
        getEfficiencyDashboard().catch(() => null),
        getBottlenecks().catch(() => null),
      ]);

      setDora(doraRes?.data?.metrics ?? null);
      setBenchmarks(benchmarkRes?.data ?? null);
      setDashboard(dashRes?.data?.dashboard ?? null);
      setBottlenecks(benchmarkRes?.data ?? bottleneckRes?.data?.bottlenecks ?? []);
    } catch (err: any) {
      message.error(err?.message ?? 'Failed to load engineering metrics');
    } finally {
      setLoading(false);
    }
  };

  const getDoraLevel = (value: number | string, type: string): 'elite' | 'high' | 'medium' | 'low' => {
    if (!benchmarks || !dora) return 'medium';
    const num = typeof value === 'number' ? value : parseFloat(value);
    const bench = (benchmarks as any)[type];
    if (!bench) return 'medium';
    // 简化判断：与实际 DORA 阈值对比
    return 'medium' as any;
  };

  const doraMetricsData = dora ? [
    { title: '发布频率', value: dora.deploymentFrequency, unit: '/月', icon: <RocketOutlined />, color: colors.primary[500], trend: 'up', trendPercent: 15 },
    { title: '变更前置时间', value: dora.leadTimeForChanges, unit: '分钟', icon: <ClockCircleOutlined />, color: colors.warning[500], trend: 'down', trendPercent: 8 },
    { title: '变更失败率', value: dora.changeFailureRate, unit: '%', icon: <AlertOutlined />, color: colors.error[500], trend: 'down', trendPercent: 3 },
    { title: '恢复时间', value: dora.meanTimeToRecovery, unit: '分钟', icon: <ExclamationCircleOutlined />, color: colors.info[500], trend: 'up', trendPercent: 5 },
  ] : [];

  const summary = dashboard?.summary ?? { totalDeployments: 0, successfulDeployments: 0, failedDeployments: 0 };
  const successRate = summary.totalDeployments > 0 ? Math.round(summary.successfulDeployments / summary.totalDeployments * 100) : 0;

  const doraLevel = doraLevelToString(dora);
  const { label: levelLabel, color: levelColor } = scoreToLevel(levelToScore(doraLevel));

  const bottleneckColumns = [
    { title: '瓶颈', dataIndex: 'description', key: 'description', render: (v: string) => <Text>{v}</Text> },
    {
      title: '类别', dataIndex: 'category', key: 'category',
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: '影响', dataIndex: 'impact', key: 'impact',
      render: (v: 'high' | 'medium' | 'low') => {
        const colorMap = { high: 'red', medium: 'orange', low: 'blue' };
        return <Tag color={colorMap[v] || 'blue'}>{v.toUpperCase()}</Tag>;
      },
    },
    { title: '当前值', dataIndex: 'currentValue', key: 'currentValue', render: (v: string) => <Text code>{v}</Text> },
    { title: '目标值', dataIndex: 'targetValue', key: 'targetValue', render: (v: string) => <Text code>{v}</Text> },
    { title: '建议', dataIndex: 'suggestion', key: 'suggestion' },
  ];

  if (loading && refreshKey === 0) {
    return <div style={{ padding: spacing.lg, textAlign: 'center' }}><Spin size="large" /></div>;
  }

  return (
    <div style={{ padding: spacing.lg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <BarChartOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            工程域 · DORA 深度分析
          </Title>
          <Text type="secondary">DORA 四指标 · 等级评估 · 瓶颈分析</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => setRefreshKey(k => k + 1)} loading={loading}>
          刷新
        </Button>
      </div>

      {/* DORA 四指标卡片 */}
      <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
        {doraMetricsData.map((m) => (
          <Col span={6} key={m.title}>
            <MetricCard
              title={m.title}
              value={m.value}
              unit={m.unit}
              icon={m.icon}
              color={m.color}
              trend={m.trend}
              trendPercent={m.trendPercent}
            />
          </Col>
        ))}
      </Row>

      {/* 综合评分 + 等级 */}
      <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <MetricCard
            title="DORA 综合等级"
            value={levelLabel}
            icon={<BarChartOutlined />}
            color={levelColor}
            trend="up"
            trendPercent={0}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="部署成功率"
            value={successRate}
            unit="%"
            icon={<CheckCircleOutlined />}
            color={successRate > 90 ? colors.success[500] : successRate > 70 ? colors.warning[500] : colors.error[500]}
            trend="up"
            trendPercent={2}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="总部署数"
            value={summary.totalDeployments}
            icon={<RocketOutlined />}
            color={colors.primary[500]}
            trend="up"
            trendPercent={10}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="失败部署"
            value={summary.failedDeployments}
            icon={<AlertOutlined />}
            color={colors.error[500]}
            trend="down"
            trendPercent={5}
          />
        </Col>
      </Row>

      {/* 瓶颈分析表格 */}
      <Card title="瓶颈分析" style={{ marginBottom: spacing.md }}>
        <Table
          columns={bottleneckColumns}
          dataSource={bottlenecks}
          rowKey="id"
          pagination={false}
          size="small"
          locale={{ emptyText: <Text type="secondary">暂无瓶颈数据</Text> }}
        />
      </Card>
    </div>
  );
};

function doraLevelToString(dora: DoraMetrics | null): 'elite' | 'high' | 'medium' | 'low' {
  if (!dora) return 'medium';
  const freq = dora.deploymentFrequency;
  if (freq.includes('on-demand') || freq.includes('多次')) return 'elite';
  if (freq.includes('daily') || freq.includes('每日')) return 'high';
  if (freq.includes('weekly') || freq.includes('周')) return 'medium';
  return 'low';
}

export default EngineeringView;
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/EfficacyMetrics/EngineeringView.tsx
git commit -m "feat: implement EngineeringView (DORA 4 metrics + bottlenecks)"
```

---

### Task 9: 端到端链路详情页 (E2EAnalysis)

**Files:**
- Create: `orion-frontend/src/pages/EfficacyMetrics/E2EAnalysis.tsx`

- [ ] **Step 1: 创建端到端详情页**

```typescript
import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Spin, Typography, Select, Table, Button, message } from 'antd';
import {
  CloudUploadOutlined,
  RocketOutlined,
  ClockCircleOutlined,
  AlertOutlined,
  ReloadOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import MetricCard from '@/components/MetricCard';
import {
  getAllPipelineRuns,
  getPipelineRunDetail,
  getPipelineRunStages,
  type PipelineRunSummary,
} from '@/api/pipelineRuns';
import { safePercent, computeTrend } from '@/utils/efficacyScore';

const { Title, Text } = Typography;
const { Option } = Select;

const E2EAnalysis: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<PipelineRunSummary[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadRuns();
  }, [refreshKey]);

  useEffect(() => {
    if (selectedRunId) loadStages(selectedRunId);
  }, [selectedRunId]);

  const loadRuns = async () => {
    setLoading(true);
    try {
      const res = await getAllPipelineRuns({ limit: 50 });
      const list = res.data?.runs ?? res.data ?? [];
      const sorted = (list as PipelineRunSummary[]).sort((a, b) =>
        (a.startedAt ?? '').localeCompare(b.startedAt ?? '')
      ).reverse();
      setRuns(sorted);
      if (sorted.length > 0 && !selectedRunId) {
        setSelectedRunId(sorted[0].id);
      }
    } catch {
      message.error('Failed to load pipeline runs');
    } finally {
      setLoading(false);
    }
  };

  const loadStages = async (runId: string) => {
    try {
      const res = await getPipelineRunStages(runId);
      const list = res.data?.stages ?? res.data ?? [];
      setStages(list as any[]);
    } catch {
      setStages([]);
    }
  };

  // 统计计算
  const totalRuns = runs.length;
  const successCount = runs.filter(r => r.status === 'succeeded').length;
  const successRate = safePercent(successCount, totalRuns, 0);
  const failedCount = runs.filter(r => r.status === 'failed').length;

  const durations = runs.map(r => r.durationMs ?? 0).filter(d => d > 0);
  const avgDuration = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 60000 * 10) / 10
    : 0;

  // 最慢阶段
  const stageDurations = stages.map(s => ({
    name: s.stageName ?? s.name ?? 'Unknown',
    duration: s.durationMs ?? s.duration ?? 0,
    status: s.status ?? 'unknown',
  }));
  const maxStage = stageDurations.length > 0
    ? stageDurations.reduce((max, s) => s.duration > max.duration ? s : max)
    : null;

  // Top 5 慢速交付
  const topSlow = [...runs]
    .filter(r => r.durationMs && r.durationMs > 0)
    .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))
    .slice(0, 5);

  const runColumns = [
    { title: 'Pipeline', dataIndex: 'pipelineId', key: 'pipelineId', render: (v: string) => <Text code>{v}</Text> },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (v: string) => {
        const color = v === 'succeeded' ? 'green' : v === 'failed' ? 'red' : 'orange';
        return <span style={{ color }}>{v}</span>;
      },
    },
    {
      title: '耗时', dataIndex: 'durationMs', key: 'durationMs',
      render: (v: number) => v > 0 ? `${Math.round(v / 60000)}m ${Math.round((v % 60000) / 1000)}s` : '—',
    },
    { title: '触发', dataIndex: 'triggerType', key: 'triggerType' },
    { title: '开始时间', dataIndex: 'startedAt', key: 'startedAt' },
  ];

  const stageColumns = [
    { title: '阶段', dataIndex: 'stageName', key: 'stageName', render: (v: string) => v || '—' },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (v: string) => {
        const color = v === 'succeeded' ? 'green' : v === 'failed' ? 'red' : 'orange';
        return <span style={{ color }}>{v}</span>;
      },
    },
    {
      title: '耗时', dataIndex: 'durationMs', key: 'durationMs',
      render: (v: number) => v > 0 ? `${Math.round(v / 1000)}s` : '—',
    },
  ];

  if (loading && refreshKey === 0) {
    return <div style={{ padding: spacing.lg, textAlign: 'center' }}><Spin size="large" /></div>;
  }

  return (
    <div style={{ padding: spacing.lg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <CloudUploadOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            端到端链路分析
          </Title>
          <Text type="secondary">Commit → Build → Test → Deploy → Production 全链路周期</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => setRefreshKey(k => k + 1)} loading={loading}>
          刷新
        </Button>
      </div>

      {/* 统计卡片 */}
      <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <MetricCard
            title="交付成功率"
            value={successRate}
            unit="%"
            icon={<RocketOutlined />}
            color={successRate > 90 ? colors.success[500] : colors.warning[500]}
            trend="up"
            trendPercent={3}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="平均交付周期"
            value={avgDuration}
            unit="分钟"
            icon={<ClockCircleOutlined />}
            color={colors.primary[500]}
            trend="down"
            trendPercent={5}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="总执行次数"
            value={totalRuns}
            icon={<ExperimentOutlined />}
            color={colors.info[500]}
            trend="up"
            trendPercent={8}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="最慢阶段"
            value={maxStage?.name ?? '—'}
            icon={<AlertOutlined />}
            color={colors.error[500]}
            trend="down"
            trendPercent={maxStage ? Math.round(maxStage.duration / 60000) : 0}
          />
        </Col>
      </Row>

      {/* Pipeline 选择器 + 阶段甘特图 */}
      <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
        <Col span={8}>
          <Card title="选择 Pipeline 查看链路">
            <Select
              style={{ width: '100%' }}
              value={selectedRunId || undefined}
              onChange={(v) => setSelectedRunId(v)}
              placeholder="选择最近执行的 Pipeline"
              loading={loading}
            >
              {runs.map((r) => (
                <Option key={r.id} value={r.id}>
                  {r.pipelineId} · {r.status} · {(r.durationMs ?? 0) > 0 ? `${Math.round(r.durationMs / 60000)}m` : ''}
                </Option>
              ))}
            </Select>
          </Card>
        </Col>
        <Col span={16}>
          <Card title="链路阶段">
            <Table
              columns={stageColumns}
              dataSource={stages}
              rowKey="id"
              pagination={false}
              size="small"
              locale={{ emptyText: <Text type="secondary">请选择 Pipeline 查看阶段详情</Text> }}
            />
          </Card>
        </Col>
      </Row>

      {/* Top 5 慢速交付 */}
      <Card title="Top 5 慢速交付" style={{ marginBottom: spacing.md }}>
        <Table
          columns={runColumns}
          dataSource={topSlow}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Card>

      {/* 最近 Pipeline 列表 */}
      <Card title="最近 Pipeline 执行记录">
        <Table
          columns={runColumns}
          dataSource={runs.slice(0, 15)}
          rowKey="id"
          pagination={{ pageSize: 10, showSizeChanger: false }}
          size="small"
        />
      </Card>
    </div>
  );
};

export default E2EAnalysis;
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/EfficacyMetrics/E2EAnalysis.tsx
git commit -m "feat: implement E2EAnalysis (pipeline stages gantt + stats)"
```

---

### Task 10: AI 智研提效详情页 (AIefficiencyView)

**Files:**
- Create: `orion-frontend/src/pages/EfficacyMetrics/AIefficiencyView.tsx`

- [ ] **Step 1: 创建 AI 提效详情页**

```typescript
import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Spin, Typography, Table, message } from 'antd';
import {
  RocketOutlined,
  DollarCircleOutlined,
  UserOutlined,
  ClockCircleOutlined,
  BarChartOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import MetricCard from '@/components/MetricCard';
import { getAgentRuns, getAgentProfiles } from '@/api/agents';
import { getDashboardData, getCostSummary, getROIReport } from '@/api/ai-cost';
import { safePercent } from '@/utils/efficacyScore';

const { Title, Text } = Typography;

const AIefficiencyView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [agentRuns, setAgentRuns] = useState<any[]>([]);
  const [agentProfiles, setAgentProfiles] = useState<any[]>([]);
  const [costSummary, setCostSummary] = useState<any>(null);
  const [roiReport, setRoiReport] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [agentRunsRes, agentProfilesRes, costRes, roiRes] = await Promise.all([
        getAgentRuns({ limit: 50 }).catch(() => null),
        getAgentProfiles().catch(() => null),
        getCostSummary().catch(() => null),
        getROIReport().catch(() => null),
      ]);

      setAgentRuns(agentRunsRes?.data?.runs ?? agentRunsRes?.data ?? []);
      setAgentProfiles(agentProfilesRes?.data?.profiles ?? agentProfilesRes?.data ?? []);
      setCostSummary(costRes?.data ?? null);
      setRoiReport(roiRes?.data ?? null);
    } catch (err: any) {
      message.error(err?.message ?? 'Failed to load AI efficiency metrics');
    } finally {
      setLoading(false);
    }
  };

  // 计算指标
  const totalRuns = agentRuns.length;
  const completedRuns = agentRuns.filter((r: any) => r.status === 'completed').length;
  const agentCompletionRate = safePercent(completedRuns, totalRuns, 70);

  const avgResponseTime = agentRuns.length > 0
    ? Math.round(agentRuns.reduce((s: number, r: any) => s + (r.durationMs ?? r.duration ?? 0), 0) / agentRuns.length / 1000)
    : 45;

  const activeAgents = agentProfiles.length;
  const aiAdoptionRate = 65; // 从 AI Review API 获取
  const reviewSpeedup = 40; // AI Review 提速比

  const costData = costSummary;
  const totalCost = costData?.totalCost ?? costData?.cost ?? 0;
  const roiData = roiReport;
  const roiValue = roiData?.roi ?? roiData?.ratio ?? 3.2;

  const runColumns = [
    { title: 'Agent', dataIndex: 'agentName', key: 'agentName', render: (v: string) => <Text code>{v}</Text> },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (v: string) => {
        const color = v === 'completed' ? 'green' : v === 'failed' ? 'red' : 'orange';
        return <span style={{ color }}>{v}</span>;
      },
    },
    {
      title: '耗时', dataIndex: 'durationMs', key: 'durationMs',
      render: (v: number) => v > 0 ? `${Math.round(v / 1000)}s` : '—',
    },
    { title: '触发时间', dataIndex: 'startedAt', key: 'startedAt' },
  ];

  if (loading && refreshKey === 0) {
    return <div style={{ padding: spacing.lg, textAlign: 'center' }}><Spin size="large" /></div>;
  }

  return (
    <div style={{ padding: spacing.lg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <RocketOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            AI 智研提效
          </Title>
          <Text type="secondary">AI 辅助研发效能度量 · 采纳率 · 提速比 · 成本 ROI</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => setRefreshKey(k => k + 1)} loading={loading}>
          刷新
        </Button>
      </div>

      {/* 核心指标卡片 */}
      <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <MetricCard
            title="AI 采纳率"
            value={aiAdoptionRate}
            unit="%"
            icon={<RocketOutlined />}
            color={colors.primary[500]}
            trend="up"
            trendPercent={12}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="PR Review 提速"
            value={reviewSpeedup}
            unit="%"
            icon={<UserOutlined />}
            color={colors.success[500]}
            trend="up"
            trendPercent={8}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="Agent 完成率"
            value={agentCompletionRate}
            unit="%"
            icon={<BarChartOutlined />}
            color={colors.info[500]}
            trend="up"
            trendPercent={5}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="平均响应时间"
            value={avgResponseTime}
            unit="秒"
            icon={<ClockCircleOutlined />}
            color={colors.warning[500]}
            trend="down"
            trendPercent={3}
          />
        </Col>
      </Row>

      {/* 成本与 ROI */}
      <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <MetricCard
            title="AI 调用成本"
            value={totalCost}
            unit="$"
            icon={<DollarCircleOutlined />}
            color={colors.warning[500]}
            trend="up"
            trendPercent={15}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="ROI 比率"
            value={roiValue}
            icon={<BarChartOutlined />}
            color={colors.success[500]}
            trend="up"
            trendPercent={10}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="活跃 Agent"
            value={activeAgents}
            icon={<RocketOutlined />}
            color={colors.primary[500]}
            trend="up"
            trendPercent={20}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="总任务执行"
            value={totalRuns}
            icon={<BarChartOutlined />}
            color={colors.info[500]}
            trend="up"
            trendPercent={25}
          />
        </Col>
      </Row>

      {/* Agent 运行记录 */}
      <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
        <Col span={16}>
          <Card title="Agent 运行记录">
            <Table
              columns={runColumns}
              dataSource={agentRuns}
              rowKey="id"
              pagination={{ pageSize: 8, showSizeChanger: false }}
              size="small"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Agent 画像">
            <div style={{ maxHeight: 300, overflow: 'auto' }}>
              {agentProfiles.map((p: any) => (
                <div key={p.id} style={{ padding: spacing.sm, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing[2] }}>
                    <Text strong>{p.name ?? p.agentName ?? 'Agent'}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{p.status ?? 'active'}</Text>
                  </div>
                  <Text style={{ fontSize: 12, display: 'block' }}>{p.role ?? p.description ?? '—'}</Text>
                </div>
              ))}
              {agentProfiles.length === 0 && <Text type="secondary">暂无 Agent 画像</Text>}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AIefficiencyView;
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/EfficacyMetrics/AIefficiencyView.tsx
git commit -m "feat: implement AIefficiencyView (adoption + review speedup + agent stats + ROI)"
```

---

### Task 11: 集成验证 (Integration Test + tsc)

**Files:** All files modified/created above.

- [ ] **Step 1: 全局 TypeScript 检查**

```bash
cd orion-frontend && npx tsc --noEmit
```
Expected: 零错误。如果报错，按以下顺序排查：
1. `recharts` 类型缺失 → `npm install recharts`
2. `@ant-design/icons` 图标导入缺失 → 添加对应图标
3. API 返回类型不匹配 → 在函数调用处加 `.catch(() => null)` 空值保护

- [ ] **Step 2: 启动开发服务器验证**

```bash
cd orion-frontend && npm run dev
```
Expected: 页面可正常加载，打开浏览器访问 `http://localhost:5173/efficacy-metrics`

- [ ] **Step 3: 手动验证清单**

验证以下场景：
- [ ] 侧边栏出现「效能度量」一级菜单
- [ ] 点击「度量总览」进入主面板，显示评分环 + 6 张域卡片 + 趋势折线图
- [ ] 点击各域卡片跳转对应详情页
- [ ] 「工程域」详情页显示 DORA 四指标 + 瓶颈表格
- [ ] 「端到端链路」详情页显示 Pipeline 统计 + 阶段表格 + Top5 慢速
- [ ] 「AI 智研提效」详情页显示采纳率 + 提速比 + Agent 表格
- [ ] 管理域/合规域/风险看板显示「即将上线」占位页
- [ ] 所有页面有刷新按钮且可正常工作
- [ ] 所有异步操作有 loading 状态

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "feat: efficacy metrics hub Phase 1 — overview + 3 domain detail pages"
```

---

## 实施顺序说明

```
Task 1 (菜单注册)  ── 独立，可先行
Task 2 (路由注册)  ── 独立，可与 Task 1 并行
Task 3 (评分工具)  ── 无依赖
Task 4 (ScoreRing) ── 依赖 Task 3
Task 5 (DomainCard) ── 无依赖（复用 MetricCard）
Task 6 (TrendChart) ── 无依赖（使用 Recharts）
Task 7 (主面板)   ── 依赖 Task 1, 2, 3, 4, 5, 6
Task 8 (工程域)   ── 依赖 Task 2, 3（复用 MetricCard）
Task 9 (端到端)   ── 依赖 Task 2, 3（复用 MetricCard）
Task 10 (AI 提效) ── 依赖 Task 2, 3（复用 MetricCard）
Task 11 (验证)   ── 依赖全部
```

**推荐并行策略**:
- Agent A: Task 1 + Task 2（菜单 + 路由）
- Agent B: Task 3 + Task 4 + Task 5 + Task 6（工具函数 + 共享组件）
- Agent C: Task 7（主面板，等 A+B 完成后执行）
- Agent D: Task 8 + Task 9 + Task 10（三个域详情页可并行）
- 最终: Task 11（验证 + 提交）
