# 社区生态详细规格

> **日期**: 2026-05-05
> **状态**: 编写中
> **能力域**: 11. 社区生态
> **关键交付**: 最佳实践库 (Phase 3) + 插件市场与认证体系 (Phase 4)
> **目标成熟度**: L1 → L2.5

---

## 一、功能描述

### 1.1 现状评估 (L1)

Orion 当前已实现：
- Knowledge base 模块（`orion-knowledge/`）
- Skill 管理系统（`api/skill-routes.ts`）
- 44+ 内部模块，模块化架构
- Pipeline 引擎支持自定义 Stage/Task 扩展
- 前端组件库基础（React + Ant Design）

**不足**：
- 无最佳实践知识库（Pipeline 模板、部署策略、故障处理指南）
- 无社区贡献/审核流程
- 无实践效果反馈机制
- 无与 Orion 平台的深度集成（一键应用最佳实践）
- 无插件/扩展市场
- 无外部贡献者认证体系
- 无社区贡献评分/排名
- 无模板/插件共享机制
- 无社区文档协作

### 1.2 Phase 3 目标 (L1.5) — 最佳实践库

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 最佳实践库 | 分类管理的最佳实践文档与模板 | L1.5 |
| 一键应用 | 最佳实践可直接应用到项目/Pipeline | L1.5 |
| 效果反馈 | 实践应用后的效果追踪与评分 | L1.5 |
| 社区贡献 | 用户提交/审核/发布实践 | L1.5 |

### 1.3 Phase 4 目标 (L2.5) — 插件市场与认证体系

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 插件市场 | 社区贡献的 Pipeline Stage/Task/前端插件上架与安装 | L2.5 |
| 认证体系 | 贡献者认证（Contributor/Committer/Maintainer）、技能徽章 | L2.5 |
| 质量评分 | 插件自动质量评估（测试覆盖率、安全评分、兼容性） | L2 |
| 社区协作 | 文档协作、Issue 模板、PR 模板、贡献指南 | L2 |

---

## 二、验收标准

### 2.1 Phase 3: 最佳实践库

| # | 标准 | 验证方式 |
|---|------|----------|
| CE1 | 最佳实践覆盖 5+ 领域：Pipeline 优化、部署策略、安全、监控、成本 | 前端验证 |
| CE2 | 每个实践含：描述、适用场景、实施步骤、预期效果、关联模板 | API 测试 |
| CE3 | 支持一键应用到项目（自动生成 Pipeline/配置） | 集成测试 |
| CE4 | 应用效果反馈：实施后 DORA 指标对比 | API 测试 |
| CE5 | 社区贡献流程：提交 → 审核 → 发布 → 反馈 | 集成测试 |
| CE6 | 实践按受欢迎度/效果评分排序 | API 测试 |

### 2.2 Phase 4: 插件市场

| # | 标准 | 验证方式 |
|---|------|----------|
| M1 | 支持发布插件（ZIP 包 + metadata.json） | API 测试 |
| M2 | 插件安装到租户环境，不影响已有功能 | 集成测试 |
| M3 | 插件版本管理与依赖解析 | 单元测试 |
| M4 | 插件卸载后环境恢复原状 | 集成测试 |
| M5 | 插件搜索/分类/评分/下载统计 | 前端验证 |

### 2.3 Phase 4: 认证体系

| # | 标准 | 验证方式 |
|---|------|----------|
| C1 | 贡献者等级：Contributor（1+ PR）→ Committer（5+ PR）→ Maintainer | API 测试 |
| C2 | 技能徽章：Pipeline Expert、AI Expert、DevOps Pro 等 | API 测试 |
| C3 | 徽章基于实际贡献自动授予（非手动） | 集成测试 |
| C4 | 认证信息公开（个人主页可展示） | 前端验证 |

### 2.4 Phase 4: 质量评分

| # | 标准 | 验证方式 |
|---|------|----------|
| Q1 | 插件上传自动运行安全扫描 | 集成测试 |
| Q2 | 质量评分包含：测试覆盖率、文档完整度、兼容性 | 单元测试 |
| Q3 | 低评分插件限制上架（评分 < 60 不展示） | API 测试 |

