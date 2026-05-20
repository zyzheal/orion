/**
 * RoleService - Business logic layer for Role
 *
 * 增强版：支持角色继承、权限种子、RBAC+ABAC 统一权限模型
 */
import { RoleRepository, Role } from './RoleRepository';

export class RoleServiceError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = 'RoleServiceError'; }
}

/**
 * 角色继承关系: key = 子角色, value = 父角色列表
 * 子角色自动拥有父角色的所有权限
 */
export const ROLE_INHERITANCE: Record<string, string[]> = {
  'admin':              ['super_admin'],  // admin 继承 super_admin
  'platform_admin': ['super_admin'],
  'tenant_admin':   ['platform_admin'],
  'org_admin':      ['tenant_admin'],
  'tech_lead':      ['org_admin'],
  'developer':      ['tech_lead'],
  'project_lead':   ['project_admin'],
  'project_developer': ['project_lead'],
  'project_viewer': ['project_developer'],
};

/** 系统级角色权限映射 */
export const SYSTEM_ROLE_PERMISSIONS: Record<string, string[]> = {
  'super_admin':         ['*:*'],
  'admin':               ['*:*'],  // admin 等同于 super_admin（兼容历史数据）
  'platform_admin':      ['*:manage', '*:read', '*:write', '*:execute', '*:delete', '*:approve'],
  'tenant_admin':        ['*:read', '*:write', '*:manage', 'audit_log:read'],
  'org_admin':           ['*:read', '*:write', '*:execute', '*:manage', '*:approve'],
  'security_admin':      ['audit_log:read', 'config:read', 'secrets:read', 'user:read', 'role:read',
                          'project:read', 'pipeline:read', 'deployment:read', 'alert:read',
                          'security:manage', 'ticket:read', 'ticket:write', 'approval:approve'],
  'finops_admin':        ['finops:*', 'project:read', 'deployment:read', 'pipeline:read'],
};

/** 业务级角色权限映射 */
export const BUSINESS_ROLE_PERMISSIONS: Record<string, string[]> = {
  'tech_lead':   ['project:read', 'project:write', 'pipeline:read', 'pipeline:write',
                   'pipeline:execute', 'pipeline:approve', 'deployment:read',
                   'deployment:execute', 'alert:read', 'alert:acknowledge',
                   'config:read', 'ticket:read', 'ticket:write',
                   'artifact:read', 'knowledge:read', 'knowledge:write'],
  'developer':   ['project:read', 'pipeline:read', 'pipeline:write', 'pipeline:execute',
                   'deployment:read', 'alert:read', 'config:read',
                   'ticket:read', 'ticket:write', 'artifact:read',
                   'knowledge:read'],
  'sre':         ['*:read', 'deployment:execute', 'deployment:approve',
                   'environment:*', 'alert:*', 'config:write',
                   'pipeline:read', 'pipeline:execute', 'iac:*',
                   'ticket:read', 'ticket:write', 'oncall:*'],
  'dba':         ['project:read', 'pipeline:read', 'deployment:read',
                   'config:read', 'alert:read', 'cmdb:read',
                   'environment:read', 'secrets:read'],
  'viewer':      ['project:read', 'pipeline:read', 'deployment:read',
                   'alert:read', 'artifact:read', 'knowledge:read',
                   'ticket:read', 'finops:read'],
  'auditor':     ['audit_log:*', '*:read', 'ticket:read', 'approval:read'],
};

/** 项目级角色权限映射 */
export const PROJECT_ROLE_PERMISSIONS: Record<string, string[]> = {
  'project_admin':     ['project:*', 'pipeline:*', 'deployment:*',
                         'environment:read', 'artifact:*', 'alert:*',
                         'ticket:*', 'approval:*', 'secrets:*', 'oncall:*'],
  'project_lead':      ['project:read', 'project:write', 'pipeline:*',
                         'pipeline:approve', 'deployment:read',
                         'deployment:execute', 'artifact:read', 'artifact:write',
                         'alert:read', 'alert:acknowledge', 'ticket:*',
                         'approval:approve', 'secrets:read', 'oncall:*'],
  'project_developer': ['project:read', 'pipeline:read', 'pipeline:write',
                         'pipeline:execute', 'deployment:read',
                         'artifact:read', 'alert:read', 'ticket:read',
                         'ticket:write', 'secrets:read'],
  'project_viewer':    ['project:read', 'pipeline:read', 'deployment:read',
                         'artifact:read', 'alert:read', 'ticket:read',
                         'knowledge:read'],
};

export class RoleService {
  private repository: RoleRepository;
  constructor(repository: RoleRepository) { this.repository = repository; }

  async createRole(tenantId: string, name: string, permissions: string[]): Promise<Role> {
    if (!tenantId || !name) throw new RoleServiceError('Tenant ID and name required', 'INVALID_INPUT');
    return this.repository.create(tenantId, name, permissions);
  }

  async listRoles(tenantId: string): Promise<Role[]> {
    return this.repository.findAll(tenantId);
  }

  async getRole(id: string): Promise<Role> {
    const role = await this.repository.findById(id);
    if (!role) throw new RoleServiceError(`Role not found: ${id}`, 'NOT_FOUND');
    return role;
  }

