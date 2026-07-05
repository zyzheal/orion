# Spec: 知识库 (PandaWiki)

> **日期**: 2026-07-03
> **状态**: 编写中
> **能力域**: 知识管理
> **目标成熟度**: L1 → L2
> **关键交付**: Wiki 空间、页面管理、版本控制、搜索、权限

## 一、功能描述

### 1.1 现状评估 (L1)

Orion 当前已实现（Go 微服务 `orion-pandawiki-svc-go`）：
- Wiki 空间 CRUD（PandaWikiService + Repository）
- Wiki 页面基础管理（WikiSpace 模型）
- 页面内容存储（JSONB）
- 多租户隔离
- OpenTelemetry 追踪

**不足**：
- 无页面版本管理
- 无全文搜索
- 无页面权限控制
- 无页面分类/标签
- 无页面树（目录结构）
- 无 Markdown 渲染
- 无评论/讨论
- 无页面关联
- 无知识图谱集成
- 无导入导出（Markdown/PDF）

### 1.2 Phase 1 目标 (L2)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 页面版本 | 版本历史/对比/回退 | L2 |
| 全文搜索 | 标题/内容全文检索 | L2 |
| 权限控制 | 空间级/页面级读写权限 | L2 |
| 页面树 | 目录结构+拖拽排序 | L2 |
| Markdown | Markdown 渲染+扩展语法 | L2 |
| 导入导出 | Markdown/PDF/HTML | L2 |

## 二、验收标准

### 2.1 空间与页面管理

| # | 标准 | 验证方式 |
|---|------|----------|
| PW1 | 支持创建 Wiki 空间（name/description/visibility） | API 测试 |
| PW2 | 空间可见性：private/team/public | API 测试 |
| PW3 | 空间内创建页面（title/content/parent_id） | API 测试 |
| PW4 | 页面支持设置父页面（形成树结构） | API 测试 |
| PW5 | 页面可更新/删除 | API 测试 |
| PW6 | 多租户隔离 | 集成测试 |
| PW7 | 空间/页面创建者自动记录 | API 测试 |

### 2.2 页面版本管理

| # | 标准 | 验证方式 |
|---|------|----------|
| PW8 | 每次更新自动创建版本快照 | API 测试 |
| PW9 | 版本列表查询（按页面） | API 测试 |
| PW10 | 版本 diff 对比（并排/统一） | API 测试 |
| PW11 | 支持回退到任意历史版本 | API 测试 |
| PW12 | 版本记录含操作人/时间/变更说明 | API 测试 |
| PW13 | 最多保留 100 个版本 | 单元测试 |

### 2.3 全文搜索

| # | 标准 | 验证方式 |
|---|------|----------|
| PW14 | 支持按标题全文搜索 | API 测试 |
| PW15 | 支持按内容全文搜索 | API 测试 |
| PW16 | 搜索支持分词（中文/英文） | API 测试 |
| PW17 | 搜索结果按相关度排序 | API 测试 |
| PW18 | 搜索高亮匹配词 | 前端验证 |
| PW19 | 按空间/标签筛选搜索结果 | API 测试 |

### 2.4 权限控制

| # | 标准 | 验证方式 |
|---|------|----------|
| PW20 | 空间级权限：owner/editor/viewer | API 测试 |
| PW21 | 页面级权限可覆盖空间级 | API 测试 |
| PW22 | 支持按用户/角色授权 | API 测试 |
| PW23 | 无权限用户不可查看/编辑 | 集成测试 |
| PW24 | 公开空间无需登录可查看 | API 测试 |
| PW25 | 权限变更审计日志 | 单元测试 |

### 2.5 Markdown 与分类

| # | 标准 | 验证方式 |
|---|------|----------|
| PW26 | 支持标准 Markdown 语法 | API 测试 |
| PW27 | 支持扩展：表格/代码块高亮/数学公式 | API 测试 |
| PW28 | 页面标签管理（增删查） | API 测试 |
| PW29 | 按标签筛选页面 | API 测试 |
| PW30 | 页面分类（文档/教程/规范/FAQ） | API 测试 |

