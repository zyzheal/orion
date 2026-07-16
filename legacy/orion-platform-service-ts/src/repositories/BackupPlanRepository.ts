/**
 * BackupPlanRepository
 * Backup plan data access layer
 */

import { NotFoundError } from '../errors';
import { BaseRepository } from '../db/base-repository';

export interface BackupPlanEntity {
  id: string;
  name: string;
  description: string | null;
  sourceType: string;
  backupType: string;
  enabled: boolean;
  schedule: Record<string, any>;
  retention: Record<string, any>;
  storageConfig: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class BackupPlanRepository extends BaseRepository<BackupPlanEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'backup_plans');
  }

  async findEnabled(): Promise<BackupPlanEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM backup_plans WHERE enabled = true ORDER BY created_at DESC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async toggleEnabled(id: string, enabled: boolean): Promise<BackupPlanEntity> {
    const result = await this.db.query(
      `UPDATE backup_plans SET enabled = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, enabled],
    );
    if (result.rows.length === 0) {
      throw new NotFoundError('BackupPlan', id);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): BackupPlanEntity {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      sourceType: row.source_type,
      backupType: row.backup_type,
      enabled: row.enabled ?? true,
      schedule: row.schedule ?? {},
      retention: row.retention ?? {},
      storageConfig: row.storage_config ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
