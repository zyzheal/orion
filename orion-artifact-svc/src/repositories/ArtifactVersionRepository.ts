/**
 * ArtifactVersionRepository — PostgreSQL data access for artifact versions.
 */
import { DatabasePool } from '../utils/database';

export interface ArtifactVersionEntity {
  id: string;
  tenant_id: string;
  pipeline_id: string;
  run_id: string | null;
  stage_name: string | null;
  artifact_name: string;
  version: string;
  commit_sha: string | null;
  branch: string | null;
  storage_path: string | null;
  metadata: Record<string, any>;
  environment: string | null;
  promoted_at: Date | null;
  tags: string[];
  created_at: Date;
}

export class ArtifactVersionRepository {
  constructor(private pool: DatabasePool) {}

  async create(data: {
    id: string; tenant_id: string; pipeline_id: string; run_id: string | null;
    stage_name: string | null; artifact_name: string; version: string;
    commit_sha: string | null; branch: string | null; storage_path: string | null;
    metadata: Record<string, any>; environment: string | null; tags: string[];
  }): Promise<ArtifactVersionEntity> {
    const result = await this.pool.query(
      `INSERT INTO artifact_versions (id, tenant_id, pipeline_id, run_id, stage_name, artifact_name, version, commit_sha, branch, storage_path, metadata, environment, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [data.id, data.tenant_id, data.pipeline_id, data.run_id, data.stage_name, data.artifact_name, data.version, data.commit_sha, data.branch, data.storage_path, data.metadata, data.environment, data.tags]
    );
    return result.rows[0];
  }

  async findById(id: string): Promise<ArtifactVersionEntity | null> {
    const result = await this.pool.query('SELECT * FROM artifact_versions WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findByPipelineIdAndVersion(pipelineId: string, version: string): Promise<ArtifactVersionEntity | null> {
    const result = await this.pool.query(
      'SELECT * FROM artifact_versions WHERE pipeline_id = $1 AND version = $2',
      [pipelineId, version]
    );
    return result.rows[0] || null;
  }

  async findWithFilters(options: {
    pipelineId?: string; artifactName?: string; environment?: string;
    limit: number; offset: number;
  }): Promise<{ versions: ArtifactVersionEntity[]; total: number }> {
    let query = 'SELECT * FROM artifact_versions WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (options.pipelineId) { query += ` AND pipeline_id = $${idx++}`; params.push(options.pipelineId); }
    if (options.artifactName) { query += ` AND artifact_name = $${idx++}`; params.push(options.artifactName); }
    if (options.environment) { query += ` AND environment = $${idx++}`; params.push(options.environment); }

    query += ` ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(options.limit, options.offset);

    const result = await this.pool.query(query, params);
    return { versions: result.rows, total: result.rows.length };
  }

  async findByTag(tag: string): Promise<ArtifactVersionEntity[]> {
    const result = await this.pool.query(
      "SELECT * FROM artifact_versions WHERE $1 = ANY(tags) ORDER BY created_at DESC",
      [tag]
    );
    return result.rows;
  }

  async findByPipelineHistory(pipelineId: string, limit: number): Promise<ArtifactVersionEntity[]> {
    const result = await this.pool.query(
      'SELECT * FROM artifact_versions WHERE pipeline_id = $1 AND environment IS NOT NULL ORDER BY promoted_at DESC LIMIT $2',
      [pipelineId, limit]
    );
    return result.rows;
  }

  async updateEnvironment(id: string, environment: string): Promise<ArtifactVersionEntity | null> {
    const result = await this.pool.query(
      'UPDATE artifact_versions SET environment = $1, promoted_at = NOW() WHERE id = $2 RETURNING *',
      [environment, id]
    );
    return result.rows[0] || null;
  }

  async addTag(id: string, tag: string): Promise<ArtifactVersionEntity | null> {
    const result = await this.pool.query(
      'UPDATE artifact_versions SET tags = array_append(tags, $1) WHERE $1 != ALL(tags) AND id = $2 RETURNING *',
      [tag, id]
    );
    return result.rows[0] || null;
  }

  async removeTag(id: string, tag: string): Promise<ArtifactVersionEntity | null> {
    const result = await this.pool.query(
      'UPDATE artifact_versions SET tags = array_remove(tags, $1) WHERE id = $2 RETURNING *',
      [tag, id]
    );
    return result.rows[0] || null;
  }
}
