import { DatabasePool } from '../database';
import { getCurrentTenantId } from '../../db/tenant-context-storage';

export interface ProcessInstance {
  id: string;
  tenant_id: string;
  definition_id: string;
  definition_snapshot: Record<string, unknown>;
  entity_type: string;
  entity_id: string;
  current_step_id: string | null;
  status: string;
  started_at: Date;
  completed_at: Date | null;
  created_by: string | null;
  updated_at: Date;
}

export interface ProcessStepInstance {
  id: string;
  tenant_id: string;
  instance_id: string;
  step_id: string;
  step_name: string;
  step_type: string;
  handler_key: string | null;
  status: string;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  started_at: Date | null;
  completed_at: Date | null;
  operator: string | null;
  comment: string | null;
  created_at: Date;
}

export interface CreateProcessInstanceInput {
  definition_id: string;
  definition_snapshot: Record<string, unknown>;
  entity_type: string;
  entity_id: string;
  current_step_id?: string;
  status?: string;
  created_by?: string;
}

export interface CreateStepInstanceInput {
  instance_id: string;
  step_id: string;
  step_name: string;
  step_type: string;
  handler_key?: string;
  status?: string;
  input_data?: Record<string, unknown>;
}

export class ProcessInstanceRepository {
  constructor(private pool: DatabasePool) {}

  // ---- Instance CRUD ----

  async findInstanceById(id: string): Promise<ProcessInstance | null> {
    const result = await this.pool.query(
      'SELECT * FROM process_instances WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findInstances(options?: {
    definitionId?: string;
    entityType?: string;
    entityId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ rows: ProcessInstance[]; total: number }> {
    const tenantId = getCurrentTenantId();
    const conditions: string[] = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (options?.definitionId) {
      conditions.push(`definition_id = $${paramIndex}`);
      params.push(options.definitionId);
      paramIndex++;
    }
    if (options?.entityType) {
      conditions.push(`entity_type = $${paramIndex}`);
      params.push(options.entityType);
      paramIndex++;
    }
    if (options?.entityId) {
      conditions.push(`entity_id = $${paramIndex}`);
      params.push(options.entityId);
      paramIndex++;
    }
    if (options?.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(options.status);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    const countResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM process_instances WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await this.pool.query(
      `SELECT * FROM process_instances WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return { rows: dataResult.rows, total };
  }

  async createInstance(input: CreateProcessInstanceInput): Promise<ProcessInstance> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      `INSERT INTO process_instances (tenant_id, definition_id, definition_snapshot, entity_type, entity_id, current_step_id, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        tenantId,
        input.definition_id,
        JSON.stringify(input.definition_snapshot),
        input.entity_type,
        input.entity_id,
        input.current_step_id ?? null,
        input.status ?? 'running',
        input.created_by ?? null,
      ]
    );
    return result.rows[0];
  }

  async updateInstance(id: string, data: { current_step_id?: string; status?: string; completed_at?: Date }): Promise<ProcessInstance | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (data.current_step_id !== undefined) {
      setClauses.push(`current_step_id = $${paramIndex}`);
      params.push(data.current_step_id);
      paramIndex++;
    }
    if (data.status !== undefined) {
      setClauses.push(`status = $${paramIndex}`);
      params.push(data.status);
      paramIndex++;
    }
    if (data.completed_at !== undefined) {
      setClauses.push(`completed_at = $${paramIndex}`);
      params.push(data.completed_at);
      paramIndex++;
    }

    if (setClauses.length === 0) return this.findInstanceById(id);

    setClauses.push('updated_at = NOW()');
    params.push(id);

    const result = await this.pool.query(
      `UPDATE process_instances SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  // ---- Step Instance CRUD ----

  async findStepById(id: string): Promise<ProcessStepInstance | null> {
    const result = await this.pool.query(
      'SELECT * FROM process_step_instances WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findStepByInstanceIdAndStepId(instanceId: string, stepId: string): Promise<ProcessStepInstance | null> {
    const result = await this.pool.query(
      'SELECT * FROM process_step_instances WHERE instance_id = $1 AND step_id = $2 ORDER BY created_at DESC LIMIT 1',
      [instanceId, stepId]
    );
    return result.rows[0] || null;
  }

  async findStepsByInstanceId(instanceId: string): Promise<ProcessStepInstance[]> {
    const result = await this.pool.query(
      'SELECT * FROM process_step_instances WHERE instance_id = $1 ORDER BY created_at ASC',
      [instanceId]
    );
    return result.rows;
  }

  async createStep(input: CreateStepInstanceInput): Promise<ProcessStepInstance> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      `INSERT INTO process_step_instances (tenant_id, instance_id, step_id, step_name, step_type, handler_key, status, input_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        tenantId,
        input.instance_id,
        input.step_id,
        input.step_name,
        input.step_type,
        input.handler_key ?? null,
        input.status ?? 'pending',
        input.input_data ? JSON.stringify(input.input_data) : null,
      ]
    );
    return result.rows[0];
  }

  async updateStep(id: string, data: {
    status?: string;
    output_data?: Record<string, unknown>;
    started_at?: Date;
    completed_at?: Date;
    operator?: string;
    comment?: string;
  }): Promise<ProcessStepInstance | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (data.status !== undefined) {
      setClauses.push(`status = $${paramIndex}`);
      params.push(data.status);
      paramIndex++;
    }
    if (data.output_data !== undefined) {
      setClauses.push(`output_data = $${paramIndex}`);
      params.push(JSON.stringify(data.output_data));
      paramIndex++;
    }
    if (data.started_at !== undefined) {
      setClauses.push(`started_at = $${paramIndex}`);
      params.push(data.started_at);
      paramIndex++;
    }
    if (data.completed_at !== undefined) {
      setClauses.push(`completed_at = $${paramIndex}`);
      params.push(data.completed_at);
      paramIndex++;
    }
    if (data.operator !== undefined) {
      setClauses.push(`operator = $${paramIndex}`);
      params.push(data.operator);
      paramIndex++;
    }
    if (data.comment !== undefined) {
      setClauses.push(`comment = $${paramIndex}`);
      params.push(data.comment);
      paramIndex++;
    }

    if (setClauses.length === 0) return this.findStepById(id);

    params.push(id);
    const result = await this.pool.query(
      `UPDATE process_step_instances SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }
}
