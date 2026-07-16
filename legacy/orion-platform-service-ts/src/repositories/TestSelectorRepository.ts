import { OrionError, ErrorCode } from '../errors';
/**
 * Test Selector Repository - Test case, suite, and run data access layer
 *
 * Manages test cases, test suites, test runs, and related data for smart test selection
 */

// ==================== Entities ====================

export interface TestCaseEntity {
  id: string;
  report_id?: string;
  name: string;
  class_name?: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  duration_ms?: number;
  error_message?: string;
  stack_trace?: string;
  suite_name?: string;
  tags?: string[];
  flaky?: boolean;
  flaky_count?: number;
  last_run_at?: Date;
  pipeline_run_id?: string;
  artifact_id?: string;
  environment?: string;
}

export interface TestSuiteEntity {
  id: string;
  name: string;
  description?: string;
  total_tests: number;
  passed: number;
  failed: number;
  skipped: number;
  tags?: string[];
  created_at: Date;
  updated_at: Date;
}

export interface TestRunEntity {
  id: string;
  suite_id?: string;
  pipeline_run_id?: string;
  artifact_id?: string;
  environment?: string;
  status: 'running' | 'passed' | 'failed' | 'cancelled';
  total_tests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration_ms: number;
  coverage_rate?: number;
  triggered_by?: string;
  commit_sha?: string;
  branch?: string;
  started_at: Date;
  completed_at?: Date;
}

export interface TestTagEntity {
  id: string;
  name: string;
  color: string;
  description?: string;
  created_at: Date;
}

export interface TestCoverageEntity {
  id: string;
  test_run_id: string;
  artifact_id?: string;
  line_coverage?: number;
  branch_coverage?: number;
  files_covered?: number;
  files_total?: number;
  coverage_json?: Record<string, unknown>;
  created_at: Date;
}

interface FindAllResult<T> {
  data: T[];
  total: number;
}

// ==================== Repositories ====================

export class TestCaseRepository {
  constructor(private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (!db || typeof db.query !== 'function') {
      throw new OrionError('Invalid database connection provided to TestCaseRepository', ErrorCode.VALIDATION_ERROR);
    }
  }

  private mapRowToEntity(row: any): TestCaseEntity {
    return {
      id: row.id,
      report_id: row.report_id,
      name: row.name,
      class_name: row.class_name,
      status: row.status,
      duration_ms: row.duration_ms,
      error_message: row.error_message,
      stack_trace: row.stack_trace,
      suite_name: row.suite_name,
      tags: row.tags,
      flaky: row.flaky,
      flaky_count: row.flaky_count,
      last_run_at: row.last_run_at,
      pipeline_run_id: row.pipeline_run_id,
      artifact_id: row.artifact_id,
      environment: row.environment,
    };
  }

  async findAll(page: number = 1, limit: number = 50): Promise<FindAllResult<TestCaseEntity>> {
    const offset = (page - 1) * limit;
    const [dataResult, countResult] = await Promise.all([
      this.db.query('SELECT * FROM test_cases ORDER BY name LIMIT $1 OFFSET $2', [limit, offset]),
      this.db.query('SELECT COUNT(*) as total FROM test_cases')
    ]);
    return {
      data: dataResult.rows.map(row => this.mapRowToEntity(row)),
      total: parseInt(countResult.rows[0]?.total || '0', 10)
    };
  }

