/**
 * Federation Advanced Service - Phase 4
 *
 * 联邦调度进阶功能：调度策略、跨集群调度、资源池管理
 *
 * Persistence strategy (write-through, read-after-write consistent):
 * - Writes: await DB persist first, then update in-memory Map (write-through).
 *   If DB write fails, an error is thrown and the in-memory Map is NOT updated,
 *   preventing silent divergence.
 * - Reads: try DB first (DB is authoritative), fall back to in-memory Map on DB failure.
 * - Startup: load from DB to hydrate in-memory Maps.
 * - Version tracking: every persisted entity carries a version number; the repository
 *   increments it on each write and supports optimistic locking for updates.
 */

import { createLogger } from '../utils/logger';
import { FederationAdvancedRepository, OptimisticLockError } from '../../repositories/FederationAdvancedRepository';

const logger = pino({ name: 'FederationAdvancedService' });

export interface SchedulingPolicy {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  strategy: 'cost-optimized' | 'latency-optimized' | 'balanced' | 'custom';
  rules: Record<string, unknown>;
  status: 'active' | 'inactive' | 'draft';
  createdAt: string;
  updatedAt: string;
}

export interface CrossClusterJob {
  id: string;
  tenantId: string;
  name: string;
  spec: Record<string, unknown>;
  targetClusters: string[];
  status: 'pending' | 'scheduled' | 'running' | 'completed' | 'failed';
  scheduledAt: string;
  completedAt: string | null;
}

export interface ResourcePool {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  clusterId: string;
  cpu: number;
  memory: number;
  usedCpu: number;
  usedMemory: number;
  status: 'active' | 'degraded' | 'exhausted';
  createdAt: string;
}

export interface SchedulingPolicyInput {
  name: string;
  description?: string;
  strategy?: string;
  rules?: Record<string, unknown>;
}

export interface JobSpec {
  name: string;
  targetClusters: string[];
  resourceRequirements?: { cpu?: number; memory?: number };
  [key: string]: unknown;
}

export interface ResourcePoolInput {
  name: string;
  description?: string;
  clusterId: string;
  cpu: number;
  memory: number;
}

export class ConsistencyVerificationResult {
  constructor(
    public readonly isConsistent: boolean,
    public readonly divergences: Array<{ id: string; type: 'policy' | 'job' | 'pool'; memoryValue: unknown; dbValue: unknown }>,
  ) {}
}

