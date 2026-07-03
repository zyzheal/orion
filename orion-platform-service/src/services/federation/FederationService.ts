/**
 * FederationService - Multi-cluster federation management
 *
 * Provides CRUD and lifecycle operations for federated cluster executors,
 * health monitoring, and job dispatch across clusters.
 */

import { createLogger } from '../utils/logger';
import {
  ExecutorRepository,
  ExecutorEntity,
  ExecutorHealthEntity,
  ExecutorHealthRepository,
  ClusterRecordRepository,
  ClusterRecordEntity,
  HealthCheckResultRepository,
  HealthCheckResultEntity,
} from '../../repositories/FederationRepository';
import { DatabasePool } from '../database';
import { OrionError, ErrorCode } from '../../errors';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ==================== Input Interfaces ====================

export interface CreateExecutorInput {
  cluster_id: string;
  name: string;
  region: string;
  cpu_capacity?: number;
  memory_capacity_mb?: number;
  max_concurrent_jobs?: number;
  labels?: Record<string, any>;
}

export interface RegisterExecutorInput extends CreateExecutorInput {}

export interface ExecutorHeartbeatInput {
  cpu_used?: number;
  memory_used_mb?: number;
  running_jobs?: number;
  response_time_ms?: number;
}

export interface DispatchJobInput {
  name: string;
  description?: string;
  job_type?: string;
  source_cluster_id: string;
  target_cluster_ids: string[];
  priority?: string;
  spec?: Record<string, any>;
  executor_id?: string;
  resource_requirements?: { cpu?: number; memory_mb?: number };
}

export interface FederationConfig {
  name?: string;
  description?: string;
  clusters?: string[];
  strategy?: string;
  metadata?: Record<string, any>;
}

// ==================== FederationService ====================

export class FederationService {
  private executorRepo: ExecutorRepository | null = null;
  private executorHealthRepo: ExecutorHealthRepository | null = null;
  private clusterRepo: ClusterRecordRepository | null = null;
  private healthCheckRepo: HealthCheckResultRepository | null = null;

  constructor(db?: DatabasePool) {
    if (db) {
      this.executorRepo = new ExecutorRepository(db);
      this.executorHealthRepo = new ExecutorHealthRepository(db);
      this.clusterRepo = new ClusterRecordRepository(db);
      this.healthCheckRepo = new HealthCheckResultRepository(db);
    }
  }

  /**
   * Set repositories after construction (for lazy initialization)
   */
  setRepositories(
    executorRepo: ExecutorRepository,
    executorHealthRepo: ExecutorHealthRepository,
    clusterRepo: ClusterRecordRepository,
    healthCheckRepo: HealthCheckResultRepository,
  ): void {
    this.executorRepo = executorRepo;
    this.executorHealthRepo = executorHealthRepo;
    this.clusterRepo = clusterRepo;
    this.healthCheckRepo = healthCheckRepo;
  }

  // ==================== Federation Config CRUD ====================

  /**
   * Create a new federation configuration
   */
  async createFederation(config: FederationConfig): Promise<Record<string, any>> {
    if (!this.clusterRepo) {
      return { id: this.generateId(), ...config, status: 'created' };
    }

    const federationId = this.generateId();
    logger.info({ federationId, config }, '[FederationService] Creating federation');

    // Register clusters if provided
    const clusterIds: string[] = [];
    if (config.clusters && config.clusters.length > 0) {
      for (const clusterName of config.clusters) {
        try {
          const existing = await this.clusterRepo.findByName(clusterName);
          if (!existing) {
            await this.clusterRepo.create({
              cluster_name: clusterName,
              region: 'default',
              endpoint: '',
              status: 'pending',
              kube_config_ref: null,
              node_count: null,
              cpu_capacity: null,
              memory_capacity: null,
              registered_at: new Date(),
              last_heartbeat: null,
            });
          }
          clusterIds.push(clusterName);
        } catch (err) {
          logger.warn({ clusterName, err }, '[FederationService] Failed to register cluster');
        }
      }
    }

    return {
      id: federationId,
      name: config.name || 'unnamed',
      description: config.description,
      clusters: clusterIds,
      strategy: config.strategy || 'round-robin',
      metadata: config.metadata || {},
      status: 'active',
      createdAt: new Date(),
    };
  }

  /**
   * Get federation config by ID
   */
  async getFederation(id: string): Promise<Record<string, any> | null> {
    if (!this.clusterRepo) {
      return null;
    }

    // Federation is composed of clusters, look up by cluster name
    const cluster = await this.clusterRepo.findById(id);
    if (!cluster) {
      return null;
    }

    return {
      id: cluster.id,
      name: cluster.cluster_name,
      region: cluster.region,
      endpoint: cluster.endpoint,
      status: cluster.status,
      nodeCount: cluster.node_count,
      cpuCapacity: cluster.cpu_capacity,
      memoryCapacity: cluster.memory_capacity,
      registeredAt: cluster.registered_at,
      lastHeartbeat: cluster.last_heartbeat,
    };
  }

