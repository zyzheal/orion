/**
 * ScriptRepository - 脚本管理数据访问层
 * PostgreSQL Repository pattern implementation
 */

import type { Script } from '../types/visor.js';
import type { IDbAdapter } from '../db/database.js';

function rowToScript(row: any): Script {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    description: row.description || undefined,
    content: row.content,
    type: row.type,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export class ScriptRepository {
  constructor(private pool: IDbAdapter) {}

  async create(tenantId: string, createdBy: string, input: {
    name: string;
    description?: string;
    content: string;
    type: 'shell' | 'python' | 'powershell';
  }): Promise<Script> {
    const result = await this.pool.query(
      `INSERT INTO scripts (id, tenant_id, name, description, content, type, created_by, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, now(), now())
       RETURNING *`,
      [tenantId, input.name, input.description || null, input.content, input.type, createdBy],
    );
    return rowToScript(result.rows[0]);
  }

  async findById(id: string): Promise<Script | null> {
    const result = await this.pool.query('SELECT * FROM scripts WHERE id = $1', [id]);
    return result.rows[0] ? rowToScript(result.rows[0]) : null;
  }

  async findByTenant(tenantId: string): Promise<Script[]> {
    const result = await this.pool.query(
      'SELECT * FROM scripts WHERE tenant_id = $1 ORDER BY name',
      [tenantId],
    );
    return result.rows.map(rowToScript);
  }

  async update(id: string, updates: Partial<{
    name: string;
    description: string;
    content: string;
    type: 'shell' | 'python' | 'powershell';
  }>): Promise<Script | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${idx++}`);
      params.push(updates.name);
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${idx++}`);
      params.push(updates.description);
    }
    if (updates.content !== undefined) {
      setClauses.push(`content = $${idx++}`);
      params.push(updates.content);
    }
    if (updates.type !== undefined) {
      setClauses.push(`type = $${idx++}`);
      params.push(updates.type);
    }

    setClauses.push(`updated_at = now()`);
    params.push(id);

    const sql = `UPDATE scripts SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`;
    const result = await this.pool.query(sql, params);
    return result.rows[0] ? rowToScript(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM scripts WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async listAll(page = 1, limit = 20, tenantId?: string): Promise<{ items: Script[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (tenantId) {
      conditions.push(`tenant_id = $${idx++}`);
      params.push(tenantId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await this.pool.query(`SELECT COUNT(*) as cnt FROM scripts ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].cnt, 10);

    const offset = (page - 1) * limit;
    params.push(limit, offset);
    const dataResult = await this.pool.query(
      `SELECT * FROM scripts ${whereClause} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      params,
    );
    return { items: dataResult.rows.map(rowToScript), total };
  }
}
