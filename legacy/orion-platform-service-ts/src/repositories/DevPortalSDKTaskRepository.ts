/**
 * DevPortalSDKTaskRepository
 * Data access layer for SDK generation tasks.
 * Replaces in-memory Map<string, SDKGenerationTask> in SDKGeneratorService.
 */

import { ErrorCode } from '../errors';
import { BaseRepository } from '../db/base-repository';
import { OrionError } from '../errors';

export interface DevPortalSDKTaskEntity {
  id: string;
  tenantId: string;
  name: string;
  apiSpec: string;
  language: string;
  packageName: string;
  version: string;
  status: string;
  output: string;
  error: string | null;
  completedAt: Date | null;
  created_at: Date;
  updated_at: Date;
}

export class DevPortalSDKTaskRepository extends BaseRepository<DevPortalSDKTaskEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'devportal_sdk_tasks');
  }

  async create(data: Omit<DevPortalSDKTaskEntity, 'created_at' | 'updated_at'> & Partial<Pick<DevPortalSDKTaskEntity, 'id'>>): Promise<DevPortalSDKTaskEntity> {
    const columns = ['id', 'tenant_id', 'name', 'api_spec', 'language', 'package_name', 'version', 'status', 'output', 'error', 'completed_at'];
    const values = [data.id, data.tenantId, data.name, data.apiSpec, data.language, data.packageName, data.version, data.status, data.output, data.error, data.completedAt];

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError('OPERATION_FAILED', ErrorCode.DATABASE_ERROR);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenant(tenantId: string, options?: { language?: string; status?: string }): Promise<DevPortalSDKTaskEntity[]> {
    let query = `SELECT * FROM ${this.tableName} WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];
    let paramIdx = 2;

    if (options?.language) {
      query += ` AND language = $${paramIdx++}`;
      params.push(options.language);
    }
    if (options?.status) {
      query += ` AND status = $${paramIdx++}`;
      params.push(options.status);
    }

    query += ` ORDER BY created_at DESC`;
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateStatus(id: string, status: string, output?: string, error?: string): Promise<DevPortalSDKTaskEntity> {
    const updates: string[] = ['status = $1', 'updated_at = NOW()'];
    const params: unknown[] = [status];
    let paramIdx = 2;

    if (output !== undefined) {
      updates.push(`output = $${paramIdx++}`);
      params.push(output);
    }
    if (error !== undefined) {
      updates.push(`error = $${paramIdx++}`);
      params.push(error);
    }
    if (status === 'completed' || status === 'failed') {
      updates.push('completed_at = NOW()');
    }

    params.push(id);
    const result = await this.db.query(
      `UPDATE ${this.tableName} SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      params,
    );
    if (result.rows.length === 0) {
      throw new OrionError('OPERATION_FAILED', ErrorCode.NOT_FOUND);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): DevPortalSDKTaskEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      apiSpec: row.api_spec,
      language: row.language,
      packageName: row.package_name,
      version: row.version,
      status: row.status,
      output: row.output ?? '',
      error: row.error,
      completedAt: row.completed_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
