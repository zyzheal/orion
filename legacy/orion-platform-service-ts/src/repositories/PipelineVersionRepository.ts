/**
 * PipelineVersionRepository — PostgreSQL data access for pipeline version snapshots.
 *
 * Each row in pipeline_versions is an immutable snapshot of a pipeline at a
 * point in time.  Versions are numbered 1, 2, 3, … monotonically per pipeline
 * and are never modified after INSERT.
 */

export interface PipelineVersionEntity {
  id: string;
  pipelineId: string;
  tenantId: string;
  versionNumber: number;
  name: string;
  description: string | null;
  stages: unknown[];
  schedule: string | null;
  inputConfig: Record<string, unknown>;
  processors: unknown[];
  outputConfig: Record<string, unknown>;
  createdBy: string;
  changeSummary: string | null;
  createdAt: string;
}

export interface CreatePipelineVersionInput {
  id: string;
  pipelineId: string;
  tenantId: string;
  versionNumber: number;
  name: string;
  description?: string | null;
  stages: unknown[];
  schedule?: string | null;
  inputConfig?: Record<string, unknown>;
  processors?: unknown[];
  outputConfig?: Record<string, unknown>;
  createdBy?: string;
  changeSummary?: string | null;
}

export class PipelineVersionRepository {
  constructor(
    private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {}

  /**
   * Insert a new version snapshot.  Caller must assign a monotonically
   * increasing version_number (see getNextVersionNumber).
   */
  async create(input: CreatePipelineVersionInput): Promise<PipelineVersionEntity> {
    const result = await this.db.query(
      `INSERT INTO pipeline_versions
         (id, pipeline_id, tenant_id, version_number, name, description, stages,
          schedule, input_config, processors, output_config, created_by, change_summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        input.id,
        input.pipelineId,
        input.tenantId,
        input.versionNumber,
        input.name,
        input.description ?? null,
        JSON.stringify(input.stages),
        input.schedule ?? null,
        JSON.stringify(input.inputConfig ?? {}),
        JSON.stringify(input.processors ?? []),
        JSON.stringify(input.outputConfig ?? {}),
        input.createdBy ?? 'system',
        input.changeSummary ?? null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * List all versions for a pipeline, ordered newest-first.
   */
  async findByPipeline(pipelineId: string): Promise<PipelineVersionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM pipeline_versions
       WHERE pipeline_id = $1
       ORDER BY version_number DESC`,
      [pipelineId],
    );
    return result.rows.map((r) => this.mapRowToEntity(r));
  }

  /**
   * Get the next version number to assign for a pipeline.
   * Returns 1 if no versions exist yet.
   */
  async getNextVersionNumber(pipelineId: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COALESCE(MAX(version_number), 0) AS max_version
       FROM pipeline_versions
       WHERE pipeline_id = $1`,
      [pipelineId],
    );
    return (result.rows[0]?.max_version ?? 0) + 1;
  }

  /**
   * Get a specific version by its version_number scoped to a pipeline.
   */
  async findByPipelineAndVersion(
    pipelineId: string,
    versionNumber: number,
  ): Promise<PipelineVersionEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM pipeline_versions
       WHERE pipeline_id = $1 AND version_number = $2`,
      [pipelineId, versionNumber],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Count versions for a pipeline.
   */
  async countByPipeline(pipelineId: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*) AS cnt FROM pipeline_versions WHERE pipeline_id = $1`,
      [pipelineId],
    );
    return parseInt(result.rows[0]?.cnt ?? '0', 10);
  }

  /**
   * List versions for all pipelines belonging to a tenant.
   * Optionally filter by a single pipelineId.
   */
  async findByTenant(
    tenantId: string,
    filter?: { pipelineId?: string; limit?: number },
  ): Promise<PipelineVersionEntity[]> {
    let query = `SELECT * FROM pipeline_versions WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (filter?.pipelineId) {
      query += ` AND pipeline_id = $${paramIndex}`;
      params.push(filter.pipelineId);
      paramIndex++;
    }

    query += ` ORDER BY pipeline_id, version_number DESC`;

    if (filter?.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(filter.limit);
    }

    const result = await this.db.query(query, params);
    return result.rows.map((r) => this.mapRowToEntity(r));
  }

  protected mapRowToEntity(row: any): PipelineVersionEntity {
    return {
      id: row.id,
      pipelineId: row.pipeline_id,
      tenantId: row.tenant_id,
      versionNumber: row.version_number,
      name: row.name,
      description: row.description ?? null,
      stages: row.stages,
      schedule: row.schedule ?? null,
      inputConfig: row.input_config ?? {},
      processors: row.processors ?? [],
      outputConfig: row.output_config ?? {},
      createdBy: row.created_by,
      changeSummary: row.change_summary ?? null,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    };
  }
}
