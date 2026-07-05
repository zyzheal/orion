/**
 * DataSourceRepository - 数据源数据访问层
 * PostgreSQL Repository pattern implementation
 */

import type { DataSource } from '../types/dba.js';
import type { IDbAdapter } from '../db/database.js';

function rowToDataSource(row: any): DataSource {
  return {
    id: row.id,
    name: row.name,
    host: row.host,
    port: Number(row.port),
    database: row.database,
    type: row.type,
    status: row.status,
    lastChecked: row.last_checked ? new Date(row.last_checked).toISOString() : undefined,
  };
}

export class DataSourceRepository {
  constructor(private pool: IDbAdapter) {}

  async create(input: {
    name: string;
    host: string;
    port: number;
    database: string;
    type: 'mysql' | 'postgresql' | 'mariadb';
    tenantId: string;
  }): Promise<DataSource> {
    const result = await this.pool.query(
      `INSERT INTO data_sources (id, name, host, port, database, type, status, tenant_id, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'active', $6, now(), now())
       RETURNING *`,
      [input.name, input.host, input.port, input.database, input.type, input.tenantId],
    );
    return rowToDataSource(result.rows[0]);
  }

  async findById(id: string): Promise<DataSource | null> {
    const result = await this.pool.query('SELECT * FROM data_sources WHERE id = $1', [id]);
    return result.rows[0] ? rowToDataSource(result.rows[0]) : null;
  }

  async findByTenant(tenantId: string): Promise<DataSource[]> {
    const result = await this.pool.query(
      'SELECT * FROM data_sources WHERE tenant_id = $1 ORDER BY name',
      [tenantId],
    );
    return result.rows.map(rowToDataSource);
  }

  async findAll(): Promise<DataSource[]> {
    const result = await this.pool.query('SELECT * FROM data_sources ORDER BY name');
    return result.rows.map(rowToDataSource);
  }

  async update(id: string, updates: Partial<DataSource>): Promise<DataSource | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${idx++}`);
      params.push(updates.name);
    }
    if (updates.host !== undefined) {
      setClauses.push(`host = $${idx++}`);
      params.push(updates.host);
    }
    if (updates.port !== undefined) {
      setClauses.push(`port = $${idx++}`);
      params.push(updates.port);
    }
    if (updates.database !== undefined) {
      setClauses.push(`database = $${idx++}`);
      params.push(updates.database);
    }
    if (updates.type !== undefined) {
      setClauses.push(`type = $${idx++}`);
      params.push(updates.type);
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${idx++}`);
      params.push(updates.status);
    }

    setClauses.push(`updated_at = now()`);
    params.push(id);

    const sql = `UPDATE data_sources SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`;
    const result = await this.pool.query(sql, params);
    return result.rows[0] ? rowToDataSource(result.rows[0]) : null;
  }

  async updateLastChecked(id: string, timestamp: Date): Promise<DataSource | null> {
    const result = await this.pool.query(
      'UPDATE data_sources SET last_checked = $1, updated_at = now() WHERE id = $2 RETURNING *',
      [timestamp, id],
    );
    return result.rows[0] ? rowToDataSource(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM data_sources WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
