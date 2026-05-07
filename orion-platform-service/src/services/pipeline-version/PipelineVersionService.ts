import { DatabasePool } from '../database';
/**
 * PipelineVersionService - Business logic for Pipeline Version Control
 *
 * Implements version management capabilities including:
 * - Automatic version creation on pipeline updates
 * - Version diff comparison
 * - Version rollback
 * - Version tagging and baseline management
 *
 * Phase 1 P0 Service
 */

// ==================== Types ====================

export interface PipelineVersion {
  id: string;
  tenant_id: string;
  pipeline_id: string;
  version: number;
  yaml_definition: string;
  spec: Record<string, unknown>;
  change_summary: string | null;
  tags: string[];
  is_baseline: boolean;
  parent_version_id: string | null;
  created_by: string | null;
  created_at: Date;
}

export interface VersionDiff {
  additions: DiffItem[];
  deletions: DiffItem[];
  modifications: DiffItem[];
  summary: string;
}

export interface DiffItem {
  path: string;
  oldValue: unknown;
  newValue: unknown;
  type: 'stage' | 'config' | 'parameter';
}

export interface CreateVersionInput {
  tenant_id: string;
  pipeline_id: string;
  yaml_definition: string;
  spec?: Record<string, unknown>;
  change_summary?: string;
  created_by?: string;
  parent_version_id?: string;
}

export interface ListVersionsOptions {
  pipeline_id: string;
  tenant_id?: string;
  tag?: string;
  page?: number;
  limit?: number;
}

export class PipelineVersionServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'PipelineVersionServiceError';
  }
}

// ==================== Repository ====================

export class PipelineVersionRepository {

  constructor(private pool: DatabasePool) {}

  async create(input: CreateVersionInput): Promise<PipelineVersion> {
    // Get next version number for this pipeline
    const versionResult = await this.pool.query(
      `SELECT COALESCE(MAX(version), 0) + 1 as next_version 
       FROM pipeline_versions 
       WHERE pipeline_id = $1`,
      [input.pipeline_id]
    );
    const nextVersion = versionResult.rows[0].next_version;

    const result = await this.pool.query(
      `INSERT INTO pipeline_versions 
        (tenant_id, pipeline_id, version, yaml_definition, spec, change_summary, parent_version_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.tenant_id,
        input.pipeline_id,
        nextVersion,
        input.yaml_definition,
        input.spec || {},
        input.change_summary || null,
        input.parent_version_id || null,
        input.created_by || null,
      ]
    );
    return result.rows[0];
  }

  async findById(id: string): Promise<PipelineVersion | null> {
    const result = await this.pool.query(
      'SELECT * FROM pipeline_versions WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findByPipelineAndVersion(pipelineId: string, version: number): Promise<PipelineVersion | null> {
    const result = await this.pool.query(
      'SELECT * FROM pipeline_versions WHERE pipeline_id = $1 AND version = $2',
      [pipelineId, version]
    );
    return result.rows[0] || null;
  }

  async list(options: ListVersionsOptions): Promise<{ data: PipelineVersion[]; total: number }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE pipeline_id = $1';
    const params: any[] = [options.pipeline_id];
    let paramIndex = 2;

    if (options.tag) {
      whereClause += ` AND $${paramIndex} = ANY(tags)`;
      params.push(options.tag);
      paramIndex++;
    }

    const countResult = await this.pool.query(
      `SELECT COUNT(*) as total FROM pipeline_versions ${whereClause}`,
      params
    );

    const dataResult = await this.pool.query(
      `SELECT * FROM pipeline_versions ${whereClause}
       ORDER BY version DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return {
      data: dataResult.rows,
      total: parseInt(countResult.rows[0].total),
    };
  }

  async addTag(id: string, tag: string): Promise<string[]> {
    const result = await this.pool.query(
      `UPDATE pipeline_versions 
       SET tags = array_append(tags, $2)
       WHERE id = $1 AND NOT ($2 = ANY(tags))
       RETURNING tags`,
      [id, tag]
    );
    return result.rows[0]?.tags || [];
  }

  async removeTag(id: string, tag: string): Promise<string[]> {
    const result = await this.pool.query(
      `UPDATE pipeline_versions 
       SET tags = array_remove(tags, $2)
       WHERE id = $1
       RETURNING tags`,
      [id, tag]
    );
    return result.rows[0]?.tags || [];
  }

  async setBaseline(pipelineId: string, versionId: string, isBaseline: boolean): Promise<boolean> {
    // First, remove baseline from all versions of this pipeline
    await this.pool.query(
      `UPDATE pipeline_versions 
       SET is_baseline = false 
       WHERE pipeline_id = $1 AND is_baseline = true`,
      [pipelineId]
    );

    // Then set the new baseline (if setting to true)
    if (isBaseline) {
      const result = await this.pool.query(
        `UPDATE pipeline_versions 
         SET is_baseline = true 
         WHERE id = $1 AND pipeline_id = $2
         RETURNING id`,
        [versionId, pipelineId]
      );
      return result.rowCount > 0;
    }
    return true;
  }

  async getBaseline(pipelineId: string): Promise<PipelineVersion | null> {
    const result = await this.pool.query(
      `SELECT * FROM pipeline_versions 
       WHERE pipeline_id = $1 AND is_baseline = true
       LIMIT 1`,
      [pipelineId]
    );
    return result.rows[0] || null;
  }

  async cleanupOldVersions(pipelineId: string, maxVersions: number = 50): Promise<number> {
    // Keep baseline version + recent versions
    const result = await this.pool.query(
      `DELETE FROM pipeline_versions 
       WHERE pipeline_id = $1 
         AND is_baseline = false
         AND id NOT IN (
           SELECT id FROM pipeline_versions 
           WHERE pipeline_id = $1 
           ORDER BY version DESC 
           LIMIT $2
         )`,
      [pipelineId, maxVersions]
    );
    return result.rowCount;
  }
}

// ==================== Service ====================

export class PipelineVersionService {
  private repository: PipelineVersionRepository;

