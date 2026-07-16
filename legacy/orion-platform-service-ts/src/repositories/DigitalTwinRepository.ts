/**
 * DigitalTwinRepository — PostgreSQL data access for digital twin entities
 *
 * Covers 4 tables:
 * - digital_twins
 * - digital_twin_snapshots
 * - digital_twin_traffic_records
 * - digital_twin_replay_sessions
 */

import { getCurrentTenantId } from '../db/tenant-context-storage';
import { OrionError, ErrorCode } from '../errors';

// ==================== Entity Interfaces ====================

export interface DigitalTwinEntity {
  id: string;
  tenant_id: string;
  name: string;
  service_type: string;
  source_service: string;
  status: 'active' | 'paused' | 'stopped';
  created_at: Date;
}

export interface DigitalTwinSnapshotEntity {
  id: string;
  twin_id: string;
  tenant_id: string;
  name: string;
  created_at: Date;
}

export interface DigitalTwinTrafficRecordEntity {
  id: string;
  twin_id: string;
  tenant_id: string;
  type: 'record' | 'replay';
  request_count: number;
  duration: string;
  started_at: Date;
  completed_at: Date | null;
}

export interface DigitalTwinReplaySessionEntity {
  id: string;
  twin_id: string;
  tenant_id: string;
  recording_session_id: string;
  sandbox_endpoint: string;
  status: string;
  progress: number;
  total_requests: number;
  completed_requests: number;
  matched_requests: number;
  failed_requests: number;
  started_at: Date;
  completed_at: Date | null;
}

// ==================== Input Interfaces ====================

export interface CreateDigitalTwinInput {
  name: string;
  serviceType: string;
  sourceService: string;
  tenantId?: string;
}

export interface CreateSnapshotInput {
  twinId: string;
  name: string;
  tenantId?: string;
}

export interface CreateTrafficRecordInput {
  twinId: string;
  type: 'record' | 'replay';
  requestCount?: number;
  duration?: string;
  startedAt: Date;
  completedAt?: Date;
  tenantId?: string;
}

export interface CreateReplaySessionInput {
  twinId: string;
  recordingSessionId: string;
  sandboxEndpoint: string;
  status?: string;
  progress?: number;
  totalRequests?: number;
  completedRequests?: number;
  matchedRequests?: number;
  failedRequests?: number;
  startedAt: Date;
  completedAt?: Date;
  tenantId?: string;
}

// ==================== Repository ====================

