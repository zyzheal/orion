/**
 * FederationAdvancedRepository - PostgreSQL persistence for federation advanced features
 *
 * Persists scheduling policies, cross-cluster jobs, and resource pools.
 * Writes are fire-and-forget; reads try DB first then fall back to memory.
 */

import { BaseRepository } from '../db/base-repository';

export interface SchedulingPolicyEntity {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  strategy: string;
  rules: Record<string, unknown>;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrossClusterJobEntity {
  id: string;
  tenantId: string;
  name: string;
  spec: Record<string, unknown>;
  targetClusters: string[];
  status: string;
  scheduledAt: Date;
  completedAt: Date | null;
  createdAt: Date;
}

export interface ResourcePoolEntity {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  clusterId: string;
  cpu: number;
  memory: number;
  usedCpu: number;
  usedMemory: number;
  status: string;
  createdAt: Date;
}

export class FederationAdvancedRepository extends BaseRepository<SchedulingPolicyEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'federation_scheduling_policies');
  }

  // ========== Scheduling Policies ==========

  async savePolicy(policy: Omit<SchedulingPolicyEntity, 'createdAt' | 'updatedAt'>): Promise<void> {
    await this.db.query(
      `INSERT INTO federation_scheduling_policies (id, tenant_id, name, description, strategy, rules, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status, rules = EXCLUDED.rules`,
      [policy.id, policy.tenantId, policy.name, policy.description, policy.strategy, JSON.stringify(policy.rules), policy.status],
    );
  }

  async findPoliciesByTenant(tenantId: string): Promise<SchedulingPolicyEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM federation_scheduling_policies WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(r => this.mapPolicyRow(r));
  }

  // ========== Cross-Cluster Jobs ==========

  async saveJob(job: Omit<CrossClusterJobEntity, 'createdAt'>): Promise<void> {
    await this.db.query(
      `INSERT INTO federation_cross_cluster_jobs (id, tenant_id, name, spec, target_clusters, status, scheduled_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, completed_at = EXCLUDED.completed_at`,
      [job.id, job.tenantId, job.name, JSON.stringify(job.spec), job.targetClusters, job.status, job.scheduledAt, job.completedAt],
    );
  }

  async findJobsByTenant(tenantId: string): Promise<CrossClusterJobEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM federation_cross_cluster_jobs WHERE tenant_id = $1 ORDER BY scheduled_at DESC`,
      [tenantId],
    );
    return result.rows.map(r => this.mapJobRow(r));
  }

  // ========== Resource Pools ==========

  async savePool(pool: Omit<ResourcePoolEntity, 'createdAt'>): Promise<void> {
    await this.db.query(
      `INSERT INTO federation_resource_pools (id, tenant_id, name, description, cluster_id, cpu, memory, used_cpu, used_memory, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET used_cpu = EXCLUDED.used_cpu, used_memory = EXCLUDED.used_memory, status = EXCLUDED.status`,
      [pool.id, pool.tenantId, pool.name, pool.description, pool.clusterId, pool.cpu, pool.memory, pool.usedCpu, pool.usedMemory, pool.status],
    );
  }

  async findPoolById(poolId: string): Promise<ResourcePoolEntity | null> {
    const result = await this.db.query(
      `SELECT * FROM federation_resource_pools WHERE id = $1`,
      [poolId],
    );
    return result.rows.length > 0 ? this.mapPoolRow(result.rows[0]) : null;
  }

  async findPoolsByTenant(tenantId: string): Promise<ResourcePoolEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM federation_resource_pools WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(r => this.mapPoolRow(r));
  }

  // ========== Row Mappers ==========

  private mapPolicyRow(row: any): SchedulingPolicyEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      strategy: row.strategy,
      rules: typeof row.rules === 'string' ? JSON.parse(row.rules) : (row.rules || {}),
      status: row.status,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }

  private mapJobRow(row: any): CrossClusterJobEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      spec: typeof row.spec === 'string' ? JSON.parse(row.spec) : (row.spec || {}),
      targetClusters: row.target_clusters || [],
      status: row.status,
      scheduledAt: row.scheduled_at ? new Date(row.scheduled_at) : new Date(),
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  private mapPoolRow(row: any): ResourcePoolEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      clusterId: row.cluster_id,
      cpu: Number(row.cpu) || 0,
      memory: Number(row.memory) || 0,
      usedCpu: Number(row.used_cpu) || 0,
      usedMemory: Number(row.used_memory) || 0,
      status: row.status,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  protected mapRowToEntity(row: any): SchedulingPolicyEntity {
    return this.mapPolicyRow(row);
  }
}
