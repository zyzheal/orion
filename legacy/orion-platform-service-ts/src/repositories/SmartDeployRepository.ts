/**
 * SmartDeployRepository - Database layer for SmartDeployService active deployment state
 *
 * Provides CRUD for runtime deployment state (activeDeployments).
 * Historical records continue to use DeploymentHistoryRepository.
 *
 * Task 2.16: Migrate SmartDeployService from in-memory Map to PostgreSQL
 */

import { BaseRepository } from '../db/base-repository';
import { OrionError, ErrorCode } from '../errors';

export interface SmartDeployEntity {
  id: string;
  tenantId: string;
  deploymentId: string;
  strategy: string;
  state: Record<string, any>;
  canaryConfig: Record<string, any> | null;
  metrics: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
}

export class SmartDeployRepository extends BaseRepository<SmartDeployEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'smart_deploy_records');
  }

  /**
   * Find smart deploy record by deployment_id.
   */
  async findByDeploymentId(deploymentId: string): Promise<SmartDeployEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM smart_deploy_records WHERE deployment_id = $1 LIMIT 1`,
      [deploymentId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * List all active (non-terminal) records for a tenant.
   * Terminal states: completed, failed, cancelled, rolledback
   */
  async listActive(tenantId: string): Promise<SmartDeployEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM smart_deploy_records WHERE tenant_id = $1 AND (state->>'status') NOT IN ('completed', 'failed', 'cancelled', 'rolledback') ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * List active records for a tenant filtered by a specific deployment status.
   * Used during crash recovery to restore running and pending deployments separately.
   */
  async listActiveByStatus(tenantId: string, status: string): Promise<SmartDeployEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM smart_deploy_records WHERE tenant_id = $1 AND (state->>'status') = $2 ORDER BY created_at DESC`,
      [tenantId, status],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Create a new smart deploy record.
   */
  async create(data: {
    id: string;
    tenantId: string;
    deploymentId: string;
    strategy: string;
    state: Record<string, any>;
    canaryConfig?: Record<string, any> | null;
    metrics?: Record<string, any> | null;
  }): Promise<SmartDeployEntity> {
    const result = await this.db.query(
      `INSERT INTO smart_deploy_records (id, tenant_id, deployment_id, strategy, state, canary_config, metrics, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *`,
      [
        data.id,
        data.tenantId,
        data.deploymentId,
        data.strategy,
        JSON.stringify(data.state),
        data.canaryConfig ? JSON.stringify(data.canaryConfig) : null,
        data.metrics ? JSON.stringify(data.metrics) : null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Update mutable fields on an existing record by deployment_id.
   */
  async update(deploymentId: string, data: {
    state?: Record<string, any>;
    canaryConfig?: Record<string, any> | null;
    metrics?: Record<string, any> | null;
  }): Promise<SmartDeployEntity> {
    const setClause: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.state !== undefined) {
      setClause.push(`state = $${paramIndex++}`);
      values.push(JSON.stringify(data.state));
    }
    if (data.canaryConfig !== undefined) {
      setClause.push(`canary_config = $${paramIndex++}`);
      values.push(data.canaryConfig ? JSON.stringify(data.canaryConfig) : null);
    }
    if (data.metrics !== undefined) {
      setClause.push(`metrics = $${paramIndex++}`);
      values.push(data.metrics ? JSON.stringify(data.metrics) : null);
    }

    values.push(deploymentId);
    const query = `UPDATE smart_deploy_records SET ${setClause.join(', ')} WHERE deployment_id = $${paramIndex} RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError(`SmartDeploy record for deployment '${deploymentId}' not found`, ErrorCode.NOT_FOUND);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Delete a record by deployment_id.
   */
  async delete(deploymentId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM smart_deploy_records WHERE deployment_id = $1`,
      [deploymentId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  protected mapRowToEntity(row: any): SmartDeployEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      deploymentId: row.deployment_id,
      strategy: row.strategy,
      state: typeof row.state === 'string' ? JSON.parse(row.state) : (row.state ?? {}),
      canaryConfig: row.canary_config
        ? typeof row.canary_config === 'string'
          ? JSON.parse(row.canary_config)
          : row.canary_config
        : null,
      metrics: row.metrics
        ? typeof row.metrics === 'string'
          ? JSON.parse(row.metrics)
          : row.metrics
        : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
