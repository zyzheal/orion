/**
 * BuildLogRepository
 * 构建日志数据访问层
 */

import { BaseRepository } from '../db/base-repository';

export interface BuildLogEntity {
  id: string;
  buildId: string;
  projectId?: string;
  stage: string;
  logContent?: string;
  logUrl?: string;
  createdAt: Date;
}

export class BuildLogRepository extends BaseRepository<BuildLogEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'build_logs');
  }

  async findByBuildId(buildId: string): Promise<BuildLogEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM build_logs WHERE build_id = $1 ORDER BY created_at ASC`,
      [buildId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByProjectId(projectId: string, limit?: number): Promise<BuildLogEntity[]> {
    const limitValue = limit ?? 50;
    const result = await this.db.query(
      `SELECT * FROM build_logs WHERE project_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [projectId, limitValue],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async appendLogContent(id: string, content: string): Promise<void> {
    await this.db.query(
      `UPDATE build_logs SET log_content = COALESCE(log_content, '') || $1 WHERE id = $2`,
      [content, id],
    );
  }

  protected mapRowToEntity(row: any): BuildLogEntity {
    return {
      id: row.id,
      buildId: row.build_id,
      projectId: row.project_id,
      stage: row.stage,
      logContent: row.log_content,
      logUrl: row.log_url,
      createdAt: row.created_at,
    };
  }
}
