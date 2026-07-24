# 效能运营详细规格 (Phase 2)

> **日期**: 2026-05-05
> **状态**: 已验证
> **能力域**: 效能运营
> **目标成熟度**: L2 → L2.3
> **关键交付**: 开发者画像

## 一、功能描述

### 1.1 现状评估 (L2)

Orion 当前已实现：
- **DoraMetricsService** (`services/efficiency/DoraMetricsService.ts`)：DORA 四项指标计算（部署频率、变更前置时间、变更失败率、平均恢复时间），支持时间窗口聚合（日/周/月/季度），含 DORA 等级评估（elite/high/medium/low）
- **EfficiencyDashboardService** (`services/efficiency/EfficiencyDashboardService.ts`)：8 个场景模板（delivery-speed/release-quality/pipeline-performance/incident-response/cost-optimization/team-productivity/security-compliance/overview），含评分、趋势数据、热力图
- **效率 API** (`api/efficiency-routes.ts`)：DORA 指标查询、Dashboard 场景查询
- **代码审查**：AI Code Review（通过 AIGateway → code-review 场景）
- **Pipeline 效能**：Pipeline 执行时长、成功率、Stage 耗时等基础数据

**不足**：
- 无开发者画像（无法回答"张三的代码质量如何？提交频率？Review 参与度？"）
- DORA 指标仅全局统计，无法按团队/个人/项目维度下钻
- 无贡献度评估（代码贡献 vs 质量贡献 vs 协作贡献）
- 无效能趋势个人化（个人效能趋势 vs 团队/组织对比）
- EfficiencyDashboardService 全部为 mock 数据（`getSampleMetrics` 返回硬编码值），无真实数据源
- 无瓶颈分析（无法定位效能瓶颈在哪个环节）

### 1.2 Phase 2 目标 (L2.3)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 开发者画像 | 个人效能全景（代码质量/提交频率/Review 参与度/协作影响力） | L2.3 |
| DORA 下钻 | 按团队/个人/项目维度查看 DORA 指标 | L2.3 |
| 贡献度评估 | 代码贡献 + 质量贡献 + 协作贡献三维评分 | L2.3 |
| 效能瓶颈分析 | 识别效能瓶颈环节（编码/Review/测试/部署） | L2.3 |
| 真实数据接入 | Dashboard 接入真实 Pipeline/Git/部署数据 | L2.3 |

## 二、验收标准

### 2.1 开发者画像

| # | 标准 | 验证方式 |
|---|------|----------|
| P1 | 开发者画像含代码指标（提交数/Lines/PR 数/Review 数） | API 测试 |
| P2 | 开发者画像含质量指标（Code Review 通过率/Bug 引入率/测试覆盖率） | API 测试 |
| P3 | 开发者画像含协作指标（Review 参与度/帮助他人数/知识分享） | API 测试 |
| P4 | 开发者综合评分（0-100）及雷达图 | 前端验证 |
| P5 | 支持按时间范围查询个人画像（7/30/90 天） | API 测试 |
| P6 | 开发者画像数据可导出 | API 测试 |

### 2.2 DORA 下钻

| # | 标准 | 验证方式 |
|---|------|----------|
| D1 | 支持按团队维度查看 DORA 指标 | API 测试 |
| D2 | 支持按项目维度查看 DORA 指标 | API 测试 |
| D3 | 支持按个人维度查看 DORA 指标 | API 测试 |
| D4 | 维度间对比（团队 A vs 团队 B） | API 测试 |
| D5 | 个人 DORA 与团队/组织平均值对比 | 前端验证 |

### 2.3 贡献度评估

| # | 标准 | 验证方式 |
|---|------|----------|
| C1 | 代码贡献评分（提交频率、代码量、代码复杂度） | 单元测试 |
| C2 | 质量贡献评分（Bug 修复数、代码 Review 质量、测试覆盖） | 单元测试 |
| C3 | 协作贡献评分（Review 他人代码、文档贡献、知识分享） | 单元测试 |
| C4 | 综合评分 = 代码×40% + 质量×40% + 协作×20% | 单元测试 |
| C5 | 贡献度排名（支持按维度排序） | API 测试 |

