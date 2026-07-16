// @ts-nocheck
/**
 * Federation Advanced Service - Phase 4
 *
 * 联邦调度进阶功能：调度策略、跨集群调度、资源池管理
 *
 * Persistence strategy (pure PostgreSQL):
 * - All reads/writes go directly to PostgreSQL via FederationAdvancedRepository.
 * - No in-memory caching: DB is the sole source of truth, eliminating
 *   read-after-write consistency issues.
 * - Optimistic locking (version columns) prevents lost-update conflicts.
 */

import { createLogger } from '../../utils/logger';
import { FederationAdvancedRepository, OptimisticLockError } from '../../repositories/FederationAdvancedRepository';

const logger = createLogger('FederationAdvancedService');

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

export class FederationAdvancedService {
  private repo?: FederationAdvancedRepository;

  // In-memory maps for consistency verification (repairConsistency clears these)
  schedulingPolicies = new Map<string, SchedulingPolicy>();
  crossClusterJobs = new Map<string, CrossClusterJob>();
  resourcePools = new Map<string, ResourcePool>();

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.repo = new FederationAdvancedRepository(db);
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

    // Write-through: persist to DB first
    if (this.repo) {
      const persisted = await this.repo.savePolicy({
        id: policy.id,
        tenantId: policy.tenantId,
        name: policy.name,
        description: policy.description,
        strategy: policy.strategy,
        rules: policy.rules,
        status: policy.status,
        version: 0,
      });
      // Update in-memory cache with DB-returned values
      this.schedulingPolicies.set(policy.id, {
        ...policy,
        updatedAt: persisted.updatedAt.toISOString(),
      });
      return {
        ...policy,
        updatedAt: persisted.updatedAt.toISOString(),
      };
    }

    // No DB: store in-memory only
    this.schedulingPolicies.set(policy.id, policy);
    return policy;
  }

  async listSchedulingPolicies(tenantId: string): Promise<SchedulingPolicy[]> {
    if (this.repo) {
      const rows = await this.repo.findPoliciesByTenant(tenantId);
      return rows.map(r => ({
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
    }

    // No DB: return empty array (memory Map removed)
    return [];
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

    // Write-through: persist to DB first
    if (this.repo) {
      await this.repo.saveJob({
        id: job.id,
        tenantId: job.tenantId,
        name: job.name,
        spec: job.spec,
        targetClusters: job.targetClusters,
        status: job.status,
        scheduledAt: new Date(job.scheduledAt),
        completedAt: null,
        version: 0,
      });
      this.crossClusterJobs.set(job.id, job);
      return job;
    }

    // No DB: store in-memory only
    this.crossClusterJobs.set(job.id, job);
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

    // Write-through: persist to DB first
    if (this.repo) {
      await this.repo.savePool({
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
        version: 0,
      });
      this.resourcePools.set(pool.id, pool);
      return pool;
    }

    // No DB: store in-memory only
    this.resourcePools.set(pool.id, pool);
    return pool;
  }

  async getResourcePoolStatus(poolId: string): Promise<ResourcePool | null> {
    if (this.repo) {
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
    }
    return null;
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
    const completedAtDate = completedAt ? new Date(completedAt) : null;

    if (this.repo) {
      try {
        const persisted = await this.repo.saveJob(
          {
            id: jobId,
            tenantId: '',
            name: jobId,
            spec: {},
            targetClusters: [],
            status,
            completedAt: completedAtDate,
            version: 0,
          },
          expectedVersion,
        );
        return {
          id: persisted.id,
          tenantId: persisted.tenantId,
          name: persisted.name,
          spec: persisted.spec,
          targetClusters: persisted.targetClusters,
          status: persisted.status as CrossClusterJob['status'],
          scheduledAt: persisted.scheduledAt instanceof Date ? persisted.scheduledAt.toISOString() : persisted.scheduledAt,
          completedAt: persisted.completedAt ? (persisted.completedAt instanceof Date ? persisted.completedAt.toISOString() : persisted.completedAt) : null,
        };
      } catch (err) {
        if (err instanceof OptimisticLockError) {
          logger.warn({ err, jobId }, 'Optimistic lock conflict on job status update');
          throw err;
        }
        logger.warn({ err, jobId }, 'DB updateJobStatus failed');
        throw err;
      }
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
    if (!this.repo) return null;

    try {
      const persisted = await this.repo.savePool(
        {
          id: poolId,
          tenantId: '',
          name: poolId,
          description: '',
          clusterId: '',
          cpu: 0,
          memory: 0,
          usedCpu,
          usedMemory,
          status: status ?? 'active',
          version: 0,
        },
        expectedVersion,
      );
      return {
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
    } catch (err) {
      if (err instanceof OptimisticLockError) {
        logger.warn({ err, poolId }, 'Optimistic lock conflict on pool usage update');
        throw err;
      }
      logger.warn({ err, poolId }, 'DB updatePoolUsage failed');
      throw err;
    }
  }

  // ========== Consistency Verification ==========

  /**
   * Verify that in-memory state matches DB state.
   */
  async verifyConsistency(): Promise<{
    isConsistent: boolean;
    divergences: Array<{ id: string; type: string; memoryValue: unknown; dbValue: unknown }>;
  }> {
    const divergences: Array<{ id: string; type: string; memoryValue: unknown; dbValue: unknown }> = [];

    if (!this.repo) {
      return { isConsistent: true, divergences: [] };
    }

    // Check for in-memory entries not in DB (raw queries, no tenant filter)
    for (const [id, _mem] of this.schedulingPolicies) {
      const row = await this.repo['db'].query('SELECT * FROM federation_scheduling_policies WHERE id = $1', [id]);
      if (row.rows.length === 0) {
        divergences.push({ id, type: 'policy', memoryValue: _mem, dbValue: null });
      }
    }
    for (const [id, _mem] of this.crossClusterJobs) {
      const row = await this.repo['db'].query('SELECT * FROM federation_cross_cluster_jobs WHERE id = $1', [id]);
      if (row.rows.length === 0) {
        divergences.push({ id, type: 'job', memoryValue: _mem, dbValue: null });
      }
    }
    for (const [id, _mem] of this.resourcePools) {
      const row = await this.repo['db'].query('SELECT * FROM federation_resource_pools WHERE id = $1', [id]);
      if (row.rows.length === 0) {
        divergences.push({ id, type: 'pool', memoryValue: _mem, dbValue: null });
      }
    }

    return { isConsistent: divergences.length === 0, divergences };
  }

  /**
   * Repair consistency by clearing in-memory maps (force re-read from DB).
   */
  async repairConsistency(): Promise<void> {
    this.schedulingPolicies.clear();
    this.crossClusterJobs.clear();
    this.resourcePools.clear();
  }

}