  constructor(private pool: DatabasePool) {
    this.repository = new PipelineVersionRepository(this.pool);
  }

  /**
   * Create a new version (automatically called on pipeline update)
   */
  async createVersion(input: CreateVersionInput): Promise<PipelineVersion> {
    return this.repository.create(input);
  }

  /**
   * Get version by ID
   */
  async getVersion(versionId: string): Promise<PipelineVersion> {
    const version = await this.repository.findById(versionId);
    if (!version) {
      throw new PipelineVersionServiceError(
        `Version not found: ${versionId}`,
        'VERSION_NOT_FOUND'
      );
    }
    return version;
  }

  /**
   * List versions for a pipeline
   */
  async listVersions(options: ListVersionsOptions): Promise<{
    data: PipelineVersion[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const result = await this.repository.list(options);
    return {
      ...result,
      page,
      limit,
    };
  }

  /**
   * Compare two versions (diff)
   */
  async diffVersions(versionId: string, targetVersionId: string): Promise<VersionDiff> {
    const version1 = await this.getVersion(versionId);
    const version2 = await this.getVersion(targetVersionId);

    return this.computeDiff(version1, version2);
  }

  /**
   * Compute diff between two versions
   */
  private computeDiff(v1: PipelineVersion, v2: PipelineVersion): VersionDiff {
    const additions: DiffItem[] = [];
    const deletions: DiffItem[] = [];
    const modifications: DiffItem[] = [];

    // Parse YAML to compare stages and configs
    const spec1 = v1.spec || {};
    const spec2 = v2.spec || {};

    // Compare stages
    const stages1 = (spec1.stages as Record<string, unknown>[]) || [];
    const stages2 = (spec2.stages as Record<string, unknown>[]) || [];

    const stageNames1 = new Set(stages1.map(s => (s.name as string) || ''));
    const stageNames2 = new Set(stages2.map(s => (s.name as string) || ''));

    // New stages in v2
    for (const name of Array.from(stageNames2)) {
      if (!stageNames1.has(name)) {
        additions.push({
          path: `stages.${name}`,
          oldValue: null,
          newValue: stages2.find(s => s.name === name),
          type: 'stage',
        });
      }
    }

    // Removed stages from v1
    for (const name of Array.from(stageNames1)) {
      if (!stageNames2.has(name)) {
        deletions.push({
          path: `stages.${name}`,
          oldValue: stages1.find(s => s.name === name),
          newValue: null,
          type: 'stage',
        });
      }
    }

    // Modified stages
    for (const name of Array.from(stageNames1)) {
      if (stageNames2.has(name)) {
        const s1 = stages1.find(s => s.name === name);
        const s2 = stages2.find(s => s.name === name);
        if (JSON.stringify(s1) !== JSON.stringify(s2)) {
          modifications.push({
            path: `stages.${name}`,
            oldValue: s1,
            newValue: s2,
            type: 'stage',
          });
        }
      }
    }

    // Compare config parameters
    const config1 = (spec1.config as Record<string, unknown>) || {};
    const config2 = (spec2.config as Record<string, unknown>) || {};

    for (const [key, value2] of Object.entries(config2)) {
      if (!(key in config1)) {
        additions.push({
          path: `config.${key}`,
          oldValue: null,
          newValue: value2,
          type: 'parameter',
        });
      } else if (config1[key] !== value2) {
        modifications.push({
          path: `config.${key}`,
          oldValue: config1[key],
          newValue: value2,
          type: 'parameter',
        });
      }
    }

    for (const [key, value1] of Object.entries(config1)) {
      if (!(key in config2)) {
        deletions.push({
          path: `config.${key}`,
          oldValue: value1,
          newValue: null,
          type: 'parameter',
        });
      }
    }

    const summary = `${additions.length} additions, ${deletions.length} deletions, ${modifications.length} modifications`;

    return { additions, deletions, modifications, summary };
  }

  /**
   * Rollback to a specific version (creates a new version with old content)
   */
  async rollback(pipelineId: string, versionId: string, reason?: string, userId?: string): Promise<PipelineVersion> {
    const targetVersion = await this.getVersion(versionId);

    if (targetVersion.pipeline_id !== pipelineId) {
      throw new PipelineVersionServiceError(
        'Version does not belong to this pipeline',
        'INVALID_PIPELINE'
      );
    }

    // Create a new version with the target version's content
    const newVersion = await this.repository.create({
      tenant_id: targetVersion.tenant_id,
      pipeline_id: pipelineId,
      yaml_definition: targetVersion.yaml_definition,
      spec: targetVersion.spec,
      change_summary: reason || `Rollback to version ${targetVersion.version}`,
      created_by: userId,
      parent_version_id: targetVersion.id,
    });

    return newVersion;
  }

  /**
   * Add a tag to a version
   */
  async addTag(versionId: string, tag: string): Promise<{ success: boolean; tags: string[] }> {
    const version = await this.getVersion(versionId);
    const tags = await this.repository.addTag(versionId, tag);
    return { success: true, tags };
  }

  /**
   * Remove a tag from a version
   */
  async removeTag(versionId: string, tag: string): Promise<{ success: boolean; tags: string[] }> {
    const version = await this.getVersion(versionId);
    const tags = await this.repository.removeTag(versionId, tag);
    return { success: true, tags };
  }

  /**
   * Set or unset baseline version
   */
  async setBaseline(
    pipelineId: string,
    versionId: string,
    isBaseline: boolean
  ): Promise<{ success: boolean; isBaseline: boolean }> {
    const version = await this.getVersion(versionId);

    if (version.pipeline_id !== pipelineId) {
      throw new PipelineVersionServiceError(
        'Version does not belong to this pipeline',
        'INVALID_PIPELINE'
      );
    }

    const success = await this.repository.setBaseline(pipelineId, versionId, isBaseline);
    return { success, isBaseline };
  }

  /**
   * Get the baseline version for a pipeline
   */
  async getBaseline(pipelineId: string): Promise<PipelineVersion | null> {
    return this.repository.getBaseline(pipelineId);
  }

  /**
   * Cleanup old versions (keep max 50)
   */
  async cleanupOldVersions(pipelineId: string, maxVersions: number = 50): Promise<number> {
    return this.repository.cleanupOldVersions(pipelineId, maxVersions);
  }
}