### 2.6 导入导出

| # | 标准 | 验证方式 |
|---|------|----------|
| PW31 | 支持 Markdown 导出（单页面/整个空间） | API 测试 |
| PW32 | 支持 HTML 导出 | API 测试 |
| PW33 | 支持 PDF 导出（通过 headless Chrome） | API 测试 |
| PW34 | 支持 Markdown 导入（批量创建页面） | API 测试 |
| PW35 | 页面树可视化（前端树形组件） | 前端验证 |
| PW36 | 页面面包屑导航 | 前端验证 |

## 三、API 设计

```
Base: /api/v1/wiki
```

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/spaces` | 创建空间 |
| GET | `/spaces` | 空间列表 |
| GET | `/spaces/:id` | 空间详情 |
| PUT | `/spaces/:id` | 更新空间 |
| DELETE | `/spaces/:id` | 删除空间 |
| POST | `/spaces/:id/pages` | 创建页面 |
| GET | `/spaces/:id/pages` | 页面列表 |
| GET | `/pages/:id` | 页面详情 |
| PUT | `/pages/:id` | 更新页面 |
| DELETE | `/pages/:id` | 删除页面 |
| GET | `/pages/:id/versions` | 版本历史 |
| POST | `/pages/:id/versions/:vid/rollback` | 回退版本 |
| GET | `/search` | 全文搜索 |
| POST | `/pages/:id/permissions` | 设置权限 |
| GET | `/pages/:id/tree` | 页面树 |
| POST | `/export/markdown` | Markdown 导出 |
| POST | `/export/pdf` | PDF 导出 |
| POST | `/import/markdown` | Markdown 导入 |

## 四、数据模型

```sql
-- Wiki 空间
CREATE TABLE IF NOT EXISTS wiki_spaces (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  visibility      VARCHAR(20) DEFAULT 'team',
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Wiki 页面
CREATE TABLE IF NOT EXISTS wiki_pages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  space_id        UUID NOT NULL REFERENCES wiki_spaces(id) ON DELETE CASCADE,
  title           VARCHAR(500) NOT NULL,
  content         JSONB DEFAULT '{}',
  parent_id       UUID REFERENCES wiki_pages(id),
  sort_order      INT DEFAULT 0,
  category        VARCHAR(50),
  tags            TEXT[] DEFAULT '{}',
  version         INT DEFAULT 1,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 页面版本
CREATE TABLE IF NOT EXISTS wiki_page_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id         UUID NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
  version         INT NOT NULL,
  content         JSONB NOT NULL,
  change_summary  TEXT,
  changed_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(page_id, version)
);

-- 页面权限
CREATE TABLE IF NOT EXISTS wiki_page_permissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id         UUID NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
  permission      VARCHAR(20) NOT NULL,
  subject_type    VARCHAR(20) NOT NULL,
  subject_id      UUID NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(page_id, subject_type, subject_id)
);

CREATE INDEX idx_wiki_spaces_tenant ON wiki_spaces(tenant_id);
CREATE INDEX idx_wiki_pages_space ON wiki_pages(space_id, parent_id);
CREATE INDEX idx_wiki_pages_tags ON wiki_pages USING GIN(tags);
CREATE INDEX idx_wiki_page_versions_page ON wiki_page_versions(page_id, version DESC);
```

## 五、前端设计

**路由**: `/wiki`

主要页面：
- 空间列表页：公开/私有空间
- 空间详情页：页面树 + 内容区
- 页面编辑页：Markdown 编辑器 + 预览
- 版本历史页：版本列表 + diff 对比
- 搜索页：全文搜索结果
- 权限管理页：空间/页面权限配置

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 20 | PandaWikiService、VersionService、SearchService |
| 集成测试 | 6 | 创建空间→页面→版本→搜索→权限→导出闭环 |
| 前端测试 | 4 | 空间浏览、页面编辑、搜索、版本对比 |

---
_文档版本: v1.0 | 创建日期: 2026-07-03 | 状态: 编写中_
