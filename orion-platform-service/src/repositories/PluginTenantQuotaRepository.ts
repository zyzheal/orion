/**
 * PluginTenantQuotaRepository
 * Plugin tenant resource quota data access layer
 */

import { BaseRepository } from '../db/base-repository';

export interface PluginTenantQuotaEntity {
  id: string;
  tenantId: string;
  cpuCores: number;
  memoryBytes: number;
  timeoutMs: number;
  maxConcurrent: number;
  createdAt: Date;
  updatedAt: Date;
}

export class PluginTenantQuotaRepository extends BaseRepository<PluginTenantQuotaEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'plugin_tenant_quotas');
  }

  async findByTenantId(tenantId: string): Promise<PluginTenantQuotaEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM plugin_tenant_quotas WHERE tenant_id = $1`,
      [tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async upsertQuota(tenantId: string, quota: {
    cpuCores: number;
    memoryBytes: number;
    timeoutMs: number;
    maxConcurrent: number;
  }): Promise<PluginTenantQuotaEntity> {
    const id = `tenant-quota-${tenantId}`;
    const result = await this.db.query(
      `INSERT INTO plugin_tenant_quotas (id, tenant_id, cpu_cores, memory_bytes, timeout_ms, max_concurrent)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id) DO UPDATE SET
         cpu_cores = EXCLUDED.cpu_cores,
         memory_bytes = EXCLUDED.memory_bytes,
         timeout_ms = EXCLUDED.timeout_ms,
         max_concurrent = EXCLUDED.max_concurrent,
         updated_at = NOW()
       RETURNING *`,
      [id, tenantId, quota.cpuCores, quota.memoryBytes, quota.timeoutMs, quota.maxConcurrent],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteByTenantId(tenantId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM plugin_tenant_quotas WHERE tenant_id = $1`,
      [tenantId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async findAllQuotas(): Promise<PluginTenantQuotaEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM plugin_tenant_quotas ORDER BY created_at DESC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): PluginTenantQuotaEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      cpuCores: row.cpu_cores ?? 2,
      memoryBytes: row.memory_bytes ?? 4294967296,
      timeoutMs: row.timeout_ms ?? 120000,
      maxConcurrent: row.max_concurrent ?? 10,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
