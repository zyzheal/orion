// orion-platform-service/src/services/observability/ExecutionTimelineService.ts
// Execution Timeline Service - manages execution timeline snapshots for visual replay
//
// Migrated from in-memory Map() storage to PostgreSQL via ExecutionTimelineRepository.

import pino from 'pino';
import { ExecutionTimelineRepository } from '../../repositories/ExecutionTimelineRepository';
import { getCurrentTenantId } from '../../db/tenant-context-storage';

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
 * ExecutionTimelineService - manages execution timeline data
 *
 * All persistence is delegated to ExecutionTimelineRepository (PostgreSQL).
 * No in-memory Maps — the database is the single source of truth.
 */
export class ExecutionTimelineService {
  private repository: ExecutionTimelineRepository;
  private tenantId: string;

  constructor(options: { repository: ExecutionTimelineRepository; tenantId?: string }) {
    this.repository = options.repository;
    this.tenantId = options.tenantId || getCurrentTenantId();
  }

  async createTimeline(entry: Omit<TimelineEntry, 'id'>): Promise<TimelineEntry> {
    const id = `timeline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await this.repository.saveTimeline({
      id,
      runId: entry.runId,
      taskId: entry.taskId,
      pluginId: entry.pluginId,
      stepName: entry.stepName,
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
      durationMs: entry.durationMs,
      status: entry.status,
      isolationTier: entry.isolationTier,
      traceId: entry.traceId,
      errorMessage: entry.errorMessage,
      tenantId: this.tenantId,
    });

    logger.info({ id, runId: entry.runId, taskId: entry.taskId }, 'Timeline created');

    return { ...entry, id };
  }

  async addEvent(timelineId: string, event: Omit<TimelineEvent, 'id' | 'sequenceNum'>): Promise<TimelineEvent> {
    const seqNum = await this.repository.getNextSequenceNum(timelineId);
    const id = `event-${seqNum}`;

    await this.repository.saveEvent({
      id,
      timelineId,
      eventType: event.eventType,
      timestamp: event.timestamp,
      level: event.level,
      message: event.message,
      metadata: event.metadata,
      sequenceNum: seqNum,
    });

    return {
      ...event,
      id,
      timelineId,
      sequenceNum: seqNum,
    };
  }

  async updateTimelineStatus(
    timelineId: string,
    status: TimelineEntry['status'],
    endedAt?: Date
  ): Promise<void> {
    const existing = await this.repository.findById(timelineId);
    if (!existing) {
      logger.warn({ timelineId }, 'Timeline not found for status update');
      return;
    }

    const resolvedEndedAt = endedAt || new Date();
    const durationMs = existing.started_at
      ? resolvedEndedAt.getTime() - new Date(existing.started_at).getTime()
      : undefined;

    await this.repository.saveTimeline({
      id: existing.id,
      runId: existing.run_id,
      taskId: existing.task_id,
      pluginId: existing.plugin_id,
      stepName: existing.step_name,
      startedAt: new Date(existing.started_at),
      endedAt: resolvedEndedAt,
      durationMs,
      status,
      isolationTier: existing.isolation_tier || undefined,
      traceId: existing.trace_id || undefined,
      errorMessage: existing.error_message || undefined,
      tenantId: existing.tenant_id,
    });
  }

  async getTimelineByRunId(runId: string): Promise<TimelineEntry[]> {
    const rows = await this.repository.findByRunId(runId);
    return rows.map(row => ({
      id: row.id,
      runId: row.run_id,
      taskId: row.task_id,
      pluginId: row.plugin_id,
      stepName: row.step_name,
      startedAt: new Date(row.started_at),
      endedAt: row.ended_at ? new Date(row.ended_at) : undefined,
      durationMs: row.duration_ms ?? undefined,
      status: row.status as TimelineEntry['status'],
      isolationTier: row.isolation_tier || undefined,
      traceId: row.trace_id || undefined,
      errorMessage: row.error_message || undefined,
    }));
  }

  async getEvents(timelineId: string): Promise<TimelineEvent[]> {
    const rows = await this.repository.findByTimelineId(timelineId);
    return rows.map(row => ({
      id: row.id,
      timelineId: row.timeline_id,
      eventType: row.event_type as TimelineEvent['eventType'],
      timestamp: new Date(row.timestamp),
      level: row.level as TimelineEvent['level'],
      message: row.message || undefined,
      metadata: row.metadata || undefined,
      sequenceNum: row.sequence_num,
    }));
  }

  async getReplayData(runId: string): Promise<{
    timelines: TimelineEntry[];
    events: Record<string, TimelineEvent[]>;
  }> {
    const timelines = await this.getTimelineByRunId(runId);
    const events: Record<string, TimelineEvent[]> = {};
    for (const timeline of timelines) {
      events[timeline.id] = await this.getEvents(timeline.id);
    }
    return { timelines, events };
  }

  /**
   * Shutdown the timeline service. No-op when backed by PostgreSQL
   * (no in-memory state to clean up).
   */
  shutdown(): void {
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
