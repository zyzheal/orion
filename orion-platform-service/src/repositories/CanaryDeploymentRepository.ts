/**
 * CanaryDeploymentRepository - Database layer for Canary Deployment operations
 *
 * Provides CRUD + lifecycle management for gradual (canary) config rollouts.
 * Supports multi-tenant isolation via tenant_id.
 */

import { BaseRepository } from '../../db/base-repository';
import { OrionError, ErrorCode } from '../../errors';
import { CanaryDeployment, CanaryDeploymentHistory, CreateCanaryDeploymentInput, CanaryDeploymentStatus } from '../../services/config-mgmt/types';

export interface CanaryDeploymentEntity {
  id: string;
  tenant_id: string;
  config_id: string;
  config_key: string;
  environment: string;
  percentage: number;
  status: string;
  old_value?: Record<string, any>;
  canary_value: Record<string, any>;
  target_value: Record<string, any>;
  promoted_at?: Date;
  rolled_back_at?: Date;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface CanaryDeploymentHistoryEntity {
  id: string;
  deployment_id: string;
  tenant_id: string;
  old_percentage: number;
  new_percentage: number;
  action: string;
  performed_by: string;
  created_at: Date;
}

export class CanaryDeploymentRepository extends BaseRepository<CanaryDeploymentEntity> {
  constructor(db: { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'canary_deployments');
  }

