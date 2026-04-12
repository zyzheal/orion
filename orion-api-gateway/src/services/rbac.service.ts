/**
 * RBAC 权限模型服务
 *
 * 实现基于角色的访问控制（Role-Based Access Control）
 * - 定义角色和权限数据结构
 * - 实现角色权限检查方法
 * - 支持权限缓存
 * - 支持与 ABAC 组合检查
 */

import { EventEmitter } from 'events';

export interface Permission {
  id: string;
  name: string;
  description?: string;
  resource: string; // 资源类型，如 'user', 'project', 'deployment'
  action: string; // 操作类型，如 'create', 'read', 'update', 'delete'
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[]; // 权限 ID 列表
  inheritedFrom?: string[]; // 继承的角色 ID
}

export interface UserRole {
  userId: string;
  roleId: string;
  grantedAt: Date;
  grantedBy?: string;
  expiresAt?: Date;
}

/**
 * 预定义系统角色
 */
export const SYSTEM_ROLES: Record<string, Role> = {
  // 超级管理员 - 拥有所有权限
  ADMIN: {
    id: 'admin',
    name: 'Administrator',
    description: '系统管理员，拥有所有权限',
    permissions: ['*'],
  },

  // 开发者 - 拥有读写权限
  DEVELOPER: {
    id: 'developer',
    name: 'Developer',
    description: '开发者，拥有大部分读写权限',
    permissions: [
      'project:read',
      'project:write',
      'deployment:read',
      'deployment:create',
      'deployment:update',
      'pipeline:read',
      'pipeline:create',
      'pipeline:update',
      'pipeline:trigger',
      'artifact:read',
      'artifact:upload',
      'log:read',
    ],
  },

  // 运维人员 - 拥有部署和监控权限
  OPERATOR: {
    id: 'operator',
    name: 'Operator',
    description: '运维人员，拥有部署和监控权限',
    permissions: [
      'deployment:read',
      'deployment:create',
      'deployment:update',
      'deployment:rollback',
      'pipeline:read',
      'pipeline:trigger',
      'monitoring:read',
      'log:read',
      'alert:read',
      'alert:acknowledge',
    ],
  },

  // 测试人员 - 拥有测试相关权限
  TESTER: {
    id: 'tester',
    name: 'Tester',
    description: '测试人员，拥有测试相关权限',
    permissions: [
      'project:read',
      'deployment:read',
      'pipeline:read',
      'pipeline:trigger',
      'test:read',
      'test:create',
      'test:execute',
      'artifact:read',
      'log:read',
    ],
  },

  // 访客 - 只读权限
  GUEST: {
    id: 'guest',
    name: 'Guest',
    description: '访客，仅拥有只读权限',
    permissions: [
      'project:read',
      'deployment:read',
      'pipeline:read',
      'artifact:read',
      'log:read',
    ],
  },
};

/**
 * 预定义权限
 */