### 2.4 效能瓶颈分析

| # | 标准 | 验证方式 |
|---|------|----------|
| B1 | 识别各环节耗时占比（编码/Review/CI/部署） | API 测试 |
| B2 | 识别主要瓶颈环节 | API 测试 |
| B3 | 提供改进建议 | API 测试 |
| B4 | 瓶颈趋势（随时间变化） | 前端验证 |

### 2.5 真实数据接入

| # | 标准 | 验证方式 |
|---|------|----------|
| R1 | Dashboard 从 PipelineRepository 读取真实数据 | 集成测试 |
| R2 | Dashboard 从 Git 集成获取提交/PR 数据 | 集成测试 |
| R3 | Dashboard 从 DeploymentRepository 获取部署数据 | 集成测试 |
| R4 | Dashboard 数据刷新间隔 < 5min | 集成测试 |

## 三、API 设计

### 3.1 开发者画像 API

```
Base: /api/v1/efficiency/developers/:developerId
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/profile` | 获取开发者画像 | query: days | `DeveloperProfile` |
| GET | `/profile/trend` | 获取画像趋势 | query: days, metric | `{ data: [{ date, value }] }` |
| GET | `/activities` | 获取活动记录 | query: type, from, to, page, limit | `{ data: ActivityRecord[], total }` |
| GET | `/rankings` | 获取排名 | query: dimension, period | `{ rankings: RankingEntry[] }` |

**DeveloperProfile 结构**:

```typescript
interface DeveloperProfile {
  developerId: string;
  name: string;
  team: string;
  role: string;
  period: { start: Date; end: Date };

  // 综合评分
  overallScore: number;                 // 0-100
  overallRank: number;                  // 在团队中的排名
  teamAvgScore: number;

  // 代码贡献维度
  codeContribution: {
    score: number;                      // 0-100
    commitCount: number;
    linesAdded: number;
    linesDeleted: number;
    prCount: number;
    prMergeRate: number;
    avgPRSize: number;
    codeChurn: number;                  // added + deleted
  };

  // 质量维度
  qualityContribution: {
    score: number;                      // 0-100
    reviewPassRate: number;             // PR 通过率
    bugIntroduced: number;              // 引入的 Bug 数
    bugFixed: number;                   // 修复的 Bug 数
    testCoverageChange: number;         // 测试覆盖率变化
    codeReviewQuality: number;          // Review 评论质量评分
  };

  // 协作维度
  collaborationContribution: {
    score: number;                      // 0-100
    reviewsGiven: number;               // 审查他人 PR 数
    avgReviewTime: number;              // 平均 Review 响应时间 (ms)
    commentsGiven: number;              // Review 评论数
    mentoringScore: number;             // 帮助他人评分
    documentationContrib: number;       // 文档贡献数
  };

  // DORA 个人指标
  doraMetrics: {
    personalLeadTimeMs: number;
    personalDeploymentCount: number;
    personalFailureRate: number;
    personalMTTRMs: number;
  };

  // 雷达图数据
  radarData: Array<{ dimension: string; value: number }>;
}

interface ActivityRecord {
  id: string;
  developerId: string;
  type: 'commit' | 'pr' | 'review' | 'deploy' | 'incident' | 'doc';
  title: string;
  description: string;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

interface RankingEntry {
  developerId: string;
  name: string;
  team: string;
  score: number;
  rank: number;
}
```

### 3.2 DORA 下钻 API

```
Base: /api/v1/efficiency/dora
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/by-team` | 按团队查看 DORA | query: teamId, days | `{ data: TeamDora[] }` |
| GET | `/by-project` | 按项目查看 DORA | query: projectId, days | `{ data: ProjectDora[] }` |
| GET | `/by-developer` | 按个人查看 DORA | query: developerId, days | `{ data: DeveloperDora }` |
| GET | `/compare` | 维度对比 | query: dimension, ids, days | `{ data: DoraComparison[] }` |

**TeamDora 结构**:

