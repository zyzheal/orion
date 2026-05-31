/**
 * ApkUploadRepository
 * Data access layer for APK upload records.
 * Replaces in-memory Map<string, ApkUploadRecord> in ApkUploadHistoryService.
 */

import { BaseRepository } from '../db/base-repository';
import { OrionError } from '../errors';

export interface ApkUploadEntity {
  id: string;
  tenantId: string;
  pipelineRunId: string | null;
  pipelineId: string | null;
  pipelineName: string | null;
  market: string;
  packageName: string;
  versionName: string | null;
  versionCode: number | null;
  apkPath: string;
  status: string;
  uploadUrl: string | null;
  uploadId: string | null;
  error: string | null;
  stdout: string | null;
  stderr: string | null;
  durationMs: number | null;
  progress: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ApkUploadRepository extends BaseRepository<ApkUploadEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'pipeline_apk_uploads');
  }

  async create(data: Omit<ApkUploadEntity, 'createdAt' | 'updatedAt'> & Partial<Pick<ApkUploadEntity, 'id'>>): Promise<ApkUploadEntity> {
    const columns = ['id', 'tenant_id', 'pipeline_run_id', 'pipeline_id', 'pipeline_name', 'market', 'package_name', 'version_name', 'version_code', 'apk_path', 'status', 'upload_url', 'upload_id', 'error', 'stdout', 'stderr', 'duration_ms', 'progress'];
    const values = [data.id, data.tenantId, data.pipelineRunId, data.pipelineId, data.pipelineName, data.market, data.packageName, data.versionName, data.versionCode, data.apkPath, data.status, data.uploadUrl, data.uploadId, data.error, data.stdout, data.stderr, data.durationMs, data.progress];

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError('OPERATION_FAILED', `INSERT into ${this.tableName} returned no rows`);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenant(tenantId: string, options?: { market?: string; status?: string; limit?: number; offset?: number }): Promise<ApkUploadEntity[]> {
    let query = `SELECT * FROM ${this.tableName} WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];
    let paramIdx = 2;

    if (options?.market) {
      query += ` AND market = $${paramIdx++}`;
      params.push(options.market);
    }
    if (options?.status) {
      query += ` AND status = $${paramIdx++}`;
      params.push(options.status);
    }

    query += ` ORDER BY created_at DESC`;
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    query += ` LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenantAndId(tenantId: string, id: string): Promise<ApkUploadEntity | null> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByPipelineRun(pipelineRunId: string): Promise<ApkUploadEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE pipeline_run_id = $1 ORDER BY created_at DESC`,
      [pipelineRunId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async countByTenant(tenantId: string, filters?: { market?: string; status?: string }): Promise<number> {
    let query = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];
    let paramIdx = 2;

    if (filters?.market) {
      query += ` AND market = $${paramIdx++}`;
      params.push(filters.market);
    }
    if (filters?.status) {
      query += ` AND status = $${paramIdx++}`;
      params.push(filters.status);
    }

    const result = await this.db.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  async findRecentFailures(tenantId: string, limit: number = 10): Promise<ApkUploadEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE tenant_id = $1 AND status = 'failed' ORDER BY created_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async getStats(tenantId: string): Promise<{ total: number; published: number; failed: number; uploading: number; pending: number; submitted: number }> {
    const result = await this.db.query(
      `SELECT status, COUNT(*) as count FROM ${this.tableName} WHERE tenant_id = $1 GROUP BY status`,
      [tenantId],
    );

    const stats = { total: 0, published: 0, failed: 0, uploading: 0, pending: 0, submitted: 0 };
    for (const row of result.rows) {
      const count = parseInt(row.count, 10);
      stats.total += count;
      if (row.status in stats) {
        (stats as any)[row.status] = count;
      }
    }
    return stats;
  }

  protected mapRowToEntity(row: any): ApkUploadEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      pipelineRunId: row.pipeline_run_id,
      pipelineId: row.pipeline_id,
      pipelineName: row.pipeline_name,
      market: row.market,
      packageName: row.package_name,
      versionName: row.version_name,
      versionCode: row.version_code,
      apkPath: row.apk_path,
      status: row.status,
      uploadUrl: row.upload_url,
      uploadId: row.upload_id,
      error: row.error,
      stdout: row.stdout,
      stderr: row.stderr,
      durationMs: row.duration_ms,
      progress: row.progress,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
