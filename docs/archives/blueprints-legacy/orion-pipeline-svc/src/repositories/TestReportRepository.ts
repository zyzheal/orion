/**
 * TestReportRepository — 测试报告持久化数据访问层 (GAP-CN-07)
 *
 * 负责 test_reports 和 test_cases 表的 CRUD 操作，
 * 存储测试执行结果及其包含的单个测试用例详情。
 */

import { Pool } from 'pg';
import { ParsedTestCase, TestCase, TestCaseCreateInput, TestReportCreateInput } from '../models/TestReport';

export { ParsedTestCase, TestCase, TestCaseCreateInput, TestReportCreateInput } from '../models/TestReport';

/**
 * 测试报告实体（从数据库行映射）
 */
export interface TestReportEntity {
  id: string;
  runId: string;
  stageId: string;
  stageName: string;  // Alias for stageId, for compatibility with TestReport model
  taskId: string;
  format: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  coverageJson: Record<string, unknown> | null;
  createdAt: Date;
  testCases: TestCase[];
}

/**
 * PostgreSQL TestReportRepository 实现
 */
export class PostgresTestReportRepository {
  constructor(private pool: Pool) {}

  /**
   * 创建测试报告
   */
  async createReport(input: TestReportCreateInput): Promise<TestReportEntity> {
    return this.create(input);
  }

