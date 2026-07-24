# 组织/用户/角色/权限模块深度分析报告

**生成日期**: 2026-07-02
**分析模块**: `orion-platform-service/src/services/user/`、`role/`、`permission/`、`tenant/`、`auth/`

---

## 模块概览

Orion 平台的 IAM（身份认证与访问管理）模块采用**多服务分层架构**，核心由 5 个服务模块组成。项目中**不存在独立的 `organization` 服务目录**，组织架构功能通过 Tenant（租户）和 Team（团队）概念实现。

| 模块 | 路径 | 状态 | 持久化 |
|------|------|------|--------|
| **User** | `src/services/user/` | ✅ 完整 | PostgreSQL |
| **Role** | `src/services/role/` | ✅ 完整 | PostgreSQL |
| **Permission** | `src/services/permission/` | ✅ 完整 | PostgreSQL + 内存降级 |
| **Tenant** | `src/services/tenant/` | ✅ 完整 | PostgreSQL |
| **Auth** | `src/services/auth/` | ✅ 完整 | PostgreSQL + Redis |
| **Organization** | `src/services/organization/` | ❌ **不存在** | - |

---

## 架构设计

### 分层架构模式

```
API Layer (routes/controllers)
    ↓
Service Layer (业务逻辑)
    ↓
Repository Layer (数据访问)
    ↓
PostgreSQL Database
```

### 核心数据模型

**Users（用户表）**
- 主键：`id` (UUID)
- 唯一索引：`username`, `email`
- 字段：username, email, password_hash, name, avatar_url, role, status, last_login_at, last_login_ip, settings, created_by
- 软删除：通过 `status` 字段（active/suspended/terminated/deleted）

**Tenants（租户表）**
- 主键：`id`
- 唯一索引：`name`
- 字段：name, display_name, status, settings

**Tenant_Users（租户-用户关联表）**
- 复合主键：`(tenant_id, user_id)`
- 字段：role（用户在租户中的角色）

**Roles（角色表）**
- 主键：`id`
- 字段：tenant_id, name, description

**Permissions（权限表）**
- 主键：`id`
- 唯一约束：`(resource, action)`
- 字段：resource, action, description

**Role_Permissions（角色-权限关联表）**
- 关联：role_id ↔ permission_id

---

## 功能完整性评估

### User 服务（6 个子服务）

| 功能 | 状态 | 说明 |
|------|------|------|
| CRUD | ✅ | createUser, getUser, updateUser, deleteUser（软删除） |
| 查询 | ✅ | listUsers（分页+过滤）, getByUsername, getByEmail, getByTenant |
| 认证 | ✅ | authenticate（密码验证）, changePassword |
| 密码安全 | ✅ | PBKDF2 100000 iterations + SHA256 legacy 兼容 |
| Token 管理 | ✅ | UserTokenService - create/get/delete/validate API tokens |
| 用户档案 | ✅ | UserProfileService - 包含 teams, permissions |
| 活动日志 | ✅ | UserActivityService - 完整操作审计 |
| 状态管理 | ✅ | UserStatusService - 状态变更 + 安全清理 |
| 批量操作 | ✅ | batchDisable（按部门/角色批量禁用） |

### Role 服务

| 功能 | 状态 | 说明 |
|------|------|------|
| CRUD | ✅ | create/list/get/delete/updateRole |
| 继承 | ✅ | ROLE_INHERITANCE 映射（9 层继承链） |
| 权限检查 | ✅ | checkPermissions（支持通配符 + 数据库回退） |
| 种子数据 | ✅ | seedDefaultRoles, seedRolePermissions |
| 权限映射 | ✅ | getPermissionsMap（含继承展开） |

**内置角色体系**：
- 系统级：super_admin, admin, platform_admin, tenant_admin
- 业务级：tech_lead, developer, sre, dba, viewer, auditor
- 项目级：project_admin, project_lead, project_developer, project_viewer

### Permission 服务

| 功能 | 状态 | 说明 |
|------|------|------|
| CRUD | ✅ | list/get/create/update/delete |
| 批量创建 | ✅ | batchCreatePermissions |
| 预置权限 | ✅ | seedCommonPermissions（35 个常用权限） |
| 降级策略 | ⚠️ | PostgreSQL + 内存缓存双写，DB 失败时内存降级 |

### Tenant 服务

| 功能 | 状态 | 说明 |
|------|------|------|
| CRUD | ✅ | create/list/get/update/delete/hardDelete |
| 配额管理 | ✅ | TenantQuotaService |
| 隔离验证 | ✅ | TenantIsolationService（四层验证） |
| RLS | ✅ | RLSPolicyManager（PostgreSQL Row Level Security） |
| 上下文 | ✅ | TenantContext（请求级上下文管理） |
| Namespace | ✅ | NamespacePoolService（K8s 命名空间池） |

---

## API 端点清单

| 端点文件 | 功能模块 |
|----------|----------|
| `tenant-routes.ts` | 租户 CRUD |
| `role-routes.ts` | 角色 CRUD + 权限分配 |
| `user-routes.ts` | 用户 CRUD |
| `user-profile-routes.ts` | 用户档案 |
| `user-activity-routes.ts` | 用户活动日志 |
| `user-token-routes.ts` | API Token 管理 |
| `user-status-routes.ts` | 用户状态变更 |
| `team-routes.ts` | 团队管理 |
| `permission-audit-routes.ts` | 权限审计 |
| `sso-routes.ts` | SSO 登录/回调 |
| `sso-providers-routes.ts` | SSO 提供商管理 |
| `auth-enhanced-routes.ts` | 增强认证 |
| `sla-routes.ts` | SLA 服务 |

