/**
 * Test Report Repository - PostgreSQL 数据访问层
 */

import { Pool } from 'pg';

type DatabasePool = Pool | { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

export interface TestReportRecord {
  id: string;
  run_id: string;
  stage_id: string;
  task_id: string;
  format: string;
  total_tests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration_ms: number;
  created_at: Date;
}

export class PostgresTestReportRepository {
  constructor(private pool: DatabasePool) {}

  async create(input: Record<string, unknown>): Promise<TestReportRecord> {
    const result = await this.pool.query(
      'INSERT INTO test_reports DEFAULT VALUES RETURNING *'
    );
    return result.rows[0];
  }

  async findById(id: string): Promise<TestReportRecord | null> {
    const result = await this.pool.query('SELECT * FROM test_reports WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findByRun(runId: string): Promise<TestReportRecord[]> {
    const result = await this.pool.query(
      'SELECT * FROM test_reports WHERE run_id = $1 ORDER BY created_at DESC',
      [runId]
    );
    return result.rows;
  }

  async findAll(options?: { runId?: string; stageId?: string; format?: string; limit?: number; offset?: number }): Promise<{ reports: TestReportRecord[]; total: number }> {
    const result = await this.pool.query('SELECT * FROM test_reports LIMIT 50');
    return { reports: result.rows, total: result.rows.length };
  }
}
