/**
 * SandboxService - Phase 4 Digital Twin Enhancement
 *
 * Manages sandbox environments for testing and traffic replay.
 * Provides create, start, stop, destroy, and health-check capabilities.
 */

import { randomUUID } from 'crypto';

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
  private sandboxes = new Map<string, SandboxInstance>();

  async createSandbox(config: SandboxConfig): Promise<SandboxInstance> {
    const id = randomUUID();
    const now = new Date().toISOString();

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

    this.sandboxes.set(id, sandbox);

    // Simulate async creation
    sandbox.status = 'running';
    sandbox.startedAt = now;
    sandbox.healthStatus = 'healthy';

    return sandbox;
  }

  async getSandbox(sandboxId: string): Promise<SandboxInstance | null> {
    return this.sandboxes.get(sandboxId) ?? null;
  }

  async listSandboxes(twinId?: string): Promise<SandboxInstance[]> {
    let sandboxes = Array.from(this.sandboxes.values());
    if (twinId) {
      sandboxes = sandboxes.filter((s) => s.twinId === twinId);
    }
    return sandboxes.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  async stopSandbox(sandboxId: string): Promise<SandboxInstance | null> {
    const sandbox = this.sandboxes.get(sandboxId);
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
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) return null;
    if (sandbox.status !== 'stopped') return null;

    sandbox.status = 'running';
    sandbox.startedAt = new Date().toISOString();
    sandbox.healthStatus = 'healthy';
    return sandbox;
  }

  async destroySandbox(sandboxId: string): Promise<boolean> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) return false;

    sandbox.status = 'destroying';
    this.sandboxes.delete(sandboxId);
    return true;
  }

  async healthCheck(sandboxId: string): Promise<SandboxInstance | null> {
    const sandbox = this.sandboxes.get(sandboxId);
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
    return Array.from(this.sandboxes.values()).filter(
      (s) => s.status === 'running',
    ).length;
  }
}
