// orion-platform-service/src/services/observability/ExecutionTimelineService.ts
// Execution Timeline Service - manages execution timeline snapshots for visual replay

import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface TimelineEntry {
  id: string;
  runId: string;
  taskId: string;
  pluginId: string;
  stepName: string;
  startedAt: Date;
  endedAt?: Date;
  durationMs?: number;
  status: 'running' | 'success' | 'failed' | 'timeout' | 'cancelled';
  isolationTier?: string;
  traceId?: string;
  errorMessage?: string;
}

export interface TimelineEvent {
  id: string;
  timelineId: string;
  eventType: 'start' | 'heartbeat' | 'log' | 'error' | 'complete' | 'timeout';
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message?: string;
  metadata?: Record<string, unknown>;
  sequenceNum: number;
}

/**
 * Repository interface for timeline persistence
 */
export interface TimelineEventRepository {
  saveTimeline(timeline: TimelineEntry): Promise<void>;
  saveEvent(event: TimelineEvent): Promise<void>;
  findByRunId(runId: string): Promise<TimelineEntry[]>;
  findByTimelineId(timelineId: string): Promise<TimelineEvent[]>;
}

/**
 * PostgreSQL implementation of TimelineEventRepository
 */
export class PostgresTimelineRepository implements TimelineEventRepository {
  constructor(private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> }) {}

  async saveTimeline(timeline: TimelineEntry): Promise<void> {
    await this.db.query(
      `INSERT INTO execution_timelines (id, run_id, task_id, plugin_id, step_name, started_at, ended_at, duration_ms, status, isolation_tier, trace_id, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE SET status = $9, ended_at = $7, duration_ms = $8, error_message = $12`,
      [
        timeline.id,
        timeline.runId,
        timeline.taskId,
        timeline.pluginId,
        timeline.stepName,
        timeline.startedAt,
        timeline.endedAt || null,
        timeline.durationMs || null,
        timeline.status,
        timeline.isolationTier || null,
        timeline.traceId || null,
        timeline.errorMessage || null,
      ]
    );
  }

  async saveEvent(event: TimelineEvent): Promise<void> {
    await this.db.query(
      `INSERT INTO execution_events (id, timeline_id, event_type, timestamp, level, message, metadata, sequence_num)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        event.id,
        event.timelineId,
        event.eventType,
        event.timestamp,
        event.level,
        event.message || null,
        event.metadata ? JSON.stringify(event.metadata) : null,
        event.sequenceNum,
      ]
    );
  }

  async findByRunId(runId: string): Promise<TimelineEntry[]> {
    const result = await this.db.query(
      `SELECT * FROM execution_timelines WHERE run_id = $1 ORDER BY started_at ASC`,
      [runId]
    );
    return result.rows.map(row => ({
      id: row.id,
      runId: row.run_id,
      taskId: row.task_id,
      pluginId: row.plugin_id,
      stepName: row.step_name,
      startedAt: new Date(row.started_at),
      endedAt: row.ended_at ? new Date(row.ended_at) : undefined,
      durationMs: row.duration_ms,
      status: row.status,
      isolationTier: row.isolation_tier,
      traceId: row.trace_id,
      errorMessage: row.error_message,
    }));
  }

  async findByTimelineId(timelineId: string): Promise<TimelineEvent[]> {
    const result = await this.db.query(
      `SELECT * FROM execution_events WHERE timeline_id = $1 ORDER BY sequence_num ASC`,
      [timelineId]
    );
    return result.rows.map(row => ({
      id: row.id,
      timelineId: row.timeline_id,
      eventType: row.event_type,
      timestamp: new Date(row.timestamp),
      level: row.level,
      message: row.message,
      metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : undefined,
      sequenceNum: row.sequence_num,
    }));
  }
}

/**
 * ExecutionTimelineService - manages execution timeline data
 * Supports both in-memory and PostgreSQL persistence
 */
export class ExecutionTimelineService {
  private timelines: Map<string, TimelineEntry> = new Map();
  private events: Map<string, TimelineEvent[]> = new Map();
  private sequenceCounter: Map<string, number> = new Map();
  private repository?: TimelineEventRepository;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(options?: { repository?: TimelineEventRepository }) {
    this.repository = options?.repository;
    this.startCleanupInterval();
  }

  async createTimeline(entry: Omit<TimelineEntry, 'id'>): Promise<TimelineEntry> {
    const id = `timeline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timeline: TimelineEntry = { ...entry, id };
    this.timelines.set(id, timeline);
    this.events.set(id, []);
    this.sequenceCounter.set(id, 0);

    // Persist to database if available
    if (this.repository) {
      try {
        await this.repository.saveTimeline(timeline);
      } catch (error) {
        logger.error({ error }, 'Failed to persist timeline');
      }
    }

    logger.info({ id, runId: entry.runId, taskId: entry.taskId }, 'Timeline created');
    return timeline;
  }

  async addEvent(timelineId: string, event: Omit<TimelineEvent, 'id' | 'sequenceNum'>): Promise<TimelineEvent> {
    const seqNum = (this.sequenceCounter.get(timelineId) || 0) + 1;
    this.sequenceCounter.set(timelineId, seqNum);

    const fullEvent: TimelineEvent = {
      ...event,
      id: `event-${seqNum}`,
      timelineId,
      sequenceNum: seqNum,
    };

    const events = this.events.get(timelineId) || [];
    events.push(fullEvent);
    this.events.set(timelineId, events);

    // Persist to database if available
    if (this.repository) {
      try {
        await this.repository.saveEvent(fullEvent);
      } catch (error) {
        logger.error({ error }, 'Failed to persist timeline event');
      }
    }

    return fullEvent;
  }

  updateTimelineStatus(
    timelineId: string,
    status: TimelineEntry['status'],
    endedAt?: Date
  ): void {
    const timeline = this.timelines.get(timelineId);
    if (timeline) {
      timeline.status = status;
      timeline.endedAt = endedAt || new Date();
      if (timeline.startedAt && timeline.endedAt) {
        timeline.durationMs = timeline.endedAt.getTime() - timeline.startedAt.getTime();
      }

      // Update in database
      if (this.repository) {
        this.repository.saveTimeline(timeline).catch(error =>
          logger.error({ error }, 'Failed to update timeline status')
        );
      }
    }
  }

  getTimelineByRunId(runId: string): TimelineEntry[] {
    return Array.from(this.timelines.values())
      .filter((t) => t.runId === runId)
      .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  }

  getEvents(timelineId: string): TimelineEvent[] {
    return (this.events.get(timelineId) || []).sort((a, b) => a.sequenceNum - b.sequenceNum);
  }

  async getReplayData(runId: string): Promise<{
    timelines: TimelineEntry[];
    events: Record<string, TimelineEvent[]>;
  }> {
    // Try database first
    if (this.repository) {
      try {
        const timelines = await this.repository.findByRunId(runId);
        const events: Record<string, TimelineEvent[]> = {};
        for (const timeline of timelines) {
          events[timeline.id] = await this.repository.findByTimelineId(timeline.id);
        }
        return { timelines, events };
      } catch (error) {
        logger.error({ error }, 'Failed to load replay data from DB, falling back to memory');
      }
    }

    // Fallback to memory
    const timelines = this.getTimelineByRunId(runId);
    const events: Record<string, TimelineEvent[]> = {};
    for (const timeline of timelines) {
      events[timeline.id] = this.getEvents(timeline.id);
    }
    return { timelines, events };
  }

  /**
   * SRE: TTL-based cleanup of stale in-memory timelines.
   * Prevents unbounded memory growth when PostgreSQL is unavailable.
   */
  private startCleanupInterval(): void {
    const TTL_MS = 30 * 60 * 1000; // 30 minutes
    const INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;
      for (const [id, timeline] of this.timelines) {
        const age = now - timeline.startedAt.getTime();
        if (age > TTL_MS) {
          this.timelines.delete(id);
          this.events.delete(id);
          this.sequenceCounter.delete(id);
          cleaned++;
        }
      }
      if (cleaned > 0) {
        logger.debug({ cleaned, remaining: this.timelines.size }, 'Evicted stale timeline entries');
      }
    }, INTERVAL_MS).unref();
  }

  /**
   * Shutdown the timeline service, cleaning up the eviction timer.
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.timelines.clear();
    this.events.clear();
    this.sequenceCounter.clear();
    logger.info('ExecutionTimelineService shutdown complete');
  }
}

/**
 * Global registry for timeline services, used for graceful shutdown.
 */
const timelineRegistry: ExecutionTimelineService[] = [];

/**
 * Register an ExecutionTimelineService for graceful shutdown.
 */
export function registerTimelineForShutdown(timeline: ExecutionTimelineService): void {
  timelineRegistry.push(timeline);
}

/**
 * Shutdown all registered timeline services.
 */
export function shutdownAllTimelines(): void {
  logger.info({ count: timelineRegistry.length }, 'Shutting down timeline services...');
  for (const timeline of timelineRegistry) {
    try {
      timeline.shutdown();
    } catch (error) {
      logger.error({ error }, 'Error shutting down timeline service');
    }
  }
  timelineRegistry.length = 0;
}
