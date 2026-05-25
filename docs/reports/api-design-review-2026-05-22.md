# API接口设计评审报告

> 评审对象：`docs/reports/new-module-identification-2026-05-22-v2.md` 第八节 "API接口设计"
> 评审日期：2026-05-22
> 评审依据：现有 `orion-platform-service/src/api/` 下的实际路由实现风格

---

## 一、RESTful规范评估

### 1.1 数据库DevOps平台 (8.1)

| 评估项 | 评分 | 说明 |
|--------|------|------|
| 资源路径 | 7/10 | `/api/v1/db-audit/rules` 合理，但 `db-audit` 与模块名称 "数据库DevOps" 不一致，建议用 `dbops` |
| HTTP方法 | 9/10 | CRUD方法使用正确，POST/GET/PUT/DELETE 符合规范 |
| 子资源设计 | 8/10 | `/rules/:id/toggle` 使用POST动作型路径合理（非纯资源操作） |
| 问题 | | `/api/v1/db-audit/execute` 是动作而非资源，建议改为 `POST /api/v1/db-audit/audit-tasks`（创建审核任务即触发执行） |

### 1.2 开发者门户 (8.2)

| 评估项 | 评分 | 说明 |
|--------|------|------|
| 资源路径 | 6/10 | `/api/v1/portal/apis` 路径中 `portal/apis` 嵌套过深，且现有实现已用 `/api/v1/developer-portal/documents` |
| HTTP方法 | 7/10 | `GET /api/v1/portal/test/online` 使用GET进行测试操作不合理，应为POST |
| 子资源设计 | 7/10 | `/apis/:id/versions/:version` 设计合理 |
| 问题 | | `/api/v1/portal/mock/generate` (GET) 和 `/api/v1/portal/mock/:apiId` (POST/GET/DELETE) 路径风格不一致，generate 应合并到 mock 资源中 |

### 1.3 配额与计费系统 (8.3)

| 评估项 | 评分 | 说明 |
|--------|------|------|
| 资源路径 | 7/10 | `/api/v1/billing/templates` 和 `/api/v1/billing/quotas` 分组合理 |
| HTTP方法 | 8/10 | 基本正确，`PUT .../approve` 和 `PUT .../reject` 可接受但更推荐 POST |
| 问题 | | `/api/v1/billing/quotas/:tenantId/claim` 中 tenantId 在路径中，但现有系统 tenantId 从请求上下文获取，不应出现在路径中 |

### 1.4 元数据管理系统 (8.4)

| 评估项 | 评分 | 说明 |
|--------|------|------|
| 资源路径 | 6/10 | `/api/v1/metadata/values/:entityType/:entityId` 路径设计复杂，复合路径参数不易维护 |
| HTTP方法 | 7/10 | `POST /api/v1/metadata/values` 批量写入，建议明确为批量操作端点 |
| 问题 | | `DELETE /api/v1/metadata/values/:entityType/:entityId` 删除实体元数据，但未区分是删除单个字段还是全部元数据 |

### 1.5 完整链路追踪 (8.5)

| 评估项 | 评分 | 说明 |
|--------|------|------|
| 资源路径 | 8/10 | `/api/v1/tracing/traces` 和 `/api/v1/tracing/services` 路径清晰 |
| HTTP方法 | 9/10 | 以读为主，GET使用正确 |
| 子资源设计 | 8/10 | `/traces/:traceId/spans` 合理 |
| 问题 | | `POST /api/v1/tracing/analyze` AI辅助分析，缺少请求体说明 |

---

## 二、与现有API风格一致性

### 2.1 路径前缀

| 模块 | 设计中路径 | 现有系统风格 | 一致性 |
|------|-----------|-------------|--------|
| 数据库DevOps | `/api/v1/db-audit/...` | `/api/v1/{service}/...` (如 `/api/v1/audit`) | **不一致**：`db-audit` 前缀与现有 `audit` 路径可能冲突 |
| 开发者门户 | `/api/v1/portal/...` | `/api/v1/developer-portal/...` (已注册) | **不一致**：现有前缀是 `developer-portal` 不是 `portal` |
| 配额与计费 | `/api/v1/billing/...` | 租户配额已有 `/api/v1/tenant/quota` | **冲突**：与现有 tenant quota 路径功能重叠 |
| 元数据管理 | `/api/v1/metadata/...` | 无现有冲突 | 一致 |
| 完整链路追踪 | `/api/v1/tracing/...` | `/api/v1/llm` (llm-trace) | **可能冲突**：需明确与 llm-trace 的边界 |

### 2.2 分页参数

| 设计 | 现有系统 | 一致性 |
|------|---------|--------|
| `page`, `pageSize` | `page`, `limit` (tenant-routes.ts 使用 `limit` 而非 `pageSize`) | **不一致** |

