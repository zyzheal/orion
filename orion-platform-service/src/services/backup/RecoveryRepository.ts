/**
 * RecoveryRepository - Database access layer for recovery executions
 *
 * Maps to the `backup_restores` table and provides recovery plan tracking.
 */

import { DatabasePool } from '../database';

export interface RecoveryExecutionRecord {
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

export class RecoveryRepository {
  private pool: DatabasePool | null;
  private inMemory: Map<string, RecoveryExecutionRecord> = new Map();

  constructor(pool?: DatabasePool) {
    this.pool = pool || null;
  }

  private isDbAvailable(): boolean {
    return this.pool !== null;
  }

  async create(execution: Omit<RecoveryExecutionRecord, 'created_at'>): Promise<RecoveryExecutionRecord> {
    const record: RecoveryExecutionRecord = {
      ...execution,
      created_at: new Date(),
    };

    if (!this.isDbAvailable()) {
      this.inMemory.set(execution.id, record);
      return record;
    }

    const result = await this.pool!.query(
      `INSERT INTO backup_restores (id, tenant_id, backup_job_id, status, requested_by, started_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [execution.id, execution.tenant_id, execution.backup_job_id, execution.status, execution.requested_by, execution.started_at]
    );
    return result.rows[0];
  }

  async findById(id: string): Promise<RecoveryExecutionRecord | null> {
    if (!this.isDbAvailable()) {
      return this.inMemory.get(id) || null;
    }
    const result = await this.pool!.query('SELECT * FROM backup_restores WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findAll(tenantId?: string): Promise<RecoveryExecutionRecord[]> {
    if (!this.isDbAvailable()) {
      let records = Array.from(this.inMemory.values());
      if (tenantId) {
        records = records.filter(r => r.tenant_id === tenantId);
      }
      return records;
    }
    if (tenantId) {
      const result = await this.pool!.query(
        'SELECT * FROM backup_restores WHERE tenant_id = $1 ORDER BY created_at DESC',
        [tenantId]
      );
      return result.rows;
    }
    const result = await this.pool!.query('SELECT * FROM backup_restores ORDER BY created_at DESC');
    return result.rows;
  }

  async updateStatus(id: string, status: string, errorMessage?: string): Promise<RecoveryExecutionRecord | null> {
    if (!this.isDbAvailable()) {
      const record = this.inMemory.get(id);
      if (!record) return null;
      record.status = status;
      if (errorMessage) record.error_message = errorMessage;
      if (status === 'completed' || status === 'failed') {
        record.completed_at = new Date();
      }
      return record;
    }

    if (errorMessage) {
      const result = await this.pool!.query(
        "UPDATE backup_restores SET status = $1, error_message = $2, completed_at = NOW() WHERE id = $3 RETURNING *",
        [status, errorMessage, id]
      );
      return result.rows[0] || null;
    }
    if (status === 'completed' || status === 'failed') {
      const result = await this.pool!.query(
        "UPDATE backup_restores SET status = $1, completed_at = NOW() WHERE id = $2 RETURNING *",
        [status, id]
      );
      return result.rows[0] || null;
    }
    const result = await this.pool!.query(
      "UPDATE backup_restores SET status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );
    return result.rows[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    if (!this.isDbAvailable()) {
      return this.inMemory.delete(id);
    }
    const result = await this.pool!.query('DELETE FROM backup_restores WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
