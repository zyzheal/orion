# Script Library 深度分析报告

> **生成日期**: 2026-07-02
> **分析范围**: `orion-platform-service` 的 Script Library（脚本库）模块，涵盖 4 个 Repository、服务层、路由层与测试覆盖。
> **对应功能**: 脚本定义 CRUD、版本管理、参数管理、执行追踪

---

## 一、现状概述

### 模块定位

Script Library 模块提供企业级脚本管理功能，包括脚本的创建/编辑/删除、版本管理（含回滚）、参数模板定义、执行记录追踪。可用于自动化运维、故障处理等场景。

### 文件结构

```
services/script-library/
├── __tests__/
│   └── ScriptVersionRepository.test.ts     # 169 行 — 仅 Repository 测试
├── index.ts
├── ScriptLibraryService.ts                 # 285 行 — 业务逻辑
├── ScriptLibraryRepository.ts              # 63 行 — 脚本主表数据访问
├── ScriptVersionRepository.ts              # 63 行 — 版本数据访问
├── ScriptParameterRepository.ts            # 89 行 — 参数数据访问
└── ScriptExecutionRepository.ts            # 53 行 — 执行记录数据访问

api/script-library-routes.ts                # 238 行 — 路由注册
models/ScriptVersion.ts                     # 60 行 — 版本模型（部分冗余）
```

### 核心数据模型

| 模型 | 数据库表 | 说明 |
|------|---------|------|
| `ScriptLibraryEntity` | `script_library` | 脚本主实体，含名称/类型/分类/标签/版本号/启用状态 |
| `ScriptVersionEntity` | `script_version` | 脚本内容版本，含 SHA256 checksum |
| `ScriptParameterEntity` | `script_parameter` | 脚本参数定义（键/类型/标签/必填/默认值/排序） |
| `ScriptExecutionEntity` | `script_execution` | 执行记录（目标/参数/状态/输出/时长） |

### 持久化方式

**全部 PostgreSQL** — 4 个 Repository 均继承 `BaseRepository`，使用参数化 SQL。

---

## 二、功能矩阵

| 功能点 | 状态 | 说明 |
|--------|------|------|
| 列出脚本 | ✅ 完整 | 支持按 category/enabled 过滤 |
| 获取脚本详情 | ✅ 完整 | 按 ID 查询 |
| 创建脚本 | ✅ 完整 | 创建时自动生成初始版本 v1 和参数 |
| 更新脚本 | ✅ 完整 | `PUT /:id`，支持更新 name/description/type/category/tags/enabled |
| 删除脚本 | ✅ 完整 | 级联删除版本/参数/执行记录 |
| 获取版本列表 | ✅ 完整 | 按脚本 ID 查询所有版本 |
| 创建新版本 | ✅ 完整 | 自动递增版本号，生成 SHA256 checksum |
| 回滚到指定版本 | ✅ 完整 | 基于目标版本内容创建新版本（版本号递增） |
| 获取参数列表 | ✅ 完整 | 按脚本 ID 查询参数定义 |
| 执行脚本 | ✅ 完整 | 创建执行记录（pending 状态），需脚本 enabled |
| 获取执行历史 | ✅ 完整 | 按脚本 ID 查询，支持 limit 参数 |
| 获取执行详情 | ✅ 完整 | 按执行记录 ID 查询 |
| 参数的增删改 | ⚠️ 部分实现 | `upsertBulk` 先删后插，无独立的单参数更新 API |
| 执行引擎 | ❌ 缺失 | `executeScript` 仅创建记录，无实际执行逻辑 |
| 脚本内容对比 diff | ❌ 缺失 | 模型层有 `ScriptVersionDiff` 但无实现 |

---

## 三、API 端点

| 方法 | 路径 | 控制器方法 | 说明 |
|------|------|-----------|------|
| `GET` | `/script-library` | `listScripts` | 列出脚本（过滤参数） |
| `POST` | `/script-library` | `createScript` | 创建脚本 |
| `GET` | `/script-library/:id` | `getScript` | 获取脚本详情 |
| `PUT` | `/script-library/:id` | `updateScript` | 更新脚本 |
| `DELETE` | `/script-library/:id` | `deleteScript` | 删除脚本 |
| `GET` | `/script-library/:id/versions` | `getVersions` | 获取版本列表 |
| `POST` | `/script-library/:id/versions` | `createVersion` | 创建新版本 |
| `POST` | `/script-library/:id/versions/:version/rollback` | `rollbackVersion` | 回滚到指定版本 |
| `GET` | `/script-library/:id/parameters` | `getParameters` | 获取参数列表 |
| `POST` | `/script-library/:id/execute` | `executeScript` | 执行脚本 |
| `GET` | `/script-library/:id/executions` | `getExecutionHistory` | 获取执行历史 |
| `POST` | `/script-library/:id/parameters/bulk` | — | ❌ 未实现批量参数更新路由 |

