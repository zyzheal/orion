import { BaseRepository } from '../db/base-repository';

export interface HookChainDefinitionEntity {
  id: string;
  name: string;
  description: string | null;
  hooks: any[];
  executionMode: string;
  stopOnFailure: boolean;
  inputTransform: string | null;
  outputTransform: string | null;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class HookChainDefinitionRepository extends BaseRepository<HookChainDefinitionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'hook_chain_definitions');
  }

  async findByName(name: string): Promise<HookChainDefinitionEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM hook_chain_definitions WHERE name = $1 LIMIT 1`,
      [name],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): HookChainDefinitionEntity {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      hooks: typeof row.hooks === 'string' ? JSON.parse(row.hooks) : (row.hooks || []),
      executionMode: row.execution_mode,
      stopOnFailure: row.stop_on_failure,
      inputTransform: row.input_transform,
      outputTransform: row.output_transform,
      tenantId: row.tenant_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
