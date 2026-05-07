import { DatabasePool } from '../database';
/**
 * PipelineVersionService - Version control for pipelines
 *
 * Handles version creation, diff, rollback, tagging, and baseline management.
 * Uses PostgreSQL for persistence via pipeline_versions table.
 */

export interface PipelineVersion {
  id: string;
  pipelineId: string;
  version: number;
  yamlDefinition: string;
  spec: Record<string, any>;
  createdAt: Date;
  createdBy: string | null;
  changeSummary: string | null;
  tags: string[];
  isBaseline: boolean;
  parentVersionId: string | null;
  durationMs?: number;
  successRate?: number;
}

export interface VersionDiff {
  additions: string[];
  deletions: string[];
  modifications: { path: string; oldValue: string; newValue: string }[];
  summary: {
    added: number;
    deleted: number;
    modified: number;
  };
}

export interface CreateVersionInput {
  pipelineId: string;
  version: number;
  yamlDefinition: string;
  spec: Record<string, any>;
  changeSummary?: string;
  createdBy?: string;
  parentVersionId?: string | null;
}

export const MAX_VERSIONS = 50;

export class PipelineVersionService {

  constructor(private pool: DatabasePool) {}

  // ==================== Version CRUD ====================

  /**
   * Create a new version record
   */
  async createVersion(input: CreateVersionInput): Promise<PipelineVersion> {
    const result = await this.pool.query(
      `INSERT INTO pipeline_versions
        (pipeline_id, version, yaml_definition, spec, change_summary, created_by, parent_version_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.pipelineId,
        input.version,
        input.yamlDefinition,
        input.spec,
        input.changeSummary || null,
        input.createdBy || null,
        input.parentVersionId || null,
      ]
    );
    return this.mapVersion(result.rows[0]);
  }

  /**
   * List versions for a pipeline
   */
  async listVersions(
    pipelineId: string,
    options: { page?: number; limit?: number; tag?: string } = {}
  ): Promise<{ data: PipelineVersion[]; total: number }> {
    const { page = 1, limit = 20, tag } = options;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE pipeline_id = $1';
    const params: any[] = [pipelineId];
    let paramIndex = 2;

    if (tag) {
      whereClause += ` AND tags @> ARRAY[$${paramIndex}]::text[]`;
      params.push(tag);
      paramIndex++;
    }

    // Count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM pipeline_versions ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Data
    params.push(limit, offset);
    const dataResult = await this.pool.query(
      `SELECT * FROM pipeline_versions ${whereClause}
       ORDER BY version DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    return {
      data: dataResult.rows.map((r: any) => this.mapVersion(r)),
      total,
    };
  }

  /**
   * Get a specific version by ID
   */
  async getVersionById(pipelineId: string, versionId: string): Promise<PipelineVersion | null> {
    const result = await this.pool.query(
      `SELECT pv.*,
        AVG(pr.duration_ms) as avg_duration,
        CASE WHEN COUNT(pr.id) > 0
          THEN (SUM(CASE WHEN pr.status = 'success' THEN 1 ELSE 0 END)::float / COUNT(pr.id) * 100)
          ELSE NULL
        END as success_rate
       FROM pipeline_versions pv
       LEFT JOIN pipeline_runs pr ON pr.pipeline_id = pv.pipeline_id
         AND pr.config_snapshot->>'versionId' = pv.id
       WHERE pv.id = $1 AND pv.pipeline_id = $2
       GROUP BY pv.id`,
      [versionId, pipelineId]
    );
    if (!result.rows[0]) return null;
    const row = result.rows[0];
    const version = this.mapVersion(row);
    version.durationMs = row.avg_duration ? parseFloat(row.avg_duration) : undefined;
    version.successRate = row.success_rate ? parseFloat(row.success_rate) : undefined;
    return version;
  }

  /**
   * Get version by version number
   */
  async getVersionByNumber(pipelineId: string, versionNumber: number): Promise<PipelineVersion | null> {
    const result = await this.pool.query(
      'SELECT * FROM pipeline_versions WHERE pipeline_id = $1 AND version = $2',
      [pipelineId, versionNumber]
    );
    if (!result.rows[0]) return null;
    return this.mapVersion(result.rows[0]);
  }

  /**
   * Get the latest version number for a pipeline
   */
  async getLatestVersionNumber(pipelineId: string): Promise<number> {
    const result = await this.pool.query(
      'SELECT MAX(version) as max_ver FROM pipeline_versions WHERE pipeline_id = $1',
      [pipelineId]
    );
    return parseInt(result.rows[0].max_ver || '0', 10);
  }

  // ==================== Version Diff ====================

  /**
   * Compare two versions and return the diff
   */
  async diffVersions(
    pipelineId: string,
    versionId: string,
    targetVersionId: string
  ): Promise<VersionDiff | null> {
    const source = await this.getVersionById(pipelineId, versionId);
    const target = await this.getVersionById(pipelineId, targetVersionId);
    if (!source || !target) return null;

    return this.computeYamlDiff(source.yamlDefinition, target.yamlDefinition);
  }

  /**
   * Compute diff between two YAML strings (line-level comparison)
   */
  private computeYamlDiff(sourceYaml: string, targetYaml: string): VersionDiff {
    const sourceLines = sourceYaml.split('\n');
    const targetLines = targetYaml.split('\n');

    const additions: string[] = [];
    const deletions: string[] = [];
    const modifications: { path: string; oldValue: string; newValue: string }[] = [];

    // Simple line-by-line diff
    const maxLen = Math.max(sourceLines.length, targetLines.length);
    for (let i = 0; i < maxLen; i++) {
      const sourceLine = sourceLines[i];
      const targetLine = targetLines[i];

      if (sourceLine === undefined && targetLine !== undefined) {
        additions.push(targetLine);
      } else if (sourceLine !== undefined && targetLine === undefined) {
        deletions.push(sourceLine);
      } else if (sourceLine !== targetLine) {
        modifications.push({
          path: `line:${i + 1}`,
          oldValue: sourceLine,
          newValue: targetLine,
        });
      }
    }

    return {
      additions,
      deletions,
      modifications,
      summary: {
        added: additions.length,
        deleted: deletions.length,
        modified: modifications.length,
      },
    };
  }

  // ==================== Rollback ====================

  /**
   * Rollback to a specific version by creating a new version copy
   */
  async rollbackToVersion(
    pipelineId: string,
    versionId: string,
    options: { reason?: string; createdBy?: string } = {}
  ): Promise<PipelineVersion | null> {
    const source = await this.getVersionById(pipelineId, versionId);
    if (!source) return null;

    const nextVersion = (await this.getLatestVersionNumber(pipelineId)) + 1;
    const changeSummary = options.reason
      ? `Rollback to v${source.version}: ${options.reason}`
      : `Rollback to v${source.version}`;

    return this.createVersion({
      pipelineId,
      version: nextVersion,
      yamlDefinition: source.yamlDefinition,
      spec: source.spec,
      changeSummary,
      createdBy: options.createdBy,
      parentVersionId: versionId,
    });
  }

  // ==================== Tags ====================

  /**
   * Add a tag to a version
   */
  async addTag(pipelineId: string, versionId: string, tag: string): Promise<string[] | null> {
    const current = await this.getVersionById(pipelineId, versionId);
    if (!current) return null;

    if (current.tags.includes(tag)) {
      return current.tags;
    }

    const newTags = [...current.tags, tag];
    await this.pool.query(
      'UPDATE pipeline_versions SET tags = $1 WHERE id = $2 AND pipeline_id = $3',
      [newTags, versionId, pipelineId]
    );
    return newTags;
  }

  /**
   * Remove a tag from a version
   */
  async removeTag(pipelineId: string, versionId: string, tag: string): Promise<string[] | null> {
    const current = await this.getVersionById(pipelineId, versionId);
    if (!current) return null;

    const newTags = current.tags.filter((t: string) => t !== tag);
    await this.pool.query(
      'UPDATE pipeline_versions SET tags = $1 WHERE id = $2 AND pipeline_id = $3',
      [newTags, versionId, pipelineId]
    );
    return newTags;
  }

  // ==================== Baseline ====================

  /**
   * Set or unset baseline for a version
   */
  async setBaseline(
    pipelineId: string,
    versionId: string,
    isBaseline: boolean
  ): Promise<boolean> {
    const current = await this.getVersionById(pipelineId, versionId);
    if (!current) return false;

    // If setting baseline, unset any existing baseline for this pipeline
    if (isBaseline) {
      await this.pool.query(
        'UPDATE pipeline_versions SET is_baseline = false WHERE pipeline_id = $1',
        [pipelineId]
      );
    }

    const result = await this.pool.query(
      'UPDATE pipeline_versions SET is_baseline = $1 WHERE id = $2 AND pipeline_id = $3',
      [isBaseline, versionId, pipelineId]
    );
    return (result.rowCount || 0) > 0;
  }

  /**
   * Get the baseline version for a pipeline
   */
  async getBaselineVersion(pipelineId: string): Promise<PipelineVersion | null> {
    const result = await this.pool.query(
      'SELECT * FROM pipeline_versions WHERE pipeline_id = $1 AND is_baseline = true ORDER BY version DESC LIMIT 1',
      [pipelineId]
    );
    if (!result.rows[0]) return null;
    return this.mapVersion(result.rows[0]);
  }

  // ==================== Internal helpers ====================

  private mapVersion(row: any): PipelineVersion {
    return {
      id: row.id,
      pipelineId: row.pipeline_id,
      version: row.version,
      yamlDefinition: row.yaml_definition,
      spec: row.spec || {},
      createdAt: row.created_at,
      createdBy: row.created_by,
      changeSummary: row.change_summary,
      tags: row.tags || [],
      isBaseline: row.is_baseline,
      parentVersionId: row.parent_version_id,
    };
  }
}
