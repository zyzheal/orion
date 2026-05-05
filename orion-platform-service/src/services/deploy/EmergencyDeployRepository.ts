/**
 * EmergencyDeployRepository - Database layer for Emergency Deploy operations
 *
 * Handles PostgreSQL operations for deploy_emergencies table
 */

import { DatabasePool } from '../database';

export interface DeployEmergency {
  id: string;
  tenant_id: string;
  deployment_id: string;
  reason: string;
  requested_by: string;
  approved_by: string | null;
  approved_at: Date | null;
  started_at: Date;
  completed_at: Date | null;
  status: string;
  post_mortem: string | null;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface CreateEmergencyDeployInput {
  tenant_id: string;
  deployment_id: string;
  reason: string;
  requested_by: string;
}

export class EmergencyDeployRepository {
  private pool: DatabasePool;

  constructor(pool: DatabasePool) {
    this.pool = pool;
  }

  /**
   * Find emergency deploy by ID
   */
  async findById(id: string): Promise<DeployEmergency | null> {
    const result = await this.pool.query(
      'SELECT * FROM deploy_emergencies WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find all emergency deploys with filtering
   */
  async findAll(options: {
    tenantId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<DeployEmergency[]> {
    let query = 'SELECT * FROM deploy_emergencies';
    const params: any[] = [];
    const conditions: string[] = [];

    if (options.tenantId) {
      params.push(options.tenantId);
      conditions.push(`tenant_id = $${params.length}`);
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
   * Count emergency deploys
   */
  async count(options: { tenantId?: string; status?: string } = {}): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM deploy_emergencies';
    const params: any[] = [];
    const conditions: string[] = [];

    if (options.tenantId) {
      params.push(options.tenantId);
      conditions.push(`tenant_id = $${params.length}`);
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
   * Create a new emergency deploy request
   */
  async create(input: CreateEmergencyDeployInput): Promise<DeployEmergency> {
    const { tenant_id, deployment_id, reason, requested_by } = input;

    const result = await this.pool.query(
      `INSERT INTO deploy_emergencies (tenant_id, deployment_id, reason, requested_by, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [tenant_id, deployment_id, reason, requested_by]
    );

    return result.rows[0];
  }

  /**
   * Approve emergency deploy
   */
  async approve(id: string, approvedBy: string): Promise<DeployEmergency | null> {
    const result = await this.pool.query(
      `UPDATE deploy_emergencies
       SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [approvedBy, id]
    );
    return result.rows[0] || null;
  }

  /**
   * Reject emergency deploy
   */
  async reject(id: string): Promise<DeployEmergency | null> {
    const result = await this.pool.query(
      `UPDATE deploy_emergencies
       SET status = 'rejected', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Complete emergency deploy
   */
  async complete(id: string, postMortem?: string): Promise<DeployEmergency | null> {
    const result = await this.pool.query(
      `UPDATE deploy_emergencies
       SET status = 'completed', completed_at = NOW(), post_mortem = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [postMortem || null, id]
    );
    return result.rows[0] || null;
  }

  /**
   * Fail emergency deploy
   */
  async fail(id: string): Promise<DeployEmergency | null> {
    const result = await this.pool.query(
      `UPDATE deploy_emergencies
       SET status = 'failed', completed_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }
}