---

## 三、API 设计

### 3.1 Phase 3: 最佳实践 API

```
Base: /api/v1/community
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/practices` | 获取最佳实践列表 | query: category, sort | `{ data: BestPractice[], total }` |
| GET | `/practices/:id` | 获取实践详情 | - | `BestPractice` |
| POST | `/practices/:id/apply` | 应用到项目 | `{ projectId, config? }` | `{ applicationId, status }` |
| GET | `/practices/:id/applications` | 获取应用记录 | - | `{ data: Application[] }` |
| POST | `/practices/:id/feedback` | 提交效果反馈 | `{ metrics, rating, review }` | `{ success }` |
| POST | `/practices` | 提交新实践 | `CreatePractice` | `{ id, status }` |
| GET | `/submissions` | 获取社区提交列表 | query: status | `{ data: Submission[] }` |
| POST | `/submissions/:id/review` | 审核提交 | `{ action: 'approve'\|'reject', comment? }` | `{ success }` |

### 3.2 Phase 4: 插件市场 API

```
Base: /api/v1/community-marketplace
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/plugins` | 发布插件 | multipart: `plugin.zip` + metadata | `{ id, name, version, status }` |
| GET | `/plugins` | 插件列表 | query: category, tag, search, page, limit | `{ data: Plugin[], total }` |
| GET | `/plugins/:id` | 插件详情 | - | `{ id, name, description, versions, ratings, installs }` |
| GET | `/plugins/:id/download` | 下载插件 | - | ZIP 文件流 |
| DELETE | `/plugins/:id` | 下架插件 | - | `{ success }` |
| POST | `/plugins/:id/reviews` | 提交评价 | `{ rating: number, comment?: string }` | `{ id, rating, comment }` |

### 3.3 Phase 4: 租户插件管理 API

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/tenant-plugins/install` | 安装插件到租户 | `{ pluginId, version }` | `{ installId, status }` |
| GET | `/tenant-plugins` | 已安装插件列表 | query: tenantId | `{ data: InstalledPlugin[] }` |
| DELETE | `/tenant-plugins/:id` | 卸载插件 | - | `{ success }` |

### 3.4 Phase 4: 认证与徽章 API

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/contributors/:userId` | 贡献者信息 | - | `{ userId, level, badges, stats }` |
| GET | `/contributors/:userId/badges` | 用户徽章列表 | - | `{ data: Badge[], total }` |
| GET | `/badges` | 所有可用徽章 | - | `{ data: BadgeDefinition[] }` |
| GET | `/leaderboard` | 贡献排行榜 | query: period, category | `{ entries: ContributorRank[], total }` |

---

## 四、TypeScript 接口

### 4.1 Phase 3 接口

```typescript
interface BestPractice {
  id: string;
  title: string;
  category: string;          // 'pipeline' | 'deploy' | 'security' | 'monitoring' | 'cost'
  description: string;
  适用Scenarios: string[];
  steps: PracticeStep[];
  expectedImpact: {
    metric: string;
    improvement: string;     // '30% faster builds', '50% fewer incidents'
  }[];
  templates: {
    type: string;
    content: string;         // YAML/JSON template
  }[];
  author: string;
  rating: number;
  applicationCount: number;
  effectivenessScore: number; // 基于应用效果计算
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
}

interface PracticeStep {
  title: string;
  description: string;
  code?: string;
  config?: Record<string, unknown>;
}

interface PracticeApplication {
  id: string;
  practiceId: string;
  projectId: string;
  status: 'applied' | 'in_progress' | 'completed' | 'failed';
  config: Record<string, unknown>;
  appliedBy: string;
  appliedAt: Date;
  impactMetrics?: Record<string, unknown>;
}

interface PracticeSubmission {
  id: string;
  title: string;
  category: string;
  content: Record<string, unknown>;
  author: string;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected';
  reviewer?: string;
  reviewComment?: string;
  submittedAt: Date;
  reviewedAt?: Date;
}
```

### 4.2 Phase 4 接口

