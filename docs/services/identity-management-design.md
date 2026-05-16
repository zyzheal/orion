# S16: 统一身份与访问管理设计文档

> 模块: User / Role / Session Management (S16 合并)
> 状态: 已实现 (PostgreSQL Repository 模式)
> 更新日期: 2026-05-15

## 1. 模块概述

S16 模块整合了 Orion 平台的三大身份与访问管理子模块：**用户管理**、**角色管理**、**会话管理**，共同构成平台的统一身份认证与访问控制基础设施。

| 子模块 | 路由文件 | Service | 控制器 | 前端页面 |
|--------|---------|---------|--------|---------|
| 用户管理 | `user-routes.ts` | `UserService` | `UserController` | `UserManagement/` |
| 角色管理 | `role-routes.ts` | `RoleService` | `RoleController` | `RoleManagement/` |
| 会话管理 | `session-routes.ts` | `SessionService` | `SessionController` | `Sessions/` |

三个子模块均采用统一的 **PostgreSQL Repository 模式** 架构，从内存 Map 存储迁移至持久化数据库，支持多租户隔离与 RBAC 权限模型。

### 核心能力

- **用户生命周期管理**: 创建、查询、更新、软删除、启用/禁用、密码修改、多租户关联
- **RBAC 角色系统**: 角色 CRUD、权限数组分配、租户级角色隔离
- **会话生命周期**: 基于 Token 的会话创建、验证、续签、撤销、过期清理
- **认证中间件**: JWT 令牌验证 + 角色守卫 (roleGuard) 双重防护
- **密码安全**: PBKDF2 (10 万次迭代) 哈希，兼容历史 SHA-256 迁移格式

## 2. 系统架构

### 2.1 分层架构

```
HTTP 请求
    |
    v
+-------------------+     Fastify Routes (orion-platform-service/src/api/)
|   API Routes      |     user-routes.ts / role-routes.ts / session-routes.ts
+--------+----------+
         |
         v
+-------------------+     Controllers (src/api/controllers/)
|   Controllers     |     UserController / RoleController / SessionController
+--------+----------+     HTTP 请求/响应桥接，错误码映射，参数校验
         |
         v
+-------------------+     Services (src/services/{user,role,session}/)
|   Services        |     UserService / RoleService / SessionService
+--------+----------+     业务逻辑层：验证、规则、密码哈希、认证
         |
         v
+-------------------+     Repositories (src/services/{user,role,session}/)
|   Repositories    |     UserRepository / RoleRepository / SessionRepository
+--------+----------+     数据访问层：SQL 查询、事务管理
         |
         v
+-------------------+     PostgreSQL Database
|   PostgreSQL      |     users / roles / sessions / tenant_users / ...
+-------------------+
```

### 2.2 依赖注入链

每个路由模块遵循一致的初始化模式：

```typescript
// 1. 路由接收数据库连接池
const repository = new UserRepository(databasePool);

// 2. Repository 注入 Service
const service = new UserService(repository);

// 3. Service 注入 Controller
const controller = new UserController(service);

// 4. Controller 挂载到路由处理器
app.get('/', async (request, reply) => controller.list(request, reply));
```

### 2.3 中间件链

```
请求 -> authenticateUser (JWT 验证) -> roleGuard([...roles]) -> 业务处理器
```

## 3. 数据库模型

### 3.1 核心表结构

#### users 表 (Migration 001)

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK, DEFAULT gen_random_uuid() | 用户唯一标识 |
| username | VARCHAR(100) | NOT NULL, UNIQUE | 登录用户名 |
| email | VARCHAR(255) | UNIQUE | 邮箱地址 |
| password_hash | VARCHAR(255) | NOT NULL | PBKDF2 密码哈希 |
| name | VARCHAR(200) | | 显示名称 |
| avatar_url | VARCHAR(512) | | 头像 URL |
| role | VARCHAR(50) | NOT NULL, DEFAULT 'user' | 角色标识 |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active' | active/inactive/deleted/locked |
| last_login_at | TIMESTAMPTZ | | 最后登录时间 |
| last_login_ip | INET | | 最后登录 IP |
| settings | JSONB | NOT NULL, DEFAULT '{}' | 用户偏好设置 |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | 创建时间 |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | 更新时间 |
| created_by | UUID | FK -> users(id) | 创建者 |