export const SYSTEM_PERMISSIONS: Record<string, Permission> = {
  // 项目权限
  'project:read': {
    id: 'project:read',
    name: 'Read Projects',
    resource: 'project',
    action: 'read',
  },
  'project:write': {
    id: 'project:write',
    name: 'Write Projects',
    resource: 'project',
    action: 'write',
  },
  'project:create': {
    id: 'project:create',
    name: 'Create Projects',
    resource: 'project',
    action: 'create',
  },
  'project:delete': {
    id: 'project:delete',
    name: 'Delete Projects',
    resource: 'project',
    action: 'delete',
  },

  // 部署权限
  'deployment:read': {
    id: 'deployment:read',
    name: 'Read Deployments',
    resource: 'deployment',
    action: 'read',
  },
  'deployment:create': {
    id: 'deployment:create',
    name: 'Create Deployments',
    resource: 'deployment',
    action: 'create',
  },
  'deployment:update': {
    id: 'deployment:update',
    name: 'Update Deployments',
    resource: 'deployment',
    action: 'update',
  },
  'deployment:delete': {
    id: 'deployment:delete',
    name: 'Delete Deployments',
    resource: 'deployment',
    action: 'delete',
  },
  'deployment:rollback': {
    id: 'deployment:rollback',
    name: 'Rollback Deployments',
    resource: 'deployment',
    action: 'rollback',
  },

  // 流水线权限
  'pipeline:read': {
    id: 'pipeline:read',
    name: 'Read Pipelines',
    resource: 'pipeline',
    action: 'read',
  },
  'pipeline:create': {
    id: 'pipeline:create',
    name: 'Create Pipelines',
    resource: 'pipeline',
    action: 'create',
  },
  'pipeline:update': {
    id: 'pipeline:update',
    name: 'Update Pipelines',
    resource: 'pipeline',
    action: 'update',
  },
  'pipeline:delete': {
    id: 'pipeline:delete',
    name: 'Delete Pipelines',
    resource: 'pipeline',
    action: 'delete',
  },
  'pipeline:trigger': {
    id: 'pipeline:trigger',
    name: 'Trigger Pipelines',
    resource: 'pipeline',
    action: 'trigger',
  },

  // 制品权限
  'artifact:read': {
    id: 'artifact:read',
    name: 'Read Artifacts',
    resource: 'artifact',
    action: 'read',
  },
  'artifact:upload': {
    id: 'artifact:upload',
    name: 'Upload Artifacts',
    resource: 'artifact',
    action: 'upload',
  },
  'artifact:delete': {
    id: 'artifact:delete',
    name: 'Delete Artifacts',
    resource: 'artifact',
    action: 'delete',
  },

  // 日志权限
  'log:read': {
    id: 'log:read',
    name: 'Read Logs',
    resource: 'log',
    action: 'read',
  },

  // 监控权限
  'monitoring:read': {
    id: 'monitoring:read',
    name: 'Read Monitoring',
    resource: 'monitoring',
    action: 'read',
  },

  // 告警权限
  'alert:read': {
    id: 'alert:read',
    name: 'Read Alerts',
    resource: 'alert',
    action: 'read',
  },
  'alert:acknowledge': {
    id: 'alert:acknowledge',
    name: 'Acknowledge Alerts',
    resource: 'alert',
    action: 'acknowledge',
  },
  'alert:resolve': {
    id: 'alert:resolve',
    name: 'Resolve Alerts',
    resource: 'alert',
    action: 'resolve',
  },

  // 测试权限
  'test:read': {
    id: 'test:read',
    name: 'Read Tests',
    resource: 'test',
    action: 'read',
  },
  'test:create': {
    id: 'test:create',
    name: 'Create Tests',
    resource: 'test',
    action: 'create',
  },
  'test:execute': {
    id: 'test:execute',
    name: 'Execute Tests',
    resource: 'test',
    action: 'execute',
  },

  // 用户权限
  'user:read': {
    id: 'user:read',
    name: 'Read Users',
    resource: 'user',
    action: 'read',
  },
  'user:write': {
    id: 'user:write',
    name: 'Write Users',
    resource: 'user',
    action: 'write',
  },
  'user:delete': {
    id: 'user:delete',
    name: 'Delete Users',
    resource: 'user',
    action: 'delete',
  },

  // 角色权限
  'role:read': {
    id: 'role:read',
    name: 'Read Roles',
    resource: 'role',
    action: 'read',
  },
  'role:assign': {
    id: 'role:assign',
    name: 'Assign Roles',
    resource: 'role',
    action: 'assign',
  },
  'role:revoke': {
    id: 'role:revoke',
    name: 'Revoke Roles',
    resource: 'role',
    action: 'revoke',
  },
};

/**
 * RBAC 服务类
 * 支持缓存、事件通知和 ABAC 组合检查
 */
export class RbacService extends EventEmitter {
  private roles: Map<string, Role> = new Map();
  private permissions: Map<string, Permission> = new Map();
  private userRoles: Map<string, UserRole[]> = new Map();

  // 权限缓存
  private permissionCache: Map<string, { permissions: Permission[]; expiresAt: number }> = new Map();
  private cacheEnabled: boolean = true;
  private cacheTTL: number = 60000; // 1 分钟

  // 权限矩阵（角色-权限映射）
  private permissionMatrix: Map<string, Set<string>> = new Map();

  constructor() {
    super();
    // 初始化系统角色和权限
    this.initSystemRoles();
    this.initSystemPermissions();
    this.buildPermissionMatrix();
  }

