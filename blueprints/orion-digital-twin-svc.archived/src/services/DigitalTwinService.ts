/**
 * Digital Twin Service - Core business logic with PostgreSQL Repository
 */

import { randomUUID } from 'crypto';
import type {
  DigitalTwin,
  CreateTwinInput,
  DigitalTwinSnapshot,
  SandboxInstance,
  CreateSandboxInput,
  TwinQuery,
  RecordingSession,
  TrafficRecord,
  ReplaySession,
  TrafficReplayResult,
} from '../types/digital-twin';
import { twinRepository } from '../repositories/TwinRepository';

export class DigitalTwinService {
  async registerTwin(tenantId: string, input: CreateTwinInput): Promise<DigitalTwin> {
    const now = new Date().toISOString();
    const twin: DigitalTwin = {
      id: randomUUID(),
      tenantId,
      name: input.name,
      description: input.description,
      config: input.config,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    await twinRepository.createTwin(twin);
    return twin;
  }

  async listTwins(query: TwinQuery): Promise<{ data: DigitalTwin[]; total: number }> {
    return twinRepository.findTwins(query);
  }

  async getTwin(id: string): Promise<DigitalTwin | null> {
    return twinRepository.findTwinById(id);
  }

  async getTwinState(id: string): Promise<Record<string, unknown> | null> {
    const twin = await this.getTwin(id);
    if (!twin) return null;
    return { config: twin.config, status: twin.status, updatedAt: twin.updatedAt };
  }

  async updateTwin(id: string, tenantId: string, input: Partial<CreateTwinInput>): Promise<DigitalTwin> {
    const twin = await twinRepository.findTwinById(id);
    if (!twin || twin.tenantId !== tenantId) {
      throw new Error('Twin not found');
    }
    const updated: DigitalTwin = {
      ...twin,
      ...input,
      updatedAt: new Date().toISOString(),
    };
    await twinRepository.updateTwin(updated);
    return updated;
  }

  async deleteTwin(id: string, tenantId: string): Promise<void> {
    const twin = await twinRepository.findTwinById(id);
    if (!twin || twin.tenantId !== tenantId) {
      throw new Error('Twin not found');
    }
    await twinRepository.deleteTwin(id);
  }

  // ==================== Snapshot Methods ====================

  async createSnapshot(twinId: string, tenantId: string): Promise<DigitalTwinSnapshot> {
    const twin = await this.getTwin(twinId);
    if (!twin || twin.tenantId !== tenantId) {
      throw new Error('Twin not found');
    }
    const snapshot: DigitalTwinSnapshot = {
      id: randomUUID(),
      twinId,
      tenantId,
      config: twin.config,
      createdAt: new Date().toISOString(),
      metadata: { sourceTwin: twin.name },
    };
    await twinRepository.createSnapshot(snapshot);
    return snapshot;
  }

  async listSnapshots(twinId: string): Promise<DigitalTwinSnapshot[]> {
    return twinRepository.findSnapshotsByTwin(twinId);
  }

  async getSnapshot(id: string): Promise<DigitalTwinSnapshot | null> {
    return twinRepository.findSnapshotById(id);
  }

  async deleteSnapshot(id: string, tenantId: string): Promise<void> {
    const snapshot = await twinRepository.findSnapshotById(id);
    if (!snapshot || snapshot.tenantId !== tenantId) {
      throw new Error('Snapshot not found');
    }
    await twinRepository.deleteSnapshot(id);
  }

  // ==================== Sandbox Methods ====================

  async createSandbox(tenantId: string, input: CreateSandboxInput): Promise<SandboxInstance> {
    const sandbox: SandboxInstance = {
      id: randomUUID(),
      tenantId,
      twinId: input.twinId,
      snapshotId: input.snapshotId || '',
      status: 'running',
      createdAt: new Date().toISOString(),
      endpoint: `http://sandbox-${input.twinId}.local:8080`,
    };
    await twinRepository.createSandbox(sandbox);
    return sandbox;
  }

  async listSandboxes(tenantId: string): Promise<SandboxInstance[]> {
    return twinRepository.findSandboxesByTenant(tenantId);
  }

  async getSandbox(id: string): Promise<SandboxInstance | null> {
    return twinRepository.findSandboxById(id);
  }

  async stopSandbox(id: string, tenantId: string): Promise<SandboxInstance> {
    const s = await twinRepository.findSandboxById(id);
    if (!s || s.tenantId !== tenantId) {
      throw new Error('Sandbox not found');
    }
    s.status = 'stopped';
    await twinRepository.updateSandbox(s);
    return s;
  }

  async destroySandbox(id: string, tenantId: string): Promise<void> {
    const s = await twinRepository.findSandboxById(id);
    if (!s || s.tenantId !== tenantId) {
      throw new Error('Sandbox not found');
    }
    await twinRepository.deleteSandbox(id);
  }

  async getSandboxHealth(id: string): Promise<Record<string, unknown>> {
    const s = await twinRepository.findSandboxById(id);
    if (!s) {
      throw new Error('Sandbox not found');
    }
    return { id: s.id, status: s.status, healthy: s.status === 'running', endpoint: s.endpoint };
  }

  // ==================== Traffic Recording Methods ====================

  async recordTraffic(
    twinId: string,
    tenantId: string,
    record: Omit<TrafficRecord, 'id' | 'tenantId' | 'twinId' | 'recordingId' | 'timestamp'>
  ): Promise<TrafficRecord> {
    const r: TrafficRecord = {
      id: randomUUID(),
      twinId,
      tenantId,
      recordingId: 'default',
      timestamp: new Date().toISOString(),
      ...record,
    };
    await twinRepository.createTrafficRecord(r);
    return r;
  }

  async startRecordingSession(twinId: string, tenantId: string): Promise<RecordingSession> {
    const s: RecordingSession = {
      id: randomUUID(),
      twinId,
      tenantId,
      status: 'recording',
      startedAt: new Date().toISOString(),
      recordCount: 0,
    };
    await twinRepository.createRecordingSession(s);
    return s;
  }

  async listRecordingSessions(twinId: string): Promise<RecordingSession[]> {
    return twinRepository.findRecordingSessionsByTwin(twinId);
  }

  async getRecordingSession(id: string): Promise<RecordingSession | null> {
    return twinRepository.findRecordingSessionById(id);
  }

  async stopRecordingSession(sessionId: string, tenantId: string): Promise<RecordingSession> {
    const s = await twinRepository.findRecordingSessionById(sessionId);
    if (!s || s.tenantId !== tenantId) {
      throw new Error('Recording session not found');
    }
    s.status = 'stopped';
    s.stoppedAt = new Date().toISOString();
    await twinRepository.updateRecordingSession(s);
    return s;
  }

  async pauseRecordingSession(sessionId: string, tenantId: string): Promise<RecordingSession> {
    const s = await twinRepository.findRecordingSessionById(sessionId);
    if (!s || s.tenantId !== tenantId) {
      throw new Error('Recording session not found');
    }
    s.status = 'paused';
    await twinRepository.updateRecordingSession(s);
    return s;
  }

  async getRecordingDetail(sessionId: string): Promise<RecordingSession | null> {
    return twinRepository.findRecordingSessionById(sessionId);
  }

  async getRecordingRecords(sessionId: string, limit = 100): Promise<TrafficRecord[]> {
    return twinRepository.findTrafficRecordsBySession(sessionId, limit);
  }

  async deleteRecordingSession(id: string, tenantId: string): Promise<void> {
    const session = await twinRepository.findRecordingSessionById(id);
    if (!session || session.tenantId !== tenantId) {
      throw new Error('Recording session not found');
    }
    await twinRepository.deleteRecordingSession(id);
  }

  // ==================== Replay Methods ====================

  async replayTraffic(twinId: string, tenantId: string, records: TrafficRecord[]): Promise<TrafficReplayResult> {
    const result: TrafficReplayResult = {
      id: randomUUID(),
      twinId,
      recordingId: 'manual',
      totalRequests: records.length,
      succeeded: 0,
      failed: 0,
      startedAt: new Date().toISOString(),
      status: 'running',
    };
    await twinRepository.createReplayResult(result);
    return result;
  }

  async startReplaySession(
    twinId: string,
    tenantId: string,
    recordingId: string,
    speedMultiplier = 1
  ): Promise<ReplaySession> {
    const s: ReplaySession = {
      id: randomUUID(),
      twinId,
      tenantId,
      recordingId,
      status: 'replaying',
      startedAt: new Date().toISOString(),
      speedMultiplier,
    };
    await twinRepository.createReplaySession(s);
    return s;
  }

  async listReplaySessions(twinId: string): Promise<ReplaySession[]> {
    return twinRepository.findReplaySessionsByTwin(twinId);
  }

  async getReplayStatus(replayId: string): Promise<ReplaySession | null> {
    return twinRepository.findReplaySessionById(replayId);
  }

  async getReplayReport(replayId: string): Promise<TrafficReplayResult | null> {
    return twinRepository.findReplayResultById(replayId);
  }

  async cancelReplay(replayId: string, tenantId: string): Promise<ReplaySession> {
    const s = await twinRepository.findReplaySessionById(replayId);
    if (!s || s.tenantId !== tenantId) {
      throw new Error('Replay session not found');
    }
    s.status = 'cancelled';
    s.completedAt = new Date().toISOString();
    await twinRepository.updateReplaySession(s);
    return s;
  }

  async deleteReplaySession(id: string, tenantId: string): Promise<void> {
    const session = await twinRepository.findReplaySessionById(id);
    if (!session || session.tenantId !== tenantId) {
      throw new Error('Replay session not found');
    }
    await twinRepository.deleteReplaySession(id);
  }

  async listReplayResults(twinId: string): Promise<TrafficReplayResult[]> {
    return twinRepository.findReplayResultsByTwin(twinId);
  }
}

export const digitalTwinService = new DigitalTwinService();