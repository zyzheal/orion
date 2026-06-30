/**
 * CrossDomainOrchestrationRepository — PostgreSQL data access for cross-domain orchestrations
 *
 * Manages cross_domain_orchestrations and cross_domain_orchestration_steps tables.
 * Provides dual-path access: DB-first with in-memory fallback for the service layer.
 */

import { BaseRepository, FindAllOptions, FindAllResult } from '../db/base-repository';

// ============================================================
// Entity Types
// ============================================================

export interface OrchestrationStepEntity {
  id: string;
  orchestrationId: string;
  stepName: string;
  domainName: string;
  sequence: number;
  status: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  retryCount: number;
  maxRetries: number;
  startedAt?: Date;
  completedAt?: Date;
  compensationStartedAt?: Date;
  compensationCompletedAt?: Date;
  createdAt: Date;
}

export interface CrossDomainOrchestrationEntity {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  status: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  domains: string[];
  currentStep?: string;
  stepCount: number;
  completedSteps: number;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  startedAt?: Date;
  metadata: Record<string, unknown>;
}

// ============================================================
// Repository
// ============================================================

export class CrossDomainOrchestrationRepository extends BaseRepository<CrossDomainOrchestrationEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'cross_domain_orchestrations');
  }

  /** Find orchestrations by tenant with optional filters */
  async findByTenant(
    tenantId: string,
    filter?: {
      status?: string | string[];
      domain?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<CrossDomainOrchestrationEntity[]> {
    let query = 'SELECT * FROM cross_domain_orchestrations WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    let paramIdx = 2;

    if (filter?.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      query += ` AND status = ANY($${paramIdx}::text[])`;
      params.push(statuses);
      paramIdx++;
    }
    if (filter?.domain) {
      query += ` AND domains @> $${paramIdx}::jsonb`;
      params.push(JSON.stringify([filter.domain]));
      paramIdx++;
    }

    query += ' ORDER BY created_at DESC';
    if (filter?.limit) {
      query += ` LIMIT $${paramIdx}`;
      params.push(filter.limit);
      paramIdx++;
    }
    if (filter?.offset) {
      query += ` OFFSET $${paramIdx}`;
      params.push(filter.offset);
    }

    const result = await this.db.query(query, params);
    return result.rows.map((r: any) => this.mapRowToEntity(r));
  }

  /** Save an orchestration (upsert) */
  async saveUpsert(entity: CrossDomainOrchestrationEntity): Promise<void> {
    const { id, tenantId, name, description, status, input, output, error, domains, currentStep, stepCount, completedSteps, createdBy, metadata, createdAt, updatedAt, startedAt, completedAt } = entity;

    await this.db.query(
      `INSERT INTO cross_domain_orchestrations (
        id, tenant_id, name, description, status, input, output, error,
        domains, current_step, step_count, completed_steps, created_by,
        metadata, created_at, updated_at, started_at, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        output = EXCLUDED.output,
        error = EXCLUDED.error,
        current_step = EXCLUDED.current_step,
        completed_steps = EXCLUDED.completed_steps,
        updated_at = EXCLUDED.updated_at,
        started_at = COALESCE(EXCLUDED.started_at, cross_domain_orchestrations.started_at),
        completed_at = COALESCE(EXCLUDED.completed_at, cross_domain_orchestrations.completed_at)`,
      [
        id,
        tenantId,
        name,
        description || null,
        status,
        JSON.stringify(input),
        output ? JSON.stringify(output) : null,
        error || null,
        JSON.stringify(domains),
        currentStep || null,
        stepCount,
        completedSteps,
        createdBy || null,
        JSON.stringify(metadata),
        createdAt,
        updatedAt,
        startedAt || null,
        completedAt || null,
      ]
    );
  }

  /** Update orchestration status and optionally output/error */
  async updateStatus(
    id: string,
    status: string,
    extra?: {
      output?: Record<string, unknown>;
      error?: string;
      currentStep?: string;
      completedSteps?: number;
      startedAt?: Date;
      completedAt?: Date;
    }
  ): Promise<void> {
    const sets: string[] = ['status = $1', 'updated_at = NOW()'];
    const vals: unknown[] = [status];
    let idx = 2;

    if (extra?.output !== undefined) {
      sets.push(`output = $${idx}`);
      vals.push(extra.output ? JSON.stringify(extra.output) : null);
      idx++;
    }
    if (extra?.error !== undefined) {
      sets.push(`error = $${idx}`);
      vals.push(extra.error || null);
      idx++;
    }
    if (extra?.currentStep !== undefined) {
      sets.push(`current_step = $${idx}`);
      vals.push(extra.currentStep || null);
      idx++;
    }
    if (extra?.completedSteps !== undefined) {
      sets.push(`completed_steps = $${idx}`);
      vals.push(extra.completedSteps);
      idx++;
    }
    if (extra?.startedAt) {
      sets.push(`started_at = $${idx}`);
      vals.push(extra.startedAt);
      idx++;
    }
    if (extra?.completedAt) {
      sets.push(`completed_at = $${idx}`);
      vals.push(extra.completedAt);
      idx++;
    }

    sets.push(`id = $${idx}`);
    vals.push(id);

    await this.db.query(
      `UPDATE cross_domain_orchestrations SET ${sets.join(', ')} WHERE id = $${idx + 1}`,
      vals
    );
  }

  // ============================================================
  // Steps
  // ============================================================

  /** Save or update a step */
  async saveStep(step: OrchestrationStepEntity): Promise<void> {
    await this.db.query(
      `INSERT INTO cross_domain_orchestration_steps (
        id, orchestration_id, step_name, domain_name, sequence, status,
        input, output, error, retry_count, max_retries,
        started_at, completed_at, compensation_started_at, compensation_completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (orchestration_id, step_name, sequence) DO UPDATE SET
        status = EXCLUDED.status,
        output = EXCLUDED.output,
        error = EXCLUDED.error,
        retry_count = EXCLUDED.retry_count,
        started_at = EXCLUDED.started_at,
        completed_at = EXCLUDED.completed_at,
        compensation_started_at = EXCLUDED.compensation_started_at,
        compensation_completed_at = EXCLUDED.compensation_completed_at`,
      [
        step.id,
        step.orchestrationId,
        step.stepName,
        step.domainName,
        step.sequence,
        step.status,
        JSON.stringify(step.input),
        step.output ? JSON.stringify(step.output) : null,
        step.error || null,
        step.retryCount,
        step.maxRetries,
        step.startedAt || null,
        step.completedAt || null,
        step.compensationStartedAt || null,
        step.compensationCompletedAt || null,
      ]
    );
  }

  /** Find all steps for an orchestration */
  async findStepsByOrchestrationId(orchestrationId: string): Promise<OrchestrationStepEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM cross_domain_orchestration_steps WHERE orchestration_id = $1 ORDER BY sequence',
      [orchestrationId]
    );
    return result.rows.map((r: any) => this.mapStepRowToEntity(r));
  }

  /** Delete steps by orchestration id */
  async deleteStepsByOrchestrationId(orchestrationId: string): Promise<void> {
    await this.db.query(
      'DELETE FROM cross_domain_orchestration_steps WHERE orchestration_id = $1',
      [orchestrationId]
    );
  }

  // ============================================================
  // Mapping
  // ============================================================

  protected mapRowToEntity(row: any): CrossDomainOrchestrationEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description || undefined,
      status: row.status,
      input: (row.input as Record<string, unknown>) || {},
      output: row.output || undefined,
      error: row.error || undefined,
      domains: row.domains || [],
      currentStep: row.current_step || undefined,
      stepCount: row.step_count,
      completedSteps: row.completed_steps,
      createdBy: row.created_by || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at || undefined,
      startedAt: row.started_at || undefined,
      metadata: (row.metadata as Record<string, unknown>) || {},
    };
  }

  protected mapStepRowToEntity(row: any): OrchestrationStepEntity {
    return {
      id: row.id,
      orchestrationId: row.orchestration_id,
      stepName: row.step_name,
      domainName: row.domain_name,
      sequence: row.sequence,
      status: row.status,
      input: (row.input as Record<string, unknown>) || {},
      output: row.output || undefined,
      error: row.error || undefined,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      startedAt: row.started_at || undefined,
      completedAt: row.completed_at || undefined,
      compensationStartedAt: row.compensation_started_at || undefined,
      compensationCompletedAt: row.compensation_completed_at || undefined,
      createdAt: row.created_at,
    };
  }
}
