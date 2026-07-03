/**
 * FederationAdvancedRepository - PostgreSQL persistence for federation advanced features
 *
 * Persistence contract:
 * - All writes are awaited (write-through); the service updates its in-memory cache
 *   only after the DB write succeeds, guaranteeing read-after-write consistency.
 * - Reads try DB first, fall back to in-memory Map on DB failure.
 * - Version columns are incremented on every write; optimistic locking prevents
 *   silent lost-update conflicts.
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
  version: number;
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
  version: number;
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
  version: number;
  createdAt: Date;
}

export interface CreateAuditLogInput {
  tenantId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  actor?: string;
  changes?: Record<string, unknown>;
  prevState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
}

export class OptimisticLockError extends Error {
  constructor(
    public readonly resourceType: string,
    public readonly resourceId: string,
    public readonly expectedVersion: number,
  ) {
    super(
      `Optimistic lock conflict on ${resourceType} ${resourceId}: expected version ${expectedVersion}`,
    );
    this.name = 'OptimisticLockError';
  }
}

export class FederationAdvancedRepository extends BaseRepository<SchedulingPolicyEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'federation_scheduling_policies');
  }

  // ========== Scheduling Policies ==========

  async savePolicy(policy: Omit<SchedulingPolicyEntity, 'createdAt' | 'updatedAt'>, expectedVersion?: number): Promise<SchedulingPolicyEntity> {
    let sql: string;
    let params: unknown[];

    if (expectedVersion !== undefined) {
      // Optimistic lock: only update if version matches
      sql = `INSERT INTO federation_scheduling_policies
              (id, tenant_id, name, description, strategy, rules, status, version, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
             ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name,
               description = EXCLUDED.description,
               strategy = EXCLUDED.strategy,
               rules = EXCLUDED.rules,
               status = EXCLUDED.status,
               version = federation_scheduling_policies.version + 1,
               updated_at = now()
             WHERE federation_scheduling_policies.version = $9
             RETURNING *`;
      params = [
        policy.id,
        policy.tenantId,
        policy.name,
        policy.description,
        policy.strategy,
        JSON.stringify(policy.rules),
        policy.status,
        expectedVersion + 1,
        expectedVersion,
      ];
    } else {
      // Fresh insert (no version check)
      sql = `INSERT INTO federation_scheduling_policies
              (id, tenant_id, name, description, strategy, rules, status, version, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 1, now())
             ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name,
               description = EXCLUDED.description,
               strategy = EXCLUDED.strategy,
               rules = EXCLUDED.rules,
               status = EXCLUDED.status,
               version = federation_scheduling_policies.version + 1,
               updated_at = now()
             RETURNING *`;
      params = [
        policy.id,
        policy.tenantId,
        policy.name,
        policy.description,
        policy.strategy,
        JSON.stringify(policy.rules),
        policy.status,
      ];
    }

    const result = await this.db.query(sql, params);
    if (result.rows.length === 0 || result.rowCount === 0) {
      throw new OptimisticLockError('SchedulingPolicy', policy.id, expectedVersion ?? 1);
    }
    return this.mapPolicyRow(result.rows[0]);
  }

  async findPoliciesByTenant(tenantId: string): Promise<SchedulingPolicyEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM federation_scheduling_policies WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(r => this.mapPolicyRow(r));
  }

  // ========== Cross-Cluster Jobs ==========

  async saveJob(job: Omit<CrossClusterJobEntity, 'createdAt'>, expectedVersion?: number): Promise<CrossClusterJobEntity> {
    let sql: string;
    let params: unknown[];

    if (expectedVersion !== undefined) {
      sql = `INSERT INTO federation_cross_cluster_jobs
              (id, tenant_id, name, spec, target_clusters, status, scheduled_at, completed_at, version)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (id) DO UPDATE SET
               status = EXCLUDED.status,
               completed_at = EXCLUDED.completed_at,
               version = federation_cross_cluster_jobs.version + 1,
               scheduled_at = EXCLUDED.scheduled_at
             WHERE federation_cross_cluster_jobs.version = $10
             RETURNING *`;
      params = [
        job.id,
        job.tenantId,
        job.name,
        JSON.stringify(job.spec),
        job.targetClusters,
        job.status,
        job.scheduledAt,
        job.completedAt,
        expectedVersion + 1,
        expectedVersion,
      ];
    } else {
      sql = `INSERT INTO federation_cross_cluster_jobs
              (id, tenant_id, name, spec, target_clusters, status, scheduled_at, completed_at, version)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
             ON CONFLICT (id) DO UPDATE SET
               status = EXCLUDED.status,
               completed_at = EXCLUDED.completed_at,
               version = federation_cross_cluster_jobs.version + 1,
               scheduled_at = EXCLUDED.scheduled_at
             RETURNING *`;
      params = [
        job.id,
        job.tenantId,
        job.name,
        JSON.stringify(job.spec),
        job.targetClusters,
        job.status,
        job.scheduledAt,
        job.completedAt,
      ];
    }

    const result = await this.db.query(sql, params);
    if (result.rows.length === 0 || result.rowCount === 0) {
      throw new OptimisticLockError('CrossClusterJob', job.id, expectedVersion ?? 1);
    }
    return this.mapJobRow(result.rows[0]);
  }

  async findJobsByTenant(tenantId: string): Promise<CrossClusterJobEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM federation_cross_cluster_jobs WHERE tenant_id = $1 ORDER BY scheduled_at DESC`,
      [tenantId],
    );
    return result.rows.map(r => this.mapJobRow(r));
  }

  // ========== Resource Pools ==========

  async savePool(pool: Omit<ResourcePoolEntity, 'createdAt'>, expectedVersion?: number): Promise<ResourcePoolEntity> {
    let sql: string;
    let params: unknown[];

    if (expectedVersion !== undefined) {
      sql = `INSERT INTO federation_resource_pools
              (id, tenant_id, name, description, cluster_id, cpu, memory, used_cpu, used_memory, status, version)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name,
               description = EXCLUDED.description,
               used_cpu = EXCLUDED.used_cpu,
               used_memory = EXCLUDED.used_memory,
               status = EXCLUDED.status,
               version = federation_resource_pools.version + 1
             WHERE federation_resource_pools.version = $12
             RETURNING *`;
      params = [
        pool.id,
        pool.tenantId,
        pool.name,
        pool.description,
        pool.clusterId,
        pool.cpu,
        pool.memory,
        pool.usedCpu,
        pool.usedMemory,
        pool.status,
        expectedVersion + 1,
        expectedVersion,
      ];
    } else {
      sql = `INSERT INTO federation_resource_pools
              (id, tenant_id, name, description, cluster_id, cpu, memory, used_cpu, used_memory, status, version)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1)
             ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name,
               description = EXCLUDED.description,
               used_cpu = EXCLUDED.used_cpu,
               used_memory = EXCLUDED.used_memory,
               status = EXCLUDED.status,
               version = federation_resource_pools.version + 1
             RETURNING *`;
      params = [
        pool.id,
        pool.tenantId,
        pool.name,
        pool.description,
        pool.clusterId,
        pool.cpu,
        pool.memory,
        pool.usedCpu,
        pool.usedMemory,
        pool.status,
      ];
    }

    const result = await this.db.query(sql, params);
    if (result.rows.length === 0 || result.rowCount === 0) {
      throw new OptimisticLockError('ResourcePool', pool.id, expectedVersion ?? 1);
    }
    return this.mapPoolRow(result.rows[0]);
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

  // ========== Consistency Verification ==========

  /**
   * Compares in-memory state with DB state and returns a report of divergences.
   * Returns an array of { id, type, memoryValue, dbValue } for each divergence found.
   * DB is treated as the authoritative source.
   */
  async verifyConsistency(
    memoryPolicies: Map<string, SchedulingPolicy>,
    memoryJobs: Map<string, CrossClusterJob>,
    memoryPools: Map<string, ResourcePool>,
  ): Promise<
    Array<{ id: string; type: 'policy' | 'job' | 'pool'; memoryValue: unknown; dbValue: unknown }>
  > {
    const divergences: Array<{ id: string; type: 'policy' | 'job' | 'pool'; memoryValue: unknown; dbValue: unknown }> = [];

    // Check policies: DB is authoritative; compare all tenant policies
    const allTenantIds = new Set([...memoryPolicies.values()].map(p => p.tenantId));
    for (const tenantId of allTenantIds) {
      const dbPolicies = await this.findPoliciesByTenant(tenantId);
      for (const dbPolicy of dbPolicies) {
        const memPolicy = memoryPolicies.get(dbPolicy.id);
        if (!memPolicy) {
          divergences.push({
            id: dbPolicy.id,
            type: 'policy',
            memoryValue: null,
            dbValue: { name: dbPolicy.name, status: dbPolicy.status, updatedAt: dbPolicy.updatedAt },
          });
        } else if (
          memPolicy.name !== dbPolicy.name ||
          memPolicy.status !== dbPolicy.status ||
          memPolicy.updatedAt !== dbPolicy.updatedAt.toISOString()
        ) {
          divergences.push({
            id: dbPolicy.id,
            type: 'policy',
            memoryValue: { name: memPolicy.name, status: memPolicy.status, updatedAt: memPolicy.updatedAt },
            dbValue: { name: dbPolicy.name, status: dbPolicy.status, updatedAt: dbPolicy.updatedAt.toISOString() },
          });
        }
      }
    }

    // Check jobs
    const allJobTenantIds = new Set([...memoryJobs.values()].map(j => j.tenantId));
    for (const tenantId of allJobTenantIds) {
      const dbJobs = await this.findJobsByTenant(tenantId);
      for (const dbJob of dbJobs) {
        const memJob = memoryJobs.get(dbJob.id);
        if (!memJob) {
          divergences.push({
            id: dbJob.id,
            type: 'job',
            memoryValue: null,
            dbValue: { name: dbJob.name, status: dbJob.status },
          });
        } else if (memJob.status !== dbJob.status) {
          divergences.push({
            id: dbJob.id,
            type: 'job',
            memoryValue: { status: memJob.status },
            dbValue: { status: dbJob.status },
          });
        }
      }
    }

    // Check pools
    for (const [poolId, memPool] of memoryPools) {
      const dbPool = await this.findPoolById(poolId);
      if (!dbPool) {
        divergences.push({
          id: poolId,
          type: 'pool',
          memoryValue: { name: memPool.name, usedCpu: memPool.usedCpu, usedMemory: memPool.usedMemory },
          dbValue: null,
        });
      } else if (
        memPool.usedCpu !== dbPool.usedCpu ||
        memPool.usedMemory !== dbPool.usedMemory ||
        memPool.status !== dbPool.status
      ) {
        divergences.push({
          id: poolId,
          type: 'pool',
          memoryValue: { usedCpu: memPool.usedCpu, usedMemory: memPool.usedMemory, status: memPool.status },
          dbValue: { usedCpu: dbPool.usedCpu, usedMemory: dbPool.usedMemory, status: dbPool.status },
        });
      }
    }

    return divergences;
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
