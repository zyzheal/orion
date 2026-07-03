# API Key 模块深度分析报告

**生成日期**: 2026-07-03  
**分析模块**: `orion-platform-service/src/services/api-key/`、`orion-platform-service/src/api/api-key-routes.ts`

---

## 一、现状概述

### 模块定位

API Key 模块承担 **API 密钥的创建、查询、吊销、验证** 职责。是平台安全基础设施的关键组件，为外部系统/第三方应用提供认证凭据管理。

### 当前实现状态

| 子域 | 文件 | 当前状态 |
|------|------|----------|
| 密钥管理 | `ApiKeyService.ts` | ✅ PostgreSQL（Repository 模式） |
| 数据访问 | `ApiKeyRepository.ts` | ✅ PostgreSQL（完整 CRUD） |
| 路由 | `api-key-routes.ts` | ⛔ **存在死代码 Bug** |

### 文件结构

```
services/api-key/
├── index.ts                       # Barrel export （完整）
├── ApiKeyService.ts               # 业务逻辑层
├── ApiKeyRepository.ts            # 数据访问层
└── __tests__/
    ├── ApiKeyRepository.test.ts
    ├── ApiKeyService.test.ts
    └── ApiKeyService.error.test.ts

api/api-key-routes.ts              # 3 个路由端点
```

### 核心数据模型

| 表 | 说明 | 关键字段 |
|----|------|---------|
| `api_keys` | API 密钥表 | tenant_id, user_id, name, key_hash(SHA256), permissions[], expires_at, last_used_at |

### 路由注册

- 文件: `api/api-key-routes.ts`
- 注册: `registerWithRoleGuard(app, apiKeyRoutes, '/api-keys', ...)` — 前缀: `/api/v1/api-keys`
- 认证: 所有端点均需 `authenticateUser` + `requirePermission`

---

## 二、功能矩阵

| 功能点 | 状态 | 说明 |
|--------|------|------|
| API Key 创建 | ⛔ | 路由层有死代码，**实际不可用** |
| API Key 创建（Service 层） | ✅ | `ApiKeyService.createKey` 逻辑完整 |
| API Key 列表 | ✅ | 按 tenant_id 查询，含 total 计数 |
| API Key 吊销 | ⛔ | 路由层有死代码，**实际不可用** |
| API Key 吊销（Service 层） | ✅ | `ApiKeyService.revokeKey` 逻辑完整 |
| API Key 验证 | ✅ | SHA256 哈希比对 + 过期检查 + last_used_at 更新 |
| 权限体系 | ✅ | permissions 数组 + read/write/delete 三种 action |
| 过期策略 | ✅ | 支持设置过期天数，自动清理 |

---

## 三、API 端点

| 方法 | 路径 | 控制器 | 说明 |
|------|------|--------|------|
| GET | `/` | `service.listKeys` | ✅ 可用 |
| POST | `/` | `service.createKey` | ⛔ **死代码** |
| DELETE | `/:id` | `service.revokeKey` | ⛔ **死代码** |

---

## 四、依赖关系

| 依赖类型 | 依赖模块 | 说明 |
|----------|---------|------|
| 数据持久化 | PostgreSQL | `api_keys` 物理表，Repository 模式 |
| 认证授权 | authMiddleware | `authenticateUser` + `requirePermission` |
| 密码学 | crypto (built-in) | `randomBytes` 生成 + `createHash('sha256')` 哈希 |
| 错误处理 | errors | `OrionError`, `ValidationError`, `NotFoundError`, `ServiceUnavailableError`, `handleError` |

---

## 五、风险与改进建议

### P0 级（阻塞生产）

| 风险 | 级别 | 建议 |
|------|------|------|
| **POST 路由死代码** | **P0** | 第 60 行 `return handleError(reply, new ValidationError('INVALID_INPUT'));` 使后续的 try 块永不执行。实际 createKey 逻辑完全不可达 |
| **DELETE 路由死代码** | **P0** | 第 83 行 `return handleError(reply, new NotFoundError('NOT_FOUND'));` 使后续的 204 返回永不执行。实际 revokeKey 逻辑完成后仍报错 |
| `api-key-routes.ts` 严重 Bug | P0 | 两个端点均因死代码导致生产不可用 |

### P2 级

| 风险 | 级别 | 建议 |
|------|------|------|
| 无更新端点 | P2 | 缺少 `PUT /:id` 更新密钥名称/权限/过期时间 |
| 无详情端点 | P2 | 缺少 `GET /:id` 查看单个密钥详情 |
| 无批量吊销 | P2 | 缺少按 user_id 或 tenant_id 批量吊销 |

---

## 六、总结

API Key 模块**数据层和业务逻辑层实现完整**（SHA256 哈希、过期策略、权限模型），但**路由层存在严重死代码 Bug**，导致 POST（创建）和 DELETE（吊销）两个核心端点完全不可用。

**修复方案**：删除第 60 行 `return handleError(...)` 和 第 83 行 `return handleError(...)`，让后续的 try 块正常执行。

**关键数据**：`ApiKeyRepository` 包含 `findByHash` 方法供验证使用，`updateLastUsed` 追踪密钥使用情况，支持 `findAll(tenantId)` 多租户隔离。