  async findById(id: string): Promise<TestCaseEntity | null> {
    const result = await this.db.query('SELECT * FROM test_cases WHERE id = $1', [id]);
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async findBySuite(suiteName: string): Promise<TestCaseEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM test_cases WHERE suite_name = $1 ORDER BY name',
      [suiteName]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByStatus(status: string): Promise<TestCaseEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM test_cases WHERE status = $1 ORDER BY last_run_at DESC',
      [status]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findFlaky(): Promise<TestCaseEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM test_cases WHERE flaky = true ORDER BY flaky_count DESC'
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByPipelineRun(pipelineRunId: string): Promise<TestCaseEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM test_cases WHERE pipeline_run_id = $1 ORDER BY name',
      [pipelineRunId]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByArtifact(artifactId: string): Promise<TestCaseEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM test_cases WHERE artifact_id = $1 ORDER BY name',
      [artifactId]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async create(data: Partial<TestCaseEntity>): Promise<TestCaseEntity> {
    const result = await this.db.query(
      `INSERT INTO test_cases (name, class_name, status, duration_ms, error_message, stack_trace, suite_name, tags, flaky, flaky_count, last_run_at, pipeline_run_id, artifact_id, environment)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [data.name, data.class_name, data.status, data.duration_ms, data.error_message, data.stack_trace, data.suite_name, JSON.stringify(data.tags || []), data.flaky, data.flaky_count, data.last_run_at, data.pipeline_run_id, data.artifact_id, data.environment]
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateFlakyStatus(id: string, flaky: boolean, count: number): Promise<void> {
    await this.db.query(
      'UPDATE test_cases SET flaky = $1, flaky_count = $2 WHERE id = $3',
      [flaky, count, id]
    );
  }
}

export class TestSuiteRepository {
  constructor(private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (!db || typeof db.query !== 'function') {
      throw new OrionError('Invalid database connection provided to TestSuiteRepository', ErrorCode.VALIDATION_ERROR);
    }
  }

  private mapRowToEntity(row: any): TestSuiteEntity {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      total_tests: row.total_tests,
      passed: row.passed,
      failed: row.failed,
      skipped: row.skipped,
      tags: row.tags,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async findAll(): Promise<FindAllResult<TestSuiteEntity>> {
    const result = await this.db.query('SELECT * FROM test_suites ORDER BY name');
    return { data: result.rows.map(row => this.mapRowToEntity(row)), total: result.rows.length };
  }

  async findAllWithStats(): Promise<TestSuiteEntity[]> {
    const result = await this.db.query(`
      SELECT ts.*,
             COALESCE(tc.total, 0) as total_tests,
             COALESCE(tc.passed, 0) as passed,
             COALESCE(tc.failed, 0) as failed,
             COALESCE(tc.skipped, 0) as skipped
      FROM test_suites ts
      LEFT JOIN (
        SELECT suite_name,
               COUNT(*) as total,
               COUNT(*) FILTER (WHERE status = 'passed') as passed,
               COUNT(*) FILTER (WHERE status = 'failed') as failed,
               COUNT(*) FILTER (WHERE status = 'skipped') as skipped
        FROM test_cases
        GROUP BY suite_name
      ) tc ON ts.name = tc.suite_name
      ORDER BY ts.name
    `);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByName(name: string): Promise<TestSuiteEntity | null> {
    const result = await this.db.query(
      'SELECT * FROM test_suites WHERE name = $1',
      [name]
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async findById(id: string): Promise<TestSuiteEntity | null> {
    const result = await this.db.query(
      'SELECT * FROM test_suites WHERE id = $1',
      [id]
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async updateStats(id: string): Promise<void> {
    await this.db.query(`
      UPDATE test_suites ts SET
        total_tests = COALESCE(tc.total, 0),
        passed = COALESCE(tc.passed, 0),
        failed = COALESCE(tc.failed, 0),
        skipped = COALESCE(tc.skipped, 0),
        updated_at = now()
      FROM (
        SELECT suite_name,
               COUNT(*) as total,
               COUNT(*) FILTER (WHERE status = 'passed') as passed,
               COUNT(*) FILTER (WHERE status = 'failed') as failed,
               COUNT(*) FILTER (WHERE status = 'skipped') as skipped
        FROM test_cases
        WHERE suite_name = (SELECT name FROM test_suites WHERE id = $1)
        GROUP BY suite_name
      ) tc
      WHERE ts.id = $1
    `, [id]);
  }
}

export class TestRunRepository {
  constructor(private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (!db || typeof db.query !== 'function') {
      throw new OrionError('Invalid database connection provided to TestRunRepository', ErrorCode.VALIDATION_ERROR);
    }
  }

  private mapRowToEntity(row: any): TestRunEntity {
    return {
      id: row.id,
      suite_id: row.suite_id,
      pipeline_run_id: row.pipeline_run_id,
      artifact_id: row.artifact_id,
      environment: row.environment,
      status: row.status,
      total_tests: row.total_tests,
      passed: row.passed,
      failed: row.failed,
      skipped: row.skipped,
      duration_ms: row.duration_ms,
      coverage_rate: row.coverage_rate,
      triggered_by: row.triggered_by,
      commit_sha: row.commit_sha,
      branch: row.branch,
      started_at: row.started_at,
      completed_at: row.completed_at,
    };
  }

  async findAll(): Promise<FindAllResult<TestRunEntity>> {
    const result = await this.db.query('SELECT * FROM test_runs ORDER BY started_at DESC');
    return { data: result.rows.map(row => this.mapRowToEntity(row)), total: result.rows.length };
  }

  async findBySuite(suiteId: string): Promise<TestRunEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM test_runs WHERE suite_id = $1 ORDER BY started_at DESC',
      [suiteId]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByPipelineRun(pipelineRunId: string): Promise<TestRunEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM test_runs WHERE pipeline_run_id = $1 ORDER BY started_at DESC',
      [pipelineRunId]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findLatestByEnvironment(environment: string): Promise<TestRunEntity | null> {
    const result = await this.db.query(
      'SELECT * FROM test_runs WHERE environment = $1 ORDER BY started_at DESC LIMIT 1',
      [environment]
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async create(data: Partial<TestRunEntity>): Promise<TestRunEntity> {
    const result = await this.db.query(
      `INSERT INTO test_runs (suite_id, pipeline_run_id, artifact_id, environment, status, total_tests, passed, failed, skipped, duration_ms, coverage_rate, triggered_by, commit_sha, branch)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [data.suite_id, data.pipeline_run_id, data.artifact_id, data.environment, data.status, data.total_tests, data.passed, data.failed, data.skipped, data.duration_ms, data.coverage_rate, data.triggered_by, data.commit_sha, data.branch]
    );
    return this.mapRowToEntity(result.rows[0]);
  }
}

export class TestTagRepository {
  constructor(private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (!db || typeof db.query !== 'function') {
      throw new OrionError('Invalid database connection provided to TestTagRepository', ErrorCode.VALIDATION_ERROR);
    }
  }

