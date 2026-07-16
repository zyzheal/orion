/**
 * ArtifactRecordRepository - Pipeline Artifact 持久化存储
 *
 * 将 ArtifactService 的内存索引 (Map<runId, Map<stageId, Map<name, ArtifactRecord>>>)
 * 迁移到 PostgreSQL，支持 artifact 元数据的持久化查询。
 */

import { BaseRepository, FindAllOptions, FindAllResult } from '../db/base-repository';
import { OrionError, ErrorCode } from '../errors';

/**
 * Artifact 记录实体（数据库映射）
 */
export interface ArtifactRecordEntity {
  id: string;
  tenantId: string;
  runId: string;
  stageId: string;
  name: string;
  size: number;
  mimeType?: string;
  filePath: string;
  uploadedBy?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ArtifactRecordRepository extends BaseRepository<ArtifactRecordEntity> {
  constructor(db: { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'artifact_records');
  }

  /**
   * 创建 artifact 记录
   */
  async createRecord(data: {
    id: string;
    tenantId: string;
    runId: string;
    stageId: string;
    name: string;
    size: number;
    mimeType?: string;
    filePath: string;
    uploadedBy?: string;
    description?: string;
  }): Promise<ArtifactRecordEntity> {
    const result = await this.db.query(
      `INSERT INTO artifact_records (id, tenant_id, run_id, stage_id, name, size, mime_type, file_path, uploaded_by, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        data.id,
        data.tenantId,
        data.runId,
        data.stageId,
        data.name,
        data.size,
        data.mimeType || null,
        data.filePath,
        data.uploadedBy || null,
        data.description || null,
      ],
    );
    if (result.rows.length === 0) {
      throw new OrionError('INSERT into artifact_records returned no rows', ErrorCode.OPERATION_FAILED);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * 按 runId 查找所有 artifact
   */
  async findByRunId(runId: string): Promise<ArtifactRecordEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM artifact_records WHERE run_id = $1 ORDER BY created_at DESC`,
      [runId],
    );
    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  /**
   * 按 runId + stageId 查找 artifact
   */
  async findByStage(runId: string, stageId: string): Promise<ArtifactRecordEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM artifact_records WHERE run_id = $1 AND stage_id = $2 ORDER BY created_at DESC`,
      [runId, stageId],
    );
    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  /**
   * 按 runId + stageId + name 查找单个 artifact
   */
  async findByName(runId: string, stageId: string, name: string): Promise<ArtifactRecordEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM artifact_records WHERE run_id = $1 AND stage_id = $2 AND name = $3`,
      [runId, stageId, name],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * 按 tenantId 查找 artifact
   */
  async findByTenantId(tenantId: string, options?: FindAllOptions): Promise<FindAllResult<ArtifactRecordEntity>> {
    return this.findAll({
      ...options,
      where: { tenant_id: tenantId, ...options?.where },
    });
  }

  /**
   * 删除某个 run 的所有 artifact 记录
   */
  async deleteByRunId(runId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM artifact_records WHERE run_id = $1`,
      [runId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * 删除过期的 artifact 记录
   */
  async deleteExpired(maxAgeMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeMs);
    const result = await this.db.query(
      `DELETE FROM artifact_records WHERE created_at < $1`,
      [cutoff],
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): ArtifactRecordEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      runId: row.run_id,
      stageId: row.stage_id,
      name: row.name,
      size: row.size,
      mimeType: row.mime_type || undefined,
      filePath: row.file_path,
      uploadedBy: row.uploaded_by || undefined,
      description: row.description || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
