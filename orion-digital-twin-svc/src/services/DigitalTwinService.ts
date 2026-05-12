/**
 * Digital Twin Service - Core business logic with in-memory storage
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

class TwinRepository {
  private twins = new Map<string, DigitalTwin>();
  private snapshots = new Map<string, DigitalTwinSnapshot>();
  private sandboxes = new Map<string, SandboxInstance>();
  private trafficRecords = new Map<string, TrafficRecord>();
  private recordingSessions = new Map<string, RecordingSession>();
  private replaySessions = new Map<string, ReplaySession>();
  private replayResults = new Map<string, TrafficReplayResult>();

  async createTwin(twin: DigitalTwin): Promise<void> { this.twins.set(twin.id, twin); }
  async findTwins(query: TwinQuery): Promise<{ data: DigitalTwin[]; total: number }> {
    let data = Array.from(this.twins.values());
    if (query.tenantId) data = data.filter(t => t.tenantId === query.tenantId);
    return { data, total: data.length };
  }
  async findTwinById(id: string): Promise<DigitalTwin | null> { return this.twins.get(id) || null; }
  async createSnapshot(s: DigitalTwinSnapshot): Promise<void> { this.snapshots.set(s.id, s); }
  async createSandbox(s: SandboxInstance): Promise<void> { this.sandboxes.set(s.id, s); }
  async findSandboxById(id: string): Promise<SandboxInstance | null> { return this.sandboxes.get(id) || null; }
  async findSandboxesByTenant(t: string): Promise<SandboxInstance[]> { return Array.from(this.sandboxes.values()).filter(s => s.tenantId === t); }
  async updateSandbox(s: SandboxInstance): Promise<void> { this.sandboxes.set(s.id, s); }
  async deleteSandbox(id: string): Promise<void> { this.sandboxes.delete(id); }
  async createTrafficRecord(r: TrafficRecord): Promise<void> { this.trafficRecords.set(r.id, r); }
  async createRecordingSession(s: RecordingSession): Promise<void> { this.recordingSessions.set(s.id, s); }
  async findRecordingSessionsByTwin(t: string): Promise<RecordingSession[]> { return Array.from(this.recordingSessions.values()).filter(s => s.twinId === t); }
  async findRecordingSessionById(id: string): Promise<RecordingSession | null> { return this.recordingSessions.get(id) || null; }
  async updateRecordingSession(s: RecordingSession): Promise<void> { this.recordingSessions.set(s.id, s); }
  async findTrafficRecordsBySession(s: string, limit: number): Promise<TrafficRecord[]> { return Array.from(this.trafficRecords.values()).filter(r => r.recordingId === s).slice(0, limit); }
  async createReplayResult(r: TrafficReplayResult): Promise<void> { this.replayResults.set(r.id, r); }
  async createReplaySession(s: ReplaySession): Promise<void> { this.replaySessions.set(s.id, s); }
  async findReplaySessionsByTwin(t: string): Promise<ReplaySession[]> { return Array.from(this.replaySessions.values()).filter(s => s.twinId === t); }
  async findReplaySessionById(id: string): Promise<ReplaySession | null> { return this.replaySessions.get(id) || null; }
  async findReplayResultById(id: string): Promise<TrafficReplayResult | null> { return this.replayResults.get(id) || null; }
  async updateReplaySession(s: ReplaySession): Promise<void> { this.replaySessions.set(s.id, s); }
}

export class DigitalTwinService {
  private repo = new TwinRepository();

  async registerTwin(tenantId: string, input: CreateTwinInput): Promise<DigitalTwin> {
    const twin: DigitalTwin = { id: randomUUID(), tenantId, name: input.name, description: input.description, config: input.config, status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await this.repo.createTwin(twin);
    return twin;
  }
  async listTwins(query: TwinQuery): Promise<{ data: DigitalTwin[]; total: number }> { return this.repo.findTwins(query); }
  async getTwin(id: string): Promise<DigitalTwin | null> { return this.repo.findTwinById(id); }
  async getTwinState(id: string): Promise<Record<string, unknown> | null> {
    const twin = await this.getTwin(id);
    if (!twin) return null;
    return { config: twin.config, status: twin.status, updatedAt: twin.updatedAt };
  }

  async createSnapshot(twinId: string, tenantId: string): Promise<DigitalTwinSnapshot> {
    const twin = await this.getTwin(twinId);
    if (!twin || twin.tenantId !== tenantId) throw new Error('Twin not found');
    const snapshot: DigitalTwinSnapshot = { id: randomUUID(), twinId, tenantId, config: twin.config, createdAt: new Date().toISOString(), metadata: { sourceTwin: twin.name } };
    await this.repo.createSnapshot(snapshot);
    return snapshot;
  }

  async createSandbox(tenantId: string, input: CreateSandboxInput): Promise<SandboxInstance> {
    const sandbox: SandboxInstance = { id: randomUUID(), tenantId, twinId: input.twinId, snapshotId: input.snapshotId || '', status: 'running', createdAt: new Date().toISOString(), endpoint: `http://sandbox-${input.twinId}.local:8080` };
    await this.repo.createSandbox(sandbox);
    return sandbox;
  }
  async listSandboxes(tenantId: string): Promise<SandboxInstance[]> { return this.repo.findSandboxesByTenant(tenantId); }
  async stopSandbox(id: string, tenantId: string): Promise<SandboxInstance> {
    const s = await this.repo.findSandboxById(id);
    if (!s || s.tenantId !== tenantId) throw new Error('Sandbox not found');
    s.status = 'stopped';
    await this.repo.updateSandbox(s);
    return s;
  }
  async destroySandbox(id: string, tenantId: string): Promise<void> {
    const s = await this.repo.findSandboxById(id);
    if (!s || s.tenantId !== tenantId) throw new Error('Sandbox not found');
    await this.repo.deleteSandbox(id);
  }
  async getSandboxHealth(id: string): Promise<Record<string, unknown>> {
    const s = await this.repo.findSandboxById(id);
    if (!s) throw new Error('Sandbox not found');
    return { id: s.id, status: s.status, healthy: s.status === 'running', endpoint: s.endpoint };
  }

  async recordTraffic(twinId: string, tenantId: string, record: Omit<TrafficRecord, 'id' | 'tenantId' | 'twinId' | 'recordingId' | 'timestamp'>): Promise<TrafficRecord> {
    const r: TrafficRecord = { id: randomUUID(), twinId, tenantId, recordingId: 'default', timestamp: new Date().toISOString(), ...record };
    await this.repo.createTrafficRecord(r);
    return r;
  }
  async startRecordingSession(twinId: string, tenantId: string): Promise<RecordingSession> {
    const s: RecordingSession = { id: randomUUID(), twinId, tenantId, status: 'recording', startedAt: new Date().toISOString(), recordCount: 0 };
    await this.repo.createRecordingSession(s);
    return s;
  }
  async listRecordingSessions(twinId: string): Promise<RecordingSession[]> { return this.repo.findRecordingSessionsByTwin(twinId); }
  async stopRecordingSession(sessionId: string, tenantId: string): Promise<RecordingSession> {
    const s = await this.repo.findRecordingSessionById(sessionId);
    if (!s || s.tenantId !== tenantId) throw new Error('Session not found');
    s.status = 'stopped'; s.stoppedAt = new Date().toISOString();
    await this.repo.updateRecordingSession(s);
    return s;
  }
  async pauseRecordingSession(sessionId: string, tenantId: string): Promise<RecordingSession> {
    const s = await this.repo.findRecordingSessionById(sessionId);
    if (!s || s.tenantId !== tenantId) throw new Error('Session not found');
    s.status = 'paused';
    await this.repo.updateRecordingSession(s);
    return s;
  }
  async getRecordingDetail(sessionId: string): Promise<RecordingSession | null> { return this.repo.findRecordingSessionById(sessionId); }
  async getRecordingRecords(sessionId: string, limit = 100): Promise<TrafficRecord[]> { return this.repo.findTrafficRecordsBySession(sessionId, limit); }

  async replayTraffic(twinId: string, tenantId: string, records: TrafficRecord[]): Promise<TrafficReplayResult> {
    const result: TrafficReplayResult = { id: randomUUID(), twinId, recordingId: 'manual', totalRequests: records.length, succeeded: 0, failed: 0, startedAt: new Date().toISOString(), status: 'running' };
    await this.repo.createReplayResult(result);
    return result;
  }
  async startReplaySession(twinId: string, tenantId: string, recordingId: string, speedMultiplier = 1): Promise<ReplaySession> {
    const s: ReplaySession = { id: randomUUID(), twinId, tenantId, recordingId, status: 'replaying', startedAt: new Date().toISOString(), speedMultiplier };
    await this.repo.createReplaySession(s);
    return s;
  }
  async listReplaySessions(twinId: string): Promise<ReplaySession[]> { return this.repo.findReplaySessionsByTwin(twinId); }
  async getReplayStatus(replayId: string): Promise<ReplaySession | null> { return this.repo.findReplaySessionById(replayId); }
  async getReplayReport(replayId: string): Promise<TrafficReplayResult | null> { return this.repo.findReplayResultById(replayId); }
  async cancelReplay(replayId: string, tenantId: string): Promise<ReplaySession> {
    const s = await this.repo.findReplaySessionById(replayId);
    if (!s || s.tenantId !== tenantId) throw new Error('Replay not found');
    s.status = 'cancelled'; s.completedAt = new Date().toISOString();
    await this.repo.updateReplaySession(s);
    return s;
  }
}
