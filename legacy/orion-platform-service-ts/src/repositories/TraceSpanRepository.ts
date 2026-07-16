import { BaseRepository, FindAllOptions, FindAllResult } from '../db/base-repository';

export interface TraceSpanEntity {
  id: string;
  tenantId: string;
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  operationName: string;
  serviceName: string;
  startTime: Date;
  endTime: Date | null;
  durationMs: number | null;
  statusCode: string;
  statusMessage: string | null;
  attributes: Record<string, unknown>;
  events: Array<Record<string, unknown>>;
  createdAt: Date;
}

export interface TraceSearchOptions {
  serviceName?: string;
  operationName?: string;
  minDuration?: number;
  maxDuration?: number;
  statusCode?: string;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  offset?: number;
}

export class TraceSpanRepository extends BaseRepository<TraceSpanEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'trace_spans');
  }

  async findByTraceId(traceId: string): Promise<TraceSpanEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM trace_spans WHERE trace_id = $1 ORDER BY start_time ASC`,
      [traceId],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async searchTraces(tenantId: string, options: TraceSearchOptions = {}): Promise<TraceSpanEntity[]> {
    const {
      serviceName,
      operationName,
      minDuration,
      maxDuration,
      statusCode,
      startTime,
      endTime,
      limit = 50,
      offset = 0,
    } = options;

    let query = `SELECT DISTINCT ON (trace_id) * FROM trace_spans WHERE tenant_id = $1 AND parent_span_id IS NULL`;
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (serviceName) {
      query += ` AND service_name = $${paramIndex}`;
      params.push(serviceName);
      paramIndex++;
    }

    if (operationName) {
      query += ` AND operation_name ILIKE $${paramIndex}`;
      params.push(`%${operationName}%`);
      paramIndex++;
    }

    if (minDuration !== undefined) {
      query += ` AND duration_ms >= $${paramIndex}`;
      params.push(minDuration);
      paramIndex++;
    }

    if (maxDuration !== undefined) {
      query += ` AND duration_ms <= $${paramIndex}`;
      params.push(maxDuration);
      paramIndex++;
    }

    if (statusCode) {
      query += ` AND status_code = $${paramIndex}`;
      params.push(statusCode);
      paramIndex++;
    }

    if (startTime) {
      query += ` AND start_time >= $${paramIndex}`;
      params.push(startTime);
      paramIndex++;
    }

    if (endTime) {
      query += ` AND start_time <= $${paramIndex}`;
      params.push(endTime);
      paramIndex++;
    }

    query += ` ORDER BY trace_id, start_time DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async findByServiceName(tenantId: string, serviceName: string, limit: number = 50): Promise<TraceSpanEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM trace_spans WHERE tenant_id = $1 AND service_name = $2 AND parent_span_id IS NULL ORDER BY start_time DESC LIMIT $3`,
      [tenantId, serviceName, limit],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async deleteByTraceId(traceId: string): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM trace_spans WHERE trace_id = $1`,
      [traceId],
    );
    return result.rowCount ?? 0;
  }

  async deleteOlderThan(beforeTime: Date): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM trace_spans WHERE start_time < $1`,
      [beforeTime],
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): TraceSpanEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      traceId: row.trace_id,
      spanId: row.span_id,
      parentSpanId: row.parent_span_id ?? null,
      operationName: row.operation_name,
      serviceName: row.service_name,
      startTime: row.start_time,
      endTime: row.end_time ?? null,
      durationMs: row.duration_ms ?? null,
      statusCode: row.status_code || 'UNSET',
      statusMessage: row.status_message ?? null,
      attributes: row.attributes ?? {},
      events: row.events ?? [],
      createdAt: row.created_at,
    };
  }
}
