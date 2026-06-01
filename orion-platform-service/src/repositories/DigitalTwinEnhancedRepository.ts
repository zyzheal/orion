/**
 * DigitalTwinEnhancedRepository - Phase 4 数字孪生增强仓储层
 *
 * 为 TwinConfigService, SandboxService, TrafficRecorderService,
 * TrafficReplayService 提供 PostgreSQL 持久化。
 */

import { DatabasePool } from '../services/database';
import { BaseRepository, FindAllResult, FindAllOptions } from '../db/base-repository';
import { OrionError, ErrorCode } from '../errors';

// ==================== TwinConfig ====================

export interface TwinConfigEntity {
  id: string;
  tenantId: string;
  twinName: string;
  description?: string;
  environment: 'dev' | 'staging' | 'prod';
  services: string[];
  syncInterval: number;
  dataRetentionDays: number;
  status: 'active' | 'inactive' | 'error' | 'syncing';
  healthScore: number;
  serviceStates: Record<string, { status: string; latency: number }>;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterTwinInput {
  name: string;
  description?: string;
  environment: 'dev' | 'staging' | 'prod';
  services: string[];
  syncInterval?: number;
}

export class TwinConfigRepository extends BaseRepository<TwinConfigEntity> {
  constructor(public readonly db: DatabasePool) {
    super(db, 'twin_configs');
  }

