/**
 * Digital Twin Repository - PostgreSQL Implementation
 * 数字孪生服务：系统状态镜像、沙箱隔离、流量录制与回放
 */

import { query } from '../utils/database';
import type {
  DigitalTwin,
  DigitalTwinSnapshot,
  SandboxInstance,
  TrafficRecord,
  RecordingSession,
  ReplaySession,
  TrafficReplayResult,
  TwinQuery,
} from '../types/digital-twin';

export class TwinRepository {
  // ==================== Digital Twin Methods ====================

  async createTwin(twin: DigitalTwin): Promise<void> {
    await query(
      `INSERT INTO digital_twins (id, tenant_id, name, description, config, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [twin.id, twin.tenantId, twin.name, twin.description || null, JSON.stringify(twin.config), twin.status, twin.createdAt, twin.updatedAt]
    );
  }

  async findTwins(queryParams: TwinQuery): Promise<{ data: DigitalTwin[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (queryParams.tenantId) {
      conditions.push(`tenant_id = $${paramIndex++}`);
      params.push(queryParams.tenantId);
    }
    if (queryParams.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(queryParams.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await query(`SELECT COUNT(*) as total FROM digital_twins ${whereClause}`, params);
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    // Get paginated data
    const limit = queryParams.limit || 20;
    const offset = ((queryParams.page || 1) - 1) * limit;
    params.push(limit, offset);

    const result = await query(
      `SELECT id, tenant_id, name, description, config, status, created_at, updated_at
       FROM digital_twins ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      params
    );

    const data: DigitalTwin[] = result.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      config: row.config || {},
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { data, total };
  }

