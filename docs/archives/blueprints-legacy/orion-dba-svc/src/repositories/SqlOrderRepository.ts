/**
 * SqlOrderRepository - SQL 工单数据访问层
 * PostgreSQL Repository pattern implementation
 */

import type { SqlOrder, CreateOrderInput } from '../types/dba.js';
import type { IDbAdapter } from '../db/database.js';

function rowToOrder(row: any): SqlOrder {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    sourceId: row.source_id,
    sql: row.sql_text,
    status: row.status,
    submittedBy: row.submitted_by,
    approvedBy: row.approved_by || undefined,
    executedBy: row.executed_by || undefined,
    submittedAt: row.submitted_at.toISOString(),
    approvedAt: row.approved_at ? new Date(row.approved_at).toISOString() : undefined,
    executedAt: row.executed_at ? new Date(row.executed_at).toISOString() : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : undefined,
    error: row.error || undefined,
  };
}

export class SqlOrderRepository {
  constructor(private pool: IDbAdapter) {}

  async create(tenantId: string, submittedBy: string, input: CreateOrderInput): Promise<SqlOrder> {
    const result = await this.pool.query(
      `INSERT INTO sql_orders (id, tenant_id, source_id, sql_text, status, submitted_by, submitted_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'pending', $4, now())
       RETURNING *`,
      [tenantId, input.sourceId, input.sql, submittedBy],
    );
    return rowToOrder(result.rows[0]);
  }

  async findById(id: string): Promise<SqlOrder | null> {
    const result = await this.pool.query('SELECT * FROM sql_orders WHERE id = $1', [id]);
    return result.rows[0] ? rowToOrder(result.rows[0]) : null;
  }

  async findByTenant(tenantId: string, status?: string): Promise<SqlOrder[]> {
    let sql = 'SELECT * FROM sql_orders WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    if (status) {
      params.push(status);
      sql += ` AND status = $${params.length}`;
    }
    sql += ' ORDER BY submitted_at DESC';
    const result = await this.pool.query(sql, params);
    return result.rows.map(rowToOrder);
  }

  async updateStatus(id: string, status: string, updatedBy: string): Promise<SqlOrder | null> {
    const setClauses: string[] = ['status = $1'];
    const params: unknown[] = [status];

    if (status === 'approved') {
      setClauses.push('approved_by = $2', 'approved_at = now()');
      params.push(updatedBy);
    } else if (status === 'executing') {
      setClauses.push('executed_by = $2', 'executed_at = now()');
      params.push(updatedBy);
    } else if (status === 'completed' || status === 'failed') {
      setClauses.push('completed_at = now()');
    }

    if (status === 'rejected') {
      params.push(updatedBy);
    }

    params.push(id);
    const idx = params.length;
    const finalSql = `UPDATE sql_orders SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`;
    const result = await this.pool.query(finalSql, params);
    return result.rows[0] ? rowToOrder(result.rows[0]) : null;
  }

  async markFailed(id: string, error: string): Promise<SqlOrder | null> {
    const result = await this.pool.query(
      `UPDATE sql_orders SET status = 'failed', error = $1, completed_at = now()
       WHERE id = $2 RETURNING *`,
      [error, id],
    );
    return result.rows[0] ? rowToOrder(result.rows[0]) : null;
  }

  async listAll(page = 1, limit = 20): Promise<{ items: SqlOrder[]; total: number }> {
    const offset = (page - 1) * limit;
    const countResult = await this.pool.query('SELECT COUNT(*) as cnt FROM sql_orders');
    const total = parseInt(countResult.rows[0].cnt, 10);

    const dataResult = await this.pool.query(
      'SELECT * FROM sql_orders ORDER BY submitted_at DESC LIMIT $1 OFFSET $2',
      [limit, offset],
    );
    return { items: dataResult.rows.map(rowToOrder), total };
  }
}