export class DigitalTwinRepository {
  private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.db = db;
  }

  private getTenantId(override?: string): string {
    return override || getCurrentTenantId();
  }

  // ==================== Digital Twins ====================

  async createTwin(input: CreateDigitalTwinInput): Promise<DigitalTwinEntity> {
    const tenantId = this.getTenantId(input.tenantId);
    const id = `twin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.db.query(
      `INSERT INTO digital_twins (id, tenant_id, name, service_type, source_service, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, tenantId, input.name, input.serviceType, input.sourceService, 'active', new Date()]
    );
    return this.mapTwinRow(result.rows[0]);
  }

  async findTwinById(id: string, tenantId?: string): Promise<DigitalTwinEntity | undefined> {
    const tId = this.getTenantId(tenantId);
    const result = await this.db.query(
      `SELECT * FROM digital_twins WHERE id = $1 AND tenant_id = $2`,
      [id, tId]
    );
    if (result.rows.length === 0) return undefined;
    return this.mapTwinRow(result.rows[0]);
  }

  async findAllTwins(tenantId?: string): Promise<DigitalTwinEntity[]> {
    const tId = this.getTenantId(tenantId);
    const result = await this.db.query(
      `SELECT * FROM digital_twins WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tId]
    );
    return result.rows.map(row => this.mapTwinRow(row));
  }

  // ==================== Snapshots ====================

  async createSnapshot(input: CreateSnapshotInput): Promise<DigitalTwinSnapshotEntity> {
    const tenantId = this.getTenantId(input.tenantId);
    const id = `snap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const result = await this.db.query(
      `INSERT INTO digital_twin_snapshots (id, twin_id, tenant_id, name, created_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, input.twinId, tenantId, input.name, new Date()]
    );
    return this.mapSnapshotRow(result.rows[0]);
  }

  async findSnapshotsByTwinId(twinId: string, tenantId?: string): Promise<DigitalTwinSnapshotEntity[]> {
    const tId = this.getTenantId(tenantId);
    const result = await this.db.query(
      `SELECT * FROM digital_twin_snapshots WHERE twin_id = $1 AND tenant_id = $2 ORDER BY created_at DESC`,
      [twinId, tId]
    );
    return result.rows.map(row => this.mapSnapshotRow(row));
  }

  // ==================== Traffic Records ====================

  async createTrafficRecord(input: CreateTrafficRecordInput): Promise<DigitalTwinTrafficRecordEntity> {
    const tenantId = this.getTenantId(input.tenantId);
    const id = `traffic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const result = await this.db.query(
      `INSERT INTO digital_twin_traffic_records (id, twin_id, tenant_id, type, request_count, duration, started_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [id, input.twinId, tenantId, input.type, input.requestCount || 0, input.duration || '0s', input.startedAt, input.completedAt || null]
    );
    return this.mapTrafficRecordRow(result.rows[0]);
  }

  async findTrafficRecordsByTwinId(twinId: string, tenantId?: string): Promise<DigitalTwinTrafficRecordEntity[]> {
    const tId = this.getTenantId(tenantId);
    const result = await this.db.query(
      `SELECT * FROM digital_twin_traffic_records WHERE twin_id = $1 AND tenant_id = $2 ORDER BY started_at DESC`,
      [twinId, tId]
    );
    return result.rows.map(row => this.mapTrafficRecordRow(row));
  }

  // ==================== Replay Sessions ====================

  async createReplaySession(input: CreateReplaySessionInput): Promise<DigitalTwinReplaySessionEntity> {
    const tenantId = this.getTenantId(input.tenantId);
    const id = `replay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const result = await this.db.query(
      `INSERT INTO digital_twin_replay_sessions
       (id, twin_id, tenant_id, recording_session_id, sandbox_endpoint, status, progress, total_requests, completed_requests, matched_requests, failed_requests, started_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        id, input.twinId, tenantId, input.recordingSessionId, input.sandboxEndpoint,
        input.status || 'running', input.progress || 0, input.totalRequests || 0,
        input.completedRequests || 0, input.matchedRequests || 0, input.failedRequests || 0,
        input.startedAt, input.completedAt || null
      ]
    );
    return this.mapReplaySessionRow(result.rows[0]);
  }

  async findReplaySessionById(id: string, tenantId?: string): Promise<DigitalTwinReplaySessionEntity | undefined> {
    const tId = this.getTenantId(tenantId);
    const result = await this.db.query(
      `SELECT * FROM digital_twin_replay_sessions WHERE id = $1 AND tenant_id = $2`,
      [id, tId]
    );
    if (result.rows.length === 0) return undefined;
    return this.mapReplaySessionRow(result.rows[0]);
  }

  async findReplaySessionsByTwinId(twinId: string, tenantId?: string): Promise<DigitalTwinReplaySessionEntity[]> {
    const tId = this.getTenantId(tenantId);
    const result = await this.db.query(
      `SELECT * FROM digital_twin_replay_sessions WHERE twin_id = $1 AND tenant_id = $2 ORDER BY started_at DESC`,
      [twinId, tId]
    );
    return result.rows.map(row => this.mapReplaySessionRow(row));
  }

  async updateReplaySession(
    id: string,
    updates: { status?: string; progress?: number; completedRequests?: number; matchedRequests?: number; failedRequests?: number; completedAt?: Date },
    tenantId?: string
  ): Promise<DigitalTwinReplaySessionEntity | undefined> {
    const tId = this.getTenantId(tenantId);
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (updates.status !== undefined) { sets.push(`status = $${idx}`); params.push(updates.status); idx++; }
    if (updates.progress !== undefined) { sets.push(`progress = $${idx}`); params.push(updates.progress); idx++; }
    if (updates.completedRequests !== undefined) { sets.push(`completed_requests = $${idx}`); params.push(updates.completedRequests); idx++; }
    if (updates.matchedRequests !== undefined) { sets.push(`matched_requests = $${idx}`); params.push(updates.matchedRequests); idx++; }
    if (updates.failedRequests !== undefined) { sets.push(`failed_requests = $${idx}`); params.push(updates.failedRequests); idx++; }
    if (updates.completedAt !== undefined) { sets.push(`completed_at = $${idx}`); params.push(updates.completedAt); idx++; }

    if (sets.length === 0) {
      return this.findReplaySessionById(id, tId);
    }

    params.push(id, tId);
    const result = await this.db.query(
      `UPDATE digital_twin_replay_sessions SET ${sets.join(', ')} WHERE id = $${idx} AND tenant_id = $${idx + 1} RETURNING *`,
      params
    );
    if (result.rows.length === 0) return undefined;
    return this.mapReplaySessionRow(result.rows[0]);
  }

  // ==================== Row Mappers ====================

  private mapTwinRow(row: any): DigitalTwinEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      service_type: row.service_type,
      source_service: row.source_service,
      status: row.status,
      created_at: new Date(row.created_at),
    };
  }

  private mapSnapshotRow(row: any): DigitalTwinSnapshotEntity {
    return {
      id: row.id,
      twin_id: row.twin_id,
      tenant_id: row.tenant_id,
      name: row.name,
      created_at: new Date(row.created_at),
    };
  }

  private mapTrafficRecordRow(row: any): DigitalTwinTrafficRecordEntity {
    return {
      id: row.id,
      twin_id: row.twin_id,
      tenant_id: row.tenant_id,
      type: row.type,
      request_count: row.request_count,
      duration: row.duration,
      started_at: new Date(row.started_at),
      completed_at: row.completed_at ? new Date(row.completed_at) : null,
    };
  }

  private mapReplaySessionRow(row: any): DigitalTwinReplaySessionEntity {
    return {
      id: row.id,
      twin_id: row.twin_id,
      tenant_id: row.tenant_id,
      recording_session_id: row.recording_session_id,
      sandbox_endpoint: row.sandbox_endpoint,
      status: row.status,
      progress: row.progress,
      total_requests: row.total_requests,
      completed_requests: row.completed_requests,
      matched_requests: row.matched_requests,
      failed_requests: row.failed_requests,
      started_at: new Date(row.started_at),
      completed_at: row.completed_at ? new Date(row.completed_at) : null,
    };
  }
}
