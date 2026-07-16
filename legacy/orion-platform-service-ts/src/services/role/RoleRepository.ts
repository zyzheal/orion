import { DatabasePool } from '../database';
/**
 * RoleRepository - Database layer for Role operations
 */

export interface Role {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
}

export class RoleRepository {
  constructor(private pool: DatabasePool) {}

  async findById(id: string): Promise<Role | null> {
    return (await this.pool.query('SELECT * FROM roles WHERE id = $1', [id])).rows[0] || null;
  }

  async findAll(tenantId: string): Promise<Role[]> {
    return (await this.pool.query('SELECT * FROM roles WHERE tenant_id = $1', [tenantId])).rows;
  }

  async create(tenantId: string, name: string, _description?: string): Promise<Role> {
    const result = await this.pool.query(
      'INSERT INTO roles (tenant_id, name, description) VALUES ($1, $2, $3) RETURNING *',
      [tenantId, name, _description || null]
    );
    return result.rows[0];
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM roles WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  async findByName(name: string): Promise<Role | null> {
    return (await this.pool.query('SELECT * FROM roles WHERE name = $1', [name])).rows[0] || null;
  }

  async update(id: string, input: { name?: string; description?: string }): Promise<Role | null> {
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (input.name !== undefined) { updates.push(`name = $${idx++}`); params.push(input.name); }
    if (input.description !== undefined) { updates.push(`description = $${idx++}`); params.push(input.description); }
    if (updates.length === 0) return this.findById(id);
    updates.push(`updated_at = NOW()`);
    params.push(id);
    const result = await this.pool.query(
      `UPDATE roles SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  /** Find a specific role_permission mapping (for seed) */
  async findRolePermission(roleId: string, resource: string, action: string): Promise<{ id: string } | null> {
    const result = await this.pool.query(
      `SELECT rp.id FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = $1 AND p.resource = $2 AND p.action = $3`,
      [roleId, resource, action]
    );
    return result.rows[0] || null;
  }

  /** Add a role_permission mapping */
  async addRolePermission(roleId: string, resource: string, action: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO role_permissions (role_id, permission_id)
       SELECT $1, id FROM permissions WHERE resource = $2 AND action = $3
       ON CONFLICT DO NOTHING`,
      [roleId, resource, action]
    );
  }

  /** Find all permissions for a list of role names (via role_permissions join) */
  async findPermissionsByRoleNames(roleNames: string[]): Promise<{ resource: string; action: string }[]> {
    if (roleNames.length === 0) return [];
    const result = await this.pool.query(
      `SELECT DISTINCT p.resource, p.action FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       JOIN roles r ON r.id = rp.role_id
       WHERE r.name = ANY($1)`,
      [roleNames]
    );
    return result.rows;
  }

  /** Find roles for a user */
  async findUserRoles(userId: string, tenantId: string): Promise<{ name: string }[]> {
    const result = await this.pool.query(
      `SELECT r.name FROM roles r
       JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = $1 AND ur.tenant_id = $2`,
      [userId, tenantId]
    );
    return result.rows;
  }
}
