/**
 * RecoveryPlanRepository
 * Recovery plan and execution data access layer
 */

import { NotFoundError } from '../errors';
import { BaseRepository } from '../db/base-repository';

export interface RecoveryPlanEntity {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  rtoMs: number;
  rpoMs: number;
  steps: any[];
  lastTested: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecoveryExecutionEntity {
  id: string;
  planId: string;
  planName: string | null;
  status: string;
  targetTime: Date | null;
  backupId: string | null;
  stepExecutions: any[];
  initiatedAt: Date;
  completedAt: Date | null;
  rtoTargetMs: number;
  rpoTargetMs: number;
  actualRtoMs: number | null;
  actualRpoMs: number | null;
  rtoMet: boolean | null;
  rpoMet: boolean | null;
  errorMessage: string | null;
  createdAt: Date;
}

export class RecoveryPlanRepository extends BaseRepository<RecoveryPlanEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'recovery_plans');
  }

  async findEnabled(): Promise<RecoveryPlanEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM recovery_plans WHERE enabled = true ORDER BY created_at DESC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async markTested(id: string): Promise<RecoveryPlanEntity> {
    const result = await this.db.query(
      `UPDATE recovery_plans SET last_tested = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id],
    );
    if (result.rows.length === 0) {
      throw new NotFoundError('RecoveryPlan', id);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async toggleEnabled(id: string, enabled: boolean): Promise<RecoveryPlanEntity> {
    const result = await this.db.query(
      `UPDATE recovery_plans SET enabled = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, enabled],
    );
    if (result.rows.length === 0) {
      throw new NotFoundError('RecoveryPlan', id);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): RecoveryPlanEntity {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      enabled: row.enabled ?? true,
      rtoMs: row.rto_ms ?? 0,
      rpoMs: row.rpo_ms ?? 0,
      steps: row.steps ?? [],
      lastTested: row.last_tested,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export class RecoveryExecutionRepository extends BaseRepository<RecoveryExecutionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'recovery_executions');
  }

  async findByPlanId(planId: string): Promise<RecoveryExecutionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM recovery_executions WHERE plan_id = $1 ORDER BY initiated_at DESC`,
      [planId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateStatus(id: string, status: string, errorMessage?: string): Promise<RecoveryExecutionEntity> {
    const setFields = ['status = $2'];
    const params: any[] = [id, status];
    let paramIdx = 3;

    if (status === 'completed' || status === 'failed') {
      setFields.push('completed_at = NOW()');
    }
    if (errorMessage) {
      setFields.push(`error_message = $${paramIdx}`);
      params.push(errorMessage);
      paramIdx++;
    }

    const result = await this.db.query(
      `UPDATE recovery_executions SET ${setFields.join(', ')} WHERE id = $1 RETURNING *`,
      params,
    );
    if (result.rows.length === 0) {
      throw new NotFoundError('RecoveryExecution', id);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateRtoRpo(id: string, data: {
    actualRtoMs?: number;
    actualRpoMs?: number;
    rtoMet?: boolean;
    rpoMet?: boolean;
  }): Promise<void> {
    const setClauses: string[] = [];
    const params: any[] = [id];
    let paramIdx = 2;

    if (data.actualRtoMs !== undefined) {
      setClauses.push(`actual_rto_ms = $${paramIdx}`);
      params.push(data.actualRtoMs);
      paramIdx++;
    }
    if (data.actualRpoMs !== undefined) {
      setClauses.push(`actual_rpo_ms = $${paramIdx}`);
      params.push(data.actualRpoMs);
      paramIdx++;
    }
    if (data.rtoMet !== undefined) {
      setClauses.push(`rto_met = $${paramIdx}`);
      params.push(data.rtoMet);
      paramIdx++;
    }
    if (data.rpoMet !== undefined) {
      setClauses.push(`rpo_met = $${paramIdx}`);
      params.push(data.rpoMet);
      paramIdx++;
    }

    if (setClauses.length > 0) {
      await this.db.query(
        `UPDATE recovery_executions SET ${setClauses.join(', ')} WHERE id = $1`,
        params,
      );
    }
  }

  async updateStepExecutions(id: string, stepExecutions: any[]): Promise<void> {
    await this.db.query(
      `UPDATE recovery_executions SET step_executions = $2 WHERE id = $1`,
      [id, JSON.stringify(stepExecutions)],
    );
  }

  protected mapRowToEntity(row: any): RecoveryExecutionEntity {
    return {
      id: row.id,
      planId: row.plan_id,
      planName: row.plan_name,
      status: row.status,
      targetTime: row.target_time,
      backupId: row.backup_id,
      stepExecutions: row.step_executions ?? [],
      initiatedAt: row.initiated_at,
      completedAt: row.completed_at,
      rtoTargetMs: row.rto_target_ms ?? 0,
      rpoTargetMs: row.rpo_target_ms ?? 0,
      actualRtoMs: row.actual_rto_ms,
      actualRpoMs: row.actual_rpo_ms,
      rtoMet: row.rto_met,
      rpoMet: row.rpo_met,
      errorMessage: row.error_message,
      createdAt: row.created_at,
    };
  }
}
