# orion-platform-core

Orion Platform Core Service -- 微服务架构的"底座"。提供租户隔离、用户管理、权限系统 (RBAC)、API Key 管理、全局配置、服务发现等核心能力，同时提供可复用的中间件供其他微服务集成。

## 功能概述

| 模块 | 说明 |
|------|------|
| **多租户管理** | 租户的创建、查询、更新、暂停，支持套餐 (free/pro/enterprise) 和租户级配置 |
| **项目管理** | 租户下项目的 CRUD，软删除 |
| **用户管理** | 用户 CRUD、禁用、租户级用户列表 |
| **RBAC 权限** | 角色管理、权限分配、用户角色绑定、权限检查 (Redis 缓存加速) |
| **系统配置** | 全局/租户/项目三级配置，支持加密字段和 Redis 缓存 |
| **API Key** | 密钥生成 (SHA-256 哈希存储)、验证、撤销、使用记录 |
| **服务发现** | 服务注册/注销、心跳检测、服务查询 |
| **审计日志** | 数据库审计日志表 (audit_logs) |

## 中间件 (供其他微服务复用)

| 中间件 | 说明 | 使用方式 |
|--------|------|----------|
| `jwtAuth` | JWT 认证，从 Bearer token 提取用户信息 | `app.register(jwtAuth, { secret })` |
| `tenantIsolation` | 租户隔离，从 header/JWT/query 提取 tenantId | `app.register(tenantIsolation)` |
| `requirePermission` | 权限检查，验证用户是否有指定权限 | `app.register(requirePermission)` |
| `apiKeyAuth` | API Key 认证，从 X-API-Key header 验证 | `app.register(apiKeyAuth)` |

## API 端点

```
# 租户管理
POST   /api/v1/tenants                      创建租户
GET    /api/v1/tenants                      列表租户
GET    /api/v1/tenants/:id                  获取租户
PATCH  /api/v1/tenants/:id                  更新租户
POST   /api/v1/tenants/:id/suspend          暂停租户

# 项目管理
POST   /api/v1/tenants/:id/projects         创建项目
GET    /api/v1/tenants/:tenantId/projects   列表项目
GET    /api/v1/projects/:id                 获取项目
PATCH  /api/v1/projects/:id                 更新项目
DELETE /api/v1/projects/:id                 删除项目

# 用户管理
POST   /api/v1/tenants/:tenantId/users      创建用户
GET    /api/v1/tenants/:tenantId/users      列表用户
GET    /api/v1/users/:id                    获取用户
PATCH  /api/v1/users/:id                    更新用户
POST   /api/v1/users/:id/disable            禁用用户

# RBAC 权限
GET    /api/v1/roles                        角色列表
POST   /api/v1/roles                        创建角色
GET    /api/v1/roles/:id                    获取角色
POST   /api/v1/roles/:id/permissions        设置权限
POST   /api/v1/roles/assign                 分配角色给用户
POST   /api/v1/permissions/check            检查权限

# 系统配置
GET    /api/v1/configs                      列表配置
POST   /api/v1/configs                      创建配置
GET    /api/v1/configs/:key                 获取配置
PATCH  /api/v1/configs/:id                  更新配置
DELETE /api/v1/configs/:id                  删除配置

# API Key
GET    /api/v1/api-keys                     API Key 列表
POST   /api/v1/api-keys                     创建 API Key
DELETE /api/v1/api-keys/:id                撤销 API Key

# 服务发现
POST   /api/v1/services/register            注册服务
DELETE /api/v1/services/:name               注销服务
GET    /api/v1/services                     列表服务
GET    /api/v1/services/:name               获取服务详情
POST   /api/v1/services/:name/heartbeat     更新心跳
GET    /api/v1/services/:name/discover      发现服务地址

GET    /health                              健康检查 (含 DB/Redis 状态)
GET    /docs                                Swagger 文档
```

## 技术栈

