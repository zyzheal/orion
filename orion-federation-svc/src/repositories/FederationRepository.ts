/**
 * Federation Repository - Stub Implementation
 *
 * In-memory stub for Executor and ExecutorHealth repositories.
 * Used by FederationService when PostgreSQL repositories are not available.
 */

import { DatabasePool } from '../utils/database';

export interface ExecutorEntity {
  id: string;
  cluster_id: string;
  name: string;
  region: string;
  status: string;
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

export interface ExecutorHealthEntity {
  executor_id: string;
  status: string;
  cpu_usage_pct: number;
  memory_usage_pct: number;
  running_jobs: number;
  queue_depth: number;
  last_heartbeat: Date;
  response_time_ms: number;
  errors_last_hour: number;
}

export class ExecutorRepository {
  private store = new Map<string, ExecutorEntity>();

  constructor(_pool: DatabasePool) {}

  async create(data: Partial<ExecutorEntity> & { id: string }): Promise<ExecutorEntity> {
    const entity: ExecutorEntity = {
      id: data.id,
      cluster_id: data.cluster_id || '',
      name: data.name || '',
      region: data.region || '',
      status: data.status || 'online',
      cpu_capacity: data.cpu_capacity || 0,
      memory_capacity_mb: data.memory_capacity_mb || 0,
      cpu_used: data.cpu_used || 0,
      memory_used_mb: data.memory_used_mb || 0,
      running_jobs: data.running_jobs || 0,
      max_concurrent_jobs: data.max_concurrent_jobs || 10,
      last_heartbeat: data.last_heartbeat || new Date(),
      registered_at: data.registered_at || new Date(),
      labels: data.labels || {},
    };
    this.store.set(entity.id, entity);
    return entity;
  }

  async findById(id: string): Promise<ExecutorEntity | null> {
    return this.store.get(id) || null;
  }

  async findAll(_options?: { limit?: number }): Promise<{ entities: ExecutorEntity[] }> {
    return { entities: Array.from(this.store.values()) };
  }

  async findAllActive(): Promise<ExecutorEntity[]> {
    return Array.from(this.store.values()).filter(e => e.status === 'online');
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }

  async updateHeartbeat(id: string, data: { cpu_used?: number; memory_used_mb?: number; running_jobs?: number }): Promise<boolean> {
    const entity = this.store.get(id);
    if (!entity) return false;
    if (data.cpu_used !== undefined) entity.cpu_used = data.cpu_used;
    if (data.memory_used_mb !== undefined) entity.memory_used_mb = data.memory_used_mb;
    if (data.running_jobs !== undefined) entity.running_jobs = data.running_jobs;
    entity.last_heartbeat = new Date();
    return true;
  }
}

export class ExecutorHealthRepository {
  private store = new Map<string, ExecutorHealthEntity>();

  constructor(_pool: DatabasePool) {}

  async upsert(data: Partial<ExecutorHealthEntity> & { executor_id: string }): Promise<ExecutorHealthEntity> {
    const entity: ExecutorHealthEntity = {
      executor_id: data.executor_id,
      status: data.status || 'healthy',
      cpu_usage_pct: data.cpu_usage_pct || 0,
      memory_usage_pct: data.memory_usage_pct || 0,
      running_jobs: data.running_jobs || 0,
      queue_depth: data.queue_depth || 0,
      last_heartbeat: data.last_heartbeat || new Date(),
      response_time_ms: data.response_time_ms || 0,
      errors_last_hour: data.errors_last_hour || 0,
    };
    this.store.set(entity.executor_id, entity);
    return entity;
  }

  async findByExecutor(executorId: string): Promise<ExecutorHealthEntity | null> {
    return this.store.get(executorId) || null;
  }

  async findAllLatest(): Promise<ExecutorHealthEntity[]> {
    return Array.from(this.store.values());
  }
}
