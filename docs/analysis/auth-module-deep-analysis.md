# 认证（Auth）模块深度分析报告

**生成日期**: 2026-07-02
**分析模块**: `orion-platform-service/src/services/auth/` 及相关路由

---

## 模块概览

Orion 平台的认证（Auth）模块实现了完整的 IAM 能力，包含 JWT 认证、密钥轮换、Token 黑名单、SSO/LDAP/企业微信集成、权限管理、用户状态管理等。采用 PostgreSQL + Redis 持久化，部分组件保留内存降级。

### 核心文件

| 文件 | 职责 |
|------|------|
| `JwtKeyManager.ts` | 统一 JWT 密钥管理入口 |
| `JwtKeyRotationService.ts` | JWT 密钥自动轮换（90天周期 + 7天重叠） |
| `TokenBlacklistService.ts` | Token 吊销（Redis + PostgreSQL + 内存三级存储） |
| `SsoService.ts` | OIDC SSO 认证（openid-client v6） |
| `LdapService.ts` | LDAP 认证（**未实现**，ldapjs 缺失） |
| `WechatWorkService.ts` | 企业微信 SSO |
| `PermissionService.ts` | 服务级权限管理 |
| `AuthCleanupService.ts` | 认证 hygiene 定时清理 |
| `UserStatusService.ts` | 用户状态管理（启用/禁用/终止） |

### 路由文件

| 路由文件 | 前缀 | 端点数 |
|----------|------|--------|
| `routes-auth.ts` | `/api/v1/auth` | 5 |
| `auth-enhanced-routes.ts` | `/api/v1/auth` | 6 |
| `sso-routes.ts` | `/api/v1/auth/sso` | 4 |
| `sso-unified-routes.ts` | `/api/v1/auth/sso` | 3 |
| `sso-providers-routes.ts` | `/api/v1/auth/sso` | 5 |
| `session-routes.ts` | `/api/v1/sessions` | 5 |
| `user-routes.ts` | `/api/v1/users` | 8 |
| `user-token-routes.ts` | `/api/v1/users/:id/tokens` | 3 |
| `user-status-routes.ts` | `/api/v1` | 4 |
| `role-routes.ts` | `/api/v1/roles` | 5 |
| `permission-audit-routes.ts` | `/api/v1/permission-audit` | 4 |

---

## 架构设计

### JWT 认证流程

```
用户登录 (POST /api/v1/auth/login)
    │
    ├─ 验证用户名密码 (UserService.authenticate)
    │   └─ scrypt 密码哈希验证
    │
    ├─ 检查用户状态 (terminated/deleted/suspended → 拒绝)
    │
    ├─ 获取 JWT 密钥 (JwtKeyManager.getCurrentSecret)
    │   ├─ 优先：K8s Secret 注入
    │   └─ 降级：JWT_SECRET 环境变量
    │
    ├─ 签发 accessToken (5min) + refreshToken (7天)
    │   └─ refreshToken 哈希存入 refresh_tokens 表
    │
    └─ 返回 token 对
```

### JWT 密钥轮换机制

**状态：部分生效，存在设计缺陷**

| 组件 | 实现状态 | 问题 |
|------|---------|------|
| `JwtKeyRotationService` | ✅ 已实现 | 仅存储 keyHash，**不存储原始密钥** |
| `JwtKeyManager.getCurrentSecret()` | ⚠️ 降级实现 | 返回 `fallbackSecret`（环境变量），**未真正使用轮换密钥** |
| `K8sSecretKeyStorage` | ✅ 已实现 | 依赖 K8s 集群，开发环境禁用 |
| 自动轮换定时器 | ✅ 已实现 | 基于 `setTimeout`，进程重启后丢失 |

**关键缺陷**：
- `JwtKeyManager.getCurrentSecret()` 始终返回 `process.env.JWT_SECRET`，轮换服务生成的密钥仅用于标识（keyId），**不用于实际签名**
- 密钥轮换无法真正生效，因为签名密钥没有随轮换更新

### Token 黑名单（3 层存储）