```typescript
interface TeamDora {
  teamId: string;
  teamName: string;
  memberCount: number;
  deploymentFrequency: number;          // deploys per day
  leadTimeMs: number;
  changeFailureRate: number;            // percentage
  mttrMs: number;
  overallLevel: 'elite' | 'high' | 'medium' | 'low';
  trend: 'up' | 'down' | 'stable';
  topContributors: Array<{
    developerId: string;
    name: string;
    contributionScore: number;
  }>;
}
```

### 3.3 贡献度评估 API

```
Base: /api/v1/efficiency/contributions
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/` | 获取贡献度汇总 | query: team, period | `{ data: ContributionSummary[] }` |
| GET | `/trends` | 获取贡献趋势 | query: developerId, days | `{ data: [{ date, code, quality, collab }] }` |
| GET | `/leaderboard` | 贡献排名 | query: dimension, period, limit | `{ data: LeaderboardEntry[] }` |

**ContributionSummary 结构**:

```typescript
interface ContributionSummary {
  developerId: string;
  name: string;
  team: string;
  codeScore: number;                    // 代码贡献评分 0-100
  qualityScore: number;                 // 质量贡献评分 0-100
  collabScore: number;                  // 协作贡献评分 0-100
  overallScore: number;                 // 综合 = code×40% + quality×40% + collab×20%
  rank: number;
  period: { start: Date; end: Date };
}

interface LeaderboardEntry {
  rank: number;
  developerId: string;
  name: string;
  team: string;
  score: number;
  change: number;                       // 排名变化
}
```

### 3.4 效能瓶颈分析 API

```
Base: /api/v1/efficiency/bottlenecks
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/` | 获取瓶颈分析 | query: pipelineId, days | `BottleneckAnalysis` |
| GET | `/trends` | 获取瓶颈趋势 | query: pipelineId, days | `{ data: BottleneckTrendPoint[] }` |

**BottleneckAnalysis 结构**:

```typescript
interface BottleneckAnalysis {
  pipelineId: string;
  pipelineName: string;
  analysisPeriod: { start: Date; end: Date };

  stageBreakdown: Array<{
    stageName: string;
    avgDurationMs: number;
    p95DurationMs: number;
    failureRate: number;
    percentOfTotal: number;             // 占总时长百分比
    isBottleneck: boolean;
  }>;

  mainBottleneck: {
    stageName: string;
    reason: string;
    impactMs: number;                   // 如果优化预计节省的时间
    suggestions: string[];
  };

  efficiencyScore: number;              // 0-100, 越高越好
  trend: 'improving' | 'degrading' | 'stable';
}

interface BottleneckTrendPoint {
  date: Date;
  efficiencyScore: number;
  bottleneckStage: string;
  avgDurationMs: number;
}
```

### 3.5 Dashboard 数据接入 API

```
Base: /api/v1/efficiency/dashboard
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/scenarios` | 获取场景列表 | - | `{ data: ScenarioMeta[] }` |
| GET | `/scenarios/:id` | 获取场景数据 | query: days, filters | `EfficiencyScenario` (增强版) |
| POST | `/refresh` | 手动刷新数据 | - | `{ success, refreshedAt }` |

## 四、数据库变更

### 4.1 新增表：developer_profiles

```sql
CREATE TABLE IF NOT EXISTS developer_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  developer_id    VARCHAR(100) NOT NULL,        -- Git user ID or email
  name            VARCHAR(200),
  team            VARCHAR(200),
  role            VARCHAR(100),
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(tenant_id, developer_id)
);
CREATE INDEX idx_dev_profiles_tenant ON developer_profiles(tenant_id, team);
```

### 4.2 新增表：developer_metrics

```sql
CREATE TABLE IF NOT EXISTS developer_metrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  developer_id    VARCHAR(100) NOT NULL,
  metric_date     DATE NOT NULL,

  -- 代码贡献
  commit_count    INT DEFAULT 0,
  lines_added     INT DEFAULT 0,
  lines_deleted   INT DEFAULT 0,
  pr_count        INT DEFAULT 0,
  pr_merge_count  INT DEFAULT 0,

  -- 质量
  review_pass_rate DECIMAL(4,3),
  bugs_introduced INT DEFAULT 0,
  bugs_fixed      INT DEFAULT 0,
  test_coverage_change DECIMAL(4,3),

  -- 协作
  reviews_given   INT DEFAULT 0,
  avg_review_time_ms BIGINT,
  comments_given  INT DEFAULT 0,

  -- 计算得分
  code_score      DECIMAL(5,2),
  quality_score   DECIMAL(5,2),
  collab_score    DECIMAL(5,2),
  overall_score   DECIMAL(5,2),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(tenant_id, developer_id, metric_date)
);
CREATE INDEX idx_dev_metrics_dev ON developer_metrics(tenant_id, developer_id, metric_date DESC);
CREATE INDEX idx_dev_metrics_team ON developer_metrics(tenant_id, metric_date DESC);
```

