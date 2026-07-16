/**
 * CrossDomainWorkflowRepository
 * 跨域工作流定义与执行记录的数据访问层
 *
 * Phase 2.2: Replaces Map storage with PostgreSQL persistence
 */

import { BaseRepository, FindAllOptions, FindAllResult } from '../db/base-repository';

// ─── Workflow Definition Entities ────────────────────────────────────────────

export interface WorkflowDefinitionEntity {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  status: 'active' | 'paused' | 'completed' | 'failed';
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastRunAt: Date | null;
}

export interface WorkflowStepEntity {
  id: string;
  workflowId: string;
  domain: 'pipeline' | 'deploy' | 'monitor' | 'security' | 'notify';
  action: string;
  parameters: Record<string, unknown>;
  dependsOn: string[];
  timeoutMs: number;
  retryPolicy: { maxRetries: number; backoff: number } | null;
  stepOrder: number;
}

// ─── Execution Entities ──────────────────────────────────────────────────────

export interface ExecutionEntity {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  triggeredBy: string;
  startedAt: Date;
  completedAt: Date | null;
}

export interface ExecutionStepEntity {
  id: string;
  executionId: string;
  stepId: string;
  status: string;
  result: Record<string, unknown> | null;
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
}

// ─── Workflow Definition Repository ──────────────────────────────────────────

export class CrossDomainWorkflowRepository extends BaseRepository<WorkflowDefinitionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'cross_domain_workflows');
  }

  async findByTenant(tenantId: string, options: FindAllOptions = {}): Promise<FindAllResult<WorkflowDefinitionEntity>> {
    return this.findAll({ ...options, where: { ...options.where, tenant_id: tenantId } });
  }

  async findByStatus(status: string): Promise<WorkflowDefinitionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM cross_domain_workflows WHERE status = $1 ORDER BY created_at DESC`,
      [status],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByDomain(domain: string): Promise<WorkflowDefinitionEntity[]> {
    const result = await this.db.query(
      `SELECT DISTINCT w.* FROM cross_domain_workflows w
       JOIN cross_domain_workflow_steps s ON s.workflow_id = w.id
       WHERE s.domain = $1 ORDER BY w.created_at DESC`,
      [domain],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateLastRun(id: string, lastRunAt: Date): Promise<void> {
    await this.db.query(
      `UPDATE cross_domain_workflows SET last_run_at = $1, updated_at = NOW() WHERE id = $2`,
      [lastRunAt, id],
    );
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.db.query(
      `UPDATE cross_domain_workflows SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, id],
    );
  }

  async createWithSteps(
    workflow: Omit<WorkflowDefinitionEntity, 'createdAt' | 'updatedAt'>,
    steps: Omit<WorkflowStepEntity, 'id'>[],
  ): Promise<WorkflowDefinitionEntity> {
    const now = new Date();
    const result = await this.db.query(
      `INSERT INTO cross_domain_workflows (id, tenant_id, name, description, status, created_by, created_at, updated_at, last_run_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [workflow.id, workflow.tenantId, workflow.name, workflow.description, workflow.status, workflow.createdBy, now, now, workflow.lastRunAt],
    );

    // Insert steps
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      await this.db.query(
        `INSERT INTO cross_domain_workflow_steps (id, workflow_id, domain, action, parameters, depends_on, timeout_ms, retry_policy, step_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          `step-${workflow.id}-${i}`,
          workflow.id,
          step.domain,
          step.action,
          step.parameters,
          JSON.stringify(step.dependsOn),
          step.timeoutMs,
          step.retryPolicy ? JSON.stringify(step.retryPolicy) : null,
          step.stepOrder,
        ],
      );
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  async getSteps(workflowId: string): Promise<WorkflowStepEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM cross_domain_workflow_steps WHERE workflow_id = $1 ORDER BY step_order ASC`,
      [workflowId],
    );
    return result.rows.map(row => ({
      id: row.id,
      workflowId: row.workflow_id,
      domain: row.domain,
      action: row.action,
      parameters: row.parameters || {},
      dependsOn: Array.isArray(row.depends_on) ? row.depends_on : JSON.parse(row.depends_on || '[]'),
      timeoutMs: row.timeout_ms,
      retryPolicy: row.retry_policy ? (typeof row.retry_policy === 'string' ? JSON.parse(row.retry_policy) : row.retry_policy) : null,
      stepOrder: row.step_order,
    }));
  }

  protected mapRowToEntity(row: any): WorkflowDefinitionEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      status: row.status,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastRunAt: row.last_run_at ? new Date(row.last_run_at) : null,
    };
  }
}

// ─── Execution Repository ────────────────────────────────────────────────────

export class CrossDomainExecutionRepository {
  constructor(private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {}

  async create(execution: ExecutionEntity): Promise<ExecutionEntity> {
    const result = await this.db.query(
      `INSERT INTO cross_domain_executions (id, workflow_id, status, triggered_by, started_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [execution.id, execution.workflowId, execution.status, execution.triggeredBy, execution.startedAt, execution.completedAt],
    );
    return this.mapRowToExecution(result.rows[0]);
  }

  async updateStatus(id: string, status: string, completedAt: Date | null): Promise<void> {
    await this.db.query(
      `UPDATE cross_domain_executions SET status = $1, completed_at = $2 WHERE id = $3`,
      [status, completedAt, id],
    );
  }

  async findByWorkflowId(workflowId: string): Promise<ExecutionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM cross_domain_executions WHERE workflow_id = $1 ORDER BY started_at DESC`,
      [workflowId],
    );
    return result.rows.map(row => this.mapRowToExecution(row));
  }

  async findById(id: string): Promise<ExecutionEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM cross_domain_executions WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToExecution(result.rows[0]);
  }

  async createStep(step: ExecutionStepEntity): Promise<void> {
    await this.db.query(
      `INSERT INTO cross_domain_execution_steps (id, execution_id, step_id, status, result, error, started_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [step.id, step.executionId, step.stepId, step.status, step.result ? JSON.stringify(step.result) : null, step.error, step.startedAt, step.completedAt],
    );
  }

  async updateStep(stepId: string, status: string, result: Record<string, unknown> | null, error: string | null, completedAt: Date | null): Promise<void> {
    await this.db.query(
      `UPDATE cross_domain_execution_steps SET status = $1, result = $2, error = $3, completed_at = $4 WHERE id = $5`,
      [status, result ? JSON.stringify(result) : null, error, completedAt, stepId],
    );
  }

  async getSteps(executionId: string): Promise<ExecutionStepEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM cross_domain_execution_steps WHERE execution_id = $1 ORDER BY started_at ASC`,
      [executionId],
    );
    return result.rows.map(row => ({
      id: row.id,
      executionId: row.execution_id,
      stepId: row.step_id,
      status: row.status,
      result: row.result ? (typeof row.result === 'string' ? JSON.parse(row.result) : row.result) : null,
      error: row.error,
      startedAt: row.started_at ? new Date(row.started_at) : null,
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
    }));
  }

  private mapRowToExecution(row: any): ExecutionEntity {
    return {
      id: row.id,
      workflowId: row.workflow_id,
      status: row.status,
      triggeredBy: row.triggered_by,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
    };
  }
}
