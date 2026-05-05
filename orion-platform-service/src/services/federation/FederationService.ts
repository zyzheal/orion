/**
 * Federation Service - Phase 3
 *
 * Multi-cluster federation management: cluster registration, health monitoring,
 * and cross-cluster job orchestration.
 */

import { DatabasePool } from '../database';

export interface FederationCluster {
  id: string;
  tenant_id: string;
  name: string;
  endpoint: string;
  region: string;
  cloud_provider: string;
  k8s_version: string;
  status: 'online' | 'offline' | 'maintenance' | 'degraded';
  capacity_cpu: number;
  capacity_memory_mb: number;
  load_cpu: number;
  load_memory_mb: number;
  last_heartbeat: Date | null;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface FederationClusterHealth {
  cluster_id: string;
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  api_server_reachable: boolean;
  api_server_latency_ms: number;
  node_count: number;
  node_ready_count: number;
  pod_count: number;
  cpu_usage_pct: number;
  memory_usage_pct: number;
  disk_usage_pct: number;
  anomalies: string[];
  checked_at: Date;
}

export interface FederationJob {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  job_type: 'pipeline' | 'deployment' | 'migration' | 'sync';
  source_cluster_id: string;
  target_cluster_ids: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'critical';
  spec: Record<string, any>;
  result: Record<string, any> | null;
  error_message: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ClusterMetrics {
  cluster_id: string;
  time_window: string;
  cpu_usage_avg: number;
  cpu_usage_max: number;
  memory_usage_avg: number;
  memory_usage_max: number;
  network_in_bytes: number;
  network_out_bytes: number;
  pod_count_avg: number;
  pod_restart_count: number;
  error_count: number;
  latency_p50_ms: number;
  latency_p99_ms: number;
}

export interface ExecutorInfo {
  id: string;
  cluster_id: string;
  name: string;
  region: string;
  status: 'online' | 'offline' | 'degraded';
  cpu_capacity: number;
  memory_capacity_mb: number;
  cpu_used: number;
  memory_used_mb: number;
  running_jobs: number;
  max_concurrent_jobs: number;
  last_heartbeat: Date | null;
  registered_at: Date;
  labels: Record<string, any>;
}

export interface ExecutorHealth {
  executor_id: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  cpu_usage_pct: number;
  memory_usage_pct: number;
  running_jobs: number;
  queue_depth: number;
  last_heartbeat: Date;
  response_time_ms: number;
  errors_last_hour: number;
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

export class FederationService {
  private pool: DatabasePool;
  private executors: Map<string, ExecutorInfo> = new Map();
  private executorHealth: Map<string, ExecutorHealth> = new Map();
  private heartbeatTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(pool: DatabasePool) {
    this.pool = pool;
  }

  // ==================== Executor Management ====================