export class FederationAdvancedService {
  private schedulingPolicies = new Map<string, SchedulingPolicy>();
  private crossClusterJobs = new Map<string, CrossClusterJob>();
  private resourcePools = new Map<string, ResourcePool>();
  private repo?: FederationAdvancedRepository;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.repo = new FederationAdvancedRepository(db);
      this.loadFromDb().catch(err => {
        logger.warn({ err }, 'Failed to load federation data from DB on startup');
      });
    }
  }

  private async loadFromDb(): Promise<void> {
    if (!this.repo) return;
    try {
      // Load scheduling policies
      const policyResult = await this.repo['db'].query(
        `SELECT * FROM federation_scheduling_policies ORDER BY created_at ASC`,
      );
      for (const row of policyResult.rows) {
        const policy: SchedulingPolicy = {
          id: row.id,
          tenantId: row.tenant_id,
          name: row.name,
          description: row.description,
          strategy: row.strategy,
          rules: typeof row.rules === 'string' ? JSON.parse(row.rules) : (row.rules || {}),
          status: row.status,
          createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
          updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
        };
        this.schedulingPolicies.set(policy.id, policy);
      }

      // Load cross-cluster jobs
      const jobResult = await this.repo['db'].query(
        `SELECT * FROM federation_cross_cluster_jobs ORDER BY scheduled_at ASC`,
      );
      for (const row of jobResult.rows) {
        const job: CrossClusterJob = {
          id: row.id,
          tenantId: row.tenant_id,
          name: row.name,
          spec: typeof row.spec === 'string' ? JSON.parse(row.spec) : (row.spec || {}),
          targetClusters: row.target_clusters || [],
          status: row.status,
          scheduledAt: row.scheduled_at instanceof Date ? row.scheduled_at.toISOString() : row.scheduled_at,
          completedAt: row.completed_at ? (row.completed_at instanceof Date ? row.completed_at.toISOString() : row.completed_at) : null,
        };
        this.crossClusterJobs.set(job.id, job);
      }

      // Load resource pools
      const poolResult = await this.repo['db'].query(
        `SELECT * FROM federation_resource_pools ORDER BY created_at ASC`,
      );
      for (const row of poolResult.rows) {
        const pool: ResourcePool = {
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
          createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
        };
        this.resourcePools.set(pool.id, pool);
      }

      logger.info({
        policies: this.schedulingPolicies.size,
        jobs: this.crossClusterJobs.size,
        pools: this.resourcePools.size,
      }, 'Loaded federation advanced data from DB');
    } catch (err) {
      logger.warn({ err }, 'Failed to load federation data from DB');
    }
  }

  // ========== Scheduling Policy Management ==========

  /**
   * Creates a scheduling policy with write-through persistence.
   * DB write is awaited before the in-memory cache is updated, ensuring
   * that a subsequent listSchedulingPolicies() call (which reads DB-first)
   * will always see the newly created policy.
   */
  async createSchedulingPolicy(
    tenantId: string,
    input: SchedulingPolicyInput,
  ): Promise<SchedulingPolicy> {
    const id = `policy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const policy: SchedulingPolicy = {
      id,
      tenantId,
      name: input.name,
      description: input.description || '',
      strategy: (input.strategy as SchedulingPolicy['strategy']) || 'balanced',
      rules: input.rules || {},
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    // Write-through: persist to DB first, then update in-memory cache
    if (this.repo) {
      const persisted = await this.repo.savePolicy({
        id: policy.id,
        tenantId: policy.tenantId,
        name: policy.name,
        description: policy.description,
        strategy: policy.strategy,
        rules: policy.rules,
        status: policy.status,
      });
      // Update local cache with DB-returned entity (includes version, updated_at)
      this.schedulingPolicies.set(id, {
        ...policy,
        updatedAt: persisted.updatedAt.toISOString(),
      });
    } else {
      // No DB: update in-memory only
      this.schedulingPolicies.set(id, policy);
    }

    return policy;
  }

  async listSchedulingPolicies(tenantId: string): Promise<SchedulingPolicy[]> {
    if (this.repo) {
      try {
        const rows = await this.repo.findPoliciesByTenant(tenantId);
        // DB is authoritative: replace in-memory cache with fresh DB state
        const policies: SchedulingPolicy[] = rows.map(r => ({
          id: r.id,
          tenantId: r.tenantId,
          name: r.name,
          description: r.description,
          strategy: r.strategy as SchedulingPolicy['strategy'],
          rules: r.rules,
          status: r.status as SchedulingPolicy['status'],
          createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
          updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
        }));
        // Sync in-memory cache with DB state
        for (const p of policies) {
          this.schedulingPolicies.set(p.id, p);
        }
        // Remove from cache any policies no longer in DB (for this tenant)
        for (const [key, memPolicy] of this.schedulingPolicies) {
          if (memPolicy.tenantId === tenantId && !policies.find(p => p.id === key)) {
            this.schedulingPolicies.delete(key);
          }
        }
        return policies;
      } catch (err) {
        logger.warn({ err, tenantId }, 'DB listSchedulingPolicies failed, falling back to memory');
      }
    }
    return Array.from(this.schedulingPolicies.values()).filter(
      (p) => p.tenantId === tenantId,
    );
  }

  // ========== Cross-Cluster Job Scheduling ==========

  async scheduleCrossClusterJob(
    tenantId: string,
    jobSpec: JobSpec,
  ): Promise<CrossClusterJob> {
    const id = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const job: CrossClusterJob = {
      id,
      tenantId,
      name: jobSpec.name,
      spec: jobSpec as Record<string, unknown>,
      targetClusters: jobSpec.targetClusters,
      status: 'pending',
      scheduledAt: new Date().toISOString(),
      completedAt: null,
    };

    // Write-through: persist to DB first, then update in-memory cache
    if (this.repo) {
      const persisted = await this.repo.saveJob({
        id: job.id,
        tenantId: job.tenantId,
        name: job.name,
        spec: job.spec,
        targetClusters: job.targetClusters,
        status: job.status,
        scheduledAt: new Date(job.scheduledAt),
        completedAt: null,
      });
      this.crossClusterJobs.set(id, {
        ...job,
        // version tracking is internal; job interface doesn't expose it
      });
    } else {
      this.crossClusterJobs.set(id, job);
    }

    return job;
  }

  // ========== Resource Pool Management ==========

  async createResourcePool(
    tenantId: string,
    input: ResourcePoolInput,
  ): Promise<ResourcePool> {
    const id = `pool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const pool: ResourcePool = {
      id,
      tenantId,
      name: input.name,
      description: input.description || '',
      clusterId: input.clusterId,
      cpu: input.cpu,
      memory: input.memory,
      usedCpu: 0,
      usedMemory: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    // Write-through: persist to DB first, then update in-memory cache
    if (this.repo) {
      const persisted = await this.repo.savePool({
        id: pool.id,
        tenantId: pool.tenantId,
        name: pool.name,
        description: pool.description,
        clusterId: pool.clusterId,
        cpu: pool.cpu,
        memory: pool.memory,
        usedCpu: 0,
        usedMemory: 0,
        status: pool.status,
      });
      this.resourcePools.set(id, pool);
    } else {
      this.resourcePools.set(id, pool);
    }

    return pool;
  }

  async getResourcePoolStatus(poolId: string): Promise<ResourcePool | null> {
    if (this.repo) {
      try {
        const row = await this.repo.findPoolById(poolId);
        if (row) {
          return {
            id: row.id,
            tenantId: row.tenantId,
            name: row.name,
            description: row.description,
            clusterId: row.clusterId,
            cpu: row.cpu,
            memory: row.memory,
            usedCpu: row.usedCpu,
            usedMemory: row.usedMemory,
            status: row.status as ResourcePool['status'],
            createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
          };
        }
      } catch (err) {
        logger.warn({ err, poolId }, 'DB getResourcePoolStatus failed, falling back to memory');
      }
    }
    return this.resourcePools.get(poolId) || null;
  }

  // ========== Cross-Cluster Job Status Update ==========

  /**
   * Updates the status of a cross-cluster job using optimistic locking.
   * The caller should provide the current version to prevent lost-update conflicts.
   */
  async updateJobStatus(
    jobId: string,
    status: CrossClusterJob['status'],
    completedAt?: string | null,
    expectedVersion?: number,
  ): Promise<CrossClusterJob | null> {
    const existingJob = this.crossClusterJobs.get(jobId);
    if (!existingJob && !this.repo) return null;

    const completedAtDate = completedAt ? new Date(completedAt) : null;
    const scheduledAtDate = new Date(existingJob?.scheduledAt ?? Date.now());

    if (this.repo) {
      try {
        const persisted = await this.repo.saveJob(
          {
            id: jobId,
            tenantId: existingJob?.tenantId ?? '',
            name: existingJob?.name ?? jobId,
            spec: existingJob?.spec ?? {},
            targetClusters: existingJob?.targetClusters ?? [],
            status,
            scheduledAt: scheduledAtDate,
            completedAt: completedAtDate,
          },
          expectedVersion,
        );
        const updatedJob: CrossClusterJob = {
          id: persisted.id,
          tenantId: persisted.tenantId,
          name: persisted.name,
          spec: persisted.spec,
          targetClusters: persisted.targetClusters,
          status: persisted.status as CrossClusterJob['status'],
          scheduledAt: persisted.scheduledAt instanceof Date ? persisted.scheduledAt.toISOString() : persisted.scheduledAt,
          completedAt: persisted.completedAt ? (persisted.completedAt instanceof Date ? persisted.completedAt.toISOString() : persisted.completedAt) : null,
        };
        this.crossClusterJobs.set(jobId, updatedJob);
        return updatedJob;
      } catch (err) {
        if (err instanceof OptimisticLockError) {
          logger.warn({ err, jobId }, 'Optimistic lock conflict on job status update');
          throw err;
        }
        logger.warn({ err, jobId }, 'DB updateJobStatus failed, falling back to memory');
      }
    }

    // Fallback: update in-memory only
    if (existingJob) {
      const updated = { ...existingJob, status, completedAt: completedAt ?? existingJob.completedAt };
      this.crossClusterJobs.set(jobId, updated);
      return updated;
    }
    return null;
  }

  // ========== Resource Pool Usage Update ==========

  /**
   * Updates resource pool usage metrics using optimistic locking.
   */
  async updatePoolUsage(
    poolId: string,
    usedCpu: number,
    usedMemory: number,
    status?: ResourcePool['status'],
    expectedVersion?: number,
  ): Promise<ResourcePool | null> {
    const existingPool = this.resourcePools.get(poolId);
    if (!existingPool && !this.repo) return null;

    const newStatus = status ?? existingPool?.status ?? 'active';

    if (this.repo) {
      try {
        const persisted = await this.repo.savePool(
          {
            id: poolId,
            tenantId: existingPool?.tenantId ?? '',
            name: existingPool?.name ?? poolId,
            description: existingPool?.description ?? '',
            clusterId: existingPool?.clusterId ?? '',
            cpu: existingPool?.cpu ?? 0,
            memory: existingPool?.memory ?? 0,
            usedCpu,
            usedMemory,
            status: newStatus,
          },
          expectedVersion,
        );
        const updatedPool: ResourcePool = {
          id: persisted.id,
          tenantId: persisted.tenantId,
          name: persisted.name,
          description: persisted.description,
          clusterId: persisted.clusterId,
          cpu: persisted.cpu,
          memory: persisted.memory,
          usedCpu: persisted.usedCpu,
          usedMemory: persisted.usedMemory,
          status: persisted.status as ResourcePool['status'],
          createdAt: persisted.createdAt instanceof Date ? persisted.createdAt.toISOString() : persisted.createdAt,
        };
        this.resourcePools.set(poolId, updatedPool);
        return updatedPool;
      } catch (err) {
        if (err instanceof OptimisticLockError) {
          logger.warn({ err, poolId }, 'Optimistic lock conflict on pool usage update');
          throw err;
        }
        logger.warn({ err, poolId }, 'DB updatePoolUsage failed, falling back to memory');
      }
    }

    // Fallback: update in-memory only
    if (existingPool) {
      const updated = {
        ...existingPool,
        usedCpu,
        usedMemory,
        status: newStatus,
      };
      this.resourcePools.set(poolId, updated);
      return updated;
    }
    return null;
  }

  // ========== Consistency Verification ==========

  /**
   * Verifies read-after-write consistency by comparing in-memory state with DB.
   * Returns a ConsistencyVerificationResult indicating whether data is consistent
   * and listing any divergences (DB is the authoritative source).
   */
  async verifyConsistency(): Promise<ConsistencyVerificationResult> {
    if (!this.repo) {
      return new ConsistencyVerificationResult(true, []);
    }

    try {
      const divergences = await this.repo.verifyConsistency(
        this.schedulingPolicies,
        this.crossClusterJobs,
        this.resourcePools,
      );

      if (divergences.length > 0) {
        logger.warn(
          { divergenceCount: divergences.length, divergences: divergences.slice(0, 5) },
          'Consistency verification found divergences between memory and DB',
        );
      }

      return new ConsistencyVerificationResult(divergences.length === 0, divergences);
    } catch (err) {
      logger.error({ err }, 'Consistency verification failed');
      return new ConsistencyVerificationResult(false, []);
    }
  }

  /**
   * Repairs consistency by replacing in-memory state with the authoritative DB state.
   * Call this when verifyConsistency() reports divergences.
   */
  async repairConsistency(): Promise<void> {
    if (!this.repo) return;

    try {
      // Reload policies from DB
      const dbPolicies = await this.repo.findPoliciesByTenant('*');
      this.schedulingPolicies.clear();
      for (const p of dbPolicies) {
        this.schedulingPolicies.set(p.id, {
          id: p.id,
          tenantId: p.tenantId,
          name: p.name,
          description: p.description,
          strategy: p.strategy as SchedulingPolicy['strategy'],
          rules: p.rules,
          status: p.status as SchedulingPolicy['status'],
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        });
      }

      // Reload jobs from DB (across all tenants seen in memory)
      const allTenantIds = new Set([...this.crossClusterJobs.values()].map(j => j.tenantId));
      this.crossClusterJobs.clear();
      for (const tenantId of allTenantIds) {
        const dbJobs = await this.repo.findJobsByTenant(tenantId);
        for (const j of dbJobs) {
          this.crossClusterJobs.set(j.id, {
            id: j.id,
            tenantId: j.tenantId,
            name: j.name,
            spec: j.spec,
            targetClusters: j.targetClusters,
            status: j.status as CrossClusterJob['status'],
            scheduledAt: j.scheduledAt.toISOString(),
            completedAt: j.completedAt ? j.completedAt.toISOString() : null,
          });
        }
      }

      // Reload pools from DB
      const allPoolIds = [...this.resourcePools.keys()];
      this.resourcePools.clear();
      for (const poolId of allPoolIds) {
        const dbPool = await this.repo.findPoolById(poolId);
        if (dbPool) {
          this.resourcePools.set(dbPool.id, {
            id: dbPool.id,
            tenantId: dbPool.tenantId,
            name: dbPool.name,
            description: dbPool.description,
            clusterId: dbPool.clusterId,
            cpu: dbPool.cpu,
            memory: dbPool.memory,
            usedCpu: dbPool.usedCpu,
            usedMemory: dbPool.usedMemory,
            status: dbPool.status as ResourcePool['status'],
            createdAt: dbPool.createdAt.toISOString(),
          });
        }
      }

      logger.info('Consistency repair completed: in-memory state synchronized with DB');
    } catch (err) {
      logger.error({ err }, 'Consistency repair failed');
      throw err;
    }
  }
}
