# Orion API 设计规范

本文档定义了 Orion 平台 API 的统一设计规范，所有 API 接口都应遵循这些约定。

## 1. RESTful API 规范

### 1.1 资源命名规范

- **使用复数名词**：资源名称使用复数形式，如 `/api/v1/users`、`/api/v1/projects`
- **使用小写字母**：所有字母小写，如 `/api/v1/user-settings`
- **使用连字符分隔**：多单词资源使用连字符 `-` 分隔，如 `/api/v1/user-profiles`
- **避免动词**：URL 中不使用动词，动词由 HTTP 方法表达

### 1.2 HTTP 方法语义

| 方法     | 描述                     | 幂等性 | 示例                           |
|----------|--------------------------|--------|--------------------------------|
| GET      | 获取资源（单个或列表）   | 是     | `GET /api/v1/users`            |
| POST     | 创建新资源               | 否     | `POST /api/v1/users`           |
| PUT      | 全量更新资源             | 是     | `PUT /api/v1/users/{id}`       |
| PATCH    | 部分更新资源             | 是     | `PATCH /api/v1/users/{id}`     |
| DELETE   | 删除资源                 | 是     | `DELETE /api/v1/users/{id}`    |

### 1.3 请求格式标准

#### 请求头（Headers）

```http
Content-Type: application/json
Authorization: Bearer <token>
X-Request-ID: <uuid>
X-API-Version: v1
```

#### 请求体（Request Body）

创建资源示例：
```json
{
  "name": "项目名称",
  "description": "项目描述",
  "metadata": {
    "owner": "user@example.com"
  }
}
```

### 1.4 响应格式标准

#### 成功响应（单资源）

```json
{
  "data": {
    "id": "123",
    "type": "user",
    "attributes": {
      "name": "John Doe",
      "email": "john@example.com"
    },
    "metadata": {
      "createdAt": "2026-04-11T10:00:00Z",
      "updatedAt": "2026-04-11T10:00:00Z"
    }
  },
  "meta": {
    "requestId": "req-123",
    "timestamp": "2026-04-11T10:00:00Z"
  }
}
```

#### 成功响应（资源列表）

```json
{
  "data": [...],
  "pagination": {
    "type": "offset",
    "total": 100,
    "limit": 20,
    "offset": 0
  },
  "meta": {
    "requestId": "req-123",
    "timestamp": "2026-04-11T10:00:00Z"
  }
}
```

#### 错误响应

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid input data",
  "code": "30001",
  "details": {
    "field": "email",
    "reason": "Invalid email format"
  },
  "requestId": "req-123",
  "timestamp": "2026-04-11T10:00:00Z"
}
```

---

## 2. 分页策略

Orion API 支持两种分页方式：**Offset 分页** 和 **Cursor 分页**。

### 2.1 Offset 分页

适用于传统列表场景，数据量适中且对实时性要求不高的场景。

#### 请求参数

| 参数     | 类型   | 必填 | 默认值 | 描述           |
|----------|--------|------|--------|----------------|
| `limit`  | number | 否   | 20     | 每页数量 (1-100) |
| `offset` | number | 否   | 0      | 偏移量         |
| `sort`   | string | 否   | -createdAt | 排序字段     |
| `order`  | string | 否   | desc   | 排序方向 (asc/desc) |

#### 请求示例

```
GET /api/v1/users?limit=20&offset=0&sort=createdAt&order=desc
```

#### 响应格式

```json
{
  "data": [...],
  "pagination": {
    "type": "offset",
    "total": 150,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  },
  "meta": {
    "requestId": "req-123",
    "timestamp": "2026-04-11T10:00:00Z"
  }
}
```

### 2.2 Cursor 分页

适用于大数据量、实时数据流或需要高性能分页的场景。

#### 请求参数

| 参数       | 类型   | 必填 | 默认值 | 描述                 |
|------------|--------|------|--------|----------------------|
| `limit`    | number | 否   | 20     | 每页数量 (1-100)     |
| `cursor`   | string | 否   | -      | 游标（base64 编码）  |
| `direction`| string | 否   | next   | 方向 (next/previous) |

#### 请求示例

```
GET /api/v1/events?limit=20&cursor=eyJpZCI6MTAwfQ==&direction=next
```

#### 响应格式

```json
{
  "data": [...],
  "pagination": {
    "type": "cursor",
    "limit": 20,
    "cursor": {
      "current": "eyJpZCI6MTAwfQ==",
      "next": "eyJpZCI6MTIwfQ==",
      "previous": "eyJpZCI6ODB9"
    },
    "hasMore": true
  },
  "meta": {
    "requestId": "req-123",
    "timestamp": "2026-04-11T10:00:00Z"
  }
}
```

### 2.3 分页方式选择指南

| 场景                   | 推荐分页方式 | 原因                     |
|------------------------|--------------|--------------------------|
| 用户列表、项目列表     | Offset       | 简单直观，支持跳页       |
| 日志、事件流、消息列表 | Cursor       | 高性能，数据一致性       |
| 实时数据               | Cursor       | 避免数据重复/遗漏        |
| 大数据量表             | Cursor       | 避免深度分页性能问题     |

---

## 3. 错误码二级分类（XYYZZ 格式）

### 3.1 错误码结构

错误码采用 5 位数字格式：`XYYZZ`

```
┌─┬──┬──┐
│X │YY│ZZ│
└─┴──┴──┘
 │ │ └─ 具体错误编号 (01-99)
 │ └─── 模块编号 (01-99)
 └───── 系统分类