### 4.3 新增表：developer_activities

```sql
CREATE TABLE IF NOT EXISTS developer_activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  developer_id    VARCHAR(100) NOT NULL,
  activity_type   VARCHAR(50) NOT NULL,         -- commit/pr/review/deploy/incident/doc
  title           VARCHAR(500),
  description     TEXT,
  metadata        JSONB DEFAULT '{}',
  timestamp       TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dev_activities_dev ON developer_activities(tenant_id, developer_id, timestamp DESC);
CREATE INDEX idx_dev_activities_type ON developer_activities(tenant_id, activity_type, timestamp DESC);
```

### 4.4 新增表：efficiency_snapshots

```sql
CREATE TABLE IF NOT EXISTS efficiency_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_type   VARCHAR(50) NOT NULL,          -- dora/contribution/bottleneck
  entity_type     VARCHAR(50) NOT NULL,          -- team/project/developer
  entity_id       VARCHAR(200) NOT NULL,
  snapshot_date   DATE NOT NULL,
  data            JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(tenant_id, snapshot_type, entity_type, entity_id, snapshot_date)
);
CREATE INDEX idx_eff_snapshots_tenant ON efficiency_snapshots(tenant_id, snapshot_type, snapshot_date DESC);
```

### 4.5 修改表：pipeline_runs

```sql
ALTER TABLE pipeline_runs
  ADD COLUMN IF NOT EXISTS commit_author VARCHAR(200),
  ADD COLUMN IF NOT EXISTS commit_sha VARCHAR(40),
  ADD COLUMN IF NOT EXISTS stage_durations JSONB;
```

### 4.6 迁移脚本

```sql
-- Migration 091: 效能运营增强
-- 开发者画像、DORA 下钻、贡献度评估、效能瓶颈分析
```

## 五、前端设计

### 5.1 开发者画像页面

**路由**: `/efficiency/developers/:id`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  开发者画像  张三 (前端团队)                  │
├─────────────────────────────────────────────┤
│                                              │
│  综合评分: 82/100  团队排名: #3/15            │
│  ┌────────────────────────────────────────┐  │
│  │           代码贡献: 85                  │  │
│  │        ╱          ╲                     │  │
│  │ 协作: 78            质量: 88            │  │
│  │       ╲           ╱                     │  │
│  │        ╲         ╱                      │  │
│  │         综合: 82                         │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  代码贡献 (85/100)                            │
│  ┌────────────────────────────────────────┐  │
│  │ 提交数    │ 45        │ ↑ 12%          │  │
│  │ Lines     │ +2,340/-890│                │  │
│  │ PR 数     │ 12        │ 合并率 92%     │  │
│  │ 平均 PR   │ 45 lines  │                │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  质量贡献 (88/100)                            │
│  ┌────────────────────────────────────────┐  │
│  │ PR 通过率 │ 92%       │ ↑ 3%           │  │
│  │ Bug 引入  │ 2         │ ↓ 1            │  │
│  │ Bug 修复  │ 8         │ ↑ 3            │  │
│  │ 测试覆盖  │ +2.5%     │                │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  协作贡献 (78/100)                            │
│  ┌────────────────────────────────────────┐  │
│  │ Review 次数│ 28       │ ↑ 5            │  │
│  │ 平均响应  │ 2.3h     │ ↓ 0.5h         │  │
│  │ 评论数    │ 56       │                │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  DORA 个人指标                                │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │ Lead    │ │ Deploy  │ │ Fail    │        │
│  │ Time    │ │ Freq    │ │ Rate    │        │
│  │ 4.2h    │ │ 3.2/d   │ │ 8%      │        │
│  │ [Elite] │ │ [High]  │ │ [Elite] │        │
│  └─────────┘ └─────────┘ └─────────┘        │
│                                              │
│  活动时间线                                   │
│  ┌────────────────────────────────────────┐  │
│  │ [PR] #234 添加用户画像页面  10:30       │  │
│  │ [Review] #231 评论 3 条     09:45       │  │
│  │ [Commit] fix: 修复样式问题   09:30       │  │
│  │ [Deploy] user-service v2.4   昨天       │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 5.2 团队 DORA 看板

