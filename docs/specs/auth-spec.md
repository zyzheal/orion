# Spec: 认证 (Auth)

> **日期**: 2026-07-03
> **状态**: 编写中
> **能力域**: 认证授权
> **目标成熟度**: L2 → L3
> **关键交付**: 多协议认证、MFA、SSO、会话管理、权限管理

## 一、功能描述

### 1.1 现状评估 (L2)

Orion 当前已实现（Go 微服务 `orion-auth-svc-go`）：
- 用户认证（AuthService + AuthRepository）
- 用户 CRUD（CreateUser/GetUser/UpdateUser）
- 登录尝试记录（RecordLoginAttempt）
- 权限查询（GetPermissions）
- 审计日志集成（Audit）
- OpenTelemetry 追踪

**不足**：
- 无 JWT Token 管理（access/refresh）
- 无密码哈希/验证（PasswordService）
- 无 MFA/2FA（TOTP）
- 无 SSO/LDAP/OAuth2
- 无 Token 黑名单
- 无登录失败锁定
- 无密码重置流程
- 无 API Key 管理
- 无 RBAC 角色管理

### 1.2 Phase 1 目标 (L3)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| JWT 管理 | access/refresh token、自动刷新、密钥轮换 | L3 |
| 密码安全 | 哈希（bcrypt）、密码策略、重置流程 | L3 |
| MFA | TOTP/短信/邮件多因素认证 | L3 |
| SSO | SAML/OIDC/OAuth2 集成 | L3 |
| 登录安全 | 失败锁定、异常检测、审计 | L3 |
| API Key | 服务间调用 API Key 管理 | L2.5 |
| RBAC | 角色+权限+资源范围 | L3 |

## 二、验收标准

### 2.1 JWT 管理

| # | 标准 | 验证方式 |
|---|------|----------|
| AT1 | 登录成功后返回 access_token（15min）和 refresh_token（7d） | API 测试 |
| AT2 | access_token 含 tenant_id + roles + permissions | API 测试 |
| AT3 | refresh_token 可无感刷新 access_token | 集成测试 |
| AT4 | refresh_token 轮换：每次刷新返回新 refresh_token | API 测试 |
| AT5 | JWT 密钥轮换：支持多密钥同时有效（平滑过渡） | 集成测试 |
| AT6 | Token 黑名单即时生效（logout 后 token 不可用） | API 测试 |
| AT7 | 过期 token 返回 401，含过期时间 | API 测试 |

### 2.2 密码安全

| # | 标准 | 验证方式 |
|---|------|----------|
| PS1 | 密码使用 bcrypt 哈希存储（cost ≥ 10） | 单元测试 |
| PS2 | 密码策略：最少 8 位、含大小写+数字+特殊字符 | API 测试 |
| PS3 | 密码重置：通过邮箱/手机验证后重置 | 集成测试 |
| PS4 | 重置 token 有效期 1 小时 | API 测试 |
| PS5 | 密码修改需验证旧密码 | API 测试 |
| PS6 | 密码历史：禁止使用最近 5 次密码 | 单元测试 |

### 2.3 MFA

| # | 标准 | 验证方式 |
|---|------|----------|
| MF1 | 支持 TOTP（Google Authenticator） | 集成测试 |
| MF2 | 支持短信验证码（6位，5分钟有效期） | API 测试 |
| MF3 | 支持邮箱验证码 | API 测试 |
| MF4 | MFA 注册：绑定 TOTP 需验证一次 | API 测试 |
| MF5 | MFA 备份码：生成 10 个一次性备份码 | API 测试 |
| MF6 | MFA 恢复：通过备份码可重置 MFA | API 测试 |
| MF7 | 信任设备：7 天内免 MFA（可选） | API 测试 |

### 2.4 SSO

| # | 标准 | 验证方式 |
|---|------|----------|
| SS1 | 支持 SAML 2.0 SSO | 集成测试 |
| SS2 | 支持 OIDC（Google/GitLab/Okta） | 集成测试 |
| SS3 | 支持 OAuth2 授权码模式 | API 测试 |
| SS4 | SSO 登录自动创建/关联本地用户 | 集成测试 |
| SS5 | SSO 属性映射（email/name/role） | API 测试 |
| SS6 | 支持多 IdP 配置 | API 测试 |

### 2.5 登录安全

| # | 标准 | 验证方式 |
|---|------|----------|
| LS1 | 连续 5 次登录失败锁定账号 30 分钟 | 集成测试 |
| LS2 | 异地登录检测：新 IP 需要二次验证 | API 测试 |
| LS3 | 并发会话限制：同一账号最多 5 个活跃会话 | API 测试 |
| LS4 | 全局 logout：终止所有活跃会话 | API 测试 |
| LS5 | 登录成功/失败记录审计日志 | 单元测试 |
| LS6 | 密码过期提醒（90天） | API 测试 |

### 2.6 API Key 与 RBAC

