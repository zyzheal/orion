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
}