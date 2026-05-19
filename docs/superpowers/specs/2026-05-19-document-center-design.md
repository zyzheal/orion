# 文档中心设计 — 复用知识库实现 /docs 与 /knowledge

> 日期: 2026-05-19
> 状态: 待评审
> 分支: feat/frontend-gap-implementation

## 1. 需求背景

当前 Orion 系统有两类文档需求：
- **官方文档** (`/docs`)：系统使用说明、模块功能介绍、API 参考、架构设计等，面向所有已登录用户，内容为系统自带
- **用户知识库** (`/knowledge`)：用户自行创建和管理的知识文档，面向有权限的用户群体

**核心决策**：复用现有知识库模块（`orion-knowledge` + `orion-platform-service/src/services/knowledge/`），不新建独立的文档系统。两者共用同一套后端 API、数据表和存储引擎，通过 `type` 和 `source` 字段区分内容归属和来源。

## 2. 总体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                    文档系统架构（复用知识库）                          │
└─────────────────────────────────────────────────────────────────────┘

                    前端路由
        ┌─────────────────┴─────────────────┐
        ▼                                    ▼
   /docs (官方文档)                    /knowledge (用户知识库)
        │                                    │
        │  type='docs'                       │  type='knowledge'
        │  source='synced' | 'manual'        │  source='manual'
        │  tag 分类展示                      │  Space 列表
        │                                    │
        └─────────────────┬─────────────────┘
                          ▼
                    Knowledge API
                    /api/v1/knowledge/v1/*
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
     kb_spaces 表              kb_docs 表
     ┌──────────────┐          ┌──────────────┐
     │ type: docs   │          │ type: docs   │
     │ type: user   │          │ type: user   │
     │ source: ...  │          │ tags: [...]  │
     └──────────────┘          │ source: ...  │
                               └──────────────┘

     文档同步引擎 (DocSyncEngine)
     ┌──────────────────────────────────────┐
     │ 监控 docs/ 目录变化                    │
     │ 自动解析 → 写入 kb_spaces + kb_docs   │
     │ 定时同步 / 手动触发                   │
     └──────────────────────────────────────┘
```

## 3. 数据模型变更

### 3.1 现有表扩展（最小化改造）

```sql
-- kb_spaces 新增 source 字段，扩展 type 枚举
ALTER TABLE kb_spaces ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'manual';
ALTER TYPE space_type_enum ADD VALUE IF NOT EXISTS 'docs';

-- kb_docs 新增 source 字段
ALTER TABLE kb_docs ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'manual';

-- 新增文档同步记录表
CREATE TABLE IF NOT EXISTS kb_doc_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_path TEXT NOT NULL,
    space_id UUID REFERENCES kb_spaces(id),
    doc_id UUID REFERENCES kb_docs(id),
    status VARCHAR(20) DEFAULT 'success',
    error_message TEXT,
    sync_type VARCHAR(20) DEFAULT 'full',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_kb_spaces_type ON kb_spaces(type, tenant_id);
CREATE INDEX IF NOT EXISTS idx_kb_docs_type ON kb_docs(type, status, space_id);
CREATE INDEX IF NOT EXISTS idx_kb_docs_source ON kb_docs(source);
```

**变更说明**：
- `kb_spaces.type` 新增 `docs` 值，用于标记官方文档 Space（只读、系统维护）
- `kb_spaces` 和 `kb_docs` 各新增 `source` 字段：`manual`（手动创建）或 `synced`（自动同步）
- 新增同步日志表，追踪同步状态
- 现有查询逻辑无需修改，仅需在 API 层增加 `type` 和 `source` 过滤参数

### 3.2 TypeScript 类型扩展

```typescript
// orion-platform-service/src/services/knowledge/KnowledgeRepository.ts

// Space type 扩展
export type SpaceType = 'public' | 'internal' | 'private' | 'docs';

// 新增 source 类型
export type ContentSource = 'manual' | 'synced';

// KnowledgeSpace 新增 source 字段
export interface KnowledgeSpace {
  id: string;
  tenant_id: string;
  name: string;
  type: SpaceType;
  source?: ContentSource;  // 新增
  owner_id: string;
  team_id: string | null;
  description: string | null;
  doc_count: number;
  created_at: Date;
  updated_at: Date;
}

// KnowledgeDoc 新增 source 字段
export interface KnowledgeDoc {
  id: string;
  tenant_id: string;
  space_id: string;
  title: string;
  content: string;
  type: string;
  source?: ContentSource;  // 新增
  tags: string[];
  status: 'draft' | 'published' | 'archived';
  version: number;
  author_id: string | null;
  embedding: number[] | null;
  created_at: Date;
  updated_at: Date;
}
```

## 4. 文档同步引擎 (DocSyncEngine)

### 4.1 同步规则

```
docs/ 目录 → 自动同步 → kb_spaces + kb_docs

同步映射：
- 每个一级子目录 = 一个 Space
  docs/architecture/ → Space "架构设计" (type='docs', source='synced')
  docs/superpowers/  → Space "Superpowers" (type='docs', source='synced')
  docs/adr/          → Space "架构决策记录" (type='docs', source='synced')

- 每个 Markdown 文件 = 一篇 Document
  docs/architecture/pipeline.md → Document "Pipeline 架构" (type='docs', source='synced')

- YAML Frontmatter 解析为 metadata：
  ---
  title: "Pipeline 架构设计"
  tags: [pipeline, architecture]
  category: "交付"
  ---
  → title、tags 写入 kb_docs，category 用于前端分类导航
```

### 4.2 触发方式

| 方式 | 说明 | 优先级 |
|------|------|--------|
| **手动触发** | 管理员在 `/docs/admin` 点击"同步文档" | P0 |
| **定时任务** | 每天凌晨 2:00 自动执行 | P1 |
| **Git Hook** | `docs/` 目录有提交时触发（可选） | P3 |

### 4.3 同步策略

```typescript
// orion-platform-service/src/services/knowledge/DocSyncEngine.ts

export class DocSyncEngine {
  /**
   * 全量同步：扫描 docs/ 目录下所有文件
   */
  async fullSync(): Promise<SyncResult> {
    // 1. 扫描 docs/ 子目录，为每个目录创建/更新 Space
    // 2. 扫描每个目录下的 .md 文件，创建/更新 Document
    // 3. 记录同步日志到 kb_doc_sync_logs
    // 4. 返回成功/失败统计
  }

  /**
   * 增量同步：只同步 mtime 变化的文件
   */
  async incrementalSync(lastSyncAt: Date): Promise<SyncResult> {
    // 1. 只扫描 lastSyncAt 之后修改过的文件
    // 2. 跳过 source='manual' 且已被手动编辑过的文档
    // 3. 其余逻辑同全量同步
  }

  /**
   * 冲突处理
   */
  private shouldSkipManualEdit(doc: KnowledgeDoc): boolean {
    // 如果文档是 synced 但被手动修改过（updated_at > last_sync_time 且 version > synced_version）
    // 则跳过同步并记录日志
    return doc.source === 'manual' && doc.version > 1;
  }
}
```

### 4.4 冲突处理规则

| 场景 | 处理方式 |
|------|---------|
| 文件已被手动编辑 | 跳过同步，记录日志（不覆盖用户编辑内容） |
| 文件是纯 synced 状态 | 正常覆盖更新 |
| 文件被删除（物理删除） | 文档标记为 `archived`，不物理删除 |
| 新文件 | 创建新 Document |
| 新目录 | 创建新 Space |

## 5. 前端设计

### 5.1 /docs 页面结构

```
/docs (官方文档中心)
├── 顶部：全局搜索框（复用 RAG 语义检索，scope=docs）
├── 左侧：分类导航
│   ├── 全部文档
│   ├── 快速入门
│   ├── 模块使用（按系统模块分类）
│   │   ├── ChatOps
│   │   ├── Pipeline
│   │   ├── 部署管理
│   │   └── ...
│   ├── API 参考
│   ├── 架构设计
│   └── 架构决策 (ADR)
└── 主内容区
    ├── 文档列表模式（卡片/列表切换）
    ├── 文档详情模式（Markdown 渲染）
    ├── 面包屑导航
    ├── 目录 (TOC) 侧边栏
    └── 上一篇 / 下一篇
