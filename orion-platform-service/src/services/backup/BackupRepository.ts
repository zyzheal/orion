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
  private pool: DatabasePool | null;
  private inMemoryJobs: Map<string, BackupJobRecord> = new Map();
  private inMemoryRestores: Map<string, BackupRestoreRecord> = new Map();

  constructor(pool?: DatabasePool) {
    this.pool = pool || null;
  }

  private isDbAvailable(): boolean {
    return this.pool !== null;
  }

  // ==================== Backup Jobs ====================

  async createJob(
    tenantId: string,
    configId: string | null,
    storagePath?: string
  ): Promise<BackupJobRecord> {
    const id = `backup-job-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date();
    const record: BackupJobRecord = {
      id,
      tenant_id: tenantId,
      config_id: configId,
      status: 'running',
      started_at: now,
      completed_at: null,
      size_bytes: 0,
      storage_path: storagePath || null,
      error_message: null,
    };

    if (!this.isDbAvailable()) {
      this.inMemoryJobs.set(id, record);
      return record;
    }

    const result = await this.pool!.query(
      `INSERT INTO backup_jobs (id, tenant_id, config_id, status, storage_path)
       VALUES ($1, $2, $3, 'running', $4) RETURNING *`,
      [id, tenantId, configId, storagePath || null]
    );
    return result.rows[0];
  }

  async findJobById(id: string): Promise<BackupJobRecord | null> {
    if (!this.isDbAvailable()) {
      return this.inMemoryJobs.get(id) || null;
    }
    const result = await this.pool!.query('SELECT * FROM backup_jobs WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findAllJobs(): Promise<BackupJobRecord[]> {
    if (!this.isDbAvailable()) {
      return Array.from(this.inMemoryJobs.values());
    }
    const result = await this.pool!.query('SELECT * FROM backup_jobs ORDER BY started_at DESC');
    return result.rows;
  }

  async findJobsByTenant(tenantId: string): Promise<BackupJobRecord[]> {
    if (!this.isDbAvailable()) {
      return Array.from(this.inMemoryJobs.values()).filter(b => b.tenant_id === tenantId);
    }
    const result = await this.pool!.query(
      'SELECT * FROM backup_jobs WHERE tenant_id = $1 ORDER BY started_at DESC',
      [tenantId]
    );
    return result.rows;
  }

  async findJobsByConfig(configId: string): Promise<BackupJobRecord[]> {
    if (!this.isDbAvailable()) {
      return Array.from(this.inMemoryJobs.values()).filter(b => b.config_id === configId);
    }
    const result = await this.pool!.query(
      'SELECT * FROM backup_jobs WHERE config_id = $1 ORDER BY started_at DESC',
      [configId]
    );
    return result.rows;
  }

  async completeJob(id: string, sizeBytes: number): Promise<BackupJobRecord | null> {
    if (!this.isDbAvailable()) {
      const job = this.inMemoryJobs.get(id);
      if (job) {
        job.status = 'completed';
        job.size_bytes = sizeBytes;
        job.completed_at = new Date();
        return job;
      }
      return null;
    }
    const result = await this.pool!.query(
      "UPDATE backup_jobs SET status = 'completed', size_bytes = $1, completed_at = NOW() WHERE id = $2 RETURNING *",
      [sizeBytes, id]
    );
    return result.rows[0] || null;
  }

  async failJob(id: string, errorMessage: string): Promise<BackupJobRecord | null> {
    if (!this.isDbAvailable()) {
      const job = this.inMemoryJobs.get(id);
      if (job) {
        job.status = 'failed';
        job.error_message = errorMessage;
        job.completed_at = new Date();
        return job;
      }
      return null;
    }
    const result = await this.pool!.query(
      "UPDATE backup_jobs SET status = 'failed', error_message = $1, completed_at = NOW() WHERE id = $2 RETURNING *",
      [errorMessage, id]
    );
    return result.rows[0] || null;
  }

  async deleteJob(id: string): Promise<boolean> {
    if (!this.isDbAvailable()) {
      return this.inMemoryJobs.delete(id);
    }
    const result = await this.pool!.query('DELETE FROM backup_jobs WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // ==================== Backup Restores ====================

  async createRestore(
    tenantId: string,
    backupJobId: string,
    requestedBy?: string
  ): Promise<BackupRestoreRecord> {
    const id = `restore-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const record: BackupRestoreRecord = {
      id,
      tenant_id: tenantId,
      backup_job_id: backupJobId,
      status: 'running',
      requested_by: requestedBy || null,
      started_at: new Date(),
      completed_at: null,
      error_message: null,
      created_at: new Date(),
    };

    if (!this.isDbAvailable()) {
      this.inMemoryRestores.set(id, record);
      return record;
    }

    const result = await this.pool!.query(
      `INSERT INTO backup_restores (id, tenant_id, backup_job_id, status, requested_by, started_at)
       VALUES ($1, $2, $3, 'running', $4, NOW()) RETURNING *`,
      [id, tenantId, backupJobId, requestedBy || null]
    );
    return result.rows[0];
  }

  async findRestoreById(id: string): Promise<BackupRestoreRecord | null> {
    if (!this.isDbAvailable()) {
      return this.inMemoryRestores.get(id) || null;
    }
    const result = await this.pool!.query('SELECT * FROM backup_restores WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findRestoresByTenant(tenantId: string): Promise<BackupRestoreRecord[]> {
    if (!this.isDbAvailable()) {
      return Array.from(this.inMemoryRestores.values()).filter(r => r.tenant_id === tenantId);
    }
    const result = await this.pool!.query(
      'SELECT * FROM backup_restores WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId]
    );
    return result.rows;
  }

  async completeRestore(id: string): Promise<BackupRestoreRecord | null> {
    if (!this.isDbAvailable()) {
      const restore = this.inMemoryRestores.get(id);
      if (restore) {
        restore.status = 'completed';
        restore.completed_at = new Date();
        return restore;
      }
      return null;
    }
    const result = await this.pool!.query(
      "UPDATE backup_restores SET status = 'completed', completed_at = NOW() WHERE id = $2 RETURNING *",
      [id]
    );
    return result.rows[0] || null;
  }

  async failRestore(id: string, errorMessage: string): Promise<BackupRestoreRecord | null> {
    if (!this.isDbAvailable()) {
      const restore = this.inMemoryRestores.get(id);
      if (restore) {
        restore.status = 'failed';
        restore.error_message = errorMessage;
        restore.completed_at = new Date();
        return restore;
      }
      return null;
    }
    const result = await this.pool!.query(
      "UPDATE backup_restores SET status = 'failed', error_message = $1, completed_at = NOW() WHERE id = $2 RETURNING *",
      [errorMessage, id]
    );
    return result.rows[0] || null;
  }
}
