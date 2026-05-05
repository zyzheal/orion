# 开发者门户详细规格 (Phase 1)

> **日期**: 2026-05-05
> **状态**: 编写中
> **能力域**: 5. 开发者门户
> **目标成熟度**: L1 → L1.5
> **关键交付**: 统一文档中心、模板库

## 一、功能描述

### 1.1 现状评估 (L1)

Orion 当前状态：
- 无独立开发者门户页面
- 功能分散在各独立页面（Pipeline、Build、Deploy、Environment 等）
- 无统一文档中心
- 无快速开始/新手引导
- 无平台状态总览（Dashboard 有，但非面向开发者视角）
- 模板能力仅在 Pipeline 层面有基础支持（TemplateService 尚未实现）

**L1 定义**：基础功能可用，手动操作为主。Orion 已有各功能模块，但缺乏统一入口和体验整合。

### 1.2 Phase 1 目标 (L1.5)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 统一文档中心 | 平台文档、API 文档、最佳实践、FAQ 聚合 | L1.5 |
| 模板库 | 从各功能模块聚合模板（Pipeline/Environment/Build） | L1.5 |
| 状态总览 | 开发者视角的平台状态概览 | L1.5 |
| 快速开始 | 新手引导流程（5 步完成首次 Pipeline 创建到部署） | L1.5 |

## 二、验收标准

### 2.1 统一文档中心

| # | 标准 | 验证方式 |
|---|------|----------|
| D1 | 文档分类导航（入门指南/API 参考/最佳实践/FAQ） | 前端验证 |
| D2 | 文档搜索（全文搜索，支持标题/内容匹配） | 前端验证 |
| D3 | API 文档自动生成（从 OpenAPI/Swagger schema） | API 测试 |
| D4 | 文档版本关联（文档与平台版本对应） | 前端验证 |
| D5 | 文档支持 Markdown 渲染 | 前端验证 |

### 2.2 模板库

| # | 标准 | 验证方式 |
|---|------|----------|
| T1 | 模板分类展示（Pipeline/Environment/Build） | 前端验证 |
| T2 | 模板搜索和过滤（按分类/标签/语言） | 前端验证 |
| T3 | 模板详情展示（描述/参数/使用次数/评分） | 前端验证 |
| T4 | 模板一键使用（跳转到对应创建页面并预填参数） | 前端 + API 测试 |
| T5 | 热门模板推荐（按使用次数排序） | 前端验证 |

### 2.3 状态总览

| # | 标准 | 验证方式 |
|---|------|----------|
| S1 | 个人工作区（我的 Pipeline、我的环境、我的构建） | 前端验证 |
| S2 | 最近活动（最近 Run、最近 Deploy、最近 Build） | 前端验证 |
| S3 | 快捷操作（创建 Pipeline、触发构建、创建环境） | 前端验证 |
| S4 | 平台健康状态（系统状态、服务可用性） | 前端验证 |

### 2.4 快速开始

| # | 标准 | 验证方式 |
|---|------|----------|
| Q1 | 首次访问显示引导弹窗（5 步骤） | 前端验证 |
| Q2 | Step 1：连接 Git 仓库 | 前端 + API 测试 |
| Q3 | Step 2：选择/创建 Pipeline 模板 | 前端验证 |
| Q4 | Step 3：触发首次构建 | 前端 + API 测试 |
| Q5 | Step 4：查看构建结果 | 前端验证 |
| Q6 | Step 5：部署到临时环境 | 前端 + API 测试 |
| Q7 | 完成后可跳过（localStorage 记录） | 前端验证 |

## 三、API 设计

### 3.1 文档中心 API

```
Base: /api/v1/developer-portal/docs
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/` | 获取文档列表 | query: category, search, page | `{ data: Doc[], total }` |
| GET | `/categories` | 获取文档分类 | - | `{ categories: [{ id, name, count }] }` |
| GET | `/:id` | 获取文档详情 | - | `{ id, title, content, category, updatedAt }` |
| GET | `/search` | 全文搜索文档 | query: q | `{ results: [{ id, title, snippet }] }` |