  /**
   * 批量创建测试用例
   */
  async createCases(cases: TestCaseCreateInput[]): Promise<void> {
    for (const tc of cases) {
      const className = tc.className || tc.classname || '';
      await this.pool.query(
        `INSERT INTO test_cases (
          id, report_id, name, class_name, status,
          duration_ms, error_message, stack_trace
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          crypto.randomUUID(),
          tc.reportId || '',
          tc.name,
          className,
          tc.status,
          tc.durationMs || tc.duration || null,
          tc.errorMessage || tc.failureMessage || null,
          tc.stackTrace || null,
        ],
      );
    }
  }

  /**
   * 按 ID 查找测试报告（别名，供服务层使用）
   */
  async getReportById(id: string): Promise<TestReportEntity | null> {
    return this.findById(id);
  }

  /**
   * 按报告 ID 查找测试用例（别名，供服务层使用）
   */
  async getCasesByReportId(reportId: string, _statusFilter?: string): Promise<TestCase[]> {
    const cases = await this.findTestCases(reportId);
    if (_statusFilter) {
      return cases.filter(tc => tc.status === _statusFilter);
    }
    return cases;
  }

  /**
   * 按 Run ID 查找测试报告（别名，供服务层使用）
   */
  async getReportsByRunId(runId: string): Promise<TestReportEntity[]> {
    return this.findByRunId(runId);
  }

  /**
   * 查询测试报告（供服务层 findReports 使用）
   */
  async findReports(options: { runId?: string; stageName?: string; format?: string }): Promise<{ reports: TestReportEntity[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options.runId) {
      conditions.push(`run_id = $${paramIndex}`);
      params.push(options.runId);
      paramIndex++;
    }
    if (options.stageName) {
      conditions.push(`stage_id = $${paramIndex}`);
      params.push(options.stageName);
      paramIndex++;
    }
    if (options.format) {
      conditions.push(`format = $${paramIndex}`);
      params.push(options.format);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `SELECT * FROM test_reports ${whereClause} ORDER BY created_at DESC`;
    const result = await this.pool.query(query, params);
    const reports = result.rows.map((row: any) => this.mapRowToEntity(row));

    // 加载每个报告的测试用例
    for (const report of reports) {
      report.testCases = await this.findTestCases(report.id);
    }

    const countQuery = `SELECT COUNT(*) as count FROM test_reports ${whereClause}`;
    const countResult = await this.pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    return { reports, total };
  }

  /**
   * 创建测试报告（含测试用例）
   */
  async create(input: TestReportCreateInput): Promise<TestReportEntity> {
    const id = crypto.randomUUID();
    const now = new Date();

    // 插入测试报告
    const reportQuery = `
      INSERT INTO test_reports (
        id, run_id, stage_id, task_id, format,
        total_tests, passed, failed, skipped, duration_ms, coverage_json, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const result = await this.pool.query(reportQuery, [
      id,
      input.runId,
      input.stageId || input.runId, // fallback to runId if stageId not provided
      input.taskId || id,          // fallback to report id if taskId not provided
      input.format,
      input.totalTests,
      input.passed,
      input.failed,
      input.skipped,
      input.durationMs,
      null, // coverage_json
      now,
    ]);

    if (result.rows.length === 0) {
      throw new Error('INSERT into test_reports returned no rows');
    }

    const report = this.mapRowToEntity(result.rows[0]);

    // 插入测试用例（如果有）
    if (input.testCases && input.testCases.length > 0) {
      await this.insertTestCases(id, input.testCases);
      report.testCases = input.testCases;
    } else {
      report.testCases = [];
    }

    return report;
  }

  /**
   * 按 ID 查找测试报告
   */
  async findById(id: string): Promise<TestReportEntity | null> {
    const query = 'SELECT * FROM test_reports WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    if (result.rows.length === 0) return null;

    const report = this.mapRowToEntity(result.rows[0]);
    report.testCases = await this.findTestCases(id);
    return report;
  }

  /**
   * 按 Run ID 查找所有测试报告
   */
  async findByRunId(runId: string): Promise<TestReportEntity[]> {
    const query = `
      SELECT * FROM test_reports
      WHERE run_id = $1
      ORDER BY created_at DESC
    `;
    const result = await this.pool.query(query, [runId]);
    const reports = result.rows.map((row: any) => this.mapRowToEntity(row));

    // 加载每个报告的测试用例
    for (const report of reports) {
      report.testCases = await this.findTestCases(report.id);
    }

    return reports;
  }

  /**
   * 按 Run ID 和 Stage 名称查找测试报告
   */
  async findByRunIdAndStage(runId: string, stageId: string): Promise<TestReportEntity | null> {
    const query = `
      SELECT * FROM test_reports
      WHERE run_id = $1 AND stage_id = $2
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const result = await this.pool.query(query, [runId, stageId]);
    if (result.rows.length === 0) return null;

    const report = this.mapRowToEntity(result.rows[0]);
    report.testCases = await this.findTestCases(report.id);
    return report;
  }

  /**
   * 查找报告关联的测试用例
   */
  async findTestCases(reportId: string): Promise<TestCase[]> {
    const query = `
      SELECT * FROM test_cases
      WHERE report_id = $1
      ORDER BY id ASC
    `;
    const result = await this.pool.query(query, [reportId]);
    return result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      classname: row.class_name || '',
      className: row.class_name || undefined,
      status: row.status,
      duration: row.duration_ms || undefined,
      durationMs: row.duration_ms || undefined,
      errorMessage: row.error_message || undefined,
      failureMessage: row.error_message || undefined,
      stackTrace: row.stack_trace || undefined,
    }));
  }

  /**
   * 插入测试用例
   */
  async insertTestCases(reportId: string, cases: ParsedTestCase[]): Promise<void> {
    if (cases.length === 0) return;

    for (let i = 0; i < cases.length; i++) {
      const tc = cases[i];
      const className = tc.className || tc.classname || '';

      await this.pool.query(
        `INSERT INTO test_cases (
          id, report_id, name, class_name, status,
          duration_ms, error_message, stack_trace
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          crypto.randomUUID(),
          reportId,
          tc.name,
          className,
          tc.status,
          tc.durationMs || tc.duration || null,
          tc.errorMessage || tc.failureMessage || null,
          tc.stackTrace || null,
        ],
      );
    }
  }

  /**
   * 获取汇总统计：某 Run 的测试总结果
   */
  async getSummary(runId: string): Promise<{
    totalReports: number;
    totalTests: number;
    totalPassed: number;
    totalFailed: number;
    totalSkipped: number;
    totalDurationMs: number;
  }> {
    const query = `
      SELECT
        COUNT(*) as total_reports,
        COALESCE(SUM(total_tests), 0) as total_tests,
        COALESCE(SUM(passed), 0) as total_passed,
        COALESCE(SUM(failed), 0) as total_failed,
        COALESCE(SUM(skipped), 0) as total_skipped,
        COALESCE(SUM(duration_ms), 0) as total_duration_ms
      FROM test_reports
      WHERE run_id = $1
    `;
    const result = await this.pool.query(query, [runId]);
    const row = result.rows[0];
    return {
      totalReports: parseInt(row.total_reports, 10),
      totalTests: parseInt(row.total_tests, 10),
      totalPassed: parseInt(row.total_passed, 10),
      totalFailed: parseInt(row.total_failed, 10),
      totalSkipped: parseInt(row.total_skipped, 10),
      totalDurationMs: parseInt(row.total_duration_ms, 10),
    };
  }

  /**
   * 更新测试报告
   */
  async update(id: string, input: Partial<TestReportEntity>): Promise<TestReportEntity | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.format !== undefined) {
      fields.push(`format = $${paramIndex}`);
      values.push(input.format);
      paramIndex++;
    }
    if (input.totalTests !== undefined) {
      fields.push(`total_tests = $${paramIndex}`);
      values.push(input.totalTests);
      paramIndex++;
    }
    if (input.passed !== undefined) {
      fields.push(`passed = $${paramIndex}`);
      values.push(input.passed);
      paramIndex++;
    }
    if (input.failed !== undefined) {
      fields.push(`failed = $${paramIndex}`);
      values.push(input.failed);
      paramIndex++;
    }
    if (input.skipped !== undefined) {
      fields.push(`skipped = $${paramIndex}`);
      values.push(input.skipped);
      paramIndex++;
    }
    if (input.durationMs !== undefined) {
      fields.push(`duration_ms = $${paramIndex}`);
      values.push(input.durationMs);
      paramIndex++;
    }
    if (input.coverageJson !== undefined) {
      fields.push(`coverage_json = $${paramIndex}`);
      values.push(JSON.stringify(input.coverageJson));
      paramIndex++;
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const query = `
      UPDATE test_reports
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    if (result.rows.length === 0) return null;

    const report = this.mapRowToEntity(result.rows[0]);
    report.testCases = await this.findTestCases(id);
    return report;
  }

  /**
   * 删除测试报告（级联删除测试用例）
   */
  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM test_reports WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * 将数据库行映射为 TestReportEntity
   */
  private mapRowToEntity(row: any): TestReportEntity {
    let coverageJson: Record<string, unknown> | null = null;
    if (row.coverage_json) {
      try {
        coverageJson = typeof row.coverage_json === 'string'
          ? JSON.parse(row.coverage_json)
          : row.coverage_json;
      } catch {
        coverageJson = null;
      }
    }

    return {
      id: row.id,
      runId: row.run_id,
      stageId: row.stage_id,
      stageName: row.stage_id || '',  // Alias for compatibility with TestReport model
      taskId: row.task_id,
      format: row.format,
      totalTests: row.total_tests ?? 0,
      passed: row.passed ?? 0,
      failed: row.failed ?? 0,
      skipped: row.skipped ?? 0,
      durationMs: row.duration_ms ?? 0,
      coverageJson,
      createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
      testCases: [],
    };
  }
}

// Backward-compatible export alias
export const TestReportRepository = PostgresTestReportRepository;
export type TestReportRepository = PostgresTestReportRepository;