| # | 标准 | 验证方式 |
|---|------|----------|
| AK1 | 支持创建 API Key（绑定服务/租户/过期时间） | API 测试 |
| AK2 | API Key 可限制 IP 白名单 | API 测试 |
| AK3 | API Key 可限制权限范围 | API 测试 |
| AK4 | API Key 支持轮换（旧 key 保留宽限期） | API 测试 |
| RB1 | 支持创建角色（name + permissions 列表） | API 测试 |
| RB2 | 支持给用户分配角色 | API 测试 |
| RB3 | 权限继承：子角色继承父角色权限 | API 测试 |
| RB4 | 细粒度权限：resource + action + scope | API 测试 |

## 三、API 设计

```
Base: /api/v1/auth
```

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/login` | 用户名密码登录 |
| POST | `/logout` | 登出（加入黑名单） |
| POST | `/refresh` | 刷新 access_token |
| POST | `/register` | 用户注册 |
| GET | `/users/:id` | 获取用户信息 |
| PUT | `/users/:id` | 更新用户 |
| POST | `/users/:id/password` | 修改密码 |
| POST | `/forgot-password` | 请求密码重置 |
| POST | `/reset-password` | 执行密码重置 |
| POST | `/mfa/setup` | 设置 MFA |
| POST | `/mfa/verify` | 验证 MFA |
| DELETE | `/mfa` | 解除 MFA |
| POST | `/sso/:provider/login` | SSO 登录 |
| GET | `/sso/:provider/callback` | SSO 回调 |
| GET | `/api-keys` | API Key 列表 |
| POST | `/api-keys` | 创建 API Key |
| PUT | `/api-keys/:id` | 更新 API Key |
| DELETE | `/api-keys/:id` | 删除 API Key |
| GET | `/roles` | 角色列表 |
| POST | `/roles` | 创建角色 |
| PUT | `/roles/:id` | 更新角色 |
| POST | `/users/:id/roles` | 分配角色 |
| GET | `/permissions` | 权限列表 |

## 四、数据模型

```sql
-- 用户
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  username        VARCHAR(100) NOT NULL,
  email           VARCHAR(200),
  phone           VARCHAR(20),
  password_hash   VARCHAR(255),
  display_name    VARCHAR(200),
  avatar_url      TEXT,
  status          VARCHAR(20) DEFAULT 'active',
  mfa_enabled     BOOLEAN DEFAULT false,
  mfa_secret      VARCHAR(255),
  mfa_backup_codes JSONB DEFAULT '[]',
  last_login_at   TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ DEFAULT now(),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, username)
);

-- 登录尝试
CREATE TABLE IF NOT EXISTS login_attempts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  username        VARCHAR(100),
  ip_address      VARCHAR(45),
  success         BOOLEAN DEFAULT false,
  failure_reason  VARCHAR(100),
  user_agent      TEXT,
  locked_until    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 会话（用于并发控制 + 全局 logout）
CREATE TABLE IF NOT EXISTS user_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_jti       VARCHAR(64) NOT NULL UNIQUE,
  ip_address      VARCHAR(45),
  user_agent      TEXT,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- API Key
CREATE TABLE IF NOT EXISTS api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  name            VARCHAR(200) NOT NULL,
  key_hash        VARCHAR(64) NOT NULL,
  key_prefix      VARCHAR(20) NOT NULL,
  permissions     JSONB DEFAULT '[]',
  ip_whitelist    TEXT[] DEFAULT '{}',
  expires_at      TIMESTAMPTZ,
  last_used_at    TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 角色
CREATE TABLE IF NOT EXISTS roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  permissions     JSONB DEFAULT '[]',
  parent_role_id  UUID REFERENCES roles(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, name)
);

-- 用户角色关联
CREATE TABLE IF NOT EXISTS user_roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id         UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  granted_by      UUID REFERENCES users(id),
  granted_at      TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ,
  UNIQUE(user_id, role_id)
);

CREATE INDEX idx_users_tenant ON users(tenant_id, username);
CREATE INDEX idx_login_attempts_tenant ON login_attempts(tenant_id, created_at DESC);
CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_jti ON user_sessions(token_jti);
```

## 五、前端设计

**路由**: `/auth`

主要页面：
- 登录页：用户名/密码 + MFA
- 用户管理页：用户列表、创建/编辑/禁用
- 角色管理页：角色列表、权限配置
- MFA 设置页：TOTP 绑定、备份码
- API Key 管理页：创建/轮换/删除
- SSO 配置页：IdP 配置、属性映射

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 25 | JwtService、PasswordService、MfaService、SessionManager |
| 集成测试 | 8 | 登录→MFA→JWT刷新→SSO→登出闭环 |
| 前端测试 | 4 | 登录页、MFA、用户管理、角色管理 |

---
_文档版本: v1.0 | 创建日期: 2026-07-03 | 状态: 编写中_
