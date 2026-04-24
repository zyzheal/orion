/**
 * TenantQuotaRepository
 * 租户配额数据访问层
 */

import { BaseRepository } from '../db/base-repository';

export interface TenantQuotaEntity {
  id: string;
  tenantId: string;
  maxUsers: number;
  maxProjects: number;
  maxPipelines: number;
  maxStorageMb: number;
  maxApiCallsPerHour: number;
  maxConcurrentBuilds: number;
  usage: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

export class TenantQuotaRepository extends BaseRepository<TenantQuotaEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'tenant_quotas');
  }

  async findByTenantId(tenantId: string): Promise<TenantQuotaEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM tenant_quotas WHERE tenant_id = $1`,
      [tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateUsage(id: string, usage: Record<string, number>): Promise<void> {
    await this.db.query(
      `UPDATE tenant_quotas SET usage = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(usage), id],
    );
  }

  protected mapRowToEntity(row: any): TenantQuotaEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      maxUsers: row.max_users ?? 100,
      maxProjects: row.max_projects ?? 50,
      maxPipelines: row.max_pipelines ?? 200,
      maxStorageMb: row.max_storage_mb ?? 10240,
      maxApiCallsPerHour: row.max_api_calls_per_hour ?? 10000,
      maxConcurrentBuilds: row.max_concurrent_builds ?? 10,
      usage: row.usage ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}