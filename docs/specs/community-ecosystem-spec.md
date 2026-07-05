# Spec: 社区生态 (Community Ecosystem)

> **日期**: 2026-07-03
> **状态**: 已验证
> **能力域**: 社区生态
> **目标成熟度**: L1 → L2
> **关键交付**: 插件市场、模板共享、社区评分、生态集成、开发者门户

## 一、功能描述

### 1.1 现状评估 (L1)

Orion 当前已实现：
- 插件框架基础（PluginService + PluginManager）
- 工具市场基本页面（ToolMarketplace）
- IDE 插件设计（IDE Plugin API）
- 基础插件安装/卸载流程

**不足**：
- 无插件市场门户（搜索/分类/评分/下载统计）
- 无模板共享机制（Pipeline/配置模板无法社区共享）
- 无社区评分和评价系统
- 无生态集成指南（第三方系统接入文档）
- 无开发者门户（API Key 管理、使用统计）

### 1.2 Phase 1 目标 (L2)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 插件市场 | 搜索/分类/评分/安装/更新/卸载 | L2 |
| 模板共享 | 社区模板上传、下载、评分 | L2 |
| 评价系统 | 评分、评论、使用统计 | L2 |
| 开发者门户 | API Key、使用统计、文档 | L2 |
| 生态监控 | 插件健康度、兼容性、安全扫描 | L2 |

## 二、验收标准

### 2.1 插件市场

| # | 标准 | 验证方式 |
|---|------|----------|
| CE1 | 插件市场展示所有可用插件，支持分类筛选（CI/CD/监控/通知/安全） | 前端验证 |
| CE2 | 插件详情页含描述、版本、作者、安装量、评分、兼容性 | 前端验证 |
| CE3 | 支持一键安装/更新/卸载插件 | API 测试 |
| CE4 | 插件安装前显示所需权限列表，用户确认后安装 | 前端验证 |
| CE5 | 插件版本管理：支持查看更新日志、回退到旧版本 | API 测试 |
| CE6 | 插件搜索支持关键字和标签匹配 | 前端验证 |

### 2.2 模板共享

| # | 标准 | 验证方式 |
|---|------|----------|
| CE7 | 用户可将 Pipeline/配置模板发布到社区 | API 测试 |
| CE8 | 社区模板列表含分类、标签、下载量、评分 | 前端验证 |
| CE9 | 一键从社区模板创建 Pipeline 或配置 | 前端 + API 测试 |
| CE10 | 模板作者可更新版本，更新时通知已使用者 | 集成测试 |

### 2.3 评价系统

| # | 标准 | 验证方式 |
|---|------|----------|
| CE11 | 用户可对插件/模板进行评分（1-5 星） | API 测试 |
| CE12 | 用户可发表评论（含 Markdown 支持） | API 测试 |
| CE13 | 评分自动聚合显示平均分和评分分布 | 前端验证 |
| CE14 | 恶意评论可举报，管理员可删除 | 集成测试 |

### 2.4 开发者门户

| # | 标准 | 验证方式 |
|---|------|----------|
| CE15 | 开发者可注册并获取 API Key | API 测试 |
| CE16 | API Key 权限范围可配置（只读/读写/指定 API） | API 测试 |
| CE17 | API 使用统计仪表盘（调用量、错误率、延迟） | 前端验证 |
| CE18 | 开发者文档自动生成（基于 OpenAPI） | 前端验证 |
| CE19 | API Key 可随时轮换和撤销 | API 测试 |

### 2.5 生态监控

| # | 标准 | 验证方式 |
|---|------|----------|
| CE20 | 插件安装后自动检查与当前平台版本兼容性 | 集成测试 |
| CE21 | 插件安全扫描：安装前自动扫描已知漏洞 | 集成测试 |
| CE22 | 插件/模板使用统计（安装量、活跃用户、趋势） | 前端验证 |
| CE23 | 不兼容或不再维护的插件标记为"已弃用" | API 测试 |

## 三、API 设计

```
Base: /api/v1/ecosystem
```

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/plugins` | 插件市场列表 |
| GET | `/plugins/:id` | 插件详情 |
| POST | `/plugins/:id/install` | 安装插件 |
| POST | `/plugins/:id/uninstall` | 卸载插件 |
| POST | `/plugins/:id/update` | 更新插件 |
| GET | `/plugins/:id/versions` | 插件版本历史 |
| GET | `/templates` | 社区模板列表 |
| POST | `/templates` | 发布模板到社区 |
| GET | `/templates/:id` | 模板详情 |
| POST | `/templates/:id/instantiate` | 从模板创建 |
| POST | `/ratings` | 提交评分 |
| POST | `/comments` | 提交评论 |
| GET | `/developers/api-keys` | API Key 列表 |
| POST | `/developers/api-keys` | 创建 API Key |
| DELETE | `/developers/api-keys/:id` | 撤销 API Key |
| GET | `/developers/stats` | API 使用统计 |
| GET | `/dashboard` | 生态仪表盘 |

## 四、数据模型

```sql
-- 插件注册表
CREATE TABLE IF NOT EXISTS ecosystem_plugins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(200) NOT NULL UNIQUE,
  display_name    VARCHAR(200),
  description     TEXT,
  category        VARCHAR(50),
  version         VARCHAR(20),
  author          VARCHAR(200),
  homepage        VARCHAR(500),
  permissions     TEXT[] DEFAULT '{}',
  install_count   INT DEFAULT 0,
  rating_avg      DECIMAL(2,1) DEFAULT 0,
  rating_count    INT DEFAULT 0,
  compatibility   JSONB,
  status          VARCHAR(20) DEFAULT 'active',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 社区模板
CREATE TABLE IF NOT EXISTS ecosystem_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id),
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  category        VARCHAR(50),
  tags            TEXT[] DEFAULT '{}',
  content         JSONB NOT NULL,
  version         INT DEFAULT 1,
  download_count  INT DEFAULT 0,
  rating_avg      DECIMAL(2,1) DEFAULT 0,
  shared          BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 评分与评论
CREATE TABLE IF NOT EXISTS ecosystem_ratings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type     VARCHAR(20) NOT NULL,
  target_id       UUID NOT NULL,
  user_id         UUID REFERENCES users(id),
  score           INT NOT NULL CHECK(score >= 1 AND score <= 5),
  comment         TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(target_type, target_id, user_id)
);
```

## 五、前端设计

**路由**: `/ecosystem`

主要页面：
- 插件市场页：分类浏览、搜索、安装、评分
- 插件详情页：描述、版本历史、评论、安装
- 模板市场页：社区模板列表、详情、一键实例化
- 开发者门户页：API Key 管理、使用统计、文档
- 生态仪表盘：安装统计、活跃插件、健康状态

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 20 | PluginManager、TemplateService、RatingService、DeveloperPortal |
| 集成测试 | 6 | 插件安装→更新→卸载、模板发布→实例化、评分→评论 |
| 安全测试 | 3 | 插件权限验证、API Key 鉴权、恶意评论检测 |

---

_文档版本: v1.0 | 创建日期: 2026-07-03 | 状态: 已验证_
