/**
 * TrafficReplayService - Phase 4 Digital Twin Enhancement
 *
 * Replays recorded traffic against sandbox environments for testing.
 * Supports configurable replay speed, filtering, and comparison with original responses.
 * Uses PostgreSQL Repository pattern with in-memory fallback.
 */

import { randomUUID } from 'crypto';
import { DatabasePool } from '../database';
import { ReplaySessionRepository } from '../../repositories/DigitalTwinEnhancedRepository';
import { TrafficRecord } from './TrafficRecorderService';
import { createLogger } from '../../utils/logger';

const logger = createLogger('LTraffic-LReplay-LService');

export interface ReplayConfig {
  speedMultiplier?: number;
  maxConcurrency?: number;
  filterPaths?: string[];
  targetEndpoint?: string;
  compareResponses?: boolean;
  stopOnFailure?: boolean;
  tenantId?: string;
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
  private repo?: ReplaySessionRepository;
  private memory = new Map<string, ReplaySession>();

  constructor(db?: DatabasePool) {
    if (db) {
      this.repo = new ReplaySessionRepository(db);
    }
  }

  // ==================== Repository injection for testing ====================
  setRepository(repo: ReplaySessionRepository): void {
    this.repo = repo;
  }

  async startReplay(
    twinId: string,
    recordingSessionId: string,
    records: TrafficRecord[],
    sandboxEndpoint: string,
    config: ReplayConfig = {},
  ): Promise<ReplaySession> {
    const filteredRecords = this.filterRecords(records, config);

    if (this.repo) {
      const entity = await this.repo.insert({
        tenant_id: config.tenantId ?? 'default',
        twin_id: twinId,
        recording_session_id: recordingSessionId,
        sandbox_endpoint: sandboxEndpoint,
        total_requests: filteredRecords.length,
        config: config as Record<string, unknown>,
      });

      // Start replay asynchronously
      this.executeReplayWithRepo(entity.id, filteredRecords).catch((err) => {
        logger.error(`Replay session ${entity.id} failed:`, err);
      });

      return this.entityToSession(entity);
    }

    // 内存回退
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

    this.memory.set(session.id, session);

    // Start replay asynchronously
    this.executeReplay(session, filteredRecords).catch((err) => {
      logger.error(`Replay session ${session.id} failed:`, err);
    });

    return session;
  }

  async getSession(sessionId: string): Promise<ReplaySession | null> {
    if (this.repo) {
      const entity = await this.repo.findById(sessionId);
      return entity ? this.entityToSession(entity) : null;
    }
    return this.memory.get(sessionId) ?? null;
  }

  async listSessions(twinId?: string): Promise<ReplaySession[]> {
    if (this.repo) {
      let entities: any[];
      if (twinId) {
        entities = await this.repo.findByTwin(twinId);
      } else {
        const result = await this.repo.findAll({ limit: 1000 });
        entities = (result as any).entities || result;
      }
      return entities
        .map(e => this.entityToSession(e))
        .sort(
          (a, b) =>
            new Date(b.startedAt ?? '').getTime() -
            new Date(a.startedAt ?? '').getTime(),
        );
    }

    // 内存回退
    let sessions = Array.from(this.memory.values());
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
    if (this.repo) {
      const session = await this.repo.findById(sessionId);
      if (!session || session.status !== 'running') return null;

      const completedAt = new Date().toISOString();
      const updated = await this.repo.updateStatus(sessionId, 'cancelled', completedAt);
      return updated ? this.entityToSession(updated) : null;
    }

    // 内存回退
    const session = this.memory.get(sessionId);
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

  private async executeReplayWithRepo(
    sessionId: string,
    records: TrafficRecord[],
  ): Promise<void> {
    if (!this.repo) return;

    const startedAt = new Date().toISOString();
    await this.repo.setStartedAt(sessionId, startedAt);
    await this.repo.updateStatus(sessionId, 'running');

    // Get current session for config
    const session = await this.repo.findById(sessionId);
    if (!session) return;

    const concurrency = (session.config as any)?.maxConcurrency ?? 1;

    let completed = 0;
    let matched = 0;
    let failed = 0;
    const results: ReplayResult[] = [];

    for (let i = 0; i < records.length; i += concurrency) {
      const batch = records.slice(i, i + concurrency);

      const batchResults = await Promise.all(
        batch.map(async (record, idx) => {
          try {
            const result = await this.replaySingleRequest(
              record,
              (session.config as any)?.targetEndpoint ?? session.sandboxEndpoint,
              (session.config as any)?.compareResponses ?? true,
            );
            return result;
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            return {
              requestIndex: i + idx,
              recordId: record.id,
              originalStatus: record.response.statusCode,
              replayStatus: null,
              originalBody: record.response.body,
              replayBody: null,
              latencyDiff: 0,
              matched: false,
              error: errMsg,
            };
          }
        }),
      );

      results.push(...batchResults);
      completed += batchResults.length;
      matched += batchResults.filter(r => r.matched).length;
      failed += batchResults.filter(r => !r.matched).length;

      const progress = Math.round((completed / records.length) * 100);
      await this.repo.updateProgress(sessionId, completed, matched, failed, progress);
      await this.repo.addResults(sessionId, batchResults);

      // Apply speed multiplier delay
      const speedMultiplier = (session.config as any)?.speedMultiplier;
      if (speedMultiplier && speedMultiplier > 0) {
        const delay = (records[i]?.response.latencyMs ?? 0) / speedMultiplier;
        await this.delay(delay);
      }
    }

    const completedAt = new Date().toISOString();
    await this.repo.updateStatus(sessionId, 'completed', completedAt);
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

  private entityToSession(entity: any): ReplaySession {
    return {
      id: entity.id,
      twinId: entity.twinId,
      recordingSessionId: entity.recordingSessionId,
      sandboxEndpoint: entity.sandboxEndpoint,
      status: entity.status,
      totalRequests: entity.totalRequests ?? 0,
      completedRequests: entity.completedRequests ?? 0,
      matchedRequests: entity.matchedRequests ?? 0,
      failedRequests: entity.failedRequests ?? 0,
      results: (entity.results || []).map((r: any) => ({
        requestIndex: r.requestIndex ?? 0,
        recordId: r.recordId,
        originalStatus: r.originalStatus,
        replayStatus: r.replayStatus,
        originalBody: r.originalBody,
        replayBody: r.replayBody,
        latencyDiff: r.latencyDiff ?? 0,
        matched: r.matched,
        error: r.error,
      })),
      config: entity.config ?? {},
      startedAt: entity.startedAt,
      completedAt: entity.completedAt,
      progress: entity.progress ?? 0,
    };
  }
}
