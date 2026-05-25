# 开发者门户扩展 — 完整功能设计 + 页面交互设计

> **日期**: 2026-05-22
> **状态**: 设计完成
> **能力域**: 生态模块 — 开发者门户
> **迁移编号**: 193
> **新建表**: `portal_categories`, `portal_feedback`

---

## 目录

1. [功能设计（后端）](#1-功能设计后端)
   - [1.1 Skill 市场](#11-skill-市场)
   - [1.2 SPI 扩展框架](#12-spi-扩展框架)
   - [1.3 反馈机制](#13-反馈机制)
   - [1.4 外部依赖](#14-外部依赖)
   - [1.5 权限模型](#15-权限模型)
2. [数据库设计](#2-数据库设计)
3. [页面交互设计（前端）](#3-页面交互设计前端)
   - [3.1 页面清单](#31-页面清单)
   - [3.2 开发者门户首页 /developer/portal](#32-开发者门户首页-developerportal)
   - [3.3 Skill 市场 /developer/skills](#33-skill-市场-developerskills)
   - [3.4 Skill 详情 /developer/skills/:id](#34-skill-详情-developerskillsid)
   - [3.5 SPI 扩展 /developer/extensions](#35-spi-扩展-developerextensions)
   - [3.6 文档与反馈 /developer/docs](#36-文档与反馈-developerdocs)
   - [3.7 反馈管理 /developer/feedback](#37-反馈管理-developerfeedback)
4. [API 设计](#4-api-设计)
5. [验收标准](#5-验收标准)

---

## 1. 功能设计（后端）

### 1.1 Skill 市场

**现状**：已有 `skill_packages`、`skill_versions`、`skill_instances`、`skill_reviews`、`skill_executions`、`skill_audit_logs` 6 张表，`SkillService` 812 行，`SkillRepository` 963 行，实现了完整的 CRUD、版本管理、评论、执行记录、审核工作流、审计日志。**skill-routes.ts** 已注册。

**需要增强的方向**：

#### 1.1.1 Skill 订阅机制

新增 `skill_subscriptions` 表（复用现有 `skill_instances` 扩展），支持租户对 Skill 的订阅式安装：

- **自动更新策略**：`auto_update`（跟随最新稳定版）/ `pinned`（锁定指定版本）/ `manual`（手动更新）
- **订阅通知**：Skill 发布新版本时，通过事件总线推送通知给订阅者
- **批量安装**：一次性安装多个 Skill，支持按分类/标签筛选后批量操作

#### 1.1.2 Skill 评分评论增强

已有 `skill_reviews` 表支持 1-5 星评分 + 评论文本。需要增强：

- **点赞/反对评论**：新增 `skill_review_votes` 表，记录用户对评论的投票
- **评论回复**：支持对评论的回复，形成讨论线程
- **评论举报**：`reported` 状态，管理员可审核处理
- **评分分布**：API 返回 1-5 星各自的数量分布，前端可渲染星级柱状图

#### 1.1.3 Skill 安装配置

已有 `skill_instances` 表支持租户级实例配置。需要增强：

- **安装前预览**：安装前展示 Skill 所需权限、依赖服务、配置参数
- **安装回滚**：记录安装快照，支持回滚到安装前状态
- **配置模板**：为常见场景提供预设配置模板，减少手动配置

#### 1.1.4 Skill 发布流程增强

已有 `draft → review → published` 三状态工作流。需要增强：

- **发布渠道**：`internal`（仅组织内可见）/ `public`（平台公开市场）/ `beta`（灰度发布）
- **版本兼容性矩阵**：声明与 Orion 平台版本的兼容关系
- **发布前检查**：自动运行 schema 校验、capability 依赖检查、权限声明审计

### 1.2 SPI 扩展框架

**目标**：为 Orion 平台提供可扩展的 Service Provider Interface（SPI）机制，允许外部组件在不修改核心代码的前提下扩展平台能力。

#### 1.2.1 扩展点注册

新建 `spi_extensions` 表：

```sql
CREATE TABLE IF NOT EXISTS spi_extensions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  extension_point     VARCHAR(100) NOT NULL,     -- 扩展点名称
  extension_id        VARCHAR(100) NOT NULL,     -- 扩展实现唯一标识
  name                VARCHAR(200) NOT NULL,
  description         TEXT,
  provider            VARCHAR(200),              -- 提供者（组织/个人）
  version             VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  status              VARCHAR(30) NOT NULL DEFAULT 'disabled',  -- disabled, enabled, error, deprecated
  priority            INT NOT NULL DEFAULT 0,    -- 同扩展点下的执行优先级
  config              JSONB NOT NULL DEFAULT '{}',
  metadata            JSONB NOT NULL DEFAULT '{}',
  error_message       TEXT,
  enabled_at          TIMESTAMPTZ,
  disabled_at         TIMESTAMPTZ,
  created_by          VARCHAR(100) NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          VARCHAR(100),
  deleted_at          TIMESTAMPTZ
);
CREATE INDEX idx_spi_extensions_tenant ON spi_extensions(tenant_id);
CREATE INDEX idx_spi_extensions_point ON spi_extensions(extension_point, priority);
CREATE INDEX idx_spi_extensions_status ON spi_extensions(status);
```

**核心扩展点**：

| 扩展点 | 描述 | 触发时机 |
|--------|------|----------|
| `pipeline.pre-build` | 构建前置处理 | Pipeline Build 阶段开始前 |
| `pipeline.post-build` | 构建后置处理 | Pipeline Build 阶段完成后 |
| `pipeline.pre-deploy` | 部署前置处理 | Deploy 阶段开始前 |
| `pipeline.post-deploy` | 部署后置处理 | Deploy 阶段完成后 |
| `notification.transform` | 通知消息转换 | 发送通知前 |
| `auth.extension` | 认证方式扩展 | 登录认证流程中 |
| `deployment.strategy` | 部署策略扩展 | 选择部署策略时 |
| `artifact.validator` | 制品校验扩展 | 制品上传/发布时 |
| `ticket.enrichment` | 工单信息增强 | 工单创建/更新时 |

#### 1.2.2 插件加载机制

```typescript
// 插件加载器核心接口
interface SPIExtensionLoader {
  /** 加载已注册的扩展 */
  loadExtensions(extensionPoint: string): Promise<LoadedExtension[]>;

  /** 按优先级排序后执行扩展链 */
  executeChain<T>(extensionPoint: string, input: T): Promise<T>;

  /** 热加载单个扩展（无需重启服务） */
  hotReload(extensionId: string): Promise<void>;

  /** 卸载扩展 */
  unloadExtension(extensionId: string): Promise<void>;
}

interface LoadedExtension {
  id: string;
  name: string;
  version: string;
  priority: number;
  /** 扩展执行函数 */
  handler: (input: unknown, context: ExecutionContext) => Promise<unknown>;
  /** 扩展的元数据 */
  metadata: Record<string, unknown>;
}

interface ExecutionContext {
  tenantId: string;
  userId: string;
  requestId: string;
  /** 调用链上下文，可传递数据给后续扩展 */
  contextData: Map<string, unknown>;
}
```

**加载顺序**：
1. 服务启动时，从 `spi_extensions` 表加载所有 `status = 'enabled'` 的扩展
2. 按 `extension_point` 分组，组内按 `priority` 升序排列
3. 注册到内存中的扩展点注册表（`Map<extensionPoint, LoadedExtension[]>`）
4. 支持通过 WebSocket/SSE 接收配置变更事件，实现热更新

#### 1.2.3 扩展生命周期

```
disabled → (注册/配置) → enabled → (运行时错误) → error
    ↑                                              |
    |                                              ↓
    +---------- (修复配置/重载) ← manual ─────────+

enabled → (主动停用) → disabled
enabled → (版本淘汰) → deprecated
```

| 状态 | 描述 | 允许的操作 |
|------|------|-----------|
| `disabled` | 已注册但未启用 | enable, delete, update config |
| `enabled` | 正常运行中 | disable, update config, hot reload |
| `error` | 运行时异常 | disable, update config, hot reload, view error |
| `deprecated` | 版本淘汰 | disable, delete, migrate |

**生命周期钩子**：

| 钩子 | 触发时机 | 用途 |
|------|----------|------|
| `onRegister` | 扩展首次注册 | 校验配置完整性、初始化资源 |
| `onEnable` | 扩展启用时 | 启动后台任务、建立连接 |
| `onDisable` | 扩展停用时 | 清理资源、保存状态 |
| `onError` | 扩展执行出错 | 记录错误、降级处理、通知 |
| `onUnload` | 扩展卸载时 | 彻底清理、归档数据 |

### 1.3 反馈机制

#### 1.3.1 反馈类型

| 类型 | 描述 | 枚举值 |
|------|------|--------|
| 文档反馈 | 对开发者门户文档的意见 | `document_feedback` |
| 功能建议 | 建议新增或改进功能 | `feature_request` |
| Bug 报告 | 报告系统缺陷 | `bug_report` |
| 体验反馈 | UI/UX 改进建议 | `ux_feedback` |
| 安全反馈 | 安全漏洞报告 | `security_report` |

#### 1.3.2 反馈处理工作流

```
submitted → triaged → in_progress → resolved → closed
    ↓          ↓           ↓            ↓
  rejected   pending     blocked      verification_failed
             info
```

| 状态 | 描述 | 操作人 | 下一步 |
|------|------|--------|--------|
| `submitted` | 用户提交，待处理 | 系统自动 | triage, reject |
| `triaged` | 已分类，确认有效 | 管理员 | in_progress, pending_info |
| `in_progress` | 处理中 | 开发者 | resolved, blocked |
| `resolved` | 已修复/采纳 | 开发者 | closed, verification_failed |
| `closed` | 已关闭 | 系统/管理员 | reopen |
| `rejected` | 拒绝处理 | 管理员 | reopen |
| `pending_info` | 等待补充信息 | 用户 | triaged, rejected |
| `blocked` | 被外部依赖阻塞 | 开发者 | in_progress, rejected |
| `verification_failed` | 用户验证未通过 | 用户 | in_progress |

#### 1.3.3 反馈数据模型

新建 `portal_feedback` 表：

```sql
CREATE TABLE IF NOT EXISTS portal_feedback (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id             VARCHAR(100) NOT NULL,
  feedback_type       VARCHAR(30) NOT NULL,   -- document_feedback, feature_request, bug_report, ux_feedback, security_report
  title               VARCHAR(500) NOT NULL,
  description         TEXT NOT NULL,
  target_type         VARCHAR(50),            -- page, api, document, skill, pipeline, deployment
  target_id           VARCHAR(100),           -- 关联对象 ID
  target_url          VARCHAR(500),           -- 关联页面 URL
  severity            VARCHAR(30) DEFAULT 'medium',  -- low, medium, high, critical
  status              VARCHAR(30) NOT NULL DEFAULT 'submitted',
  priority            VARCHAR(30) DEFAULT 'medium',    -- low, medium, high, urgent
  attachments         JSONB NOT NULL DEFAULT '[]',
  labels              TEXT[] NOT NULL DEFAULT '{}',
  assigned_to         VARCHAR(100),
  resolution          TEXT,                     -- 解决方案描述
  related_ticket_id   VARCHAR(100),             -- 关联工单 ID
  related_issue_url   VARCHAR(500),             -- 关联 GitHub/Jira Issue
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_by          VARCHAR(100) NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          VARCHAR(100),
  deleted_at          TIMESTAMPTZ,
  CHECK (feedback_type IN ('document_feedback', 'feature_request', 'bug_report', 'ux_feedback', 'security_report')),
  CHECK (status IN ('submitted', 'triaged', 'in_progress', 'resolved', 'closed', 'rejected', 'pending_info', 'blocked', 'verification_failed')),
  CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
);
CREATE INDEX idx_portal_feedback_tenant ON portal_feedback(tenant_id);
CREATE INDEX idx_portal_feedback_type ON portal_feedback(feedback_type);
CREATE INDEX idx_portal_feedback_status ON portal_feedback(status);
CREATE INDEX idx_portal_feedback_severity ON portal_feedback(severity);
CREATE INDEX idx_portal_feedback_user ON portal_feedback(user_id);
CREATE INDEX idx_portal_feedback_target ON portal_feedback(target_type, target_id);
CREATE INDEX idx_portal_feedback_created ON portal_feedback(created_at DESC);
CREATE INDEX idx_portal_feedback_labels ON portal_feedback USING gin(labels);
```

#### 1.3.4 反馈处理服务

```typescript
interface FeedbackService {
  // 用户侧
  createFeedback(input: CreateFeedbackInput): Promise<Feedback>;
  getMyFeedback(userId: string, options: ListOptions): Promise<PaginatedResult<Feedback>>;
  getFeedbackById(id: string): Promise<Feedback>;
  updateFeedback(id: string, input: UpdateFeedbackInput): Promise<Feedback>;
  addComment(id: string, input: AddCommentInput): Promise<FeedbackComment>;

  // 管理侧
  listFeedbacks(options: FeedbackFilterOptions): Promise<PaginatedResult<Feedback>>;
  triage(id: string, input: TriageInput): Promise<Feedback>;
  assignFeedback(id: string, assignee: string): Promise<Feedback>;
  resolveFeedback(id: string, resolution: string): Promise<Feedback>;
  closeFeedback(id: string): Promise<Feedback>;
  rejectFeedback(id: string, reason: string): Promise<Feedback>;
  getFeedbackStats(): Promise<FeedbackStats>;
}
```

### 1.4 外部依赖

| 依赖 | 用途 | 版本 | 必要性 |
|------|------|------|--------|
| PostgreSQL 14+ | 数据存储、全文搜索 | >= 14 | 必需 |
| 事件总线（EventBus） | 扩展生命周期事件、版本更新通知 | 内置 | 必需 |
| 通知服务（NotificationService） | 反馈状态变更通知、Skill 更新通知 | 内置 | 必需 |
| 权限服务（RBAC） | Skill/反馈/扩展的权限控制 | 内置 | 必需 |
| 对象存储 | 反馈附件存储（截图、日志） | MinIO/OSS | 可选 |
| Markdown 渲染 | 文档内容渲染、反馈描述渲染 | `marked` / `react-markdown` | 必需 |

### 1.5 权限模型

#### 1.5.1 Skill 权限

| 权限 | 资源 | 动作 | 角色 | 描述 |
|------|------|------|------|------|
| skill:read | skill | read | Developer+, 可读 | 浏览 Skill 市场、查看 Skill 详情 |
| skill:write | skill | write | Developer+, 可写 | 创建/编辑/删除自己创建的 Skill |
| skill:install | skill | install | Developer, 开发者 | 安装已发布的 Skill 到租户 |
| skill:use | skill | use | Developer, 开发者 | 在 Pipeline 中使用已安装的 Skill |
| skill:config | skill | config | Admin, 管理员 | 配置 Skill 实例参数 |
| skill:admin | skill | admin | PlatformAdmin, 平台管理员 | 审核、发布、下架 Skill |

#### 1.5.2 SPI 扩展权限

| 权限 | 资源 | 动作 | 角色 | 描述 |
|------|------|------|------|------|
| spi_extension:read | spi_extension | read | Developer+, 可读 | 查看已注册扩展列表 |
| spi_extension:write | spi_extension | write | Admin, 管理员 | 注册/编辑/删除扩展 |
| spi_extension:enable | spi_extension | enable | Admin, 管理员 | 启用/停用/热加载扩展 |
| spi_extension:admin | spi_extension | admin | PlatformAdmin | 管理所有扩展、查看执行日志 |

#### 1.5.3 反馈权限

| 权限 | 资源 | 动作 | 角色 | 描述 |
|------|------|------|------|------|
| feedback:read | feedback | read | Developer+, 可读 | 查看自己提交的反馈 |
| feedback:write | feedback | write | Developer, 开发者 | 创建/编辑自己提交的反馈 |
| feedback:manage | feedback | manage | Admin, 管理员 | 查看所有反馈、分类、分配、处理 |
| feedback:admin | feedback | admin | PlatformAdmin | 管理反馈标签、批量操作、导出 |

#### 1.5.4 文档权限（现有 PortalDocument 增强）

| 权限 | 资源 | 动作 | 角色 | 描述 |
|------|------|------|------|------|
| developer_portal:read | developer_portal | read | Developer+, 可读 | 查看已发布文档 |
| developer_portal:write | developer_portal | write | Developer+, 可写 | 创建/编辑/发布/取消发布文档 |
| developer_portal:delete | developer_portal | delete | Admin, 管理员 | 删除文档 |

---

## 2. 数据库设计

### 2.1 迁移 193 — 新建 2 张表

#### 2.1.1 `portal_categories` 表

```sql
-- 193: Developer Portal Extensions
-- 新建 portal_categories（文档分类管理）、portal_feedback（反馈系统）

CREATE TABLE IF NOT EXISTS portal_categories (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                VARCHAR(100) NOT NULL,
  slug                VARCHAR(100) NOT NULL,
  description         TEXT,
  icon                VARCHAR(50),                    -- Ant Design Icon 名称
  color               VARCHAR(20),                    -- 分类主题色
  parent_id           UUID REFERENCES portal_categories(id) ON DELETE SET NULL,
  sort_order          INT NOT NULL DEFAULT 0,
  is_visible          BOOLEAN NOT NULL DEFAULT true,
  document_count      INT NOT NULL DEFAULT 0,         -- 冗余字段，由触发器维护
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_by          VARCHAR(100) NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          VARCHAR(100),
  deleted_at          TIMESTAMPTZ
);
CREATE UNIQUE INDEX idx_portal_categories_tenant_slug ON portal_categories(tenant_id, slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_portal_categories_tenant ON portal_categories(tenant_id);
CREATE INDEX idx_portal_categories_parent ON portal_categories(parent_id);
CREATE INDEX idx_portal_categories_visible ON portal_categories(is_visible) WHERE is_visible = true;
CREATE INDEX idx_portal_categories_sort ON portal_categories(sort_order);

-- 自动更新 document_count 的触发器
CREATE OR REPLACE FUNCTION update_category_doc_count() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE portal_categories SET document_count = document_count + 1, updated_at = NOW()
    WHERE id = NEW.category_id AND deleted_at IS NULL;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE portal_categories SET document_count = document_count - 1, updated_at = NOW()
    WHERE id = OLD.category_id AND deleted_at IS NULL;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_category_doc_count
AFTER INSERT OR DELETE ON portal_documents
FOR EACH ROW EXECUTE FUNCTION update_category_doc_count();

-- portal_categories RLS
ALTER TABLE portal_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_categories FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_portal_categories ON portal_categories
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

COMMENT ON TABLE portal_categories IS '开发者门户文档分类管理表';
```

#### 2.1.2 `portal_feedback` 表

（DDL 已在 1.3.3 节给出）

```sql
-- portal_feedback RLS
ALTER TABLE portal_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_feedback FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_portal_feedback ON portal_feedback
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

COMMENT ON TABLE portal_feedback IS '开发者门户反馈管理系统表';
```

#### 2.1.3 Rollback 迁移

```sql
-- 193_developer_portal_extensions_rollback.sql

DROP TRIGGER IF EXISTS trg_update_category_doc_count ON portal_documents;
DROP FUNCTION IF EXISTS update_category_doc_count();

DROP TABLE IF EXISTS portal_feedback CASCADE;
DROP TABLE IF EXISTS portal_categories CASCADE;
```

### 2.2 与现有表的关联

```
portal_categories (193)
  ├─ 1:N → portal_documents (088) — portal_documents.category 改为 FK
  │
portal_documents (088)
  ├─ 已有: id, tenant_id, title, slug, content, content_format, document_type,
  │       category, tags, version, is_published, published_at, author_id,
  │       editor_id, view_count, helpful_count, not_helpful_count, metadata
  │
  └─ 1:N → portal_feedback (193) — target_type='document', target_id=doc.id

skill_packages (已有)
  ├─ 1:N → skill_versions (已有)
  ├─ 1:N → skill_instances (已有)
  ├─ 1:N → skill_reviews (已有)
  ├─ 1:N → skill_executions (已有)
  ├─ 1:N → skill_audit_logs (已有)
  │
  └─ 1:N → portal_feedback (193) — target_type='skill', target_id=skill.id

spi_extensions (新建，独立表)
  ├─ 与 Skill 系统无直接关联
  └─ 1:N → portal_feedback (193) — target_type='spi_extension', target_id=ext.id
```

### 2.3 SPI 扩展相关表

SPI 扩展的 `spi_extensions` 表不纳入迁移 193（因为迁移 193 只含 2 张表），需创建迁移 194：

```sql
-- 194: SPI Extension Framework

CREATE TABLE IF NOT EXISTS spi_extensions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  extension_point     VARCHAR(100) NOT NULL,
  extension_id        VARCHAR(100) NOT NULL,
  name                VARCHAR(200) NOT NULL,
  description         TEXT,
  provider            VARCHAR(200),
  version             VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  status              VARCHAR(30) NOT NULL DEFAULT 'disabled',
  priority            INT NOT NULL DEFAULT 0,
  config              JSONB NOT NULL DEFAULT '{}',
  metadata            JSONB NOT NULL DEFAULT '{}',
  error_message       TEXT,
  enabled_at          TIMESTAMPTZ,
  disabled_at         TIMESTAMPTZ,
  created_by          VARCHAR(100) NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          VARCHAR(100),
  deleted_at          TIMESTAMPTZ,
  CHECK (status IN ('disabled', 'enabled', 'error', 'deprecated'))
);
CREATE UNIQUE INDEX idx_spi_extensions_tenant_id ON spi_extensions(tenant_id, extension_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_spi_extensions_point_priority ON spi_extensions(extension_point, priority);
CREATE INDEX idx_spi_extensions_status ON spi_extensions(status);
CREATE INDEX idx_spi_extensions_tenant ON spi_extensions(tenant_id);

ALTER TABLE spi_extensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE spi_extensions FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_spi_extensions ON spi_extensions
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

COMMENT ON TABLE spi_extensions IS 'SPI 扩展注册表';
```

---

## 3. 页面交互设计（前端）

### 3.1 页面清单

| # | 页面 | 路由 | 描述 | 复用现有 |
|---|------|------|------|---------|
| P1 | 开发者门户首页 | `/developer/portal` | 文档概览 + 快捷入口 + 统计数据 | 增强现有 `DeveloperPortalPage.tsx` |
| P2 | Skill 市场 | `/developer/skills` | 浏览、搜索、安装 Skill | 复用现有 `SkillManagement/Marketplace.tsx` |
| P3 | Skill 详情 | `/developer/skills/:id` | Skill 详情、版本历史、评论、安装 | 新建 |
| P4 | SPI 扩展管理 | `/developer/extensions` | 扩展注册、启用/停用、监控 | 新建 |
| P5 | 文档中心 | `/developer/docs` | 文档浏览、分类导航、搜索 | 从现有页面拆分 |
| P6 | 反馈中心 | `/developer/feedback` | 提交反馈、查看我的反馈 | 新建 |
| P7 | 反馈管理 | `/developer/feedback/manage` | 管理员处理反馈、统计、导出 | 新建 |

### 3.2 开发者门户首页 `/developer/portal`

**标题**：
```tsx
<Title level={2} style={{ marginBottom: 8 }}>
  <CodeOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
  开发者门户
</Title>
<Typography.Text type="secondary" style={{ fontSize: 14, color: colors.neutral[500] }}>
  API 文档、Skill 市场、SPI 扩展与反馈中心
</Typography.Text>
```

**页面结构**（自上而下）：

```
┌─────────────────────────────────────────────────────────┐
│  开发者门户标题 + 副标题                                    │
├─────────────────────────────────────────────────────────┤
│  [统计行] 文档数 | 已发布 Skill 数 | SPI 扩展数 | 反馈处理率  │
├─────────────────────────────────────────────────────────┤
│  [搜索栏] 全文搜索（跨文档/Skill/反馈）                      │
├──────────────────┬──────────────────────────────────────┤
│                  │                                      │
│  [左侧导航]      │  [主内容区]                            │
│  文档中心        │  ┌─────┐ ┌─────┐ ┌─────┐             │
│  Skill 市场     │  │快速 │ │热门 │ │最近  │             │
│  SPI 扩展       │  │入口 │ │文档 │ │反馈  │             │
│  反馈中心       │  └─────┘ └─────┘ └─────┘             │
│  反馈管理(Admin) │                                      │
│                  │  [推荐 Skills]                         │
│                  │  [活跃 SPI 扩展]                        │
│                  │                                      │
└──────────────────┴──────────────────────────────────────┘
```

**交互细节**：

| 元素 | 交互行为 | loading | 空状态 | 错误处理 |
|------|----------|---------|--------|---------|
| 统计卡片 | 点击跳转到对应子页面 | 首次加载显示骨架屏 | 数字显示 0，可点击探索 | 显示红色 Alert "统计数据加载失败" + 重试按钮 |
| 搜索栏 | 输入关键词后回车搜索，跨模块检索 | 搜索时按钮显示 spinning icon | 无 | 显示 "搜索服务暂不可用" + 降级为本地过滤 |
| 快速入口 | 4 个卡片按钮：创建文档 / 浏览 Skill / 注册扩展 / 提交反馈 | 无 | 无 | 无 |
| 热门文档 | 点击跳转到文档详情 | 加载时显示 skeleton | `Empty` + "暂无文档，点击创建文档开始" | 显示错误 Alert |
| 推荐 Skills | 按 install_count 排序 Top 5 | 加载时 skeleton | `Empty` + "暂无 Skill，去 Skill 市场看看" | 显示错误 Alert |
| 最近反馈 | 用户最近的 5 条反馈 | 加载时 skeleton | 未登录时隐藏 | 显示错误 Alert |

**Design Token 使用**：
- 统计卡片：`componentRadius.card` (12px) + 阴影 `shadows.card`
- 快速入口卡片：`componentRadius.card` (12px) + 悬停阴影加深
- 搜索栏高度：`componentSize` (36px)
- 左侧导航间距：`spacing.md` (16px)
- 按钮圆角：`componentRadius.button.md` (6px)

**loading 状态**：
```tsx
<Spin spinning={loading} tip="加载开发者门户数据...">
  {/* 页面内容 */}
</Spin>
```

**错误处理**：
```tsx
{error && (
  <Alert
    message="加载失败"
    description={error}
    type="error"
    showIcon
    action={<Button size="small" onClick={handleRetry}>重试</Button>}
    style={{ marginBottom: spacing.md }}
  />
)}
```

### 3.3 Skill 市场 `/developer/skills`

**标题**：
```tsx
<Title level={2} style={{ marginBottom: 8 }}>
  <AppstoreOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
  Skill 市场
</Title>
<Typography.Text type="secondary" style={{ fontSize: 14, color: colors.neutral[500] }}>
  浏览、搜索、安装平台 Skill 包
</Typography.Text>
```

**交互细节**：

| 元素 | 交互行为 | loading | 空状态 | 错误处理 |
|------|----------|---------|--------|---------|
| 分类筛选 | 点击分类 Tag 切换，URL query 同步 | 切换时表格显示 mini loading | 无匹配时 Empty + "该分类下暂无 Skill" | 无 |
| 搜索框 | 输入后实时过滤（debounce 300ms） | 无 | 无匹配时 Empty + "未找到匹配搜索结果" | 无 |
| Skill 列表 | 卡片式网格展示，每个卡片：名称、描述、分类标签、评分(⭐)、安装数 | 初始加载 skeleton (6 卡片占位) | `Empty` + "暂无 Skill，成为第一个贡献者" + [提交 Skill] 按钮 | Alert + 重试 |
| 安装按钮 | 点击后弹出安装确认 Modal → 显示安装进度 → 成功后 message.success | 安装中按钮显示 loading spinner + disabled | 无 | message.error 显示错误详情 |
| 查看详情 | 点击 Skill 名称跳转到 `/developer/skills/:id` | 跳转时显示全局 loading bar | 无 | 404 时跳转回市场首页 |
| 排序 | 按评分/安装数/创建时间排序 | 排序时表格 loading | 无 | 无 |

**空状态交互**：
```tsx
<Empty
  image={Empty.PRESENTED_IMAGE_SIMPLE}
  description="暂无 Skill 数据，成为第一个贡献者"
>
  <Button
    type="primary"
    icon={<PlusOutlined />}
    onClick={() => navigate('/developer/skills/submit')}
  >
    提交 Skill
  </Button>
</Empty>
```

**安装确认 Modal**：
```tsx
<Modal
  title={`安装 Skill: ${skill.name}`}
  open={installModalVisible}
  onOk={handleConfirmInstall}
  onCancel={() => setInstallModalVisible(false)}
  confirmLoading={installing}
>
  <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
    <Descriptions.Item label="版本">{skill.version}</Descriptions.Item>
    <Descriptions.Item label="安装数">{skill.install_count}</Descriptions.Item>
    <Descriptions.Item label="评分">
      <Rate disabled defaultValue={skill.rating} /> ({skill.rating_count})
    </Descriptions.Item>
    <Descriptions.Item label="所需权限">
      {(skill.metadata?.requiredPermissions || []).map(p => (
        <Tag key={p}>{p}</Tag>
      ))}
    </Descriptions.Item>
  </Descriptions>
  <Alert
    type="info"
    message="安装后将在 Pipeline 和 AI Agent 中可用"
    showIcon
  />
</Modal>
```

### 3.4 Skill 详情 `/developer/skills/:id`

**标题**：
```tsx
<Title level={2} style={{ marginBottom: 8 }}>
  <AppstoreOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
  {skill.name}
</Title>
<Typography.Text type="secondary" style={{ fontSize: 14, color: colors.neutral[500] }}>
  {skill.description}
</Typography.Text>
```

**页面结构**：

```
┌──────────────────────────────────────────────────────────┐
│  Skill 名称 + 描述 + 状态徽章                               │
│  [安装] [提交反馈] [返回市场]                                │
├──────────────────────────────────────────────────────────┤
│  [基础信息]                                               │
│  版本 | 分类 | 作者 | 安装数 | 评分 | 创建/更新时间            │
├──────────────┬───────────────────────────────────────────┤
│              │                                           │
│  [Tab 导航]  │  [Tab 内容]                                │
│  概览        │  Schema 预览 + 能力列表 + 使用示例            │
│  版本历史    │  版本列表 + Changelog + 对比                │
│  评论 (N)    │  评论列表 + 星级分布 + 发表评论              │
│  执行记录    │  执行历史表格 + 状态过滤                     │
│  审计日志    │  操作审计表格                              │
│              │                                           │
└──────────────┴───────────────────────────────────────────┘
```

**交互细节**：

| 元素 | 交互行为 | loading | 空状态 | 错误处理 |
|------|----------|---------|--------|---------|
| 安装按钮 | 同市场安装流程 | 安装中 disabled + loading | 无 | Alert 显示错误 |
| 版本历史 Tab | 按时间倒序展示版本，点击可对比两个版本 | skeleton | `Empty` + "暂无版本历史" | Alert + 重试 |
| 评论 Tab | 星级分布柱状图 + 评论列表 + 评论表单 | skeleton | `Empty` + "暂无评论，发表第一条评论" | Alert + 重试 |
| 评论表单 | 评分 (Rate 1-5) + 评论文本 (TextArea) + 提交 | 提交时按钮 loading + disabled | 无 | message.error + 保留表单值 |
| 执行记录 Tab | 表格展示执行历史，支持按状态/时间过滤 | skeleton | `Empty` + "暂无执行记录" | Alert + 重试 |

**评论表单交互**：
```tsx
<Form form={reviewForm} layout="vertical" onFinish={handleAddReview}>
  <Form.Item name="rating" label="评分" rules={[{ required: true, message: '请选择评分' }]}>
    <Rate />
  </Form.Item>
  <Form.Item name="comment" label="评论">
    <Input.TextArea
      rows={4}
      placeholder="分享你对这个 Skill 的使用体验..."
      maxLength={1000}
      showCount
    />
  </Form.Item>
  <Form.Item>
    <Button type="primary" htmlType="submit" loading={submitting}>
      提交评论
    </Button>
  </Form.Item>
</Form>
```

### 3.5 SPI 扩展管理 `/developer/extensions`

**标题**：
```tsx
<Title level={2} style={{ marginBottom: 8 }}>
  <ExperimentOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
  SPI 扩展管理
</Title>
<Typography.Text type="secondary" style={{ fontSize: 14, color: colors.neutral[500] }}>
  注册、配置和监控平台 SPI 扩展点实现
</Typography.Text>
```

**交互细节**：

| 元素 | 交互行为 | loading | 空状态 | 错误处理 |
|------|----------|---------|--------|---------|
| 扩展点筛选 | 按扩展点名称筛选（下拉多选） | 无 | 无 | 无 |
| 状态筛选 | 按状态筛选：全部 / 已启用 / 已停用 / 异常 / 已淘汰 | 无 | 无 | 无 |
| 扩展列表 | 表格展示：名称、扩展点、版本、状态、优先级、最后错误、操作 | 初始加载 skeleton | `Empty` + "暂无扩展注册，点击注册扩展开始" + [注册扩展] 按钮 | Alert + 重试 |
| 注册扩展 | 点击打开注册 Drawer，填写：扩展点选择、扩展 ID、名称、描述、配置 JSON、优先级 | 提交时按钮 loading | 无 | 表单校验错误 inline 显示，提交失败 message.error + 保留表单值 |
| 启用/停用 | 表格操作列开关按钮，点击切换状态 | 切换时行内显示 spinning | 无 | message.error + 开关回滚 |
| 热加载 | 点击"重载"按钮，重新加载扩展配置 | 行内 loading | 无 | message.error 显示错误详情 |
| 异常查看 | 点击错误图标，弹出 Modal 显示错误堆栈 | 无 | 无 | 无 |
| 删除 | 二次确认后删除 | 删除时行内 loading | 无 | message.error + 撤销提示 |

**空状态交互**：
```tsx
<Empty
  image={Empty.PRESENTED_IMAGE_SIMPLE}
  description="暂无 SPI 扩展，注册扩展以增强平台能力"
>
  <Button
    type="primary"
    icon={<PlusOutlined />}
    onClick={() => setRegisterDrawer(true)}
  >
    注册扩展
  </Button>
</Empty>
```

**注册扩展 Drawer**：
```tsx
<Drawer
  title={<><ExperimentOutlined /> 注册 SPI 扩展</>}
  open={registerDrawerVisible}
  onClose={() => setRegisterDrawerVisible(false)}
  width={720}
  destroyOnClose
  extra={
    <Space>
      <Button onClick={() => setRegisterDrawerVisible(false)}>取消</Button>
      <Button type="primary" onClick={() => registerForm.submit()} loading={submitting}>
        注册
      </Button>
    </Space>
  }
>
  <Form form={registerForm} layout="vertical" onFinish={handleRegister}>
    <Form.Item
      name="extensionPoint"
      label="扩展点"
      rules={[{ required: true, message: '请选择扩展点' }]}
    >
      <Select
        placeholder="选择扩展点"
        options={[
          { label: 'Pipeline 构建前置', value: 'pipeline.pre-build' },
          { label: 'Pipeline 构建后置', value: 'pipeline.post-build' },
          { label: '部署前置', value: 'pipeline.pre-deploy' },
          { label: '部署后置', value: 'pipeline.post-deploy' },
          { label: '通知消息转换', value: 'notification.transform' },
          { label: '认证扩展', value: 'auth.extension' },
          { label: '部署策略', value: 'deployment.strategy' },
          { label: '制品校验', value: 'artifact.validator' },
          { label: '工单信息增强', value: 'ticket.enrichment' },
        ]}
      />
    </Form.Item>
    <Form.Item
      name="extensionId"
      label="扩展 ID"
      rules={[{ required: true, message: '请输入扩展 ID' }, { pattern: /^[a-z0-9-]+$/, message: '只能包含小写字母、数字和连字符' }]}
    >
      <Input placeholder="my-custom-extension" />
    </Form.Item>
    <Form.Item
      name="name"
      label="扩展名称"
      rules={[{ required: true, message: '请输入扩展名称' }]}
    >
      <Input placeholder="My Custom Extension" />
    </Form.Item>
    <Form.Item name="description" label="描述">
      <Input.TextArea rows={3} placeholder="描述扩展的功能和用途..." />
    </Form.Item>
    <Row gutter={16}>
      <Col span={12}>
        <Form.Item name="priority" label="优先级" initialValue={0}>
          <InputNumber min={0} max={100} style={{ width: '100%' }} />
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item name="version" label="版本" initialValue="1.0.0">
          <Input placeholder="1.0.0" />
        </Form.Item>
      </Col>
    </Row>
    <Form.Item name="config" label="扩展配置">
      <Input.TextArea
        rows={6}
        placeholder='{"endpoint": "https://...", "timeout": 5000}'
        style={{ fontFamily: 'monospace' }}
      />
    </Form.Item>
  </Form>
</Drawer>
```

### 3.6 文档与反馈 `/developer/docs`

**标题**：
```tsx
<Title level={2} style={{ marginBottom: 8 }}>
  <FileTextOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
  文档中心
</Title>
<Typography.Text type="secondary" style={{ fontSize: 14, color: colors.neutral[500] }}>
  浏览、搜索和管理开发者文档
</Typography.Text>
```

**交互细节**：

| 元素 | 交互行为 | loading | 空状态 | 错误处理 |
|------|----------|---------|--------|---------|
| 分类侧边栏 | 树形展示文档分类，点击切换分类过滤 | 加载时 skeleton | 无 | 无 |
| 搜索栏 | 全文搜索，支持标题/内容匹配 | 搜索时表格 loading | 无结果时 Empty + "未找到匹配的文档" | Alert |
| 文档列表 | 表格展示：标题、类型 Tag、分类、标签、状态、帮助数、操作 | 初始加载 skeleton | `Empty` + "暂无文档" + [创建文档] 按钮 | Alert + 重试 |
| 反馈按钮 | 每篇文档详情旁显示"有帮助/无帮助"按钮 | 无 | 无 | message.error |
| 创建文档 | Modal 表单创建 | 提交时 loading | 无 | 表单校验错误 inline |
| 编辑文档 | Drawer 编辑 | 保存时 loading | 无 | message.error + 保留值 |

**文档详情页交互**（从列表点击进入）：
```tsx
// 文档详情顶部操作栏
<Space style={{ marginBottom: spacing.md }}>
  <Button icon={<EditOutlined />} onClick={() => setEditDrawer(true)}>
    编辑
  </Button>
  <Popconfirm title="确认发布？" onConfirm={() => handlePublish(doc.id)}>
    <Button type="primary" icon={<CloudUploadOutlined />} disabled={doc.isPublished}>
      发布
    </Button>
  </Popconfirm>
  <Divider type="vertical" />
  <Button
    icon={<StarOutlined />}
    onClick={() => handleHelpful(doc.id, true)}
    style={{ color: colors.success[500] }}
  >
    有帮助 ({doc.helpfulCount})
  </Button>
  <Button
    icon={<DislikeOutlined />}
    onClick={() => handleHelpful(doc.id, false)}
  >
    无帮助 ({doc.notHelpfulCount})
  </Button>
  <Button
    icon={<MessageOutlined />}
    onClick={() => navigate(`/developer/feedback?target=document&targetId=${doc.id}`)}
  >
    反馈
  </Button>
</Space>
```

### 3.7 反馈管理 `/developer/feedback` 与 `/developer/feedback/manage`

#### 用户侧 `/developer/feedback`

**标题**：
```tsx
<Title level={2} style={{ marginBottom: 8 }}>
  <MessageOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
  反馈中心
</Title>
<Typography.Text type="secondary" style={{ fontSize: 14, color: colors.neutral[500] }}>
  提交反馈、跟踪处理进度
</Typography.Text>
```

**交互细节**：

| 元素 | 交互行为 | loading | 空状态 | 错误处理 |
|------|----------|---------|--------|---------|
| 提交反馈 | 点击打开提交 Modal | 提交时 loading | 无 | message.error + 保留值 |
| 我的反馈列表 | 表格展示：标题、类型、状态徽章、严重度、提交时间、操作 | 初始加载 skeleton | `Empty` + "暂无反馈，遇到问题时提交反馈" + [提交反馈] 按钮 | Alert + 重试 |
| 反馈详情 | 点击标题打开 Drawer 查看完整信息 | 加载时 skeleton | 无 | Alert |
| 状态筛选 | 按状态筛选：全部 / 已提交 / 处理中 / 已解决 / 已关闭 | 无 | 无 | 无 |
| 类型筛选 | 按反馈类型筛选 | 无 | 无 | 无 |

**提交反馈 Modal**：
```tsx
<Modal
  title={<><MessageOutlined style={{ marginRight: 8, color: colors.primary[500] }} /> 提交反馈</>}
  open={submitModalVisible}
  onOk={() => feedbackForm.submit()}
  onCancel={() => setSubmitModalVisible(false)}
  confirmLoading={submitting}
  width={720}
  destroyOnClose
>
  <Form form={feedbackForm} layout="vertical" onFinish={handleSubmitFeedback}>
    <Row gutter={16}>
      <Col span={12}>
        <Form.Item
          name="feedbackType"
          label="反馈类型"
          rules={[{ required: true, message: '请选择反馈类型' }]}
        >
          <Select
            placeholder="选择类型"
            options={[
              { label: '文档反馈', value: 'document_feedback' },
              { label: '功能建议', value: 'feature_request' },
              { label: 'Bug 报告', value: 'bug_report' },
              { label: '体验反馈', value: 'ux_feedback' },
              { label: '安全反馈', value: 'security_report' },
            ]}
          />
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item
          name="severity"
          label="严重程度"
          initialValue="medium"
        >
          <Select
            options={[
              { label: '低', value: 'low' },
              { label: '中', value: 'medium' },
              { label: '高', value: 'high' },
              { label: '紧急', value: 'critical' },
            ]}
          />
        </Form.Item>
      </Col>
    </Row>
    <Form.Item
      name="title"
      label="标题"
      rules={[{ required: true, message: '请输入标题' }]}
    >
      <Input placeholder="简洁描述你的反馈..." />
    </Form.Item>
    <Form.Item
      name="description"
      label="详细描述"
      rules={[{ required: true, message: '请输入详细描述' }]}
    >
      <Input.TextArea
        rows={6}
        placeholder="请详细描述你遇到的问题或建议...&#10;&#10;对于 Bug 报告，请包含：&#10;1. 复现步骤&#10;2. 预期行为&#10;3. 实际行为&#10;4. 截图（如有）"
      />
    </Form.Item>
    <Row gutter={16}>
      <Col span={12}>
        <Form.Item name="targetType" label="关联类型">
          <Select
            placeholder="选择关联类型"
            allowClear
            options={[
              { label: '页面', value: 'page' },
              { label: 'API', value: 'api' },
              { label: '文档', value: 'document' },
              { label: 'Skill', value: 'skill' },
              { label: 'Pipeline', value: 'pipeline' },
              { label: '部署', value: 'deployment' },
            ]}
          />
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item name="targetId" label="关联 ID">
          <Input placeholder="关联对象 ID（可选）" />
        </Form.Item>
      </Col>
    </Row>
    <Form.Item name="labels" label="标签">
      <Select mode="tags" placeholder="输入标签后回车" />
    </Form.Item>
  </Form>
</Modal>
```

#### 管理员侧 `/developer/feedback/manage`

**标题**：
```tsx
<Title level={2} style={{ marginBottom: 8 }}>
  <SettingOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
  反馈管理
</Title>
<Typography.Text type="secondary" style={{ fontSize: 14, color: colors.neutral[500] }}>
  分类、分配和处理用户反馈
</Typography.Text>
```

**交互细节**：

| 元素 | 交互行为 | loading | 空状态 | 错误处理 |
|------|----------|---------|--------|---------|
| 统计看板 | 按类型/状态/严重度的统计卡片 | skeleton | 无 | Alert |
| 筛选栏 | 类型 + 状态 + 严重度 + 时间范围多条件筛选 | 无 | 无 | 无 |
| 反馈列表 | 表格：标题、类型、提交人、严重度、状态、分配人、时间、操作 | skeleton | `Empty` + "暂无待处理反馈" | Alert + 重试 |
| 分类操作 | 行内快速操作：分类(→triaged) / 分配 / 解决 / 拒绝 | 操作时行内 loading | 无 | message.error |
| 批量操作 | 勾选多条后批量分配/变更状态 | 批量操作时 loading | 无 | message.error 显示失败条数 |
| 处理 Drawer | 点击处理打开 Drawer：状态变更、分配人、解决方案 | 保存时 loading | 无 | message.error + 保留值 |

**统计看板**：
```tsx
<Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
  <Col span={4}>
    <Card size="small" style={{ borderRadius: componentRadius.card }}>
      <Statistic title="待处理" value={stats.submitted} valueStyle={{ color: colors.warning[500] }} />
    </Card>
  </Col>
  <Col span={4}>
    <Card size="small" style={{ borderRadius: componentRadius.card }}>
      <Statistic title="处理中" value={stats.inProgress} valueStyle={{ color: colors.primary[500] }} />
    </Card>
  </Col>
  <Col span={4}>
    <Card size="small" style={{ borderRadius: componentRadius.card }}>
      <Statistic title="已解决" value={stats.resolved} valueStyle={{ color: colors.success[500] }} />
    </Card>
  </Col>
  <Col span={4}>
    <Card size="small" style={{ borderRadius: componentRadius.card }}>
      <Statistic title="已关闭" value={stats.closed} />
    </Card>
  </Col>
  <Col span={4}>
    <Card size="small" style={{ borderRadius: componentRadius.card }}>
      <Statistic title="本月新增" value={stats.thisMonth} />
    </Card>
  </Col>
  <Col span={4}>
    <Card size="small" style={{ borderRadius: componentRadius.card }}>
      <Statistic title="处理率" value={stats.resolutionRate} suffix="%" valueStyle={{ color: colors.success[500] }} />
    </Card>
  </Col>
</Row>
```

---

## 4. API 设计

### 4.1 Skill 市场增强 API

基础路径：`/api/v1/developer-portal`（Skill 已有 `/api/v1/skills`，保持独立）

| 方法 | 路径 | 描述 | 权限 | 请求体 | 响应 |
|------|------|------|------|--------|------|
| **现有** | `/api/v1/skills` | 列表/搜索 Skills | skill:read | query: category, tags, status, page | `{ data: SkillPackage[], total }` |
| **现有** | `/api/v1/skills/:id` | Skill 详情 | skill:read | - | `SkillPackage` |
| **现有** | `/api/v1/skills/:id/versions` | 版本列表 | skill:read | - | `SkillVersion[]` |
| **现有** | `/api/v1/skills/:id/reviews` | 评论列表 | skill:read | - | `SkillReview[]` |
| **现有** | `/api/v1/skills/:id/reviews` | 添加评论 | skill:write | `{ rating, comment }` | `SkillReview` |
| **新增** | `/api/v1/skills/:id/install` | 安装 Skill | skill:install | `{ instanceName?, config?, autoUpdate? }` | `{ success, instanceId }` |
| **新增** | `/api/v1/skills/:id/compatibility` | 兼容性矩阵 | skill:read | - | `{ orionVersions: [{ version, compatible, notes }] }` |
| **新增** | `/api/v1/skills/:id/reviews/:reviewId/vote` | 评论投票 | skill:write | `{ vote: 'up' | 'down' }` | `{ upvotes, downvotes }` |
| **新增** | `/api/v1/skills/batch-install` | 批量安装 | skill:install | `{ skillIds: string[], config? }` | `{ results: [{ skillId, success, error? }] }` |
| **新增** | `/api/v1/skills/:id/pre-install-preview` | 安装预览 | skill:install | - | `{ permissions, dependencies, configSchema }` |

### 4.2 SPI 扩展 API

基础路径：`/api/v1/developer-portal/spi-extensions`

| 方法 | 路径 | 描述 | 权限 | 请求体 | 响应 |
|------|------|------|------|--------|------|
| GET | `/` | 扩展列表 | spi_extension:read | query: point, status, page | `{ data: SPIExtension[], total }` |
| POST | `/` | 注册扩展 | spi_extension:write | `{ extensionPoint, extensionId, name, description, version?, priority?, config }` | `SPIExtension` |
| GET | `/:id` | 扩展详情 | spi_extension:read | - | `SPIExtension` |
| PUT | `/:id` | 更新扩展配置 | spi_extension:write | 部分更新字段 | `SPIExtension` |
| DELETE | `/:id` | 删除扩展 | spi_extension:write | - | `{ success: true }` |
| POST | `/:id/enable` | 启用扩展 | spi_extension:enable | - | `SPIExtension` |
| POST | `/:id/disable` | 停用扩展 | spi_extension:enable | - | `SPIExtension` |
| POST | `/:id/reload` | 热加载 | spi_extension:enable | - | `{ success, message }` |
| GET | `/extension-points` | 可用扩展点列表 | spi_extension:read | - | `{ points: [{ name, description, inputSchema }] }` |
| GET | `/:id/logs` | 扩展执行日志 | spi_extension:admin | query: page, limit | `{ data: ExtensionLog[], total }` |
| GET | `/stats` | 扩展统计 | spi_extension:read | - | `{ byPoint, byStatus, total, enabled, errors }` |

### 4.3 反馈 API

基础路径：`/api/v1/developer-portal/feedback`

| 方法 | 路径 | 描述 | 权限 | 请求体 | 响应 |
|------|------|------|------|--------|------|
| POST | `/` | 提交反馈 | feedback:write | `{ feedbackType, title, description, targetType?, targetId?, severity?, labels? }` | `Feedback` |
| GET | `/` | 反馈列表 | feedback:manage | query: type, status, severity, page, perPage | `{ data: Feedback[], total }` |
| GET | `/my` | 我的反馈 | feedback:read | query: page, perPage | `{ data: Feedback[], total }` |
| GET | `/:id` | 反馈详情 | feedback:read | - | `Feedback` |
| PUT | `/:id` | 更新反馈 | feedback:write | 部分更新字段 | `Feedback` |
| POST | `/:id/triage` | 分类反馈 | feedback:manage | `{ priority?, labels? }` | `Feedback` |
| POST | `/:id/assign` | 分配反馈 | feedback:manage | `{ assignee }` | `Feedback` |
| POST | `/:id/resolve` | 解决反馈 | feedback:manage | `{ resolution }` | `Feedback` |
| POST | `/:id/close` | 关闭反馈 | feedback:manage | - | `Feedback` |
| POST | `/:id/reject` | 拒绝反馈 | feedback:manage | `{ reason }` | `Feedback` |
| POST | `/:id/reopen` | 重新打开反馈 | feedback:manage | - | `Feedback` |
| POST | `/:id/comments` | 添加评论 | feedback:write | `{ content }` | `FeedbackComment` |
| GET | `/:id/comments` | 评论列表 | feedback:read | - | `FeedbackComment[]` |
| GET | `/stats` | 反馈统计 | feedback:manage | query: timeRange | `FeedbackStats` |
| POST | `/batch-assign` | 批量分配 | feedback:manage | `{ feedbackIds, assignee }` | `{ success, failed }` |

### 4.4 文档分类 API

基础路径：`/api/v1/developer-portal/categories`

| 方法 | 路径 | 描述 | 权限 | 请求体 | 响应 |
|------|------|------|------|--------|------|
| GET | `/` | 分类列表 | developer_portal:read | query: parent_id, visible | `{ data: Category[], total }` |
| GET | `/tree` | 分类树 | developer_portal:read | - | `{ tree: CategoryNode[] }` |
| POST | `/` | 创建分类 | developer_portal:write | `{ name, slug, description?, icon?, color?, parentId?, sortOrder? }` | `Category` |
| PUT | `/:id` | 更新分类 | developer_portal:write | 部分更新字段 | `Category` |
| DELETE | `/:id` | 删除分类 | developer_portal:delete | - | `{ success: true }` |
| POST | `/:id/move` | 移动分类（调整父子关系） | developer_portal:write | `{ parentId? }` | `Category` |

### 4.5 API 错误码

| HTTP 状态 | 错误码 | 描述 |
|-----------|--------|------|
| 400 | `INVALID_INPUT` | 请求参数校验失败 |
| 400 | `DUPLICATE_SLUG` | 分类 slug 重复 |
| 400 | `INVALID_TRANSITION` | 反馈状态转换不合法 |
| 401 | `UNAUTHORIZED` | 未登录或 token 过期 |
| 403 | `FORBIDDEN` | 权限不足 |
| 404 | `NOT_FOUND` | 资源不存在 |
| 409 | `CONFLICT` | 资源冲突（如 Skill 名称重复） |
| 422 | `VALIDATION_FAILED` | 业务规则校验失败 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 |

---

## 5. 验收标准

### 5.1 Skill 市场

| # | 标准 | 验证方式 |
|---|------|----------|
| SK-1 | Skill 列表按安装数/评分/创建时间排序 | 前端验证 + API 测试 |
| SK-2 | Skill 搜索支持名称、描述、作者模糊匹配 | 前端验证 |
| SK-3 | Skill 按分类/标签过滤 | 前端验证 |
| SK-4 | 安装 Skill 需二次确认，显示权限/依赖预览 | 前端验证 |
| SK-5 | 安装后 Skill 实例可在 Pipeline/Agent 中使用 | 集成测试 |
| SK-6 | 评分 1-5 星，评论支持文本 | API 测试 |
| SK-7 | 评分分布统计返回 1-5 星各自数量 | API 测试 |
| SK-8 | 版本历史记录 + Changelog | 前端验证 |
| SK-9 | 评论投票（点赞/反对） | API 测试 |
| SK-10 | 批量安装 Skills | API 测试 |

### 5.2 SPI 扩展框架

| # | 标准 | 验证方式 |
|---|------|----------|
| SPI-1 | 支持 9 个内置扩展点注册 | 前端验证 |
| SPI-2 | 扩展按优先级排序执行 | 集成测试（编写测试扩展，验证执行顺序） |
| SPI-3 | 扩展支持 4 种状态：disabled/enabled/error/deprecated | 前端验证 + API 测试 |
| SPI-4 | 热加载扩展无需重启服务 | 集成测试 |
| SPI-5 | 扩展执行错误自动记录到 error_message | API 测试 |
| SPI-6 | 扩展配置以 JSONB 存储，支持任意结构 | API 测试 |
| SPI-7 | 同一 tenant_id + extension_id 唯一 | API 测试（重复注册返回 409） |
| SPI-8 | RLS 策略确保租户隔离 | 数据库测试 |
| SPI-9 | 扩展执行超时 30s 自动标记为 error | 集成测试 |
| SPI-10 | 扩展列表支持按扩展点/状态筛选 | 前端验证 |

### 5.3 反馈机制

| # | 标准 | 验证方式 |
|---|------|----------|
| FB-1 | 支持 5 种反馈类型 | 前端验证 + API 测试 |
| FB-2 | 反馈提交需 title + description 必填 | 前端表单验证 |
| FB-3 | 反馈可关联页面/API/文档/Skill/Pipeline/部署 | API 测试 |
| FB-4 | 反馈状态机：submitted → triaged → in_progress → resolved → closed | API 测试 |
| FB-5 | 拒绝需填写 reason | API 测试 |
| FB-6 | 解决需填写 resolution | API 测试 |
| FB-7 | 非法状态转换返回 400 INVALID_TRANSITION | API 测试 |
| FB-8 | 反馈统计返回按类型/状态/严重度的计数 | API 测试 |
| FB-9 | 管理员可批量分配反馈 | API 测试 |
| FB-10 | 用户只能查看自己提交的反馈 | API 测试（越权访问返回 403） |
| FB-11 | RLS 策略确保租户隔离 | 数据库测试 |
| FB-12 | 反馈列表支持多条件筛选 | 前端验证 |

### 5.4 数据库

| # | 标准 | 验证方式 |
|---|------|----------|
| DB-1 | portal_categories 表创建成功，含所有索引和 RLS 策略 | SQL 执行验证 |
| DB-2 | portal_feedback 表创建成功，含所有 CHECK 约束 | SQL 执行验证 |
| DB-3 | 迁移 193 可回滚（执行 rollback.sql 后表不存在） | 回滚验证 |
| DB-4 | portal_categories 有对应的 rollback 文件 | 文件存在性验证 |
| DB-5 | portal_feedback 有对应的 rollback 文件 | 文件存在性验证 |
| DB-6 | updated_at 触发器正确工作 | SQL 测试 |
| DB-7 | document_count 触发器在文档增删时自动更新 | SQL 测试 |

### 5.5 前端交互完整性

| # | 标准 | 验证方式 |
|---|------|----------|
| UI-1 | 所有页面标题遵循 Design Token 规范（level={2}, 20px, 600, #1f1f1f） | 视觉验证 |
| UI-2 | 所有列表有空状态引导（Empty + 操作按钮） | 前端验证 |
| UI-3 | 所有异步操作有 loading 状态 | 前端验证 |
| UI-4 | 所有异步操作有成功/失败 message 提示 | 前端验证 |
| UI-5 | 所有表单有校验规则（必填项有 rules） | 前端验证 |
| UI-6 | 删除操作有二次确认（Popconfirm） | 前端验证 |
| UI-7 | 按钮在异步操作期间 disabled + loading | 前端验证 |
| UI-8 | 卡片使用 Design Token 圆角 (12px) 和阴影 | 视觉验证 |
| UI-9 | 响应式适配：>=1200px 完整布局，>=768px 隐藏次要列，<768px 卡片列表 | 前端验证 |
| UI-10 | 所有页面使用 Design Token 色彩（不用硬编码色值） | 代码审查 |

---

## 附录 A. 前端文件变更清单

| 文件 | 操作 | 描述 |
|------|------|------|
| `orion-frontend/src/pages/developer-portal/DeveloperPortalPage.tsx` | 修改 | 增强为门户首页（统计 + 快捷入口 + 跨模块搜索） |
| `orion-frontend/src/pages/SkillManagement/Marketplace.tsx` | 修改 | 调整路由为 `/developer/skills` |
| `orion-frontend/src/pages/SkillManagement/SkillDetail.tsx` | 新建 | Skill 详情页（含版本/评论/执行 Tab） |
| `orion-frontend/src/pages/spi-extensions/index.tsx` | 新建 | SPI 扩展管理页面 |
| `orion-frontend/src/pages/developer-portal/DocCenter.tsx` | 新建 | 文档中心页面（从现有页面拆分） |
| `orion-frontend/src/pages/developer-portal/FeedbackPage.tsx` | 新建 | 用户反馈中心 |
| `orion-frontend/src/pages/developer-portal/FeedbackManage.tsx` | 新建 | 管理员反馈管理 |
| `orion-frontend/src/api/developer-portal.ts` | 修改 | 新增 SPI 扩展和反馈 API 客户端方法 |
| `orion-frontend/src/api/spi-extensions.ts` | 新建 | SPI 扩展 API 客户端 |
| `orion-frontend/src/api/feedback.ts` | 新建 | 反馈 API 客户端 |
| `orion-frontend/src/router/routes.tsx` | 修改 | 新增 `/developer/*` 路由 |
| `orion-frontend/src/stores/menuConfigStore.ts` | 修改 | 更新生态模块菜单配置 |

## 附录 B. 后端文件变更清单

| 文件 | 操作 | 描述 |
|------|------|------|
| `orion-platform-service/src/db/migrations/193_developer_portal_extensions.sql` | 新建 | portal_categories + portal_feedback DDL |
| `orion-platform-service/src/db/migrations/193_developer_portal_extensions_rollback.sql` | 新建 | 回滚脚本 |
| `orion-platform-service/src/db/migrations/194_spi_extensions.sql` | 新建 | spi_extensions DDL |
| `orion-platform-service/src/db/migrations/194_spi_extensions_rollback.sql` | 新建 | 回滚脚本 |
| `orion-platform-service/src/repositories/PortalCategoryRepository.ts` | 新建 | 分类数据访问 |
| `orion-platform-service/src/repositories/FeedbackRepository.ts` | 新建 | 反馈数据访问 |
| `orion-platform-service/src/repositories/SPIExtensionRepository.ts` | 新建 | SPI 扩展数据访问 |
| `orion-platform-service/src/services/developer-portal/PortalCategoryService.ts` | 新建 | 分类业务逻辑 |
| `orion-platform-service/src/services/developer-portal/FeedbackService.ts` | 新建 | 反馈业务逻辑 |
| `orion-platform-service/src/services/developer-portal/SPIExtensionService.ts` | 新建 | SPI 扩展业务逻辑 |
| `orion-platform-service/src/services/developer-portal/SPIExtensionLoader.ts` | 新建 | 扩展加载器 |
| `orion-platform-service/src/api/controllers/PortalCategoryController.ts` | 新建 | 分类控制器 |
| `orion-platform-service/src/api/controllers/FeedbackController.ts` | 新建 | 反馈控制器 |
| `orion-platform-service/src/api/controllers/SPIExtensionController.ts` | 新建 | SPI 扩展控制器 |
| `orion-platform-service/src/api/spi-extension-routes.ts` | 新建 | SPI 扩展路由 |
| `orion-platform-service/src/api/feedback-routes.ts` | 新建 | 反馈路由 |
| `orion-platform-service/src/api/developer-portal-routes.ts` | 修改 | 新增分类 API 路由 |
| `orion-platform-service/src/api/routes.ts` | 修改 | 注册新路由 |

## 附录 C. 路由变更

```tsx
// orion-frontend/src/router/routes.tsx — 新增路由

// 开发者门户（生态模块子路由）
{
  path: '/developer',
  element: React.lazy(() => import('@/pages/developer-portal/DeveloperLayout')),
  protected: true,
  children: [
    { index: true, element: React.createElement(Navigate, { to: '/developer/portal', replace: true }) },
    { path: '/developer/portal', element: React.lazy(() => import('@/pages/developer-portal/DeveloperPortalPage')) },
    { path: '/developer/skills', element: React.lazy(() => import('@/pages/SkillManagement/Marketplace')) },
    { path: '/developer/skills/:id', element: React.lazy(() => import('@/pages/SkillManagement/SkillDetail')) },
    { path: '/developer/extensions', element: React.lazy(() => import('@/pages/spi-extensions')) },
    { path: '/developer/docs', element: React.lazy(() => import('@/pages/developer-portal/DocCenter')) },
    { path: '/developer/feedback', element: React.lazy(() => import('@/pages/developer-portal/FeedbackPage')) },
    { path: '/developer/feedback/manage', element: React.lazy(() => import('@/pages/developer-portal/FeedbackManage')), requiredPermission: { resource: 'feedback', action: 'manage' } },
  ],
}
```

---

_文档版本: v1.0 | 创建日期: 2026-05-22 | 状态: 设计完成_
