/**
 * TrafficRecorderService - Phase 4 Digital Twin Enhancement
 *
 * Records API traffic for replay in sandbox environments.
 * Captures request/response pairs with metadata for later replay.
 */

import { randomUUID } from 'crypto';

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
}

export class TrafficRecorderService {
  private sessions = new Map<string, RecordingSession>();
  private activeRecordings = new Set<string>();

  async startRecording(
    twinId: string,
    config: RecordingConfig,
  ): Promise<RecordingSession> {
    const session: RecordingSession = {
      id: randomUUID(),
      twinId,
      name: config.name,
      status: 'active',
      records: [],
      startedAt: new Date().toISOString(),
      filterPatterns: config.filterPatterns,
    };
    this.sessions.set(session.id, session);
    this.activeRecordings.add(session.id);
    return session;
  }

  async pauseRecording(sessionId: string): Promise<RecordingSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'active') return null;

    session.status = 'paused';
    session.pausedAt = new Date().toISOString();
    this.activeRecordings.delete(sessionId);
    return session;
  }

  async resumeRecording(sessionId: string): Promise<RecordingSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'paused') return null;

    session.status = 'active';
    this.activeRecordings.add(sessionId);
    return session;
  }

  async stopRecording(sessionId: string): Promise<RecordingSession | null> {
    const session = this.sessions.get(sessionId);
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
    const session = this.sessions.get(sessionId);
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
    return this.sessions.get(sessionId) ?? null;
  }

  async listSessions(twinId?: string): Promise<RecordingSession[]> {
    let sessions = Array.from(this.sessions.values());
    if (twinId) {
      sessions = sessions.filter((s) => s.twinId === twinId);
    }
    return sessions.sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );
  }

  async getRecords(sessionId: string): Promise<TrafficRecord[]> {
    const session = this.sessions.get(sessionId);
    return session?.records ?? [];
  }

  async getRecordsByTwin(twinId: string): Promise<TrafficRecord[]> {
    const records: TrafficRecord[] = [];
    for (const session of this.sessions.values()) {
      if (session.twinId === twinId) {
        records.push(...session.records);
      }
    }
    return records;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    this.activeRecordings.delete(sessionId);
    return this.sessions.delete(sessionId);
  }

  getActiveRecordingCount(): number {
    return this.activeRecordings.size;
  }

  isRecording(twinId: string): boolean {
    for (const sessionId of this.activeRecordings) {
      const session = this.sessions.get(sessionId);
      if (session?.twinId === twinId) return true;
    }
    return false;
  }
}
