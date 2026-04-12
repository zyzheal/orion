# Orion API Gateway - 认证 API 参考

## 概述

本文档描述了 Orion API Gateway 的认证授权相关接口。

## 接口列表

### 1. 用户登录

**接口**: `POST /api/v1/auth/login`

**请求体**:
```json
{
  "username": "admin",
  "email": "admin@orion.com",
  "password": "password123",
  "rememberMe": false
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "abc123def456...",
    "expiresIn": 86400,
    "refreshTokenExpiresIn": 604800,
    "user": {
      "id": "1",
      "username": "admin",
      "email": "admin@orion.com",
      "roles": ["admin"]
    }
  }
}
```

**错误响应**:
- 400: 输入参数无效
- 401: 用户名/密码错误

---

### 2. 刷新 Token

**接口**: `POST /api/v1/auth/refresh`

**请求体**:
```json
{
  "refreshToken": "abc123def456..."
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "xyz789ghi012...",
    "expiresIn": 86400,
    "refreshTokenExpiresIn": 604800
  }
}
```

**特性**:
- 使用 Redis Lua 脚本保证原子性
- 防止重放攻击（每个 Refresh Token 只能使用一次）
- 设备指纹绑定验证

**错误响应**:
- 400: 缺少 refresh token
- 401: Token 无效或已过期

---

### 3. 用户登出

**接口**: `POST /api/v1/auth/logout`

**请求体**:
```json
{
  "refreshToken": "abc123def456...",
  "all": false
}
```

**参数说明**:
- `refreshToken`: 要撤销的刷新令牌
- `all`: 是否撤销该用户的所有设备登录（可选，默认 false）

**响应** (200 OK):
```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

### 4. 获取当前用户信息

**接口**: `GET /api/v1/auth/me`

**请求头**:
```
Authorization: Bearer <accessToken>
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "1",
    "username": "admin",
    "email": "admin@orion.com",
    "roles": ["admin"],
    "permissions": ["*"],
    "deviceId": "a1b2c3d4e5f6..."
  }
}
```

**错误响应**:
- 401: 未认证

---

### 5. 用户注册

**接口**: `POST /api/v1/auth/register`

**请求体**:
```json
{
  "username": "newuser",
  "email": "newuser@example.com",
  "password": "securepass123"
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "message": "Registration successful"
}
```

**错误响应**:
- 400: 用户名或邮箱已存在

---

## Token 机制

### Access Token
- **有效期**: 24 小时
- **格式**: JWT
- **用途**: 用于 API 请求认证
- **传递方式**: 
  - `Authorization: Bearer <token>`
  - `X-API-Key: <token>`
  - Query 参数 `?token=<token>`

### Refresh Token
- **有效期**: 7 天
- **格式**: 随机字符串
- **存储**: Redis
- **特性**:
  - 一次性使用（防止重放攻击）
  - 设备指纹绑定
  - 原子性刷新操作

### 设备指纹
设备指纹基于以下信息生成：
- User-Agent
- IP 地址
- 随机因子

格式：32 字符 SHA256 哈希

---

## RBAC 权限模型

### 预定义角色

| 角色 ID | 名称 | 描述 |
|--------|------|------|
| `admin` | Administrator | 系统管理员，拥有所有权限 |
| `developer` | Developer | 开发者，拥有大部分读写权限 |
| `operator` | Operator | 运维人员，拥有部署和监控权限 |
| `tester` | Tester | 测试人员，拥有测试相关权限 |
| `guest` | Guest | 访客，仅拥有只读权限 |

### 权限格式

权限 ID 采用 `resource:action` 格式：
- `project:read` - 读取项目
- `project:write` - 写入项目
- `deployment:create` - 创建部署
- `pipeline:trigger` - 触发流水线

### 权限检查

在受保护的路由中，可以通过以下方式检查权限：

```typescript
// 检查角色
app.get('/admin-only', {
  preHandler: [authMiddleware.requireRoles('admin')]
}, handler);

// 检查权限
app.get('/projects', {
  preHandler: [authMiddleware.requirePermissions('project:read')]
}, handler);
```

---

## 测试账号

开发环境提供以下测试账号：

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | admin |
| developer | dev123 | developer |
| tester | test123 | tester |

---

## 环境变量配置

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `JWT_SECRET` | JWT 签名密钥 | `orion-default-jwt-secret-change-in-production` |
| `JWT_EXPIRES_IN` | Access Token 有效期 | `24h` |
| `REDIS_HOST` | Redis 主机 | `localhost` |
| `REDIS_PORT` | Redis 端口 | `6379` |
| `REDIS_PASSWORD` | Redis 密码 | (无) |
| `REDIS_DB` | Redis 数据库 | `0` |
