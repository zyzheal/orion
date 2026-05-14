# 社区生态详细规格 (Phase 4)

> **日期**: 2026-05-05
> **状态**: 概念探索
> **能力域**: 3. 社区生态 (Community Ecosystem)
> **目标成熟度**: L1.5 → L2.5
> **关键交付**: 插件市场、认证体系、贡献者激励

## 一、功能描述

### 1.1 现状评估 (L1.5)

Orion 当前已实现：
- 44+ 内部模块，模块化架构
- Pipeline 引擎支持自定义 Stage/Task 扩展
- 前端组件库基础（React + Ant Design）
- 知识库集成（orion-knowledge）

**不足**：
- 无插件/扩展市场
- 无外部贡献者认证体系
- 无社区贡献评分/排名
- 无模板/插件共享机制
- 无社区文档协作

### 1.2 Phase 4 目标 (L2.5) — 长期愿景

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 插件市场 | 社区贡献的 Pipeline Stage/Task/前端插件上架与安装 | L2.5 |
| 认证体系 | 贡献者认证（Contributor/Committer/Maintainer）、技能徽章 | L2.5 |
| 质量评分 | 插件自动质量评估（测试覆盖率、安全评分、兼容性） | L2 |
| 社区协作 | 文档协作、Issue 模板、PR 模板、贡献指南 | L2 |

## 二、验收标准

### 2.1 插件市场

| # | 标准 | 验证方式 |
|---|------|----------|
| M1 | 支持发布插件（ZIP 包 + metadata.json） | API 测试 |
| M2 | 插件安装到租户环境，不影响已有功能 | 集成测试 |
| M3 | 插件版本管理与依赖解析 | 单元测试 |
| M4 | 插件卸载后环境恢复原状 | 集成测试 |
| M5 | 插件搜索/分类/评分/下载统计 | 前端验证 |

### 2.2 认证体系

| # | 标准 | 验证方式 |
|---|------|----------|
| C1 | 贡献者等级：Contributor（1+ PR）→ Committer（5+ PR）→ Maintainer | API 测试 |
| C2 | 技能徽章：Pipeline Expert、AI Expert、DevOps Pro 等 | API 测试 |
| C3 | 徽章基于实际贡献自动授予（非手动） | 集成测试 |
| C4 | 认证信息公开（个人主页可展示） | 前端验证 |

### 2.3 质量评分

| # | 标准 | 验证方式 |
|---|------|----------|
| Q1 | 插件上传自动运行安全扫描 | 集成测试 |
| Q2 | 质量评分包含：测试覆盖率、文档完整度、兼容性 | 单元测试 |
| Q3 | 低评分插件限制上架（评分 < 60 不展示） | API 测试 |

## 三、API 设计

```
Base: /api/v1/community-marketplace
```

### 3.1 插件市场 API

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/plugins` | 发布插件 | multipart: `plugin.zip` + metadata | `{ id, name, version, status }` |
| GET | `/plugins` | 插件列表 | query: category, tag, search, page, limit | `{ data: Plugin[], total }` |
| GET | `/plugins/:id` | 插件详情 | - | `{ id, name, description, versions, ratings, installs }` |
| GET | `/plugins/:id/download` | 下载插件 | - | ZIP 文件流 |
| DELETE | `/plugins/:id` | 下架插件 | - | `{ success }` |
| POST | `/plugins/:id/reviews` | 提交评价 | `{ rating: number, comment?: string }` | `{ id, rating, comment }` |

### 3.2 租户插件管理 API

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/tenant-plugins/install` | 安装插件到租户 | `{ pluginId, version }` | `{ installId, status }` |
| GET | `/tenant-plugins` | 已安装插件列表 | query: tenantId | `{ data: InstalledPlugin[] }` |
| DELETE | `/tenant-plugins/:id` | 卸载插件 | - | `{ success }` |

