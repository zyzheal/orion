/**
 * RoleService - Business logic layer for Role
 */
import { RoleRepository, Role } from './RoleRepository';

export class RoleServiceError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = 'RoleServiceError'; }
}

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
   * 检查给定角色集合是否具备对指定资源类型执行某操作的权限。
   *
   * 权限字符串约定：`<resourceType>:<action>`，例如 `pipeline:read`。
   * 通配符 `*` 可替代资源类型或操作，例如 `*:read` 或 `pipeline:*`。
   */
  async checkPermissions(
    roleNames: string[],
    resourceType: string,
    action: string,
  ): Promise<{ allowed: boolean; reason: string }> {
    if (roleNames.length === 0) {
      return { allowed: false, reason: 'No roles assigned' };
    }

    for (const roleName of roleNames) {
      const role = await this.repository.findByName(roleName);
      if (!role) continue;

      if (role.permissions && this.permissionMatches(resourceType, action, role.permissions)) {
        return { allowed: true, reason: `Role "${roleName}" grants permission` };
      }
    }

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
}