```

### 3.2 系统分类（X）

| 代码 | 分类     | 描述                         |
|------|----------|------------------------------|
| 1    | 平台     | 平台级错误（框架、中间件等） |
| 2    | 认证     | 认证授权相关错误             |
| 3    | 业务     | 业务逻辑错误                 |
| 4    | 外部     | 外部服务调用错误             |

### 3.3 模块编号（YY）

#### 平台错误（1XXZZ）

| 模块  | 描述     |
|-------|----------|
| 01    | 网关     |
| 02    | 路由     |
| 03    | 配置     |
| 04    | 日志     |
| 05    | 监控     |

#### 认证错误（2XXZZ）

| 模块  | 描述     |
|-------|----------|
| 01    | JWT      |
| 02    | OAuth    |
| 03    | API Key  |
| 04    | 会话     |
| 05    | 权限     |

#### 业务错误（3XXZZ）

| 模块  | 描述     |
|-------|----------|
| 01    | 参数验证 |
| 02    | 资源操作 |
| 03    | 状态机   |
| 04    | 数据一致性 |
| 05    | 配额限制 |

#### 外部服务错误（4XXZZ）

| 模块  | 描述     |
|-------|----------|
| 01    | HTTP 调用 |
| 02    | 数据库   |
| 03    | 缓存     |
| 04    | 消息队列 |
| 05    | 第三方 API |

### 3.4 常用错误码列表

#### 平台错误（1XXZZ）

| 错误码 | 名称                  | HTTP 状态码 | 描述         |
|--------|-----------------------|-------------|--------------|
| 10101  | GATEWAY_UNAVAILABLE   | 503         | 网关不可用   |
| 10102  | ROUTE_NOT_FOUND       | 404         | 路由未找到   |
| 10103  | METHOD_NOT_ALLOWED    | 405         | 方法不允许   |
| 10201  | RATE_LIMIT_EXCEEDED   | 429         | 请求频率超限 |
| 10301  | CONFIG_INVALID        | 500         | 配置无效     |

#### 认证错误（2XXZZ）

| 错误码 | 名称                  | HTTP 状态码 | 描述         |
|--------|-----------------------|-------------|--------------|
| 20101  | TOKEN_EXPIRED         | 401         | Token 过期    |
| 20102  | TOKEN_INVALID         | 401         | Token 无效    |
| 20103  | TOKEN_MISSING         | 401         | Token 缺失    |
| 20201  | OAUTH_CALLBACK_ERROR  | 400         | OAuth 回调错误 |
| 20301  | API_KEY_INVALID       | 401         | API Key 无效  |
| 20501  | PERMISSION_DENIED     | 403         | 权限不足     |

#### 业务错误（3XXZZ）

| 错误码 | 名称                  | HTTP 状态码 | 描述         |
|--------|-----------------------|-------------|--------------|
| 30101  | VALIDATION_ERROR      | 400         | 参数验证失败 |
| 30102  | REQUIRED_FIELD_MISSING| 400         | 必填字段缺失 |
| 30201  | RESOURCE_NOT_FOUND    | 404         | 资源不存在   |
| 30202  | RESOURCE_EXISTS       | 409         | 资源已存在   |
| 30203  | RESOURCE_DELETED      | 410         | 资源已删除   |
| 30301  | INVALID_STATE         | 400         | 无效状态     |
| 30302  | STATE_TRANSITION_FORBIDDEN | 400    | 状态转移禁止 |
| 30401  | DATA_INCONSISTENT     | 500         | 数据不一致   |
| 30501  | QUOTA_EXCEEDED        | 429         | 配额超限     |

#### 外部服务错误（4XXZZ）

| 错误码 | 名称                  | HTTP 状态码 | 描述         |
|--------|-----------------------|-------------|--------------|
| 40101  | HTTP_REQUEST_FAILED   | 502         | HTTP 请求失败 |
| 40102  | HTTP_TIMEOUT          | 504         | HTTP 超时     |
| 40201  | DATABASE_ERROR        | 500         | 数据库错误   |
| 40202  | DATABASE_CONNECTION_LOST | 503      | 数据库连接丢失 |
| 40301  | CACHE_ERROR           | 500         | 缓存错误     |
| 40302  | CACHE_MISS            | 404         | 缓存未命中   |
| 40401  | MQ_PUBLISH_FAILED     | 500         | 消息发布失败 |
| 40501  | THIRD_PARTY_ERROR     | 502         | 第三方服务错误 |

---

## 4. API 版本管理

### 4.1 版本控制策略

Orion API 使用 **URL 路径版本控制**，版本作为 URL 路径的一部分。

### 4.2 版本格式

```
/api/v{version}/{resource}
```

示例：
- `/api/v1/users`
- `/api/v2/users`

### 4.3 版本生命周期

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   beta      │ -> │   stable    │ -> │  deprecated │ -> │  withdrawn  │
│  测试阶段   │    │  稳定阶段   │    │  弃用阶段   │    │  移除阶段   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### 4.4 版本响应头

所有 API 响应都应包含以下版本相关头部：

```http
X-API-Version: v1
X-API-Deprecated: false
X-API-Sunset: (仅在弃用阶段提供，格式为 RFC 7231 日期)
Link: </api/v2/users>; rel="successor-version"
```

### 4.5 版本弃用通知

当请求已弃用的 API 版本时，响应中应包含警告信息：

```json
{
  "data": [...],
  "warnings": [
    {
      "code": "API_DEPRECATED",
      "message": "This API version (v1) is deprecated and will be removed on 2026-12-31. Please migrate to /api/v2/users",
      "link": "/docs/migration/v1-to-v2"
    }
  ],
  "pagination": {...},
  "meta": {...}
}
```

### 4.6 版本兼容性保证

| 版本类型 | 兼容性保证           | 变更策略             |
|----------|----------------------|----------------------|
| PATCH    | 完全向后兼容         | Bug 修复、性能优化   |
| MINOR    | 向后兼容             | 新功能、可选参数     |
| MAJOR    | 不兼容               | 需要新版本号         |

### 4.7 当前支持版本

| 版本 | 状态     | 发布日期   | 弃用日期   | 移除日期   |
|------|----------|------------|------------|------------|
| v1   | stable   | 2026-04-11 | -          | -          |
| v2   | planning | -          | -          | -          |

---

## 5. 附录

### 5.1 参考资料

- [RFC 7231 - HTTP/1.1 Semantics and Content](https://tools.ietf.org/html/rfc7231)
- [RFC 7807 - Problem Details for HTTP APIs](https://tools.ietf.org/html/rfc7807)
- [JSON:API Specification](https://jsonapi.org/format/)
- [OpenAPI Specification](https://swagger.io/specification/)

### 5.2 工具与库

- **分页工具**: `src/utils/pagination.ts`
- **错误处理**: `src/errors/base-error.ts`, `src/errors/error-codes.ts`
- **版本管理**: `src/routes/version.ts`