索引: `idx_users_email`, `idx_users_status`

#### roles 表 (Migration 002)

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK, DEFAULT gen_random_uuid() | 角色唯一标识 |
| tenant_id | UUID | NOT NULL, FK -> tenants(id) | 所属租户 |
| name | VARCHAR(100) | NOT NULL | 角色名称 |
| description | TEXT | | 角色描述 |
| is_system | BOOLEAN | NOT NULL, DEFAULT false | 系统内置角色 |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | 创建时间 |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | 更新时间 |

约束: `UNIQUE(tenant_id, name)` — 租户内角色名唯一

#### role_permissions 表 (Migration 002)

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | 映射 ID |
| role_id | UUID | NOT NULL, FK -> roles(id) | 角色 ID |
| permission_id | UUID | NOT NULL, FK -> permissions(id) | 权限 ID |

约束: `UNIQUE(role_id, permission_id)`

#### permissions 表 (Migration 002)

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | 权限 ID |
| resource | VARCHAR(100) | NOT NULL | 资源名 (pipeline, deployment, ...) |
| action | VARCHAR(50) | NOT NULL | 操作 (read, write, execute, delete, manage) |
| description | TEXT | | 权限描述 |

约束: `UNIQUE(resource, action)`

#### sessions 表 (Migration 051)

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK, DEFAULT gen_random_uuid() | 会话 ID |
| user_id | VARCHAR(255) | NOT NULL | 用户 ID |
| tenant_id | VARCHAR(255) | NOT NULL | 租户 ID |
| token | VARCHAR(255) | NOT NULL, UNIQUE | 随机 Hex 令牌 |
| expires_at | TIMESTAMPTZ | NOT NULL | 过期时间 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |

索引: `idx_sessions_user`, `idx_sessions_token`, `idx_sessions_expires`

#### tenant_users 表 (Migration 001)

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | 映射 ID |
| tenant_id | UUID | NOT NULL, FK -> tenants(id) | 租户 ID |
| user_id | UUID | NOT NULL, FK -> users(id) | 用户 ID |
| role | VARCHAR(50) | NOT NULL, DEFAULT 'member' | 租户内角色 |

约束: `UNIQUE(tenant_id, user_id)`

### 3.2 TypeScript 接口

```typescript
// User 实体
interface User {
  id: string;
  username: string;
  email: string | null;
  password_hash: string;
  name: string | null;
  avatar_url: string | null;
  role: string;
  status: string;
  last_login_at: Date | null;
  last_login_ip: string | null;
  settings: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
}

// Role 实体
interface Role {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  permissions: string[];
}

// Session 实体
interface Session {
  id: string;
  user_id: string;
  tenant_id: string;
  token: string;
  expires_at: Date;
  created_at: Date;
}
```

## 4. 用户生命周期

### 4.1 用户创建流程

```
POST /api/v1/users
    |
    v
UserController.create()
    |
    v  1. 校验必填字段 (username, passwordHash)
    v  2. 校验用户名格式 (仅字母/数字/连字符/下划线)
    v  3. 检查用户名是否重复
    v  4. 检查邮箱格式及是否重复
    v  5. PBKDF2 哈希密码 (100,000 次迭代, SHA-256, 64 字节)
    v  6. 事务: INSERT users + INSERT tenant_users (如指定 tenantId)
    |
    v
返回 201 { success: true, data: User }
```

**业务规则**:
- 用户名必须唯一 (排除已软删除用户)
- 密码最小长度 8 字符
- 创建时默认状态为 `active`
- 创建时默认角色为 `user`
- 如提供 `tenantId`，在同一事务中建立租户关联