  /**
   * List all federations (clusters) for a tenant
   */
  async listFederations(tenantId: string): Promise<Record<string, any>[]> {
    if (!this.clusterRepo) {
      return [];
    }

    // List all active clusters as federations
    const clusters = await this.clusterRepo.findAllActive();
    return clusters.map(c => ({
      id: c.id,
      name: c.cluster_name,
      region: c.region,
      endpoint: c.endpoint,
      status: c.status,
      nodeCount: c.node_count,
      registeredAt: c.registered_at,
      lastHeartbeat: c.last_heartbeat,
    }));
  }

  /**
   * Update federation config
   */
  async updateFederation(id: string, updates: Record<string, any>): Promise<Record<string, any> | null> {
    if (!this.clusterRepo) {
      return null;
    }

    const existing = await this.clusterRepo.findById(id);
    if (!existing) {
      return null;
    }

    const updateFields: Record<string, any> = {};
    if (updates.cluster_name !== undefined) updateFields.cluster_name = updates.cluster_name;
    if (updates.region !== undefined) updateFields.region = updates.region;
    if (updates.endpoint !== undefined) updateFields.endpoint = updates.endpoint;
    if (updates.status !== undefined) updateFields.status = updates.status;

    if (Object.keys(updateFields).length > 0) {
      await this.clusterRepo.update(id, updateFields as any);
    }

    return this.getFederation(id);
  }

  /**
   * Delete federation config
   */
  async deleteFederation(id: string): Promise<boolean> {
    if (!this.clusterRepo) {
      return false;
    }

    const deleted = await this.clusterRepo.delete(id);
    if (deleted) {
      logger.info({ id }, '[FederationService] Federation deleted');
    }
    return deleted;
  }

  // ==================== Executor Management ====================

  /**
   * Register a new executor
   */
  async registerExecutor(input: RegisterExecutorInput): Promise<ExecutorEntity> {
    if (!this.executorRepo) {
      const mockId = this.generateId();
      return {
        id: mockId,
        cluster_id: input.cluster_id,
        name: input.name,
        region: input.region,
        status: 'online',
        cpu_capacity: input.cpu_capacity ?? 16,
        memory_capacity_mb: input.memory_capacity_mb ?? 32768,
        cpu_used: 0,
        memory_used_mb: 0,
        running_jobs: 0,
        max_concurrent_jobs: input.max_concurrent_jobs ?? 10,
        last_heartbeat: new Date(),
        registered_at: new Date(),
        labels: input.labels ?? {},
      };
    }

    const executorData = {
      cluster_id: input.cluster_id,
      name: input.name,
      region: input.region,
      status: 'online',
      cpu_capacity: input.cpu_capacity ?? 16,
      memory_capacity_mb: input.memory_capacity_mb ?? 32768,
      cpu_used: 0,
      memory_used_mb: 0,
      running_jobs: 0,
      max_concurrent_jobs: input.max_concurrent_jobs ?? 10,
      last_heartbeat: new Date(),
      labels: input.labels ?? {},
    };

    const entity = await this.executorRepo.create(executorData as any);
    logger.info({ executorId: entity.id, name: entity.name }, '[FederationService] Executor registered');

    // Update heartbeat to health repo
    if (this.executorHealthRepo) {
      await this.executorHealthRepo.upsert({
        executor_id: entity.id,
        status: 'healthy',
        cpu_usage_pct: 0,
        memory_usage_pct: 0,
        running_jobs: 0,
        queue_depth: 0,
        last_heartbeat: new Date(),
        response_time_ms: 0,
        errors_last_hour: 0,
      });
    }

    return entity;
  }

  /**
   * List executors for a tenant
   */
  async listExecutors(tenantId: string): Promise<{ entities: ExecutorEntity[]; total: number }> {
    if (!this.executorRepo) {
      return { entities: [], total: 0 };
    }

    const result = await this.executorRepo.findAll({ limit: 100, offset: 0 });
    return result;
  }

  /**
   * Get executor health status
   */
  async getExecutorHealth(executorId: string): Promise<{ executor: ExecutorEntity; health: ExecutorHealthEntity | null } | null> {
    if (!this.executorRepo) {
      return null;
    }

    const result = this.executorRepo.findByIdWithHealth(executorId);
    return (result === undefined ? null : result) as { executor: ExecutorEntity; health: ExecutorHealthEntity | null } | null;
  }

