import { DatabasePool } from '../database';
/**
 * IncidentRepository - Database layer for Incident operations
 *
 * Handles PostgreSQL operations for incidents (MTTR calculation)
 */


export interface Incident {
  id: string;
  tenant_id: string;
  deployment_id: string | null;
  pipeline_run_id: string | null;
  commit_sha: string | null;
  type: string;
  severity: string;
  status: string;
  detected_at: Date;
  acknowledged_at: Date | null;
  resolved_at: Date | null;
  recovery_time_ms: number | null;
  service: string | null;
  environment: string | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateIncidentInput {
  tenant_id: string;
  deployment_id?: string;
  pipeline_run_id?: string;
  commit_sha?: string;
  type: string;
  severity: string;
  service?: string;
  environment?: string;
  error_message?: string;
}

export interface UpdateIncidentInput {
  status?: string;
  acknowledged_at?: Date;
  resolved_at?: Date;
  error_message?: string;
}

interface FindAllOptions {
  tenantId?: string;
  deploymentId?: string;
  pipelineRunId?: string;
  status?: string;
  severity?: string;
  since?: Date;
  limit?: number;
  offset?: number;
}

export class IncidentRepository {
  constructor(private pool: DatabasePool) {}


  /**
   * Find incident by ID
   */
  async findById(id: string): Promise<Incident | null> {
    const result = await this.pool.query(
      'SELECT * FROM incidents WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find all incidents with filtering
   */
  async findAll(options?: FindAllOptions): Promise<Incident[]> {
    let query = 'SELECT * FROM incidents';
    const params: any[] = [];
    const conditions: string[] = [];

    if (options?.tenantId) {
      params.push(options.tenantId);
      conditions.push(`tenant_id = $${params.length}`);
    }

    if (options?.deploymentId) {
      params.push(options.deploymentId);
      conditions.push(`deployment_id = $${params.length}`);
    }

    if (options?.pipelineRunId) {
      params.push(options.pipelineRunId);
      conditions.push(`pipeline_run_id = $${params.length}`);
    }

    if (options?.status) {
      params.push(options.status);
      conditions.push(`status = $${params.length}`);
    }

    if (options?.severity) {
      params.push(options.severity);
      conditions.push(`severity = $${params.length}`);
    }

    if (options?.since) {
      params.push(options.since);
      conditions.push(`detected_at >= $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY detected_at DESC';

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
   * Count incidents
   */
  async count(options?: { tenantId?: string; status?: string }): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM incidents';
    const params: any[] = [];
    const conditions: string[] = [];

    if (options?.tenantId) {
      params.push(options.tenantId);
      conditions.push(`tenant_id = $${params.length}`);
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
   * Create a new incident
   */
  async create(input: CreateIncidentInput): Promise<Incident> {
    const { tenant_id, deployment_id, pipeline_run_id, commit_sha, type, severity, service, environment, error_message } = input;

    const result = await this.pool.query(
      `INSERT INTO incidents (tenant_id, deployment_id, pipeline_run_id, commit_sha, type, severity, status, service, environment, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, $8, $9)
       RETURNING *`,
      [tenant_id, deployment_id || null, pipeline_run_id || null, commit_sha || null, type, severity, service || null, environment || null, error_message || null]
    );

    return result.rows[0];
  }

  /**
   * Update incident
   */
  async update(id: string, input: UpdateIncidentInput): Promise<Incident | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.status !== undefined) {
      params.push(input.status);
      updates.push(`status = $${paramIndex++}`);
    }

    if (input.acknowledged_at !== undefined) {
      params.push(input.acknowledged_at);
      updates.push(`acknowledged_at = $${paramIndex++}`);
    }

    if (input.resolved_at !== undefined) {
      params.push(input.resolved_at);
      updates.push(`resolved_at = $${paramIndex++}`);
      // Auto-calculate recovery_time_ms when resolved
      updates.push(`recovery_time_ms = EXTRACT(EPOCH FROM ($${paramIndex - 1} - detected_at))::BIGINT * 1000`);
    }

    if (input.error_message !== undefined) {
      params.push(input.error_message);
      updates.push(`error_message = $${paramIndex++}`);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    params.push(id);

    const result = await this.pool.query(
      `UPDATE incidents SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    return result.rows[0] || null;
  }

  /**
   * Acknowledge incident
   */
  async acknowledge(id: string): Promise<Incident | null> {
    const result = await this.pool.query(
      `UPDATE incidents SET status = 'acknowledged', acknowledged_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Resolve incident
   */
  async resolve(id: string): Promise<Incident | null> {
    const result = await this.pool.query(
      `UPDATE incidents SET
         status = 'resolved',
         resolved_at = NOW(),
         recovery_time_ms = EXTRACT(EPOCH FROM (NOW() - detected_at))::BIGINT * 1000
       WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Get MTTR statistics for a time window
   */
  async getMttrStats(tenantId?: string, since?: Date): Promise<{
    totalIncidents: number;
    resolvedIncidents: number;
    avgRecoveryTimeMs: number;
    medianRecoveryTimeMs: number;
    p90RecoveryTimeMs: number;
    p99RecoveryTimeMs: number;
  }> {
    let query = `SELECT
      COUNT(*) as total_incidents,
      SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_incidents,
      AVG(recovery_time_ms) as avg_recovery_time_ms,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY recovery_time_ms) as median_recovery_time_ms,
      PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY recovery_time_ms) as p90_recovery_time_ms,
      PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY recovery_time_ms) as p99_recovery_time_ms
    FROM incidents
    WHERE status = 'resolved' AND recovery_time_ms IS NOT NULL`;
    const params: any[] = [];

    if (tenantId) {
      params.push(tenantId);
      query += ` AND tenant_id = $${params.length}`;
    }

    if (since) {
      params.push(since);
      query += ` AND detected_at >= $${params.length}`;
    }

    const result = await this.pool.query(query, params);
    const row = result.rows[0];

    return {
      totalIncidents: parseInt(row.total_incidents || '0', 10),
      resolvedIncidents: parseInt(row.resolved_incidents || '0', 10),
      avgRecoveryTimeMs: parseFloat(row.avg_recovery_time_ms || '0'),
      medianRecoveryTimeMs: parseFloat(row.median_recovery_time_ms || '0'),
      p90RecoveryTimeMs: parseFloat(row.p90_recovery_time_ms || '0'),
      p99RecoveryTimeMs: parseFloat(row.p99_recovery_time_ms || '0'),
    };
  }

  /**
   * Find incidents by deployment
   */
  async findByDeployment(deploymentId: string): Promise<Incident[]> {
    return this.findAll({ deploymentId });
  }

  /**
   * Find incidents by pipeline run
   */
  async findByPipelineRun(pipelineRunId: string): Promise<Incident[]> {
    return this.findAll({ pipelineRunId });
  }
}