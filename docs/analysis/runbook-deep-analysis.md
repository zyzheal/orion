# Runbook 深度分析报告

> **生成日期**: 2026-07-02
> **分析范围**: `orion-platform-service` 的 Runbook（运维手册）模块，涵盖服务层、数据访问层、路由层与测试覆盖。

---

## 一、现状概述

### 模块定位

Runbook 模块提供运维手册（Runbook）的定义和执行管理。Runbook 是一系列可以手动执行或自动触发的运维步骤的组合，典型场景包括故障恢复、例行变更、部署验证等。

### 文件结构

```
services/runbook/
├── __tests__/
│   └── RunbookService.test.ts      # 101 行 — 极简测试
├── index.ts
├── RunbookService.ts               # 210 行 — 业务逻辑
└── RunbookRepository.ts            # 134 行 — 含 2 个 Repository 类

api/runbook-routes.ts               # 162 行 — 路由注册
```

### 核心数据模型

| 模型 | 数据库表 | 说明 |
|------|---------|------|
| `RunbookDefinitionEntity` | `runbook_definitions` | Runbook 定义，含名称/分类/步骤/变量/启用状态 |
| `RunbookExecutionEntity` | `runbook_executions` | 执行记录，含当前步骤索引/步骤结果 |
| `RunbookStep` | — | 步骤定义（嵌入 JSON），类型: `manual` / `script` / `approval` / `notification` |
| `RunbookStepResult` | — | 步骤执行结果（嵌入 JSON） |

**步骤类型**: 支持 4 种步骤类型（manual/script/approval/notification），但实际执行逻辑需外部编排。

### 持久化方式

**全部 PostgreSQL** — 2 个 Repository 均继承 `BaseRepository`，steps/variables/context/stepResults 存储为 JSON。

---

## 二、功能矩阵

| 功能点 | 状态 | 说明 |
|--------|------|------|
| 创建 Runbook | ✅ 完整 | `POST /runbooks`，支持 steps/variables 定义 |
| 获取 Runbook 详情 | ✅ 完整 | 按 ID 查询 |
| 列出 Runbook | ✅ 完整 | 支持按 category/enabled 过滤 |
| 更新 Runbook | ✅ 完整 | `PUT /:id`，支持全字段更新 |
| 删除 Runbook | ✅ 完整 | 级联删除执行记录 |
| 执行 Runbook | ✅ 完整 | 创建执行记录，初始化步骤状态为 pending |
| 获取执行详情 | ✅ 完整 | 按执行记录 ID 查询 |
| 获取执行历史 | ✅ 完整 | 按 Runbook ID 查询，支持 limit |
| 更新步骤状态 | ✅ 完整 | `updateExecutionStep` 支持 running/completed/failed/skipped |
| 取消执行 | ✅ 完整 | 校验状态后标记为 cancelled |
| 自动执行脚本步骤 | ❌ 缺失 | 步骤类型 `script` 无实际脚本执行引擎 |
| 通知发送 | ❌ 缺失 | 步骤类型 `notification` 无集成 |
| 人工审批流 | ❌ 缺失 | 步骤类型 `approval` 无审批接口 |
| 超时检测 | ❌ 缺失 | `RunbookStep` 定义了 `timeoutSeconds` 但未使用 |

---

## 三、API 端点

| 方法 | 路径 | 控制器方法 | 说明 |
|------|------|-----------|------|
| `POST` | `/runbooks` | `create` | 创建 Runbook 定义 |
| `GET` | `/runbooks` | `list` | 列出 Runbook（过滤参数） |
| `GET` | `/runbooks/:id` | `get` | 获取 Runbook 详情 |
| `PUT` | `/runbooks/:id` | `update` | 更新 Runbook |
| `DELETE` | `/runbooks/:id` | `delete` | 删除 Runbook |
| `POST` | `/runbooks/:id/execute` | `execute` | 执行 Runbook |
| `GET` | `/runbooks/:id/executions` | `getExecutionHistory` | 获取执行历史 |
| `GET` | `/runbooks/executions/:executionId` | `getExecution` | 获取执行详情 |
| `POST` | `/runbooks/executions/:executionId/step` | — | ❌ 未实现（更新步骤状态仅在 Service 层） |
| `POST` | `/runbooks/executions/:executionId/cancel` | — | ❌ 未实现（取消仅在 Service 层） |

