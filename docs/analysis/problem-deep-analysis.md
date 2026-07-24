# Problem Management 模块深度分析

**生成日期**: 2026-07-03  
**分析范围**: `orion-platform-service/src/services/problem/ProblemService.ts` + `src/api/problem-routes.ts`  
**路由前缀**: `/api/problems`  

---

## 一、现状概述

### 模块定位

Problem Management 遵循 ITIL 标准实现问题管理流程，涵盖问题（Problem）的完整生命周期管理、事件/变更关联、已知错误数据库（KEDB）运维，以及从事件自动创建问题。

### 文件结构

```
services/problem/
├── __tests__/
│   ├── ProblemRepository.test.ts
│   └── ProblemService.test.ts
├── index.ts                    # 导出 ProblemService
└── ProblemService.ts           # 核心业务逻辑 (~348 行)

api/problem-routes.ts           # 路由定义 (~268 行)
```

### 核心数据模型

问题实体（`ProblemEntity`）和已知错误实体（`KnownErrorEntity`）定义在 `repositories/ProblemRepository.ts` 中，通过 PostgreSQL Repository 模式持久化。

| 实体 | 关键字段 | 说明 |
|------|---------|------|
| ProblemEntity | id, tenantId, title, status, severity, category, rootCause, workaround, resolution, relatedIncidents[], relatedChanges[], assignedTo, metadata | 问题记录 |
| KnownErrorEntity | id, tenantId, problemId, title, symptoms, rootCause, workaround, permanentFix, affectedServices[], keywords[], status | 已知错误 |

---

## 二、功能矩阵

| 功能点 | 状态 | 说明 |
|--------|------|------|
| 问题创建 | ✅ 完整 | 支持标题必填校验，自动生成状态为 `known` |
| 问题查询（单个） | ✅ 完整 | 支持租户隔离的 ID 查询 |
| 问题列表（分页） | ✅ 完整 | 支持 status/severity/assignedTo/category 过滤 + 分页 |
| 问题更新 | ✅ 完整 | 支持所有字段部分更新 |
| 问题删除 | ✅ 完整 | 逻辑删除（hard delete） |
| 状态流转 | ✅ 完整 | `known→investigating→resolved→closed`，含非法转换校验 |
| 关联事件（Incident） | ✅ 完整 | 支持将事件关联到问题，去重处理 |
| 关联变更（Change） | ✅ 完整 | 支持将变更关联到问题，去重处理 |
| 统计信息 | ✅ 完整 | 按租户返回问题统计汇总 |
| KEDB 创建 | ✅ 完整 | title/symptoms/rootCause/workaround 为必填 |
| KEDB 查询/列表/更新/删除 | ✅ 完整 | 完整 CRUD |
| KEDB 搜索 | ✅ 完整 | 基于关键词搜索 |
| KEDB 关键词匹配 | ✅ 完整 | 按 keywords 数组匹配 |
| 事件自动创建问题 | ⚠️ 部分实现 | 基础功能实现，但缺少事件系统触发集成 |
| 问题通知 | ❌ 缺失 | 状态变更/分配变更无自动通知 |

---

## 三、API 端点

| 方法 | 路径 | 控制器 | 说明 | ACL |
|------|------|--------|------|-----|
| POST | `/api/problems` | `createProblem` | 创建问题 | resource:problem, action:write |
| GET | `/api/problems` | `listProblems` | 问题列表 | resource:problem, action:read |
| GET | `/api/problems/stats` | `getStats` | 问题统计 | resource:problem, action:read |
| GET | `/api/problems/known-errors` | `listKnownErrors` | KEDB 列表 | resource:problem, action:read |
| GET | `/api/problems/known-errors/search` | `searchKnownErrors` | KEDB 搜索 | resource:problem, action:read |
| POST | `/api/problems/known-errors` | `createKnownError` | 创建 KEDB | resource:problem, action:write |
| GET | `/api/problems/:id` | `getProblem` | 问题详情 | resource:problem, action:read |
| PUT | `/api/problems/:id` | `updateProblem` | 更新问题 | resource:problem, action:write |
| DELETE | `/api/problems/:id` | `deleteProblem` | 删除问题 | resource:problem, action:delete |
| PATCH | `/api/problems/:id/status` | `updateStatus` | 状态变更 | resource:problem, action:write |
| POST | `/api/problems/:id/incidents` | `linkIncident` | 关联事件 | resource:problem, action:write |
| POST | `/api/problems/:id/changes` | `linkChange` | 关联变更 | resource:problem, action:write |
| PUT | `/api/problems/known-errors/:id` | `updateKnownError` | 更新 KEDB | resource:problem, action:write |
| DELETE | `/api/problems/known-errors/:id` | `deleteKnownError` | 删除 KEDB | resource:problem, action:delete |

---

## 四、依赖关系

| 依赖 | 类型 | 说明 |
|------|------|------|
| `ProblemRepository` | 内部依赖 | PostgreSQL 持久化层，含 `findByIdAndTenant` 租户隔离 |
| `KnownErrorRepository` | 内部依赖 | KEDB 数据访问层 |
| `authenticateUser` 中间件 | 基础服务 | 认证中间件 |
| `requirePermission` 中间件 | 基础服务 | RBAC 权限控制 |

---

## 五、风险与改进建议

| 风险 | 级别 | 建议 |
|------|------|------|
| **状态流转阀值定义在代码中**，不可配置 | P1 | 将 `VALID_STATUS_TRANSITIONS` 抽取到数据库或配置中心，支持自定义工作流 |
| **KEDB 搜索为简单字符串匹配**，非全文索引 | P1 | 迁移到 PostgreSQL `tsvector` 全文搜索，或集成 Elasticsearch |
| **缺少问题通知机制** | P1 | 状态变更/分配变更时通过 EventBus 发布事件，集成通知服务 |
| **事件自动创建问题无自动触发** | P2 | 通过 EventBus 订阅 `incident.created` 事件自动触发 `createFromIncident` |
| **KEDB 去重逻辑缺失** | P2 | 相同 symptoms+keywords 应检测重复 |
| **测试覆盖**：存在 `ProblemService.test.ts` 和 `ProblemRepository.test.ts` | ⚠️ 需确认覆盖率 | 建议确认核心状态流转和边界校验的测试覆盖率 |

---

## 六、总结

Problem Management 模块实现了 ITIL 问题管理的核心流程，包括问题的完整 CRUD、状态生命周期管理、事件/变更关联以及 KEDB 运维。采用 PostgreSQL Repository 模式，支持租户隔离和 RBAC 权限控制。代码结构清晰，API 设计符合 RESTful 规范。

**主要短板**：
1. 缺少自动通知机制（状态变更、分配变更）
2. KEDB 搜索能力有限，仅支持关键词精确匹配
3. 状态流转逻辑硬编码，不可灵活配置
4. 事件→问题的自动创建缺少事件系统触发集成

**评分**: 7/10 — 核心功能完整，但缺少自动化集成和配置灵活性。
