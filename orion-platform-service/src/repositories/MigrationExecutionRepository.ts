/**
 * MigrationExecutionRepository - PostgreSQL persistence for migration executions
 *
 * Task 4.39: Migrate MigrationService from in-memory Map to PostgreSQL
 */

import { BaseRepository, FindAllResult } from '../db/base-repository';

export interface MigrationExecutionEntity {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: string;
  current_step_index: number;
  started_at: Date | null;
  paused_at: Date | null;
  completed_at: Date | null;
  rolled_back_at: Date | null;
  executed_by: string;
  error: string | null;
  total_steps: number;
  completed_steps: number;
  failed_steps: number;
  data_synced: number;
  data_verified: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateMigrationExecutionInput {
  id: string;
  tenantId: string;
  planId: string;
  executedBy: string;
  totalSteps: number;
}

export class MigrationExecutionRepository extends BaseRepository<MigrationExecutionEntity> {
  constructor(db: { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'migration_executions');
  }

  async create(input: CreateMigrationExecutionInput): Promise<MigrationExecutionEntity> {
    const result = await this.db.query(
      `INSERT INTO migration_executions (id, tenant_id, plan_id, status, current_step_index, executed_by, total_steps, started_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), NOW())
       RETURNING *`,
      [
        input.id,
        input.tenantId,
        input.planId,
        'running',
        0,
        input.executedBy,
        input.totalSteps,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByPlanId(planId: string): Promise<MigrationExecutionEntity[]> {
    const tenantId = this.getTenantId();
    const result = await this.db.query(
      `SELECT * FROM migration_executions WHERE tenant_id = $1 AND plan_id = $2 ORDER BY created_at DESC`,
      [tenantId, planId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateStatus(id: string, status: string, extraFields?: { error?: string; currentStepIndex?: number }): Promise<MigrationExecutionEntity | null> {
    const tenantId = this.getTenantId();
    const setClauses = ['status = $1', 'updated_at = NOW()'];
    const params: any[] = [status, id, tenantId];
    let paramIndex = 4;

    if (extraFields?.error !== undefined) {
      setClauses.push(`error = $${paramIndex++}`);
      params.push(extraFields.error);
    }
    if (extraFields?.currentStepIndex !== undefined) {
      setClauses.push(`current_step_index = $${paramIndex++}`);
      params.push(extraFields.currentStepIndex);
    }

    const result = await this.db.query(
      `UPDATE migration_executions SET ${setClauses.join(', ')} WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      params,
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateMetrics(
    id: string,
    metrics: {
      completedSteps?: number;
      failedSteps?: number;
      dataSynced?: number;
      dataVerified?: number;
    },
  ): Promise<MigrationExecutionEntity | null> {
    const tenantId = this.getTenantId();
    const setClauses = ['updated_at = NOW()'];
    const params: any[] = [id, tenantId];
    let paramIndex = 3;

    if (metrics.completedSteps !== undefined) {
      setClauses.push(`completed_steps = $${paramIndex++}`);
      params.push(metrics.completedSteps);
    }
    if (metrics.failedSteps !== undefined) {
      setClauses.push(`failed_steps = $${paramIndex++}`);
      params.push(metrics.failedSteps);
    }
    if (metrics.dataSynced !== undefined) {
      setClauses.push(`data_synced = $${paramIndex++}`);
      params.push(metrics.dataSynced);
    }
    if (metrics.dataVerified !== undefined) {
      setClauses.push(`data_verified = $${paramIndex++}`);
      params.push(metrics.dataVerified);
    }

    const result = await this.db.query(
      `UPDATE migration_executions SET ${setClauses.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      params,
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): MigrationExecutionEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      plan_id: row.plan_id,
      status: row.status,
      current_step_index: row.current_step_index,
      started_at: row.started_at,
      paused_at: row.paused_at,
      completed_at: row.completed_at,
      rolled_back_at: row.rolled_back_at,
      executed_by: row.executed_by,
      error: row.error,
      total_steps: row.total_steps,
      completed_steps: row.completed_steps,
      failed_steps: row.failed_steps,
      data_synced: row.data_synced,
      data_verified: row.data_verified,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