  async deleteRole(id: string): Promise<boolean> {
    return this.repository.delete(id);
  }

  async updateRole(id: string, input: { name?: string; description?: string; permissions?: string[] }): Promise<Role> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new RoleServiceError(`Role not found: ${id}`, 'NOT_FOUND');
    const updated = await this.repository.update(id, input);
    if (!updated) throw new RoleServiceError(`Failed to update role: ${id}`, 'UPDATE_FAILED');
    return updated;
  }

  /**
   * 获取用户所有角色（含继承展开）
   * 从用户直接分配的角色出发，递归向上查找所有父角色
   */
  async getAllRoles(userId: string, tenantId: string): Promise<string[]> {
    const userRoles = await this.repository.findUserRoles(userId, tenantId);
    const allRoles = new Set<string>(userRoles.map(r => r.name));

    // 递归向上展开父角色（子角色 → 父角色方向）
    let changed = true;
    while (changed) {
      changed = false;
      for (const role of [...allRoles]) {
        const parents = ROLE_INHERITANCE[role];
        if (parents) {
          for (const parent of parents) {
            if (!allRoles.has(parent)) {
              allRoles.add(parent);
              changed = true;
            }
          }
        }
      }
    }
    return Array.from(allRoles);
  }

  /**
   * 检查角色是否有某权限（含继承 + 通配符）
   */
  async checkPermissions(
    roleNames: string[],
    resourceType: string,
    action: string,
  ): Promise<{ allowed: boolean; reason: string }> {
    if (roleNames.length === 0) {
      return { allowed: false, reason: 'No roles assigned' };
    }

    // 通配符检查
    if (roleNames.includes('super_admin') || roleNames.includes('admin')) {
      return { allowed: true, reason: 'Super Admin' };
    }

    // 先检查内存中的角色权限映射（快速路径）
    const allRolePerms = { ...SYSTEM_ROLE_PERMISSIONS, ...BUSINESS_ROLE_PERMISSIONS, ...PROJECT_ROLE_PERMISSIONS };
    for (const roleName of roleNames) {
      const perms = allRolePerms[roleName];
      if (perms && this.permissionMatches(resourceType, action, perms)) {
        return { allowed: true, reason: `Role "${roleName}" grants permission` };
      }
    }

    // 回退到数据库查询（通过 role_permissions 表）
    const permissions = await this.repository.findPermissionsByRoleNames(roleNames);

    const hasExact = permissions.some(p => p.resource === resourceType && p.action === action);
    if (hasExact) return { allowed: true, reason: `Permission ${resourceType}:${action} granted` };

    const hasResourceWildcard = permissions.some(p => p.resource === resourceType && p.action === '*');
    if (hasResourceWildcard) return { allowed: true, reason: `Resource wildcard ${resourceType}:* granted` };

    const hasActionWildcard = permissions.some(p => p.resource === '*' && p.action === action);
    if (hasActionWildcard) return { allowed: true, reason: `Action wildcard *:${action} granted` };

    const hasFullWildcard = permissions.some(p => p.resource === '*' && p.action === '*');
    if (hasFullWildcard) return { allowed: true, reason: 'Full wildcard *:* granted' };

    return { allowed: false, reason: `No role grants permission for ${resourceType}:${action}` };
  }

  private permissionMatches(resourceType: string, action: string, permissions: string[]): boolean {
    for (const perm of permissions) {
      const [permRes, permAct] = perm.split(':');
      const resMatch = permRes === '*' || permRes === resourceType;
      const actMatch = permAct === '*' || permAct === action;
      if (resMatch && actMatch) return true;
    }
    return false;
  }

  /**
   * 创建系统默认角色（如果不存在）
   * 应在应用初始化时调用
   */
  async seedDefaultRoles(tenantId: string): Promise<{ created: number; skipped: number }> {
    const allRoles = Object.keys({ ...SYSTEM_ROLE_PERMISSIONS, ...BUSINESS_ROLE_PERMISSIONS, ...PROJECT_ROLE_PERMISSIONS });
    let created = 0;
    let skipped = 0;

    for (const roleName of allRoles) {
      const existing = await this.repository.findByName(roleName);
      if (existing) {
        skipped++;
        continue;
      }
      await this.repository.create(tenantId, roleName, []);
      created++;
    }

    return { created, skipped };
  }

  /**
   * 初始化角色默认权限映射（写入 role_permissions 表）
   *
   * 实施注意:
   * - 应在 PermissionService.seedCommonPermissions() 之后调用
   * - 先创建权限定义，再将权限绑定到角色
   */
  async seedRolePermissions(): Promise<void> {
    const rolePerms: Record<string, string[]> = {
      ...SYSTEM_ROLE_PERMISSIONS,
      ...BUSINESS_ROLE_PERMISSIONS,
      ...PROJECT_ROLE_PERMISSIONS,
    };

    for (const [roleName, perms] of Object.entries(rolePerms)) {
      const role = await this.repository.findByName(roleName);
      if (!role) continue;

      for (const perm of perms) {
        const [resource, action] = perm.split(':');
        const existing = await this.repository.findRolePermission(role.id, resource, action);
        if (!existing) {
          await this.repository.addRolePermission(role.id, resource, action);
        }
      }
    }
  }
}
