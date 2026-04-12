/**
 * RBAC 权限模型服务
 *
 * 实现基于角色的访问控制（Role-Based Access Control）
 * - 定义角色和权限数据结构
 * - 实现角色权限检查方法
 */

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
 */
export class RbacService {
  private roles: Map<string, Role> = new Map();
  private permissions: Map<string, Permission> = new Map();
  private userRoles: Map<string, UserRole[]> = new Map();

  constructor() {
    // 初始化系统角色和权限
    this.initSystemRoles();
    this.initSystemPermissions();
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
   * 注册自定义角色
   */
  registerRole(role: Role): void {
    this.roles.set(role.id, role);
  }

  /**
   * 注册自定义权限
   */
  registerPermission(permission: Permission): void {
    this.permissions.set(permission.id, permission);
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
    userRoles.push({
      userId,
      roleId,
      grantedAt: new Date(),
      grantedBy,
      expiresAt,
    });
    this.userRoles.set(userId, userRoles);
  }

  /**
   * 撤销用户角色
   */
  revokeRole(userId: string, roleId: string): void {
    const userRoles = this.userRoles.get(userId) || [];
    const filtered = userRoles.filter((ur) => ur.roleId !== roleId);
    this.userRoles.set(userId, filtered);
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
   * 获取用户的所有权限
   */
  getUserPermissions(userId: string): Permission[] {
    const roles = this.getUserRoles(userId);
    const permissionSet = new Set<string>();

    // 收集所有权限 ID
    roles.forEach((role) => {
      if (role.permissions.includes('*')) {
        // 拥有所有权限
        permissionSet.add('*');
        return;
      }

      role.permissions.forEach((permId) => {
        permissionSet.add(permId);
      });

      // 处理继承角色
      if (role.inheritedFrom) {
        role.inheritedFrom.forEach((inheritedRoleId) => {
          const inheritedRole = this.roles.get(inheritedRoleId);
          if (inheritedRole) {
            inheritedRole.permissions.forEach((permId) => {
              permissionSet.add(permId);
            });
          }
        });
      }
    });

    // 转换为 Permission 对象
    const permissions: Permission[] = [];
    if (permissionSet.has('*')) {
      // 返回所有权限
      return Array.from(this.permissions.values());
    }

    permissionSet.forEach((permId) => {
      const perm = this.permissions.get(permId);
      if (perm) {
        permissions.push(perm);
      }
    });

    return permissions;
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
    const permissions = this.getUserPermissions(userId);

    // 检查是否拥有所有权限
    if (permissions.some((p) => p.id === '*')) {
      return true;
    }

    return permissions.some((p) => p.id === permissionId);
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
}

// 导出单例
export const rbacService = new RbacService();