---

## 缺失功能

### P0 级（阻塞生产）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| Organization 模块缺失 | 无独立组织管理能力 | 创建 `services/organization/` 模块 |
| LDAP 依赖缺失 | ldapjs 未安装，LDAP 认证不可用 | 安装 `ldapjs` 或移除 LDAP 代码 |
| TenantContext 线程安全 | 单例 tenantContext 存在竞态条件（CWE-362） | 修复单例模式 |

### P1 级（高优先级）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| SQL 注入风险（已标记） | generateSessionSetSQL() 使用字符串插值 | 使用参数化查询 |
| 硬编码默认租户 | defaultTenantId: 0 可能绕过隔离 | 从请求上下文获取 |
| Password 字段名不一致 | UserRepository 使用 password_hash，UserProfileService 映射时未正确处理 | 统一字段访问 |
| 权限检查降级过于宽松 | check() 方法默认返回 { allowed: true } | 默认拒绝策略 |
| active_sessions 表缺失 | 用户状态变更时清理逻辑可能失败 | 确保表存在 |
| 缺少用户-角色关联管理 API | UserService 有 addUserToTenant，但无直接角色分配 | 增加角色分配 API |

### P2 级（改进项）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| UserProfileService.phone 未实现 | 电话字段恒为 undefined | 实现 phone 字段 |
| 缺少密码强度校验 | 仅检查长度 >= 8 | 添加复杂度要求 |
| 缺少登录失败锁定 | 无暴力破解防护 | 实现失败计数器 + 锁定 |
| Token 前缀硬编码 | orion_ 前缀可能冲突 | 使用配置化前缀 |
| 缺少批量导入/导出 | 无用户批量操作 | 增加批量操作 API |
| 审计日志不完整 | UserActivity 仅记录操作，无数据变更审计 | 增加数据变更审计 |

---

## 技术债务

| 类别 | 数量 | 严重程度 |
|------|------|----------|
| 缺失模块 | 1 | P0 |
| 依赖问题 | 1 | P0 |
| 线程安全 | 1 | P0 |
| SQL 注入风险 | 2 | P1 |
| 逻辑缺陷 | 4 | P1-P2 |
| 功能缺失 | 6 | P2 |

---

## 与其他模块集成点

| 模块 | 集成点 | 说明 |
|------|--------|------|
| Pipeline | user_id, tenant_id | 流水线执行者归属 |
| Deployment | user_id, approval | 部署审批链 |
| Approval | approver resolver | 基于角色查找审批人 |
| Notification | user preferences | 通知渠道绑定 |
| Audit | user activities | 操作审计日志 |
| ChatOps | user context | 命令执行上下文 |
| Team | user_teams | 团队-用户多对多 |
| Project | project_members | 项目成员管理 |

---

## 建议优先级

### Phase 1：立即（P0）

1. 创建 `services/organization/` 模块，实现 Org CRUD
2. 安装 `ldapjs` 或移除 LDAP 代码
3. 修复 `TenantContext` 单例竞态问题

### Phase 2：近期（P1）

4. 统一 password_hash 字段访问
5. 增强密码策略（复杂度、历史记录）
6. 实现登录失败锁定机制
7. 完善权限检查默认拒绝策略

### Phase 3：中期（P2）

8. 实现用户-角色直接关联管理
9. 完善审计日志（数据变更审计）
10. 添加用户批量导入/导出

---

## 关键文件索引

| 文件 | 角色 | 重要性 |
|------|------|--------|
| `services/user/UserRepository.ts` | 用户数据访问 | ⭐⭐⭐ |
| `services/user/UserService.ts` | 用户业务逻辑 | ⭐⭐⭐ |
| `services/user/UserStatusService.ts` | 状态安全管理 | ⭐⭐⭐ |
| `services/role/RoleService.ts` | RBAC + 继承 | ⭐⭐⭐ |
| `services/tenant/TenantContext.ts` | 租户上下文 | ⭐⭐⭐ |
| `services/auth/PermissionService.ts` | 服务级权限 | ⭐⭐ |
| `services/tenant/TenantIsolationService.ts` | 四层隔离 | ⭐⭐⭐ |
| `services/permission/PermissionService.ts` | 权限管理 | ⭐⭐⭐ |

---

## 结论

Orion 平台的 IAM 模块整体设计**架构清晰、功能完整**，已完成 Map → PostgreSQL 迁移，具备：
- ✅ 完整的用户生命周期管理
- ✅ 基于角色的访问控制（RBAC + 继承）
- ✅ 多租户隔离（RLS + 四层验证）
- ✅ SSO/LDAP 外部认证支持
- ✅ API Token 管理
- ✅ 审计日志

**主要短板**：
- ❌ 缺少独立 Organization 模块
- ⚠️ LDAP 依赖未就绪
- ⚠️ 部分边缘安全问题需修复
- ⚠️ 高级权限特性（ABAC、策略引擎）未完全实现

建议按 **P0 → P1 → P2** 优先级逐步修复，重点补齐 Organization 模块和依赖完整性。