### 4.2 用户更新

```
PUT /api/v1/users/:id
    |
    v
UserController.update()
    |
    v  1. 确认用户存在
    v  2. 如修改用户名/邮箱，检查唯一性
    v  3. 动态构建 UPDATE 语句 (仅更新提供的字段)
    v  4. 自动更新 updated_at
    |
    v
返回 200 { success: true, data: User }
```

**可更新字段**: username, email, name, avatar_url, role, status, settings

### 4.3 用户删除 (软删除)

```
DELETE /api/v1/users/:id
    |
    v
UserController.delete() -> UserService.deleteUser()
    |
    v
UPDATE users SET status = 'deleted', updated_at = NOW() WHERE id = $1
```

- 软删除仅修改状态，不物理删除记录
- Repository 层同时提供 `hardDelete()` 方法 (慎用)
- 查询时通过 `status != 'deleted'` 排除已删除用户

### 4.4 用户认证

```
POST /api/v1/users/authenticate
Body: { username, password }
    |
    v
UserService.authenticate()
    |
    v  1. 按用户名查找用户
    v  2. 检查状态是否为 active
    v  3. 比对密码 (支持 PBKDF2 / SHA-256 / 明文迁移)
    v  4. 更新 last_login_at 和 last_login_ip
    |
    v
返回用户实体 (后续由 SessionService 创建会话)
```

### 4.5 密码修改

```
POST /api/v1/users/:id/change-password
Body: { oldPassword, newPassword }
    |
    v  1. 校验新密码长度 (>= 8)
    v  2. 验证旧密码正确性
    v  3. PBKDF2 哈希新密码
    v  4. 更新 password_hash
```

### 4.6 状态流转

```
                    ┌──────────┐
         创建 ────> │  active  │ <── 启用
                    └────┬─────┘
                    ┌────┴─────┐
                    │ inactive │
                    └────┬─────┘
                    ┌────┴─────┐
                    │  locked  │
                    └────┬─────┘
                    ┌────┴─────┐
                    │ deleted  │ (软删除)
                    └──────────┘
```

## 5. 角色系统 (RBAC)

### 5.1 数据模型

当前实现采用 **扁平权限数组** 模式:

```
Role {
  id, tenant_id, name, description, permissions: string[]
}
```

权限字符串格式: `{resource}:{action}`

常见权限示例:
- `pipeline:read`, `pipeline:write`, `pipeline:execute`, `pipeline:delete`
- `deployment:read`, `deployment:write`, `deployment:execute`
- `monitoring:read`, `monitoring:write`
- `alert:read`, `alert:write`, `alert:acknowledge`
- `config:read`, `config:write`
- `finops:read`, `finops:write`
- `cmdb:read`, `cmdb:write`
- `audit:read`
- `artifact:read`, `artifact:write`

### 5.2 RBAC 层级关系

```
Tenant
  |
  +-- Role (tenant_id 隔离)
  |     |
  |     +-- permissions: string[] (权限列表)
  |
  +-- User (通过 users.role 或 tenant_users.role 关联)
```

数据库层面设计了完整的 RBAC 关联表 (`user_roles`, `role_permissions`, `permissions`)，
但当前 Service 层采用简化实现：Role 直接存储 `permissions` JSON 数组，
User 通过 `role` 字符串字段关联角色名。

### 5.3 角色 CRUD

```
GET  /api/v1/roles?tenantId=xxx       — 列出租户下所有角色
GET  /api/v1/roles/:id                — 获取角色详情
POST /api/v1/roles                    — 创建角色 (需 tenantId, name, permissions)
PUT  /api/v1/roles/:id                — 更新角色 (name, description, permissions)
DELETE /api/v1/roles/:id              — 删除角色
```

