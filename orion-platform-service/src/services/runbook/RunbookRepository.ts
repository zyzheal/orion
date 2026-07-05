import { BaseRepository, FindAllOptions, FindAllResult } from '../../db/base-repository';

import { OrionError, ErrorCode } from '../../errors';

export interface RunbookDefinitionEntity {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  category: string;
  steps: RunbookStep[];
  variables: Record<string, unknown>;
  enabled: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RunbookStep {
  id: string;
  name: string;
  type: 'manual' | 'script' | 'approval' | 'notification';
  config: Record<string, unknown>;
  order: number;
  timeoutSeconds?: number;
}

export interface RunbookExecutionEntity {
  id: string;
  tenantId: string;
  runbookId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  triggeredBy: string;
  context: Record<string, unknown>;
  currentStepIndex: number;
  stepResults: RunbookStepResult[];
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
}

export interface RunbookStepResult {
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  output: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  error: string | null;
}

export class RunbookDefinitionRepository extends BaseRepository<RunbookDefinitionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'runbook_definitions');
  }

  async findByTenant(tenantId: string, options: FindAllOptions = {}): Promise<FindAllResult<RunbookDefinitionEntity>> {
    return this.findAll({ ...options, where: { ...options.where, tenantId } });
  }

  async findByCategory(tenantId: string, category: string): Promise<RunbookDefinitionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM runbook_definitions WHERE tenant_id = $1 AND category = $2 ORDER BY created_at DESC`,
      [tenantId, category],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async findEnabled(tenantId: string): Promise<RunbookDefinitionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM runbook_definitions WHERE tenant_id = $1 AND enabled = true ORDER BY name`,
      [tenantId],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): RunbookDefinitionEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description ?? null,
      category: row.category,
      steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : (row.steps ?? []),
      variables: typeof row.variables === 'string' ? JSON.parse(row.variables) : (row.variables ?? {}),
      enabled: row.enabled,
      createdBy: row.created_by ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export class RunbookExecutionRepository extends BaseRepository<RunbookExecutionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'runbook_executions');
  }

  async findByRunbookId(runbookId: string, limit: number = 20): Promise<RunbookExecutionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM runbook_executions WHERE runbook_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [runbookId, limit],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async findByTenant(tenantId: string, options: FindAllOptions = {}): Promise<FindAllResult<RunbookExecutionEntity>> {
    return this.findAll({ ...options, where: { ...options.where, tenantId } });
  }

  async updateStatus(id: string, status: RunbookExecutionEntity['status'], extra?: Partial<RunbookExecutionEntity>): Promise<RunbookExecutionEntity> {
    const updateData: any = { status };
    if (extra?.currentStepIndex !== undefined) updateData.currentStepIndex = extra.currentStepIndex;
    if (extra?.stepResults !== undefined) updateData.stepResults = extra.stepResults;
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      updateData.completedAt = new Date();
    }
    const result = await this.update(id, updateData);
    if (!result) throw new OrionError('Failed to update runbook execution', ErrorCode.OPERATION_FAILED);
    return result;
  }

  protected mapRowToEntity(row: any): RunbookExecutionEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      runbookId: row.runbook_id,
      status: row.status,
      triggeredBy: row.triggered_by,
      context: typeof row.context === 'string' ? JSON.parse(row.context) : (row.context ?? {}),
      currentStepIndex: row.current_step_index ?? 0,
      stepResults: typeof row.step_results === 'string' ? JSON.parse(row.step_results) : (row.step_results ?? []),
      startedAt: row.started_at,
      completedAt: row.completed_at ?? null,
      createdAt: row.created_at,
    };
  }
}