  /**
   * 初始化系统角色
   */
  private initSystemRoles(): void {
    Object.values(SYSTEM_ROLES).forEach((role) => {
      this.roles.set(role.id, role);
    });
  }

  /**
   * 初始化系统权限
   */
  private initSystemPermissions(): void {
    Object.values(SYSTEM_PERMISSIONS).forEach((permission) => {
      this.permissions.set(permission.id, permission);
    });
  }

  /**
   * 构建权限矩阵（用于快速查找）
   */
  private buildPermissionMatrix(): void {
    this.roles.forEach((role) => {
      const permSet = new Set<string>();
      role.permissions.forEach((perm) => permSet.add(perm));

      // 处理继承
      if (role.inheritedFrom) {
        role.inheritedFrom.forEach((inheritedId) => {
          const inheritedRole = this.roles.get(inheritedId);
          if (inheritedRole) {
            inheritedRole.permissions.forEach((perm) => permSet.add(perm));
          }
        });
      }

      this.permissionMatrix.set(role.id, permSet);
    });
  }

  /**
   * 注册自定义角色
   */
  registerRole(role: Role): void {
    this.roles.set(role.id, role);
    // 更新权限矩阵
    const permSet = new Set<string>();
    role.permissions.forEach((perm) => permSet.add(perm));
    if (role.inheritedFrom) {
      role.inheritedFrom.forEach((inheritedId) => {
        const inheritedRole = this.roles.get(inheritedId);
        if (inheritedRole) {
          inheritedRole.permissions.forEach((perm) => permSet.add(perm));
        }
      });
    }
    this.permissionMatrix.set(role.id, permSet);
    // 清除缓存
    this.invalidateCache();
    // 发送事件
    this.emit('roleRegistered', { roleId: role.id });
  }

  /**
   * 注册自定义权限
   */
  registerPermission(permission: Permission): void {
    this.permissions.set(permission.id, permission);
    // 发送事件
    this.emit('permissionRegistered', { permissionId: permission.id });
  }

  /**
   * 获取角色
   */
  getRole(roleId: string): Role | undefined {
    return this.roles.get(roleId);
  }

  /**
   * 获取权限
   */
  getPermission(permissionId: string): Permission | undefined {
    return this.permissions.get(permissionId);
  }

  /**
   * 获取所有角色
   */
  getAllRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  /**
   * 获取所有权限
   */
  getAllPermissions(): Permission[] {
    return Array.from(this.permissions.values());
  }

  /**
   * 为用户分配角色
   */
  assignRole(userId: string, roleId: string, grantedBy?: string, expiresAt?: Date): void {
    const role = this.roles.get(roleId);
    if (!role) {
      throw new Error(`Role '${roleId}' not found`);
    }

    const userRoles = this.userRoles.get(userId) || [];
    // 检查是否已有该角色
    const existing = userRoles.find((ur) => ur.roleId === roleId);
    if (existing) {
      // 更新过期时间
      existing.expiresAt = expiresAt;
      existing.grantedAt = new Date();
    } else {
      userRoles.push({
        userId,
        roleId,
        grantedAt: new Date(),
        grantedBy,
        expiresAt,
      });
    }
    this.userRoles.set(userId, userRoles);
    // 清除用户权限缓存
    this.invalidateUserCache(userId);
    // 发送事件
    this.emit('roleAssigned', { userId, roleId, grantedBy });
  }

  /**
   * 撤销用户角色
   */
  revokeRole(userId: string, roleId: string): void {
    const userRoles = this.userRoles.get(userId) || [];
    const filtered = userRoles.filter((ur) => ur.roleId !== roleId);
    this.userRoles.set(userId, filtered);
    // 清除用户权限缓存
    this.invalidateUserCache(userId);
    // 发送事件
    this.emit('roleRevoked', { userId, roleId });
  }

  /**
   * 获取用户的所有角色
   */
  getUserRoles(userId: string): Role[] {
    const userRoles = this.userRoles.get(userId) || [];
    const now = new Date();

    // 过滤掉已过期的角色
    const validUserRoles = userRoles.filter((ur) => !ur.expiresAt || ur.expiresAt > now);

    return validUserRoles
      .map((ur) => this.roles.get(ur.roleId))
      .filter((role): role is Role => !!role);
  }

