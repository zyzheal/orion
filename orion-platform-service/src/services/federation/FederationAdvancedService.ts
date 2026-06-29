/**
 * Federation Advanced Service - Phase 4
 *
 * 联邦调度进阶功能：调度策略、跨集群调度、资源池管理
 *
 * Persistence strategy:
 * - Writes: fire-and-forget to PostgreSQL (non-blocking), always update in-memory Map
 * - Reads: try DB first, fall back to in-memory Map on DB failure
 * - Startup: load from DB to hydrate in-memory Maps
 */

import pino from 'pino';
import { FederationAdvancedRepository } from '../../repositories/FederationAdvancedRepository';

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
    this.schedulingPolicies.set(id, policy);

    // Fire-and-forget to PostgreSQL
    if (this.repo) {
      this.repo.savePolicy({
        id: policy.id,
        tenantId: policy.tenantId,
        name: policy.name,
        description: policy.description,
        strategy: policy.strategy,
        rules: policy.rules,
        status: policy.status,
      }).catch(err => {
        logger.warn({ err, policyId: id }, 'Failed to persist scheduling policy to DB');
      });
    }

    return policy;
  }

  async listSchedulingPolicies(tenantId: string): Promise<SchedulingPolicy[]> {
    if (this.repo) {
      try {
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
    this.crossClusterJobs.set(id, job);

    // Fire-and-forget to PostgreSQL
    if (this.repo) {
      this.repo.saveJob({
        id: job.id,
        tenantId: job.tenantId,
        name: job.name,
        spec: job.spec,
        targetClusters: job.targetClusters,
        status: job.status,
        scheduledAt: new Date(job.scheduledAt),
        completedAt: null,
      }).catch(err => {
        logger.warn({ err, jobId: id }, 'Failed to persist cross-cluster job to DB');
      });
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
    this.resourcePools.set(id, pool);

    // Fire-and-forget to PostgreSQL
    if (this.repo) {
      this.repo.savePool({
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
      }).catch(err => {
        logger.warn({ err, poolId: id }, 'Failed to persist resource pool to DB');
      });
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
}