```
TokenBlacklistService
    │
    ├─ Tier 1: Redis (可选，分布式 TTL)
    │   └─ setex(keyPrefix + tokenHash, ttl, '1')
    │
    ├─ Tier 2: PostgreSQL (source-of-truth)
    │   └─ token_blacklist 表
    │       ├─ findByHash() - 读穿透
    │       ├─ revokeAllUserTokens()
    │       └─ revokeAllTenantTokens()
    │
    └─ Tier 3: 内存 Map (本地降级)
        └─ Map<tokenHash, BlacklistedTokenEntity>
```

**特点**：
- DB 故障时自动降级到内存（`dbDown` 标志位）
- 每 30 分钟清理过期条目
- 支持用户级/租户级批量吊销

---

## 功能完整性评估

| 功能 | 状态 | 说明 |
|------|------|------|
| 用户名密码登录 | ✅ | scrypt 哈希，状态检查 |
| JWT 签发/验证 | ✅ | 5min 过期，HS256 |
| Refresh Token | ✅ | 7 天过期，轮换机制 |
| 登出 + Token 吊销 | ✅ | 黑名单 + 事件广播 |
| 用户注册 | ✅ | 密码强度检查 |
| 修改密码 | ✅ | 需旧密码验证 |
| 密钥轮换 | ⚠️ | 框架完成但**实际不生效** |
| Token 黑名单 | ✅ | 3 层存储 |
| 用户状态管理 | ✅ | 4 种状态，自动清理 |
| 批量禁用用户 | ✅ | 按部门/角色 |
| 权限审计日志 | ✅ | 拒绝记录 + 统计 |
| RBAC 角色管理 | ✅ | PostgreSQL 持久化 |
| ABAC 策略引擎 | ✅ | 6 条系统策略 |
| 多租户隔离 | ⚠️ | 查询有隔离，登录无租户上下文 |
| SSO (OIDC) | ✅ | openid-client v6，生产可用 |
| SSO (企业微信) | ✅ | 完整 OAuth 流程 |
| SSO (LDAP) | ❌ | **不可用**（ldapjs 未安装） |
| MFA/2FA | ❌ | 无实现 |
| 密码重置 | ❌ | 无 forgot-password/reset-password 路由 |
| 登录失败锁定 | ❌ | 无失败计数器、无锁定机制 |
| API Token 管理 | ✅ | 用户级 token CRUD |

---

## 缺失功能

### P0 级（阻塞生产）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| `JwtKeyManager.getCurrentSecret()` 未使用轮换密钥 | 密钥轮换形同虚设 | 实现密钥版本查找逻辑，根据 keyId 选择对应密钥 |
| LDAP 服务完全不可用 | 企业 LDAP 集成失败 | 安装 `ldapjs` 或迁移到 `ldap-auth` 库 |
| 登录流程无租户上下文 | 多租户 token 隔离缺失 | 登录时获取用户租户并存入 JWT payload |
| `refresh_tokens` 表无 `tenant_id` | 无法按租户吊销 refresh token | 加列 + 批量吊销逻辑 |

### P1 级（高优先级）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 密码哈希双实现混乱 | 维护困难，安全风险 | 统一为 PBKDF2 或迁移到 bcrypt/argon2 |
| 内存 Map 降级数据丢失 | 多实例部署时 token 吊销不一致 | TokenBlacklist 强制 PostgreSQL，移除内存降级 |
| ABAC 策略无自动热更新 | 策略变更需重启 | 添加 PostgreSQL NOTIFY 监听或轮询 |
| 密钥轮换定时器进程重启丢失 | 轮换可能延迟 | 改用 node-cron 或持久化下次轮换时间 |

### P2 级（改进项）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 企业微信 token 缓存无分布式锁 | 多实例并发刷新 | 添加 Redis 分布式锁 |
| Session 表无 `tenant_id` 强制 | 跨租户会话查询 | 添加 `tenant_id` 非空约束 |
| 密码无复杂度策略 | 弱密码风险 | 添加正则校验（大小写+数字+特殊字符） |
| 无登录日志/审计 | 安全事件追溯困难 | 记录 IP、UA、地理位置 |

