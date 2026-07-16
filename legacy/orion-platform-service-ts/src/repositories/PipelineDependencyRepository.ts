import { BaseRepository } from '../db/base-repository';

export interface PipelineDependencyEntity {
  id: string;
  pipelineId: string;
  dependsOn: string[];
  dependencyType: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class PipelineDependencyRepository extends BaseRepository<PipelineDependencyEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'pipeline_dependencies');
  }

  protected mapRowToEntity(row: any): PipelineDependencyEntity {
    return {
      id: String(row.id),
      pipelineId: row.pipeline_id,
      dependsOn: Array.isArray(row.depends_on) ? row.depends_on : JSON.parse(row.depends_on || '[]'),
      dependencyType: row.dependency_type || 'sequential',
      tenantId: row.tenant_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findByPipelineId(pipelineId: string): Promise<PipelineDependencyEntity | undefined> {
    const result = await this.db.query(
      'SELECT * FROM pipeline_dependencies WHERE pipeline_id = $1',
      [pipelineId]
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : undefined;
  }

  async findByTenantId(tenantId: string): Promise<PipelineDependencyEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM pipeline_dependencies WHERE tenant_id = $1',
      [tenantId]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async deleteByPipelineId(pipelineId: string): Promise<boolean> {
    const result = await this.db.query(
      'DELETE FROM pipeline_dependencies WHERE pipeline_id = $1',
      [pipelineId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async upsertDependency(
    pipelineId: string,
    dependsOn: string[],
    dependencyType: string,
    tenantId: string
  ): Promise<PipelineDependencyEntity> {
    const result = await this.db.query(
      `INSERT INTO pipeline_dependencies (pipeline_id, depends_on, dependency_type, tenant_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (pipeline_id, depends_on) DO UPDATE SET
         dependency_type = EXCLUDED.dependency_type,
         updated_at = NOW()
       RETURNING *`,
      [pipelineId, JSON.stringify(dependsOn), dependencyType, tenantId]
    );
    return this.mapRowToEntity(result.rows[0]);
  }
}