**路由**: `/efficiency/dora/teams`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  团队 DORA 看板                              │
├─────────────────────────────────────────────┤
│  时间范围: [最近 30 天▼]                     │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ 团队      │ 等级   │ Lead │ Deploy │ CFR │  │
│  ├────────────────────────────────────────┤  │
│  │ 前端团队   │ Elite  │ 2.1h │ 5.2/d │ 4%  │  │
│  │ 后端团队   │ High   │ 4.5h │ 3.1/d │ 8%  │  │
│  │ 数据团队   │ Medium │ 12h  │ 0.8/d │ 12% │  │
│  │ 基础架构   │ High   │ 3.2h │ 4.5/d │ 6%  │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  DORA 趋势对比                                │
│  ┌────────────────────────────────────────┐  │
│  │ 📈 折线图: 各团队 Lead Time 趋势         │  │
│  │    前端  后端  数据  基础架构            │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [查看详情] [导出报告] [对比团队]             │
└─────────────────────────────────────────────┘
```

### 5.3 贡献排名页面

**路由**: `/efficiency/leaderboard`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  效能排行榜                                  │
├─────────────────────────────────────────────┤
│  维度: [● 综合] [○ 代码] [○ 质量] [○ 协作]  │
│  时间: [最近 30 天▼]  团队: [全部▼]          │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ #   │ 姓名  │ 团队   │ 综合 │ 代码 │质量│  │
│  ├────────────────────────────────────────┤  │
│  │ 🥇 1│ 李四  │ 后端   │ 92   │ 90   │95 │  │
│  │ 🥈 2│ 王五  │ 前端   │ 88   │ 92   │82 │  │
│  │ 🥉 3│ 张三  │ 前端   │ 82   │ 85   │88 │  │
│  │  4  │ 赵六  │ 数据   │ 79   │ 75   │85 │  │
│  │  5  │ 钱七  │ 后端   │ 76   │ 80   │70 │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  我的排名: #8/45  ↑2                          │
└─────────────────────────────────────────────┘
```

### 5.4 效能瓶颈分析页面