  async findTwinById(id: string): Promise<DigitalTwin | null> {
    const result = await query(
      `SELECT id, tenant_id, name, description, config, status, created_at, updated_at
       FROM digital_twins WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      config: row.config || {},
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async updateTwin(twin: DigitalTwin): Promise<void> {
    await query(
      `UPDATE digital_twins SET name = $1, description = $2, config = $3, status = $4, updated_at = $5 WHERE id = $6`,
      [twin.name, twin.description || null, JSON.stringify(twin.config), twin.status, twin.updatedAt, twin.id]
    );
  }

  async deleteTwin(id: string): Promise<void> {
    await query(`DELETE FROM digital_twins WHERE id = $1`, [id]);
  }

  // ==================== Snapshot Methods ====================

  async createSnapshot(snapshot: DigitalTwinSnapshot): Promise<void> {
    await query(
      `INSERT INTO digital_twin_snapshots (id, twin_id, tenant_id, config, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [snapshot.id, snapshot.twinId, snapshot.tenantId, JSON.stringify(snapshot.config), JSON.stringify(snapshot.metadata), snapshot.createdAt]
    );
  }

  async findSnapshotsByTwin(twinId: string): Promise<DigitalTwinSnapshot[]> {
    const result = await query(
      `SELECT id, twin_id, tenant_id, config, metadata, created_at
       FROM digital_twin_snapshots WHERE twin_id = $1 ORDER BY created_at DESC`,
      [twinId]
    );
    return result.rows.map((row) => ({
      id: row.id,
      twinId: row.twin_id,
      tenantId: row.tenant_id,
      config: row.config || {},
      metadata: row.metadata || {},
      createdAt: row.created_at,
    }));
  }

  async findSnapshotById(id: string): Promise<DigitalTwinSnapshot | null> {
    const result = await query(
      `SELECT id, twin_id, tenant_id, config, metadata, created_at
       FROM digital_twin_snapshots WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      twinId: row.twin_id,
      tenantId: row.tenant_id,
      config: row.config || {},
      metadata: row.metadata || {},
      createdAt: row.created_at,
    };
  }

  async deleteSnapshot(id: string): Promise<void> {
    await query(`DELETE FROM digital_twin_snapshots WHERE id = $1`, [id]);
  }

  // ==================== Sandbox Methods ====================

  async createSandbox(sandbox: SandboxInstance): Promise<void> {
    await query(
      `INSERT INTO sandbox_instances (id, tenant_id, twin_id, snapshot_id, status, endpoint, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [sandbox.id, sandbox.tenantId, sandbox.twinId, sandbox.snapshotId || null, sandbox.status, sandbox.endpoint || null, sandbox.createdAt]
    );
  }

  async findSandboxById(id: string): Promise<SandboxInstance | null> {
    const result = await query(
      `SELECT id, tenant_id, twin_id, snapshot_id, status, endpoint, created_at
       FROM sandbox_instances WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      tenantId: row.tenant_id,
      twinId: row.twin_id,
      snapshotId: row.snapshot_id,
      status: row.status,
      endpoint: row.endpoint,
      createdAt: row.created_at,
    };
  }

  async findSandboxesByTenant(tenantId: string): Promise<SandboxInstance[]> {
    const result = await query(
      `SELECT id, tenant_id, twin_id, snapshot_id, status, endpoint, created_at
       FROM sandbox_instances WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    );
    return result.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      twinId: row.twin_id,
      snapshotId: row.snapshot_id,
      status: row.status,
      endpoint: row.endpoint,
      createdAt: row.created_at,
    }));
  }

  async findSandboxesByTwin(twinId: string): Promise<SandboxInstance[]> {
    const result = await query(
      `SELECT id, tenant_id, twin_id, snapshot_id, status, endpoint, created_at
       FROM sandbox_instances WHERE twin_id = $1 ORDER BY created_at DESC`,
      [twinId]
    );
    return result.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      twinId: row.twin_id,
      snapshotId: row.snapshot_id,
      status: row.status,
      endpoint: row.endpoint,
      createdAt: row.created_at,
    }));
  }

  async updateSandbox(sandbox: SandboxInstance): Promise<void> {
    await query(
      `UPDATE sandbox_instances SET status = $1, endpoint = $2 WHERE id = $3`,
      [sandbox.status, sandbox.endpoint || null, sandbox.id]
    );
  }

  async deleteSandbox(id: string): Promise<void> {
    await query(`DELETE FROM sandbox_instances WHERE id = $1`, [id]);
  }

  // ==================== Traffic Record Methods ====================

  async createTrafficRecord(record: TrafficRecord): Promise<void> {
    await query(
      `INSERT INTO traffic_records (id, twin_id, tenant_id, recording_id, timestamp, method, path, request, response, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        record.id,
        record.twinId,
        record.tenantId,
        record.recordingId || null,
        record.timestamp,
        record.method,
        record.path,
        JSON.stringify(record.payload?.request || {}),
        JSON.stringify(record.payload?.response || {}),
        record.latency,
      ]
    );
  }

  async findTrafficRecordsBySession(sessionId: string, limit: number): Promise<TrafficRecord[]> {
    const result = await query(
      `SELECT id, twin_id, tenant_id, recording_id, timestamp, method, path, request, response, duration_ms
       FROM traffic_records WHERE recording_id = $1
       ORDER BY timestamp DESC LIMIT $2`,
      [sessionId, limit]
    );
    return result.rows.map((row) => ({
      id: row.id,
      twinId: row.twin_id,
      tenantId: row.tenant_id,
      recordingId: row.recording_id,
      timestamp: row.timestamp,
      method: row.method,
      path: row.path,
      statusCode: row.response?.statusCode || 0,
      latency: row.duration_ms || 0,
      payload: {
        request: row.request,
        response: row.response,
      },
    }));
  }

  async findTrafficRecordsByTwin(twinId: string, limit: number): Promise<TrafficRecord[]> {
    const result = await query(
      `SELECT id, twin_id, tenant_id, recording_id, timestamp, method, path, request, response, duration_ms
       FROM traffic_records WHERE twin_id = $1
       ORDER BY timestamp DESC LIMIT $2`,
      [twinId, limit]
    );
    return result.rows.map((row) => ({
      id: row.id,
      twinId: row.twin_id,
      tenantId: row.tenant_id,
      recordingId: row.recording_id,
      timestamp: row.timestamp,
      method: row.method,
      path: row.path,
      statusCode: row.response?.statusCode || 0,
      latency: row.duration_ms || 0,
      payload: {
        request: row.request,
        response: row.response,
      },
    }));
  }

  // ==================== Recording Session Methods ====================

  async createRecordingSession(session: RecordingSession): Promise<void> {
    await query(
      `INSERT INTO recording_sessions (id, twin_id, tenant_id, status, record_count, started_at, stopped_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [session.id, session.twinId, session.tenantId, session.status, session.recordCount, session.startedAt, session.stoppedAt || null]
    );
  }

  async findRecordingSessionsByTwin(twinId: string): Promise<RecordingSession[]> {
    const result = await query(
      `SELECT id, twin_id, tenant_id, status, record_count, started_at, stopped_at
       FROM recording_sessions WHERE twin_id = $1 ORDER BY started_at DESC`,
      [twinId]
    );
    return result.rows.map((row) => ({
      id: row.id,
      twinId: row.twin_id,
      tenantId: row.tenant_id,
      status: row.status,
      recordCount: row.record_count,
      startedAt: row.started_at,
      stoppedAt: row.stopped_at,
    }));
  }

  async findRecordingSessionById(id: string): Promise<RecordingSession | null> {
    const result = await query(
      `SELECT id, twin_id, tenant_id, status, record_count, started_at, stopped_at
       FROM recording_sessions WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      twinId: row.twin_id,
      tenantId: row.tenant_id,
      status: row.status,
      recordCount: row.record_count,
      startedAt: row.started_at,
      stoppedAt: row.stopped_at,
    };
  }

  async updateRecordingSession(session: RecordingSession): Promise<void> {
    await query(
      `UPDATE recording_sessions SET status = $1, record_count = $2, stopped_at = $3 WHERE id = $4`,
      [session.status, session.recordCount, session.stoppedAt || null, session.id]
    );
  }

  async deleteRecordingSession(id: string): Promise<void> {
    await query(`DELETE FROM recording_sessions WHERE id = $1`, [id]);
  }

  // ==================== Replay Session Methods ====================

  async createReplaySession(session: ReplaySession): Promise<void> {
    await query(
      `INSERT INTO replay_sessions (id, twin_id, tenant_id, recording_id, status, speed_multiplier, started_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [session.id, session.twinId, session.tenantId, session.recordingId, session.status, session.speedMultiplier, session.startedAt, session.completedAt || null]
    );
  }

  async findReplaySessionsByTwin(twinId: string): Promise<ReplaySession[]> {
    const result = await query(
      `SELECT id, twin_id, tenant_id, recording_id, status, speed_multiplier, started_at, completed_at
       FROM replay_sessions WHERE twin_id = $1 ORDER BY started_at DESC`,
      [twinId]
    );
    return result.rows.map((row) => ({
      id: row.id,
      twinId: row.twin_id,
      tenantId: row.tenant_id,
      recordingId: row.recording_id,
      status: row.status,
      speedMultiplier: row.speed_multiplier,
      startedAt: row.started_at,
      completedAt: row.completed_at,
    }));
  }

  async findReplaySessionById(id: string): Promise<ReplaySession | null> {
    const result = await query(
      `SELECT id, twin_id, tenant_id, recording_id, status, speed_multiplier, started_at, completed_at
       FROM replay_sessions WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      twinId: row.twin_id,
      tenantId: row.tenant_id,
      recordingId: row.recording_id,
      status: row.status,
      speedMultiplier: row.speed_multiplier,
      startedAt: row.started_at,
      completedAt: row.completed_at,
    };
  }

  async updateReplaySession(session: ReplaySession): Promise<void> {
    await query(
      `UPDATE replay_sessions SET status = $1, completed_at = $2 WHERE id = $3`,
      [session.status, session.completedAt || null, session.id]
    );
  }

  async deleteReplaySession(id: string): Promise<void> {
    await query(`DELETE FROM replay_sessions WHERE id = $1`, [id]);
  }

  // ==================== Replay Result Methods ====================

  async createReplayResult(result: TrafficReplayResult): Promise<void> {
    await query(
      `INSERT INTO replay_results (id, twin_id, recording_id, total_requests, succeeded, failed, status, started_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [result.id, result.twinId, result.recordingId, result.totalRequests, result.succeeded, result.failed, result.status, result.startedAt, result.completedAt || null]
    );
  }

  async findReplayResultById(id: string): Promise<TrafficReplayResult | null> {
    const result = await query(
      `SELECT id, twin_id, recording_id, total_requests, succeeded, failed, status, started_at, completed_at
       FROM replay_results WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      twinId: row.twin_id,
      recordingId: row.recording_id,
      totalRequests: row.total_requests,
      succeeded: row.succeeded,
      failed: row.failed,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at,
    };
  }

  async findReplayResultsByTwin(twinId: string): Promise<TrafficReplayResult[]> {
    const result = await query(
      `SELECT id, twin_id, recording_id, total_requests, succeeded, failed, status, started_at, completed_at
       FROM replay_results WHERE twin_id = $1 ORDER BY started_at DESC`,
      [twinId]
    );
    return result.rows.map((row) => ({
      id: row.id,
      twinId: row.twin_id,
      recordingId: row.recording_id,
      totalRequests: row.total_requests,
      succeeded: row.succeeded,
      failed: row.failed,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at,
    }));
  }

  async updateReplayResult(result: TrafficReplayResult): Promise<void> {
    await query(
      `UPDATE replay_results SET succeeded = $1, failed = $2, status = $3, completed_at = $4 WHERE id = $5`,
      [result.succeeded, result.failed, result.status, result.completedAt || null, result.id]
    );
  }
}

export const twinRepository = new TwinRepository();