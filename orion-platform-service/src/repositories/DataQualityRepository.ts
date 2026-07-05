/**
 * Data Quality Repository
 *
 * PostgreSQL persistence for data quality rules and check results.
 * Follows BaseRepository pattern for consistent data access.
 *
 * This file supports two domain models:
 * 1. "Table-column" model (services/data-quality) — for schema-level quality checks
 * 2. "Pipeline-field" model (services/data-pipeline) — for pipeline-level validation rules
 *
 * Both coexist in this file; the pipeline model uses its own adapter class.
 */

import { BaseRepository } from '../db/base-repository';
import { OrionError, ErrorCode } from '../errors';

// ============================================================
// Entity 1 — Table-column model (original, consumed by services/data-quality)
// ============================================================

export interface DataQualityRuleEntity {
  id: string;
  tenantId: string;
  name: string;
  tableName: string;
  columnName: string | null;
  ruleType: 'not_null' | 'unique' | 'range' | 'regex' | 'custom' | 'freshness' | 'volume';
  config: Record<string, unknown>;
  severity: 'info' | 'warning' | 'error' | 'critical';
  enabled: boolean;
  lastCheckAt: Date | null;
  lastStatus: 'pass' | 'fail' | 'error' | null;
  passRate: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DataQualityCheckEntity {
  id: string;
  tenantId: string;
  ruleId: string;
  ruleName: string;
  status: 'pass' | 'fail' | 'error';
  actualValue: string | null;
  expectedValue: string | null;
  details: string | null;
  checkedAt: Date;
}

export interface FindRulesOptions {
  tenantId: string;
  tableName?: string;
  enabled?: boolean;
  limit?: number;
  offset?: number;
}

export class DataQualityRuleRepository extends BaseRepository<DataQualityRuleEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'data_quality_rules');
  }

  /**
   * Find all rules for a tenant with optional filters
   */
  async findByTenant(options: FindRulesOptions): Promise<{ entities: DataQualityRuleEntity[]; total: number }> {
    const { tenantId, tableName, enabled, limit = 20, offset = 0 } = options;

    let query = `SELECT * FROM data_quality_rules WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (tableName) {
      query += ` AND table_name = $${paramIndex}`;
      params.push(tableName);
      paramIndex++;
    }

    if (enabled !== undefined) {
      query += ` AND enabled = $${paramIndex}`;
      params.push(enabled);
      paramIndex++;
    }

    // Count query
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = await this.db.query(countQuery, params);
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    return {
      entities: result.rows.map(row => this.mapRowToEntity(row)),
      total,
    };
  }

  /**
   * Update rule status after a check execution
   */
  async updateCheckResult(
    id: string,
    status: 'pass' | 'fail' | 'error',
    passRate: number,
  ): Promise<DataQualityRuleEntity> {
    const result = await this.db.query(
      `UPDATE data_quality_rules
       SET last_check_at = now(), last_status = $1, pass_rate = $2, updated_at = now()
       WHERE id = $3
       RETURNING *`,
      [status, passRate, id],
    );
    if (result.rows.length === 0) {
      throw new OrionError(`Rule not found: ${id}`, ErrorCode.NOT_FOUND);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): DataQualityRuleEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      tableName: row.table_name,
      columnName: row.column_name,
      ruleType: row.rule_type,
      config: typeof row.config === 'string' ? JSON.parse(row.config) : (row.config || {}),
      severity: row.severity,
      enabled: row.enabled,
      lastCheckAt: row.last_check_at,
      lastStatus: row.last_status,
      passRate: parseFloat(row.pass_rate) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export class DataQualityCheckRepository extends BaseRepository<DataQualityCheckEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'data_quality_checks');
  }

  /**
   * Find checks by tenant with optional rule filter
   */
  async findByTenant(
    tenantId: string,
    ruleId?: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ entities: DataQualityCheckEntity[]; total: number }> {
    let query = `SELECT * FROM data_quality_checks WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (ruleId) {
      query += ` AND rule_id = $${paramIndex}`;
      params.push(ruleId);
      paramIndex++;
    }

    // Count query
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = await this.db.query(countQuery, params);
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    query += ` ORDER BY checked_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    return {
      entities: result.rows.map(row => this.mapRowToEntity(row)),
      total,
    };
  }

  /**
   * Find checks by rule ID
   */
  async findByRuleId(ruleId: string, limit: number = 50): Promise<DataQualityCheckEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM data_quality_checks WHERE rule_id = $1 ORDER BY checked_at DESC LIMIT $2`,
      [ruleId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): DataQualityCheckEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      ruleId: row.rule_id,
      ruleName: row.rule_name,
      status: row.status,
      actualValue: row.actual_value,
      expectedValue: row.expected_value,
      details: row.details,
      checkedAt: row.checked_at,
    };
  }
}

// ============================================================
// Entity 2 — Pipeline-field model (for services/data-pipeline)
// These types are consumed by DataQualityService in services/data-pipeline
// ============================================================

export interface PipelineDataQualityRuleEntity {
  id: string;
  tenantId: string;
  pipelineId: string;
  stageId: string | null;
  name: string;
  description: string | null;
  ruleType: 'not_null' | 'unique' | 'range' | 'pattern' | 'custom' | 'referential' | 'completeness';
  severity: 'critical' | 'warning' | 'info';
  targetField: string;
  condition: Record<string, unknown>;
  enabled: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PipelineValidationResultEntity {
  id: string;
  ruleId: string;
  pipelineId: string;
  tenantId: string;
  executionId: string | null;
  status: 'passed' | 'failed' | 'warning';
  totalRecords: number;
  passedRecords: number;
  failedRecords: number;
  failureRate: number;
  failureSamples: unknown[];
  durationMs: number;
  validatedAt: Date;
}
