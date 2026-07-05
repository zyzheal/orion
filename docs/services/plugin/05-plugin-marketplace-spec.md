# 插件市场详细规格 (Phase 3)

> **日期**: 2026-05-05
> **状态**: 实施中
> **能力域**: 5. 插件市场
> **目标成熟度**: L2 → L2.5
> **关键交付**: 插件目录、评分系统

## 一、功能描述

### 1.1 现状评估 (L2)

Orion 当前已具备：
- Plugin 服务（`services/plugin/`）：PluginSandbox、PluginAuditLogger、PluginResourceManager
- Plugin SPI API（`api/plugin-spi-routes.ts`）
- Plugin 管理 API（`api/routes.ts` 注册于 `/v1/plugins`）
- 资源配额与安全等级（HIGH/MEDIUM/LOW）
- Sandbox 执行环境

**不足**：
- 无插件目录/市场（无法发现和安装第三方插件）
- 无用户评分/评论系统
- 无插件版本管理/依赖管理
- 无插件安装/卸载/升级流程

### 1.2 Phase 3 目标 (L2.5)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 插件目录 | 可浏览/搜索/筛选的插件市场 | L2.5 |
| 评分系统 | 用户评分、评论、使用统计 | L2.5 |
| 插件安装 | 一键安装/卸载/升级插件 | L2.5 |
| 插件依赖 | 插件间依赖关系管理 | L2.5 |

## 二、验收标准

| # | 标准 | 验证方式 |
|---|------|----------|
| P1 | 插件目录支持搜索、分类筛选、排序（热门/最新/评分） | 前端验证 |
| P2 | 每个插件含：描述、版本、作者、评分、安装数、依赖列表 | API 测试 |
| P3 | 用户可评分（1-5 星）和发表评论 | API 测试 |
| P4 | 插件安装自动处理依赖（递归安装） | 集成测试 |
| P5 | 插件升级：检查兼容性、数据迁移、回滚 | 集成测试 |
| P6 | 插件卸载：清理资源、依赖检查（是否有其他插件依赖） | 集成测试 |
| P7 | 安装/卸载操作写入审计日志 | 单元测试 |

## 三、API 设计

```
Base: /api/v1/marketplace
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/plugins` | 获取插件目录 | query: search, category, sort | `{ data: MarketplacePlugin[], total }` |
| GET | `/plugins/:pluginId` | 获取插件详情 | - | `MarketplacePlugin` |
| POST | `/plugins/:pluginId/install` | 安装插件 | `{ version?, config? }` | `{ installationId, status }` |
| POST | `/plugins/:pluginId/uninstall` | 卸载插件 | `{ force?: boolean }` | `{ success }` |
| POST | `/plugins/:pluginId/upgrade` | 升级插件 | `{ targetVersion? }` | `{ installationId, status }` |
| POST | `/plugins/:pluginId/rate` | 评分 | `{ rating: number, review?: string }` | `{ success }` |
| GET | `/plugins/:pluginId/reviews` | 获取评论 | query: page, limit | `{ data: Review[], total }` |
| GET | `/installations` | 获取已安装插件 | - | `{ data: PluginInstallation[] }` |
| GET | `/categories` | 获取分类列表 | - | `{ data: Category[] }` |

