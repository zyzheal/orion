/**
 * ArtifactVersionRepository — 制品版本追踪数据访问层
 *
 * GAP-CN-06: 提供制品版本的 PostgreSQL 持久化和查询能力，
 * 支持版本溯源、部署历史、版本对比等操作。
 */

import { BaseRepository } from '../db/base-repository';
import {
  ArtifactVersion,
  ArtifactVersionCreateInput,
  ArtifactVersionQueryOptions,
  TraceabilityChain,
  DeploymentHistory,
  VersionDiff,
} from '../models/ArtifactVersion';

/**
 * 数据库行映射（snake_case -> camelCase 转换中间层）
 */
interface ArtifactVersionRow {
  id: string;
  tenant_id: string;
  pipeline_id: string;
  run_id: string;
  stage_name: string;
  artifact_name: string;
  version: string;
  commit_sha: string | null;
  branch: string | null;
  metadata: Record<string, string>;
  storage_path: string;
  created_at: Date;
}

export class ArtifactVersionRepository extends BaseRepository<ArtifactVersion> {
  constructor(
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {
    super(db, 'artifact_version_tracking');
  }

  /**
   * 创建制品版本记录
   */
  async createVersion(input: ArtifactVersionCreateInput): Promise<ArtifactVersion> {
    const result = await this.db.query(
      `INSERT INTO artifact_version_tracking
       (tenant_id, pipeline_id, run_id, stage_name, artifact_name, version,
        commit_sha, branch, metadata, storage_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        input.tenantId,
        input.pipelineId,
        input.runId,
        input.stageName,
        input.artifactName,
        input.version,
        input.commitSha || null,
        input.branch || null,
        input.metadata || {},
        input.storagePath,
      ],
    );
    if (result.rows.length === 0) {
      throw new Error('INSERT into artifact_version_tracking returned no rows');
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * 根据 Run ID 查找制品版本
   */
  async findByRunId(runId: string): Promise<ArtifactVersion[]> {
    const result = await this.db.query(
      `SELECT * FROM artifact_version_tracking WHERE run_id = $1 ORDER BY created_at DESC`,
      [runId],
    );
    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  /**
   * 根据 Pipeline ID 查找制品版本
   */
  async findByPipelineId(pipelineId: string, limit: number = 50): Promise<ArtifactVersion[]> {
    const result = await this.db.query(
      `SELECT * FROM artifact_version_tracking
       WHERE pipeline_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [pipelineId, limit],
    );
    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  /**
   * 根据版本号查找（限定某个 Pipeline）
   */
  async findByVersion(pipelineId: string, version: string): Promise<ArtifactVersion | undefined> {
    const result = await this.db.query(
      `SELECT * FROM artifact_version_tracking
       WHERE pipeline_id = $1 AND version = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [pipelineId, version],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * 查找某个 Pipeline 的最新版本
   */
  async findLatestByPipeline(pipelineId: string): Promise<ArtifactVersion | undefined> {
    const result = await this.db.query(
      `SELECT * FROM artifact_version_tracking
       WHERE pipeline_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [pipelineId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * 根据 Commit SHA 查找制品版本（代码溯源）
   */
  async findByCommitSha(commitSha: string): Promise<ArtifactVersion[]> {
    const result = await this.db.query(
      `SELECT * FROM artifact_version_tracking
       WHERE commit_sha = $1
       ORDER BY created_at DESC`,
      [commitSha],
    );
    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  /**
   * 构建追溯链：从制品版本回溯到 PipelineRun 和部署记录
   *
   * 联合查询 artifact_version_tracking + pipeline_runs + deployments
   * 返回完整的代码 -> 构建 -> 部署链路
   */
  async findTraceabilityChain(versionId: string): Promise<TraceabilityChain | undefined> {
    // 1) 查找制品版本
    const versionResult = await this.db.query(
      `SELECT * FROM artifact_version_tracking WHERE id = $1`,
      [versionId],
    );
    if (versionResult.rows.length === 0) return undefined;

    const version = this.mapRowToEntity(versionResult.rows[0]);

    // 2) 查找关联的 PipelineRun
    const runResult = await this.db.query(
      `SELECT id, pipeline_id, trigger_type as "triggerType", status,
              started_at as "startedAt", completed_at as "completedAt", context
       FROM pipeline_runs
       WHERE id = $1`,
      [version.runId],
    );
    const pipelineRun = runResult.rows.length > 0 ? runResult.rows[0] : undefined;

    // 3) 查找关联的部署记录
    const deployResult = await this.db.query(
      `SELECT id, environment, status,
              started_at as "deployedAt", deployed_by as "deployedBy"
       FROM deployments
       WHERE pipeline_run_id = $1
       ORDER BY started_at DESC`,
      [version.runId],
    );
    const deployments = deployResult.rows.map((row: any) => ({
      id: row.id,
      environment: row.environment,
      status: row.status,
      deployedAt: row.deployedAt,
      deployedBy: row.deployedBy,
    }));

    return {
      version,
      pipelineRun: pipelineRun ? {
        id: pipelineRun.id,
        pipelineId: pipelineRun.pipeline_id,
        triggerType: pipelineRun.triggerType,
        status: pipelineRun.status,
        startedAt: pipelineRun.startedAt,
        completedAt: pipelineRun.completedAt,
        context: pipelineRun.context,
      } : undefined,
      deployments,
    };
  }

  /**
   * 获取某个 Pipeline 的部署历史（所有版本及其部署记录）
   */
  async getDeploymentHistory(pipelineId: string, limit: number = 20): Promise<DeploymentHistory> {
    // 获取该 Pipeline 的所有制品版本
    const versions = await this.findByPipelineId(pipelineId, limit);

    const versionHistories = await Promise.all(
      versions.map(async (v) => {
        // 查找每个版本关联的部署
        const deployResult = await this.db.query(
          `SELECT d.environment, d.status,
                  d.started_at as "deployedAt", d.deployed_by as "deployedBy"
           FROM deployments d
           JOIN pipeline_runs pr ON d.pipeline_run_id = pr.id
           WHERE pr.pipeline_id = $1
           AND EXISTS (
             SELECT 1 FROM artifact_version_tracking avt
             WHERE avt.run_id = pr.id AND avt.version = $2
           )
           ORDER BY d.started_at DESC`,
          [pipelineId, v.version],
        );

        return {
          version: v.version,
          commitSha: v.commitSha,
          branch: v.branch,
          createdAt: v.createdAt,
          deployments: deployResult.rows.map((row: any) => ({
            environment: row.environment,
            status: row.status,
            deployedAt: row.deployedAt,
            deployedBy: row.deployedBy,
          })),
        };
      }),
    );

    return {
      pipelineId,
      versions: versionHistories,
    };
  }

  /**
   * 获取两个版本之间的差异
   */
  async getVersionDiff(
    pipelineId: string,
    versionA: string,
    versionB: string,
  ): Promise<VersionDiff | undefined> {
    const [resultA, resultB] = await Promise.all([
      this.findByVersion(pipelineId, versionA),
      this.findByVersion(pipelineId, versionB),
    ]);

    if (!resultA || !resultB) return undefined;

    const metadataA = resultA.metadata || {};
    const metadataB = resultB.metadata || {};

    const allKeys = new Set([...Object.keys(metadataA), ...Object.keys(metadataB)]);
    const metadataAdded: string[] = [];
    const metadataRemoved: string[] = [];
    const metadataChanged: Array<{ key: string; oldValue: string; newValue: string }> = [];

    for (const key of allKeys) {
      const inA = key in metadataA;
      const inB = key in metadataB;
      if (inA && !inB) {
        metadataRemoved.push(key);
      } else if (!inA && inB) {
        metadataAdded.push(key);
      } else if (metadataA[key] !== metadataB[key]) {
        metadataChanged.push({
          key,
          oldValue: metadataA[key],
          newValue: metadataB[key],
        });
      }
    }

    return {
      pipelineId,
      versionA,
      versionB,
      changes: {
        commitDiff: {
          from: resultA.commitSha,
          to: resultB.commitSha,
        },
        branchDiff: {
          from: resultA.branch,
          to: resultB.branch,
        },
        metadataAdded,
        metadataRemoved,
        metadataChanged,
      },
    };
  }

  /**
   * 高级查询：支持多条件组合
   */
  async findWithFilters(options: ArtifactVersionQueryOptions): Promise<{ versions: ArtifactVersion[]; total: number }> {
    let query = `SELECT * FROM artifact_version_tracking WHERE 1=1`;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options.tenantId) {
      query += ` AND tenant_id = $${paramIndex}`;
      params.push(options.tenantId);
      paramIndex++;
    }
    if (options.pipelineId) {
      query += ` AND pipeline_id = $${paramIndex}`;
      params.push(options.pipelineId);
      paramIndex++;
    }
    if (options.runId) {
      query += ` AND run_id = $${paramIndex}`;
      params.push(options.runId);
      paramIndex++;
    }
    if (options.commitSha) {
      query += ` AND commit_sha = $${paramIndex}`;
      params.push(options.commitSha);
      paramIndex++;
    }
    if (options.branch) {
      query += ` AND branch = $${paramIndex}`;
      params.push(options.branch);
      paramIndex++;
    }
    if (options.version) {
      query += ` AND version = $${paramIndex}`;
      params.push(options.version);
      paramIndex++;
    }
    if (options.artifactName) {
      query += ` AND artifact_name = $${paramIndex}`;
      params.push(options.artifactName);
      paramIndex++;
    }

    const limit = options.limit || 50;
    const offset = options.offset || 0;
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    const versions = result.rows.map((row: any) => this.mapRowToEntity(row));

    // 获取总数
    const countQuery = `SELECT COUNT(*) as count FROM artifact_version_tracking WHERE 1=1` +
      query.slice(query.indexOf('WHERE 1=1'), query.indexOf(' ORDER BY'));
    const countResult = await this.db.query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0].count, 10);

    return { versions, total };
  }

  protected mapRowToEntity(row: any): ArtifactVersion {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      pipelineId: row.pipeline_id,
      runId: row.run_id,
      stageName: row.stage_name,
      artifactName: row.artifact_name,
      version: row.version,
      commitSha: row.commit_sha || undefined,
      branch: row.branch || undefined,
      metadata: row.metadata || {},
      storagePath: row.storage_path,
      createdAt: row.created_at,
    };
  }
}
