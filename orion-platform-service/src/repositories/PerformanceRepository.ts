/**
 * Performance Repository
 *
 * PostgreSQL persistence for performance baselines, evaluations,
 * test results, and profile records.
 */
import { BaseRepository } from '../db/base-repository';
import { OrionError, ErrorCode } from '../errors';

// ==================== Performance Baseline ====================

export interface PerformanceBaselineEntity {
  id: string;
  tenant_id: string;
  service: string;
  environment: string | null;
  metrics: Record<string, number>;
  thresholds: Record<string, { min: number; max: number }>;
  version: number;
  created_at: Date;
  updated_at: Date;
}

export class PerformanceBaselineRepository extends BaseRepository<PerformanceBaselineEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'performance_baselines');
  }

  async findByTenantAndService(tenantId: string, service: string): Promise<PerformanceBaselineEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM performance_baselines WHERE tenant_id = $1 AND service = $2 ORDER BY version DESC LIMIT 1`,
      [tenantId, service],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenant(tenantId: string): Promise<PerformanceBaselineEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM performance_baselines WHERE tenant_id = $1 ORDER BY service, version DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async deleteByTenantAndService(tenantId: string, service: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM performance_baselines WHERE tenant_id = $1 AND service = $2`,
      [tenantId, service],
    );
    return (result.rowCount ?? 0) > 0;
  }

  protected mapRowToEntity(row: any): PerformanceBaselineEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      service: row.service,
      environment: row.environment,
      metrics: row.metrics ?? {},
      thresholds: row.thresholds ?? {},
      version: row.version ?? 1,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

// ==================== Performance Evaluation ====================

export interface PerformanceEvaluationEntity {
  id: string;
  baseline_id: string;
  tenant_id: string;
  service: string;
  overall: 'healthy' | 'degraded' | 'critical';
  details: Record<string, any>[];
  evaluated_at: Date;
}

export class PerformanceEvaluationRepository extends BaseRepository<PerformanceEvaluationEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'performance_evaluations');
  }

  async findByBaselineId(baselineId: string, limit?: number): Promise<PerformanceEvaluationEntity[]> {
    const l = limit ?? 50;
    const result = await this.db.query(
      `SELECT * FROM performance_evaluations WHERE baseline_id = $1 ORDER BY evaluated_at DESC LIMIT $2`,
      [baselineId, l],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenant(tenantId: string, limit?: number): Promise<PerformanceEvaluationEntity[]> {
    const l = limit ?? 50;
    const result = await this.db.query(
      `SELECT * FROM performance_evaluations WHERE tenant_id = $1 ORDER BY evaluated_at DESC LIMIT $2`,
      [tenantId, l],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): PerformanceEvaluationEntity {
    return {
      id: row.id,
      baseline_id: row.baseline_id,
      tenant_id: row.tenant_id,
      service: row.service,
      overall: row.overall ?? 'healthy',
      details: row.details ?? [],
      evaluated_at: row.evaluated_at,
    };
  }
}

// ==================== Performance Test Result ====================

export interface PerformanceTestResultEntity {
  id: string;
  tenant_id: string;
  service: string;
  baseline_id: string | null;
  test_name: string;
  metrics: Record<string, number>;
  status: 'pass' | 'fail' | 'warn';
  failures: Record<string, any>[] | null;
  duration: number;
  timestamp: Date;
}

export class PerformanceTestResultRepository extends BaseRepository<PerformanceTestResultEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'performance_test_results');
  }

  async findByService(service: string, limit?: number): Promise<PerformanceTestResultEntity[]> {
    const l = limit ?? 50;
    const result = await this.db.query(
      `SELECT * FROM performance_test_results WHERE service = $1 ORDER BY timestamp DESC LIMIT $2`,
      [service, l],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenant(tenantId: string, limit?: number): Promise<PerformanceTestResultEntity[]> {
    const l = limit ?? 50;
    const result = await this.db.query(
      `SELECT * FROM performance_test_results WHERE tenant_id = $1 ORDER BY timestamp DESC LIMIT $2`,
      [tenantId, l],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): PerformanceTestResultEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      service: row.service,
      baseline_id: row.baseline_id,
      test_name: row.test_name,
      metrics: row.metrics ?? {},
      status: row.status ?? 'pass',
      failures: row.failures ?? null,
      duration: row.duration ?? 0,
      timestamp: row.timestamp,
    };
  }
}

// ==================== Performance Profile ====================

export interface PerformanceProfileEntity {
  id: string;
  tenant_id: string | null;
  service_name: string;
  config: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  results: Record<string, any> | null;
  error_message: string | null;
  created_at: Date;
  completed_at: Date | null;
}

export class PerformanceProfileRepository extends BaseRepository<PerformanceProfileEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'performance_profiles');
  }

  async findByService(serviceName: string, limit?: number): Promise<PerformanceProfileEntity[]> {
    const l = limit ?? 50;
    const result = await this.db.query(
      `SELECT * FROM performance_profiles WHERE service_name = $1 ORDER BY created_at DESC LIMIT $2`,
      [serviceName, l],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateResults(id: string, results: Record<string, any>, status: string, errorMessage?: string | null): Promise<PerformanceProfileEntity> {
    const result = await this.db.query(
      `UPDATE performance_profiles SET results = $1, status = $2, error_message = $3, completed_at = NOW(), updated_at = NOW() WHERE id = $4 RETURNING *`,
      [JSON.stringify(results), status, errorMessage ?? null, id],
    );
    if (result.rows.length === 0) throw new OrionError(`Profile ${id} not found`, ErrorCode.NOT_FOUND);
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): PerformanceProfileEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      service_name: row.service_name,
      config: row.config ?? {},
      status: row.status ?? 'pending',
      results: row.results ?? null,
      error_message: row.error_message,
      created_at: row.created_at,
      completed_at: row.completed_at,
    };
  }
}