### 3.3 认证与徽章 API

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/contributors/:userId` | 贡献者信息 | - | `{ userId, level, badges, stats }` |
| GET | `/contributors/:userId/badges` | 用户徽章列表 | - | `{ data: Badge[], total }` |
| GET | `/badges` | 所有可用徽章 | - | `{ data: BadgeDefinition[] }` |
| GET | `/leaderboard` | 贡献排行榜 | query: period, category | `{ entries: ContributorRank[], total }` |

### 3.4 TypeScript 接口

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

## 四、数据库变更

### 4.1 新增表：community_plugins

```sql
-- Migration 118: Community ecosystem - plugins & contributors
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
```

### 4.2 新增表：community_plugin_versions

```sql
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
```

### 4.3 新增表：community_plugin_reviews

```sql
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
```

### 4.4 新增表：community_contributor_profiles

```sql
CREATE TABLE IF NOT EXISTS community_contributor_profiles (
  user_id             UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  level               VARCHAR(20) NOT NULL DEFAULT 'contributor',
  pull_request_count  INT DEFAULT 0,
  issues_resolved     INT DEFAULT 0,
  plugins_published   INT DEFAULT 0,
  total_score         INT DEFAULT 0,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 4.5 新增表：community_badges

```sql
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

## 五、前端设计

### 5.1 插件市场页面

**路由**: `/community/plugins`

**页面结构**:
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

### 5.2 贡献者主页

**路由**: `/community/contributors/:userId`

**页面结构**:
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

### 5.3 前端文件变更

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/pages/Community/PluginMarket.tsx` | 新建 | 插件市场页面 |
| `src/pages/Community/PluginDetail.tsx` | 新建 | 插件详情页面 |
| `src/pages/Community/ContributorProfile.tsx` | 新建 | 贡献者主页 |
| `src/pages/Community/Leaderboard.tsx` | 新建 | 贡献排行榜 |
| `src/pages/Community/InstalledPlugins.tsx` | 新建 | 已安装插件管理 |
| `src/api/community.ts` | 新建 | API 客户端 |
| `src/components/PluginCard/index.tsx` | 新建 | 插件卡片组件 |
| `src/components/BadgeDisplay/index.tsx` | 新建 | 徽章展示组件 |
| `src/components/QualityScore/index.tsx` | 新建 | 质量评分组件 |

## 六、测试策略

| 类型 | 模块 | 用例数 |
|------|------|:------:|
| 单元测试 | PluginService（CRUD/安装/卸载） | 12 |
| 单元测试 | QualityScorer（评分算法） | 8 |
| 单元测试 | BadgeEngine（徽章授予逻辑） | 10 |
| 单元测试 | LevelCalculator（等级计算） | 6 |
| 集成测试 | 插件发布 → 审核 → 上架 | 2 |
| 集成测试 | 插件安装 → 使用 → 卸载 | 2 |
| E2E 测试 | 浏览插件市场 → 查看详情 → 安装 | 2 |

## 七、非功能性要求

| 维度 | 要求 |
|------|------|
| 性能 | 插件列表加载 < 500ms（100 插件） |
| 安全 | 插件上传自动安全扫描（依赖漏洞、恶意代码检测） |
| 安全 | 插件沙箱执行，限制文件系统/网络访问 |
| 存储 | 单个插件包限制 50MB |
| 可维护性 | 代码覆盖率 > 75% |
| 可用性 | 插件市场 SLO 99.5% |

## 八、实施计划

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) |
|------|:---------:|:---------:|:---------:|
| 插件市场 | 6 | 4 | 2 |
| 认证体系 | 4 | 2 | 1.5 |
| 质量评分 | 3 | 1 | 1 |
| **合计** | **13** | **7** | **4.5** |

> 注：需要额外的安全审计流程，插件上架前需通过自动化安全扫描。

---

_文档版本: v1.0 | 创建日期: 2026-05-05 | 状态: 概念探索_