- **运行时**: Node.js >= 20
- **框架**: Fastify 5.x
- **语言**: TypeScript 5.x
- **数据库**: PostgreSQL 16
- **缓存**: Redis 7
- **事件总线**: NATS 2.10
- **验证**: Zod
- **JWT**: jsonwebtoken

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 填入实际值
```

### 3. 启动依赖服务

```bash
docker compose up -d postgres redis nats
```

### 4. 启动开发服务器

```bash
npm run dev
```

服务器将在 http://localhost:3001 启动，Swagger 文档在 http://localhost:3001/docs。

### 5. 生产构建

```bash
npm run build
npm start
```

## Docker Compose 一键启动

```bash
docker compose up -d
```

这会启动平台服务及其所有依赖 (PostgreSQL, Redis, NATS)。

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `NODE_ENV` | `development` | 运行环境 |
| `PORT` | `3001` | HTTP 端口 |
| `HOST` | `0.0.0.0` | 绑定地址 |
| `LOG_LEVEL` | `info` | 日志级别 |
| `DATABASE_URL` | - | PostgreSQL 连接串 |
| `REDIS_URL` | - | Redis 连接串 |
| `NATS_URL` | - | NATS 连接串 |
| `JWT_SECRET` | - | JWT 签名密钥 |
| `CORS_ORIGIN` | `*` | CORS 允许来源 |
| `RATE_LIMIT_MAX` | `100` | 速率限制最大请求数 |
| `RATE_LIMIT_WINDOW` | `1 minute` | 速率限制时间窗口 |
| `DB_MAX_CONNECTIONS` | `20` | 数据库连接池最大连接数 |
| `RUN_MIGRATIONS` | `true` | 启动时是否运行数据库迁移 |

## 项目结构

```
src/
  app.ts                      # Fastify 应用入口 + graceful shutdown
  middleware/
    jwtAuth.ts                # JWT 认证中间件
    tenantIsolation.ts        # 租户隔离中间件
    requirePermission.ts      # 权限检查中间件
    apiKeyAuth.ts             # API Key 认证中间件
  routes/
    tenant.ts                 # 租户管理路由
    project.ts                # 项目管理路由
    user.ts                   # 用户管理路由
    rbac.ts                   # RBAC 权限路由
    config.ts                 # 系统配置 & API Key 路由
    serviceDiscovery.ts       # 服务发现路由
  services/
    TenantService.ts          # 多租户管理
    ProjectService.ts         # 项目管理
    UserService.ts            # 用户管理
    RBACService.ts            # RBAC 权限管理 (含 Redis 缓存)
    ConfigService.ts          # 全局配置管理 (含 Redis 缓存)
    ApiKeyService.ts          # API Key 管理 (SHA-256 哈希)
    ServiceDiscoveryService.ts # 服务发现注册
  types/
    core.ts                   # 完整类型定义 (30+ 种)
  utils/
    database.ts               # 数据库连接池 + 迁移
    redis.ts                  # Redis 客户端
    eventBus.ts               # NATS 事件总线
migrations/
  001-platform-core-base-schema.sql  # 数据库初始 Schema (10 张表)
```

## 数据库 Schema

10 张核心表：
- `tenants` — 租户信息
- `projects` — 项目信息
- `users` — 用户信息
- `roles` — 角色定义
- `role_assignments` — 用户角色绑定
- `api_keys` — API Key 管理
- `system_configs` — 全局/租户/项目配置
- `service_registry` — 服务注册发现
- `audit_logs` — 操作审计日志

## 事件总线

通过 NATS 发布以下平台事件：
- `tenant.created` / `tenant.updated` / `tenant.suspended`
- `project.created` / `project.updated` / `project.deleted`
- `user.created` / `user.updated` / `user.disabled`
- `apikey.created` / `apikey.revoked`
- `role.updated`
- `config.changed`
- `service.registered` / `service.deregistered` / `service.heartbeat`
