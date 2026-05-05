import { randomUUID } from 'crypto';

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
  private snapshots = new Map<string, DigitalTwinSnapshot>();
  private sandboxes = new Map<string, SandboxInstance>();
  private trafficRecords = new Map<string, TrafficRecord[]>();
  private replayResults = new Map<string, TrafficReplayResult>();

  async createTwinSnapshot(
    tenantId: string,
    config: Record<string, unknown>,
  ): Promise<DigitalTwinSnapshot> {
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
    return this.snapshots.get(snapshotId) ?? null;
  }

  async listSnapshots(tenantId: string): Promise<DigitalTwinSnapshot[]> {
    return Array.from(this.snapshots.values()).filter((s) => s.tenantId === tenantId);
  }

  async createSandbox(
    tenantId: string,
    snapshotId: string,
  ): Promise<SandboxInstance | null> {
    const snapshot = this.snapshots.get(snapshotId);
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
