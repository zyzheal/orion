/**
 * DigitalTwinSnapshotRepository - PostgreSQL Repository for Digital Twin Snapshots
 *
 * Stores digital twin configuration snapshots for DigitalTwinService.
 */

import { BaseRepository } from '../db/base-repository';
import { OrionError, ErrorCode } from '../../errors';

// ==================== Entity Interfaces ====================

export interface DigitalTwinSnapshotEntity {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  status: 'active' | 'archived' | 'deleted';
  createdBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSnapshotInput {
  tenant_id: string;
  name: string;
  description?: string;
  config: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  status?: string;
  created_by?: string;
}

// ==================== Repository Class ====================

export class DigitalTwinSnapshotRepository extends BaseRepository<DigitalTwinSnapshotEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'digital_twin_snapshots');
  }

  async findByTenant(tenantId: string, options?: { limit?: number; offset?: number }): Promise<DigitalTwinSnapshotEntity[]> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    const result = await this.db.query(
      `SELECT * FROM digital_twin_snapshots WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenantAndActive(tenantId: string): Promise<DigitalTwinSnapshotEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM digital_twin_snapshots WHERE tenant_id = $1 AND status = 'active' ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findById(id: string): Promise<DigitalTwinSnapshotEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM digital_twin_snapshots WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateStatus(id: string, status: string): Promise<DigitalTwinSnapshotEntity | null> {
    const result = await this.db.query(
      `UPDATE digital_twin_snapshots SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async createSnapshot(input: CreateSnapshotInput): Promise<DigitalTwinSnapshotEntity> {
    const result = await this.db.query(
      `INSERT INTO digital_twin_snapshots
        (tenant_id, name, description, config, metadata, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.tenant_id,
        input.name,
        input.description ?? null,
        input.config,
        input.metadata ?? {},
        input.status ?? 'active',
        input.created_by ?? null,
      ],
    );
    if (result.rows.length === 0) throw new OrionError(ErrorCode.OPERATION_FAILED, 'INSERT returned no rows');
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): DigitalTwinSnapshotEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      config: row.config ?? {},
      metadata: row.metadata ?? {},
      status: row.status ?? 'active',
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export default DigitalTwinSnapshotRepository;