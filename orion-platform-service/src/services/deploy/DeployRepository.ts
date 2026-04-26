/**
 * DeployRepository - Database layer for Deploy operations
 * 
 * Handles PostgreSQL operations for deployments and deployment events
 */

import { DatabasePool } from '../database';

export interface Deployment {
  id: string;
  tenant_id: string;
  project_id: string | null;
  pipeline_run_id: string | null;
  build_id: string | null;
  environment: string;
  status: string;
  strategy: string;
  config: Record<string, any>;
  deployed_by: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  duration_ms: number | null;
  error_message: string | null;
  rollback_to: string | null;
  created_at: Date;
}

export interface DeploymentEvent {
  id: string;
  deployment_id: string;
  event_type: string;
  message: string | null;
  actor_id: string | null;
  created_at: Date;
}

export interface CreateDeploymentInput {
  tenant_id: string;
  project_id?: string;
  pipeline_run_id?: string;
  build_id?: string;
  environment: string;
  strategy?: string;
  config?: Record<string, any>;
  deployed_by?: string;
}

export interface UpdateDeploymentInput {
  status?: string;
  config?: Record<string, any>;
  error_message?: string;
  rollback_to?: string;
}

export interface CreateDeploymentEventInput {
  deployment_id: string;
  event_type: string;
  message?: string;
  actor_id?: string;
}

