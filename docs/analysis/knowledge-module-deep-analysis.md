# Knowledge（知识库）模块深度分析报告

**生成日期**: 2026-07-03
**分析模块**: `orion-platform-service/src/services/knowledge/`、`docs/services/knowledge/`

---

## 模块概述

Knowledge 模块承担 **知识空间管理、文档管理、文档搜索、知识同步** 四大职责。当前实现处于**早期实现阶段**：核心 CRUD 和搜索已实现，但缺乏与 AI 生态的深度集成（如 RAG、Embedding）。

| 子域 | 目录/文件 | 当前状态 |
|------|----------|----------|
| 知识空间 | `KnowledgeService.ts` + `KnowledgeRepository.ts` | ✅ 完整（PostgreSQL） |
| 文档管理 | `KnowledgeService.ts` + `KnowledgeRepository.ts` | ✅ 完整（PostgreSQL） |
| 文档搜索 | `KnowledgeService.ts` | ✅ 基础搜索 |
| 知识同步 | `KnowledgeService.ts` | ⚠️ 同步逻辑存在，待验证 |
| RAG 检索 | ❌ | 未实现 |
| Embedding | ❌ | 未实现 |

---

## 架构设计

### 分层结构

```
API Routes (待补充)
    ↓
Service Layer (KnowledgeService)
    ↓
Repository Layer (KnowledgeRepository)
    ↓
PostgreSQL (knowledge_spaces, knowledge_docs, knowledge_doc_versions)
```

### 关键设计模式

- **Repository Pattern**：`KnowledgeRepository` 封装 PostgreSQL 操作
- **空间-文档模式**：Space 组织文档，支持层级结构
- **版本管理**：文档支持版本历史
- **同步模式**：`TicketToKnowledgeService` 实现工单到知识的同步

---

## 功能完整性评估

### 知识空间管理

| 功能 | 状态 | 说明 |
|------|------|------|
| 创建空间 | ✅ | 支持 name/description/type |
| 查询列表 | ✅ | 支持搜索/分页 |
| 更新空间 | ✅ | 支持更新名称/描述 |
| 删除空间 | ✅ | 级联删除文档 |
| 空间类型 | ✅ | 支持多种空间类型 |

### 文档管理

| 功能 | 状态 | 说明 |
|------|------|------|
| 创建文档 | ✅ | 支持 title/content/space_id/tags |
| 查询列表 | ✅ | 支持多条件过滤 |
| 更新文档 | ✅ | 支持更新内容/标签 |
| 删除文档 | ✅ | 软删除/硬删除 |
| 文档版本 | ✅ | 版本历史管理 |
| 文档标签 | ✅ | 标签管理 |
| 文档分类 | ⚠️ | 分类存在，待完善 |

### 文档搜索

| 功能 | 状态 | 说明 |
|------|------|------|
| 全文搜索 | ⚠️ | 基础 ILIKE 搜索 |
| 标签过滤 | ✅ | 支持标签过滤 |
| 空间过滤 | ✅ | 支持空间过滤 |
| 语义搜索 | ❌ | 未实现（需 Embedding） |
| 搜索结果排序 | ❌ | 未实现相关性排序 |

### 知识同步

| 功能 | 状态 | 说明 |
|------|------|------|
| 工单同步 | ✅ | TicketToKnowledgeService 实现 |
| 同步日志 | ✅ | SyncLog 记录同步状态 |
| 同步失败重试 | ✅ | 支持重试 |
| 自动同步 | ⚠️ | 触发机制待确认 |

### RAG 检索

| 功能 | 状态 | 说明 |
|------|------|------|
| Embedding | ❌ | 未实现 |
| 向量存储 | ❌ | 未实现（vector-store 模块存在但未集成） |
| RAG 检索 | ❌ | 未实现 |
| 上下文管理 | ❌ | 未实现 |

---

## API 端点清单

