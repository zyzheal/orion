/**
 * TrafficRecorderService - Phase 4 Digital Twin Enhancement
 *
 * Records API traffic for replay in sandbox environments.
 * Captures request/response pairs with metadata for later replay.
 * Uses PostgreSQL Repository pattern with in-memory fallback.
 */

import { randomUUID } from 'crypto';
import { DatabasePool } from '../database';
import { RecordingSessionRepository, TrafficRecordEntity } from '../../repositories/DigitalTwinEnhancedRepository';

export interface RecordedRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: unknown;
  queryParams?: Record<string, string>;
}

export interface RecordedResponse {
  statusCode: number;
  headers: Record<string, string>;
  body?: unknown;
  latencyMs: number;
}

export interface TrafficRecord {
  id: string;
  twinId: string;
  request: RecordedRequest;
  response: RecordedResponse;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface RecordingSession {
  id: string;
  twinId: string;
  name: string;
  status: 'active' | 'paused' | 'completed';
  records: TrafficRecord[];
  startedAt: string;
  pausedAt?: string;
  completedAt?: string;
  filterPatterns?: string[];
}

export interface RecordingConfig {
  name: string;
  filterPatterns?: string[];
  maxRecords?: number;
  captureHeaders?: string[];
  captureBody?: boolean;
  tenantId?: string;
}

export class TrafficRecorderService {
  private repo?: RecordingSessionRepository;
  private memory = new Map<string, RecordingSession>();
  private activeRecordings = new Set<string>();

  constructor(db?: DatabasePool) {
    if (db) {
      this.repo = new RecordingSessionRepository(db);
    }
  }

  // ==================== Repository injection for testing ====================
  setRepository(repo: RecordingSessionRepository): void {
    this.repo = repo;
  }

  async startRecording(
    twinId: string,
    config: RecordingConfig,
  ): Promise<RecordingSession> {
    if (this.repo) {
      const entity = await this.repo.insert({
        tenant_id: config.tenantId ?? 'default',
        twin_id: twinId,
        session_name: config.name,
        filter_patterns: config.filterPatterns,
      });
      this.activeRecordings.add(entity.id);
      return this.entityToSession(entity);
    }

    // 内存回退
    const session: RecordingSession = {
      id: randomUUID(),
      twinId,
      name: config.name,
      status: 'active',
      records: [],
      startedAt: new Date().toISOString(),
      filterPatterns: config.filterPatterns,
    };
    this.memory.set(session.id, session);
    this.activeRecordings.add(session.id);
    return session;
  }

  async pauseRecording(sessionId: string): Promise<RecordingSession | null> {
    if (this.repo) {
      const pausedAt = new Date().toISOString();
      const updated = await this.repo.updateStatus(sessionId, 'paused', pausedAt);
      if (!updated) return null;
      this.activeRecordings.delete(sessionId);
      return this.entityToSession(updated);
    }

    // 内存回退
    const session = this.memory.get(sessionId);
    if (!session || session.status !== 'active') return null;

    session.status = 'paused';
    session.pausedAt = new Date().toISOString();
    this.activeRecordings.delete(sessionId);
    return session;
  }

  async resumeRecording(sessionId: string): Promise<RecordingSession | null> {
    if (this.repo) {
      const updated = await this.repo.updateStatus(sessionId, 'active');
      if (!updated) return null;
      this.activeRecordings.add(sessionId);
      return this.entityToSession(updated);
    }

    // 内存回退
    const session = this.memory.get(sessionId);
    if (!session || session.status !== 'paused') return null;

    session.status = 'active';
    this.activeRecordings.add(sessionId);
    return session;
  }

  async stopRecording(sessionId: string): Promise<RecordingSession | null> {
    if (this.repo) {
      const completedAt = new Date().toISOString();
      const updated = await this.repo.updateStatus(sessionId, 'completed', undefined, completedAt);
      if (!updated) return null;
      this.activeRecordings.delete(sessionId);
      return this.entityToSession(updated);
    }

    // 内存回退
    const session = this.memory.get(sessionId);
    if (!session) return null;

    session.status = 'completed';
    session.completedAt = new Date().toISOString();
    this.activeRecordings.delete(sessionId);
    return session;
  }

