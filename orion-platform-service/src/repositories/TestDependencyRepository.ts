/**
 * TestDependencyRepository
 * Data access layer for test dependency analysis data.
 * Replaces in-memory Maps in TestDependencyAnalyzer, TestSelectorService, and TestFailurePredictor.
 */

import { ErrorCode } from '../errors';
import { BaseRepository } from '../db/base-repository';
import { OrionError } from '../errors';

// ==================== Test Suite (Dependency Analyzer) ====================

export interface TestSuiteDependencyEntity {
  id: string;
  tenantId: string;
  name: string;
  filePath: string;
  testCount: number;
  avgDuration: number;
  passRate: number;
  lastRun: Date | null;
  sourceFiles: string[];
  created_at: Date;
  updated_at: Date;
}

export class TestSuiteDependencyRepository extends BaseRepository<TestSuiteDependencyEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'test_selector_suites');
  }

  async create(data: Omit<TestSuiteDependencyEntity, 'created_at' | 'updated_at'> & Partial<Pick<TestSuiteDependencyEntity, 'id'>>): Promise<TestSuiteDependencyEntity> {
    const columns = ['id', 'tenant_id', 'name', 'file_path', 'test_count', 'avg_duration', 'pass_rate', 'last_run', 'source_files'];
    const values = [data.id, data.tenantId, data.name, data.filePath, data.testCount, data.avgDuration, data.passRate, data.lastRun, JSON.stringify(data.sourceFiles)];

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, file_path = EXCLUDED.file_path, test_count = EXCLUDED.test_count,
        avg_duration = EXCLUDED.avg_duration, pass_rate = EXCLUDED.pass_rate, last_run = EXCLUDED.last_run,
        source_files = EXCLUDED.source_files, updated_at = NOW()
      RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError('OPERATION_FAILED', ErrorCode.DATABASE_ERROR);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenant(tenantId: string): Promise<TestSuiteDependencyEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async deleteByTenant(tenantId: string): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM ${this.tableName} WHERE tenant_id = $1`,
      [tenantId],
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): TestSuiteDependencyEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      filePath: row.file_path,
      testCount: row.test_count,
      avgDuration: row.avg_duration,
      passRate: row.pass_rate,
      lastRun: row.last_run,
      sourceFiles: row.source_files ?? [],
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

// ==================== Test Case (Dependency Analyzer) ====================

export interface TestCaseDependencyEntity {
  id: string;
  tenantId: string;
  suiteId: string;
  name: string;
  filePath: string;
  dependencies: unknown[];
  avgDuration: number;
  flakyScore: number;
  history: unknown[];
  created_at: Date;
  updated_at: Date;
}

export class TestCaseDependencyRepository extends BaseRepository<TestCaseDependencyEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'test_selector_cases');
  }

  async create(data: Omit<TestCaseDependencyEntity, 'created_at' | 'updated_at'> & Partial<Pick<TestCaseDependencyEntity, 'id'>>): Promise<TestCaseDependencyEntity> {
    const columns = ['id', 'tenant_id', 'suite_id', 'name', 'file_path', 'dependencies', 'avg_duration', 'flaky_score', 'history'];
    const values = [data.id, data.tenantId, data.suiteId, data.name, data.filePath, JSON.stringify(data.dependencies), data.avgDuration, data.flakyScore, JSON.stringify(data.history)];

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders})
      ON CONFLICT (id) DO UPDATE SET
        suite_id = EXCLUDED.suite_id, name = EXCLUDED.name, file_path = EXCLUDED.file_path,
        dependencies = EXCLUDED.dependencies, avg_duration = EXCLUDED.avg_duration,
        flaky_score = EXCLUDED.flaky_score, history = EXCLUDED.history, updated_at = NOW()
      RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError('OPERATION_FAILED', ErrorCode.DATABASE_ERROR);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async findBySuiteId(suiteId: string): Promise<TestCaseDependencyEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE suite_id = $1 ORDER BY created_at`,
      [suiteId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenant(tenantId: string): Promise<TestCaseDependencyEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE tenant_id = $1 ORDER BY created_at`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async deleteByTenant(tenantId: string): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM ${this.tableName} WHERE tenant_id = $1`,
      [tenantId],
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): TestCaseDependencyEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      suiteId: row.suite_id,
      name: row.name,
      filePath: row.file_path,
      dependencies: row.dependencies ?? [],
      avgDuration: row.avg_duration,
      flakyScore: row.flaky_score,
      history: row.history ?? [],
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

// ==================== Code Mapping ====================

export interface TestCodeMappingEntity {
  id: string;
  tenantId: string;
  testPath: string;
  sourcePaths: string[];
  symbolMapping: Record<string, string[]>;
  created_at: Date;
  updated_at: Date;
}

export class TestCodeMappingDependencyRepository extends BaseRepository<TestCodeMappingEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'test_selector_code_mappings');
  }

  async create(data: Omit<TestCodeMappingEntity, 'created_at' | 'updated_at'> & Partial<Pick<TestCodeMappingEntity, 'id'>>): Promise<TestCodeMappingEntity> {
    const columns = ['id', 'tenant_id', 'test_path', 'source_paths', 'symbol_mapping'];
    const values = [data.id, data.tenantId, data.testPath, JSON.stringify(data.sourcePaths), JSON.stringify(data.symbolMapping)];

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders})
      ON CONFLICT (id) DO UPDATE SET
        test_path = EXCLUDED.test_path, source_paths = EXCLUDED.source_paths,
        symbol_mapping = EXCLUDED.symbol_mapping, updated_at = NOW()
      RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError('OPERATION_FAILED', ErrorCode.DATABASE_ERROR);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTestPath(testPath: string): Promise<TestCodeMappingEntity | null> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE test_path = $1 LIMIT 1`,
      [testPath],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenant(tenantId: string): Promise<TestCodeMappingEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE tenant_id = $1 ORDER BY created_at`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async deleteByTenant(tenantId: string): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM ${this.tableName} WHERE tenant_id = $1`,
      [tenantId],
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): TestCodeMappingEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      testPath: row.test_path,
      sourcePaths: row.source_paths ?? [],
      symbolMapping: row.symbol_mapping ?? {},
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

// ==================== PR Test Result ====================

export interface PRTestResultEntity {
  id: string;
  tenantId: string;
  prId: string;
  planData: Record<string, unknown>;
  impactData: Record<string, unknown>;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export class PRTestResultDependencyRepository extends BaseRepository<PRTestResultEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'test_selector_pr_results');
  }

  async create(data: Omit<PRTestResultEntity, 'created_at' | 'updated_at'> & Partial<Pick<PRTestResultEntity, 'id'>>): Promise<PRTestResultEntity> {
    const columns = ['id', 'tenant_id', 'pr_id', 'plan_data', 'impact_data', 'status'];
    const values = [data.id, data.tenantId, data.prId, JSON.stringify(data.planData), JSON.stringify(data.impactData), data.status];

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError('OPERATION_FAILED', ErrorCode.DATABASE_ERROR);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByPrId(prId: string, tenantId: string = 'default'): Promise<PRTestResultEntity | null> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE pr_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 1`,
      [prId, tenantId],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByPlanId(planId: string, tenantId: string = 'default'): Promise<PRTestResultEntity | null> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE tenant_id = $1 AND plan_data->>'planId' = $2 LIMIT 1`,
      [tenantId, planId],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenant(tenantId: string): Promise<PRTestResultEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.db.query(
      `UPDATE ${this.tableName} SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, id],
    );
  }

  protected mapRowToEntity(row: any): PRTestResultEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      prId: row.pr_id,
      planData: row.plan_data ?? {},
      impactData: row.impact_data ?? {},
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