**业务规则**:
- 角色必须关联租户 (`tenantId` 必填)
- 租户内角色名唯一
- 系统内置角色 (`is_system=true`) 在前端禁止删除

### 5.4 预置角色

前端定义了以下预置角色 (Mock 数据，可作为系统初始化模板):

| 角色 | 描述 | 核心权限 |
|------|------|---------|
| Admin | 系统管理员 | 全部权限 |
| Developer | 开发人员 | pipeline R/W/E, deployment R/E, monitoring R, alert R/A, config R, artifact R |
| Viewer | 只读用户 | 全模块 read 权限 |
| DevOps | 运维工程师 | pipeline R/W/E/D, deployment R/W/E/D, monitoring R/W, alert R/W/A, config R/W, cmdb R/W, artifact R/W |
| FinOps | 成本管理 | finops R/W, deployment R, monitoring R |

## 6. 会话生命周期

### 6.1 会话创建 (Login)

```
POST /api/v1/sessions
Body: { userId, tenantId, expiresInHours? }
    |
    v  1. 生成随机 Token (crypto.randomBytes(32).toString('hex'), 64 字符)
    v  2. 计算过期时间 (默认 24 小时)
    v  3. INSERT sessions 记录
    |
    v
返回 201 {
  success: true,
  data: { sessionId, userId, tenantId, token, expiresAt, createdAt }
}
```

### 6.2 会话验证

```
POST /api/v1/sessions/verify
Body: { token }
    |
    v  1. 查询 sessions WHERE token = $1 AND expires_at > NOW()
    v  2. 返回会话信息或 401
```

### 6.3 会话续签

```
POST /api/v1/sessions/:token/refresh
Body: { extendHours? }  (默认 24 小时)
    |
    v  1. 确认会话存在且未过期
    v  2. UPDATE sessions SET expires_at = new_expires WHERE token = $1
    |
    v
返回 { sessionId, expiresAt }
```

### 6.4 会话撤销 (Logout)

```
DELETE /api/v1/sessions/:token
    |
    v
DELETE FROM sessions WHERE token = $1
    |
    v
返回 { success: true, message: 'Session revoked' }
```

### 6.5 过期清理

```
POST /api/v1/sessions/cleanup  (需要 admin / platform_admin 角色)
    |
    v
DELETE FROM sessions WHERE expires_at < NOW()
    |
    v
返回 { cleanedSessions: N, message: 'N expired sessions removed' }
```

### 6.6 查询用户会话

```
GET /api/v1/sessions/user/:userId?tenantId=xxx
    |
    v  SELECT * FROM sessions
       WHERE user_id = $1
         AND (tenant_id = $2)  -- 可选
         AND expires_at > NOW()
       ORDER BY created_at DESC
```

### 6.7 完整会话流程图

```
登录请求
    |
    v
UserService.authenticate(username, password)
    |  验证凭据
    v
SessionService.createSession(userId, tenantId, 24h)
    |  生成 token, 写入 sessions 表
    v
JWT.sign({ userId, username, role })
    |  签发 JWT (与 session token 并存)
    v
返回 { token (JWT), sessionToken, user }
    |
    |--- 后续请求携带 Authorization: Bearer <JWT>
    |--- authenticateUser 中间件验证 JWT
    |--- 可选使用 session token 进行会话追踪
    |
    v
Logout: DELETE /api/v1/sessions/:token
    |
    v
JWT 失效 (客户端删除) + sessions 记录删除
```

## 7. 认证中间件

### 7.1 JWT 认证 (authMiddleware.ts)

**文件**: `orion-platform-service/src/middleware/authMiddleware.ts`

```typescript
export async function authenticateUser(request, reply): Promise<void>
```

**工作流程**:
1. 从 `Authorization` 请求头提取 Bearer Token
2. 使用 `JWT_SECRET` 环境变量验证 JWT 签名和过期时间
3. 解码 payload: `{ userId, username, role }`
4. 将用户信息附加到 `request.user`
5. 无效/缺失 token 返回 401 `UNAUTHORIZED`