**路由注册**: `routes.ts` → `registerWithRoleGuard(app, scriptLibraryRoutes, '/script-library')`

**认证**: 所有端点有 `authenticateUser`
**授权**: 使用 5 种 action: `read` / `create` / `update` / `delete` / `execute`

---

## 四、依赖关系

### 内部依赖

| 依赖 | 类型 | 用途 |
|------|------|------|
| `../../utils/logger` | 内部 | 结构化日志 |
| `../../db/tenant-context-storage` | 内部 | 租户上下文 |
| `../../errors` | 内部 | 异常处理 |
| `../../db/base-repository` | 内部 | 基础 Repository |
| `../../middleware/authMiddleware` | 内部 | 用户认证 |
| `../../middleware/requirePermission` | 内部 | 权限控制 |
| `../../utils/replyHelper` | 内部 | 统一响应格式 |
| `crypto` | Node 内置 | SHA256 checksum 生成 |

### 模块间依赖

- **`models/ScriptVersion.ts`** — 存在模型层定义，但与 Repository 层的 `ScriptVersionEntity` 有字段差异（model 用 `contentHash`，repository 用 `checksum`），存在不一致风险

---

## 五、风险与改进建议

| 风险 | 级别 | 建议 |
|------|------|------|
| **无服务层测试** — 仅有 `ScriptVersionRepository.test.ts`（169 行），Service 层 0 测试覆盖 | P0 | 补充 `ScriptLibraryService.test.ts`，覆盖 CRUD/版本管理/执行全链路 |
| **脚本执行无实际执行引擎** — `executeScript` 仅创建执行记录，不真正运行脚本 | P1 | 需集成脚本执行引擎（Shell/Python/Container），并支持 SSE 实时日志 |
| **参数更新无独立 API** — 只能通过 `upsertBulk` 全量替换，没有单参数增删改接口 | P1 | 增加 `POST /:id/parameters` / `PUT /:id/parameters/:key` / `DELETE /:id/parameters/:key` |
| **模型层与 Repository 层 Entity 定义不一致** — `ScriptVersion` 模型的 `contentHash` vs Repository 的 `checksum`，字段名不统一 | P2 | 统一为 `checksum` 或 `contentHash` |
| **缺少脚本分类管理** — category 仅为字符串字段，无分类的 CRUD 管理 | P2 | 若需要分类体系，应设计独立的分类管理接口 |
| **获取脚本列表无分页** — `listScripts` 直接调用 `findByTenant` 未传 limit/offset | P1 | 补充分页参数，避免数据量大时性能问题 |
| **回滚操作不保存回滚者信息** — `rollbackVersion` 的 `createdBy` 传 `null` | P2 | 从路由层传递 userId |

---

## 六、总结

Script Library 模块**已完整实现 PostgreSQL 持久化**（4 个 Repository 均基于 `BaseRepository`），功能覆盖脚本 CRUD、版本管理、参数管理、执行记录四大领域。

**核心优势**:
- 数据模型设计清晰，tenant_id 隔离完整
- 版本管理支持回滚（基于内容复制的版本快照模式）
- 参数使用 upsert 模式，支持批量覆盖
- 所有 Repository 使用参数化 SQL，安全性好

**主要短板**:
1. **测试覆盖严重不足** — Service 层无任何测试（仅 169 行 Repository 测试），风险极高
2. **脚本执行是空壳** — 只记录执行请求，无实际执行能力
3. **缺少分页** — 列表接口无 limit/offset 参数
4. **参数管理不完整** — 缺少独立增删改 API

**综合评估**: 模块具有扎实的持久化基础，但测试和执行能力是两个明显的 P0/P1 缺口。建议优先补充 Service 层测试，然后实现脚本执行引擎。
