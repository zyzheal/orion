/**
 * Distributed Tracing Service
 *
 * Provides distributed tracing for Orion platform services.
 * Implements trace context propagation (W3C Trace Context) and span collection.
 *
 * Features:
 *   - W3C Trace Context (traceparent header) support
 *   - Span collection with parent-child relationships
 *   - PostgreSQL persistence for spans
 *   - Trace querying and analysis
 *   - Integration with pino logger (automatic traceId attachment)
 *
 * Usage:
 *   1. Add traceContextMiddleware to Fastify app
 *   2. Create spans in services/controllers
 *   3. Query traces via API
 */

import crypto from 'crypto';
import { DatabasePool } from '../../services/database';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * W3C Trace Context format
 * traceparent: 00-{traceId}-{spanId}-{flags}
 *   - version: 00 (2 hex chars)
 *   - trace-id: 32 hex chars (16 bytes)
 *   - parent-id: 16 hex chars (8 bytes)
 *   - flags: 2 hex chars (00 = not sampled, 01 = sampled)
 */

export interface TraceContext {
  traceId: string;     // 32 hex chars
  spanId: string;      // 16 hex chars
  parentSpanId?: string;
  sampled: boolean;
}

export interface SpanInput {
  name: string;
  operation: string;
  kind: 'server' | 'client' | 'producer' | 'consumer' | 'internal';
  serviceName: string;
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
  status: 'ok' | 'error' | 'unset';
  attributes?: Record<string, string | number | boolean>;
  traceId: string;
  parentSpanId?: string;
  tenantId?: string;
}

export interface SpanEntity extends SpanInput {
  id: string;
}

export interface TraceEntity {
  traceId: string;
  rootService: string;
  rootOperation: string;
  startTime: Date;
  endTime: Date;
  durationMs: number;
  spanCount: number;
  status: 'ok' | 'error';
  tenantId?: string;
}

export class TracingService {
  private pool: DatabasePool;

  constructor(pool: DatabasePool) {
    this.pool = pool;
  }

  /**
   * Generate a new trace context (for incoming requests without traceparent)
   */
  static generateTraceContext(): TraceContext {
    return {
      traceId: crypto.randomBytes(16).toString('hex'),
      spanId: crypto.randomBytes(8).toString('hex'),
      sampled: true,
    };
  }

  /**
   * Parse W3C Trace Context from traceparent header
   * Format: 00-{traceId}-{spanId}-{flags}
   */
  static parseTraceParent(header: string): TraceContext | null {
    const parts = header.split('-');
    if (parts.length !== 4 || parts[0] !== '00') {
      return null;
    }

    const [version, traceId, spanId, flags] = parts;
    if (traceId.length !== 32 || spanId.length !== 16 || flags.length !== 2) {
      return null;
    }

    return {
      traceId,
      spanId,
      sampled: flags === '01',
    };
  }

  /**
   * Build W3C Trace Context header for downstream propagation
   */
  static buildTraceParent(traceId: string, spanId: string, sampled: boolean = true): string {
    return `00-${traceId}-${spanId}-${sampled ? '01' : '00'}`;
  }

