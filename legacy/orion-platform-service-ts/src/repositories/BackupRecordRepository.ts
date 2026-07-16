/**
 * BackupRecordRepository - PostgreSQL persistence for backup execution records
 *
 * Complements DisasterRecoveryRepository (which handles DR plans, failover tests, backup configs).
 * This repository handles actual backup execution records created by BackupRestoreService.
 */

import { BaseRepository } from '../db/base-repository';

export interface BackupRecordEntity {
  id: string;
  tenantId: string;
  scope: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'restoring' | 'deleted';
  sizeBytes: number | null;
  filePath: string | null;
  description: string | null;
  retentionDays: number;
  expiresAt: Date | null;
  includeServices: string[];
  excludeServices: string[];
  metadata: Record<string, any>;
  errorMessage: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class BackupRecordRepository extends BaseRepository<BackupRecordEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'backup_records');
  }

  /** Find all backups for a tenant, ordered by creation date descending */
  async findByTenant(tenantId: string, options?: { limit?: number; offset?: number }): Promise<BackupRecordEntity[]> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    const result = await this.db.query(
      `SELECT * FROM backup_records WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /** Find backups by status */
  async findByStatus(status: string, tenantId?: string): Promise<BackupRecordEntity[]> {
    let query = `SELECT * FROM backup_records WHERE status = $1`;
    const params: unknown[] = [status];

    if (tenantId) {
      query += ` AND tenant_id = $2`;
      params.push(tenantId);
    }

    query += ` ORDER BY created_at DESC`;
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /** Update backup status and optional fields */
  async updateStatus(
    id: string,
    status: string,
    extras?: {
      sizeBytes?: number;
      filePath?: string;
      completedAt?: Date;
      errorMessage?: string;
    },
  ): Promise<BackupRecordEntity | undefined> {
    const setClauses: string[] = ['status = $1', 'updated_at = NOW()'];
    const values: unknown[] = [status];
    let paramIndex = 2;

    if (extras?.sizeBytes !== undefined) {
      setClauses.push(`size_bytes = $${paramIndex++}`);
      values.push(extras.sizeBytes);
    }
    if (extras?.filePath !== undefined) {
      setClauses.push(`file_path = $${paramIndex++}`);
      values.push(extras.filePath);
    }
    if (extras?.completedAt !== undefined) {
      setClauses.push(`completed_at = $${paramIndex++}`);
      values.push(extras.completedAt);
    }
    if (extras?.errorMessage !== undefined) {
      setClauses.push(`error_message = $${paramIndex++}`);
      values.push(extras.errorMessage);
    }

    values.push(id);

    const result = await this.db.query(
      `UPDATE backup_records SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /** Find expired backups for cleanup */
  async findExpired(): Promise<BackupRecordEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM backup_records WHERE expires_at < NOW() AND status = 'completed' ORDER BY expires_at ASC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): BackupRecordEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      scope: row.scope,
      status: row.status,
      sizeBytes: row.size_bytes != null ? Number(row.size_bytes) : null,
      filePath: row.file_path,
      description: row.description,
      retentionDays: row.retention_days,
      expiresAt: row.expires_at ? new Date(row.expires_at) : null,
      includeServices: row.include_services ?? [],
      excludeServices: row.exclude_services ?? [],
      metadata: row.metadata ?? {},
      errorMessage: row.error_message,
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
