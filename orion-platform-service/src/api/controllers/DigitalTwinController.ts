/**
 * DigitalTwinController - 数字孪生 API 控制器 (Enhanced Phase 4)
 *
 * 处理数字孪生注册、状态管理、快照、沙箱、流量录制与回放
 * Enhanced with recording session management and replay status tracking.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './BaseController';
import { TrafficRecorderService, RecordingConfig, RecordingSession } from '../../services/digital-twin/TrafficRecorderService';
import { TrafficReplayService, ReplayConfig, ReplaySession } from '../../services/digital-twin/TrafficReplayService';
import { SandboxService, SandboxConfig } from '../../services/digital-twin/SandboxService';

interface DigitalTwin {
  id: string;
  name: string;
  serviceType: string;
  sourceService: string;
  status: 'active' | 'paused' | 'stopped';
  createdAt: string;
}

interface TwinState {
  twinId: string;
  status: string;
  replicas: number;
  cpuUsage: number;
  memoryUsage: number;
  networkIO: { inbound: string; outbound: string };
  lastSync: string;
}

interface Sandbox {
  id: string;
  twinId: string;
  name: string;
  status: 'running' | 'stopped';
  createdAt: string;
  endpoint?: string;
}

interface TrafficRecord {
  id: string;
  twinId: string;
  type: 'record' | 'replay';
  requestCount: number;
  duration: string;
  startedAt: string;
  completedAt?: string;
}

export class DigitalTwinController extends BaseController {
  private twins = new Map<string, DigitalTwin>();
  private sandboxes = new Map<string, Sandbox>();
  private trafficRecords = new Map<string, TrafficRecord[]>();
  private snapshots = new Map<string, { id: string; twinId: string; name: string; createdAt: string }[]>();

  // Phase 4 Enhanced services
  private trafficRecorder: TrafficRecorderService;
  private trafficReplayer: TrafficReplayService;
  private sandboxService: SandboxService;

  constructor() {
    super();
    this.trafficRecorder = new TrafficRecorderService();
    this.trafficReplayer = new TrafficReplayService();
    this.sandboxService = new SandboxService();
  }

  async registerTwin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const body = request.body as {
        name: string;
        serviceType: string;
        sourceService: string;
      };
      const id = `twin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const twin: DigitalTwin = {
        id,
        name: body.name,
        serviceType: body.serviceType,
        sourceService: body.sourceService,
        status: 'active',
        createdAt: new Date().toISOString(),
      };
      this.twins.set(id, twin);
      this.snapshots.set(id, []);
      this.trafficRecords.set(id, []);
      return twin;
    }, (twin) => this.sendCreated(reply, twin));
  }

  async listTwins(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      return Array.from(this.twins.values());
    }, (twins) => this.sendSuccess(reply, twins));
  }

  async getTwinState(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { id: string };
      const twin = this.twins.get(params.id);
      if (!twin) throw new Error(`Twin '${params.id}' not found`);
      const state: TwinState = {
        twinId: twin.id,
        status: twin.status,
        replicas: 3,
        cpuUsage: Math.floor(Math.random() * 60),
        memoryUsage: Math.floor(Math.random() * 70),
        networkIO: { inbound: `${Math.floor(Math.random() * 100)}MB/s`, outbound: `${Math.floor(Math.random() * 50)}MB/s` },
        lastSync: new Date().toISOString(),
      };
      return state;
    }, (state) => this.sendSuccess(reply, state));
  }

  async createSnapshot(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { id: string };
      const body = request.body as { name: string };
      const twin = this.twins.get(params.id);
      if (!twin) throw new Error(`Twin '${params.id}' not found`);
      const snapshot = {
        id: `snap-${Date.now()}`,
        twinId: params.id,
        name: body.name,
        createdAt: new Date().toISOString(),
      };
      const snaps = this.snapshots.get(params.id) || [];
      snaps.push(snapshot);
      this.snapshots.set(params.id, snaps);
      return snapshot;
    }, (snapshot) => this.sendCreated(reply, snapshot));
  }

  // ==================== Phase 4: Sandbox Management ====================

  async createSandbox(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const body = request.body as { twinId: string; name: string; snapshotId?: string };
      const twin = this.twins.get(body.twinId);
      if (!twin) throw new Error(`Twin '${body.twinId}' not found`);

      const config: SandboxConfig = {
        twinId: body.twinId,
        name: body.name,
        snapshotId: body.snapshotId,
      };

      const sandbox = await this.sandboxService.createSandbox(config);

      // Also register in legacy map for backward compatibility
      const legacySandbox: Sandbox = {
        id: sandbox.id,
        twinId: sandbox.twinId,
        name: sandbox.name,
        status: sandbox.status === 'running' ? 'running' : 'stopped',
        createdAt: sandbox.createdAt,
        endpoint: sandbox.endpoint,
      };
      this.sandboxes.set(sandbox.id, legacySandbox);

      return sandbox;
    }, (sandbox) => this.sendCreated(reply, sandbox));
  }

  async listSandboxes(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const query = request.query as { twinId?: string };
      const sandboxes = await this.sandboxService.listSandboxes(query.twinId);
      return sandboxes;
    }, (sandboxes) => this.sendSuccess(reply, sandboxes));
  }

  async stopSandbox(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { id: string };
      const sandbox = await this.sandboxService.stopSandbox(params.id);
      if (!sandbox) throw new Error(`Sandbox '${params.id}' not found or already stopped`);
      return sandbox;
    }, (sandbox) => this.sendSuccess(reply, sandbox));
  }

  async destroySandbox(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { id: string };
      const destroyed = await this.sandboxService.destroySandbox(params.id);
      if (!destroyed) throw new Error(`Sandbox '${params.id}' not found`);
      return { id: params.id, destroyed: true };
    }, (result) => this.sendSuccess(reply, result));
  }

  async getSandboxHealth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { id: string };
      const sandbox = await this.sandboxService.healthCheck(params.id);
      if (!sandbox) throw new Error(`Sandbox '${params.id}' not found`);
      return sandbox;
    }, (sandbox) => this.sendSuccess(reply, sandbox));
  }

  // ==================== Phase 4: Traffic Recording ====================

  async startRecording(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { id: string };
      const twin = this.twins.get(params.id);
      if (!twin) throw new Error(`Twin '${params.id}' not found`);

      const body = request.body as RecordingConfig;
      if (!body.name) throw new Error('Recording name is required');

      const session = await this.trafficRecorder.startRecording(params.id, body);
      return session;
    }, (session) => this.sendCreated(reply, session));
  }

  async stopRecording(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { recordingId: string };
      const session = await this.trafficRecorder.stopRecording(params.recordingId);
      if (!session) throw new Error(`Recording '${params.recordingId}' not found or not active`);
      return session;
    }, (session) => this.sendSuccess(reply, session));
  }

  async pauseRecording(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { recordingId: string };
      const session = await this.trafficRecorder.pauseRecording(params.recordingId);
      if (!session) throw new Error(`Recording '${params.recordingId}' not found or not active`);
      return session;
    }, (session) => this.sendSuccess(reply, session));
  }

  async listRecordings(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { id: string };
      const sessions = await this.trafficRecorder.listSessions(params.id);
      return sessions.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        recordCount: s.records.length,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
      }));
    }, (recordings) => this.sendSuccess(reply, recordings));
  }

  async getRecordingDetail(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { recordingId: string };
      const session = await this.trafficRecorder.getSession(params.recordingId);
      if (!session) throw new Error(`Recording '${params.recordingId}' not found`);
      return {
        ...session,
        recordCount: session.records.length,
      };
    }, (detail) => this.sendSuccess(reply, detail));
  }

  async getRecordingRecords(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { recordingId: string };
      const records = await this.trafficRecorder.getRecords(params.recordingId);
      return records;
    }, (records) => this.sendSuccess(reply, records));
  }

  // ==================== Phase 4: Traffic Replay ====================

  async startReplay(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { id: string };
      const twin = this.twins.get(params.id);
      if (!twin) throw new Error(`Twin '${params.id}' not found`);

      const body = request.body as {
        recordingSessionId: string;
        sandboxEndpoint: string;
        config?: ReplayConfig;
      };

      if (!body.recordingSessionId) throw new Error('recordingSessionId is required');
      if (!body.sandboxEndpoint) throw new Error('sandboxEndpoint is required');

      const recordingSession = await this.trafficRecorder.getSession(body.recordingSessionId);
      if (!recordingSession) throw new Error(`Recording session '${body.recordingSessionId}' not found`);

      const replay = await this.trafficReplayer.startReplay(
        params.id,
        body.recordingSessionId,
        recordingSession.records,
        body.sandboxEndpoint,
        body.config ?? {},
      );

      return replay;
    }, (replay) => this.sendCreated(reply, replay));
  }

  async getReplayStatus(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { replayId: string };
      const replay = await this.trafficReplayer.getSession(params.replayId);
      if (!replay) throw new Error(`Replay '${params.replayId}' not found`);
      return {
        id: replay.id,
        status: replay.status,
        progress: replay.progress,
        totalRequests: replay.totalRequests,
        completedRequests: replay.completedRequests,
        matchedRequests: replay.matchedRequests,
        failedRequests: replay.failedRequests,
        startedAt: replay.startedAt,
        completedAt: replay.completedAt,
      };
    }, (status) => this.sendSuccess(reply, status));
  }

  async listReplays(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { id: string };
      const replays = await this.trafficReplayer.listSessions(params.id);
      return replays.map((r) => ({
        id: r.id,
        recordingSessionId: r.recordingSessionId,
        status: r.status,
        progress: r.progress,
        totalRequests: r.totalRequests,
        startedAt: r.startedAt,
        completedAt: r.completedAt,
      }));
    }, (replays) => this.sendSuccess(reply, replays));
  }

  async cancelReplay(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { replayId: string };
      const replay = await this.trafficReplayer.cancelSession(params.replayId);
      if (!replay) throw new Error(`Replay '${params.replayId}' not found or not running`);
      return replay;
    }, (replay) => this.sendSuccess(reply, replay));
  }

  async getReplayReport(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { replayId: string };
      const replay = await this.trafficReplayer.getSession(params.replayId);
      if (!replay) throw new Error(`Replay '${params.replayId}' not found`);
      return {
        replayId: replay.id,
        status: replay.status,
        summary: {
          totalRequests: replay.totalRequests,
          completedRequests: replay.completedRequests,
          matchedRequests: replay.matchedRequests,
          failedRequests: replay.failedRequests,
          matchRate: replay.totalRequests > 0
            ? `${((replay.matchedRequests / replay.totalRequests) * 100).toFixed(1)}%`
            : '0%',
        },
        results: replay.results.slice(0, 100),
        startedAt: replay.startedAt,
        completedAt: replay.completedAt,
      };
    }, (report) => this.sendSuccess(reply, report));
  }

  // ==================== Legacy Traffic Methods (backward compatible) ====================

  async recordTraffic(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { id: string };
      const twin = this.twins.get(params.id);
      if (!twin) throw new Error(`Twin '${params.id}' not found`);
      const record: TrafficRecord = {
        id: `traffic-${Date.now()}`,
        twinId: params.id,
        type: 'record',
        requestCount: 0,
        duration: '0s',
        startedAt: new Date().toISOString(),
      };
      const records = this.trafficRecords.get(params.id) || [];
      records.push(record);
      this.trafficRecords.set(params.id, records);
      return record;
    }, (record) => this.sendSuccess(reply, record));
  }

  async replayTraffic(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { id: string };
      const body = request.body as { recordId: string; speed?: number };
      const twin = this.twins.get(params.id);
      if (!twin) throw new Error(`Twin '${params.id}' not found`);
      const record: TrafficRecord = {
        id: `replay-${Date.now()}`,
        twinId: params.id,
        type: 'replay',
        requestCount: Math.floor(Math.random() * 1000),
        duration: `${Math.floor(Math.random() * 60)}s`,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
      const records = this.trafficRecords.get(params.id) || [];
      records.push(record);
      this.trafficRecords.set(params.id, records);
      return { replayId: record.id, status: 'completed', requestsReplayed: record.requestCount };
    }, (result) => this.sendSuccess(reply, result));
  }
}
