/**
 * NamespaceAllocationRepository
 * Namespace 分配记录数据访问层
 */

import { BaseRepository } from '../db/base-repository';
import { OrionError } from '../errors';

export interface NamespaceAllocationEntity {
  id: string;
  namespaceName: string;
  clusterId: string;
  tenantId: number | null;
  status: 'available' | 'allocated' | 'reserved';
  purpose?: string;
  labels: Record<string, string>;
  allocatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class NamespaceAllocationRepository extends BaseRepository<NamespaceAllocationEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'namespace_allocations');
  }

  async findByNamespaceName(name: string): Promise<NamespaceAllocationEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM namespace_allocations WHERE namespace_name = $1`,
      [name],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findAvailable(): Promise<NamespaceAllocationEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM namespace_allocations WHERE status = 'available' ORDER BY id ASC LIMIT 1`,
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenantId(tenantId: number): Promise<NamespaceAllocationEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM namespace_allocations WHERE tenant_id = $1 AND status = 'allocated' ORDER BY allocated_at ASC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async allocate(id: string, tenantId: string | number, purpose: string, labels: Record<string, string>): Promise<NamespaceAllocationEntity> {
    // UUID strings are stored as-is; numeric IDs are stored as numbers
    const isNumeric = typeof tenantId === 'number' || (typeof tenantId === 'string' && /^\d+$/.test(tenantId));
    const tenantIdValue = isNumeric ? Number(tenantId) : null;
    const result = await this.db.query(
      `UPDATE namespace_allocations SET tenant_id = $1, status = 'allocated', purpose = $2, labels = $3, allocated_at = NOW(), updated_at = NOW() WHERE id = $4 RETURNING *`,
      [tenantIdValue, purpose, JSON.stringify(labels), id],
    );
    if (result.rows.length === 0) {
      throw new OrionError(`Failed to allocate namespace: ${id}`, 'OPERATION_FAILED')
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async release(id: string): Promise<NamespaceAllocationEntity> {
    const result = await this.db.query(
      `UPDATE namespace_allocations SET tenant_id = NULL, status = 'available', purpose = NULL, labels = labels - 'orion.io/tenant', allocated_at = NULL, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id],
    );
    if (result.rows.length === 0) {
      throw new OrionError(`Failed to release namespace: ${id}`, 'OPERATION_FAILED')
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async findAllEntries(): Promise<NamespaceAllocationEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM namespace_allocations ORDER BY id ASC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async countByStatus(status: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*) as count FROM namespace_allocations WHERE status = $1`,
      [status],
    );
    return parseInt(result.rows[0].count, 10);
  }

  async countByTenant(tenantId: number): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*) as count FROM namespace_allocations WHERE tenant_id = $1 AND status = 'allocated'`,
      [tenantId],
    );
    return parseInt(result.rows[0].count, 10);
  }

  protected mapRowToEntity(row: any): NamespaceAllocationEntity {
    return {
      id: row.id,
      namespaceName: row.namespace_name,
      clusterId: row.cluster_id,
      tenantId: row.tenant_id != null ? Number(row.tenant_id) : null,
      status: row.status as 'available' | 'allocated' | 'reserved',
      purpose: row.purpose,
      labels: row.labels ?? {},
      allocatedAt: row.allocated_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