  async recordTraffic(
    sessionId: string,
    twinId: string,
    request: RecordedRequest,
    response: RecordedResponse,
    metadata: Record<string, unknown> = {},
  ): Promise<TrafficRecord | null> {
    if (this.repo) {
      const session = await this.repo.findById(sessionId);
      if (!session || session.status !== 'active') return null;

      // Apply filter patterns
      if (session.filterPatterns && session.filterPatterns.length > 0) {
        const matches = session.filterPatterns.some((pattern: string) =>
          request.path.includes(pattern),
        );
        if (!matches) return null;
      }

      const record: TrafficRecordEntity = {
        id: randomUUID(),
        twinId,
        request,
        response,
        timestamp: new Date().toISOString(),
        metadata,
      };

      const updated = await this.repo.addRecord(sessionId, record);
      return updated ? this.recordToTrafficRecord(record, twinId) : null;
    }

    // 内存回退
    const session = this.memory.get(sessionId);
    if (!session || session.status !== 'active') return null;

    // Apply filter patterns
    if (session.filterPatterns && session.filterPatterns.length > 0) {
      const matches = session.filterPatterns.some((pattern) =>
        request.path.includes(pattern),
      );
      if (!matches) return null;
    }

    const record: TrafficRecord = {
      id: randomUUID(),
      twinId,
      request,
      response,
      timestamp: new Date().toISOString(),
      metadata,
    };

    session.records.push(record);
    return record;
  }

  async getSession(sessionId: string): Promise<RecordingSession | null> {
    if (this.repo) {
      const entity = await this.repo.findById(sessionId);
      return entity ? this.entityToSession(entity) : null;
    }
    return this.memory.get(sessionId) ?? null;
  }

  async listSessions(twinId?: string): Promise<RecordingSession[]> {
    if (this.repo) {
      let entities: any[];
      if (twinId) {
        entities = await this.repo.findByTwin(twinId);
      } else {
        const result = await this.repo.findAll({ limit: 1000 });
        entities = (result as any).entities || result;
      }
      return entities.map(e => this.entityToSession(e))
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    }

    // 内存回退
    let sessions = Array.from(this.memory.values());
    if (twinId) {
      sessions = sessions.filter((s) => s.twinId === twinId);
    }
    return sessions.sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );
  }

  async getRecords(sessionId: string): Promise<TrafficRecord[]> {
    if (this.repo) {
      const entity = await this.repo.findById(sessionId);
      if (!entity) return [];
      return (entity.records || []).map((r: any) => ({
        id: r.id,
        twinId: r.twinId,
        request: r.request,
        response: r.response,
        timestamp: r.timestamp,
        metadata: r.metadata || {},
      }));
    }

    // 内存回退
    const session = this.memory.get(sessionId);
    return session?.records ?? [];
  }

  async getRecordsByTwin(twinId: string): Promise<TrafficRecord[]> {
    if (this.repo) {
      const sessions = await this.repo.findByTwin(twinId);
      const records: TrafficRecord[] = [];
      for (const session of sessions) {
        for (const r of (session.records || [])) {
          records.push({
            id: r.id,
            twinId: r.twinId,
            request: r.request,
            response: r.response,
            timestamp: r.timestamp,
            metadata: r.metadata || {},
          });
        }
      }
      return records;
    }

    // 内存回退
    const records: TrafficRecord[] = [];
    for (const session of this.memory.values()) {
      if (session.twinId === twinId) {
        records.push(...session.records);
      }
    }
    return records;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    this.activeRecordings.delete(sessionId);
    if (this.repo) {
      return this.repo.deleteById(sessionId);
    }
    return this.memory.delete(sessionId);
  }

  getActiveRecordingCount(): number {
    return this.activeRecordings.size;
  }

  isRecording(twinId: string): boolean {
    for (const sessionId of this.activeRecordings) {
      if (this.repo) {
        // Would need to check each session - simplified
        return true;
      }
      const session = this.memory.get(sessionId);
      if (session?.twinId === twinId) return true;
    }
    return false;
  }

  private entityToSession(entity: any): RecordingSession {
    return {
      id: entity.id,
      twinId: entity.twinId,
      name: entity.name,
      status: entity.status,
      records: (entity.records || []).map((r: any) => ({
        id: r.id,
        twinId: r.twinId,
        request: r.request,
        response: r.response,
        timestamp: r.timestamp,
        metadata: r.metadata || {},
      })),
      startedAt: entity.startedAt,
      pausedAt: entity.pausedAt,
      completedAt: entity.completedAt,
      filterPatterns: entity.filterPatterns,
    };
  }

  private recordToTrafficRecord(record: TrafficRecordEntity, twinId: string): TrafficRecord {
    return {
      id: record.id,
      twinId,
      request: record.request as RecordedRequest,
      response: record.response as RecordedResponse,
      timestamp: record.timestamp,
      metadata: record.metadata || {},
    };
  }
}
