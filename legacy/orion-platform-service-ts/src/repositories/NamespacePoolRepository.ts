/**
 * NamespacePoolRepository
 * 命名空间资源池数据访问层
 */

import { BaseRepository } from '../db/base-repository';

export interface NamespacePoolEntity {
  id: string;
  tenantId: string;
  name: string;
  namespace: string;
  resourceType: string;
  capacity: Record<string, any>;
  used: Record<string, any>;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export class NamespacePoolRepository extends BaseRepository<NamespacePoolEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'namespace_pools');
  }

  async findByTenant(tenantId: string): Promise<NamespacePoolEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM namespace_pools WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByNamespace(namespace: string): Promise<NamespacePoolEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM namespace_pools WHERE namespace = $1`,
      [namespace],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateUsage(id: string, used: Record<string, any>): Promise<void> {
    await this.db.query(
      `UPDATE namespace_pools SET used = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(used), id],
    );
  }

  protected mapRowToEntity(row: any): NamespacePoolEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      namespace: row.namespace,
      resourceType: row.resource_type,
      capacity: row.capacity ?? {},
      used: row.used ?? { cpu: 0, memory: 0 },
      status: row.status ?? 'active',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}