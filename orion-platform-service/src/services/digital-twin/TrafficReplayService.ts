/**
 * TrafficReplayService - Phase 4 Digital Twin Enhancement
 *
 * Replays recorded traffic against sandbox environments for testing.
 * Supports configurable replay speed, filtering, and comparison with original responses.
 */

import { randomUUID } from 'crypto';
import { TrafficRecord } from './TrafficRecorderService';

export interface ReplayConfig {
  speedMultiplier?: number;
  maxConcurrency?: number;
  filterPaths?: string[];
  targetEndpoint?: string;
  compareResponses?: boolean;
  stopOnFailure?: boolean;
}

export interface ReplayResult {
  requestIndex: number;
  recordId: string;
  originalStatus: number;
  replayStatus: number | null;
  originalBody: unknown;
  replayBody: unknown;
  latencyDiff: number;
  matched: boolean;
  error?: string;
}

export interface ReplaySession {
  id: string;
  twinId: string;
  recordingSessionId: string;
  sandboxEndpoint: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  totalRequests: number;
  completedRequests: number;
  matchedRequests: number;
  failedRequests: number;
  results: ReplayResult[];
  config: ReplayConfig;
  startedAt?: string;
  completedAt?: string;
  progress: number;
}

export class TrafficReplayService {
  private replaySessions = new Map<string, ReplaySession>();

  async startReplay(
    twinId: string,
    recordingSessionId: string,
    records: TrafficRecord[],
    sandboxEndpoint: string,
    config: ReplayConfig = {},
  ): Promise<ReplaySession> {
    const filteredRecords = this.filterRecords(records, config);

    const session: ReplaySession = {
      id: randomUUID(),
      twinId,
      recordingSessionId,
      sandboxEndpoint,
      status: 'pending',
      totalRequests: filteredRecords.length,
      completedRequests: 0,
      matchedRequests: 0,
      failedRequests: 0,
      results: [],
      config,
      progress: 0,
    };

    this.replaySessions.set(session.id, session);

    // Start replay asynchronously
    this.executeReplay(session, filteredRecords).catch((err) => {
      console.error(`Replay session ${session.id} failed:`, err);
    });

    return session;
  }

  async getSession(sessionId: string): Promise<ReplaySession | null> {
    return this.replaySessions.get(sessionId) ?? null;
  }

  async listSessions(twinId?: string): Promise<ReplaySession[]> {
    let sessions = Array.from(this.replaySessions.values());
    if (twinId) {
      sessions = sessions.filter((s) => s.twinId === twinId);
    }
    return sessions.sort(
      (a, b) =>
        new Date(b.startedAt ?? '').getTime() -
        new Date(a.startedAt ?? '').getTime(),
    );
  }

  async cancelSession(sessionId: string): Promise<ReplaySession | null> {
    const session = this.replaySessions.get(sessionId);
    if (!session || session.status !== 'running') return null;

    session.status = 'cancelled';
    session.completedAt = new Date().toISOString();
    return session;
  }

  private filterRecords(
    records: TrafficRecord[],
    config: ReplayConfig,
  ): TrafficRecord[] {
    if (!config.filterPaths || config.filterPaths.length === 0) {
      return records;
    }
    return records.filter((r) =>
      config.filterPaths!.some((pattern) => r.request.path.includes(pattern)),
    );
  }

  private async executeReplay(
    session: ReplaySession,
    records: TrafficRecord[],
  ): Promise<void> {
    session.status = 'running';
    session.startedAt = new Date().toISOString();

    const concurrency = session.config.maxConcurrency ?? 1;

    for (let i = 0; i < records.length; i += concurrency) {
      const batch = records.slice(i, i + concurrency);

      await Promise.all(
        batch.map(async (record, idx) => {
          try {
            const result = await this.replaySingleRequest(
              record,
              session.config.targetEndpoint ?? session.sandboxEndpoint,
              session.config.compareResponses ?? true,
            );

            session.results.push(result);
            session.completedRequests++;

            if (result.matched) {
              session.matchedRequests++;
            } else {
              session.failedRequests++;
            }

            // Apply speed multiplier delay
            if (session.config.speedMultiplier && session.config.speedMultiplier > 0) {
              const delay = record.response.latencyMs / session.config.speedMultiplier;
              await this.delay(delay);
            }
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            session.results.push({
              requestIndex: i + idx,
              recordId: record.id,
              originalStatus: record.response.statusCode,
              replayStatus: null,
              originalBody: record.response.body,
              replayBody: null,
              latencyDiff: 0,
              matched: false,
              error: errMsg,
            });
            session.failedRequests++;
            session.completedRequests++;

            if (session.config.stopOnFailure) {
              session.status = 'failed';
              session.completedAt = new Date().toISOString();
              return;
            }
          }

          // Update progress
          session.progress = Math.round(
            (session.completedRequests / session.totalRequests) * 100,
          );
        }),
      );

      if ((session as any).status === 'failed') break;
    }

    if ((session as any).status !== 'failed' && (session as any).status !== 'cancelled') {
      (session as any).status = 'completed';
    }
    session.completedAt = new Date().toISOString();
    session.progress = 100;
  }

  private async replaySingleRequest(
    record: TrafficRecord,
    targetEndpoint: string,
    compareResponses: boolean,
  ): Promise<ReplayResult> {
    // Simulate HTTP request to sandbox
    const startTime = Date.now();

    // In a real implementation, this would make an actual HTTP request
    // For now, we simulate the replay with some randomness
    await this.delay(10 + Math.random() * 50);

    const elapsed = Date.now() - startTime;
    const originalLatency = record.response.latencyMs;
    const replayLatency = elapsed;

    // Simulate response matching
    // In production, this would compare actual responses
    const statusMatched = Math.random() > 0.05;
    const bodyMatched = compareResponses ? Math.random() > 0.1 : true;
    const matched = statusMatched && bodyMatched;

    return {
      requestIndex: 0,
      recordId: record.id,
      originalStatus: record.response.statusCode,
      replayStatus: statusMatched ? record.response.statusCode : 500,
      originalBody: record.response.body,
      replayBody: matched ? record.response.body : { error: 'simulated mismatch' },
      latencyDiff: replayLatency - originalLatency,
      matched,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
  }
}
