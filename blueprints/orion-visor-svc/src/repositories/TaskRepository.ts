/**
 * TaskRepository - 任务执行数据访问层
 * PostgreSQL Repository pattern implementation
 */

import type { Task, ExecuteScriptInput } from '../types/visor.js';
import type { IDbAdapter } from '../db/database.js';

function rowToTask(row: any): Task {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    hostIds: Array.isArray(row.host_ids) ? row.host_ids : (typeof row.host_ids === 'string' ? JSON.parse(row.host_ids) : []),
    scriptId: row.script_id,
    status: row.status,
    output: row.output || undefined,
    error: row.error || undefined,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).toISOString(),
    startedAt: row.started_at ? new Date(row.started_at).toISOString() : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : undefined,
  };
}

export class TaskRepository {
  constructor(private pool: IDbAdapter) {}

  async create(tenantId: string, createdBy: string, input: ExecuteScriptInput & { scriptId: string }): Promise<Task> {
    const result = await this.pool.query(
      `INSERT INTO tasks (id, tenant_id, host_ids, script_id, status, created_by, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'pending', $4, now())
       RETURNING *`,
      [tenantId, JSON.stringify(input.hostIds), input.scriptId, createdBy],
    );
    return rowToTask(result.rows[0]);
  }

  async findById(id: string): Promise<Task | null> {
    const result = await this.pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
    return result.rows[0] ? rowToTask(result.rows[0]) : null;
  }

  async findByTenant(tenantId: string, status?: string): Promise<Task[]> {
    let sql = 'SELECT * FROM tasks WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    if (status) {
      params.push(status);
      sql += ` AND status = $${params.length}`;
    }
    sql += ' ORDER BY created_at DESC';
    const result = await this.pool.query(sql, params);
    return result.rows.map(rowToTask);
  }

  async updateStatus(id: string, status: string): Promise<Task | null> {
    const setClauses: string[] = ['status = $1'];
    const params: unknown[] = [status];

    if (status === 'running') {
      setClauses.push('started_at = now()');
    } else if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      setClauses.push('completed_at = now()');
    }

    params.push(id);
    const idx = params.length;
    const sql = `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`;
    const result = await this.pool.query(sql, params);
    return result.rows[0] ? rowToTask(result.rows[0]) : null;
  }

  async updateOutput(id: string, output: string): Promise<Task | null> {
    const result = await this.pool.query(
      'UPDATE tasks SET output = $1 WHERE id = $2 RETURNING *',
      [output, id],
    );
    return result.rows[0] ? rowToTask(result.rows[0]) : null;
  }

  async markFailed(id: string, error: string): Promise<Task | null> {
    const result = await this.pool.query(
      `UPDATE tasks SET status = 'failed', error = $1, completed_at = now()
       WHERE id = $2 RETURNING *`,
      [error, id],
    );
    return result.rows[0] ? rowToTask(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM tasks WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async listAll(page = 1, limit = 20, tenantId?: string, status?: string): Promise<{ items: Task[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (tenantId) {
      conditions.push(`tenant_id = $${idx++}`);
      params.push(tenantId);
    }
    if (status) {
      conditions.push(`status = $${idx++}`);
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await this.pool.query(`SELECT COUNT(*) as cnt FROM tasks ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].cnt, 10);

    const offset = (page - 1) * limit;
    params.push(limit, offset);
    const dataResult = await this.pool.query(
      `SELECT * FROM tasks ${whereClause} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      params,
    );
    return { items: dataResult.rows.map(rowToTask), total };
  }
}
