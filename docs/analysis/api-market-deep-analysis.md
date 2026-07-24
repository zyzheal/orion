# API Marketplace 模块深度分析报告

**生成日期**: 2026-07-03  
**分析模块**: `orion-platform-service/src/services/api-market/`、`orion-platform-service/src/api/api-market-routes.ts`

---

## 一、现状概述

### 模块定位

API Marketplace 模块承担 **API 产品（Product）管理、开发者应用（Developer App）管理、API 密钥发放与验证、订阅管理** 四大职责。是平台 API 开放能力的核心模块，提供从产品发布到消费授权的一站式管理。

### 当前实现状态

| 子域 | 文件 | 当前状态 |
|------|------|----------|
| API 产品管理 | `ApiMarketService.ts` (Products 部分) | ✅ PostgreSQL |
| 开发者应用 | `ApiMarketService.ts` (Apps 部分) | ✅ PostgreSQL |
| API 密钥 | `ApiMarketService.ts` (Credentials 部分) | ✅ PostgreSQL |
| 订阅管理 | `ApiMarketService.ts` (Subscriptions 部分) | ✅ PostgreSQL |
| 数据访问 | `ApiMarketRepository.ts` | ✅ PostgreSQL（全 CRUD） |

### 文件结构

```
services/api-market/
├── index.ts                       # Barrel export（完整）
├── ApiMarketService.ts            # 业务逻辑层（270+ 行）
├── ApiMarketRepository.ts         # 数据访问层（5 表，290+ 行）
└── __tests__/
    ├── ApiMarketRepository.test.ts
    ├── ApiMarketService.test.ts
    └── index.test.ts

api/api-market-routes.ts           # 12+ 路由端点
```

### 核心数据模型

| 表 | 说明 | 关键字段 |
|----|------|---------|
| `api_products` | API 产品 | name, slug(唯一), description, owner_id, status(draft/published/deprecated), version |
| `api_definitions` | API 定义（OpenAPI 规格） | product_id, version, openapi_spec(JSONB), changelog, is_current |
| `developer_apps` | 开发者应用 | developer_id, name, description, redirect_uris, status(active/suspended) |
| `api_credentials` | API 凭据 | app_id, client_id(唯一), client_secret_hash(SHA256), scopes[], rate_limit_per_min, expires_at, last_used_at |
| `api_subscriptions` | 产品订阅 | app_id, product_id, plan, status(active/suspended/cancelled), quota_per_day, used_today |

### 路由注册

- 文件: `api/api-market-routes.ts`
- 注册: `registerWithRoleGuard(app, apiMarketRoutes, '/market', ...)` — 前缀: `/api/v1/market`
- 认证: 大部分端点需 `authenticateUser` + `requirePermission`；`/market/auth/token` 为公开端点（有 rate limit 保护）

---

## 二、功能矩阵

### API 产品管理

| 功能点 | 状态 | 说明 |
|--------|------|------|
| 创建产品 | ✅ | 自动生成唯一 slug（重名自动添加序号） |
| 产品列表 | ✅ | 全量查询 |
| 产品详情 | ✅ | 按 ID 查询 |
| 产品发布 | ✅ | draft → published 状态变更 |
| 产品更新 | ⚠️ | Service 层支持，**路由层未暴露 PUT 端点** |
| 产品删除 | ✅ | 级联处理 |

### 开发者应用

| 功点 | 状态 | 说明 |
|--------|------|------|
| 创建应用 | ✅ | 绑定当前用户 |
| 应用列表 | ✅ | 按 developer_id 查询 |
| 应用详情 | ✅ | 按 ID 查询 |
| 应用更新 | ⚠️ | Repository 层支持，路由层未暴露 |
| 应用挂起/激活 | ❌ | Repository 层支持 status 更新，未暴露 |

### API 密钥

| 功能点 | 状态 | 说明 |
|--------|------|------|
| 生成密钥 | ✅ | 16字节 client_id + 32字节 client_secret(SHA256 哈希存储) + 重试机制 |
| 密钥列表 | ✅ | 隐藏 client_secret_hash（安全暴露） |
| 密钥验证 | ✅ | SHA256 比对 + 过期检查 + last_used 更新 |
| 密钥过期 | ✅ | 支持设置 expires_at |
| 速率限制 | ✅ | rate_limit_per_min 字段，验证时返回 |

### 订阅管理

