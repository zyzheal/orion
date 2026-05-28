import { BaseRepository } from '../db/base-repository';

export interface PipelineTriggerEntity {
  id: string;
  pipelineId: string;
  triggerType: string;
  config: Record<string, unknown>;
  enabled: boolean;
  tenantId: number;
  createdAt: Date;
  updatedAt: Date;
}

export class PipelineTriggerRepository extends BaseRepository<PipelineTriggerEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'pipeline_triggers');
  }

  protected mapRowToEntity(row: any): PipelineTriggerEntity {
    return {
      id: row.id,
      pipelineId: row.pipeline_id,
      triggerType: row.trigger_type,
      config: row.config || {},
      enabled: row.enabled,
      tenantId: row.tenant_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findByPipelineId(pipelineId: string): Promise<PipelineTriggerEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM pipeline_triggers WHERE pipeline_id = $1',
      [pipelineId]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findEnabledByType(triggerType: string): Promise<PipelineTriggerEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM pipeline_triggers WHERE trigger_type = $1 AND enabled = true',
      [triggerType]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async toggleEnabled(id: string, enabled: boolean): Promise<void> {
    await this.db.query(
      'UPDATE pipeline_triggers SET enabled = $1, updated_at = NOW() WHERE id = $2',
      [enabled, id]
    );
  }
}