```

### 5.2 /knowledge 页面（保持不变）

- 现有 `/knowledge` 页面继续作为用户自建知识库，功能不变
- 后端 API 查询时自动按 `type='knowledge'` 过滤

### 5.3 /docs/admin 管理页

```
/docs/admin (仅 admin 角色可访问)
├── 同步管理
│   ├── [全量同步] [增量同步] 按钮
│   ├── 同步状态展示
│   └── 同步历史日志
├── 文档管理
│   ├── 已同步文档列表（只读查看）
│   └── 手动编辑文档（可创建/编辑）
└── Space 管理
    ├── 文档分类管理
    └── 新增分类
```

### 5.4 路由守卫

| 路由 | 权限要求 |
|------|---------|
| `/docs` | 所有已登录用户可读，无需特殊权限 |
| `/docs/:id` | 所有已登录用户可读 |
| `/docs/admin` | 仅 `admin` 角色可访问 |
| `/knowledge` | `requirePermission({ resource: 'knowledge', action: 'read' })` |

## 6. API 变更

### 6.1 新增端点

```
# 获取官方文档列表（type=docs 过滤）
GET /api/v1/knowledge/v1/docs?type=docs&status=published&spaceId=xxx&tag=xxx

# 获取文档分类（按 tag 聚合，用于左侧导航）
GET /api/v1/knowledge/v1/docs/tags?type=docs

