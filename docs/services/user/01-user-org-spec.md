# 用户与组织管理详细规格 (Phase 1)

> **日期**: 2026-07-02
> **状态**: 已验证
> **能力域**: 4. 用户与组织
> **目标成熟度**: L2 → L3
> **关键交付**: 用户管理、组织架构、角色权限、租户管理

## 一、功能描述

### 1.1 现状评估 (L2)

Orion 当前已实现：
- 用户 CRUD（UserService + UserRepository + user-routes）
- 角色管理（RoleService + RoleRepository + role-routes）
- 权限管理（PermissionService + requirePermission 中间件）
- 多租户支持（TenantService + tenant-context-storage）
- 用户档案管理（UserProfileService）
- 用户活动日志（UserActivityService）
- API Key 管理

**不足**：
- Organization 模块完全缺失（无组织架构/部门/团队管理）
- LDAP 依赖缺失（用户同步无真实 LDAP 对接）
- TenantContext 线程安全（AsyncLocalStorage 使用不当导致跨请求污染）
- SQL 注入风险（部分查询未使用参数化查询）
- 硬编码默认租户（SYSTEM_TENANT_ID 直接写死在代码中）
- Password 字段名不一致（user 表使用 password_hash，部分代码使用 password）
- 权限检查降级过于宽松（数据库不可用时默认允许）
- active_sessions 表缺失（无用户活跃会话管理）

### 1.2 Phase 1 目标 (L3)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 组织架构 | 部门/团队/成员管理、树形结构 | L3 |
| 用户管理增强 | 批量导入/导出、状态管理、会话管理 | L3 |
| 租户隔离修复 | TenantContext 线程安全、默认租户消除 | L3 |
| 安全加固 | SQL 注入修复、密码字段统一、权限降级收紧 | L3 |
| active_sessions | 用户活跃会话追踪与管理 | L3 |

## 二、验收标准

### 2.1 组织架构

| # | 标准 | 验证方式 |
|---|------|----------|
| O1 | 支持部门/团队的树形结构（无限层级） | API 测试 |
| O2 | 部门 CRUD：创建/更新/删除/查询 | API 测试 |
| O3 | 团队成员管理：添加/移除成员、设置角色 | API 测试 |
| O4 | 组织树前端展示（Ant Design Tree 组件） | 前端验证 |
| O5 | 用户可属于多个团队 | API 测试 |

### 2.2 用户管理增强

| # | 标准 | 验证方式 |
|---|------|----------|
| U1 | 用户批量导入（CSV/Excel，最大 1000 条） | API 测试 |
| U2 | 用户批量导出（CSV/Excel） | API 测试 |
| U3 | 用户状态管理（活跃/停用/锁定） | API 测试 |
| U4 | active_sessions 表记录用户活跃会话 | 单元测试 |
| U5 | 用户可查看自己的活跃会话并强制登出 | 前端 + API 测试 |

### 2.3 租户隔离修复

| # | 标准 | 验证方式 |
|---|------|----------|
| T1 | TenantContext 使用 AsyncLocalStorage 确保请求级隔离 | 集成测试 |
| T2 | 消除硬编码 `SYSTEM_TENANT_ID`，改为配置注入 | 单元测试 |
| T3 | 所有 Repository 查询包含 tenant_id WHERE 条件 | 代码审查 |
| T4 | 跨租户数据访问返回 403 | API 测试 |

### 2.4 安全加固

| # | 标准 | 验证方式 |
|---|------|----------|
| S1 | 所有 SQL 查询使用参数化查询（Prepared Statement） | 代码审查 |
| S2 | Password 字段名统一为 `password_hash` | 单元测试 |
| S3 | 数据库不可用时权限检查返回 503 而非默认允许 | 集成测试 |
| S4 | 密码哈希使用 bcrypt（cost factor = 12） | 单元测试 |

## 三、API 设计

### 3.1 组织架构端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/organizations` | 获取组织树 |
| POST | `/api/v1/organizations` | 创建部门 |
| PUT | `/api/v1/organizations/:id` | 更新部门 |
| DELETE | `/api/v1/organizations/:id` | 删除部门 |
| GET | `/api/v1/organizations/:id/members` | 获取部门成员 |
| POST | `/api/v1/organizations/:id/members` | 添加成员 |

### 3.2 会话管理端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/sessions` | 获取用户活跃会话 |
| DELETE | `/api/v1/sessions/:id` | 强制登出会话 |

### 3.3 用户批量操作端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/users/import` | 批量导入用户 |
| GET | `/api/v1/users/export` | 批量导出用户 |
| PUT | `/api/v1/users/:id/status` | 更新用户状态 |

## 四、数据模型

### 4.1 organizations 表

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  parent_id UUID REFERENCES organizations(id),
  type VARCHAR(50) DEFAULT 'department',  -- department, team, group
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 4.2 active_sessions 表

```sql
CREATE TABLE active_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  token_jti VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  last_activity TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  expired_at TIMESTAMP NOT NULL
);
```

## 五、依赖关系

| 依赖 | 类型 | 说明 |
|------|------|------|
| TenantService | 内部 | 租户上下文 |
| AuthService | 部 | JWT 认证 |
| Redis | 基础设施 | 会话缓存（可选） |

---

_文档版本: v1.0 | 创建日期: 2026-07-02 | 状态: 已验证_