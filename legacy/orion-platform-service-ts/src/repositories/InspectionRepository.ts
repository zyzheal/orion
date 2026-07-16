/**
 * InspectionRepository — PostgreSQL data access for inspection module
 *
 * Manages 4 tables: inspection_rules, inspection_tasks, inspection_results, inspection_reports
 */

import { BaseRepository } from '../db/base-repository';

// --- Entities ---

export interface InspectionRuleEntity {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  target: string;
  checkType: string;
  threshold: number;
  operator: string;
  enabled: boolean;
  schedule?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InspectionTaskEntity {
  id: string;
  tenantId: string;
  ruleId: string;
  status: string;
  resultId?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

export interface InspectionResultEntity {
  id: string;
  taskId: string;
  passed: boolean;
  actualValue: number;
  expectedValue: number;
  message: string;
  details?: Record<string, unknown>;
  createdAt: Date;
}

export interface InspectionReportEntity {
  id: string;
  tenantId: string;
  title: string;
  summary: { total: number; passed: number; failed: number; warning: number; score: number };
  generatedAt: Date;
}

// --- Repositories ---

export class InspectionRuleRepository extends BaseRepository<InspectionRuleEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'inspection_rules');
  }

  async findByTenant(tenantId: string, options?: { target?: string; enabled?: boolean }): Promise<InspectionRuleEntity[]> {
    let query = 'SELECT * FROM inspection_rules WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    let idx = 2;

    if (options?.target) {
      query += ` AND target = $${idx++}`;
      params.push(options.target);
    }
    if (options?.enabled !== undefined) {
      query += ` AND enabled = $${idx++}`;
      params.push(options.enabled);
    }
    query += ' ORDER BY created_at DESC';

    const result = await this.db.query(query, params);
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  async updateEnabled(id: string, enabled: boolean): Promise<InspectionRuleEntity | null> {
    const result = await this.db.query(
      `UPDATE inspection_rules SET enabled = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [enabled, id],
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  protected mapRowToEntity(row: any): InspectionRuleEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      target: row.target,
      checkType: row.check_type,
      threshold: parseFloat(row.threshold),
      operator: row.operator,
      enabled: row.enabled,
      schedule: row.schedule,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

export class InspectionTaskRepository extends BaseRepository<InspectionTaskEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'inspection_tasks');
  }

  async findByTenant(tenantId: string, options?: { ruleId?: string; status?: string }): Promise<InspectionTaskEntity[]> {
    let query = 'SELECT * FROM inspection_tasks WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    let idx = 2;

    if (options?.ruleId) {
      query += ` AND rule_id = $${idx++}`;
      params.push(options.ruleId);
    }
    if (options?.status) {
      query += ` AND status = $${idx++}`;
      params.push(options.status);
    }
    query += ' ORDER BY created_at DESC';

    const result = await this.db.query(query, params);
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  async updateStatus(id: string, status: string, extra?: { resultId?: string; startedAt?: Date; completedAt?: Date }): Promise<InspectionTaskEntity | null> {
    const sets: string[] = ['status = $1'];
    const params: any[] = [status];
    let idx = 2;

    if (extra?.resultId) {
      sets.push(`result_id = $${idx++}`);
      params.push(extra.resultId);
    }
    if (extra?.startedAt) {
      sets.push(`started_at = $${idx++}`);
      params.push(extra.startedAt);
    }
    if (extra?.completedAt) {
      sets.push(`completed_at = $${idx++}`);
      params.push(extra.completedAt);
    }

    params.push(id);
    const query = `UPDATE inspection_tasks SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`;
    const result = await this.db.query(query, params);
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async findRecentCompleted(tenantId: string, limit: number = 100): Promise<InspectionTaskEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM inspection_tasks WHERE tenant_id = $1 AND status = 'completed' ORDER BY created_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  protected mapRowToEntity(row: any): InspectionTaskEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      ruleId: row.rule_id,
      status: row.status,
      resultId: row.result_id,
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      createdAt: new Date(row.created_at),
    };
  }
}

export class InspectionResultRepository extends BaseRepository<InspectionResultEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'inspection_results');
  }

  async findByTaskId(taskId: string): Promise<InspectionResultEntity | undefined> {
    const result = await this.db.query(
      'SELECT * FROM inspection_results WHERE task_id = $1',
      [taskId],
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : undefined;
  }

  async findByTaskIds(taskIds: string[]): Promise<InspectionResultEntity[]> {
    if (taskIds.length === 0) return [];
    const placeholders = taskIds.map((_, i) => `$${i + 1}`).join(', ');
    const result = await this.db.query(
      `SELECT * FROM inspection_results WHERE task_id IN (${placeholders})`,
      taskIds,
    );
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  protected mapRowToEntity(row: any): InspectionResultEntity {
    return {
      id: row.id,
      taskId: row.task_id,
      passed: row.passed,
      actualValue: parseFloat(row.actual_value),
      expectedValue: parseFloat(row.expected_value),
      message: row.message,
      details: row.details,
      createdAt: new Date(row.created_at),
    };
  }
}

export class InspectionReportRepository extends BaseRepository<InspectionReportEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'inspection_reports');
  }

  async findByTenant(tenantId: string): Promise<InspectionReportEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM inspection_reports WHERE tenant_id = $1 ORDER BY generated_at DESC',
      [tenantId],
    );
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  protected mapRowToEntity(row: any): InspectionReportEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      title: row.title,
      summary: row.summary,
      generatedAt: new Date(row.generated_at),
    };
  }
}
