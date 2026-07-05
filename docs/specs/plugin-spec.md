# Spec: 插件市场 (Plugin)

> **日期**: 2026-07-03
> **状态**: 编写中
> **能力域**: 插件生态
> **目标成熟度**: L1 → L2
> **关键交付**: 插件注册、版本管理、评分评论、安装卸载、沙箱运行

## 一、功能描述

### 1.1 现状评估 (L1)

Orion 当前已实现（Go 微服务 `orion-plugin-svc-go`）：
- 插件 CRUD（PluginService + Repository）
- 插件元数据（name/version/description/author）
- 插件状态管理（enabled/disabled）
- 多租户隔离
- OpenTelemetry 追踪

**不足**：
- 无插件版本管理
- 无插件评分/评论
- 无插件安装/卸载
- 无插件沙箱隔离
- 无插件市场门户
- 无插件依赖管理
- 无插件统计数据
- 无插件审批流程

### 1.2 Phase 1 目标 (L2)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 版本管理 | 多版本共存、版本对比 | L2 |
| 评分评论 | 用户评分+评论+回复 | L2 |
| 安装卸载 | 插件安装到命名空间/卸载 | L2 |
| 沙箱运行 | 插件隔离执行、资源限制 | L2.5 |
| 市场门户 | 分类浏览、搜索、推荐 | L2 |
| 统计 | 安装量/评分/活跃度 | L2 |

## 二、验收标准

### 2.1 插件管理

| # | 标准 | 验证方式 |
|---|------|----------|
| PL1 | 支持注册插件（name/version/description/category/author） | API 测试 |
| PL2 | 插件分类：integration/tool/extension/theme/workflow | API 测试 |
| PL3 | 插件含 manifest（入口文件/权限/依赖） | API 测试 |
| PL4 | 插件可启用/禁用 | API 测试 |
| PL5 | 插件状态：registered/published/unpublished/banned | API 测试 |
| PL6 | 多租户隔离 | 集成测试 |
| PL7 | 插件删除需确认（防止误删已安装插件） | API 测试 |

### 2.2 版本管理

| # | 标准 | 验证方式 |
|---|------|----------|
| PL8 | 同一插件支持多版本共存 | API 测试 |
| PL9 | 版本号遵循 SemVer（major.minor.patch） | API 测试 |
| PL10 | 版本发布需填写 changelog | API 测试 |
| PL11 | 版本下架（不影响已安装用户） | API 测试 |
| PL12 | 版本兼容性标记（requires >= x.y.z） | API 测试 |
| PL13 | 版本列表 + 下载量统计 | API 测试 |

### 2.3 评分与评论

| # | 标准 | 验证方式 |
|---|------|----------|
| PL14 | 用户可对插件评分（1-5星） | API 测试 |
| PL15 | 平均评分实时计算 | API 测试 |
| PL16 | 用户可写评论 | API 测试 |
| PL17 | 评论支持回复 | API 测试 |
| PL18 | 评论/评分需在安装后 | API 测试 |
| PL19 | 评论可标记为有用/无用 | API 测试 |
| PL20 | 评分分布图（1-5星各数量） | 前端验证 |

### 2.4 安装与卸载

| # | 标准 | 验证方式 |
|---|------|----------|
| PL21 | 支持安装插件到命名空间（namespace 隔离） | API 测试 |
| PL22 | 安装时检查依赖是否满足 | API 测试 |
| PL23 | 安装失败自动回滚 | API 测试 |
| PL24 | 支持卸载插件 | API 测试 |
| PL25 | 卸载时检查是否有其他插件依赖 | API 测试 |
| PL26 | 安装/卸载记录审计日志 | 单元测试 |
| PL27 | 已安装插件列表查询 | API 测试 |

### 2.5 沙箱运行

| # | 标准 | 验证方式 |
|---|------|----------|
| PL28 | 插件在独立命名空间运行 | 集成测试 |
| PL29 | 插件资源限制：CPU/内存/超时 | API 测试 |
| PL30 | 插件只能访问声明的权限 | 集成测试 |
| PL31 | 插件异常不崩溃宿主 | 集成测试 |
| PL32 | 插件执行超时自动终止 | API 测试 |
| PL33 | 插件日志隔离 | 单元测试 |

