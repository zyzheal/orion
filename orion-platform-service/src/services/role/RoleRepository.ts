import { DatabasePool } from '../database';
/**
 * RoleRepository - Database layer for Role operations
 */

export interface Role {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  permissions: string[];
}

export class RoleRepository {
  constructor(private pool: DatabasePool) {}

  async findById(id: string): Promise<Role | null> {
    return (await this.pool.query('SELECT * FROM roles WHERE id = $1', [id])).rows[0] || null;
  }

  async findAll(tenantId: string): Promise<Role[]> {
    return (await this.pool.query('SELECT * FROM roles WHERE tenant_id = $1', [tenantId])).rows;
  }

  async create(tenantId: string, name: string, permissions: string[]): Promise<Role> {
    const result = await this.pool.query(
      'INSERT INTO roles (tenant_id, name, permissions) VALUES ($1, $2, $3) RETURNING *',
      [tenantId, name, permissions]
    );
    return result.rows[0];
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM roles WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  async update(id: string, input: { name?: string; description?: string; permissions?: string[] }): Promise<Role | null> {
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (input.name !== undefined) { updates.push(`name = $${idx++}`); params.push(input.name); }
    if (input.description !== undefined) { updates.push(`description = $${idx++}`); params.push(input.description); }
    if (input.permissions !== undefined) { updates.push(`permissions = $${idx++}`); params.push(input.permissions); }
    if (updates.length === 0) return this.findById(id);
    updates.push(`updated_at = NOW()`);
    params.push(id);
    const result = await this.pool.query(
      `UPDATE roles SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }
}