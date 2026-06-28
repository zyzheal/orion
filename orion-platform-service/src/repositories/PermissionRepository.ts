import { BaseRepository } from '../db/base-repository';

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

export class PermissionRepository extends BaseRepository<Permission> {
  constructor(db: { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'permissions');
  }

  protected mapRowToEntity(row: any): Permission {
    return {
      id: row.id,
      resource: row.resource,
      action: row.action,
      description: row.description,
      created_at: row.created_at,
    };
  }

  /** Find a permission by resource and action */
  async findByResourceAction(resource: string, action: string): Promise<Permission | undefined> {
    const result = await this.db.query(
      'SELECT * FROM permissions WHERE resource = $1 AND action = $2',
      [resource, action],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /** List permissions grouped by resource */
  async findAllGrouped(): Promise<Record<string, Permission[]>> {
    const { entities } = await this.findAll({ limit: 10000, orderBy: 'resource' });
    const grouped: Record<string, Permission[]> = {};
    for (const perm of entities) {
      if (!grouped[perm.resource]) grouped[perm.resource] = [];
      grouped[perm.resource].push(perm);
    }
    return grouped;
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

    const result = await this.db.query(
      `INSERT INTO permissions (resource, action, description) VALUES ${values} ON CONFLICT (resource, action) DO NOTHING RETURNING *`,
      params,
    );
    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  /** Delete by resource and action */
  async deleteByResourceAction(resource: string, action: string): Promise<boolean> {
    const result = await this.db.query(
      'DELETE FROM permissions WHERE resource = $1 AND action = $2',
      [resource, action],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
