import { DatabasePool } from '../services/database';

/**
 * PermissionRepository - Database layer for Permission operations
 *
 * Manages the `permissions` table which stores all available resource:action
 * permission strings in the Orion platform.
 */

export interface Permission {
  id: string;
  resource: string;
  action: string;
  description: string | null;
  created_at: Date;
}

export class PermissionRepository {
  constructor(private pool: DatabasePool) {}

  /** Find a permission by ID */
  async findById(id: string): Promise<Permission | null> {
    return (await this.pool.query('SELECT * FROM permissions WHERE id = $1', [id])).rows[0] || null;
  }

  /** Find a permission by resource and action */
  async findByResourceAction(resource: string, action: string): Promise<Permission | null> {
    return (await this.pool.query(
      'SELECT * FROM permissions WHERE resource = $1 AND action = $2',
      [resource, action]
    )).rows[0] || null;
  }

  /** List all permissions */
  async findAll(): Promise<Permission[]> {
    return (await this.pool.query('SELECT * FROM permissions ORDER BY resource, action')).rows;
  }

  /** List permissions grouped by resource */
  async findAllGrouped(): Promise<Record<string, Permission[]>> {
    const all = await this.findAll();
    const grouped: Record<string, Permission[]> = {};
    for (const perm of all) {
      if (!grouped[perm.resource]) grouped[perm.resource] = [];
      grouped[perm.resource].push(perm);
    }
    return grouped;
  }

  /** Create a new permission */
  async create(resource: string, action: string, description?: string): Promise<Permission> {
    const result = await this.pool.query(
      'INSERT INTO permissions (resource, action, description) VALUES ($1, $2, $3) RETURNING *',
      [resource, action, description || null]
    );
    return result.rows[0];
  }

  /** Create multiple permissions in batch */
  async createBatch(permissions: { resource: string; action: string; description?: string }[]): Promise<Permission[]> {
    if (permissions.length === 0) return [];

    const values = permissions.map((_, i) => {
      const base = i * 3 + 1;
      return `($${base}, $${base + 1}, $${base + 2})`;
    }).join(', ');

    const params: unknown[] = [];
    for (const p of permissions) {
      params.push(p.resource, p.action, p.description ?? null);
    }

    const result = await this.pool.query(
      `INSERT INTO permissions (resource, action, description) VALUES ${values} ON CONFLICT (resource, action) DO NOTHING RETURNING *`,
      params
    );
    return result.rows;
  }

  /** Delete a permission */
  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM permissions WHERE id = $1', [id]);
    return result.rowCount != null && result.rowCount > 0;
  }

  /** Delete by resource and action */
  async deleteByResourceAction(resource: string, action: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM permissions WHERE resource = $1 AND action = $2',
      [resource, action]
    );
    return result.rowCount != null && result.rowCount > 0;
  }
}