```typescript
interface Plugin {
  id: string;
  name: string;
  description: string;
  category: 'pipeline-stage' | 'pipeline-task' | 'frontend' | 'ai-model' | 'tool';
  tags: string[];
  currentVersion: string;
  versions: PluginVersion[];
  author: { userId: string; displayName: string; level: string };
  qualityScore: number;         // 0-100
  securityLevel: 'safe' | 'warning' | 'blocked';
  downloadCount: number;
  rating: number;               // 0-5
  createdAt: Date;
  updatedAt: Date;
}

interface PluginVersion {
  version: string;
  changelog: string;
  orionCompatibility: string[];  // 兼容的 Orion 版本
  publishedAt: Date;
  sizeBytes: number;
}

interface InstalledPlugin {
  id: string;
  tenantId: string;
  pluginId: string;
  pluginName: string;
  version: string;
  status: 'active' | 'disabled' | 'error';
  installedBy: string;
  installedAt: Date;
}

interface ContributorProfile {
  userId: string;
  displayName: string;
  level: 'contributor' | 'committer' | 'maintainer';
  badges: Badge[];
  stats: {
    pullRequests: number;
    issuesResolved: number;
    pluginsPublished: number;
    totalContributions: number;
  };
  joinedAt: Date;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: Date;
  category: 'pipeline' | 'ai' | 'devops' | 'community';
}

interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  criteria: string;             // 获得条件描述
  category: string;
}
```

---

## 五、数据库变更

### 5.1 Phase 3: 最佳实践表

```sql
-- Migration 111: Community Ecosystem - Best Practices
CREATE TABLE IF NOT EXISTS best_practices (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 VARCHAR(300) NOT NULL,
  category              VARCHAR(50) NOT NULL,
  description           TEXT,
  scenarios             TEXT[] DEFAULT '{}',
  steps                 JSONB DEFAULT '[]',
  expected_impact       JSONB DEFAULT '[]',
  templates             JSONB DEFAULT '[]',
  author_id             UUID REFERENCES users(id),
  rating                DECIMAL(2,1) DEFAULT 0,
  application_count     INT DEFAULT 0,
  effectiveness_score   DECIMAL(3,2),
  tags                  TEXT[] DEFAULT '{}',
  status                VARCHAR(20) DEFAULT 'published',
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_best_practices_category ON best_practices(category);
CREATE INDEX idx_best_practices_tags ON best_practices USING gin(tags);

CREATE TABLE IF NOT EXISTS practice_applications (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id           UUID NOT NULL REFERENCES best_practices(id),
  project_id            UUID NOT NULL,
  status                VARCHAR(20) DEFAULT 'applied',
  config                JSONB DEFAULT '{}',
  applied_by            UUID REFERENCES users(id),
  applied_at            TIMESTAMPTZ DEFAULT now(),
  impact_metrics        JSONB
);
CREATE INDEX idx_practice_applications_practice ON practice_applications(practice_id);

CREATE TABLE IF NOT EXISTS practice_submissions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 VARCHAR(300) NOT NULL,
  category              VARCHAR(50) NOT NULL,
  content               JSONB NOT NULL,
  author_id             UUID REFERENCES users(id),
  status                VARCHAR(20) DEFAULT 'draft',
  reviewer_id           UUID REFERENCES users(id),
  review_comment        TEXT,
  submitted_at          TIMESTAMPTZ DEFAULT now(),
  reviewed_at           TIMESTAMPTZ
);
```

### 5.2 Phase 4: 插件市场与认证表

