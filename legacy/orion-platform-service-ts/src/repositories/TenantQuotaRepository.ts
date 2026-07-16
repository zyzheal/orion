import { BaseRepository } from '../db/base-repository';

export interface TenantQuotaEntity {
  id: string;
  tenantId: string;
  maxPipelines: number;
  maxPipelineRunsPerDay: number;
  maxConcurrentBuilds: number;
  maxTasksPerPipeline: number;
  maxRunners: number;
  maxCpuCores: number;
  maxMemoryGb: number;
  maxStorageMb: number;
  maxProjects: number;
  maxUsers: number;
  apiRateLimit: number;
  apiRateLimitWindowSeconds: number;
  usage: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export class TenantQuotaRepository extends BaseRepository<TenantQuotaEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'tenant_quotas');
  }

  protected mapRowToEntity(row: any): TenantQuotaEntity {
    return {
      id: String(row.id),
      tenantId: row.tenant_id,
      maxPipelines: row.max_pipelines ?? 10,
      maxPipelineRunsPerDay: row.max_pipeline_runs_per_day ?? 100,
      maxConcurrentBuilds: row.max_concurrent_builds ?? 5,
      maxTasksPerPipeline: row.max_tasks_per_pipeline ?? 50,
      maxRunners: row.max_runners ?? 10,
      maxCpuCores: row.max_cpu_cores ?? 8,
      maxMemoryGb: row.max_memory_gb ?? 16,
      maxStorageMb: row.max_storage_mb ?? 10240,
      maxProjects: row.max_projects ?? 5,
      maxUsers: row.max_users ?? 100,
      apiRateLimit: row.api_rate_limit ?? 1000,
      apiRateLimitWindowSeconds: row.api_rate_limit_window_seconds ?? 60,
      usage: row.usage ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findByTenantId(tenantId: string): Promise<TenantQuotaEntity | undefined> {
    const result = await this.db.query(
      'SELECT * FROM tenant_quotas WHERE tenant_id = $1',
      [tenantId]
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : undefined;
  }

  async findByTenantAndType(tenantId: string, quotaType: string): Promise<TenantQuotaEntity | undefined> {
    const result = await this.db.query(
      'SELECT * FROM tenant_quotas WHERE tenant_id = $1 AND quota_type = $2',
      [tenantId, quotaType]
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : undefined;
  }

  async incrementUsage(tenantId: string, quotaType: string, amount: number): Promise<void> {
    await this.db.query(
      'UPDATE tenant_quotas SET current_usage = current_usage + $1, updated_at = NOW() WHERE tenant_id = $2 AND quota_type = $3',
      [amount, tenantId, quotaType]
    );
  }

  async resetUsage(tenantId: string, quotaType: string): Promise<void> {
    await this.db.query(
      'UPDATE tenant_quotas SET current_usage = 0, updated_at = NOW() WHERE tenant_id = $1 AND quota_type = $2',
      [tenantId, quotaType]
    );
  }
}
