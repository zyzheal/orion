# Service Catalog 深度分析报告

> **生成日期**: 2026-07-02
> **分析范围**: `orion-platform-service` 的 Service Catalog（ITSM 服务目录）模块，涵盖服务层、数据访问层（含 3 个 Repository）、路由层与测试覆盖。

---

## 一、现状概述

### 模块定位

Service Catalog（服务目录）是 ITSM 核心模块，提供 IT 服务的管理和请求生命周期管理。支持服务定义（active/inactive/retired 状态机）、服务请求（pending → approved → in_progress → fulfilled 状态机）、SLA 违约检测和 timeline 事件追踪。

### 文件结构

```
services/service-catalog/
├── __tests__/
│   ├── CatalogService.test.ts         # 571 行 — Service 层测试
│   └── CatalogRepository.test.ts      # 479 行 — Repository 层测试
├── index.ts
└── ServiceCatalogService.ts           # 466 行 — 业务逻辑

repositories/
├── ServiceCatalogRepository.ts        # 237 行 — 服务目录数据访问
└── ServiceRequestRepository.ts        # 374 行 — 请求 + Timeline 数据访问

api/service-catalog-routes.ts          # 331 行 — 路由注册
```

### 核心数据模型

| 模型 | 数据库表 | 说明 |
|------|---------|------|
| `CatalogServiceEntity` | `catalog_services` | 服务目录项，含名称/分类/状态/owner/SLA 层级/响应目标 |
| `CatalogRequestEntity` | `catalog_requests` | 服务请求，含优先级/状态/审批人/完成时间/SLA 违约标记 |
| `CatalogTimelineEntity` | `catalog_request_timeline` | 请求时间线事件，含类型/描述/元数据 |

**服务状态**: `active` → `inactive` / `retired`（单向到 retired）
**请求状态**: `pending` → `approved` → `in_progress` → `fulfilled`（可取消）

**SLA 层级**:
| 层级 | 响应时间 | 说明 |
|------|---------|------|
| `gold` | 4 小时 | 最高优先级 |
| `silver` | 8 小时 | 中等 |
| `bronze` | 24 小时 | 默认 |

### 持久化方式

**全部 PostgreSQL** — 3 个 Repository 全部使用参数化 SQL，`ServiceCatalogRepository` 和 `ServiceRequestRepository` 继承 `BaseRepository`，`CatalogTimelineRepository` 为独立类。

---

## 二、功能矩阵

| 功能点 | 状态 | 说明 |
|--------|------|------|
| 创建服务目录项 | ✅ 完整 | 含 name/description/category/status/SLA 等字段校验 |
| 获取服务目录项详情 | ✅ 完整 | 按 ID 查询，含租户隔离校验 |
| 列出服务目录项 | ✅ 完整 | 支持 category/status 过滤，分页 |
| 更新服务目录项 | ✅ 完整 | 含状态转换校验（active↔inactive/retired） |
| 删除服务目录项 | ✅ 完整 | 仅允许非 active 状态删除 |
| 创建服务请求 | ✅ 完整 | 含优先级校验、服务 active 校验、自动创建 timeline 事件 |
| 获取服务请求 | ✅ 完整 | 按 ID 查询，含租户隔离 |
| 列出服务请求 | ✅ 完整 | 支持 serviceId/requesterId/status 过滤，分页 |
| 更新服务请求 | ✅ 完整 | 仅允许 pending/in_progress 状态更新 |
| 请求状态转换 | ✅ 完整 | 含状态机校验、自动设置 approvedBy/fulfilledAt、创建 timeline 事件 |
| 获取请求 Timeline | ✅ 完整 | 按请求 ID 查询时间线事件 |
| SLA 违约检测 | ✅ 完整 | SQL 级检测，按 SLA 层级自动标记逾期请求 |
| SLA 违约查询 | ✅ 完整 | 查询所有 SLA 违约请求 |
| 统计概览 | ✅ 完整 | 服务数量（按状态）+ 请求数量（按状态）+ SLA 违约数 |
| 按 owner 查询服务 | ⚠️ 部分实现 | Repository 层有 `findByOwner` 但 Service/Routes 未暴露 |
| 通知集成 | ❌ 缺失 | 状态转换/违约时无通知触发 |

---

## 三、API 端点