```sql
-- Migration 118: Community Ecosystem - Plugins & Contributors
CREATE TABLE IF NOT EXISTS community_plugins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  category        VARCHAR(50) NOT NULL,
  tags            TEXT[] DEFAULT '{}',
  author_id       UUID REFERENCES users(id),
  quality_score   DECIMAL(3,1) DEFAULT 0,
  security_level  VARCHAR(20) DEFAULT 'safe',
  download_count  INT DEFAULT 0,
  rating          DECIMAL(2,1),
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_community_plugins_category ON community_plugins(category);
CREATE INDEX idx_community_plugins_status ON community_plugins(status);
CREATE INDEX idx_community_plugins_rating ON community_plugins(rating DESC);
CREATE INDEX idx_community_plugins_tags ON community_plugins USING gin(tags);

CREATE TABLE IF NOT EXISTS community_plugin_versions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id           UUID NOT NULL REFERENCES community_plugins(id) ON DELETE CASCADE,
  version             VARCHAR(50) NOT NULL,
  changelog           TEXT,
  orion_compatibility TEXT[] DEFAULT '{}',
  storage_path        VARCHAR(500) NOT NULL,
  size_bytes          BIGINT DEFAULT 0,
  published_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plugin_id, version)
);
CREATE INDEX idx_community_plugin_versions_plugin ON community_plugin_versions(plugin_id, version DESC);

CREATE TABLE IF NOT EXISTS community_plugin_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id       UUID NOT NULL REFERENCES community_plugins(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id),
  rating          INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plugin_id, user_id)
);
CREATE INDEX idx_community_plugin_reviews_plugin ON community_plugin_reviews(plugin_id);

CREATE TABLE IF NOT EXISTS community_contributor_profiles (
  user_id             UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  level               VARCHAR(20) NOT NULL DEFAULT 'contributor',
  pull_request_count  INT DEFAULT 0,
  issues_resolved     INT DEFAULT 0,
  plugins_published   INT DEFAULT 0,
  total_score         INT DEFAULT 0,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community_badges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_name      VARCHAR(100) NOT NULL,
  description     TEXT,
  icon            VARCHAR(200),
  category        VARCHAR(50) NOT NULL,
  earned_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_name)
);
CREATE INDEX idx_community_badges_user ON community_badges(user_id);
CREATE INDEX idx_community_badges_category ON community_badges(category);
```

---

## 六、前端设计

### 6.1 Phase 3: 最佳实践页面

**路由**: `/community`

```
┌─────────────────────────────────────────────┐
│  社区生态                        [提交实践]  │
├─────────────────────────────────────────────┤
│  分类: [全部] [流水线] [部署] [安全] [监控]  │
│  排序: ○ 热门  ○ 效果  ○ 最新               │
├─────────────────────────────────────────────┤
│  ┌────────────────────────────────────────┐  │
│  │ 并行构建优化  Pipeline  ⭐4.7           │  │
│  │   效果: 构建时间减少 40%                │  │
│  │   已应用: 256 次  [应用] [详情]         │  │
│  ├────────────────────────────────────────┤  │
│  │ 蓝绿部署策略  部署  ⭐4.5               │  │
│  │   效果: 部署故障减少 60%                │  │
│  │   已应用: 189 次  [应用] [详情]         │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 6.2 Phase 4: 插件市场页面

**路由**: `/community/plugins`

```
┌─────────────────────────────────────────────┐
│  社区插件市场                     [发布插件] │
├─────────────────────────────────────────────┤
│  搜索: [________________]  [搜索]           │
│  分类: [全部] [Pipeline] [前端] [AI] [工具]  │
│  排序: [热门 ▼] (热门/最新/评分)            │
├─────────────────────────────────────────────┤
│                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ K8s部署  │ │ 安全扫描 │ │ Sonar    │     │
│  │ Stage    │ │ Task     │ │ Quality  │     │
│  │ ★ 4.8    │ │ ★ 4.5    │ │ ★ 4.2    │     │
│  │ 2.3K 下载 │ 1.8K 下载 │ 956 下载 │     │
│  │ [安装]   │ │ [安装]   │ │ [安装]   │     │
│  └──────────┘ └──────────┘ └──────────┘     │
└─────────────────────────────────────────────┘
```

### 6.3 Phase 4: 贡献者主页

**路由**: `/community/contributors/:userId`

```
┌─────────────────────────────────────────────┐
│  贡献者: @dev-username                       │
├─────────────────────────────────────────────┤
│  等级: ★★ Committer                          │
│  加入: 2025-06-15                            │
│                                              │
│  贡献统计                                    │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │ PR 数量 │ │ 问题修复│ │ 插件发布│        │
│  │   23    │ │   45    │ │    3    │        │
│  └─────────┘ └─────────┘ └─────────┘        │
│                                              │
│  获得徽章                                    │
│  [🏆 Pipeline Expert] [🏆 AI Expert]         │
│  [🏆 早期贡献者] [🏆 安全卫士]               │
│                                              │
│  近期贡献                                    │
│  · 发布 K8s Deploy Stage v2.1 (2天前)        │
│  · 修复 Issue #456 (5天前)                   │
│  · PR #789 合并 (1周前)                      │
└─────────────────────────────────────────────┘
```

### 6.4 前端文件变更

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/pages/Community/index.tsx` | 新建 | 社区生态主页面（最佳实践列表） |
| `src/pages/Community/PluginMarket.tsx` | 新建 | 插件市场页面 |
| `src/pages/Community/PluginDetail.tsx` | 新建 | 插件详情页面 |
| `src/pages/Community/ContributorProfile.tsx` | 新建 | 贡献者主页 |
| `src/pages/Community/Leaderboard.tsx` | 新建 | 贡献排行榜 |
| `src/pages/Community/InstalledPlugins.tsx` | 新建 | 已安装插件管理 |
| `src/pages/PracticeDetail/index.tsx` | 新建 | 实践详情页面 |
| `src/components/PracticeCard/index.tsx` | 新建 | 实践卡片组件 |
| `src/components/PluginCard/index.tsx` | 新建 | 插件卡片组件 |
| `src/components/BadgeDisplay/index.tsx` | 新建 | 徽章展示组件 |
| `src/components/QualityScore/index.tsx` | 新建 | 质量评分组件 |
| `src/api/community.ts` | 新建 | 社区 API 调用 |

