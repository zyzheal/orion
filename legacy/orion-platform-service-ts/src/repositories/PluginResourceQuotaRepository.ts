/**
 * PluginResourceQuotaRepository
 * Plugin resource quota data access layer
 */

import { BaseRepository } from '../db/base-repository';

export interface PluginResourceQuotaEntity {
  id: string;
  scope: string;  // 'plugin' or 'tenant'
  scopeId: string;
  cpuCores: number;
  memoryBytes: number;
  timeoutMs: number;
  maxConcurrent: number;
  createdAt: Date;
  updatedAt: Date;
}

export class PluginResourceQuotaRepository extends BaseRepository<PluginResourceQuotaEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'plugin_resource_quotas');
  }

  async findByScopeAndId(scope: string, scopeId: string): Promise<PluginResourceQuotaEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM plugin_resource_quotas WHERE scope = $1 AND scope_id = $2`,
      [scope, scopeId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByPluginId(pluginId: string): Promise<PluginResourceQuotaEntity | undefined> {
    return this.findByScopeAndId('plugin', pluginId);
  }

  async findByTenantId(tenantId: string): Promise<PluginResourceQuotaEntity | undefined> {
    return this.findByScopeAndId('tenant', tenantId);
  }

  async upsertQuota(scope: string, scopeId: string, quota: {
    cpuCores: number;
    memoryBytes: number;
    timeoutMs: number;
    maxConcurrent: number;
  }): Promise<PluginResourceQuotaEntity> {
    const result = await this.db.query(
      `INSERT INTO plugin_resource_quotas (scope, scope_id, cpu_cores, memory_bytes, timeout_ms, max_concurrent)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (scope, scope_id) DO UPDATE SET
         cpu_cores = EXCLUDED.cpu_cores,
         memory_bytes = EXCLUDED.memory_bytes,
         timeout_ms = EXCLUDED.timeout_ms,
         max_concurrent = EXCLUDED.max_concurrent,
         updated_at = NOW()
       RETURNING *`,
      [scope, scopeId, quota.cpuCores, quota.memoryBytes, quota.timeoutMs, quota.maxConcurrent],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByScope(scope: string): Promise<PluginResourceQuotaEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM plugin_resource_quotas WHERE scope = $1 ORDER BY created_at DESC`,
      [scope],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): PluginResourceQuotaEntity {
    return {
      id: row.id,
      scope: row.scope,
      scopeId: row.scope_id,
      cpuCores: row.cpu_cores ?? 2,
      memoryBytes: row.memory_bytes ?? 4294967296,
      timeoutMs: row.timeout_ms ?? 120000,
      maxConcurrent: row.max_concurrent ?? 10,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