### 3.2 模板聚合 API

```
Base: /api/v1/developer-portal/templates
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/` | 获取聚合模板列表 | query: type, category, search | `{ data: AggregatedTemplate[], total }` |
| GET | `/popular` | 获取热门模板 | query: limit | `{ data: AggregatedTemplate[] }` |
| GET | `/:id` | 获取模板详情 | - | `{ id, type, name, description, parameters, usageCount }` |

**AggregatedTemplate 结构**:

```typescript
interface AggregatedTemplate {
  id: string;
  type: 'pipeline' | 'environment' | 'build';  // 模板类型
  name: string;
  description: string;
  category: string;                              // 'language' | 'platform' | 'custom'
  tags: string[];
  parameters: { name: string; type: string; defaultValue?: string; required: boolean }[];
  usageCount: number;
  rating?: number;
  createdBy: string;
  createdAt: Date;
}
```

### 3.3 开发者状态 API

```
Base: /api/v1/developer-portal/developer-status
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/` | 获取开发者状态 | query: userId | `{ myPipelines, myEnvironments, recentActivity, quickActions, platformHealth }` |

**DeveloperStatus 结构**:

```typescript
interface DeveloperStatus {
  myPipelines: { id: string; name: string; lastRunStatus: string; lastRunAt: Date }[];
  myEnvironments: { id: string; namespace: string; status: string; previewUrl?: string }[];
  recentActivity: { type: string; description: string; timestamp: Date; link: string }[];
  quickActions: { id: string; label: string; icon: string; route: string }[];
  platformHealth: {
    overall: 'healthy' | 'degraded' | 'down';
    services: { name: string; status: string; latency?: number }[];
  };
}
```

## 四、数据库变更

### 4.1 新增表：portal_documents

```sql
CREATE TABLE IF NOT EXISTS portal_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title           VARCHAR(500) NOT NULL,
  content         TEXT NOT NULL,
  category        VARCHAR(50) NOT NULL,               -- 'getting-started', 'api-reference', 'best-practices', 'faq'
  tags            TEXT[] DEFAULT '{}',
  version         VARCHAR(20),
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_portal_documents_tenant ON portal_documents(tenant_id);
CREATE INDEX idx_portal_documents_category ON portal_documents(category);
CREATE INDEX idx_portal_documents_tags ON portal_documents USING gin(tags);
CREATE INDEX idx_portal_documents_search ON portal_documents USING gin(to_tsvector('simple', title || ' ' || content));
```

### 4.2 迁移脚本

```sql
-- Migration 084: Developer portal
-- Document center, template aggregation, developer status
```

## 五、前端设计

### 5.1 开发者门户首页

**路由**: `/developer-portal`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  开发者门户                    [文档] [模板]  │
├─────────────────────────────────────────────┤
│                                              │
│  欢迎回来, Developer!                        │
│                                              │
│  我的工作区                                   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │ 我的     │ │ 我的     │ │ 最近     │        │
│  │ Pipelines│ │ 环境    │ │ 构建     │        │
│  │  3 个   │ │  2 个   │ │  5 个   │        │
│  │ [查看]  │ │ [查看]  │ │ [查看]  │        │
│  └─────────┘ └─────────┘ └─────────┘        │
│                                              │
│  快捷操作                                     │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐           │
│  │ ➕   │ │ 🔨  │ │ 🚀  │ │ 🌍  │           │
│  │ 创建  │ │ 构建  │ │ 部署  │ │ 环境  │           │
│  │ Pipeline│ │     │ │     │ │     │           │
│  └─────┘ └─────┘ └─────┘ └─────┘           │
│                                              │
│  推荐模板                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ Node.js  │ │ Go Build │ │ Docker   │     │
│  │ Pipeline │ │ Pipeline │ │ Deploy   │     │
│  │ ⭐ 4.5   │ │ ⭐ 4.2   │ │ ⭐ 4.1   │     │
│  │ [使用]   │ │ [使用]   │ │ [使用]   │     │
│  └──────────┘ └──────────┘ └──────────┘     │
│                                              │
│  平台状态                                     │
│  ┌────────────────────────────────────────┐  │
│  │ 整体: 🟢 健康                            │  │
│  │ Pipeline Engine: 🟢  API Gateway: 🟢     │  │
│  │ K8s Cluster: 🟢  Registry: 🟢           │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 5.2 快速开始引导

