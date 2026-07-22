# 认证与授权详细规格 (Phase 1)

> **日期**: 2026-07-02
> **状态**: 已验证
> **能力域**: 2. 认证与授权
> **目标成熟度**: L2 → L3
> **关键交付**: JWT 认证、SSO/LDAP、RBAC/ABAC、Token 管理

## 一、功能描述

### 1.1 现状评估 (L2)

Orion 当前已实现：
- JWT 认证（access_token + refresh_token 双 Token 机制）
- OAuth 2.0 授权码流程（GitLab/GitHub 登录）
- RBAC 角色权限模型（Role → Permission → Resource）
- ABAC 属性策略引擎（基于用户/资源/环境属性的动态策略）
- 多租户隔离（tenant_id 上下文传递）
- Token 黑名单（Redis 缓存，支持登出/失效）
- 密码哈希（bcrypt，双实现待统一）

**不足**：
- LDAP 认证完全不可用（框架存在但未对接真实 LDAP 服务器）
- JWT 密钥轮换未生效（定时器逻辑存在但未正确触发）
- 登录流程无租户上下文（首次登录无法确定租户）
- refresh_tokens 表缺少 tenant_id 字段
- 密码哈希双实现（bcrypt 与自定义实现）混乱
- 缺少 MFA/2FA 支持
- 缺少登录失败锁定机制

### 1.2 Phase 1 目标 (L3)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| JWT 认证修复 | 密钥轮换定时器修复、refresh_tokens 表补全 tenant_id | L3 |
| LDAP 集成 | 对接真实 LDAP 服务器，用户同步/认证 | L3 |
| 登录流程优化 | 添加租户上下文提取，支持多租户登录 | L3 |
| 密码哈希统一 | 统一为 bcrypt 实现，删除自定义实现 | L3 |
| 安全增强 | 登录失败锁定、密码策略强制、MFA 基础框架 | L3 |

## 二、验收标准

### 2.1 JWT 认证

| # | 标准 | 验证方式 |
|---|------|----------|
| J1 | access_token 过期后自动通过 refresh_token 刷新 | 集成测试 |
| J2 | JWT 密钥轮换定时器每 24 小时自动生成新密钥 | 集成测试 |
| J3 | 旧密钥在轮换后 1 小时内仍可验证（平滑过渡期） | 单元测试 |
| J4 | refresh_tokens 表包含 tenant_id 字段 | 单元测试 |
| J5 | refresh_token 绑定 tenant_id，跨租户刷新被拒绝 | API 测试 |
| J6 | Token 黑名单即时生效（登出后 Token 立即失效） | API 测试 |

### 2.2 LDAP 集成

| # | 标准 | 验证方式 |
|---|------|----------|
| L1 | 支持 LDAP 用户认证（用户名/密码验证） | 集成测试 |
| L2 | LDAP 用户自动同步到 Orion 用户表 | 集成测试 |
| L3 | LDAP 同步支持定时（每 30 分钟）和手动触发 | API 测试 |
| L4 | LDAP 不可用时自动降级为本地认证 | 集成测试 |
| L5 | 支持多 LDAP 服务器配置（主/备） | API 测试 |

### 2.3 登录流程

| # | 标准 | 验证方式 |
|---|------|----------|
| S1 | 登录请求携带 tenant_id（URL 参数或 Header） | 前端 + API 测试 |
| S2 | 登录成功后返回用户所属租户列表 | API 测试 |
| S3 | 切换租户时重新生成绑定当前租户的 Token | API 测试 |
| S4 | 登录失败 5 次后账号锁定 30 分钟 | 集成测试 |
| S5 | 密码策略：最少 8 位，含大小写字母+数字+特殊字符 | 单元测试 |

### 2.4 密码哈希统一

| # | 标准 | 验证方式 |
|---|------|----------|
| H1 | 密码存储统一使用 bcrypt（cost factor = 12） | 单元测试 |
| H2 | 删除自定义密码哈希实现 | 单元测试 |
| H3 | 现有用户密码在下次登录时自动迁移到 bcrypt | 集成测试 |
| H4 | 密码重置流程使用 bcrypt 重新哈希 | API 测试 |

### 2.5 MFA 基础框架

| # | 标准 | 验证方式 |
|---|------|----------|
| M1 | 支持 TOTP（Time-based One-Time Password） | 集成测试 |
| M2 | 用户可在个人设置中启用/禁用 MFA | 前端验证 |
| M3 | MFA 启用后登录需要输入 6 位验证码 | 前端 + API 测试 |
| M4 | 提供恢复码（10 个一次性恢复码） | API 测试 |

## 三、API 设计

### 3.1 认证端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/auth/login` | 用户登录（支持 password/ldap/oauth） |
| POST | `/api/v1/auth/refresh` | 刷新 access_token |
| POST | `/api/v1/auth/logout` | 登出（使 Token 失效） |
| POST | `/api/v1/auth/mfa/verify` | MFA 验证码验证 |
| GET | `/api/v1/auth/mfa/recovery-codes` | 获取恢复码 |

### 3.2 LDAP 管理端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/auth/ldap/config` | 获取 LDAP 配置 |
| PUT | `/api/v1/auth/ldap/config` | 更新 LDAP 配置 |
| POST | `/api/v1/auth/ldap/sync` | 手动触发 LDAP 同步 |
| GET | `/api/v1/auth/ldap/sync-status` | 查询同步状态 |

## 四、数据模型

### 4.1 refresh_tokens 表

```sql
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),  -- 新增字段
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  revoked_at TIMESTAMP
);
```

### 4.2 login_attempts 表

```sql
CREATE TABLE login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  attempted_at TIMESTAMP DEFAULT NOW(),
  success BOOLEAN NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT
);
```

## 五、依赖关系

| 依赖 | 类型 | 说明 |
|------|------|------|
| TenantService | 内部 | 租户上下文提取 |
| UserService | 内部 | 用户 CRUD |
| Redis | 基础设施 | Token 黑名单缓存 |
| PostgreSQL | 基础设施 | 用户/Token 持久化 |

---

_文档版本: v1.0 | 创建日期: 2026-07-02 | 状态: 已验证_