**安全要求**:
- `JWT_SECRET` 环境变量必须设置，否则启动时抛出异常
- JWT 过期由签发方控制 (标准 `exp` claim)

### 7.2 角色守卫 (roleGuard.ts)

**文件**: `orion-platform-service/src/middleware/roleGuard.ts`

```typescript
export function roleGuard(requiredRoles: string[])
```

**工作流程**:
1. 从 `request.user.role` 获取当前用户角色
2. 检查是否在 `requiredRoles` 白名单中
3. 角色不匹配返回 403 `FORBIDDEN` + 中文提示 `权限不足，需要角色: admin / platform_admin`

**使用方式**:
```typescript
app.post('/cleanup', {
  onRequest: [authenticateUser, roleGuard(['admin', 'platform_admin'])],
}, handler);
```

### 7.3 中间件组合模式

```typescript
// 公开路由 (无需认证)
app.post('/authenticate', controller.authenticate);

// 认证路由 (仅需登录)
app.get('/:id', { onRequest: [authenticateUser] }, controller.getDetail);

// 权限路由 (需登录 + 特定角色)
app.post('/cleanup', {
  onRequest: [authenticateUser, roleGuard(['admin', 'platform_admin'])],
}, controller.cleanup);
```

## 8. API 端点参考

### 8.1 用户管理 API (`/api/v1/users`)

| 方法 | 路径 | 描述 | 认证 | 请求体 | 响应 |
|------|------|------|------|--------|------|
| GET | `/` | 分页列出用户 | 是 | query: page, limit, tenantId, status, role | PaginatedResult<User> |
| GET | `/:id` | 获取用户详情 | 是 | — | User |
| POST | `/` | 创建用户 | 是 | CreateUserInput | User (201) |
| PUT | `/:id` | 更新用户 | 是 | UpdateUserInput | User |
| DELETE | `/:id` | 软删除用户 | 是 | — | { success, message } |
| POST | `/authenticate` | 用户认证 | 否 | { username, password } | User |
| POST | `/:id/change-password` | 修改密码 | 是 | { oldPassword, newPassword } | { success, message } |
| GET | `/by-tenant/:tenantId` | 获取租户下用户 | 是 | — | User[] |
| POST | `/:userId/tenants/:tenantId` | 添加用户到租户 | 是 | { role? } | { success, message } |
| DELETE | `/:userId/tenants/:tenantId` | 从租户移除用户 | 是 | — | { success, message } |

**请求示例 — 创建用户**:
```bash
curl -X POST http://localhost:3001/api/v1/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt>" \
  -d '{
    "username": "zhangsan",
    "passwordHash": "mySecurePass123",
    "email": "zhangsan@example.com",
    "name": "张三",
    "role": "developer",
    "tenantId": "tenant-001"
  }'
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "zhangsan",
    "email": "zhangsan@example.com",
    "name": "张三",
    "role": "developer",
    "status": "active",
    "settings": {},
    "created_at": "2026-05-15T10:00:00Z",
    "updated_at": "2026-05-15T10:00:00Z"
  }
}
```

**请求示例 — 分页查询**:
```bash
curl "http://localhost:3001/api/v1/users?page=1&limit=20&status=active&role=developer"
```

### 8.2 角色管理 API (`/api/v1/roles`)

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/` | 列出租户角色 | query: tenantId | Role[] |
| GET | `/:id` | 角色详情 | — | Role |
| POST | `/` | 创建角色 | { tenantId, name, permissions } | Role (201) |
| PUT | `/:id` | 更新角色 | { name?, description?, permissions? } | Role |
| DELETE | `/:id` | 删除角色 | — | { success, message } |

**请求示例 — 创建角色**:
```bash
curl -X POST http://localhost:3001/api/v1/roles \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "tenant-001",
    "name": "QA Engineer",
    "permissions": ["pipeline:read", "pipeline:execute", "monitoring:read", "alert:read"]
  }'