**触发**: 首次访问 `/developer-portal`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  欢迎来到 Orion! 🚀          [跳过]          │
├─────────────────────────────────────────────┤
│                                              │
│  步骤 3/5                                    │
│  ○──○──●──○──○                               │
│  连接  模板  构建  结果  部署                 │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │                                         │  │
│  │  选择一个 Pipeline 模板开始:             │  │
│  │                                         │  │
│  │  ┌──────────┐ ┌──────────┐             │  │
│  │  │ Node.js  │ │ Go       │             │  │
│  │  │ Build    │ │ Build    │             │  │
│  │  │ [选择]   │ │ [选择]   │             │  │
│  │  └──────────┘ └──────────┘             │  │
│  │                                         │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [上一步] [下一步]                           │
└─────────────────────────────────────────────┘
```

### 5.3 前端文件变更

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/pages/DeveloperPortal/index.tsx` | 新建 | 开发者门户首页 |
| `src/pages/DeveloperPortal/DocCenter.tsx` | 新建 | 文档中心页面 |
| `src/pages/DeveloperPortal/TemplateLib.tsx` | 新建 | 模板库页面 |
| `src/pages/DeveloperPortal/Onboarding.tsx` | 新建 | 快速开始引导 |
| `src/api/developerPortal.ts` | 新建 | 门户 API 客户端 |
| `src/components/WelcomeCard/index.tsx` | 新建 | 欢迎卡片组件 |
| `src/components/QuickActions/index.tsx` | 新建 | 快捷操作组件 |
| `src/components/PlatformHealth/index.tsx` | 新建 | 平台健康状态组件 |
| `src/components/OnboardingModal/index.tsx` | 新建 | 引导弹窗组件 |

## 六、测试策略

### 6.1 单元测试

| 模块 | 文件 | 测试用例 |
|------|------|----------|
| DeveloperPortalService | `services/developer-portal/DeveloperPortalService.ts` | 文档 CRUD/搜索/模板聚合（8 cases） |

### 6.2 集成测试

| 场景 | 描述 |
|------|------|
| 模板聚合 | 从 Pipeline/Environment/Build 模块聚合模板 → 统一展示 |
| 文档搜索 | 创建文档 → 搜索关键词 → 返回匹配结果 |

### 6.3 E2E 测试

| 场景 | 描述 |
|------|------|
| 快速开始 E2E | 首次访问 → 5 步引导 → 创建 Pipeline → 构建 → 部署 → 验证完成 |

## 七、非功能性要求

### 7.1 性能

| 指标 | 目标 |
|------|------|
| 门户首页加载 | < 1s（含所有聚合数据） |
| 文档搜索响应 | < 500ms |

### 7.2 安全性

| 要求 | 实现 |
|------|------|
| Tenant 隔离 | 所有数据按 tenant_id 过滤 |

## 八、实施计划

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) |
|------|:---------:|:---------:|:---------:|
| 文档中心 | 1 | 2 | 0.5 |
| 模板库 | 0.5 | 1.5 | 0.5 |
| 状态总览 | 0.5 | 1 | 0.5 |
| 快速开始 | 0 | 2 | 1 |
| **合计** | **2** | **6.5** | **2.5** |

---

_文档版本: v1.0 | 创建日期: 2026-05-05 | 状态: 编写中_