interface FindAllOptions {
  tenantId?: string;
  projectId?: string;
  environment?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export class DeployRepository {
  private pool: DatabasePool;

  constructor(pool: DatabasePool) {
    this.pool = pool;
  }

  // ==================== Deployments ====================

  /**
   * Find deployment by ID
   */
  async findById(id: string): Promise<Deployment | null> {
    const result = await this.pool.query(
      'SELECT * FROM deployments WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find all deployments with filtering
   */
  async findAll(options?: FindAllOptions): Promise<Deployment[]> {
    let query = 'SELECT * FROM deployments';
    const params: any[] = [];
    const conditions: string[] = [];

    if (options?.tenantId) {
      params.push(options.tenantId);
      conditions.push(`tenant_id = $${params.length}`);
    }

    if (options?.projectId) {
      params.push(options.projectId);
      conditions.push(`project_id = $${params.length}`);
    }

    if (options?.environment) {
      params.push(options.environment);
      conditions.push(`environment = $${params.length}`);
    }

    if (options?.status) {
      params.push(options.status);
      conditions.push(`status = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    if (options?.limit) {
      params.push(options.limit);
      query += ` LIMIT $${params.length}`;
    }

    if (options?.offset) {
      params.push(options.offset);
      query += ` OFFSET $${params.length}`;
    }

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * Count deployments
   */
  async count(options?: { tenantId?: string; environment?: string; status?: string }): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM deployments';
    const params: any[] = [];
    const conditions: string[] = [];

    if (options?.tenantId) {
      params.push(options.tenantId);
      conditions.push(`tenant_id = $1`);
    }

    if (options?.environment) {
      params.push(options.environment);
      conditions.push(`environment = $${params.length}`);
    }

    if (options?.status) {
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
   * Create a new deployment
   */
  async create(input: CreateDeploymentInput): Promise<Deployment> {
    const { tenant_id, project_id, pipeline_run_id, build_id, environment, strategy, config, deployed_by } = input;
    
    const result = await this.pool.query(
      `INSERT INTO deployments (tenant_id, project_id, pipeline_run_id, build_id, environment, strategy, config, deployed_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
       RETURNING *`,
      [tenant_id, project_id || null, pipeline_run_id || null, build_id || null, environment, strategy || 'rolling', config || {}, deployed_by || null]
    );
    
    return result.rows[0];
  }

  /**
   * Update deployment
   */
  async update(id: string, input: UpdateDeploymentInput): Promise<Deployment | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.status !== undefined) {
      params.push(input.status);
      updates.push(`status = $${paramIndex++}`);
    }

    if (input.config !== undefined) {
      params.push(JSON.stringify(input.config));
      updates.push(`config = $${paramIndex++}`);
    }

    if (input.error_message !== undefined) {
      params.push(input.error_message);
      updates.push(`error_message = $${paramIndex++}`);
    }

    if (input.rollback_to !== undefined) {
      params.push(input.rollback_to);
      updates.push(`rollback_to = $${paramIndex++}`);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    params.push(id);
    
    const result = await this.pool.query(
      `UPDATE deployments SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    return result.rows[0] || null;
  }

  /**
   * Start deployment (set status to deploying)
   */
  async startDeployment(id: string): Promise<Deployment | null> {
    const result = await this.pool.query(
      `UPDATE deployments SET status = 'deploying', started_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Complete deployment (success or failure)
   */
  async completeDeployment(id: string, status: string, errorMessage?: string): Promise<Deployment | null> {
    const result = await this.pool.query(
      `UPDATE deployments SET 
         status = $1, 
         completed_at = NOW(), 
         duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at))::BIGINT * 1000,
         error_message = $2
       WHERE id = $3 
       RETURNING *`,
      [status, errorMessage || null, id]
    );
    return result.rows[0] || null;
  }

  /**
   * Get latest deployment by environment
   */
  async findLatestByEnvironment(tenantId: string, environment: string): Promise<Deployment | null> {
    const result = await this.pool.query(
      `SELECT * FROM deployments 
       WHERE tenant_id = $1 AND environment = $2 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [tenantId, environment]
    );
    return result.rows[0] || null;
  }

  /**
   * Get deployments by build
   */
  async findByBuild(buildId: string): Promise<Deployment[]> {
    const result = await this.pool.query(
      'SELECT * FROM deployments WHERE build_id = $1 ORDER BY created_at DESC',
      [buildId]
    );
    return result.rows;
  }

  /**
   * Get rollback target (previous successful deployment)
   */
  async findRollbackTarget(tenantId: string, environment: string, currentId: string): Promise<Deployment | null> {
    const result = await this.pool.query(
      `SELECT * FROM deployments 
       WHERE tenant_id = $1 AND environment = $2 AND status = 'success' AND id != $3
       ORDER BY created_at DESC 
       LIMIT 1`,
      [tenantId, environment, currentId]
    );
    return result.rows[0] || null;
  }

  // ==================== Deployment Events ====================

  /**
   * Find events by deployment
   */
  async findEvents(deploymentId: string): Promise<DeploymentEvent[]> {
    const result = await this.pool.query(
      'SELECT * FROM deployment_events WHERE deployment_id = $1 ORDER BY created_at ASC',
      [deploymentId]
    );
    return result.rows;
  }

  /**
   * Create deployment event
   */
  async createEvent(input: CreateDeploymentEventInput): Promise<DeploymentEvent> {
    const { deployment_id, event_type, message, actor_id } = input;
    
    const result = await this.pool.query(
      `INSERT INTO deployment_events (deployment_id, event_type, message, actor_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [deployment_id, event_type, message || null, actor_id || null]
    );
    
    return result.rows[0];
  }

  // ==================== Stats ====================

  /**
   * Get deployment statistics
   */
  async getDeployStats(tenantId?: string): Promise<{
    total: number;
    success: number;
    failed: number;
    deploying: number;
    avgDuration: number;
  }> {
    let query = `SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'deploying' THEN 1 ELSE 0 END) as deploying,
      AVG(duration_ms) as avg_duration
     FROM deployments`;
    const params: any[] = [];

    if (tenantId) {
      params.push(tenantId);
      query += ' WHERE tenant_id = $1';
    }

    const result = await this.pool.query(query, params);
    const row = result.rows[0];

    return {
      total: parseInt(row.total || '0', 10),
      success: parseInt(row.success || '0', 10),
      failed: parseInt(row.failed || '0', 10),
      deploying: parseInt(row.deploying || '0', 10),
      avgDuration: parseFloat(row.avg_duration || '0'),
    };
  }

  /**
   * Get deployments by environment
   */
  async getEnvironments(tenantId: string): Promise<string[]> {
    const result = await this.pool.query(
      'SELECT DISTINCT environment FROM deployments WHERE tenant_id = $1 ORDER BY environment',
      [tenantId]
    );
    return result.rows.map(row => row.environment);
  }
}