**路由**: `/efficiency/bottlenecks/:pipelineId`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  效能瓶颈  Pipeline: my-app-ci              │
├─────────────────────────────────────────────┤
│  时间范围: [最近 30 天▼]                     │
│                                              │
│  效能评分: 72/100  趋势: ⚠️ 下降              │
│                                              │
│  各环节耗时                                   │
│  ┌────────────────────────────────────────┐  │
│  │ Stage      │ 平均耗时 │ 占比 │ 失败率  │  │
│  ├────────────────────────────────────────┤  │
│  │ Checkout   │   30s   │  3%  │   0%    │  │
│  │ Install    │  2min   │ 13%  │   2%    │  │
│  │ Lint       │  45s    │  5%  │   1%    │  │
│  │ Unit Tests │  8min   │ 33%  │   3%    │  │
│  │ Integration│ 12min   │ 50%  │ ⚠️ 8%  │  │
│  │ Build      │  3min   │ 12%  │   1%    │  │
│  │ Deploy     │  2min   │  8%  │   2%    │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  主要瓶颈: Integration Tests                  │
│  ┌────────────────────────────────────────┐  │
│  │ 问题: 集成测试耗时 12min (占比 50%)      │  │
│  │ 失败率: 8% (高于平均 3%)                │  │
│  │                                          │  │
│  │ 建议:                                    │  │
│  │ 1. 并行化集成测试用例 (预估节省 5min)     │  │
│  │ 2. 使用 test fixtures 减少 DB 依赖       │  │
│  │ 3. 分离 flaky 测试到独立 stage           │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 5.5 前端文件变更

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/pages/DeveloperProfile/index.tsx` | 新建 | 开发者画像页面 |
| `src/pages/DeveloperList/index.tsx` | 新建 | 开发者列表与排名 |
| `src/pages/DoraTeamDashboard/index.tsx` | 新建 | 团队 DORA 看板 |
| `src/pages/DoraComparison/index.tsx` | 新建 | DORA 对比页面 |
| `src/pages/Leaderboard/index.tsx` | 新建 | 贡献排名页面 |
| `src/pages/BottleneckAnalysis/index.tsx` | 新建 | 效能瓶颈分析 |
| `src/api/efficiency.ts` | 修改 | 新增开发者/DORA/瓶颈 API |
| `src/components/RadarChart/index.tsx` | 新建 | 雷达图组件 |
| `src/components/StageBreakdown/index.tsx` | 新建 | Stage 耗时分解组件 |
| `src/components/ActivityTimeline/index.tsx` | 新建 | 活动时间线组件 |
| `src/pages/EfficiencyDashboard/index.tsx` | 修改 | 接入真实数据 |

## 六、测试策略

### 6.1 单元测试

| 模块 | 文件 | 测试用例 |
|------|------|----------|
| DeveloperProfileService | `services/efficiency/DeveloperProfileService.ts` | 画像构建/评分计算/趋势（15 cases） |
| ContributionCalculator | `services/efficiency/ContributionCalculator.ts` | 三维评分/权重计算/排名（12 cases） |
| BottleneckAnalyzer | `services/efficiency/BottleneckAnalyzer.ts` | Stage 分析/瓶颈识别/建议生成（10 cases） |
| DoraDrillDownService | `services/efficiency/DoraDrillDownService.ts` | 团队/项目/个人下钻/对比（10 cases） |

### 6.2 集成测试

| 场景 | 描述 |
|------|------|
| 开发者画像完整流程 | 注入 Pipeline/Git 数据 → 计算画像 → 验证评分正确 |
| DORA 下钻 | 创建多个团队/项目数据 → 验证各维度 DORA 正确计算 |
| 瓶颈分析 | 注入 Pipeline Stage 数据 → 验证瓶颈识别和建议正确 |

### 6.3 E2E 测试

| 场景 | 描述 |
|------|------|
| 开发者画像 E2E | 查看个人画像 → 切换时间范围 → 验证数据更新 |
| 团队对比 E2E | 选择两个团队 → 对比 DORA → 验证趋势图正确 |

## 七、非功能性要求

### 7.1 性能

| 指标 | 目标 |
|------|------|
| 开发者画像查询 | < 500ms（90 天数据） |
| DORA 下钻查询 | < 300ms |
| 贡献排名计算 | < 1s（100 开发者） |
| 瓶颈分析计算 | < 2s |
| 数据刷新间隔 | < 5min（定时任务） |

### 7.2 安全性

| 要求 | 实现 |
|------|------|
| 数据可见性 | 开发者画像仅本人和团队负责人可查看 |
| 排名可见性 | 团队排名仅团队内可见，跨团队排名需 admin |
| 数据隔离 | 所有查询按 tenant_id 过滤 |

### 7.3 可维护性

| 要求 | 实现 |
|------|------|
| 代码覆盖率 | > 80% |
| 评分权重 | 可配置（默认 code 40% + quality 40% + collab 20%） |
| 数据刷新 | 定时任务 + 手动触发双模式 |

## 八、实施计划

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) |
|------|:---------:|:---------:|:---------:|
| 开发者画像 | 3 | 3 | 1 |
| DORA 下钻 | 2 | 2 | 1 |
| 贡献度评估 | 2 | 1.5 | 1 |
| 效能瓶颈分析 | 1.5 | 2 | 1 |
| 真实数据接入 | 1.5 | 1 | 0.5 |
| **合计** | **10** | **9.5** | **4.5** |

---

_文档版本: v1.0 | 创建日期: 2026-05-05 | 状态: 已验证_