**路由注册**: `routes.ts` → `registerWithRoleGuard(app, runbookRoutes, '/runbooks')`

**认证**: 所有端点有 `authenticateUser`
**授权**: 使用 4 种 action: `read` / `create` / `update` / `delete` / `execute`

---

## 四、依赖关系

| 依赖 | 类型 | 用途 |
|------|------|------|
| `../../utils/logger` | 内部 | 结构化日志 |
| `../../db/tenant-context-storage` | 内部 | 租户上下文 |
| `../../errors` | 内部 | 异常处理 |
| `../../db/base-repository` | 内部 | 基础 Repository |
| `../../middleware/authMiddleware` | 内部 | 用户认证 |
| `../../middleware/requirePermission` | 内部 | 权限控制 |
| `../../utils/replyHelper` | 内部 | 统一响应格式 |

**无外部 npm 依赖** — 模块自包含，仅依赖内部基础设施。

---

## 五、风险与改进建议

| 风险 | 级别 | 建议 |
|------|------|------|
| **测试覆盖极低** — 仅 101 行测试，仅覆盖 `create`/`get`/`list` 基本路径，无 `execute`/`updateExecutionStep`/`cancelExecution` 等核心逻辑测试 | P0 | 补充执行流程测试、状态转换测试、异常路径测试 |
| **步骤执行引擎缺失** — 4 种步骤类型（manual/script/approval/notification）均无实际执行逻辑，`execute` 仅创建记录 | P1 | 设计步骤执行引擎：script 调 Script Library、approval 调审批服务、notification 调通知服务 |
| **步骤状态更新无路由暴露** — `updateExecutionStep` 仅在 Service 层有实现，路由层未暴露，外部无法驱动步骤流转 | P1 | 增加 `POST /runbooks/executions/:executionId/step/:stepIndex` 路由 |
| **取消执行无路由暴露** — `cancelExecution` 在 Service 层有实现但无路由端点 | P1 | 增加 `POST /runbooks/executions/:executionId/cancel` 路由 |
| **执行历史无租户过滤** — `findByRunbookId` 未使用 `tenant_id` 过滤，可能泄露跨租户数据 | P1 | `RunbookExecutionRepository.findByRunbookId` 增加 `tenantId` 参数 |
| **JSON 字段缺乏校验** — steps/variables/context/stepResults 存储为 JSON，但写入时无 schema 校验 | P2 | 引入 JSON Schema 校验或序列化器确保数据完整性 |
| **step 模型缺少 `dependsOn` 支持** — 当前步骤顺序由 `order` 控制，无依赖图支持 | P2 | 如需复杂步骤编排，需引入 DAG 依赖模型 |
| **超时机制未实现** — `RunbookStep.timeoutSeconds` 定义但未使用 | P2 | 执行步骤时检测超时并自动标记为 failed |

---

## 六、总结

Runbook 模块**实现了 PostgreSQL 持久化**，提供 Runbook 定义和执行记录管理的基础框架，Service 层的状态机设计合理（支持 pending → running → completed/failed/cancelled 转换）。

**核心优势**:
- 步骤类型定义丰富（4 种类型），可扩展性强
- 执行状态机设计完整（含步骤级结果追踪）
- 数据模型清晰，JSON 存储灵活

**主要短板**:
1. **测试覆盖极低** — 101 行测试仅覆盖基础 CRUD，核心执行逻辑无测试
2. **无实际执行引擎** — 所有步骤类型均无实现，Runbook 无法真正执行
3. **路由层不完整** — 步骤状态更新和取消执行两个关键操作未暴露为 API
4. **租户过滤缺失** — 执行历史查询缺少 tenant_id

**综合评估**: Runbook 是一个架构设计良好但"骨架化"的模块。可作为流程编排的基础设施，但当前状态需要大量补充才能投入生产使用。建议优先补齐路由暴露和执行引擎，再补充测试覆盖。
