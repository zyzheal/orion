import { DatabasePool } from '../database';
import { getCurrentTenantId } from '../../db/tenant-context-storage';

export interface ProcessDefinition {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  version: number;
  entity_type: string;
  enabled: boolean;
  steps: Array<Record<string, unknown>>;
  transitions: Array<Record<string, unknown>>;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateProcessDefinitionInput {
  name: string;
  description?: string;
  entity_type: string;
  steps: Array<Record<string, unknown>>;
  transitions: Array<Record<string, unknown>>;
  enabled?: boolean;
  created_by?: string;
}

export interface UpdateProcessDefinitionInput {
  name?: string;
  description?: string;
  entity_type?: string;
  steps?: Array<Record<string, unknown>>;
  transitions?: Array<Record<string, unknown>>;
  enabled?: boolean;
}

export class ProcessDefinitionRepository {
  constructor(private pool: DatabasePool) {}

  async findById(id: string): Promise<ProcessDefinition | null> {
    const result = await this.pool.query(
      'SELECT * FROM process_definitions WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findAll(options?: {
    entityType?: string;
    enabled?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ rows: ProcessDefinition[]; total: number }> {
    const tenantId = getCurrentTenantId();
    const conditions: string[] = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (options?.entityType) {
      conditions.push(`entity_type = $${paramIndex}`);
      params.push(options.entityType);
      paramIndex++;
    }
    if (options?.enabled !== undefined) {
      conditions.push(`enabled = $${paramIndex}`);
      params.push(options.enabled);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    const countResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM process_definitions WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await this.pool.query(
      `SELECT * FROM process_definitions WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return { rows: dataResult.rows, total };
  }

  async create(input: CreateProcessDefinitionInput): Promise<ProcessDefinition> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      `INSERT INTO process_definitions (tenant_id, name, description, entity_type, steps, transitions, enabled, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        tenantId,
        input.name,
        input.description ?? null,
        input.entity_type,
        JSON.stringify(input.steps),
        JSON.stringify(input.transitions),
        input.enabled ?? true,
        input.created_by ?? null,
      ]
    );
    return result.rows[0];
  }

  async update(id: string, input: UpdateProcessDefinitionInput): Promise<ProcessDefinition | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      setClauses.push(`name = $${paramIndex}`);
      params.push(input.name);
      paramIndex++;
    }
    if (input.description !== undefined) {
      setClauses.push(`description = $${paramIndex}`);
      params.push(input.description);
      paramIndex++;
    }
    if (input.entity_type !== undefined) {
      setClauses.push(`entity_type = $${paramIndex}`);
      params.push(input.entity_type);
      paramIndex++;
    }
    if (input.steps !== undefined) {
      setClauses.push(`steps = $${paramIndex}`);
      params.push(JSON.stringify(input.steps));
      paramIndex++;
    }
    if (input.transitions !== undefined) {
      setClauses.push(`transitions = $${paramIndex}`);
      params.push(JSON.stringify(input.transitions));
      paramIndex++;
    }
    if (input.enabled !== undefined) {
      setClauses.push(`enabled = $${paramIndex}`);
      params.push(input.enabled);
      paramIndex++;
    }

    if (setClauses.length === 0) return this.findById(id);

    setClauses.push('updated_at = NOW()');
    params.push(id);

    const result = await this.pool.query(
      `UPDATE process_definitions SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM process_definitions WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }
}