  private mapRowToEntity(row: any): TestTagEntity {
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      description: row.description,
      created_at: row.created_at,
    };
  }

  async findAll(): Promise<FindAllResult<TestTagEntity>> {
    const result = await this.db.query('SELECT * FROM test_tags ORDER BY name');
    return { data: result.rows.map(row => this.mapRowToEntity(row)), total: result.rows.length };
  }

  async findByName(name: string): Promise<TestTagEntity | null> {
    const result = await this.db.query(
      'SELECT * FROM test_tags WHERE name = $1',
      [name]
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async findByTestCase(testCaseId: string): Promise<TestTagEntity[]> {
    const result = await this.db.query(`
      SELECT t.* FROM test_tags t
      JOIN test_case_tags tct ON t.id = tct.tag_id
      WHERE tct.test_case_id = $1
    `, [testCaseId]);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async addTagToTestCase(testCaseId: string, tagId: string): Promise<void> {
    await this.db.query(
      'INSERT INTO test_case_tags (test_case_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [testCaseId, tagId]
    );
  }

  async removeTagFromTestCase(testCaseId: string, tagId: string): Promise<void> {
    await this.db.query(
      'DELETE FROM test_case_tags WHERE test_case_id = $1 AND tag_id = $2',
      [testCaseId, tagId]
    );
  }
}

export class TestCoverageRepository {
  constructor(private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (!db || typeof db.query !== 'function') {
      throw new OrionError('Invalid database connection provided to TestCoverageRepository', ErrorCode.VALIDATION_ERROR);
    }
  }

  private mapRowToEntity(row: any): TestCoverageEntity {
    return {
      id: row.id,
      test_run_id: row.test_run_id,
      artifact_id: row.artifact_id,
      line_coverage: row.line_coverage,
      branch_coverage: row.branch_coverage,
      files_covered: row.files_covered,
      files_total: row.files_total,
      coverage_json: row.coverage_json,
      created_at: row.created_at,
    };
  }

  async findByTestRun(testRunId: string): Promise<TestCoverageEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM test_coverage WHERE test_run_id = $1',
      [testRunId]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByArtifact(artifactId: string): Promise<TestCoverageEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM test_coverage WHERE artifact_id = $1 ORDER BY created_at DESC',
      [artifactId]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async getLatestCoverage(artifactId: string): Promise<TestCoverageEntity | null> {
    const result = await this.db.query(
      'SELECT * FROM test_coverage WHERE artifact_id = $1 ORDER BY created_at DESC LIMIT 1',
      [artifactId]
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async create(data: Partial<TestCoverageEntity>): Promise<TestCoverageEntity> {
    const result = await this.db.query(
      `INSERT INTO test_coverage (test_run_id, artifact_id, line_coverage, branch_coverage, files_covered, files_total, coverage_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [data.test_run_id, data.artifact_id, data.line_coverage, data.branch_coverage, data.files_covered, data.files_total, JSON.stringify(data.coverage_json)]
    );
    return this.mapRowToEntity(result.rows[0]);
  }
}