---

## 七、测试策略

### 7.1 Phase 3 测试

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 10 | PracticeService、EffectivenessScorer、SubmissionWorkflow |
| 集成测试 | 3 | 提交→审核→发布→应用→反馈完整流程 |

### 7.2 Phase 4 测试

| 类型 | 模块 | 用例数 |
|------|------|:------:|
| 单元测试 | PluginService（CRUD/安装/卸载） | 12 |
| 单元测试 | QualityScorer（评分算法） | 8 |
| 单元测试 | BadgeEngine（徽章授予逻辑） | 10 |
| 单元测试 | LevelCalculator（等级计算） | 6 |
| 集成测试 | 插件发布 → 审核 → 上架 | 2 |
| 集成测试 | 插件安装 → 使用 → 卸载 | 2 |
| E2E 测试 | 浏览插件市场 → 查看详情 → 安装 | 2 |

---

## 八、非功能性要求

| 维度 | 要求 |
|------|------|
| 性能 | 实践库加载 < 500ms；插件列表加载 < 500ms（100 插件） |
| 一键应用 | < 10s |
| 安全 | 插件上传自动安全扫描（依赖漏洞、恶意代码检测） |
| 安全 | 插件沙箱执行，限制文件系统/网络访问 |
| 存储 | 单个插件包限制 50MB |
| 审核流程 | 状态机驱动，审计日志完整 |
| 可维护性 | 代码覆盖率 > 75% |
| 可用性 | 插件市场 SLO 99.5% |

---

## 九、实施计划

### 9.1 Phase 3: 最佳实践库

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) |
|------|:---------:|:---------:|:---------:|
| 最佳实践库 | 2 | 3 | 1 |
| 一键应用 | 2 | 1 | 1 |
| 效果反馈 | 1 | 1 | 0.5 |
| 社区贡献 | 1 | 1 | 1 |
| **小计** | **6** | **6** | **3.5** |

### 9.2 Phase 4: 插件市场与认证体系

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) |
|------|:---------:|:---------:|:---------:|
| 插件市场 | 6 | 4 | 2 |
| 认证体系 | 4 | 2 | 1.5 |
| 质量评分 | 3 | 1 | 1 |
| **小计** | **13** | **7** | **4.5** |

> 注：Phase 4 需要额外的安全审计流程，插件上架前需通过自动化安全扫描。

---

_文档版本: v2.0 | 创建日期: 2026-05-05 | 最后更新: 2026-06-26 | 状态: 编写中_
_合并自: 03-community-ecosystem-spec.md (Phase 3) + 11-community-ecosystem-spec.md (Phase 4)_
