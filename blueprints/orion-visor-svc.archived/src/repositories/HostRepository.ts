/**
 * HostRepository - 主机管理数据访问层
 * PostgreSQL Repository pattern implementation
 */

import type { Host, CreateHostInput } from '../types/visor.js';
import type { IDbAdapter } from '../db/database.js';

function rowToHost(row: any): Host {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    ip: row.ip,
    port: Number(row.port),
    username: row.username,
    status: row.status,
    os: row.os || '',
    cpu: Number(row.cpu || 0),
    memory: Number(row.memory || 0),
    disk: Number(row.disk || 0),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export class HostRepository {
  constructor(private pool: IDbAdapter) {}

  async create(tenantId: string, input: CreateHostInput): Promise<Host> {
    const result = await this.pool.query(
      `INSERT INTO hosts (id, tenant_id, name, ip, port, username, status, os, cpu, memory, disk, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'offline', '', 0, 0, 0, now(), now())
       RETURNING *`,
      [tenantId, input.name, input.ip, input.port || 22, input.username],
    );
    return rowToHost(result.rows[0]);
  }

  async findById(id: string): Promise<Host | null> {
    const result = await this.pool.query('SELECT * FROM hosts WHERE id = $1', [id]);
    return result.rows[0] ? rowToHost(result.rows[0]) : null;
  }

  async findByTenant(tenantId: string): Promise<Host[]> {
    const result = await this.pool.query(
      'SELECT * FROM hosts WHERE tenant_id = $1 ORDER BY name',
      [tenantId],
    );
    return result.rows.map(rowToHost);
  }

  async update(id: string, updates: Partial<Host>): Promise<Host | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${idx++}`);
      params.push(updates.name);
    }
    if (updates.ip !== undefined) {
      setClauses.push(`ip = $${idx++}`);
      params.push(updates.ip);
    }
    if (updates.port !== undefined) {
      setClauses.push(`port = $${idx++}`);
      params.push(updates.port);
    }
    if (updates.username !== undefined) {
      setClauses.push(`username = $${idx++}`);
      params.push(updates.username);
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${idx++}`);
      params.push(updates.status);
    }
    if (updates.os !== undefined) {
      setClauses.push(`os = $${idx++}`);
      params.push(updates.os);
    }
    if (updates.cpu !== undefined) {
      setClauses.push(`cpu = $${idx++}`);
      params.push(updates.cpu);
    }
    if (updates.memory !== undefined) {
      setClauses.push(`memory = $${idx++}`);
      params.push(updates.memory);
    }
    if (updates.disk !== undefined) {
      setClauses.push(`disk = $${idx++}`);
      params.push(updates.disk);
    }

    setClauses.push(`updated_at = now()`);
    params.push(id);

    const sql = `UPDATE hosts SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`;
    const result = await this.pool.query(sql, params);
    return result.rows[0] ? rowToHost(result.rows[0]) : null;
  }

  async updateMetrics(id: string, metrics: { cpu: number; memory: number; disk: number; status: string }): Promise<Host | null> {
    const result = await this.pool.query(
      `UPDATE hosts SET cpu = $1, memory = $2, disk = $3, status = $4, updated_at = now()
       WHERE id = $5 RETURNING *`,
      [metrics.cpu, metrics.memory, metrics.disk, metrics.status, id],
    );
    return result.rows[0] ? rowToHost(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM hosts WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async listAll(page = 1, limit = 20, tenantId?: string): Promise<{ items: Host[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (tenantId) {
      conditions.push(`tenant_id = $${idx++}`);
      params.push(tenantId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await this.pool.query(`SELECT COUNT(*) as cnt FROM hosts ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].cnt, 10);

    const offset = (page - 1) * limit;
    params.push(limit, offset);
    const dataResult = await this.pool.query(
      `SELECT * FROM hosts ${whereClause} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      params,
    );
    return { items: dataResult.rows.map(rowToHost), total };
  }
}
