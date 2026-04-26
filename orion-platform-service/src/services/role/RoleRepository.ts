/**
 * RoleRepository - Database layer for Role operations
 */
import { DatabasePool } from '../database';

export interface Role {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  permissions: string[];
}

export class RoleRepository {
  private pool: DatabasePool;
  constructor(pool: DatabasePool) { this.pool = pool; }

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
}