| 功能点 | 状态 | 说明 |
|--------|------|------|
| 产品订阅 | ✅ | 含 en-US 唯一性检查 + plan/quota |
| 订阅检查 | ✅ | 验证 app 是否有产品访问权限 |
| 订阅列表 | ✅ | 按 app 查询，含权限校验（仅应用拥有者可查看） |

---

## 三、API 端点

| 方法 | 路径 | 控制器 | 说明 |
|------|------|--------|------|
| POST | `/market/products` | `service.createProduct` | 创建 API 产品 |
| GET | `/market/products` | `service.listProducts` | 产品列表 |
| GET | `/market/products/:id` | `service.getProduct` | 产品详情 |
| POST | `/market/products/:id/publish` | `service.publishProduct` | 发布产品 |
| DELETE | `/market/products/:id` | `service.deleteProduct` | 删除产品 |
| POST | `/market/apps` | `service.createDeveloperApp` | 创建开发者应用 |
| GET | `/market/apps` | `service.listAppsByDeveloper` | 我的应用列表 |
| GET | `/market/apps/:id` | `service.getApp` | 应用详情 |
| POST | `/market/apps/:appId/keys` | `service.generateApiKey` | 生成 API 密钥 |
| GET | `/market/apps/:appId/keys` | `service.listApiKeys` | 密钥列表 |
| POST | `/market/auth/token` | `service.validateApiKey` | 验证密钥（公开） |
| GET | `/market/subscriptions/check` | `service.checkSubscription` | 检查订阅 |
| POST | `/market/subscriptions` | `service.subscribe` | 创建订阅 |
| GET | `/market/subscriptions/:appId` | `service.listSubscriptions` | 订阅列表（含鉴权） |

---

## 四、依赖关系

| 依赖类型 | 依赖模块 | 说明 |
|----------|---------|------|
| 数据持久化 | PostgreSQL | 5 张物理表（migration 052），完整 Repository 模式 |
| 认证授权 | authMiddleware | `authenticateUser` + `requirePermission` |
| 密码学 | crypto (built-in) | `randomBytes` 密钥生成、`createHash(SHA256)` 哈希存储 |
| 错误处理 | errors | `OrionError`, `ValidationError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `handleError` |
| 日志 | logger | `createLogger('api-market-routes')` |
| 速率限制 | Fastify config | `/market/auth/token` 端点 20次/分钟 rate limit |

---

## 五、风险与改进建议

### P1 级

| 风险 | 级别 | 建议 |
|------|------|------|
| 产品更新端点缺失 | P1 | `service.updateProduct` 已实现，但路由无 `PUT /market/products/:id` 端点，产品名称/描述无法修改 |
| 应用更新端点缺失 | P1 | Repository 层有 `updateApp` 方法但未暴露路由，应用无法更新 name/description/redirectUris |
| 无产品版本管理 | P1 | `ApiDefinition`（API 定义）Repository 有 `createApiDefinition`/`findApiDefinitionByProductAndVersion`，但路由层完全未暴露 |
| 订阅用量追踪 stub | P1 | `used_today` 字段写入后无自动清零机制，`updateSubscriptionUsage` 方法存在但路由未使用 |

### P2 级

| 风险 | 级别 | 建议 |
|------|------|------|
| 缺少产品搜索 | P2 | 无按名称/slug 搜索端点 |
| 密钥撤销端点缺失 | P2 | 无 `DELETE /market/apps/:appId/keys/:keyId` 单独吊销密钥端点 |
| 订阅取消端点缺失 | P2 | 无 `DELETE /market/subscriptions/:id` 取消订阅端点 |
| 速率限制配置未暴露 | P2 | `rate_limit_per_min` 存储在 credential 中，无法通过 API 调整 |
| 无使用分析 | P2 | 无法查看开发者调用的 API 使用量/top N 等统计数据 |

---

## 六、总结

API Marketplace 模块是**四个分析模块中实现最完善的模块**。

**核心优势**：
1. 数据模型完整（5 张表覆盖产品→定义→应用→凭据→订阅全链路）
2. 安全实践到位（client_secret SHA256 哈希、密钥列表中隐藏哈希值、重试机制防冲突）
3. 错误处理规范（`handleError` + 自定义 `ApiMarketError`）
4. 认证体系完善（公开端点有 rate limit、敏感操作有 permission 校验、订阅列表有所有者校验）
5. 14 个注册端点，功能覆盖全面

**关键缺失**：
- 产品更新、应用更新、备份管理、订阅取消等 4+ 个端点未暴露
- API 定义（OpenAPI 规格）管理完全未接入路由
- 订阅用量追踪无自动重置机制