  async registerExecutor(input: {
    id?: string;
    cluster_id: string;
    name: string;
    region: string;
    cpu_capacity?: number;
    memory_capacity_mb?: number;
    max_concurrent_jobs?: number;
    labels?: Record<string, any>;
  }): Promise<ExecutorInfo> {
    const executorId = input.id || `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();
    const executor: ExecutorInfo = {
      id: executorId,
      cluster_id: input.cluster_id,
      name: input.name,
      region: input.region,
      status: 'online',
      cpu_capacity: input.cpu_capacity || 16,
      memory_capacity_mb: input.memory_capacity_mb || 32768,
      cpu_used: 0,
      memory_used_mb: 0,
      running_jobs: 0,
      max_concurrent_jobs: input.max_concurrent_jobs || 10,
      last_heartbeat: now,
      registered_at: now,
      labels: input.labels || {},
    };
    this.executors.set(executorId, executor);
    this.executorHealth.set(executorId, {
      executor_id: executorId,
      status: 'healthy',
      cpu_usage_pct: 0,
      memory_usage_pct: 0,
      running_jobs: 0,
      queue_depth: 0,
      last_heartbeat: now,
      response_time_ms: 0,
      errors_last_hour: 0,
    });
    return executor;
  }

  async listExecutors(tenantId: string): Promise<ExecutorInfo[]> {
    return Array.from(this.executors.values());
  }

  async getExecutor(executorId: string): Promise<ExecutorInfo | null> {
    return this.executors.get(executorId) || null;
  }

  async deregisterExecutor(executorId: string): Promise<boolean> {
    const timer = this.heartbeatTimers.get(executorId);
    if (timer) {
      clearInterval(timer);
      this.heartbeatTimers.delete(executorId);
    }
    this.executors.delete(executorId);
    this.executorHealth.delete(executorId);
    return true;
  }

  async executorHeartbeat(executorId: string, metrics: {
    cpu_used?: number;
    memory_used_mb?: number;
    running_jobs?: number;
    response_time_ms?: number;
  }): Promise<ExecutorHealth> {
    const executor = this.executors.get(executorId);
    if (!executor) {
      throw new Error(`Executor '${executorId}' not found`);
    }

    executor.last_heartbeat = new Date();
    executor.cpu_used = metrics.cpu_used ?? executor.cpu_used;
    executor.memory_used_mb = metrics.memory_used_mb ?? executor.memory_used_mb;
    executor.running_jobs = metrics.running_jobs ?? executor.running_jobs;

    const cpuUsagePct = executor.cpu_capacity > 0 ? (executor.cpu_used / executor.cpu_capacity) * 100 : 0;
    const memoryUsagePct = executor.memory_capacity_mb > 0 ? (executor.memory_used_mb / executor.memory_capacity_mb) * 100 : 0;

    const health: ExecutorHealth = {
      executor_id: executorId,
      status: cpuUsagePct > 90 || memoryUsagePct > 90 ? 'degraded' : 'healthy',
      cpu_usage_pct: Math.round(cpuUsagePct * 10) / 10,
      memory_usage_pct: Math.round(memoryUsagePct * 10) / 10,
      running_jobs: executor.running_jobs,
      queue_depth: executor.running_jobs >= executor.max_concurrent_jobs ? Math.floor(Math.random() * 5) : 0,
      last_heartbeat: executor.last_heartbeat!,
      response_time_ms: metrics.response_time_ms || Math.floor(Math.random() * 50) + 5,
      errors_last_hour: Math.floor(Math.random() * 3),
    };
    this.executorHealth.set(executorId, health);
    return health;
  }

  async getExecutorHealth(executorId: string): Promise<ExecutorHealth | null> {
    return this.executorHealth.get(executorId) || null;
  }

  async getAllExecutorHealth(): Promise<ExecutorHealth[]> {
    return Array.from(this.executorHealth.values());
  }

  // ==================== Job Dispatch with Load Balancing ====================

  selectBestExecutor(resourceRequirements?: { cpu?: number; memory_mb?: number }): ExecutorInfo | null {
    const available = Array.from(this.executors.values())
      .filter(e => e.status === 'online' && e.running_jobs < e.max_concurrent_jobs);

    if (available.length === 0) return null;

    // Load balancing: least-loaded first
    const scored = available.map(e => {
      const cpuScore = e.cpu_capacity > 0 ? e.cpu_used / e.cpu_capacity : 1;
      const memScore = e.memory_capacity_mb > 0 ? e.memory_used_mb / e.memory_capacity_mb : 1;
      const jobScore = e.max_concurrent_jobs > 0 ? e.running_jobs / e.max_concurrent_jobs : 1;
      return { executor: e, score: (cpuScore + memScore + jobScore) / 3 };
    });

    scored.sort((a, b) => a.score - b.score);
    return scored[0].executor;
  }

  async dispatchJob(tenantId: string, input: DispatchJobInput): Promise<FederationJob> {
    // Verify source cluster belongs to tenant
    const sourceCluster = await this.getCluster(input.source_cluster_id, tenantId);
    if (!sourceCluster) {
      throw new Error(`Source cluster '${input.source_cluster_id}' not found or not accessible`);
    }

    // Verify target clusters belong to tenant
    for (const targetId of input.target_cluster_ids) {
      const targetCluster = await this.getCluster(targetId, tenantId);
      if (!targetCluster) {
        throw new Error(`Target cluster '${targetId}' not found or not accessible`);
      }
    }

    // Select best executor if not specified
    let selectedExecutor: ExecutorInfo | null = null;
    if (input.executor_id) {
      selectedExecutor = await this.getExecutor(input.executor_id);
      if (!selectedExecutor) {
        throw new Error(`Executor '${input.executor_id}' not found`);
      }
    } else {
      selectedExecutor = this.selectBestExecutor(input.resource_requirements);
    }

    const result = await this.pool.query(
      `INSERT INTO federation_jobs
        (id, tenant_id, name, description, job_type, source_cluster_id,
         target_cluster_ids, status, priority, spec)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'pending', $7, $8)
       RETURNING *`,
      [
        tenantId,
        input.name,
        input.description || '',
        input.job_type || 'pipeline',
        input.source_cluster_id,
        input.target_cluster_ids,
        input.priority || 'normal',
        { ...input.spec, selected_executor: selectedExecutor?.id },
      ]
    );
    return result.rows[0];
  }

  async getExecutorDashboard(tenantId: string): Promise<{
    total_executors: number;
    online_executors: number;
    offline_executors: number;
    degraded_executors: number;
    total_running_jobs: number;
    avg_cpu_usage: number;
    avg_memory_usage: number;
    executors: ExecutorInfo[];
    health: ExecutorHealth[];
  }> {
    const executors = Array.from(this.executors.values());
    const healthList = Array.from(this.executorHealth.values());

    return {
      total_executors: executors.length,
      online_executors: executors.filter(e => e.status === 'online').length,
      offline_executors: executors.filter(e => e.status === 'offline').length,
      degraded_executors: executors.filter(e => e.status === 'degraded').length,
      total_running_jobs: executors.reduce((sum, e) => sum + e.running_jobs, 0),
      avg_cpu_usage: healthList.length > 0
        ? Math.round((healthList.reduce((sum, h) => sum + h.cpu_usage_pct, 0) / healthList.length) * 10) / 10
        : 0,
      avg_memory_usage: healthList.length > 0
        ? Math.round((healthList.reduce((sum, h) => sum + h.memory_usage_pct, 0) / healthList.length) * 10) / 10
        : 0,
      executors,
      health: healthList,
    };
  }

  // ==================== Cluster Management ====================

  async registerCluster(tenantId: string, input: {
    name: string;
    endpoint: string;
    region: string;
    cloud_provider?: string;
    k8s_version?: string;
    capacity_cpu?: number;
    capacity_memory_mb?: number;
    metadata?: Record<string, any>;
  }): Promise<FederationCluster> {
    const result = await this.pool.query(
      `INSERT INTO federation_clusters
        (id, tenant_id, name, endpoint, region, cloud_provider, k8s_version,
         status, capacity_cpu, capacity_memory_mb, metadata)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'online', $7, $8, $9)
       RETURNING *`,
      [
        tenantId,
        input.name,
        input.endpoint,
        input.region,
        input.cloud_provider || 'unknown',
        input.k8s_version || 'unknown',
        input.capacity_cpu || 100,
        input.capacity_memory_mb || 65536,
        input.metadata || {},
      ]
    );
    return result.rows[0];
  }

  async listClusters(tenantId: string): Promise<FederationCluster[]> {
    const result = await this.pool.query(
      `SELECT * FROM federation_clusters
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId]
    );
    return result.rows;
  }

  async getCluster(clusterId: string, tenantId: string): Promise<FederationCluster | null> {
    const result = await this.pool.query(
      `SELECT * FROM federation_clusters
       WHERE id = $1 AND tenant_id = $2`,
      [clusterId, tenantId]
    );
    return result.rows[0] || null;
  }

  async unregisterCluster(clusterId: string, tenantId: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM federation_clusters
       WHERE id = $1 AND tenant_id = $2`,
      [clusterId, tenantId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async updateClusterStatus(clusterId: string, status: FederationCluster['status']): Promise<void> {
    await this.pool.query(
      `UPDATE federation_clusters
       SET status = $2, updated_at = NOW()
       WHERE id = $1`,
      [clusterId, status]
    );
  }

  // ==================== Cluster Health ====================

  async getClusterHealth(clusterId: string, tenantId: string): Promise<FederationClusterHealth | null> {
    const result = await this.pool.query(
      `SELECT * FROM federation_cluster_health
       WHERE cluster_id = $1
       ORDER BY checked_at DESC
       LIMIT 1`,
      [clusterId]
    );
    const health = result.rows[0] || null;
    if (health) {
      // Verify cluster belongs to tenant
      const cluster = await this.getCluster(clusterId, tenantId);
      if (!cluster) return null;
    }
    return health;
  }

  async recordClusterHealth(health: FederationClusterHealth): Promise<void> {
    await this.pool.query(
      `INSERT INTO federation_cluster_health
        (id, cluster_id, status, api_server_reachable, api_server_latency_ms,
         node_count, node_ready_count, pod_count, cpu_usage_pct, memory_usage_pct,
         disk_usage_pct, anomalies, checked_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
      [
        health.cluster_id,
        health.status,
        health.api_server_reachable,
        health.api_server_latency_ms,
        health.node_count,
        health.node_ready_count,
        health.pod_count,
        health.cpu_usage_pct,
        health.memory_usage_pct,
        health.disk_usage_pct,
        health.anomalies || [],
      ]
    );
  }

  // ==================== Cross-Cluster Jobs ====================

  async submitCrossClusterJob(tenantId: string, jobSpec: {
    name: string;
    description?: string;
    job_type?: string;
    source_cluster_id: string;
    target_cluster_ids: string[];
    priority?: string;
    spec?: Record<string, any>;
  }): Promise<FederationJob> {
    // Verify source cluster belongs to tenant
    const sourceCluster = await this.getCluster(jobSpec.source_cluster_id, tenantId);
    if (!sourceCluster) {
      throw new Error(`Source cluster '${jobSpec.source_cluster_id}' not found or not accessible`);
    }

    // Verify target clusters belong to tenant
    for (const targetId of jobSpec.target_cluster_ids) {
      const targetCluster = await this.getCluster(targetId, tenantId);
      if (!targetCluster) {
        throw new Error(`Target cluster '${targetId}' not found or not accessible`);
      }
    }

    const result = await this.pool.query(
      `INSERT INTO federation_jobs
        (id, tenant_id, name, description, job_type, source_cluster_id,
         target_cluster_ids, status, priority, spec)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'pending', $7, $8)
       RETURNING *`,
      [
        tenantId,
        jobSpec.name,
        jobSpec.description || '',
        jobSpec.job_type || 'pipeline',
        jobSpec.source_cluster_id,
        jobSpec.target_cluster_ids,
        jobSpec.priority || 'normal',
        jobSpec.spec || {},
      ]
    );
    return result.rows[0];
  }

  async getJobStatus(jobId: string, tenantId: string): Promise<FederationJob | null> {
    const result = await this.pool.query(
      `SELECT * FROM federation_jobs
       WHERE id = $1 AND tenant_id = $2`,
      [jobId, tenantId]
    );
    return result.rows[0] || null;
  }

  async listJobs(tenantId: string, filters?: { status?: string; job_type?: string }): Promise<FederationJob[]> {
    let query = `SELECT * FROM federation_jobs WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters?.status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(filters.status);
    }
    if (filters?.job_type) {
      query += ` AND job_type = $${paramIndex++}`;
      params.push(filters.job_type);
    }

    query += ` ORDER BY created_at DESC`;
    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async cancelJob(jobId: string, tenantId: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE federation_jobs
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND status IN ('pending', 'running')`,
      [jobId, tenantId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ==================== Cluster Metrics ====================

  async getClusterMetrics(clusterId: string, tenantId: string, timeWindow: string = '1h'): Promise<ClusterMetrics | null> {
    // Verify cluster belongs to tenant
    const cluster = await this.getCluster(clusterId, tenantId);
    if (!cluster) return null;

    const result = await this.pool.query(
      `SELECT * FROM federation_cluster_metrics
       WHERE cluster_id = $1 AND time_window = $2
       ORDER BY checked_at DESC
       LIMIT 1`,
      [clusterId, timeWindow]
    );
    return result.rows[0] || null;
  }
}