  /**
   * Get executor health dashboard
   */
  async getExecutorDashboard(tenantId: string): Promise<{
    totalExecutors: number;
    onlineExecutors: number;
    offlineExecutors: number;
    avgCpuUsage: number;
    avgMemoryUsage: number;
    totalRunningJobs: number;
    executors: ExecutorHealthEntity[];
  }> {
    if (!this.executorRepo || !this.executorHealthRepo) {
      return {
        totalExecutors: 0,
        onlineExecutors: 0,
        offlineExecutors: 0,
        avgCpuUsage: 0,
        avgMemoryUsage: 0,
        totalRunningJobs: 0,
        executors: [],
      };
    }

    const activeExecutors = await this.executorRepo.findAllActive();
    const healthData = await this.executorHealthRepo.findAllLatest();

    const totalExecutors = activeExecutors.length;
    const totalRunningJobs = activeExecutors.reduce((sum, e) => sum + e.running_jobs, 0);

    const cpuUsages = healthData.map(h => h.cpu_usage_pct);
    const memUsages = healthData.map(h => h.memory_usage_pct);

    return {
      totalExecutors,
      onlineExecutors: activeExecutors.filter(e => e.status === 'online').length,
      offlineExecutors: totalExecutors - activeExecutors.filter(e => e.status === 'online').length,
      avgCpuUsage: cpuUsages.length > 0 ? cpuUsages.reduce((a, b) => a + b, 0) / cpuUsages.length : 0,
      avgMemoryUsage: memUsages.length > 0 ? memUsages.reduce((a, b) => a + b, 0) / memUsages.length : 0,
      totalRunningJobs,
      executors: healthData,
    };
  }

  /**
   * Executor heartbeat
   */
  async executorHeartbeat(executorId: string, metrics: ExecutorHeartbeatInput): Promise<{ executor: ExecutorEntity | null; health: ExecutorHealthEntity | null }> {
    if (!this.executorRepo || !this.executorHealthRepo) {
      return { executor: null, health: null };
    }

    const executor = await this.executorRepo.updateHeartbeat(executorId, {
      cpu_used: metrics.cpu_used,
      memory_used_mb: metrics.memory_used_mb,
      running_jobs: metrics.running_jobs,
    });

    const cpuUsage = executor ? (executor.cpu_capacity > 0 ? (executor.cpu_used / executor.cpu_capacity) * 100 : 0) : 0;
    const memUsage = executor ? (executor.memory_capacity_mb > 0 ? (executor.memory_used_mb / executor.memory_capacity_mb) * 100 : 0) : 0;

    const health = await this.executorHealthRepo.upsert({
      executor_id: executorId,
      status: cpuUsage > 90 || memUsage > 90 ? 'degraded' : 'healthy',
      cpu_usage_pct: Math.round(cpuUsage * 100) / 100,
      memory_usage_pct: Math.round(memUsage * 100) / 100,
      running_jobs: executor?.running_jobs ?? 0,
      queue_depth: 0,
      last_heartbeat: new Date(),
      response_time_ms: metrics.response_time_ms ?? 0,
      errors_last_hour: 0,
    });

    return { executor: executor ?? null, health };
  }

  /**
   * Deregister an executor
   */
  async deregisterExecutor(executorId: string): Promise<boolean> {
    if (!this.executorRepo) {
      return false;
    }

    const deleted = await this.executorRepo.delete(executorId);
    if (deleted) {
      logger.info({ executorId }, '[FederationService] Executor deregistered');
    }
    return deleted;
  }

  /**
   * Dispatch a job to the best executor
   */
  async dispatchJob(tenantId: string, input: DispatchJobInput): Promise<{
    jobId: string;
    executorId: string;
    executorName: string;
    status: string;
    dispatchedAt: Date;
  }> {
    if (!this.executorRepo) {
      return {
        jobId: this.generateId(),
        executorId: 'mock-executor',
        executorName: 'mock-executor',
        status: 'dispatched',
        dispatchedAt: new Date(),
      };
    }

    // Find best executor based on resource requirements
    let selectedExecutor: ExecutorEntity | undefined;

    if (input.executor_id) {
      selectedExecutor = await this.executorRepo.findById(input.executor_id);
    } else {
      // Find executor with most available resources
      const candidates = await this.executorRepo.findAllActive();
      const req = input.resource_requirements;

      selectedExecutor = candidates
        .filter(e =>
          (!req || req.cpu === undefined || (e.cpu_capacity - e.cpu_used) >= req.cpu) &&
          (!req || req.memory_mb === undefined || (e.memory_capacity_mb - e.memory_used_mb) >= req.memory_mb) &&
          e.running_jobs < e.max_concurrent_jobs
        )
        .sort((a, b) => {
          const aFree = (a.cpu_capacity - a.cpu_used) / a.cpu_capacity;
          const bFree = (b.cpu_capacity - b.cpu_used) / b.cpu_capacity;
          return bFree - aFree; // Most free capacity first
        })[0];
    }

    if (!selectedExecutor) {
      throw new OrionError('No suitable executor found for job dispatch', ErrorCode.OPERATION_FAILED);
    }

    const jobId = this.generateId();
    logger.info({ jobId, executorId: selectedExecutor.id, job: input.name }, '[FederationService] Job dispatched');

    return {
      jobId,
      executorId: selectedExecutor.id,
      executorName: selectedExecutor.name,
      status: 'dispatched',
      dispatchedAt: new Date(),
    };
  }

  // ==================== Utility Methods ====================

  private generateId(): string {
    return `fed-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

export default FederationService;