```typescript
interface MarketplacePlugin {
  id: string;
  name: string;
  displayName: string;
  description: string;
  version: string;
  category: string;
  tags: string[];
  author: string;
  icon: string;
  readme: string;
  rating: number;           // 平均评分
  ratingCount: number;      // 评分数
  installCount: number;     // 安装数
  dependencies: PluginDependency[];
  compatibility: { minOrionVersion: string; maxOrionVersion?: string };
  permissions: string[];    // 所需权限
  createdAt: Date;
  updatedAt: Date;
}

interface PluginDependency {
  pluginId: string;
  name: string;
  versionRange: string;     // semver range: "^1.0.0"
  optional: boolean;
}

interface PluginInstallation {
  id: string;
  pluginId: string;
  pluginName: string;
  version: string;
  status: 'installing' | 'active' | 'error' | 'upgrading';
  config: Record<string, unknown>;
  installedBy: string;
  installedAt: Date;
  updatedAt: Date;
}

interface Review {
  id: string;
  pluginId: string;
  userId: string;
  userName: string;
  rating: number;           // 1-5
  review: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## 四、数据库变更

```sql
-- Migration 105: Plugin Marketplace
CREATE TABLE IF NOT EXISTS marketplace_plugins (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  VARCHAR(200) NOT NULL UNIQUE,
  display_name          VARCHAR(200),
  description           TEXT,
  version               VARCHAR(50) NOT NULL,
  category              VARCHAR(50),
  tags                  TEXT[] DEFAULT '{}',
  author                VARCHAR(100),
  icon_url              VARCHAR(500),
  readme                TEXT,
  rating                DECIMAL(2,1) DEFAULT 0,
  rating_count          INT DEFAULT 0,
  install_count         INT DEFAULT 0,
  dependencies          JSONB DEFAULT '[]',
  compatibility         JSONB DEFAULT '{}',
  permissions           TEXT[] DEFAULT '{}',
  package_url           VARCHAR(500),
  checksum              VARCHAR(64),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_marketplace_plugins_category ON marketplace_plugins(category);
CREATE INDEX idx_marketplace_plugins_tags ON marketplace_plugins USING gin(tags);

CREATE TABLE IF NOT EXISTS plugin_installations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  plugin_id             UUID NOT NULL REFERENCES marketplace_plugins(id),
  version               VARCHAR(50) NOT NULL,
  status                VARCHAR(20) DEFAULT 'installing',
  config                JSONB DEFAULT '{}',
  installed_by          UUID REFERENCES users(id),
  installed_at          TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),

  UNIQUE(tenant_id, plugin_id)
);
CREATE INDEX idx_plugin_installations_tenant ON plugin_installations(tenant_id);

CREATE TABLE IF NOT EXISTS plugin_reviews (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id             UUID NOT NULL REFERENCES marketplace_plugins(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES users(id),
  rating                INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review                TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
    updated_at            TIMESTAMPTZ DEFAULT now(),

  UNIQUE(plugin_id, user_id)
);
CREATE INDEX idx_plugin_reviews_plugin ON plugin_reviews(plugin_id, created_at DESC);
```

## 五、前端设计

**路由**: `/marketplace`

```
┌─────────────────────────────────────────────┐
│  插件市场                                    │
├─────────────────────────────────────────────┤
│  搜索: [___________________]  分类: [全部▼] │
│  排序: ○ 热门  ○ 最新  ○ 评分               │
├─────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ SonarQube│ │ Slack    │ │ Docker   │     │
│  │ 集成     │ │ 通知     │ │ 构建     │     │
│  │ ⭐4.8(128)│ │ ⭐4.5(96)│ │ ⭐4.3(64)│     │
│  │ 12k 安装 │ │ 8.5k 安装│ │ 5.2k 安装│     │
│  │ [安装]   │ │ [安装]   │ │ [已安装] │     │
│  └──────────┘ └──────────┘ └──────────┘     │
│                                              │
│  [已安装插件]  12 个插件正在运行              │
└─────────────────────────────────────────────┘
```

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/pages/Marketplace/index.tsx` | 新建 | 插件市场主页面 |
| `src/pages/MarketplaceDetail/index.tsx` | 新建 | 插件详情页面 |
| `src/components/PluginCard/index.tsx` | 新建 | 插件卡片组件 |
| `src/components/StarRating/index.tsx` | 新建 | 评分组件 |
| `src/api/marketplace.ts` | 新建 | 插件市场 API |

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 15 | MarketplaceService、DependencyResolver、ReviewService |
| 集成测试 | 6 | 安装→依赖解析→配置→运行完整流程 |
| E2E 测试 | 4 | 浏览→搜索→安装→评分完整流程 |

## 七、非功能性要求

| 指标 | 目标 |
|------|------|
| 插件目录加载 | < 500ms |
| 安装/卸载 | < 30s |
| 依赖解析 | < 2s（最大深度 5） |
| 插件包校验 | SHA-256 checksum 验证 |

## 八、实施计划

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) |
|------|:---------:|:---------:|:---------:|
| 插件目录 | 2 | 3 | 1 |
| 评分系统 | 2 | 2 | 1 |
| 安装/卸载 | 3 | 1 | 2 |
| 依赖管理 | 2 | - | 1 |
| **合计** | **9** | **6** | **5** |

---

_文档版本: v1.0 | 创建日期: 2026-05-05_
