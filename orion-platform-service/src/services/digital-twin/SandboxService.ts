/**
 * SandboxService - Phase 4 Digital Twin Enhancement
 *
 * Manages sandbox environments for testing and traffic replay.
 * Provides create, start, stop, destroy, and health-check capabilities.
 * Uses PostgreSQL Repository pattern with in-memory fallback.
 */

import { randomUUID } from 'crypto';
import { DatabasePool } from '../database';
import { SandboxRepository } from '../../repositories/DigitalTwinEnhancedRepository';

export interface SandboxConfig {
  twinId: string;
  name: string;
  snapshotId?: string;
  resources?: {
    cpu?: string;
    memory?: string;
    replicas?: number;
  };
  envVars?: Record<string, string>;
  networkIsolation?: boolean;
  tenantId?: string;
}

export interface SandboxInstance {
  id: string;
  twinId: string;
  name: string;
  status: 'creating' | 'running' | 'stopped' | 'error' | 'destroying';
  endpoint: string;
  snapshotId?: string;
  resources: {
    cpu: string;
    memory: string;
    replicas: number;
  };
  envVars: Record<string, string>;
  networkIsolation: boolean;
  healthStatus: 'healthy' | 'unhealthy' | 'unknown';
  createdAt: string;
  startedAt?: string;
  stoppedAt?: string;
  lastHealthCheck?: string;
}

export class SandboxService {
  private repo?: SandboxRepository;
  private memory = new Map<string, SandboxInstance>();

  constructor(db?: DatabasePool) {
    if (db) {
      this.repo = new SandboxRepository(db);
    }
  }

  // ==================== Repository injection for testing ====================
  setRepository(repo: SandboxRepository): void {
    this.repo = repo;
  }

  async createSandbox(config: SandboxConfig): Promise<SandboxInstance> {
    const id = randomUUID();
    const now = new Date().toISOString();

    if (this.repo) {
      const entity = await this.repo.insert({
        tenant_id: config.tenantId ?? 'default',
        twin_id: config.twinId,
        sandbox_name: config.name,
        snapshot_id: config.snapshotId,
        status: 'running',
        endpoint: `http://sandbox-${id.slice(0, 8)}.local:9000`,
        resources: {
          cpu: config.resources?.cpu ?? '500m',
          memory: config.resources?.memory ?? '512Mi',
          replicas: config.resources?.replicas ?? 1,
        },
        env_vars: config.envVars ?? {},
        network_isolation: config.networkIsolation ?? true,
        health_status: 'healthy',
        started_at: now,
      });
      return this.entityToInstance(entity);
    }

    // 内存回退
    const sandbox: SandboxInstance = {
      id,
      twinId: config.twinId,
      name: config.name,
      status: 'creating',
      endpoint: `http://sandbox-${id.slice(0, 8)}.local:9000`,
      snapshotId: config.snapshotId,
      resources: {
        cpu: config.resources?.cpu ?? '500m',
        memory: config.resources?.memory ?? '512Mi',
        replicas: config.resources?.replicas ?? 1,
      },
      envVars: config.envVars ?? {},
      networkIsolation: config.networkIsolation ?? true,
      healthStatus: 'unknown',
      createdAt: now,
    };

    // Simulate async creation
    sandbox.status = 'running';
    sandbox.startedAt = now;
    sandbox.healthStatus = 'healthy';

    this.memory.set(id, sandbox);
    return sandbox;
  }

  async getSandbox(sandboxId: string): Promise<SandboxInstance | null> {
    if (this.repo) {
      const entity = await this.repo.findById(sandboxId);
      return entity ? this.entityToInstance(entity) : null;
    }
    return this.memory.get(sandboxId) ?? null;
  }

