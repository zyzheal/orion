import { PermissionRepository, Permission } from '../repositories/PermissionRepository';

/**
 * PermissionService - Business logic layer for Permission management
 */

export class PermissionServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'PermissionServiceError';
  }
}

export class PermissionService {
  constructor(private repository: PermissionRepository) {}

  /** List all permissions */
  async listPermissions(): Promise<Permission[]> {
    return this.repository.findAll();
  }

  /** Get permission detail by ID */
  async getPermission(id: string): Promise<Permission> {
    const perm = await this.repository.findById(id);
    if (!perm) throw new PermissionServiceError(`Permission not found: ${id}`, 'NOT_FOUND');
    return perm;
  }

  /** Create a new permission */
  async createPermission(resource: string, action: string, description?: string): Promise<Permission> {
    if (!resource || !action) {
      throw new PermissionServiceError('Resource and action are required', 'INVALID_INPUT');
    }

    // Validate action is a known verb
    const validActions = ['read', 'write', 'execute', 'delete', 'manage', 'acknowledge', 'use'];
    if (!validActions.includes(action)) {
      throw new PermissionServiceError(
        `Invalid action: ${action}. Must be one of: ${validActions.join(', ')}`,
        'INVALID_ACTION'
      );
    }

    try {
      return await this.repository.create(resource, action, description);
    } catch (err: any) {
      if (err.code === '23505') { // unique_violation
        throw new PermissionServiceError(
          `Permission already exists: ${resource}:${action}`,
          'DUPLICATE_PERMISSION'
        );
      }
      throw new PermissionServiceError(`Failed to create permission: ${err.message}`, 'CREATE_ERROR');
    }
  }

  /** Batch create permissions */
  async batchCreatePermissions(
    permissions: { resource: string; action: string; description?: string }[]
  ): Promise<Permission[]> {
    return this.repository.createBatch(permissions);
  }

  /** Delete a permission */
  async deletePermission(id: string): Promise<boolean> {
    return this.repository.delete(id);
  }

  /** Seed common permissions for the Orion platform */
  async seedCommonPermissions(): Promise<{ created: number; skipped: number }> {
    const commonPermissions = [
      // Pipeline
      { resource: 'pipeline', action: 'read', description: '查看流水线' },
      { resource: 'pipeline', action: 'write', description: '编辑流水线' },
      { resource: 'pipeline', action: 'execute', description: '执行流水线' },
      { resource: 'pipeline', action: 'delete', description: '删除流水线' },
      // Deployment
      { resource: 'deployment', action: 'read', description: '查看部署' },
      { resource: 'deployment', action: 'write', description: '编辑部署' },
      { resource: 'deployment', action: 'execute', description: '执行部署' },
      { resource: 'deployment', action: 'delete', description: '删除部署' },
      // Monitoring
      { resource: 'monitoring', action: 'read', description: '查看监控' },
      { resource: 'monitoring', action: 'write', description: '编辑监控' },
      // Alert
      { resource: 'alert', action: 'read', description: '查看告警' },
      { resource: 'alert', action: 'write', description: '编辑告警' },
      { resource: 'alert', action: 'acknowledge', description: '确认告警' },
      // Config
      { resource: 'config', action: 'read', description: '查看配置' },
      { resource: 'config', action: 'write', description: '编辑配置' },
      // Tenant
      { resource: 'tenant', action: 'read', description: '查看租户' },
      { resource: 'tenant', action: 'write', description: '编辑租户' },
      // User
      { resource: 'user', action: 'read', description: '查看用户' },
      { resource: 'user', action: 'write', description: '编辑用户' },
      { resource: 'user', action: 'delete', description: '删除用户' },
      // Role
      { resource: 'role', action: 'read', description: '查看角色' },
      { resource: 'role', action: 'write', description: '编辑角色' },
      { resource: 'role', action: 'delete', description: '删除角色' },
      // FinOps
      { resource: 'finops', action: 'read', description: '查看成本' },
      { resource: 'finops', action: 'write', description: '编辑成本' },
      // Artifact
      { resource: 'artifact', action: 'read', description: '查看制品' },
      { resource: 'artifact', action: 'write', description: '编辑制品' },
      { resource: 'artifact', action: 'delete', description: '删除制品' },
      // CMDB
      { resource: 'cmdb', action: 'read', description: '查看CMDB' },
      { resource: 'cmdb', action: 'write', description: '编辑CMDB' },
      // Audit
      { resource: 'audit', action: 'read', description: '查看审计' },
      // AI
      { resource: 'ai', action: 'use', description: '使用AI' },
      { resource: 'ai', action: 'manage', description: '管理AI' },
      // API Key
      { resource: 'api_key', action: 'read', description: '查看API Key' },
      { resource: 'api_key', action: 'write', description: '编辑API Key' },
      { resource: 'api_key', action: 'delete', description: '删除API Key' },
    ];

    const existing = await this.repository.findAll();
    const existingSet = new Set(existing.map(p => `${p.resource}:${p.action}`));

    const toCreate = commonPermissions.filter(
      p => !existingSet.has(`${p.resource}:${p.action}`)
    );

    if (toCreate.length === 0) {
      return { created: 0, skipped: existing.length };
    }

    const created = await this.repository.createBatch(toCreate);
    return { created: created.length, skipped: existing.length };
  }
}