### 2.6 统计与市场

| # | 标准 | 验证方式 |
|---|------|----------|
| PL34 | 插件安装量统计 | API 测试 |
| PL35 | 插件活跃度（每周/每月活跃安装） | API 测试 |
| PL36 | 按分类统计安装量 | API 测试 |
| PL37 | 市场页面：分类浏览 + 搜索 + 推荐 | 前端验证 |
| PL38 | 插件详情页：描述/评分/安装量/版本 | 前端验证 |
| PL39 | 插件审批：发布前需审批 | API 测试 |

## 三、API 设计

```
Base: /api/v1/plugins
```

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/` | 注册插件 |
| GET | `/` | 插件列表（市场） |
| GET | `/:id` | 插件详情 |
| PUT | `/:id` | 更新插件 |
| DELETE | `/:id` | 删除插件 |
| POST | `/:id/publish` | 发布插件 |
| POST | `/:id/unpublish` | 下架插件 |
| POST | `/versions` | 发布版本 |
| GET | `/:id/versions` | 版本列表 |
| POST | `/:id/install` | 安装插件 |
| POST | `/:id/uninstall` | 卸载插件 |
| GET | `/installed` | 已安装列表 |
| POST | `/:id/reviews` | 写评论 |
| GET | `/:id/reviews` | 评论列表 |
| POST | `/:id/rate` | 评分 |
| GET | `/statistics` | 统计 |
| GET | `/categories` | 分类列表 |
| POST | `/search` | 搜索 |

## 四、数据模型

```sql
-- 插件
CREATE TABLE IF NOT EXISTS plugins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  name            VARCHAR(200) NOT NULL,
  slug            VARCHAR(200) NOT NULL,
  description     TEXT,
  category        VARCHAR(50),
  author_id       UUID REFERENCES users(id),
  status          VARCHAR(20) DEFAULT 'registered',
  manifest        JSONB DEFAULT '{}',
  homepage        TEXT,
  repository_url  TEXT,
  license         VARCHAR(50),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, slug)
);

-- 插件版本
CREATE TABLE IF NOT EXISTS plugin_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id       UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  version         VARCHAR(50) NOT NULL,
  changelog       TEXT,
  download_url    TEXT NOT NULL,
  dependencies    JSONB DEFAULT '[]',
  size_bytes      BIGINT,
  download_count  INT DEFAULT 0,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(plugin_id, version)
);

-- 插件安装
CREATE TABLE IF NOT EXISTS plugin_installations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  plugin_id       UUID NOT NULL REFERENCES plugins(id),
  version         VARCHAR(50) NOT NULL,
  namespace       VARCHAR(100) NOT NULL,
  status          VARCHAR(20) DEFAULT 'installed',
  installed_by    UUID REFERENCES users(id),
  installed_at    TIMESTAMPTZ DEFAULT now(),
  last_used_at    TIMESTAMPTZ,
  UNIQUE(tenant_id, plugin_id, namespace)
);

-- 评论
CREATE TABLE IF NOT EXISTS plugin_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id       UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id),
  rating          INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title           VARCHAR(200),
  content         TEXT,
  parent_id       UUID REFERENCES plugin_reviews(id),
  helpful_count   INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(plugin_id, user_id)
);

CREATE INDEX idx_plugins_tenant ON plugins(tenant_id, status);
CREATE INDEX idx_plugins_category ON plugins(category);
CREATE INDEX idx_plugin_versions_plugin ON plugin_versions(plugin_id);
CREATE INDEX idx_plugin_installations_tenant ON plugin_installations(tenant_id);
```

## 五、前端设计

**路由**: `/plugin-market`

主要页面：
- 市场首页：分类浏览 + 搜索 + 推荐
- 插件详情页：描述/评分/评论/安装
- 插件管理页：已安装列表/升级/卸载
- 发布页：注册插件 + 发布版本
- 评论管理页：用户评论 + 评分
- 统计页：安装量/评分分布

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 20 | PluginService、VersionService、ReviewService |
| 集成测试 | 6 | 注册→发布→安装→评分→评论→卸载闭环 |
| 前端测试 | 4 | 市场浏览、安装、评论、管理 |

---
_文档版本: v1.0 | 创建日期: 2026-07-03 | 状态: 编写中_