  async listSandboxes(twinId?: string): Promise<SandboxInstance[]> {
    if (this.repo) {
      let entities: any[];
      if (twinId) {
        entities = await this.repo.findByTwin(twinId);
      } else {
        entities = await this.repo.findAll({ limit: 1000 });
        entities = (entities as any).entities || entities;
      }
      return entities.map(e => this.entityToInstance(e))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    // 内存回退
    let sandboxes = Array.from(this.memory.values());
    if (twinId) {
      sandboxes = sandboxes.filter((s) => s.twinId === twinId);
    }
    return sandboxes.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  async stopSandbox(sandboxId: string): Promise<SandboxInstance | null> {
    if (this.repo) {
      const sandbox = await this.repo.findById(sandboxId);
      if (!sandbox) return null;
      if (sandbox.status === 'stopped' || sandbox.status === 'destroying') {
        return null;
      }

      const stoppedAt = new Date().toISOString();
      const updated = await this.repo.updateStatus(sandboxId, 'stopped', stoppedAt);
      return updated ? this.entityToInstance(updated) : null;
    }

    // 内存回退
    const sandbox = this.memory.get(sandboxId);
    if (!sandbox) return null;
    if (sandbox.status === 'stopped' || sandbox.status === 'destroying') {
      return null;
    }

    sandbox.status = 'stopped';
    sandbox.stoppedAt = new Date().toISOString();
    sandbox.healthStatus = 'unknown';
    return sandbox;
  }

  async startSandbox(sandboxId: string): Promise<SandboxInstance | null> {
    if (this.repo) {
      const sandbox = await this.repo.findById(sandboxId);
      if (!sandbox) return null;
      if (sandbox.status !== 'stopped') return null;

      const updated = await this.repo.updateStatus(sandboxId, 'running');
      if (!updated) return null;
      updated.startedAt = new Date().toISOString();
      updated.healthStatus = 'healthy';
      return this.entityToInstance(updated);
    }

    // 内存回退
    const sandbox = this.memory.get(sandboxId);
    if (!sandbox) return null;
    if (sandbox.status !== 'stopped') return null;

    sandbox.status = 'running';
    sandbox.startedAt = new Date().toISOString();
    sandbox.healthStatus = 'healthy';
    return sandbox;
  }

  async destroySandbox(sandboxId: string): Promise<boolean> {
    if (this.repo) {
      const sandbox = await this.repo.findById(sandboxId);
      if (!sandbox) return false;
      return this.repo.deleteById(sandboxId);
    }

    // 内存回退
    const sandbox = this.memory.get(sandboxId);
    if (!sandbox) return false;

    sandbox.status = 'destroying';
    this.memory.delete(sandboxId);
    return true;
  }

  async healthCheck(sandboxId: string): Promise<SandboxInstance | null> {
    if (this.repo) {
      const sandbox = await this.repo.findById(sandboxId);
      if (!sandbox) return null;

      const lastHealthCheck = new Date().toISOString();
      const healthStatus = sandbox.status === 'running' ? 'healthy' : 'unknown';
      const updated = await this.repo.updateHealthCheck(sandboxId, healthStatus, lastHealthCheck);
      return updated ? this.entityToInstance(updated) : null;
    }

    // 内存回退
    const sandbox = this.memory.get(sandboxId);
    if (!sandbox) return null;

    // Simulate health check
    sandbox.lastHealthCheck = new Date().toISOString();
    sandbox.healthStatus =
      sandbox.status === 'running' ? 'healthy' : 'unknown';

    return sandbox;
  }

  async listSandboxesByTwin(twinId: string): Promise<SandboxInstance[]> {
    return this.listSandboxes(twinId);
  }

  getRunningCount(): number {
    if (this.repo) {
      // Repository doesn't have a count by status across all tenants
      // This method is less useful with repository pattern
      return 0;
    }
    return Array.from(this.memory.values()).filter(
      (s) => s.status === 'running',
    ).length;
  }

  private entityToInstance(entity: any): SandboxInstance {
    return {
      id: entity.id,
      twinId: entity.twinId,
      name: entity.name,
      status: entity.status,
      endpoint: entity.endpoint,
      snapshotId: entity.snapshotId,
      resources: entity.resources,
      envVars: entity.envVars ?? {},
      networkIsolation: entity.networkIsolation ?? true,
      healthStatus: entity.healthStatus,
      createdAt: entity.createdAt,
      startedAt: entity.startedAt,
      stoppedAt: entity.stoppedAt,
      lastHealthCheck: entity.lastHealthCheck,
    };
  }
}