| 方法 | 路径 | 控制器方法 | 说明 |
|------|------|-----------|------|
| `GET` | `/catalog/services` | `listServices` | 列出服务目录（支持 category/status 过滤，分页） |
| `POST` | `/catalog/services` | `createService` | 创建服务目录项 |
| `GET` | `/catalog/services/:id` | `getService` | 获取服务目录项详情 |
| `PUT` | `/catalog/services/:id` | `updateService` | 更新服务目录项 |
| `DELETE` | `/catalog/services/:id` | `deleteService` | 删除服务目录项 |
| `GET` | `/catalog/requests` | `listRequests` | 列出服务请求（支持 serviceId/requesterId/status 过滤） |
| `POST` | `/catalog/requests` | `createRequest` | 创建服务请求 |
| `GET` | `/catalog/requests/:id` | `getRequest` | 获取服务请求详情 |
| `PUT` | `/catalog/requests/:id` | `updateRequest` | 更新服务请求 |
| `POST` | `/catalog/requests/:id/status` | `transitionStatus` | 请求状态转换 |
| `GET` | `/catalog/requests/:id/timeline` | `getTimeline` | 获取请求 timeline |
| `GET` | `/catalog/stats` | `getStats` | 统计概览 |
| `GET` | `/catalog/sla-breaches` | `getSlaBreaches` | SLA 违约列表 |

**路由注册**: `routes.ts` → `registerWithRoleGuard(app, serviceCatalogRoutes, '/catalog')`

**认证**: 所有端点有 `requirePermission`（路由层未使用 `authenticateUser`，但 `requirePermission` 内部应处理认证）
**授权**: 使用 3 种 action: `read` / `write` / `delete`

---

## 四、依赖关系

| 依赖 | 类型 | 用途 |
|------|------|------|
| `../../utils/logger` | 内部 | 结构化日志 |
| `../../repositories/ServiceCatalogRepository` | 内部 | 服务数据访问 |
| `../../repositories/ServiceRequestRepository` | 内部 | 请求 + Timeline 数据访问 |
| `../../errors` | 内部 | 异常处理 |
| `../../middleware/requirePermission` | 内部 | 权限控制 |
| `crypto.randomUUID` | Node 内置 | ID 生成 |

**无外部 npm 依赖** — 全部使用内置能力。

---

## 五、风险与改进建议

| 风险 | 级别 | 建议 |
|------|------|------|
| **缺少 `authenticateUser` 中间件** — 路由层所有端点仅使用 `requirePermission`，未显式使用 `authenticateUser`。虽然 `requirePermission` 内部可能处理认证，但与其他模块不一致 | P1 | 在所有路由上补充 `authenticateUser` 中间件，保持与其他模块一致 |
| **`findByOwner` 路由未暴露** — Repository 层有实现但 Service/Routes 未暴露 | P2 | 在 Routes 增加 `GET /catalog/services/owner/:owner` |
| **无通知/Webhook 集成** — 状态转换和 SLA 违约时无事件通知 | P2 | 在 `transitionStatus` 和 `detectSlaBreaches` 中发布事件 |
| **SLA 违约检测仅限 SQL 级别** — SQL 查询硬编码了 4/8/24 小时阈值，不可配置 | P2 | 将 SLA 阈值提取为配置项，支持按服务自定义 |
| **请求更新无权限校验** — `updateRequest` 和 `transitionStatus` 未校验当前用户是否有权操作 | P2 | 补充 `assignedTo` 或 role 级别的权限校验 |
| **`metadata` 字段类型处理不一致** — Service 层传入 `metadata` 为对象，Repository 层用 `JSON.stringify` 但 Route 层直接传 `body.metadata` 未验证类型 | P1 | 统一 metadata 的类型处理，增加 JSON Schema 校验 |
| **Repository Entity 使用 snake_case 字段名** — `CatalogServiceEntity` 字段名为 `tenant_id` 而非 `tenantId`，与其他模块的 camelCase 风格不一致 | P2 | 统一为 camelCase（优先）或至少在模块内保持一致 |

---

## 六、总结

Service Catalog 是 **4 个模块中实现最完善的**，功能覆盖服务目录 CRUD、请求全生命周期管理、SLA 违约检测、Timeline 事件追踪、统计概览共 13 个 API 端点。

**核心优势**:
- 状态机设计严谨（服务状态 3 种 + 请求状态 6 种），校验完整
- SLA 违约检测直接在 SQL 层实现，性能高效
- Timeline 事件自动记录所有状态变更，审计追踪完善
- 测试覆盖较好（1050 行，含 Service + Repository 测试）
- 统计功能设计实用（服务分布 + 请求分布 + SLA 违约数）

**主要短板**:
1. **缺少 `authenticateUser` 中间件** — 路由层认证中间件不完整，与其他模块不一致
2. **无通知集成** — SLA 违约和状态转换时无事件通知
3. **`findByOwner` 未暴露** — 功能不完整
4. **metadata 类型处理有风险** — 路由层直接 cast 可能引入运行时错误

**综合评估**: 4 个模块中质量最高，接近生产就绪状态。仅需少量补充（认证中间件、通知集成）即可投入生产使用。建议优先修复 `authenticateUser` 缺失问题。