  async findByTenant(tenantId: string): Promise<TwinConfigEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM twin_configs WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async insert(data: {
    tenant_id: string;
    twin_name: string;
    description?: string;
    environment: string;
    services: string[];
    sync_interval: number;
    data_retention_days: number;
  }): Promise<TwinConfigEntity> {
    const result = await this.db.query(
      `INSERT INTO twin_configs
        (tenant_id, twin_name, description, environment, services, sync_interval, data_retention_days)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.tenant_id,
        data.twin_name,
        data.description ?? null,
        data.environment,
        data.services,
        data.sync_interval,
        data.data_retention_days,
      ],
    );
    if (result.rows.length === 0) throw new OrionError('INSERT returned no rows', ErrorCode.OPERATION_FAILED);
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateStatus(id: string, status: string, updatedAt: string): Promise<TwinConfigEntity | null> {
    const result = await this.db.query(
      'UPDATE twin_configs SET status = $1, updated_at = $2 WHERE id = $3 RETURNING *',
      [status, updatedAt, id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateServiceStates(id: string, serviceStates: Record<string, unknown>, healthScore: number, updatedAt: string): Promise<TwinConfigEntity | null> {
    const result = await this.db.query(
      'UPDATE twin_configs SET service_states = $1, health_score = $2, updated_at = $3 WHERE id = $4 RETURNING *',
      [JSON.stringify(serviceStates), healthScore, updatedAt, id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateLastSync(id: string, lastSyncAt: string, updatedAt: string): Promise<TwinConfigEntity | null> {
    const result = await this.db.query(
      'UPDATE twin_configs SET last_sync_at = $1, updated_at = $2 WHERE id = $3 RETURNING *',
      [lastSyncAt, updatedAt, id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.db.query('DELETE FROM twin_configs WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  protected mapRowToEntity(row: any): TwinConfigEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      twinName: row.twin_name,
      description: row.description,
      environment: row.environment,
      services: row.services || [],
      syncInterval: row.sync_interval ?? 60,
      dataRetentionDays: row.data_retention_days ?? 30,
      status: row.status ?? 'active',
      healthScore: row.health_score ?? 100,
      serviceStates: row.service_states ?? {},
      lastSyncAt: row.last_sync_at,
      createdAt: row.created_at?.toISOString() ?? new Date().toISOString(),
      updatedAt: row.updated_at?.toISOString() ?? new Date().toISOString(),
    };
  }
}

// ==================== Sandbox ====================

export interface SandboxEntity {
  id: string;
  tenantId: string;
  twinId: string;
  name: string;
  status: 'creating' | 'running' | 'stopped' | 'error' | 'destroying';
  endpoint: string;
  snapshotId?: string;
  resources: { cpu: string; memory: string; replicas: number };
  envVars: Record<string, string>;
  networkIsolation: boolean;
  healthStatus: 'healthy' | 'unhealthy' | 'unknown';
  createdAt: string;
  startedAt?: string;
  stoppedAt?: string;
  lastHealthCheck?: string;
}

export class SandboxRepository extends BaseRepository<SandboxEntity> {
  constructor(public readonly db: DatabasePool) {
    super(db, 'twin_sandboxes');
  }

  async findByTwin(twinId: string): Promise<SandboxEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM twin_sandboxes WHERE twin_id = $1 ORDER BY created_at DESC',
      [twinId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenant(tenantId: string): Promise<SandboxEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM twin_sandboxes WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async countByStatus(status: string): Promise<number> {
    const result = await this.db.query(
      'SELECT COUNT(*) FROM twin_sandboxes WHERE status = $1',
      [status],
    );
    return parseInt(result.rows[0]?.count || '0', 10);
  }

  async insert(data: {
    tenant_id: string;
    twin_id: string;
    sandbox_name: string;
    snapshot_id?: string;
    status: string;
    endpoint: string;
    resources: { cpu: string; memory: string; replicas: number };
    env_vars: Record<string, string>;
    network_isolation: boolean;
    health_status: string;
    started_at?: string;
  }): Promise<SandboxEntity> {
    const result = await this.db.query(
      `INSERT INTO twin_sandboxes
        (tenant_id, twin_id, sandbox_name, snapshot_id, status, endpoint, resources, env_vars, network_isolation, health_status, started_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        data.tenant_id,
        data.twin_id,
        data.sandbox_name,
        data.snapshot_id ?? null,
        data.status,
        data.endpoint,
        data.resources,
        data.env_vars,
        data.network_isolation,
        data.health_status,
        data.started_at ?? null,
      ],
    );
    if (result.rows.length === 0) throw new OrionError('INSERT returned no rows', ErrorCode.OPERATION_FAILED);
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateStatus(id: string, status: string, stoppedAt?: string): Promise<SandboxEntity | null> {
    const fields: string[] = ['status = $1'];
    const params: any[] = [status];
    if (stoppedAt) {
      fields.push('stopped_at = $2');
      params.push(stoppedAt);
      params.push(id);
    } else {
      params.push(id);
    }
    const result = await this.db.query(
      `UPDATE twin_sandboxes SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateHealthCheck(id: string, healthStatus: string, lastHealthCheck: string): Promise<SandboxEntity | null> {
    const result = await this.db.query(
      'UPDATE twin_sandboxes SET health_status = $1, last_health_check = $2 WHERE id = $3 RETURNING *',
      [healthStatus, lastHealthCheck, id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.db.query('DELETE FROM twin_sandboxes WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  protected mapRowToEntity(row: any): SandboxEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      twinId: row.twin_id,
      name: row.sandbox_name,
      status: row.status,
      endpoint: row.endpoint,
      snapshotId: row.snapshot_id,
      resources: row.resources ?? { cpu: '500m', memory: '512Mi', replicas: 1 },
      envVars: row.env_vars ?? {},
      networkIsolation: row.network_isolation ?? true,
      healthStatus: row.health_status ?? 'unknown',
      createdAt: row.created_at?.toISOString() ?? new Date().toISOString(),
      startedAt: row.started_at,
      stoppedAt: row.stopped_at,
      lastHealthCheck: row.last_health_check,
    };
  }
}

// ==================== RecordingSession ====================

export interface RecordingSessionEntity {
  id: string;
  tenantId: string;
  twinId: string;
  name: string;
  status: 'active' | 'paused' | 'completed';
  records: any[];
  filterPatterns?: string[];
  startedAt: string;
  pausedAt?: string;
  completedAt?: string;
}

export interface TrafficRecordEntity {
  id: string;
  twinId: string;
  request: {
    method: string;
    path: string;
    headers: Record<string, string>;
    body?: unknown;
    queryParams?: Record<string, string>;
  };
  response: {
    statusCode: number;
    headers: Record<string, string>;
    body?: unknown;
    latencyMs: number;
  };
  timestamp: string;
  metadata: Record<string, unknown>;
}

export class RecordingSessionRepository extends BaseRepository<RecordingSessionEntity> {
  constructor(public readonly db: DatabasePool) {
    super(db, 'traffic_recording_sessions');
  }

  async findByTwin(twinId: string): Promise<RecordingSessionEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM traffic_recording_sessions WHERE twin_id = $1 ORDER BY started_at DESC',
      [twinId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async insert(data: {
    tenant_id: string;
    twin_id: string;
    session_name: string;
    filter_patterns?: string[];
  }): Promise<RecordingSessionEntity> {
    const result = await this.db.query(
      `INSERT INTO traffic_recording_sessions
        (tenant_id, twin_id, session_name, filter_patterns)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.tenant_id, data.twin_id, data.session_name, data.filter_patterns ?? null],
    );
    if (result.rows.length === 0) throw new OrionError('INSERT returned no rows', ErrorCode.OPERATION_FAILED);
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateStatus(id: string, status: string, pausedAt?: string, completedAt?: string): Promise<RecordingSessionEntity | null> {
    const fields: string[] = ['status = $1'];
    const params: any[] = [status];
    let paramIndex = 2;
    if (pausedAt) {
      fields.push(`paused_at = $${paramIndex}`);
      params.push(pausedAt);
      paramIndex++;
    }
    if (completedAt) {
      fields.push(`completed_at = $${paramIndex}`);
      params.push(completedAt);
      paramIndex++;
    }
    params.push(id);
    const result = await this.db.query(
      `UPDATE traffic_recording_sessions SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params,
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async addRecord(id: string, record: TrafficRecordEntity): Promise<RecordingSessionEntity | null> {
    const result = await this.db.query(
      `UPDATE traffic_recording_sessions
       SET records = records || $1
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify([record]), id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.db.query('DELETE FROM traffic_recording_sessions WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  protected mapRowToEntity(row: any): RecordingSessionEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      twinId: row.twin_id,
      name: row.session_name,
      status: row.status,
      records: row.records ?? [],
      filterPatterns: row.filter_patterns ?? undefined,
      startedAt: row.started_at?.toISOString() ?? new Date().toISOString(),
      pausedAt: row.paused_at,
      completedAt: row.completed_at,
    };
  }
}

// ==================== ReplaySession ====================

export interface ReplaySessionEntity {
  id: string;
  tenantId: string;
  twinId: string;
  recordingSessionId: string;
  sandboxEndpoint: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  totalRequests: number;
  completedRequests: number;
  matchedRequests: number;
  failedRequests: number;
  results: any[];
  config: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
  progress: number;
}

export class ReplaySessionRepository extends BaseRepository<ReplaySessionEntity> {
  constructor(public readonly db: DatabasePool) {
    super(db, 'traffic_replay_sessions');
  }

  async findByTwin(twinId: string): Promise<ReplaySessionEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM traffic_replay_sessions WHERE twin_id = $1 ORDER BY started_at DESC',
      [twinId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async insert(data: {
    tenant_id: string;
    twin_id: string;
    recording_session_id: string;
    sandbox_endpoint: string;
    total_requests: number;
    config: Record<string, unknown>;
  }): Promise<ReplaySessionEntity> {
    const result = await this.db.query(
      `INSERT INTO traffic_replay_sessions
        (tenant_id, twin_id, recording_session_id, sandbox_endpoint, total_requests, config)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.tenant_id,
        data.twin_id,
        data.recording_session_id,
        data.sandbox_endpoint,
        data.total_requests,
        data.config,
      ],
    );
    if (result.rows.length === 0) throw new OrionError('INSERT returned no rows', ErrorCode.OPERATION_FAILED);
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateProgress(
    id: string,
    completedRequests: number,
    matchedRequests: number,
    failedRequests: number,
    progress: number,
  ): Promise<ReplaySessionEntity | null> {
    const result = await this.db.query(
      'UPDATE traffic_replay_sessions SET completed_requests = $1, matched_requests = $2, failed_requests = $3, progress = $4 WHERE id = $5 RETURNING *',
      [completedRequests, matchedRequests, failedRequests, progress, id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateStatus(id: string, status: string, completedAt?: string): Promise<ReplaySessionEntity | null> {
    const result = await this.db.query(
      'UPDATE traffic_replay_sessions SET status = $1, completed_at = $2 WHERE id = $3 RETURNING *',
      [status, completedAt ?? null, id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async addResults(id: string, results: any[]): Promise<ReplaySessionEntity | null> {
    const result = await this.db.query(
      `UPDATE traffic_replay_sessions
       SET results = results || $1
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify(results), id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async setStartedAt(id: string, startedAt: string): Promise<ReplaySessionEntity | null> {
    const result = await this.db.query(
      'UPDATE traffic_replay_sessions SET started_at = $1 WHERE id = $2 RETURNING *',
      [startedAt, id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): ReplaySessionEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      twinId: row.twin_id,
      recordingSessionId: row.recording_session_id,
      sandboxEndpoint: row.sandbox_endpoint,
      status: row.status,
      totalRequests: row.total_requests ?? 0,
      completedRequests: row.completed_requests ?? 0,
      matchedRequests: row.matched_requests ?? 0,
      failedRequests: row.failed_requests ?? 0,
      results: row.results ?? [],
      config: row.config ?? {},
      startedAt: row.started_at,
      completedAt: row.completed_at,
      progress: row.progress ?? 0,
    };
  }
}