// ==================== Test Execution History ====================

export interface TestExecutionHistoryEntity {
  id: string;
  tenantId: string;
  testId: string;
  executionId: string;
  passed: boolean;
  duration: number;
  failureMessage: string | null;
  prId: string | null;
  executedAt: Date;
  created_at: Date;
}

export class TestExecutionHistoryDependencyRepository extends BaseRepository<TestExecutionHistoryEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'test_selector_execution_history');
  }

  async create(data: any): Promise<TestExecutionHistoryEntity> {
    const columns = ['id', 'tenant_id', 'test_id', 'execution_id', 'passed', 'duration', 'failure_message', 'pr_id', 'executed_at'];
    const values = [data.id, data.tenantId || 'default', data.testId, data.executionId, data.passed, data.duration, data.failureMessage, data.prId, data.executedAt];

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError('OPERATION_FAILED', ErrorCode.DATABASE_ERROR);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTestId(testId: string, limit: number = 100): Promise<TestExecutionHistoryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE test_id = $1 ORDER BY executed_at ASC LIMIT $2`,
      [testId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findAllTestIds(tenantId: string = 'default'): Promise<string[]> {
    const result = await this.db.query(
      `SELECT DISTINCT test_id FROM ${this.tableName} WHERE tenant_id = $1`,
      [tenantId],
    );
    return result.rows.map((row: any) => row.test_id);
  }

  async deleteByTestId(testId: string): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM ${this.tableName} WHERE test_id = $1`,
      [testId],
    );
    return result.rowCount ?? 0;
  }

  async deleteByTenant(tenantId: string): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM ${this.tableName} WHERE tenant_id = $1`,
      [tenantId],
    );
    return result.rowCount ?? 0;
  }

  async pruneOld(retentionDays: number = 90): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM ${this.tableName} WHERE executed_at < NOW() - INTERVAL '${retentionDays} days'`,
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): TestExecutionHistoryEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      testId: row.test_id,
      executionId: row.execution_id,
      passed: row.passed,
      duration: row.duration,
      failureMessage: row.failure_message,
      prId: row.pr_id,
      executedAt: row.executed_at,
      created_at: row.created_at,
    };
  }
}