  /**
   * Generate a new span ID for child operations
   */
  static generateSpanId(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Create and persist a span
   */
  async createSpan(input: SpanInput): Promise<SpanEntity> {
    const id = crypto.randomUUID();
    const endTime = input.endTime || new Date();
    const startTime = input.startTime;
    const durationMs = input.durationMs || (endTime.getTime() - startTime.getTime());

    const entity: SpanEntity = {
      id,
      ...input,
      endTime,
      durationMs,
      attributes: input.attributes || {},
    };

    try {
      await this.pool.query(
        `INSERT INTO spans (
          id, trace_id, parent_span_id, span_id, name, operation, kind,
          service_name, start_time, end_time, duration_ms, status,
          attributes, tenant_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          id,
          input.traceId,
          input.parentSpanId || null,
          crypto.randomUUID().slice(0, 16), // span_id for this span
          input.name,
          input.operation,
          input.kind,
          input.serviceName,
          startTime,
          endTime,
          durationMs,
          input.status,
          JSON.stringify(input.attributes || {}),
          input.tenantId || null,
        ]
      );
    } catch (error) {
      logger.error('[TracingService] Failed to persist span:', error);
      // Don't throw - tracing should not break main flow
    }

    return entity;
  }

  /**
   * Get all spans for a trace
   */
  async getTrace(traceId: string): Promise<SpanEntity[]> {
    const result = await this.pool.query(
      `SELECT id, trace_id, parent_span_id, span_id, name, operation, kind,
              service_name, start_time, end_time, duration_ms, status,
              attributes, tenant_id
       FROM spans
       WHERE trace_id = $1
       ORDER BY start_time`,
      [traceId]
    );
    return result.rows as SpanEntity[];
  }

  /**
   * Get trace summary (aggregated view)
   */
  async getTraceSummary(traceId: string): Promise<TraceEntity | null> {
    const result = await this.pool.query(
      `SELECT
        trace_id,
        MIN(service_name) as root_service,
        MIN(operation) as root_operation,
        MIN(start_time) as start_time,
        MAX(end_time) as end_time,
        MAX(duration_ms) as duration_ms,
        COUNT(*) as span_count,
        CASE WHEN SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) > 0 THEN 'error' ELSE 'ok' END as status,
        MIN(tenant_id) as tenant_id
       FROM spans
       WHERE trace_id = $1
       GROUP BY trace_id`,
      [traceId]
    );
    return result.rows[0] as TraceEntity | null;
  }

  /**
   * List recent traces (optionally filtered by service or status)
   */
  async listTraces(options?: {
    serviceName?: string;
    status?: 'ok' | 'error';
    tenantId?: string;
    limit?: number;
    since?: Date;
  }): Promise<TraceEntity[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.serviceName) {
      conditions.push(`root_service = $${paramIndex++}`);
      params.push(options.serviceName);
    }
    if (options?.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(options.status);
    }
    if (options?.tenantId) {
      conditions.push(`tenant_id = $${paramIndex++}`);
      params.push(options.tenantId);
    }
    if (options?.since) {
      conditions.push(`start_time >= $${paramIndex++}`);
      params.push(options.since);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options?.limit || 50;

    const result = await this.pool.query(
      `SELECT
        trace_id,
        MIN(service_name) as root_service,
        MIN(operation) as root_operation,
        MIN(start_time) as start_time,
        MAX(end_time) as end_time,
        MAX(duration_ms) as duration_ms,
        COUNT(*) as span_count,
        CASE WHEN SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) > 0 THEN 'error' ELSE 'ok' END as status,
        MIN(tenant_id) as tenant_id
       FROM spans
       ${whereClause}
       GROUP BY trace_id
       ORDER BY start_time DESC
       LIMIT $${paramIndex}`,
      [...params, limit]
    );

    return result.rows as TraceEntity[];
  }

  /**
   * Get slow traces (duration > threshold)
   */
  async getSlowTraces(thresholdMs: number, limit: number = 20): Promise<TraceEntity[]> {
    const result = await this.pool.query(
      `SELECT
        trace_id,
        MIN(service_name) as root_service,
        MIN(operation) as root_operation,
        MIN(start_time) as start_time,
        MAX(end_time) as end_time,
        MAX(duration_ms) as duration_ms,
        COUNT(*) as span_count,
        CASE WHEN SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) > 0 THEN 'error' ELSE 'ok' END as status,
        MIN(tenant_id) as tenant_id
       FROM spans
       GROUP BY trace_id
       HAVING MAX(duration_ms) > $1
       ORDER BY duration_ms DESC
       LIMIT $2`,
      [thresholdMs, limit]
    );
    return result.rows as TraceEntity[];
  }

  /**
   * Cleanup old traces (older than retention period)
   */
  async cleanupExpired(retentionDays: number = 7): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM spans WHERE start_time < NOW() - INTERVAL '${retentionDays} days'`
    );
    return result.rowCount ?? 0;
  }
}
