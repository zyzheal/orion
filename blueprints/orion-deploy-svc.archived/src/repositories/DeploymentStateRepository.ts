/**
 * Deployment State Repository
 * Persists deployment execution state to PostgreSQL
 */

import { Pool } from 'pg';

type DbClient = Pool | { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

export interface DeploymentStateEntity {
  id: string;
  tenantId: string;
  projectId: string | null;
  environmentId: string | null;
  namespace: string;
  deploymentName: string;
  status: string;
  strategy: string | null;
  imageTag: string | null;
  commitSha: string | null;
  branch: string | null;
  deployedBy: string | null;
  rolloutHistory: Record<string, unknown>[];
  metadata: Record<string, unknown>;
  errorMessage: string | null;
  rollbackTargetId: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeploymentStateQuery {
  tenantId?: string;
  projectId?: string;
  environmentId?: string;
  namespace?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface FindAllResult {
  entities: DeploymentStateEntity[];
  total: number;
}

export class DeploymentStateRepository {
  private pool: DbClient;

  constructor(pool: DbClient) {
    this.pool = pool;
  }

  /**
   * Create a new deployment state record
   */
  async create(input: Partial<DeploymentStateEntity>): Promise<DeploymentStateEntity> {
    const query = `
      INSERT INTO deployment_state (
        id, tenant_id, project_id, environment_id, namespace, deployment_name,
        status, strategy, image_tag, commit_sha, branch, deployed_by,
        rollout_history, metadata, error_message, rollback_target_id,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `;

    const now = new Date();
    const params = [
      input.id,
      input.tenantId,
      input.projectId || null,
      input.environmentId || null,
      input.namespace || 'default',
      input.deploymentName || '',
      input.status || 'pending',
      input.strategy || null,
      input.imageTag || null,
      input.commitSha || null,
      input.branch || null,
      input.deployedBy || null,
      JSON.stringify(input.rolloutHistory || []),
      JSON.stringify(input.metadata || {}),
      input.errorMessage || null,
      input.rollbackTargetId || null,
      now,
      now,
    ];

    const result = await this.pool.query(query, params);
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find deployment state by ID
   */
  async findById(id: string): Promise<DeploymentStateEntity | null> {
    const query = `SELECT * FROM deployment_state WHERE id = $1`;
    const result = await this.pool.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find all deployment states with optional filters
   */
  async findAll(query: DeploymentStateQuery = {}): Promise<FindAllResult> {
    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (query.tenantId) {
      whereClause += ` AND tenant_id = $${paramIndex}`;
      params.push(query.tenantId);
      paramIndex++;
    }

    if (query.projectId) {
      whereClause += ` AND project_id = $${paramIndex}`;
      params.push(query.projectId);
      paramIndex++;
    }

    if (query.environmentId) {
      whereClause += ` AND environment_id = $${paramIndex}`;
      params.push(query.environmentId);
      paramIndex++;
    }

    if (query.namespace) {
      whereClause += ` AND namespace = $${paramIndex}`;
      params.push(query.namespace);
      paramIndex++;
    }

    if (query.status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(query.status);
      paramIndex++;
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM deployment_state ${whereClause}`;
    const countResult = await this.pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total, 10);

    // Get paginated results
    const limit = query.limit || 50;
    const offset = query.offset || 0;
    const dataQuery = `
      SELECT * FROM deployment_state
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const dataResult = await this.pool.query(dataQuery, params);

    return {
      entities: dataResult.rows.map((row) => this.mapRowToEntity(row)),
      total,
    };
  }

  /**
   * Update deployment status
   */
  async updateStatus(
    id: string,
    status: string,
    completedAt?: Date | null,
    errorMessage?: string | null
  ): Promise<void> {
    const updates: string[] = ['status = $2', 'updated_at = NOW()'];
    const params: unknown[] = [id, status];

    if (completedAt) {
      updates.push(`completed_at = $${params.length + 1}`);
      params.push(completedAt);
    }

    if (errorMessage !== undefined) {
      updates.push(`error_message = $${params.length + 1}`);
      params.push(errorMessage);
    }

    const query = `UPDATE deployment_state SET ${updates.join(', ')} WHERE id = $1`;
    await this.pool.query(query, params);
  }

  /**
   * Update full deployment state
   */
  async update(id: string, updates: Partial<DeploymentStateEntity>): Promise<void> {
    const setClauses: string[] = [];
    const params: unknown[] = [id];
    let paramIndex = 2;

    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex}`);
      params.push(updates.status);
      paramIndex++;
    }

    if (updates.namespace !== undefined) {
      setClauses.push(`namespace = $${paramIndex}`);
      params.push(updates.namespace);
      paramIndex++;
    }

    if (updates.deploymentName !== undefined) {
      setClauses.push(`deployment_name = $${paramIndex}`);
      params.push(updates.deploymentName);
      paramIndex++;
    }

    if (updates.strategy !== undefined) {
      setClauses.push(`strategy = $${paramIndex}`);
      params.push(updates.strategy);
      paramIndex++;
    }

    if (updates.rolloutHistory !== undefined) {
      setClauses.push(`rollout_history = $${paramIndex}`);
      params.push(JSON.stringify(updates.rolloutHistory));
      paramIndex++;
    }

    if (updates.metadata !== undefined) {
      setClauses.push(`metadata = $${paramIndex}`);
      params.push(JSON.stringify(updates.metadata));
      paramIndex++;
    }

    if (updates.errorMessage !== undefined) {
      setClauses.push(`error_message = $${paramIndex}`);
      params.push(updates.errorMessage);
      paramIndex++;
    }

    if (updates.completedAt !== undefined) {
      setClauses.push(`completed_at = $${paramIndex}`);
      params.push(updates.completedAt);
      paramIndex++;
    }

    setClauses.push(`updated_at = NOW()`);

    const query = `UPDATE deployment_state SET ${setClauses.join(', ')} WHERE id = $1`;
    await this.pool.query(query, params);
  }

  /**
   * Delete deployment state
   */
  async delete(id: string): Promise<void> {
    const query = `DELETE FROM deployment_state WHERE id = $1`;
    await this.pool.query(query, [id]);
  }

  /**
   * Map database row to entity
   */
  private mapRowToEntity(row: any): DeploymentStateEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      projectId: row.project_id,
      environmentId: row.environment_id,
      namespace: row.namespace,
      deploymentName: row.deployment_name,
      status: row.status,
      strategy: row.strategy,
      imageTag: row.image_tag,
      commitSha: row.commit_sha,
      branch: row.branch,
      deployedBy: row.deployed_by,
      rolloutHistory: row.rollout_history || [],
      metadata: row.metadata || {},
      errorMessage: row.error_message,
      rollbackTargetId: row.rollback_target_id,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}