---

## 技术债务

| 问题 | 影响 | 建议 |
|------|------|------|
| 密钥轮换名存实亡 | 安全风险 | 修复或移除轮换框架 |
| 授权引擎与路由权限双轨并行 | 可能重复检查 | 统一为单一权限检查入口 |
| Session 与 JWT 双轨认证 | 增加复杂度 | 评估是否保留 Session |
| 密码哈希双轨（scrypt + PBKDF2） | 维护困难 | 统一实现 |
| 硬编码 tenantId=0 | 无意义 | 从上下文获取 |
| 内存降级过度使用 | 多实例数据不一致 | 强制 PostgreSQL |
| 错误处理不统一 | 调试困难 | 全链路 OrionError + 错误码 |

---

## 与其他模块集成点

| 模块 | 集成方式 | 状态 |
|------|----------|------|
| Pipeline | user_id, tenant_id | ✅ 流水线执行者归属 |
| Deployment | user_id, approval | ✅ 部署审批链 |
| Approval | approver resolver | ✅ 基于角色查找审批人 |
| Notification | user preferences | ✅ 通知渠道绑定 |
| Audit | user activities | ✅ 操作审计日志 |
| EventBus | 登出事件广播 | ✅ auth:user:logout |
| Tenant | TenantMiddleware | ✅ 租户上下文注入 |
| Redis Cache | Token 黑名单分布式缓存 | ✅ 三层存储 |

---

## 建议优先级

### Phase 1：立即修复（P0）

1. 修复 JWT 密钥轮换实际生效
2. 安装 ldapjs 或替换 LDAP 实现
3. 登录流程注入租户上下文
4. refresh_tokens 表加 `tenant_id`

### Phase 2：近期修复（P1）

5. 统一密码哈希实现
6. 强制 TokenBlacklist 使用 PostgreSQL
7. ABAC 策略热更新机制
8. 密钥轮换定时器持久化

### Phase 3：中期改进（P2）

9. 实现 MFA/2FA
10. 实现密码重置流程
11. 登录失败锁定
12. 统一错误处理

---

## 关键文件索引

| 文件 | 角色 | 重要性 |
|------|------|--------|
| `services/auth/JwtKeyManager.ts` | JWT 密钥管理 | ⭐⭐⭐ |
| `services/auth/JwtKeyRotationService.ts` | 密钥轮换 | ⭐⭐⭐ |
| `services/auth/TokenBlacklistService.ts` | Token 黑名单 | ⭐⭐⭐ |
| `services/auth/SsoService.ts` | SSO 认证 | ⭐⭐⭐ |
| `services/auth/LdapService.ts` | LDAP 认证 | ⭐⭐ |
| `services/auth/UserStatusService.ts` | 用户状态管理 | ⭐⭐⭐ |
| `api/routes-auth.ts` | 认证路由 | ⭐⭐⭐ |
| `middleware/authMiddleware.ts` | JWT 验证中间件 | ⭐⭐⭐ |
| `services/authz/AuthorizationEngine.ts` | 授权引擎 | ⭐⭐⭐ |

---

## 结论

Orion 平台的 Auth 模块**整体架构清晰、功能完整**，已完成 Map → PostgreSQL 迁移，具备：
- ✅ 完整的 JWT 认证流程（access + refresh token）
- ✅ 三级 Token 黑名单（Redis + PostgreSQL + 内存）
- ✅ SSO 集成（OIDC + 企业微信）
- ✅ RBAC + ABAC 双层授权
- ✅ 多租户隔离（查询层）
- ✅ 完善的 API 端点（50+）

**主要短板**：
- ❌ LDAP 认证完全不可用（依赖缺失）
- ⚠️ JWT 密钥轮换名存实亡（签名密钥未更新）
- ⚠️ 登录流程无租户上下文（token 隔离不完整）
- ❌ MFA/2FA、密码重置、登录失败锁定缺失

建议按 **P0 → P1 → P2** 优先级逐步修复。
