import { BaseRepository } from '../db/base-repository';

export interface LowcodeWorkflowInstanceEntity {
  id: string;
  workflow_id: string;
  workflow_definition_id: string;
  tenant_id: string;
  status: string;
  current_node_id: string;
  variables: string;
  history: string;
  input: string;
  output: string;
  error: string;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

export class LowcodeWorkflowInstancePgRepository extends BaseRepository<LowcodeWorkflowInstanceEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'lowcode_workflow_instance');
  }

  async findByWorkflowId(workflowId: string, options?: { status?: string; limit?: number; offset?: number }): Promise<LowcodeWorkflowInstanceEntity[]> {
    let query = 'SELECT * FROM lowcode_workflow_instance WHERE workflow_id = $1';
    const values: any[] = [workflowId];

    if (options?.status) {
      query += ' AND status = $2';
      values.push(options.status);
    }

    query += ' ORDER BY created_at DESC';

    if (options?.limit) {
      query += ` LIMIT ${options.limit}`;
    }
    if (options?.offset) {
      query += ` OFFSET ${options.offset}`;
    }

    const result = await this.db.query(query, values);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByDefinitionId(definitionId: string, limit: number = 50): Promise<LowcodeWorkflowInstanceEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM lowcode_workflow_instance WHERE workflow_definition_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [definitionId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenantId(tenantId: string, limit: number = 100): Promise<LowcodeWorkflowInstanceEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM lowcode_workflow_instance WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByStatus(status: string, limit: number = 100): Promise<LowcodeWorkflowInstanceEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM lowcode_workflow_instance WHERE status = $1 ORDER BY created_at DESC LIMIT $2`,
      [status, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateStatus(id: string, status: string, error?: string): Promise<LowcodeWorkflowInstanceEntity | null> {
    const updates: any = { status };
    if (status === 'completed' || status === 'failed' || status === 'terminated') {
      updates.completed_at = new Date().toISOString();
    }
    if (error) {
      updates.error = error;
    }
    return this.update(id, updates);
  }

  async cleanupExpired(retentionDate: Date): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM lowcode_workflow_instance WHERE status IN ('completed', 'failed', 'cancelled') AND updated_at < $1`,
      [retentionDate],
    );
    return result.rowCount || 0;
  }

  protected mapRowToEntity(row: any): LowcodeWorkflowInstanceEntity {
    return {
      id: row.id,
      workflow_id: row.workflow_id,
      workflow_definition_id: row.workflow_definition_id,
      tenant_id: row.tenant_id,
      status: row.status,
      current_node_id: row.current_node_id,
      variables: typeof row.variables === 'string' ? row.variables : JSON.stringify(row.variables || {}),
      history: typeof row.history === 'string' ? row.history : JSON.stringify(row.history || []),
      input: typeof row.input === 'string' ? row.input : JSON.stringify(row.input || {}),
      output: row.output,
      error: row.error,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
      completed_at: row.completed_at ? new Date(row.completed_at) : null,
    };
  }
}
