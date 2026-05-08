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
 * ExecutionTimelineService - manages execution timeline data
 * Phase 4: in-memory implementation, will be wired to PostgreSQL in production
 */
export class ExecutionTimelineService {
  private timelines: Map<string, TimelineEntry> = new Map();
  private events: Map<string, TimelineEvent[]> = new Map();
  private sequenceCounter: Map<string, number> = new Map();

  createTimeline(entry: Omit<TimelineEntry, 'id'>): TimelineEntry {
    const id = `timeline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timeline: TimelineEntry = { ...entry, id };
    this.timelines.set(id, timeline);
    this.events.set(id, []);
    this.sequenceCounter.set(id, 0);

    logger.info({ id, runId: entry.runId, taskId: entry.taskId }, 'Timeline created');
    return timeline;
  }

  addEvent(timelineId: string, event: Omit<TimelineEvent, 'id' | 'sequenceNum'>): TimelineEvent {
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

  getReplayData(runId: string): {
    timelines: TimelineEntry[];
    events: Record<string, TimelineEvent[]>;
  } {
    const timelines = this.getTimelineByRunId(runId);
    const events: Record<string, TimelineEvent[]> = {};
    for (const timeline of timelines) {
      events[timeline.id] = this.getEvents(timeline.id);
    }
    return { timelines, events };
  }
}
