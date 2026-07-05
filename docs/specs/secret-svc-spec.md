# Spec: Secret 服务 (secret)

## 1. 模块概述

### 功能描述
Secret 服务提供密钥/凭证的安全存储和访问管理。支持 Secret 的 CRUD、版本控制、自动轮换和细粒度访问控制。

### 架构
- **框架**：Gin HTTP
- **分层**：handler → service → repository → models
- **认证**：`RequirePermission("secret", action)`
- **多租户**：所有查询带 `tenant_id` 过滤
- **存储**：PostgreSQL (Secret 值加密存储)

### 与 TypeScript 实现的差异
- TS 实现：`orion-platform-service/src/services/` 下的相关加密模块
- Go 实现：独立微服务，专注于 Secret 生命周期管理和轮换

## 2. API 端点

**Base 路径**：`/api/v1/secret`

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| GET | /secrets | 查询 Secret 列表（脱敏） | secret:read |
| POST | /secrets | 创建 Secret | secret:write |
| GET | /secrets/:id | 获取 Secret 详情（脱敏） | secret:read |
| PUT | /secrets/:id | 更新 Secret | secret:write |
| DELETE | /secrets/:id | 删除 Secret | secret:delete |
| POST | /secrets/:id/rotate | 轮换 Secret | secret:write |
| GET | /secrets/:id/versions | 查询历史版本 | secret:read |
| POST | /secrets/:id/access | 记录访问日志 | secret:read |

## 3. 数据模型

### Secret
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| tenant_id | VARCHAR | 租户 ID |
| name | VARCHAR | Secret 名称 |
| type | VARCHAR | 类型 (api_key/password/certificate/ssh_key) |
| scope | VARCHAR | 作用域 |
| encrypted_value | TEXT | 加密后的值 |
| version | INT | 版本号 |
| rotation_policy | JSONB | 轮换策略 |
| created_by | VARCHAR | 创建人 |
| expires_at | TIMESTAMP | 过期时间 |
| last_rotated_at | TIMESTAMP | 最后轮换时间 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### SecretScope
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| secret_id | UUID | 关联 Secret |
| environment | VARCHAR | 环境 (dev/staging/prod) |
| allowed_services | JSONB | 允许访问的服务列表 |

### ResolvedResult
| 字段 | 类型 | 说明 |
|------|------|------|
| secret_id | UUID | Secret ID |
| scope | VARCHAR | 作用域 |
| value | TEXT | 解密后的值 |
| expires_at | TIMESTAMP | 过期时间 |

## 4. 验收标准

| 编号 | 标准 | 验证方式 |
|------|------|---------|
| SEC-01 | 创建 Secret 后值加密存储 | 单元测试 |
| SEC-02 | 查询列表时 Secret 值脱敏 | 单元测试 |
| SEC-03 | 轮换后旧版本仍可查询 | 集成测试 |
| SEC-04 | 过期 Secret 不可访问 | 单元测试 |
| SEC-05 | 多租户隔离：不同租户 Secret 互不可见 | 集成测试 |
| SEC-06 | 轮换策略支持自动轮换 | 单元测试 |
| SEC-07 | Secret 值解密需要有效权限 | 集成测试 |
| SEC-08 | 访问日志记录所有读取操作 | 单元测试 |

## 5. 测试策略

| 类型 | 用例数 | 覆盖范围 |
|------|--------|---------|
| 单元测试 | 20+ | handler/service/repository/encryption |
| 集成测试 | 10+ | CRUD + 轮换 + 过期流程 |
| 前端测试 | 5+ | Secret 管理页面 |
