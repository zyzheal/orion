import { BaseRepository, FindAllOptions, FindAllResult } from '../../db/base-repository';

export interface ComplianceReportEntity {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  framework: string;
  status: 'draft' | 'running' | 'completed' | 'failed';
  score: number | null;
  findings: ComplianceFinding[];
  scheduleId: string | null;
  triggeredBy: string;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceFinding {
  ruleId: string;
  ruleName: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: 'pass' | 'fail' | 'not_applicable';
  details: string | null;
  resourceType?: string;
  resourceId?: string;
}

export interface ComplianceScheduleEntity {
  id: string;
  tenantId: string;
  name: string;
  framework: string;
  cronExpression: string;
  enabled: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ComplianceReportRepository extends BaseRepository<ComplianceReportEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'compliance_reports');
  }

  async findByTenant(tenantId: string, options: FindAllOptions = {}): Promise<FindAllResult<ComplianceReportEntity>> {
    return this.findAll({ ...options, where: { ...options.where, tenantId } });
  }

  async findByFramework(tenantId: string, framework: string): Promise<ComplianceReportEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM compliance_reports WHERE tenant_id = $1 AND framework = $2 ORDER BY created_at DESC`,
      [tenantId, framework],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async findByScheduleId(scheduleId: string): Promise<ComplianceReportEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM compliance_reports WHERE schedule_id = $1 ORDER BY created_at DESC`,
      [scheduleId],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): ComplianceReportEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description ?? null,
      framework: row.framework,
      status: row.status,
      score: row.score !== null ? parseFloat(row.score) : null,
      findings: typeof row.findings === 'string' ? JSON.parse(row.findings) : (row.findings ?? []),
      scheduleId: row.schedule_id ?? null,
      triggeredBy: row.triggered_by,
      startedAt: row.started_at ?? null,
      completedAt: row.completed_at ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export class ComplianceScheduleRepository extends BaseRepository<ComplianceScheduleEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'compliance_schedules');
  }

  async findByTenant(tenantId: string, options: FindAllOptions = {}): Promise<FindAllResult<ComplianceScheduleEntity>> {
    return this.findAll({ ...options, where: { ...options.where, tenantId } });
  }

  async findEnabled(tenantId: string): Promise<ComplianceScheduleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM compliance_schedules WHERE tenant_id = $1 AND enabled = true ORDER BY name`,
      [tenantId],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async updateLastRun(id: string): Promise<ComplianceScheduleEntity> {
    return this.update(id, { lastRunAt: new Date() });
  }

  protected mapRowToEntity(row: any): ComplianceScheduleEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      framework: row.framework,
      cronExpression: row.cron_expression,
      enabled: row.enabled,
      lastRunAt: row.last_run_at ?? null,
      nextRunAt: row.next_run_at ?? null,
      createdBy: row.created_by ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