**现有系统分页参数统一使用 `page` + `limit`**，设计中全部使用 `pageSize`，需要统一。

### 2.3 错误响应格式

| 设计格式 | 现有系统格式 | 一致性 |
|----------|-------------|--------|
| `{ code, message, details, traceId }` | `{ success: false, error: { code, message, details? }, requestId? }` (error-response.ts) | **不一致** |

设计中错误响应格式与现有 `error-response.ts` 定义的 `ErrorResponse` 接口不匹配：
- 设计使用顶层 `code`/`message`，现有系统使用嵌套 `error.code`/`error.message`
- 设计使用 `traceId`，现有系统使用 `requestId`

### 2.4 响应包装

现有系统使用 `replyHelper.ts` 的 `success()`/`created()`/`noContent()` 等辅助函数，返回格式为：
```json
{ "success": true, "data": {...}, "meta": { "requestId": "...", "timestamp": ... } }
```

设计中未明确响应包装格式，需补充说明使用统一的 `replyHelper` 工具。

---

## 三、完整性评估

### 3.1 CRUD完整性

| 模块 | Create | Read | Update | Delete | 缺失 |
|------|--------|------|--------|--------|------|
| 数据库DevOps | ✓ rules | ✓ rules/tasks | ✓ rules | ✓ rules (软删除) | 脱敏规则无 toggle 操作 |
| 开发者门户 | ✓ subscriptions | ✓ apis/versions | ✓ subscriptions/approve | ✓ subscriptions | 缺少 API 文档的更新/删除 |
| 配额与计费 | ✓ templates/quotas | ✓ templates/quotas/bills | ✓ templates/quotas | ✓ templates | 缺少账单的删除/作废 |
| 元数据管理 | ✓ definitions/tasks | ✓ definitions/values | ✓ definitions/values | ✓ definitions | 缺少元数据定义的版本管理 |
| 完整链路追踪 | ✓ sampling | ✓ traces/services | ✓ sampling | ✓ sampling | Trace数据为只读，无写入API（合理） |

### 3.2 关键操作缺失

| 模块 | 缺失操作 | 优先级 |
|------|---------|--------|
| 数据库DevOps | SQL审核批量执行 | 中 |
| 数据库DevOps | 敏感数据标记为已处理 | 高 |
| 开发者门户 | API文档的更新/删除操作 | 高 |
| 开发者门户 | Mock实例的更新配置 | 中 |
| 配额与计费 | 配额调整审批流（文档提到需审批但无API） | 高 |
| 元数据管理 | 元数据导入/导出 | 中 |
| 完整链路追踪 | Trace数据清理/归档策略配置 | 低 |

---

## 四、安全性评估

### 4.1 权限控制

| 模块 | 认证要求 | 授权要求 | 问题 |
|------|---------|---------|------|
| 全部模块 | 提到"需要JWT Token" | 未指定具体权限资源 | 需明确每个端点的 `requirePermission({ resource, action })` 配置 |
| 配额与计费 | "超级管理员除外" | 未定义超级管理员bypass机制 | 现有系统通过 `X-Admin-Mode` 头实现，需明确 |

**现有系统权限模式**：每个路由使用 `requirePermission({ resource: 'xxx', action: 'read/write/manage/delete' })`。设计中未明确每个端点的资源-动作映射。

### 4.2 限流策略

| 设计中 | 现有系统 | 一致性 |
|--------|---------|--------|
| 查询类 1000次/分钟，写入类 100次/分钟 | 使用 `utils/rate-limit-circuit-breaker.ts` | 现有系统有限流工具但未全局强制 |

**问题**：
1. 限流阈值未在API设计中标注到具体端点
2. 批量操作限流 10次/分钟过于严格（如批量元数据采集）
3. 未区分内部服务调用与外部API调用的限流策略

### 4.3 多租户支持

| 设计 | 现有系统 | 问题 |
|------|---------|------|
| tenantId 从"上下文获取" | 通过 `X-Tenant-ID` 请求头 + RLS | 设计中查询参数包含 `tenantId`，但现有系统 tenantId 从请求上下文自动注入，不应作为查询参数 |
| 跨租户操作需超级管理员 | 通过 `TenantIsolationService` + RLS | 设计中未明确RLS策略 |

**严重问题**：设计中多处将 `tenantId` 作为路径参数（如 `/billing/quotas/:tenantId`），但现有系统：
1. 租户ID从 `X-Tenant-ID` header 或 JWT token 中提取
2. 全局中间件自动注入 `request.tenantContext`
3. 路径中出现 tenantId 会导致租户绕过风险

---

## 五、发现的问题

