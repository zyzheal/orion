/**
 * DevPortalPlaygroundRepository
 * Data access layer for API playground requests and responses.
 * Replaces in-memory Maps in APIPlaygroundService.
 */

import { ErrorCode } from '../errors';
import { BaseRepository } from '../db/base-repository';
import { OrionError } from '../errors';

// ==================== Playground Request ====================

export interface DevPortalPlaygroundRequestEntity {
  id: string;
  tenantId: string;
  userId: string;
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  queryParams: Record<string, string>;
  body: string;
  bodyType: string;
  createdAt: Date;
}

export class DevPortalPlaygroundRequestRepository extends BaseRepository<DevPortalPlaygroundRequestEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'devportal_playground_requests');
  }

  async create(data: Omit<DevPortalPlaygroundRequestEntity, 'createdAt'> & Partial<Pick<DevPortalPlaygroundRequestEntity, 'id'>>): Promise<DevPortalPlaygroundRequestEntity> {
    const columns = ['id', 'tenant_id', 'user_id', 'name', 'method', 'url', 'headers', 'query_params', 'body', 'body_type'];
    const values = [data.id, data.tenantId, data.userId, data.name, data.method, data.url, JSON.stringify(data.headers), JSON.stringify(data.queryParams), data.body, data.bodyType];

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError('OPERATION_FAILED', ErrorCode.DATABASE_ERROR);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByUser(tenantId: string, userId: string, options?: { method?: string; limit?: number; offset?: number }): Promise<DevPortalPlaygroundRequestEntity[]> {
    let query = `SELECT * FROM ${this.tableName} WHERE tenant_id = $1 AND user_id = $2`;
    const params: unknown[] = [tenantId, userId];
    let paramIdx = 3;

    if (options?.method) {
      query += ` AND method = $${paramIdx++}`;
      params.push(options.method.toUpperCase());
    }

    query += ` ORDER BY created_at DESC`;
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;
    query += ` LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async countByUser(tenantId: string, userId: string, method?: string): Promise<number> {
    let query = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE tenant_id = $1 AND user_id = $2`;
    const params: unknown[] = [tenantId, userId];
    if (method) {
      query += ` AND method = $3`;
      params.push(method.toUpperCase());
    }
    const result = await this.db.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  protected mapRowToEntity(row: any): DevPortalPlaygroundRequestEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      name: row.name,
      method: row.method,
      url: row.url,
      headers: row.headers ?? {},
      queryParams: row.query_params ?? {},
      body: row.body ?? '',
      bodyType: row.body_type,
      createdAt: row.created_at,
    };
  }
}

// ==================== Playground Response ====================

export interface DevPortalPlaygroundResponseEntity {
  id: string;
  requestId: string;
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  latencyMs: number;
  timestamp: Date;
  createdAt: Date;
}

export class DevPortalPlaygroundResponseRepository extends BaseRepository<DevPortalPlaygroundResponseEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'devportal_playground_responses');
  }

  async create(data: Omit<DevPortalPlaygroundResponseEntity, 'createdAt'> & Partial<Pick<DevPortalPlaygroundResponseEntity, 'id'>>): Promise<DevPortalPlaygroundResponseEntity> {
    const columns = ['id', 'request_id', 'status_code', 'status_text', 'headers', 'body', 'latency_ms', 'timestamp'];
    const values = [data.id, data.requestId, data.statusCode, data.statusText, JSON.stringify(data.headers), data.body, data.latencyMs, data.timestamp];

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError('OPERATION_FAILED', ErrorCode.DATABASE_ERROR);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByRequestId(requestId: string, options?: { limit?: number; offset?: number }): Promise<DevPortalPlaygroundResponseEntity[]> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE request_id = $1 ORDER BY timestamp DESC LIMIT $2 OFFSET $3`,
      [requestId, limit, offset],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async countByRequestId(requestId: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*) as count FROM ${this.tableName} WHERE request_id = $1`,
      [requestId],
    );
    return parseInt(result.rows[0].count, 10);
  }

  async deleteByRequestId(requestId: string): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM ${this.tableName} WHERE request_id = $1`,
      [requestId],
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): DevPortalPlaygroundResponseEntity {
    return {
      id: row.id,
      requestId: row.request_id,
      statusCode: row.status_code,
      statusText: row.status_text,
      headers: row.headers ?? {},
      body: row.body ?? '',
      latencyMs: row.latency_ms,
      timestamp: row.timestamp,
      createdAt: row.created_at,
    };
  }
}