# 获取文档目录结构（按 Space + tag 树形组织）
GET /api/v1/knowledge/v1/docs/toc?type=docs

# 触发文档同步（仅 admin）
POST /api/v1/knowledge/v1/sync?type=full|incremental

# 查看同步记录
GET /api/v1/knowledge/v1/sync/logs
```

### 6.2 现有端点扩展

现有 `/api/v1/knowledge/v1/docs` 和 `/api/v1/knowledge/v1/spaces` 查询参数增加 `type` 过滤：

```typescript
// knowledge-routes.ts 查询参数扩展
app.get('/v1/docs', {
  onRequest: [authenticateUser, requirePermission({ resource: 'knowledge', action: 'read' })],
}, async (request, reply) => {
  const { type, ...otherParams } = request.query;

  const docs = await service.listDocs(tenantId, {
    type,      // 新增：过滤 type='docs' 或 type='knowledge'
    ...otherParams,
  });

  return reply.send({ data: docs });
});
```

### 6.3 无需修改的现有端点

| 端点 | 说明 |
|------|------|
| `GET /v1/spaces` | 已支持 `type` 参数过滤，无需修改 |
| `GET /v1/docs/:id` | 按 ID 查询，不依赖 type |
| `GET /v1/docs/:id/versions` | 版本历史，不依赖 type |
| `POST /v1/rag/retrieve` | RAG 检索，通过 spaceId 限定范围 |
| `GET /v1/graph` | 知识图谱，不依赖 type |

## 7. 权限控制

### 7.1 官方文档权限矩阵

| 操作 | 用户 | admin | super_admin |
|------|------|-------|-------------|
| 查看文档 | ✓ | ✓ | ✓ |
| 搜索文档 | ✓ | ✓ | ✓ |
| 同步文档 | ✗ | ✓ | ✓ |
| 手动编辑文档 | ✗ | ✓ | ✓ |
| 管理分类 | ✗ | ✓ | ✓ |

### 7.2 用户知识库权限

沿用现有 `requirePermission({ resource: 'knowledge', action: 'read/write/delete' })`，不受 `/docs` 设计影响。

## 8. 技术实现清单

### 8.1 数据库变更

| 文件 | 说明 |
|------|------|
| `db/migrations/146_add_docs_type_and_source.sql` | 扩展 type 枚举 + 新增 source 字段 + 同步日志表 |

### 8.2 后端变更

| 文件 | 说明 |
|------|------|
| `src/services/knowledge/KnowledgeRepository.ts` | TypeScript 类型扩展（SpaceType、ContentSource） |
| `src/services/knowledge/DocSyncEngine.ts` | 新增文档同步引擎（全量/增量同步） |
| `src/api/knowledge-routes.ts` | 新增 `/sync` 端点 + 查询参数 type 过滤 |
| `src/api/knowledge-admin-routes.ts` | 新增管理端 API（同步触发、日志查询） |

### 8.3 前端变更

| 文件 | 说明 |
|------|------|
| `orion-frontend/src/router/routes.tsx` | 新增 `/docs`、`/docs/:id`、`/docs/admin` 路由 |
| `orion-frontend/src/pages/Docs/index.tsx` | 官方文档中心首页（搜索 + 分类导航） |
| `orion-frontend/src/pages/Docs/DocList.tsx` | 文档列表组件 |
| `orion-frontend/src/pages/Docs/DocDetail.tsx` | 文档详情（Markdown 渲染 + TOC） |
| `orion-frontend/src/pages/Docs/DocAdmin.tsx` | 文档管理页（同步 + 日志） |
| `orion-frontend/src/api/knowledge.ts` | 新增 type 过滤参数 + 同步 API |
| `orion-frontend/src/components/Docs/DocSearch.tsx` | 文档搜索组件（复用 RAG） |
| `orion-frontend/src/components/Docs/DocNav.tsx` | 左侧分类导航 |

## 9. 实施优先级

| 优先级 | 模块 | 工作量 | 说明 |
|--------|------|--------|------|
| P0 | 数据库变更 + 类型扩展 | 0.5 人日 | 最小改动 |
| P0 | DocSyncEngine 后端 | 2 人日 | 核心引擎 |
| P1 | /docs 前端页面 | 3 人日 | 主要工作量 |
| P1 | API 端点扩展 | 1 人日 | 过滤 + 同步接口 |
| P2 | /docs/admin 管理页 | 1.5 人日 | 管理功能 |
| P3 | Git Hook 自动同步 | 1 人日 | 可选增强 |

**预计总工作量**: 9 人日

## 10. 验收标准

### 10.1 功能验收

- [ ] `/docs` 页面可访问，展示官方文档列表
- [ ] 左侧分类导航按 Space + tag 组织
- [ ] 文档详情页支持 Markdown 渲染 + TOC
- [ ] 搜索支持语义检索（复用 RAG）
- [ ] 管理员可触发全量/增量同步
- [ ] 同步日志可查看
- [ ] `/knowledge` 页面功能不受影响
- [ ] 官方文档 Space 不可被用户删除

### 10.2 非功能验收

- [ ] 全量同步在 5 分钟内完成（假设 500 个文件）
- [ ] /docs 页面加载时间 < 2s
- [ ] 搜索响应时间 < 500ms

### 10.3 视觉验收

- [ ] /docs 页面视觉风格与 /knowledge 保持一致（复用同一套 Design Token）
- [ ] 文档卡片圆角 `12px`，阴影 `shadows.card`
- [ ] Markdown 渲染使用系统主题色，代码块支持语法高亮
- [ ] TOC 侧边栏固定定位，滚动时不跟随
- [ ] 面包屑导航文字色 `colors.neutral[500]`，链接色 `colors.primary[500]`
- [ ] 上一篇/下一篇按钮 hover 背景色 `colors.primary[50]`
- [ ] 搜索框聚焦时显示蓝色外发光（`0 0 0 2px rgba(51,112,230,0.1)`）
- [ ] 同步状态按钮颜色：成功绿 `#52c41a`、失败红 `#f5222d`、进行中蓝 `#3370E6`
