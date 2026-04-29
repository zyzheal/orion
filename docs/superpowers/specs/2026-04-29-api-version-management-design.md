# API 版本管理设计文档

> 日期: 2026-04-29
> 状态: 设计阶段
> 优先级: P0 (P0 Review #25)
> 关联决策: ADR-012, API 路径一致性设计文档

## 1. 问题陈述

### 1.1 现状

Orion 平台所有 API 路由硬编码在 `/api/v1/` 下，无版本管理机制：
- `routes.ts` 中 50+ 路由模块全部注册到 `/v1/` 前缀下
- 内联路由（Pipeline/PipelineRun/Stage/Task）直接硬编码 `app.get('/v1/pipelines')`
- 无废弃标记、无版本协商、无迁移引导

### 1.2 影响

1. **无法平滑升级**: 引入 `/api/v2/` 时需要同时维护 v1/v2，当前架构不支持
2. **无法安全废弃**: 废弃某路由时无法通知调用方，无法统计废弃路由使用量
3. **客户端无感知**: 客户端无法通过标准方式获知 API 版本能力和弃用状态
4. **测试困难**: 无法针对特定版本做集成测试

### 1.3 根因

缺少 API Version Management 基础设施层，版本信息散落在路由前缀字符串中，无统一注册、校验、查询机制。

## 2. 架构决策

### 2.1 决策

**采用 URL Path 为主 + Accept Header 为辅的双模式版本管理**

### 2.2 理由

1. **URL Path (`/api/v1/...`)**: 直观、易调试、浏览器友好，是当前已采用的方式
2. **Accept Header (`application/vnd.orion.v1+json`)**: 标准 RESTful 实践，适合服务间调用
3. 两者并存，URL Path 优先级更高，便于渐进式迁移

### 2.3 替代方案排除

| 方案 | 排除理由 |
|------|---------|
| 仅 Accept Header | 浏览器/调试不友好，与现有架构不兼容 |
| 仅 Query Param (`?version=v1`) | 不符合 RESTful 惯例，缓存不友好 |
| 子域名版本 (`v1.api.orion.io`) | 运维成本高，不适用于当前单体架构 |

## 3. 核心设计

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                     Client Request                       │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Version Negotiation Layer                    │
│  ┌──────────────────────────────────────────────────┐   │
│  │  apiVersionMiddleware (preHandler global hook)   │   │
│  │  1. Extract version from URL path                │   │
│  │  2. Fallback to Accept header                    │   │
│  │  3. Validate version against registry            │   │
│  │  4. Attach req.apiVersion                        │   │
│  │  5. Check deprecation + log usage                │   │
│  │  6. Inject Sunset/Deprecation response headers   │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Route Registry (routes.ts)                   │
│  ┌─────────────────┐  ┌─────────────────┐               │
│  │  /api/v1/*      │  │  /api/v2/*      │  ...future    │
│  │  (50+ routes)   │  │  (future routes)│               │
│  └─────────────────┘  └─────────────────┘               │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              API Version Info Endpoint                    │
│  GET /api/v1/version-info                                 │
│  GET /api/v2/version-info                                 │
└─────────────────────────────────────────────────────────┘
```

### 3.2 版本注册表 (ApiVersionRegistry)

统一管理所有 API 版本的元数据和路由清单。

**文件**: `src/api/versioning/ApiVersionRegistry.ts`

```typescript
export interface ApiRouteMeta {
  path: string;           // e.g., "/pipelines"
  method: string;         // "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
  description: string;    // e.g., "获取 Pipeline 列表"
  deprecated?: boolean;   // 是否已废弃
  deprecatedSince?: string; // ISO date when deprecated
  sunsetDate?: string;    // ISO date when route will be removed
  replacement?: string;   // replacement path in current or next version
}

export interface ApiVersionMeta {
  version: string;        // "v1", "v2"
  status: 'stable' | 'beta' | 'deprecated';
  releaseDate: string;    // ISO date
  deprecationDate?: string;
  sunsetDate?: string;    // planned removal date
  routes: ApiRouteMeta[];
  changelog?: string;     // link to changelog
}

export class ApiVersionRegistry {
  private versions: Map<string, ApiVersionMeta> = new Map();

  registerVersion(meta: ApiVersionMeta): void;
  getLatestVersion(): string;
  getVersion(version: string): ApiVersionMeta | undefined;
  getAllVersions(): ApiVersionMeta[];
  getDeprecatedRoutes(version: string): ApiRouteMeta[];
  isRouteDeprecated(version: string, path: string, method: string): boolean;
}
```

### 3.3 版本协商中间件 (apiVersionMiddleware)

**文件**: `src/middleware/apiVersionMiddleware.ts`

作为 Fastify 的 `preHandler` 全局钩子注册，在认证之后、路由处理之前执行。

```typescript
import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { ApiVersionRegistry } from '../api/versioning/ApiVersionRegistry';

const SUPPORTED_VERSIONS = ['v1'];
const DEFAULT_VERSION = 'v1';
const HEADER_NAME = 'api-version';
const ACCEPT_PATTERN = /^application\/vnd\.orion\.([a-z0-9]+)\+json$/i;
const DEPRECATION_HEADER = 'Sunset';
const DEPRECATED_HEADER = 'Deprecation';

export async function apiVersionMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
  registry: ApiVersionRegistry
): Promise<void> {
  // 1. Extract version from URL path (highest priority)
  const pathVersion = extractVersionFromPath(request.url);

  // 2. Extract version from Accept header
  const acceptVersion = extractVersionFromAcceptHeader(request.headers.accept);

  // 3. Extract version from custom header
  const headerVersion = request.headers[HEADER_NAME] as string;

  // 4. Resolve final version (path > header > accept > default)
  const resolvedVersion = pathVersion || headerVersion || acceptVersion || DEFAULT_VERSION;

  // 5. Validate version
  if (!SUPPORTED_VERSIONS.includes(resolvedVersion)) {
    return reply.code(400).send({
      code: 400,
      error: 'UNSUPPORTED_API_VERSION',
      message: `API version '${resolvedVersion}' is not supported. Supported: ${SUPPORTED_VERSIONS.join(', ')}`,
      supportedVersions: SUPPORTED_VERSIONS,
      timestamp: new Date().toISOString(),
    });
  }

  // 6. Attach to request for downstream use
  (request as any).apiVersion = resolvedVersion;

  // 7. Check deprecation and inject response headers
  const routeMeta = findRouteMeta(registry, resolvedVersion, request.url, request.method);
  if (routeMeta?.deprecated) {
    reply.header('Deprecation', `true; version="${resolvedVersion}"`);
    if (routeMeta.sunsetDate) {
      reply.header('Sunset', routeMeta.sunsetDate);
    }
    if (routeMeta.replacement) {
      reply.header('Link', `<${routeMeta.replacement}>; rel="successor-version"`);
    }
    // Log deprecated route usage
    logDeprecatedUsage(request, routeMeta);
  }
}
```

**版本提取优先级**:

| 来源 | 示例 | 优先级 |
|------|------|--------|
| URL Path | `/api/v1/pipelines` | 1 (最高) |
| Custom Header | `Api-Version: v1` | 2 |
| Accept Header | `Accept: application/vnd.orion.v1+json` | 3 |
| Default | `v1` | 4 (最低) |

### 3.4 版本路由注册器 (VersionedRouteRegistrar)

**文件**: `src/api/versioning/VersionedRouteRegistrar.ts`

提供类型安全的路由注册 API，自动将路由注册到正确的版本前缀下，同时向版本注册表登记元数据。

```typescript
export interface VersionedRouteOptions {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  handler: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
  description: string;
  deprecated?: boolean;
  deprecatedSince?: string;
  sunsetDate?: string;
  replacement?: string;
  schema?: Record<string, unknown>;
}

export class VersionedRouteRegistrar {
  constructor(
    private app: FastifyInstance,
    private version: string,
    private registry: ApiVersionRegistry
  ) {}

  register(route: VersionedRouteOptions): void;
  registerBatch(routes: VersionedRouteOptions[]): void;
  getVersionPrefix(): string; // returns "/v1"
}
```

### 3.5 API 版本信息端点

**文件**: `src/api/versioning/version-routes.ts`

提供 API 版本信息查询，支持客户端发现可用版本。

```
GET /api/v1/version-info
GET /api/v1/version-info/:version
```

**Response Schema**:

```json
{
  "success": true,
  "data": {
    "currentVersion": "v1",
    "supportedVersions": [
      {
        "version": "v1",
        "status": "stable",
        "releaseDate": "2025-01-01",
        "routeCount": 50,
        "deprecatedRouteCount": 0
      }
    ],
    "versionNegotiation": {
      "supportedMethods": ["url-path", "accept-header", "custom-header"],
      "defaultVersion": "v1"
    }
  },
  "timestamp": "2026-04-29T00:00:00.000Z"
}
```

### 3.6 数据库设计

**文件**: `src/db/migrations/050-api-versions.sql`

用于持久化版本元数据和废弃路由使用统计。

```sql
-- API 版本信息表
CREATE TABLE api_versions (
    id              SERIAL PRIMARY KEY,
    version         VARCHAR(10) NOT NULL UNIQUE,
    status          VARCHAR(20) NOT NULL DEFAULT 'stable',
    release_date    DATE NOT NULL,
    deprecation_date DATE,
    sunset_date     DATE,
    changelog       TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- API 路由元数据表
CREATE TABLE api_routes (
    id              SERIAL PRIMARY KEY,
    version         VARCHAR(10) NOT NULL REFERENCES api_versions(version),
    method          VARCHAR(10) NOT NULL,
    path            VARCHAR(255) NOT NULL,
    description     TEXT,
    deprecated      BOOLEAN DEFAULT FALSE,
    deprecated_since DATE,
    sunset_date     DATE,
    replacement     VARCHAR(255),
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(version, method, path)
);

-- 废弃路由使用统计
CREATE TABLE deprecated_route_usage (
    id              SERIAL PRIMARY KEY,
    version         VARCHAR(10) NOT NULL,
    method          VARCHAR(10) NOT NULL,
    path            VARCHAR(255) NOT NULL,
    tenant_id       VARCHAR(50),
    user_id         VARCHAR(50),
    user_agent      VARCHAR(255),
    request_count   INTEGER DEFAULT 1,
    first_seen      TIMESTAMP DEFAULT NOW(),
    last_seen       TIMESTAMP DEFAULT NOW(),
    UNIQUE(version, method, path, tenant_id)
);

-- 初始数据: 注册 v1 版本
INSERT INTO api_versions (version, status, release_date)
VALUES ('v1', 'stable', '2025-01-01');
```

## 4. 向后兼容策略

### 4.1 v1 路由迁移到 v2 策略

当需要引入 `/api/v2/` 时，遵循以下策略：

```
Phase 1: v2 开发阶段 (beta)
├── 注册 v2 路由，v1 保持不变
├── v2 路由标记为 beta 状态
└── 客户端可选择性试用 v2

Phase 2: v1 废弃阶段 (deprecated)
├── v1 路由标记为 deprecated
├── 响应注入 Deprecation/Sunset 头
├── 开始统计废弃路由使用量
└── 通知调用方迁移

Phase 3: v1 移除阶段 (sunset)
├── sunset_date 到期后移除 v1 路由
├── 404 响应中提供迁移指引
└── 清理废弃代码
```

### 4.2 废弃路由迁移指引

当请求已废弃路由时，404 响应包含迁移信息：

```json
{
  "success": false,
  "error": "ROUTE_DEPRECATED",
  "code": "41000",
  "message": "This API route has been deprecated",
  "migration": {
    "replacement": "/api/v2/pipelines",
    "documentation": "https://docs.orion.io/api/v2/migration-guide",
    "sunsetDate": "2026-07-01"
  },
  "timestamp": "2026-04-29T00:00:00.000Z"
}
```

## 5. 文件清单

### 5.1 新增文件

| 文件路径 | 用途 | 优先级 |
|---------|------|--------|
| `src/api/versioning/ApiVersionRegistry.ts` | 版本注册表核心类 | P0 |
| `src/api/versioning/VersionedRouteRegistrar.ts` | 版本化路由注册器 | P0 |
| `src/api/versioning/version-routes.ts` | 版本信息查询路由 | P0 |
| `src/middleware/apiVersionMiddleware.ts` | 版本协商中间件 | P0 |
| `src/db/migrations/050-api-versions.sql` | 数据库迁移脚本 | P1 |
| `src/api/versioning/types.ts` | 类型定义 | P0 |

### 5.2 修改文件

| 文件路径 | 修改内容 |
|---------|---------|
| `src/app.ts` | 注册 apiVersionMiddleware 为全局 preHandler 钩子 |
| `src/api/routes.ts` | 使用 VersionedRouteRegistrar 重构路由注册 |
| `src/index.ts` | 初始化 ApiVersionRegistry 并传递给 app |

## 6. 实施计划

### Phase 1: 基础设施 (1-2 天)

1. 创建 `src/api/versioning/` 目录和 `types.ts`
2. 实现 `ApiVersionRegistry` 核心类
3. 实现 `VersionedRouteRegistrar`
4. 实现 `apiVersionMiddleware`
5. 编写单元测试

### Phase 2: 集成 (1 天)

1. 修改 `app.ts` 注册全局版本中间件
2. 修改 `routes.ts` 使用 VersionedRouteRegistrar
3. 实现 `version-routes.ts` 版本信息端点
4. 验证所有现有路由正常工作

### Phase 3: 持久化 (1 天)

1. 编写 `050-api-versions.sql` 迁移脚本
2. 实现废弃路由使用统计持久化
3. 集成到 Repository 模式

### Phase 4: 验证 (0.5 天)

1. 运行全部测试套件
2. 手动验证版本协商流程
3. 验证废弃路由响应头
4. 更新 API 文档

### 时间线

| 阶段 | 内容 | 预计时间 |
|-----|------|---------|
| Phase 1 | 基础设施 | 1-2 天 |
| Phase 2 | 集成 | 1 天 |
| Phase 3 | 持久化 | 1 天 |
| Phase 4 | 验证 | 0.5 天 |
| **总计** | | **3.5-4.5 天** |

## 7. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| 中间件性能开销 | 每个请求增加处理时间 | 注册表使用 Map 内存查询，<1ms |
| 迁移期间 404 增加 | 客户端未适配新路径 | Sunset 头 + Link 头引导迁移 |
| 路由注册表膨胀 | 50+ 路由元数据占内存 | 约 50KB，可忽略 |
| 废弃统计写入压力 | 高频请求导致数据库写入 | 批量聚合写入（每 5 分钟一次） |

## 8. 成功标准

- [ ] 所有现有 API 路由通过 VersionedRouteRegistrar 注册
- [ ] `GET /api/v1/version-info` 返回完整的版本和路由清单
- [ ] 支持 URL Path 和 Accept Header 版本协商
- [ ] 废弃路由响应包含 `Deprecation` 和 `Sunset` 头
- [ ] 废弃路由使用量可统计、可查询
- [ ] 单元测试覆盖率 > 90%
- [ ] 现有集成测试全部通过

## 9. 示例: 废弃路由标记

在 `routes.ts` 中标记废弃路由：

```typescript
// 标记 /v1/pipelines 为废弃，引导迁移到 /v2/pipelines
registrar.register({
  path: '/pipelines',
  method: 'GET',
  handler: pipelineController.list,
  description: '获取 Pipeline 列表',
  deprecated: true,
  deprecatedSince: '2026-05-01',
  sunsetDate: '2026-08-01',
  replacement: '/api/v2/pipelines',
});
```

客户端请求已废弃路由时的响应头：

```
HTTP/1.1 200 OK
Deprecation: true; version="v1"
Sunset: Sat, 01 Aug 2026 00:00:00 GMT
Link: </api/v2/pipelines>; rel="successor-version"
Content-Type: application/json
```

## 10. 与现有架构的集成点

### 10.1 在 app.ts 中的集成

```typescript
// 创建版本注册表
const versionRegistry = new ApiVersionRegistry();
versionRegistry.registerVersion({
  version: 'v1',
  status: 'stable',
  releaseDate: '2025-01-01',
  routes: [], // populated during route registration
});

// 注册全局版本中间件（在认证之后）
app.addHook('preHandler', async (request, reply) => {
  // skip health/version/livez/readyz endpoints
  if (request.url.match(/^\/(livez|readyz|healthz|version)$/)) return;
  return apiVersionMiddleware(request, reply, versionRegistry);
});
```

### 10.2 在 routes.ts 中的集成

```typescript
import { VersionedRouteRegistrar } from './versioning/VersionedRouteRegistrar';

export default async function apiRoutes(
  app: FastifyInstance,
  options: ApiRoutesOptions & { versionRegistry?: ApiVersionRegistry }
): Promise<void> {
  const registrar = new VersionedRouteRegistrar(app, 'v1', options.versionRegistry!);

  // 使用版本注册器注册 Pipeline 路由
  registrar.registerBatch([
    {
      path: '/pipelines',
      method: 'POST',
      handler: pipelineController.create,
      description: '创建 Pipeline',
    },
    {
      path: '/pipelines',
      method: 'GET',
      handler: pipelineController.list,
      description: '获取 Pipeline 列表',
    },
    // ... 其他路由
  ]);

  // 子模块路由仍然使用 register + prefix 方式
  await app.register(cmdbRoutes, { prefix: '/v1/cmdb', ... });
}
```