  /**
   * Create a new canary deployment.
   */
  async create(tenantId: string, input: CreateCanaryDeploymentInput): Promise<CanaryDeploymentEntity> {
    const id = `canary-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.db.query(
      `INSERT INTO canary_deployments (id, tenant_id, config_id, config_key, environment, percentage, status, canary_value, target_value, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, $9, NOW(), NOW())
       RETURNING *`,
      [
        id,
        tenantId,
        input.configId,
        input.configKey,
        input.environment,
        Math.min(100, Math.max(0, input.percentage)),
        JSON.stringify(input.canaryValue),
        JSON.stringify(input.targetValue),
        input.createdBy,
      ]
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find deployment by ID (tenant-scoped).
   */
  async findById(id: string, tenantId: string): Promise<CanaryDeploymentEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM canary_deployments WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * List deployments for a tenant with optional status filter.
   */
  async findByTenant(tenantId: string, status?: CanaryDeploymentStatus): Promise<CanaryDeploymentEntity[]> {
    let query = `SELECT * FROM canary_deployments WHERE tenant_id = $1`;
    const params: any[] = [tenantId];

    if (status) {
      query += ` AND status = $2`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Update deployment fields.
   */
  async update(id: string, tenantId: string, data: Partial<CanaryDeploymentEntity>): Promise<CanaryDeploymentEntity> {
    const allowedFields = ['status', 'percentage', 'canary_value', 'target_value', 'promoted_at', 'rolled_back_at'];
    const setClause: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(data)) {
      if (allowedFields.includes(key)) {
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        if (key === 'canaryValue' || key === 'canary_value') {
          setClause.push(`canary_value = $${paramIndex}`);
          values.push(JSON.stringify(value));
        } else if (key === 'targetValue' || key === 'target_value') {
          setClause.push(`target_value = $${paramIndex}`);
          values.push(JSON.stringify(value));
        } else if (key === 'promotedAt' || key === 'promoted_at') {
          setClause.push(`promoted_at = $${paramIndex}`);
          values.push(value);
        } else if (key === 'rolledBackAt' || key === 'rolled_back_at') {
          setClause.push(`rolled_back_at = $${paramIndex}`);
          values.push(value);
        } else if (key === 'canaryValue' || key === 'targetValue') {
          setClause.push(`${snakeKey} = $${paramIndex}`);
          values.push(JSON.stringify(value));
        } else {
          setClause.push(`${snakeKey} = $${paramIndex}`);
          values.push(value);
        }
        paramIndex++;
      }
    }

    if (setClause.length === 1) {
      return this.findById(id, tenantId) as Promise<CanaryDeploymentEntity>;
    }

    values.push(id, tenantId);
    const query = `UPDATE canary_deployments SET ${setClause.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError(`Canary deployment ${id} not found`, ErrorCode.NOT_FOUND);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Update canary percentage with history record.
   */
  async updatePercentage(tenantId: string, deploymentId: string, newPercentage: number, performedBy: string): Promise<CanaryDeploymentEntity> {
    const deployment = await this.findById(deploymentId, tenantId);
    if (!deployment) {
      throw new OrionError(`Canary deployment ${deploymentId} not found`, ErrorCode.NOT_FOUND);
    }

    const clampedPercentage = Math.min(100, Math.max(0, newPercentage));
    const oldPercentage = deployment.percentage;

    // Create history record
    const historyId = `canary-hist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await this.db.query(
      `INSERT INTO canary_deployment_history (id, deployment_id, tenant_id, old_percentage, new_percentage, action, performed_by, created_at)
       VALUES ($1, $2, $3, $4, $5, 'percentage_update', $6, NOW())`,
      [historyId, deploymentId, tenantId, oldPercentage, clampedPercentage, performedBy]
    );

    return this.update(deploymentId, tenantId, { percentage: clampedPercentage });
  }

  /**
   * Promote canary deployment to full rollout.
   */
  async promote(tenantId: string, deploymentId: string, performedBy: string): Promise<CanaryDeploymentEntity> {
    const deployment = await this.findById(deploymentId, tenantId);
    if (!deployment) {
      throw new OrionError(`Canary deployment ${deploymentId} not found`, ErrorCode.NOT_FOUND);
    }

    // Create history record
    const historyId = `canary-hist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await this.db.query(
      `INSERT INTO canary_deployment_history (id, deployment_id, tenant_id, old_percentage, new_percentage, action, performed_by, created_at)
       VALUES ($1, $2, $3, $4, $5, 'promote', $6, NOW())`,
      [historyId, deploymentId, tenantId, deployment.percentage, 100, performedBy]
    );

    return this.update(deploymentId, tenantId, {
      status: 'promoted',
      percentage: 100,
      promotedAt: new Date(),
    });
  }

  /**
   * Rollback canary deployment.
   */
  async rollback(tenantId: string, deploymentId: string, performedBy: string): Promise<CanaryDeploymentEntity> {
    const deployment = await this.findById(deploymentId, tenantId);
    if (!deployment) {
      throw new OrionError(`Canary deployment ${deploymentId} not found`, ErrorCode.NOT_FOUND);
    }

    // Create history record
    const historyId = `canary-hist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await this.db.query(
      `INSERT INTO canary_deployment_history (id, deployment_id, tenant_id, old_percentage, new_percentage, action, performed_by, created_at)
       VALUES ($1, $2, $3, $4, $5, 'rollback', $6, NOW())`,
      [historyId, deploymentId, tenantId, deployment.percentage, 0, performedBy]
    );

    return this.update(deploymentId, tenantId, {
      status: 'rolled_back',
      percentage: 0,
      rolledBackAt: new Date(),
    });
  }

  /**
   * Create history record for a deployment.
   */
  async createHistory(tenantId: string, deploymentId: string, oldPercentage: number, newPercentage: number, action: string, performedBy: string): Promise<CanaryDeploymentHistoryEntity> {
    const id = `canary-hist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.db.query(
      `INSERT INTO canary_deployment_history (id, deployment_id, tenant_id, old_percentage, new_percentage, action, performed_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [id, deploymentId, tenantId, oldPercentage, newPercentage, action, performedBy]
    );
    return this.mapRowToHistoryEntity(result.rows[0]);
  }

  // ---- Helpers ----

  protected mapRowToEntity(row: any): CanaryDeploymentEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      configId: row.config_id,
      configKey: row.config_key,
      environment: row.environment,
      percentage: row.percentage,
      status: row.status,
      oldValue: typeof row.old_value === 'string' ? JSON.parse(row.old_value) : row.old_value,
      canaryValue: typeof row.canary_value === 'string' ? JSON.parse(row.canary_value) : (row.canary_value ?? {}),
      targetValue: typeof row.target_value === 'string' ? JSON.parse(row.target_value) : (row.target_value ?? {}),
      promotedAt: row.promoted_at,
      rolledBackAt: row.rolled_back_at,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  protected mapRowToHistoryEntity(row: any): CanaryDeploymentHistoryEntity {
    return {
      id: row.id,
      deploymentId: row.deployment_id,
      tenant_id: row.tenant_id,
      oldPercentage: row.old_percentage,
      newPercentage: row.new_percentage,
      action: row.action,
      performedBy: row.performed_by,
      createdAt: row.created_at,
    };
  }
}
