import { BaseRepository } from '../db/base-repository';

export interface LowcodeWorkflowDefinitionEntity {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  nodes: string;
  edges: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export class LowcodeWorkflowDefinitionPgRepository extends BaseRepository<LowcodeWorkflowDefinitionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'lowcode_workflow_definition');
  }

  async findByTenantId(tenantId: string, options?: { enabled?: boolean; limit?: number; offset?: number }): Promise<LowcodeWorkflowDefinitionEntity[]> {
    let query = 'SELECT * FROM lowcode_workflow_definition WHERE tenant_id = $1';
    const values: any[] = [tenantId];

    if (options?.enabled !== undefined) {
      query += ' AND enabled = $2';
      values.push(options.enabled);
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

  async findEnabled(): Promise<LowcodeWorkflowDefinitionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM lowcode_workflow_definition WHERE enabled = TRUE ORDER BY created_at DESC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByName(name: string): Promise<LowcodeWorkflowDefinitionEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM lowcode_workflow_definition WHERE name = $1`,
      [name],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): LowcodeWorkflowDefinitionEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      description: row.description,
      version: row.version,
      enabled: row.enabled,
      nodes: typeof row.nodes === 'string' ? row.nodes : JSON.stringify(row.nodes || []),
      edges: typeof row.edges === 'string' ? row.edges : JSON.stringify(row.edges || []),
      created_by: row.created_by,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}
