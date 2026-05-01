/**
 * BackupRepository - Database access layer for backup job records
 *
 * Maps to the `backup_jobs` and `backup_restores` tables.
 */

import { DatabasePool } from '../database';

export interface BackupJobRecord {
  id: string;
  tenant_id: string;
  config_id: string | null;
  status: string;
  started_at: Date;
  completed_at: Date | null;
  size_bytes: number;
  storage_path: string | null;
  error_message: string | null;
}

export interface BackupRestoreRecord {
  id: string;
  tenant_id: string;
  backup_job_id: string;
  status: string;
  requested_by: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  error_message: string | null;
  created_at: Date;
}

export class BackupRepository {
  private pool: DatabasePool;

  constructor(pool: DatabasePool) {
    this.pool = pool;
  }

  // ==================== Backup Jobs ====================

  async createJob(
    tenantId: string,
    configId: string | null,
    storagePath?: string
  ): Promise<BackupJobRecord> {
    const id = `backup-job-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const result = await this.pool.query(
      `INSERT INTO backup_jobs (id, tenant_id, config_id, status, storage_path)
       VALUES ($1, $2, $3, 'running', $4) RETURNING *`,
      [id, tenantId, configId, storagePath || null]
    );
    return result.rows[0];
  }

  async findJobById(id: string): Promise<BackupJobRecord | null> {
    const result = await this.pool.query('SELECT * FROM backup_jobs WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findAllJobs(): Promise<BackupJobRecord[]> {
    const result = await this.pool.query('SELECT * FROM backup_jobs ORDER BY started_at DESC');
    return result.rows;
  }

  async findJobsByTenant(tenantId: string): Promise<BackupJobRecord[]> {
    const result = await this.pool.query(
      'SELECT * FROM backup_jobs WHERE tenant_id = $1 ORDER BY started_at DESC',
      [tenantId]
    );
    return result.rows;
  }

  async findJobsByConfig(configId: string): Promise<BackupJobRecord[]> {
    const result = await this.pool.query(
      'SELECT * FROM backup_jobs WHERE config_id = $1 ORDER BY started_at DESC',
      [configId]
    );
    return result.rows;
  }

  async completeJob(id: string, sizeBytes: number): Promise<BackupJobRecord | null> {
    const result = await this.pool.query(
      "UPDATE backup_jobs SET status = 'completed', size_bytes = $1, completed_at = NOW() WHERE id = $2 RETURNING *",
      [sizeBytes, id]
    );
    return result.rows[0] || null;
  }

  async failJob(id: string, errorMessage: string): Promise<BackupJobRecord | null> {
    const result = await this.pool.query(
      "UPDATE backup_jobs SET status = 'failed', error_message = $1, completed_at = NOW() WHERE id = $2 RETURNING *",
      [errorMessage, id]
    );
    return result.rows[0] || null;
  }

  async deleteJob(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM backup_jobs WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // ==================== Backup Restores ====================

  async createRestore(
    tenantId: string,
    backupJobId: string,
    requestedBy?: string
  ): Promise<BackupRestoreRecord> {
    const id = `restore-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const result = await this.pool.query(
      `INSERT INTO backup_restores (id, tenant_id, backup_job_id, status, requested_by, started_at)
       VALUES ($1, $2, $3, 'running', $4, NOW()) RETURNING *`,
      [id, tenantId, backupJobId, requestedBy || null]
    );
    return result.rows[0];
  }

  async findRestoreById(id: string): Promise<BackupRestoreRecord | null> {
    const result = await this.pool.query('SELECT * FROM backup_restores WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findRestoresByTenant(tenantId: string): Promise<BackupRestoreRecord[]> {
    const result = await this.pool.query(
      'SELECT * FROM backup_restores WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId]
    );
    return result.rows;
  }

  async completeRestore(id: string): Promise<BackupRestoreRecord | null> {
    const result = await this.pool.query(
      "UPDATE backup_restores SET status = 'completed', completed_at = NOW() WHERE id = $1 RETURNING *",
      [id]
    );
    return result.rows[0] || null;
  }

  async failRestore(id: string, errorMessage: string): Promise<BackupRestoreRecord | null> {
    const result = await this.pool.query(
      "UPDATE backup_restores SET status = 'failed', error_message = $1, completed_at = NOW() WHERE id = $2 RETURNING *",
      [errorMessage, id]
    );
    return result.rows[0] || null;
  }
}
