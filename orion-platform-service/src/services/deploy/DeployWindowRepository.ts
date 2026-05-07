import { DatabasePool } from '../database';
/**
 * DeployWindowRepository - Database layer for Deploy Window operations
 *
 * Handles PostgreSQL operations for deploy_windows table
 */


export interface DeployWindow {
  id: string;
  tenant_id: string;
  environment_id: string;
  name: string;
  cron_expression: string;
  duration_minutes: number;
  timezone: string;
  status: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateDeployWindowInput {
  tenant_id: string;
  environment_id: string;
  name: string;
  cron_expression: string;
  duration_minutes?: number;
  timezone?: string;
  created_by: string;
}

export interface UpdateDeployWindowInput {
  name?: string;
  cron_expression?: string;
  duration_minutes?: number;
  timezone?: string;
  status?: string;
}

interface FindAllWindowsOptions {
  tenantId?: string;
  environmentId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export class DeployWindowRepository {
  constructor(private pool: DatabasePool) {}


  /**
   * Find deploy window by ID
   */
  async findById(id: string): Promise<DeployWindow | null> {
    const result = await this.pool.query(
      'SELECT * FROM deploy_windows WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find all deploy windows with filtering
   */
  async findAll(options: FindAllWindowsOptions = {}): Promise<DeployWindow[]> {
    let query = 'SELECT * FROM deploy_windows';
    const params: any[] = [];
    const conditions: string[] = [];

    if (options.tenantId) {
      params.push(options.tenantId);
      conditions.push(`tenant_id = $${params.length}`);
    }

    if (options.environmentId) {
      params.push(options.environmentId);
      conditions.push(`environment_id = $${params.length}`);
    }

    if (options.status) {
      params.push(options.status);
      conditions.push(`status = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    if (options.limit) {
      params.push(options.limit);
      query += ` LIMIT $${params.length}`;
    }

    if (options.offset) {
      params.push(options.offset);
      query += ` OFFSET $${params.length}`;
    }

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * Count deploy windows
   */
  async count(options: { tenantId?: string; environmentId?: string; status?: string } = {}): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM deploy_windows';
    const params: any[] = [];
    const conditions: string[] = [];

    if (options.tenantId) {
      params.push(options.tenantId);
      conditions.push(`tenant_id = $${params.length}`);
    }

    if (options.environmentId) {
      params.push(options.environmentId);
      conditions.push(`environment_id = $${params.length}`);
    }

    if (options.status) {
      params.push(options.status);
      conditions.push(`status = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const result = await this.pool.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Create a new deploy window
   */
  async create(input: CreateDeployWindowInput): Promise<DeployWindow> {
    const { tenant_id, environment_id, name, cron_expression, duration_minutes, timezone, created_by } = input;

    const result = await this.pool.query(
      `INSERT INTO deploy_windows (tenant_id, environment_id, name, cron_expression, duration_minutes, timezone, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
       RETURNING *`,
      [tenant_id, environment_id, name, cron_expression, duration_minutes || 60, timezone || 'Asia/Shanghai', created_by]
    );

    return result.rows[0];
  }

  /**
   * Update deploy window
   */
  async update(id: string, input: UpdateDeployWindowInput): Promise<DeployWindow | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      params.push(input.name);
      updates.push(`name = $${paramIndex++}`);
    }

    if (input.cron_expression !== undefined) {
      params.push(input.cron_expression);
      updates.push(`cron_expression = $${paramIndex++}`);
    }

    if (input.duration_minutes !== undefined) {
      params.push(input.duration_minutes);
      updates.push(`duration_minutes = $${paramIndex++}`);
    }

    if (input.timezone !== undefined) {
      params.push(input.timezone);
      updates.push(`timezone = $${paramIndex++}`);
    }

    if (input.status !== undefined) {
      params.push(input.status);
      updates.push(`status = $${paramIndex++}`);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    params.push(id);
    updates.push(`updated_at = NOW()`);

    const result = await this.pool.query(
      `UPDATE deploy_windows SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    return result.rows[0] || null;
  }

  /**
   * Delete deploy window (soft delete by setting status to 'deleted')
   */
  async softDelete(id: string): Promise<DeployWindow | null> {
    const result = await this.pool.query(
      `UPDATE deploy_windows SET status = 'deleted', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Get active deploy windows for a tenant and environment
   */
  async getActiveWindows(tenantId: string, environmentId: string): Promise<DeployWindow[]> {
    const result = await this.pool.query(
      `SELECT * FROM deploy_windows
       WHERE tenant_id = $1 AND environment_id = $2 AND status = 'active'
       ORDER BY created_at DESC`,
      [tenantId, environmentId]
    );
    return result.rows;
  }
}
