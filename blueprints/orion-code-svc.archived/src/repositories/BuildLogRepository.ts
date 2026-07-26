/**
 * Build Log Repository - PostgreSQL 数据访问层
 */

import { Pool } from 'pg';

type DatabasePool = Pool | { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

export interface BuildLogRecord {
  id: string;
  build_id: string;
  project_id: string | null;
  stage: string;
  log_content: string;
  created_at: Date;
}

export class BuildLogRepository {
  constructor(private pool: DatabasePool) {}

  async create(input: Record<string, unknown>): Promise<BuildLogRecord> {
    const result = await this.pool.query(
      'INSERT INTO build_logs DEFAULT VALUES RETURNING *'
    );
    return result.rows[0];
  }

  async findByBuildId(buildId: string): Promise<BuildLogRecord[]> {
    const result = await this.pool.query(
      'SELECT * FROM build_logs WHERE build_id = $1',
      [buildId]
    );
    return result.rows;
  }
}