### 严重问题 (Critical)

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| C1 | **tenantId 作为路径/查询参数** | 8.3, 8.4 | 租户隔离绕过风险。现有系统 tenantId 从请求上下文获取，不应在路径中传递 |
| C2 | **错误响应格式与现有系统不一致** | 8.5 设计规范 | 前端无法统一处理错误响应 |
| C3 | **分页参数 `pageSize` vs `limit` 不统一** | 全部模块 | 前端分页组件需要适配两套参数名 |
| C4 | **开发者门户路径前缀冲突** | 8.2 | 设计用 `/portal/`，现有系统已注册 `/developer-portal/` |
| C5 | **配额与计费路径与现有 tenant quota 重叠** | 8.3 | `/billing/quotas` 与 `/tenant/quota` 功能边界不清 |

### 重要问题 (Important)

| # | 问题 | 位置 | 建议 |
|---|------|------|------|
| I1 | 缺少权限资源-动作映射 | 全部模块 | 为每个端点标注 `requirePermission({ resource, action })` |
| I2 | GET `/portal/test/online` 不应是GET | 8.2 | 改为 POST |
| I3 | `/db-audit/execute` 动作型路径 | 8.1 | 改为资源型路径 `POST /db-audit/audit-tasks` |
| I4 | 批量操作限流 10次/分钟过于严格 | 8.5 | 元数据批量采集需要更高配额 |
| I5 | 缺少 API 文档的更新/删除 | 8.2 | 补充 PUT/DELETE `/portal/apis/:id` |
| I6 | 元数据值路径 `/values/:entityType/:entityId` 过于复杂 | 8.4 | 考虑简化为 `/values?entityType=&entityId=` |

### 建议 (Suggestions)

| # | 问题 | 位置 | 建议 |
|---|------|------|------|
| S1 | `db-audit` 命名不如 `dbops` 简洁 | 8.1 | 统一使用 `dbops` 前缀 |
| S2 | 缺少版本号在路径中 | 全部 | 考虑 `/api/v1/` 版本管理策略 |
| S3 | 缺少批量操作端点的请求体说明 | 8.4 | 补充批量写入的格式规范 |
| S4 | Trace分析端点缺少请求参数 | 8.5 | 补充 analyze 的请求体定义 |

---

## 六、修正建议

### 6.1 路径前缀统一

建议将设计中的路径前缀调整为与现有系统一致：

| 模块 | 原设计 | 建议修改 | 理由 |
|------|--------|---------|------|
| 数据库DevOps | `/api/v1/db-audit/` | `/api/v1/dbops/` | 与模块名一致，避免与 `audit` 冲突 |
| 开发者门户 | `/api/v1/portal/` | `/api/v1/developer-portal/` | 与现有 `developer-portal-routes.ts` 一致 |
| 配额与计费 | `/api/v1/billing/` | `/api/v1/billing/`（新增） | 保留，但需明确与 `/tenant/quota` 的分工 |
| 元数据管理 | `/api/v1/metadata/` | `/api/v1/metadata/` | 无冲突，保持 |
| 完整链路追踪 | `/api/v1/tracing/` | `/api/v1/tracing/` | 无冲突，保持 |

### 6.2 分页参数统一

将所有 `pageSize` 改为 `limit`，与现有系统保持一致：

```diff
- pageSize | integer | 每页数量，默认20
+ limit | integer | 每页数量，默认20
```

### 6.3 错误响应格式统一

采用现有 `error-response.ts` 定义的格式：

```json
{
  "success": false,
  "error": {
    "code": "ERR_xxx",
    "message": "错误描述",
    "details": {}
  },
  "requestId": "req_xxx"
}
```

### 6.4 tenantId 处理方式

所有API设计中移除路径和查询参数中的 `tenantId`，改为：
1. 普通用户：从 JWT token 或 `X-Tenant-ID` header 自动提取
2. 超级管理员：通过 `X-Admin-Mode: true` header + 请求体中的 `targetTenantId`（仅在管理操作时）

### 6.5 补充权限映射表

为每个模块补充权限映射，例如：

| 端点 | 资源 | 动作 | 角色 |
|------|------|------|------|
| GET /dbops/rules | dbops_rule | read | 所有租户成员 |
| POST /dbops/rules | dbops_rule | write | 租户管理员 |
| DELETE /dbops/rules/:id | dbops_rule | delete | 租户管理员 |
| GET /dbops/dashboard/stats | dbops_dashboard | read | 所有租户成员 |

### 6.6 配额与计费边界明确

在设计文档中补充与 `PipelineBudgetService` 的分工：

| 功能 | 归属 |
|------|------|
| 租户级资源配额（CPU/内存/存储） | 新配额与计费系统 |
| 流水线执行成本预算 | 现有 PipelineBudgetService |
| 账单生成与计费 | 新配额与计费系统 |
| 配额检查（资源创建前） | 新配额与计费系统 |
