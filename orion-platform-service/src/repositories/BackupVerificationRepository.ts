/**
 * BackupVerificationRepository
 * Backup verification data access layer
 */

import { BaseRepository } from '../db/base-repository';

export interface BackupVerificationEntity {
  id: string;
  backupId: string;
  status: string;
  integrityCheck: boolean;
  restoreTest: boolean;
  integrityDetails: string | null;
  restoreDetails: string | null;
  errorMessage: string | null;
  startedAt: Date;
  verifiedAt: Date | null;
  createdAt: Date;
}

export class BackupVerificationRepository extends BaseRepository<BackupVerificationEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'backup_verifications');
  }

  async findByBackupId(backupId: string): Promise<BackupVerificationEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM backup_verifications WHERE backup_id = $1 ORDER BY started_at DESC`,
      [backupId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateStatus(id: string, status: string, errorMessage?: string): Promise<BackupVerificationEntity> {
    const setFields = ['status = $2'];
    const params: any[] = [id, status];
    let paramIdx = 3;

    if (status === 'passed' || status === 'failed') {
      setFields.push('verified_at = NOW()');
    }
    if (errorMessage) {
      setFields.push(`error_message = $${paramIdx}`);
      params.push(errorMessage);
      paramIdx++;
    }

    const result = await this.db.query(
      `UPDATE backup_verifications SET ${setFields.join(', ')} WHERE id = $1 RETURNING *`,
      params,
    );
    if (result.rows.length === 0) {
      throw new Error(`Backup verification ${id} not found`);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateIntegrityCheck(id: string, passed: boolean, details?: string): Promise<void> {
    await this.db.query(
      `UPDATE backup_verifications SET integrity_check = $2, integrity_details = $3 WHERE id = $1`,
      [id, passed, details ?? null],
    );
  }

  async updateRestoreTest(id: string, passed: boolean, details?: string): Promise<void> {
    await this.db.query(
      `UPDATE backup_verifications SET restore_test = $2, restore_details = $3 WHERE id = $1`,
      [id, passed, details ?? null],
    );
  }

  protected mapRowToEntity(row: any): BackupVerificationEntity {
    return {
      id: row.id,
      backupId: row.backup_id,
      status: row.status,
      integrityCheck: row.integrity_check ?? false,
      restoreTest: row.restore_test ?? false,
      integrityDetails: row.integrity_details,
      restoreDetails: row.restore_details,
      errorMessage: row.error_message,
      startedAt: row.started_at,
      verifiedAt: row.verified_at,
      createdAt: row.created_at,
    };
  }
}
