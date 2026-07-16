/**
 * TestReportRepository — 测试报告数据访问层
 *
 * PostgreSQL Repository 模式，支持测试报告和测试用例的 CRUD。
 */

import {
  TestReport,
  TestReportCreateInput,
  TestReportQueryOptions,
  TestCase,
  TestCaseCreateInput,
  createTestReport,
  createTestCase,
} from '../models/TestReport';

export interface TestReportRepository {
  /** 创建测试报告 */
  createReport(input: TestReportCreateInput): Promise<TestReport>;
  /** 查询测试报告 */
  findReports(options: TestReportQueryOptions): Promise<{ reports: TestReport[]; total: number }>;
  /** 获取报告详情 */
  getReportById(id: string): Promise<TestReport | null>;
  /** 创建测试用例 */
  createCase(input: TestCaseCreateInput): Promise<TestCase>;
  /** 批量创建测试用例 */
  createCases(inputs: TestCaseCreateInput[]): Promise<void>;
  /** 获取报告的测试用例 */
  getCasesByReportId(reportId: string, statusFilter?: string): Promise<TestCase[]>;
  /** 按 RunId 获取所有报告 */
  getReportsByRunId(runId: string): Promise<TestReport[]>;
}

export class PostgresTestReportRepository implements TestReportRepository {
  constructor(private db: any) {}

  async createReport(input: TestReportCreateInput): Promise<TestReport> {
    const report = createTestReport(input);

    const query = `
      INSERT INTO test_reports (
        id, run_id, stage_id, task_id, format, total_tests,
        passed, failed, skipped, duration_ms, coverage_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `;

    await this.db.query(query, [
      report.id,
      report.runId,
      report.stageId,
      report.taskId,
      report.format,
      report.totalTests,
      report.passed,
      report.failed,
      report.skipped,
      report.durationMs,
      report.coverage ? JSON.stringify(report.coverage) : null,
    ]);

    return report;
  }

  async findReports(options: TestReportQueryOptions): Promise<{ reports: TestReport[]; total: number }> {
    let query = 'SELECT * FROM test_reports WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (options.runId) {
      query += ` AND run_id = $${paramIndex++}`;
      params.push(options.runId);
    }
    if (options.stageId) {
      query += ` AND stage_id = $${paramIndex++}`;
      params.push(options.stageId);
    }
    if (options.format) {
      query += ` AND format = $${paramIndex++}`;
      params.push(options.format);
    }

    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = await this.db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(options.limit || 50);
    params.push(options.offset || 0);

    const result = await this.db.query(query, params);

    const reports: TestReport[] = result.rows.map((row: any) => ({
      id: row.id,
      runId: row.run_id,
      stageId: row.stage_id,
      taskId: row.task_id,
      format: row.format,
      totalTests: row.total_tests,
      passed: row.passed,
      failed: row.failed,
      skipped: row.skipped,
      durationMs: row.duration_ms,
      coverage: row.coverage_json ? JSON.parse(row.coverage_json) : undefined,
      createdAt: new Date(row.created_at),
    }));

    return { reports, total };
  }

  async getReportById(id: string): Promise<TestReport | null> {
    const query = 'SELECT * FROM test_reports WHERE id = $1';
    const result = await this.db.query(query, [id]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      runId: row.run_id,
      stageId: row.stage_id,
      taskId: row.task_id,
      format: row.format,
      totalTests: row.total_tests,
      passed: row.passed,
      failed: row.failed,
      skipped: row.skipped,
      durationMs: row.duration_ms,
      coverage: row.coverage_json ? JSON.parse(row.coverage_json) : undefined,
      createdAt: new Date(row.created_at),
    };
  }

  async createCase(input: TestCaseCreateInput): Promise<TestCase> {
    const testCase = createTestCase(input);

    const query = `
      INSERT INTO test_cases (
        id, report_id, name, class_name, status, duration_ms,
        error_message, stack_trace
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    await this.db.query(query, [
      testCase.id,
      testCase.reportId,
      testCase.name,
      testCase.className || null,
      testCase.status,
      testCase.durationMs || null,
      testCase.errorMessage || null,
      testCase.stackTrace || null,
    ]);

    return testCase;
  }

  async createCases(inputs: TestCaseCreateInput[]): Promise<void> {
    if (inputs.length === 0) return;

    const values: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const input of inputs) {
      const tc = createTestCase(input);
      const offset = values.length;
      values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7})`);
      params.push(tc.id, tc.reportId, tc.name, tc.className || null, tc.status, tc.durationMs || null, tc.errorMessage || null, tc.stackTrace || null);
      paramIndex += 8;
    }

    const query = `
      INSERT INTO test_cases (
        id, report_id, name, class_name, status, duration_ms,
        error_message, stack_trace
      ) VALUES ${values.join(', ')}
    `;

    await this.db.query(query, params);
  }

  async getCasesByReportId(reportId: string, statusFilter?: string): Promise<TestCase[]> {
    let query = 'SELECT * FROM test_cases WHERE report_id = $1';
    const params: any[] = [reportId];

    if (statusFilter) {
      query += ` AND status = $2`;
      params.push(statusFilter);
    }

    query += ' ORDER BY name';

    const result = await this.db.query(query, params);

    return result.rows.map((row: any) => ({
      id: row.id,
      reportId: row.report_id,
      name: row.name,
      className: row.class_name,
      status: row.status,
      durationMs: row.duration_ms,
      errorMessage: row.error_message,
      stackTrace: row.stack_trace,
    }));
  }

  async getReportsByRunId(runId: string): Promise<TestReport[]> {
    const query = 'SELECT * FROM test_reports WHERE run_id = $1 ORDER BY created_at DESC';
    const result = await this.db.query(query, [runId]);

    return result.rows.map((row: any) => ({
      id: row.id,
      runId: row.run_id,
      stageId: row.stage_id,
      taskId: row.task_id,
      format: row.format,
      totalTests: row.total_tests,
      passed: row.passed,
      failed: row.failed,
      skipped: row.skipped,
      durationMs: row.duration_ms,
      coverage: row.coverage_json ? JSON.parse(row.coverage_json) : undefined,
      createdAt: new Date(row.created_at),
    }));
  }
}