  /**
   * 获取用户的所有权限（带缓存）
   */
  getUserPermissions(userId: string): Permission[] {
    // 检查缓存
    if (this.cacheEnabled) {
      const cached = this.permissionCache.get(userId);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.permissions;
      }
    }

    const roles = this.getUserRoles(userId);
    const permissionSet = new Set<string>();

    // 使用权限矩阵快速查找
    roles.forEach((role) => {
      const rolePerms = this.permissionMatrix.get(role.id);
      if (rolePerms) {
        if (rolePerms.has('*')) {
          permissionSet.add('*');
          return;
        }
        rolePerms.forEach((perm) => permissionSet.add(perm));
      }
    });

    // 转换为 Permission 对象
    let permissions: Permission[];
    if (permissionSet.has('*')) {
      permissions = Array.from(this.permissions.values());
    } else {
      permissions = [];
      permissionSet.forEach((permId) => {
        const perm = this.permissions.get(permId);
        if (perm) {
          permissions.push(perm);
        }
      });
    }

    // 缓存结果
    if (this.cacheEnabled) {
      this.permissionCache.set(userId, {
        permissions,
        expiresAt: Date.now() + this.cacheTTL,
      });
    }

    return permissions;
  }

  /**
   * 快速获取用户权限 ID 集合（不转换为 Permission 对象）
   */
  getUserPermissionIds(userId: string): Set<string> {
    const roles = this.getUserRoles(userId);
    const permissionSet = new Set<string>();

    // 直接从权限矩阵获取，不依赖缓存（缓存的是展开后的权限）
    roles.forEach((role) => {
      const rolePerms = this.permissionMatrix.get(role.id);
      if (rolePerms) {
        rolePerms.forEach((perm) => permissionSet.add(perm));
      }
    });

    return permissionSet;
  }

  /**
   * 检查用户是否拥有指定角色
   */
  hasRole(userId: string, roleId: string): boolean {
    const roles = this.getUserRoles(userId);
    return roles.some((role) => role.id === roleId);
  }

  /**
   * 检查用户是否拥有指定权限
   */
  hasPermission(userId: string, permissionId: string): boolean {
    // 使用权限 ID 集合检查（包含通配符）
    const permIds = this.getUserPermissionIds(userId);

    // 检查是否拥有所有权限
    if (permIds.has('*')) {
      return true;
    }

    return permIds.has(permissionId);
  }

  /**
   * 检查用户是否拥有任一权限
   */
  hasAnyPermission(userId: string, permissionIds: string[]): boolean {
    return permissionIds.some((permId) => this.hasPermission(userId, permId));
  }

  /**
   * 检查用户是否拥有所有权限
   */
  hasAllPermissions(userId: string, permissionIds: string[]): boolean {
    return permissionIds.every((permId) => this.hasPermission(userId, permId));
  }

  /**
   * 检查资源级别的权限
   * @param userId 用户 ID
   * @param resource 资源类型
   * @param action 操作类型
   * @param resourceId 资源 ID（可选，用于更细粒度的控制）
   */
  checkResourcePermission(
    userId: string,
    resource: string,
    action: string,
    resourceId?: string
  ): boolean {
    const permissionId = `${resource}:${action}`;
    return this.hasPermission(userId, permissionId);
  }

  // ==================== 缓存管理 ====================

  /**
   * 清除所有缓存
   */
  invalidateCache(): void {
    this.permissionCache.clear();
    this.emit('cacheInvalidated');
  }

  /**
   * 清除特定用户的缓存
   */
  invalidateUserCache(userId: string): void {
    this.permissionCache.delete(userId);
    this.emit('userCacheInvalidated', { userId });
  }

  /**
   * 设置缓存配置
   */
  setCacheConfig(enabled: boolean, ttl?: number): void {
    this.cacheEnabled = enabled;
    if (ttl !== undefined) {
      this.cacheTTL = ttl;
    }
    if (!enabled) {
      this.permissionCache.clear();
    }
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): {
    enabled: boolean;
    ttl: number;
    size: number;
    entries: string[];
  } {
    return {
      enabled: this.cacheEnabled,
      ttl: this.cacheTTL,
      size: this.permissionCache.size,
      entries: Array.from(this.permissionCache.keys()),
    };
  }

  // ==================== 权限矩阵查询 ====================

  /**
   * 获取角色的权限集合
   */
  getRolePermissions(roleId: string): Set<string> | undefined {
    return this.permissionMatrix.get(roleId);
  }

  /**
   * 检查角色是否有特定权限
   */
  roleHasPermission(roleId: string, permissionId: string): boolean {
    const perms = this.permissionMatrix.get(roleId);
    if (!perms) return false;
    return perms.has('*') || perms.has(permissionId);
  }

  /**
   * 获取权限所属的所有角色
   */
  getPermissionRoles(permissionId: string): Role[] {
    const roles: Role[] = [];
    this.permissionMatrix.forEach((perms, roleId) => {
      if (perms.has('*') || perms.has(permissionId)) {
        const role = this.roles.get(roleId);
        if (role) roles.push(role);
      }
    });
    return roles;
  }

  // ==================== 权限变更订阅 ====================

  /**
   * 订阅角色分配事件
   */
  onRoleAssigned(callback: (data: { userId: string; roleId: string; grantedBy?: string }) => void): void {
    this.on('roleAssigned', callback);
  }

  /**
   * 订阅角色撤销事件
   */
  onRoleRevoked(callback: (data: { userId: string; roleId: string }) => void): void {
    this.on('roleRevoked', callback);
  }

  /**
   * 订阅权限变更事件
   */
  onPermissionChange(callback: (data: { type: string; userId?: string; roleId?: string }) => void): void {
    this.on('roleAssigned', (data) => callback({ type: 'assign', ...data }));
    this.on('roleRevoked', (data) => callback({ type: 'revoke', ...data }));
    this.on('cacheInvalidated', () => callback({ type: 'invalidate' }));
  }

  // ==================== 安全增强 ====================

  /**
   * 检查权限绕过风险
   * 确保所有敏感操作都有权限检查
   */
  checkBypassRisk(userId: string, resource: string, action: string): {
    safe: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];
    const permissionId = `${resource}:${action}`;

    // 检查是否有通配符权限（可能绕过细粒度控制）
    const userPerms = this.getUserPermissionIds(userId);
    if (userPerms.has('*')) {
      warnings.push('User has wildcard permission (*) which bypasses granular control');
    }

    // 检查是否有 admin 角色（可能有过多权限）
    const roles = this.getUserRoles(userId);
    if (roles.some((r) => r.id === 'admin')) {
      warnings.push('User has admin role with full permissions');
    }

    // 检查是否有明确的权限
    const hasExplicit = userPerms.has(permissionId);
    if (!hasExplicit && !userPerms.has('*')) {
      warnings.push(`User lacks explicit permission '${permissionId}'`);
    }

    return {
      safe: warnings.length === 0,
      warnings,
    };
  }

  /**
   * 获取用户权限审计报告
   */
  getPermissionAudit(userId: string): {
    userId: string;
    roles: Role[];
    permissions: Permission[];
    riskLevel: 'low' | 'medium' | 'high';
    warnings: string[];
  } {
    const roles = this.getUserRoles(userId);
    const permissions = this.getUserPermissions(userId);
    const warnings: string[] = [];

    // 使用权限 ID 集合检查（包含通配符）
    const userPermIds = this.getUserPermissionIds(userId);

    // 检查高风险权限
    const highRiskPerms = ['user:delete', 'role:assign', 'tenant:delete', '*'];

    for (const riskPerm of highRiskPerms) {
      if (userPermIds.has(riskPerm)) {
        warnings.push(`Has high-risk permission: ${riskPerm}`);
      }
    }

    // 确定风险级别
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (userPermIds.has('*')) {
      riskLevel = 'high';
    } else if (warnings.length > 0) {
      riskLevel = 'medium';
    }

    return {
      userId,
      roles,
      permissions,
      riskLevel,
      warnings,
    };
  }
}

// 导出单例
export const rbacService = new RbacService();