```

### 8.3 会话管理 API (`/api/v1/sessions`)

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/` | 创建会话 (登录) | { userId, tenantId, expiresInHours? } | { session, token } (201) |
| POST | `/verify` | 验证会话 | { token } | Session |
| DELETE | `/:token` | 撤销会话 (登出) | — | { success } |
| POST | `/cleanup` | 清理过期会话 (admin) | — | { cleanedSessions } |
| GET | `/user/:userId` | 查询用户会话 | query: tenantId | Session[] |
| POST | `/:token/refresh` | 续签会话 | { extendHours? } | { sessionId, expiresAt } |

## 9. 前端页面结构

### 9.1 用户管理页面

**文件**: `orion-frontend/src/pages/UserManagement/index.tsx`

- **技术栈**: React + Ant Design + Day.js
- **组件结构**:
  - 顶部统计面板 (用户总数、已启用、已禁用、管理员)
  - 搜索过滤栏 (关键词搜索 + 角色/状态下拉筛选)
  - 用户列表表格 (Avatar + 用户名、邮箱、角色标签、状态标签、最后登录、创建时间、操作列)
  - 创建用户 Modal (用户名、密码、显示名称、邮箱、角色选择)
  - 编辑用户 Modal
  - 重置密码 Modal (当前密码 + 新密码 + 确认)
  - 用户详情 Drawer (Descriptions 全量信息)

- **操作能力**: 创建、编辑、详情查看、启用/禁用、重置密码、删除 (admin 角色除外)
- **角色颜色映射**: admin=red, developer=blue, manager=gold, viewer=default
- **状态标签**: active=green, inactive=default, deleted=error, locked=orange

### 9.2 角色管理页面

**文件**: `orion-frontend/src/pages/RoleManagement/index.tsx`

- **组件结构**:
  - 角色列表表格 (名称、描述、权限数量、关联用户数、创建时间)
  - 搜索框 (按名称/描述过滤)
  - 创建角色 Modal (名称、描述、权限复选框按组分类)
  - 角色详情 Drawer (基本信息 + 分组权限展示 + 关联用户列表)

- **权限分组**: 前端定义 `PERMISSION_GROUPS` 常量，按模块分组展示 (Pipeline、Deployment、Monitoring、Alert、Config、Artifact、CMDB、FinOps、Audit)
- **操作**: 创建、详情查看、删除 (系统角色除外)

### 9.3 会话管理页面

**文件**: `orion-frontend/src/pages/Sessions/index.tsx`

- **组件结构**:
  - 指标卡片 (活跃会话数、总用户数、过期会话数、平均会话时长)
  - 会话列表表格 (用户、IP、UserAgent、开始时间、最后活跃、状态、持续时间)
  - 状态过滤 (active/expired/revoked)
  - 会话详情 Drawer
  - 撤销会话操作

- **状态标签**: active=success, expired=default, revoked=error

## 10. 集成点

### 10.1 JWT 集成

- JWT 由认证流程签发，payload 包含 `userId`, `username`, `role`
- `JWT_SECRET` 通过环境变量注入，所有微服务共享同一密钥
- JWT 与 Session Token 并存：JWT 用于 API 认证，Session Token 用于服务端会话追踪

### 10.2 多租户隔离

- 用户通过 `tenant_users` 关联表与租户绑定
- 角色通过 `tenant_id` 字段实现租户级隔离
- 用户列表查询支持按 `tenantId` 过滤
- 用户创建时可同时指定 `tenantId`，在同一事务中完成用户+租户关联

### 10.3 SSO / OAuth 扩展点

当前实现为基于用户名/密码的原生认证。扩展 SSO/OAuth 的切入点:

1. **UserService.authenticate()** — 可扩展为 OAuth provider 回调处理
2. **SessionService.createSession()** — 可为 SSO 登录复用，统一管理会话
3. **authMiddleware** — 可添加 SAML/OIDC token 验证分支