### 推测端点（需验证路由注册）

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/v1/knowledge/spaces` | 创建空间 |
| GET | `/api/v1/knowledge/spaces` | 空间列表 |
| GET | `/api/v1/knowledge/spaces/:id` | 空间详情 |
| PUT | `/api/v1/knowledge/spaces/:id` | 更新空间 |
| DELETE | `/api/v1/knowledge/spaces/:id` | 删除空间 |
| POST | `/api/v1/knowledge/docs` | 创建文档 |
| GET | `/api/v1/knowledge/docs` | 文档列表 |
| GET | `/api/v1/knowledge/docs/:id` | 文档详情 |
| PUT | `/api/v1/knowledge/docs/:id` | 更新文档 |
| DELETE | `/api/v1/knowledge/docs/:id` | 删除文档 |
| GET | `/api/v1/knowledge/search` | 搜索文档 |
| POST | `/api/v1/knowledge/sync` | 触发同步 |
| GET | `/api/v1/knowledge/syncs` | 同步历史 |

**待确认**：路由文件是否存在并注册。

---

## 数据模型

### KnowledgeSpace

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| tenant_id | UUID | 租户 ID |
| name | string | 空间名称 |
| description | text | 描述 |
| type | enum | 空间类型 |
| settings | JSONB | 配置 |
| created_by | UUID | 创建人 |
| created_at | timestamp | 创建时间 |

### KnowledgeDoc

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| tenant_id | UUID | 租户 ID |
| space_id | UUID | 所属空间 |
| title | string | 文档标题 |
| content | text | 文档内容 |
| tags | string[] | 标签 |
| category | string | 分类 |
| status | enum | draft/published/archived |
| version | integer | 版本号 |
| created_by | UUID | 创建人 |
| created_at | timestamp | 创建时间 |

### KnowledgeDocVersion

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| doc_id | UUID | 关联文档 |
| version | integer | 版本号 |
| content | text | 版本内容 |
| change_summary | text | 变更摘要 |
| created_by | UUID | 创建人 |
| created_at | timestamp | 创建时间 |

### SyncLog

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| source_type | enum | 同步源类型 |
| source_id | string | 同步源 ID |
| status | enum | pending/running/success/failed |
| total_docs | integer | 总文档数 |
| success_docs | integer | 成功数 |
| failed_docs | integer | 失败数 |
| error_message | text | 错误信息 |
| started_at | timestamp | 开始时间 |
| completed_at | timestamp | 完成时间 |

---

## 依赖关系

| 模块 | 集成点 | 状态 |
|------|--------|------|
| Ticket | 工单同步到知识库 | ✅ TicketToKnowledgeService |
| Tenant | 多租户隔离 | ✅ |
| Auth | 认证授权 | ❌ 未接入 |
| AI/LLM | RAG 检索 | ❌ 未集成 |
| VectorStore | 向量存储 | ❌ 未集成 |
| Notification | 同步通知 | ❌ 未集成 |

---

## 问题清单

### P0 级（阻塞生产）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 无认证授权 | 安全风险 | 接入 authenticateUser + requirePermission |
| 无 RAG 检索 | AI 无法检索知识 | 实现 Embedding + 向量搜索 |
| 搜索为 ILIKE | 性能差/效果差 | 升级到全文搜索或向量搜索 |

### P1 级（高优先级）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 无前端页面 | 用户无法使用 | 开发知识库管理页面 |
| 无文档分类 | 组织混乱 | 实现文档分类体系 |
| 无权限控制 | 数据泄露风险 | 实现文档级权限控制 |
| 无知识推荐 | 用户体验差 | 实现基于行为的推荐 |

### P2 级（改进项）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 无文档评论 | 协作能力差 | 实现评论/批注 |
| 无文档收藏 | 用户体验差 | 实现收藏功能 |
| 无知识图谱 | 关联性差 | 实现知识图谱 |
| 无多语言支持 | 国际化不足 | 实现多语言 |

---

## 技术债务

| 类别 | 债务项 | 风险 | 建议 |
|------|--------|------|------|
| 无认证授权 | 待确认路由 | 高 | 接入权限中间件 |
| 无 RAG | 无 Embedding | 高 | 实现 Embedding + 向量搜索 |
| 基础搜索 | ILIKE 搜索 | 中 | 升级全文搜索 |
| 无前端 | 无管理页面 | 中 | 开发前端页面 |
| 无权限控制 | 文档级权限 | 中 | 实现 ACL |

---

## 与其他模块集成点

| 模块 | 集成点 | 状态 |
|------|--------|------|
| Ticket | 工单同步 | ✅ |
| Tenant | 多租户 | ✅ |
| Auth | 认证授权 | ❌ |
| AI/LLM | RAG | ❌ |
| VectorStore | 向量存储 | ❌ |
| Notification | 通知 | ❌ |

---

## 建议优先级

### Phase 1：基础能力（1-2 周）

1. 接入 authenticateUser + requirePermission
2. 实现文档级权限控制
3. 开发知识库管理前端页面
4. 实现文档分类体系

### Phase 2：AI 增强（3-4 周）

5. 实现 Embedding 生成
6. 集成 VectorStore 实现向量搜索
7. 实现 RAG 检索接口
8. 实现知识推荐

### Phase 3：协作与智能（4-6 周）

9. 实现文档评论/批注
10. 实现知识图谱
11. 实现文档收藏/点赞
12. 实现多语言支持

---

## 结论

Knowledge 模块**核心 CRUD 完整**，但存在**严重 AI 能力缺口**（无 Embedding、无 RAG）和**体验缺口**（无前端、无权限控制）。

**关键缺失**：认证授权、RAG 检索、前端页面、权限控制。

建议优先接入权限并开发前端，再重点建设 AI 检索能力（Embedding + 向量搜索），使知识库成为 AI 生态的核心数据源。
