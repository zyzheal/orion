/**
 * Runner Repository — 构建资源池 (GAP-CN-07)
 *
 * 数据访问层，负责 Runner 的 CRUD 和查询操作。
 */

import { Runner, RunnerCreateInput, RunnerUpdateInput, RunnerStatus } from '../models/Runner';

export interface RunnerRepository {
  create(input: RunnerCreateInput): Promise<Runner>;
  findById(id: string): Promise<Runner | undefined>;
  findByName(tenantId: string, name: string): Promise<Runner | undefined>;
  findByTenant(tenantId: string): Promise<Runner[]>;
  findByStatus(status: RunnerStatus): Promise<Runner[]>;
  findByLabels(tenantId: string, labels: string[]): Promise<Runner[]>;
  findAvailableForTenant(tenantId: string, status?: RunnerStatus[]): Promise<Runner[]>;
  update(id: string, input: RunnerUpdateInput): Promise<Runner | undefined>;
  updateHeartbeat(id: string): Promise<Runner | undefined>;
  decrementJobs(id: string): Promise<void>;
  delete(id: string): Promise<boolean>;
}

export class PostgresRunnerRepository implements RunnerRepository {
  constructor(private db: any) {}

  async create(input: RunnerCreateInput): Promise<Runner> {
    const query = `
      INSERT INTO runners (
        id, tenant_id, name, status, labels, max_concurrent, current_jobs,
        last_heartbeat, metadata, endpoint, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const now = new Date();
    const id = this.generateId();

    const result = await this.db.query(query, [
      id,
      input.tenantId,
      input.name,
      'online',
      JSON.stringify(input.labels || []),
      input.maxConcurrent,
      0,
      now,
      JSON.stringify(input.metadata || {}),
      input.endpoint || null,
      now,
    ]);

    return this.mapRow(result.rows[0]);
  }

  async findById(id: string): Promise<Runner | undefined> {
    const query = 'SELECT * FROM runners WHERE id = $1';
    const result = await this.db.query(query, [id]);
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : undefined;
  }

  async findByName(tenantId: string, name: string): Promise<Runner | undefined> {
    const query = 'SELECT * FROM runners WHERE tenant_id = $1 AND name = $2';
    const result = await this.db.query(query, [tenantId, name]);
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : undefined;
  }

  async findByTenant(tenantId: string): Promise<Runner[]> {
    const query = 'SELECT * FROM runners WHERE tenant_id = $1 ORDER BY created_at DESC';
    const result = await this.db.query(query, [tenantId]);
    return result.rows.map((row: any) => this.mapRow(row));
  }

  async findByStatus(status: RunnerStatus): Promise<Runner[]> {
    const query = 'SELECT * FROM runners WHERE status = $1 ORDER BY last_heartbeat DESC';
    const result = await this.db.query(query, [status]);
    return result.rows.map((row: any) => this.mapRow(row));
  }

  /**
   * Find runners that have ALL of the requested labels.
   * Uses PostgreSQL array containment operator @>
   */
  async findByLabels(tenantId: string, labels: string[]): Promise<Runner[]> {
    const query = `
      SELECT * FROM runners
      WHERE tenant_id = $1 AND labels @> $2
      ORDER BY last_heartbeat DESC
    `;
    const result = await this.db.query(query, [tenantId, JSON.stringify(labels)]);
    return result.rows.map((row: any) => this.mapRow(row));
  }

  /**
   * Find available runners for a tenant.
   * Available = status is 'online' (or specified statuses) AND current_jobs < max_concurrent
   */
  async findAvailableForTenant(tenantId: string, statuses?: RunnerStatus[]): Promise<Runner[]> {
    const statusList = statuses || ['online'];
    const query = `
      SELECT * FROM runners
      WHERE tenant_id = $1
        AND status = ANY($2)
        AND current_jobs < max_concurrent
      ORDER BY (max_concurrent - current_jobs) DESC, last_heartbeat DESC
    `;
    const result = await this.db.query(query, [tenantId, statusList]);
    return result.rows.map((row: any) => this.mapRow(row));
  }

  async update(id: string, input: RunnerUpdateInput): Promise<Runner | undefined> {
    const parts: string[] = [];
    const values: any[] = [];
    let idx = 2;

    if (input.status !== undefined) {
      parts.push(`status = $${idx}`);
      values.push(input.status);
      idx++;
    }
    if (input.labels !== undefined) {
      parts.push(`labels = $${idx}`);
      values.push(JSON.stringify(input.labels));
      idx++;
    }
    if (input.maxConcurrent !== undefined) {
      parts.push(`max_concurrent = $${idx}`);
      values.push(input.maxConcurrent);
      idx++;
    }
    if (input.metadata !== undefined) {
      parts.push(`metadata = $${idx}`);
      values.push(JSON.stringify(input.metadata));
      idx++;
    }
    if (input.endpoint !== undefined) {
      parts.push(`endpoint = $${idx}`);
      values.push(input.endpoint);
      idx++;
    }

    if (parts.length === 0) return this.findById(id);

    parts.push(`updated_at = NOW()`);
    values.unshift(id);

    const query = `UPDATE runners SET ${parts.join(', ')} WHERE id = $1 RETURNING *`;
    const result = await this.db.query(query, values);
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : undefined;
  }

  async updateHeartbeat(id: string): Promise<Runner | undefined> {
    const query = `
      UPDATE runners SET last_heartbeat = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await this.db.query(query, [id]);
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : undefined;
  }

  /**
   * Decrement current_jobs for a runner (minimum 0).
   * Also updates status to 'online' if jobs drop to 0.
   */
  async decrementJobs(id: string): Promise<void> {
    const query = `
      UPDATE runners SET
        current_jobs = GREATEST(current_jobs - 1, 0),
        status = CASE WHEN GREATEST(current_jobs - 1, 0) = 0 THEN 'online' ELSE status END,
        updated_at = NOW()
      WHERE id = $1
    `;
    await this.db.query(query, [id]);
  }

  async delete(id: string): Promise<boolean> {
    // First delete associated jobs
    await this.db.query('DELETE FROM runner_jobs WHERE runner_id = $1', [id]);

    const query = 'DELETE FROM runners WHERE id = $1';
    const result = await this.db.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  private mapRow(row: any): Runner {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      status: row.status as RunnerStatus,
      labels: Array.isArray(row.labels) ? row.labels : JSON.parse(row.labels || '[]'),
      maxConcurrent: row.max_concurrent,
      currentJobs: row.current_jobs,
      lastHeartbeat: new Date(row.last_heartbeat),
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {}),
      endpoint: row.endpoint,
      createdAt: new Date(row.created_at),
    };
  }

  private generateId(): string {
    // Use crypto.randomUUID if available, fallback to simple UUID
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return (crypto as any).randomUUID();
    }
    return `runner-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
