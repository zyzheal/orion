/**
 * ExecutionTimelineRepository - PostgreSQL persistence for execution timelines and events
 *
 * Replaces the in-memory Map() storage in ExecutionTimelineService.
 * Uses DatabasePool for connection management with RLS tenant isolation.
 */

import { DatabasePool } from '../services/database';

export interface TimelineRow {
  id: string;
  run_id: string;
  task_id: string;
  plugin_id: string;
  tenant_id: string;
  step_name: string;
  started_at: Date;
  ended_at: Date | null;
  duration_ms: number | null;
  status: string;
  isolation_tier: string | null;
  trace_id: string | null;
  span_id: string | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface EventRow {
  id: string;
  timeline_id: string;
  event_type: string;
  timestamp: Date;
  level: string;
  message: string | null;
  metadata: Record<string, unknown> | null;
  sequence_num: number;
}

export class ExecutionTimelineRepository {
  constructor(private pool: DatabasePool) {}

  // ==================== Timeline Operations ====================

  /**
   * Insert or update a timeline entry (upsert on id conflict)
   */
  async saveTimeline(params: {
    id: string;
    runId: string;
    taskId: string;
    pluginId: string;
    stepName: string;
    startedAt: Date;
    endedAt?: Date;
    durationMs?: number;
    status: string;
    isolationTier?: string;
    traceId?: string;
    errorMessage?: string;
    tenantId: string;
  }): Promise<TimelineRow> {
    const result = await this.pool.query(
      `INSERT INTO execution_timelines
         (id, run_id, task_id, plugin_id, step_name, started_at, ended_at, duration_ms, status, isolation_tier, trace_id, error_message, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         ended_at = EXCLUDED.ended_at,
         duration_ms = EXCLUDED.duration_ms,
         error_message = EXCLUDED.error_message,
         updated_at = NOW()
       RETURNING *`,
      [
        params.id,
        params.runId,
        params.taskId,
        params.pluginId,
        params.stepName,
        params.startedAt,
        params.endedAt || null,
        params.durationMs ?? null,
        params.status,
        params.isolationTier || null,
        params.traceId || null,
        params.errorMessage || null,
        params.tenantId,
      ]
    );
    return result.rows[0];
  }

  /**
   * Find all timelines for a given run, ordered by start time
   */
  async findByRunId(runId: string): Promise<TimelineRow[]> {
    const result = await this.pool.query(
      `SELECT * FROM execution_timelines WHERE run_id = $1 ORDER BY started_at ASC`,
      [runId]
    );
    return result.rows;
  }

  /**
   * Find a single timeline by ID
   */
  async findById(id: string): Promise<TimelineRow | null> {
    const result = await this.pool.query(
      `SELECT * FROM execution_timelines WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  // ==================== Event Operations ====================

  /**
   * Insert a timeline event
   */
  async saveEvent(params: {
    id: string;
    timelineId: string;
    eventType: string;
    timestamp: Date;
    level: string;
    message?: string;
    metadata?: Record<string, unknown>;
    sequenceNum: number;
  }): Promise<EventRow> {
    const result = await this.pool.query(
      `INSERT INTO execution_events (id, timeline_id, event_type, timestamp, level, message, metadata, sequence_num)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        params.id,
        params.timelineId,
        params.eventType,
        params.timestamp,
        params.level,
        params.message || null,
        params.metadata ? JSON.stringify(params.metadata) : null,
        params.sequenceNum,
      ]
    );
    return result.rows[0];
  }

  /**
   * Get the next sequence number for a timeline (max + 1)
   */
  async getNextSequenceNum(timelineId: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT COALESCE(MAX(sequence_num), 0) + 1 AS next_seq FROM execution_events WHERE timeline_id = $1`,
      [timelineId]
    );
    return result.rows[0].next_seq;
  }

  /**
   * Find all events for a timeline, ordered by sequence number
   */
  async findByTimelineId(timelineId: string): Promise<EventRow[]> {
    const result = await this.pool.query(
      `SELECT * FROM execution_events WHERE timeline_id = $1 ORDER BY sequence_num ASC`,
      [timelineId]
    );
    return result.rows;
  }
}
