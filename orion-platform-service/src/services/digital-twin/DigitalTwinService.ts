/**
 * DigitalTwinService - Simplified Digital Twin Management Service
 *
 * Provides high-level digital twin operations including:
 * - Snapshot management (config snapshots)
 * - Sandbox instances
 * - Traffic recording and replay
 *
 * Uses PostgreSQL Repository pattern with in-memory fallback.
 */

import { randomUUID } from 'crypto';
import pino from 'pino';
import { DatabasePool } from '../database';
import { DigitalTwinSnapshotRepository } from '../../repositories/DigitalTwinSnapshotRepository';
import { TwinConfigRepository, TwinConfigEntity, SandboxEntity, SandboxRepository, RecordingSessionEntity, RecordingSessionRepository, ReplaySessionEntity, ReplaySessionRepository } from '../../repositories/DigitalTwinEnhancedRepository';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface DigitalTwinSnapshot {
  id: string;
  tenantId: string;
  config: Record<string, unknown>;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface SandboxInstance {
  id: string;
  tenantId: string;
  snapshotId: string;
  status: 'running' | 'stopped' | 'error';
  createdAt: string;
  endpoint?: string;
}

export interface TrafficRecord {
  id: string;
  tenantId: string;
  twinId: string;
  timestamp: string;
  method: string;
  path: string;
  statusCode: number;
  latency: number;
  payload?: Record<string, unknown>;
}

export interface TrafficReplayResult {
  id: string;
  twinId: string;
  totalRequests: number;
  succeeded: number;
  failed: number;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed';
}

export class DigitalTwinService {
  private snapshotRepository?: DigitalTwinSnapshotRepository;
  private twinConfigRepository?: TwinConfigRepository;
  private sandboxRepository?: SandboxRepository;
  private recordingSessionRepository?: RecordingSessionRepository;
  private replaySessionRepository?: ReplaySessionRepository;

  // 内存回退模式
  private snapshots = new Map<string, DigitalTwinSnapshot>();
  private sandboxes = new Map<string, SandboxInstance>();
  private trafficRecords = new Map<string, TrafficRecord[]>();
  private replayResults = new Map<string, TrafficReplayResult>();
  private twins = new Map<string, TwinConfigEntity>();

  constructor(db?: DatabasePool) {
    if (db) {
      this.snapshotRepository = new DigitalTwinSnapshotRepository(db);
      this.twinConfigRepository = new TwinConfigRepository(db);
      this.sandboxRepository = new SandboxRepository(db);
      this.recordingSessionRepository = new RecordingSessionRepository(db);
      this.replaySessionRepository = new ReplaySessionRepository(db);
    }
  }

  // ==================== Twin Config Operations (DigitalTwinEnhancedRepository integration) ====================

  /**
   * Create a new digital twin configuration
   */
  async createTwin(
    tenantId: string,
    input: {
      name: string;
      description?: string;
      environment: 'dev' | 'staging' | 'prod';
      services: string[];
      syncInterval?: number;
    }
  ): Promise<TwinConfigEntity> {
    if (this.twinConfigRepository) {
      const entity = await this.twinConfigRepository.insert({
        tenant_id: tenantId,
        twin_name: input.name,
        description: input.description,
        environment: input.environment,
        services: input.services,
        sync_interval: input.syncInterval ?? 60,
        data_retention_days: 30,
      });
      logger.info({ twinId: entity.id, name: input.name }, '[DigitalTwinService] Created twin');
      return entity;
    }

    // Memory fallback
    const twin: TwinConfigEntity = {
      id: randomUUID(),
      tenantId,
      twinName: input.name,
      description: input.description,
      environment: input.environment,
      services: input.services,
      syncInterval: input.syncInterval ?? 60,
      dataRetentionDays: 30,
      status: 'active',
      healthScore: 100,
      serviceStates: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.twins.set(twin.id, twin);
    return twin;
  }

  /**
   * Get a digital twin by ID
   */
  async getTwin(twinId: string): Promise<TwinConfigEntity | null> {
    if (this.twinConfigRepository) {
      return this.twinConfigRepository.findById(twinId);
    }
    return this.twins.get(twinId) ?? null;
  }

  /**
   * List all digital twins for a tenant
   */
  async listTwins(tenantId: string): Promise<TwinConfigEntity[]> {
    if (this.twinConfigRepository) {
      return this.twinConfigRepository.findByTenant(tenantId);
    }
    return Array.from(this.twins.values()).filter((t) => t.tenantId === tenantId);
  }

  /**
   * Update a digital twin
   */
  async updateTwin(
    twinId: string,
    updates: Partial<Pick<TwinConfigEntity, 'twinName' | 'description' | 'services' | 'syncInterval' | 'status' | 'serviceStates' | 'healthScore'>>
  ): Promise<TwinConfigEntity | null> {
    if (this.twinConfigRepository) {
      if (updates.status) {
        return this.twinConfigRepository.updateStatus(twinId, updates.status, new Date().toISOString());
      }
      if (updates.serviceStates || updates.healthScore) {
        return this.twinConfigRepository.updateServiceStates(
          twinId,
          updates.serviceStates ?? {},
          updates.healthScore ?? 100,
          new Date().toISOString()
        );
      }
      // For other updates, use findById and update locally
      const existing = await this.twinConfigRepository.findById(twinId);
      if (!existing) return null;
    }

    const twin = this.twins.get(twinId);
    if (!twin) return null;

    const updated = { ...twin, ...updates, updatedAt: new Date().toISOString() };
    this.twins.set(twinId, updated);
    return updated;
  }

  /**
   * Delete a digital twin
   */
  async deleteTwin(twinId: string): Promise<boolean> {
    if (this.twinConfigRepository) {
      return this.twinConfigRepository.deleteById(twinId);
    }
    return this.twins.delete(twinId);
  }

  /**
   * Get metrics for a digital twin
   */
  async getMetrics(twinId: string): Promise<{
    healthScore: number;
    status: string;
    serviceCount: number;
    lastSyncAt?: string;
    sandboxCount?: number;
    recordingCount?: number;
  }> {
    const twin = await this.getTwin(twinId);
    if (!twin) {
      throw new Error(`Twin not found: ${twinId}`);
    }

    let sandboxCount = 0;
    let recordingCount = 0;

    if (this.sandboxRepository) {
      const sandboxes = await this.sandboxRepository.findByTwin(twinId);
      sandboxCount = sandboxes.length;
    }

    if (this.recordingSessionRepository) {
      const recordings = await this.recordingSessionRepository.findByTwin(twinId);
      recordingCount = recordings.length;
    }

    return {
      healthScore: twin.healthScore,
      status: twin.status,
      serviceCount: twin.services.length,
      lastSyncAt: twin.lastSyncAt,
      sandboxCount,
      recordingCount,
    };
  }

  /**
   * Sync twin with production environment
   */
  async syncTwin(twinId: string): Promise<{ success: boolean; syncedAt: string }> {
    const twin = await this.getTwin(twinId);
    if (!twin) {
      throw new Error(`Twin not found: ${twinId}`);
    }

    if (this.twinConfigRepository) {
      await this.twinConfigRepository.updateLastSync(twinId, new Date().toISOString(), new Date().toISOString());
    }

    // Update status to syncing
    await this.updateTwin(twinId, { status: 'syncing' });

    // Simulate sync - in production would collect actual metrics
    const serviceStates: Record<string, { status: string; latency: number }> = {};
    for (const service of twin.services) {
      serviceStates[service] = { status: 'healthy', latency: Math.floor(Math.random() * 100) };
    }

    const healthScore = 95 + Math.floor(Math.random() * 5);

    await this.updateTwin(twinId, {
      status: 'active',
      serviceStates,
      healthScore,
    });

    logger.info({ twinId, healthScore }, '[DigitalTwinService] Twin synced');
    return { success: true, syncedAt: new Date().toISOString() };
  }

  // ==================== Sandbox Operations ====================

  /**
   * Create a sandbox environment from a twin
   */
  async createSandbox(
    tenantId: string,
    twinId: string,
    options?: { name?: string; resources?: { cpu: string; memory: string; replicas: number } }
  ): Promise<SandboxEntity | null> {
    const twin = await this.getTwin(twinId);
    if (!twin || twin.tenantId !== tenantId) {
      return null;
    }

    if (this.sandboxRepository) {
      const entity = await this.sandboxRepository.insert({
        tenant_id: tenantId,
        twin_id: twinId,
        sandbox_name: options?.name ?? `sandbox-${Date.now()}`,
        status: 'creating',
        endpoint: `http://sandbox-${randomUUID().slice(0, 8)}.local:9000`,
        resources: options?.resources ?? { cpu: '500m', memory: '512Mi', replicas: 1 },
        env_vars: {},
        network_isolation: true,
        health_status: 'unknown',
      });

      logger.info({ sandboxId: entity.id, twinId }, '[DigitalTwinService] Created sandbox');
      return entity;
    }

    // Memory fallback
    const sandbox: SandboxEntity = {
      id: randomUUID(),
      tenantId,
      twinId,
      name: options?.name ?? `sandbox-${Date.now()}`,
      status: 'running',
      endpoint: `http://sandbox-${randomUUID().slice(0, 8)}.local:9000`,
      resources: options?.resources ?? { cpu: '500m', memory: '512Mi', replicas: 1 },
      envVars: {},
      networkIsolation: true,
      healthStatus: 'healthy',
      createdAt: new Date().toISOString(),
    };
    this.sandboxes.set(sandbox.id, {
      id: sandbox.id,
      tenantId: sandbox.tenantId,
      snapshotId: twinId,
      status: 'running',
      createdAt: sandbox.createdAt,
      endpoint: sandbox.endpoint,
    });
    return sandbox;
  }

  /**
   * List sandboxes for a twin
   */
  async listSandboxes(twinId: string): Promise<SandboxEntity[]> {
    if (this.sandboxRepository) {
      return this.sandboxRepository.findByTwin(twinId);
    }
    return Array.from(this.sandboxes.values()).filter((s) => s.snapshotId === twinId);
  }

  /**
   * Stop a sandbox
   */
  async stopSandbox(sandboxId: string): Promise<boolean> {
    if (this.sandboxRepository) {
      const result = await this.sandboxRepository.updateStatus(sandboxId, 'stopped', new Date().toISOString());
      return result !== null;
    }

    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) return false;
    sandbox.status = 'stopped';
    return true;
  }

  // ==================== Snapshot Operations ====================

  async createTwinSnapshot(
    tenantId: string,
    config: Record<string, unknown>,
  ): Promise<DigitalTwinSnapshot> {
    if (this.snapshotRepository) {
      const entity = await this.snapshotRepository.createSnapshot({
        tenant_id: tenantId,
        name: `snapshot-${Date.now()}`,
        config,
        metadata: {},
      });
      return {
        id: entity.id,
        tenantId: entity.tenantId,
        config: entity.config,
        createdAt: entity.createdAt.toISOString(),
        metadata: entity.metadata,
      };
    }

    // 内存回退
    const snapshot: DigitalTwinSnapshot = {
      id: randomUUID(),
      tenantId,
      config,
      createdAt: new Date().toISOString(),
      metadata: {},
    };
    this.snapshots.set(snapshot.id, snapshot);
    return snapshot;
  }

  async getSnapshot(snapshotId: string): Promise<DigitalTwinSnapshot | null> {
    if (this.snapshotRepository) {
      const entity = await this.snapshotRepository.findById(snapshotId);
      if (!entity) return null;
      return {
        id: entity.id,
        tenantId: entity.tenantId,
        config: entity.config,
        createdAt: entity.createdAt.toISOString(),
        metadata: entity.metadata,
      };
    }
    return this.snapshots.get(snapshotId) ?? null;
  }

  async listSnapshots(tenantId: string): Promise<DigitalTwinSnapshot[]> {
    if (this.snapshotRepository) {
      const entities = await this.snapshotRepository.findByTenantAndActive(tenantId);
      return entities.map(e => ({
        id: e.id,
        tenantId: e.tenantId,
        config: e.config,
        createdAt: e.createdAt.toISOString(),
        metadata: e.metadata,
      }));
    }
    return Array.from(this.snapshots.values()).filter((s) => s.tenantId === tenantId);
  }

  // ==================== Sandbox Operations ====================

  async createSandbox(
    tenantId: string,
    snapshotId: string,
  ): Promise<SandboxInstance | null> {
    // 验证 snapshot 存在
    const snapshot = await this.getSnapshot(snapshotId);
    if (!snapshot || snapshot.tenantId !== tenantId) {
      return null;
    }

    const sandboxId = randomUUID();
    const sandbox: SandboxInstance = {
      id: sandboxId,
      tenantId,
      snapshotId,
      status: 'running',
      createdAt: new Date().toISOString(),
      endpoint: `http://sandbox-${sandboxId.slice(0, 8)}.local:9000`,
    };
    this.sandboxes.set(sandbox.id, sandbox);
    return sandbox;
  }

  async stopSandbox(sandboxId: string): Promise<boolean> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) return false;
    sandbox.status = 'stopped';
    return true;
  }

  async getSandbox(sandboxId: string): Promise<SandboxInstance | null> {
    return this.sandboxes.get(sandboxId) ?? null;
  }

  async listSandboxes(tenantId: string): Promise<SandboxInstance[]> {
    return Array.from(this.sandboxes.values()).filter((s) => s.tenantId === tenantId);
  }

  // ==================== Traffic Recording Operations ====================

  async recordTraffic(
    tenantId: string,
    twinId: string,
    traffic: Omit<TrafficRecord, 'id' | 'tenantId' | 'twinId' | 'timestamp'>,
  ): Promise<TrafficRecord> {
    const key = `${tenantId}:${twinId}`;
    const record: TrafficRecord = {
      id: randomUUID(),
      tenantId,
      twinId,
      timestamp: new Date().toISOString(),
      ...traffic,
    };

    if (!this.trafficRecords.has(key)) {
      this.trafficRecords.set(key, []);
    }
    this.trafficRecords.get(key)!.push(record);
    return record;
  }

  async getTrafficRecords(
    tenantId: string,
    twinId: string,
  ): Promise<TrafficRecord[]> {
    const key = `${tenantId}:${twinId}`;
    return this.trafficRecords.get(key) ?? [];
  }

  // ==================== Traffic Replay Operations ====================

  async replayTraffic(
    tenantId: string,
    twinId: string,
    config: { speed?: number; filter?: string; limit?: number } = {},
  ): Promise<TrafficReplayResult> {
    const key = `${tenantId}:${twinId}`;
    let records = this.trafficRecords.get(key) ?? [];

    if (config.filter) {
      records = records.filter((r) => r.path.includes(config.filter!));
    }
    if (config.limit) {
      records = records.slice(0, config.limit);
    }

    const result: TrafficReplayResult = {
      id: randomUUID(),
      twinId,
      totalRequests: records.length,
      succeeded: Math.floor(records.length * 0.95),
      failed: records.length - Math.floor(records.length * 0.95),
      startedAt: new Date().toISOString(),
      status: 'completed',
    };
    this.replayResults.set(result.id, result);
    return result;
  }

  async getReplayResult(replayId: string): Promise<TrafficReplayResult | null> {
    return this.replayResults.get(replayId) ?? null;
  }
}

export default DigitalTwinService;