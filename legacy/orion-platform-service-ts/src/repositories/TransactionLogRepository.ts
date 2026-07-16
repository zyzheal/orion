/**
 * TransactionLogRepository - PostgreSQL persistence for saga transaction logs
 *
 * Provides CRUD operations for saga_checkpoints table.
 * Each row stores a complete saga transaction with its step execution history.
 */

import { TransactionLogEntry, TransactionLogFilter } from '../saga/TransactionLog';
import { SagaStatus } from '../saga/types';

export interface SagaCheckpointRecord {
  transaction_id: string;
  request_id: string;
  saga_name: string;
  status: string;
  input: Record<string, any>;
  output: Record<string, any> | null;
  error: string | null;
  metadata: Record<string, any>;
  step_executions: Record<string, any>[];
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

export class TransactionLogRepository {
  constructor(
    private pool: {
      query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
    }
  ) {}

  // ==================== CRUD ====================

  async save(entry: TransactionLogEntry): Promise<void> {
    const tenantId = entry.metadata?.tenantId as string;
    await this.pool.query(
      `INSERT INTO saga_checkpoints
        (transaction_id, request_id, saga_name, status, input, output, error, metadata, step_executions, created_at, updated_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (transaction_id) DO UPDATE SET
        request_id = EXCLUDED.request_id,
        saga_name = EXCLUDED.saga_name,
        status = EXCLUDED.status,
        input = EXCLUDED.input,
        output = EXCLUDED.output,
        error = EXCLUDED.error,
        metadata = EXCLUDED.metadata,
        step_executions = EXCLUDED.step_executions,
        updated_at = EXCLUDED.updated_at,
        completed_at = EXCLUDED.completed_at`,
      [
        entry.transactionId,
        entry.requestId,
        entry.sagaName,
        entry.status,
        JSON.stringify(entry.input || {}),
        entry.output != null ? JSON.stringify(entry.output) : null,
        entry.error || null,
        JSON.stringify(entry.metadata || {}),
        JSON.stringify(entry.stepExecutions || []),
        entry.createdAt,
        entry.updatedAt,
        entry.completedAt || null,
      ]
    );
  }

  async get(transactionId: string): Promise<SagaCheckpointRecord | null> {
    const result = await this.pool.query(
      'SELECT * FROM saga_checkpoints WHERE transaction_id = $1',
      [transactionId]
    );
    if (result.rows[0]) {
      return this.mapRow(result.rows[0]);
    }
    return null;
  }

  async getByRequestId(requestId: string): Promise<SagaCheckpointRecord | null> {
    const result = await this.pool.query(
      'SELECT * FROM saga_checkpoints WHERE request_id = $1',
      [requestId]
    );
    if (result.rows[0]) {
      return this.mapRow(result.rows[0]);
    }
    return null;
  }

  async delete(transactionId: string): Promise<void> {
    await this.pool.query('DELETE FROM saga_checkpoints WHERE transaction_id = $1', [transactionId]);
  }

  // ==================== Query ====================

  async query(filter: TransactionLogFilter): Promise<SagaCheckpointRecord[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filter.transactionId) {
      conditions.push(`transaction_id = $${paramIndex++}`);
      params.push(filter.transactionId);
    }

    if (filter.requestId) {
      conditions.push(`request_id = $${paramIndex++}`);
      params.push(filter.requestId);
    }

    if (filter.sagaName) {
      conditions.push(`saga_name = $${paramIndex++}`);
      params.push(filter.sagaName);
    }

    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      const placeholders = statuses.map((_s: SagaStatus) => `$${paramIndex++}`).join(', ');
      conditions.push(`status IN (${placeholders})`);
      params.push(...statuses.map(s => s.toString()));
    }

    if (filter.createdAfter) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(filter.createdAfter);
    }

    if (filter.createdBefore) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(filter.createdBefore);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderClause = 'ORDER BY created_at DESC';
    const limitClause = filter.limit ? `LIMIT ${filter.limit}` : '';
    const offsetClause = filter.offset ? `OFFSET ${filter.offset}` : '';

    const queryText = `SELECT * FROM saga_checkpoints ${whereClause} ${orderClause} ${limitClause} ${offsetClause}`;
    const result = await this.pool.query(queryText, params);

    return result.rows.map(row => this.mapRow(row));
  }

  async getRecoverable(): Promise<SagaCheckpointRecord[]> {
    const result = await this.pool.query(
      `SELECT * FROM saga_checkpoints
       WHERE status IN ('running', 'compensating')
       ORDER BY created_at DESC`
    );
    return result.rows.map(row => this.mapRow(row));
  }

  // ==================== Mapping ====================

  private mapRow(row: any): SagaCheckpointRecord {
    return {
      transaction_id: row.transaction_id,
      request_id: row.request_id,
      saga_name: row.saga_name,
      status: row.status,
      input: row.input || {},
      output: row.output,
      error: row.error,
      metadata: row.metadata || {},
      step_executions: row.step_executions || [],
      created_at: row.created_at,
      updated_at: row.updated_at,
      completed_at: row.completed_at,
    };
  }
}