### 10.4 审计日志集成

- 用户登录时自动记录 `last_login_at` 和 `last_login_ip`
- `created_by` 字段记录用户创建者，支持溯源
- 会话清理操作可触发审计事件
- 角色/权限变更可通过事件发布器 (events/) 广播审计事件

### 10.5 与业务模块集成

- **Pipeline**: 角色守卫检查 `pipeline:execute` 权限后允许执行流水线
- **Deployment**: 角色守卫检查 `deployment:execute` 权限
- **所有受保护路由**: 通过 `authenticateUser + roleGuard([...])` 组合中间件实现访问控制

## 11. 安全考量

### 11.1 密码安全

| 方面 | 实现 |
|------|------|
| 哈希算法 | PBKDF2-SHA256, 100,000 次迭代 |
| Salt | 16 字节随机盐 (crypto.randomBytes) |
| 派生密钥长度 | 64 字节 |
| 存储格式 | `pbkdf2$salt$iterations$hash` |
| 最小密码长度 | 8 字符 |
| 迁移兼容 | 支持遗留 SHA-256 哈希和明文回退 |

### 11.2 会话安全

| 方面 | 实现 |
|------|------|
| Token 强度 | 32 字节随机 (64 字符 Hex) |
| 默认有效期 | 24 小时 |
| 过期清理 | 管理员可手动触发 `cleanup`，数据库按 `expires_at` 索引 |
| 撤销机制 | DELETE 物理删除会话记录 |
| 续签 | 延长 `expires_at`，仅对未过期会话有效 |

### 11.3 并发会话

- 当前无并发会话数限制
- `listByUser` 可查询用户所有活跃会话，前端可实现"注销其他会话"功能
- 扩展点: 在 `createSession` 前检查 `findByUser` 返回的活跃会话数量

### 11.4 输入校验

- 用户名格式: `/^[a-zA-Z0-9_-]+$/`
- 邮箱格式: RFC 基础正则验证
- 密码长度: 最小 8 字符
- 参数化 SQL 查询: 所有 Repository 方法使用 `$1, $2...` 占位符

### 11.5 错误处理

- 认证失败: 401 `INVALID_CREDENTIALS` (不区分用户名错误还是密码错误，防止枚举)
- 账户非活跃: 403 `ACCOUNT_INACTIVE`
- 重复用户名/邮箱: 409 `DUPLICATE_USERNAME` / `DUPLICATE_EMAIL`
- 权限不足: 403 `FORBIDDEN`
- 角色/用户不存在: 404 `NOT_FOUND`

### 11.6 待完善项

1. **并发会话限制**: 未实现最大会话数约束
2. **登录失败锁定**: 无暴力破解防护 (无失败计数、无 IP 封禁)
3. **JWT 过期策略**: 当前 JWT 过期时间由签发方控制，需统一配置
4. **Session Token 与 JWT 的一致性**: 当前双轨并行，建议明确各自职责边界
5. **密码过期策略**: 无密码定期更换要求
6. **MFA/2FA**: 未实现多因素认证
7. **系统角色保护**: 数据库层有 `is_system` 字段，但 Service 层未强制执行删除保护

## 12. 测试覆盖

| 测试文件 | 内容 |
|---------|------|
| `services/user/__tests__/UserService.test.ts` | UserService 业务逻辑测试 |
| `services/user/__tests__/UserRepository.test.ts` | UserRepository 数据访问测试 |
| `services/role/__tests__/RoleService.test.ts` | RoleService 业务逻辑测试 |
| `services/session/__tests__/SessionService.test.ts` | SessionService 业务逻辑测试 |

## 13. 迁移历史

| Migration | 内容 |
|-----------|------|
| 001 | 核心表: users, tenants, tenant_users, refresh_tokens |
| 002 | RBAC 表: roles, permissions, role_permissions, user_roles |
| 051 | 会话表: sessions |
