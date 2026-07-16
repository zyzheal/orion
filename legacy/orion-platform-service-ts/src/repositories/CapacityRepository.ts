import { BaseRepository } from '../db/base-repository';

export interface CapacityMetricEntity {
  id: string;
  tenantId: string;
  resourceType: string;
  resourceId: string;
  metricName: string;
  currentValue: number;
  maxValue: number;
  unit: string;
  utilizationPercent: number;
  createdAt: Date;
}

export interface CapacityForecastEntity {
  id: string;
  tenantId: string;
  resourceType: string;
  resourceId: string;
  metricName: string;
  currentUtilization: number;
  forecast30Days: number;
  forecast90Days: number;
  estimatedExhaustDate: Date | null;
  recommendedAction: string | null;
  generatedAt: Date;
}

export interface CapacityAlertEntity {
  id: string;
  tenantId: string;
  resourceId: string;
  resourceType: string;
  metricName: string;
  currentUtilization: number;
  threshold: number;
  severity: string;
  message: string;
  createdAt: Date;
}

export interface CapacityReportEntity {
  id: string;
  tenantId: string;
  title: string;
  summary: Record<string, any>;
  alerts: any[];
  forecasts: any[];
  generatedAt: Date;
}

export class CapacityMetricRepository extends BaseRepository<CapacityMetricEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'capacity_metrics');
  }

  async findByTenant(tenantId: string, filters?: { resourceType?: string; metricName?: string }): Promise<CapacityMetricEntity[]> {
    let query = 'SELECT * FROM capacity_metrics WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    let idx = 2;
    if (filters?.resourceType) {
      query += ` AND resource_type = $${idx++}`;
      params.push(filters.resourceType);
    }
    if (filters?.metricName) {
      query += ` AND metric_name = $${idx++}`;
      params.push(filters.metricName);
    }
    query += ' ORDER BY created_at DESC';
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findLatestByTenant(tenantId: string): Promise<CapacityMetricEntity[]> {
    const result = await this.db.query(
      `SELECT DISTINCT ON (resource_type, resource_id, metric_name)
       * FROM capacity_metrics WHERE tenant_id = $1
       ORDER BY resource_type, resource_id, metric_name, created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): CapacityMetricEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      metricName: row.metric_name,
      currentValue: parseFloat(row.current_value),
      maxValue: parseFloat(row.max_value),
      unit: row.unit,
      utilizationPercent: parseFloat(row.utilization_percent),
      createdAt: row.created_at,
    };
  }
}

export class CapacityForecastRepository extends BaseRepository<CapacityForecastEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'capacity_forecasts');
  }

  async findByTenant(tenantId: string, filters?: { resourceType?: string }): Promise<CapacityForecastEntity[]> {
    let query = 'SELECT * FROM capacity_forecasts WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    if (filters?.resourceType) {
      query += ' AND resource_type = $2';
      params.push(filters.resourceType);
    }
    query += ' ORDER BY generated_at DESC';
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): CapacityForecastEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      metricName: row.metric_name,
      currentUtilization: parseFloat(row.current_utilization),
      forecast30Days: parseFloat(row.forecast_30_days),
      forecast90Days: parseFloat(row.forecast_90_days),
      estimatedExhaustDate: row.estimated_exhaust_date ?? null,
      recommendedAction: row.recommended_action ?? null,
      generatedAt: row.generated_at,
    };
  }
}

export class CapacityAlertRepository extends BaseRepository<CapacityAlertEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'capacity_alerts');
  }

  async findByTenant(tenantId: string, filters?: { severity?: string }): Promise<CapacityAlertEntity[]> {
    let query = 'SELECT * FROM capacity_alerts WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    if (filters?.severity) {
      query += ' AND severity = $2';
      params.push(filters.severity);
    }
    query += ' ORDER BY created_at DESC';
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): CapacityAlertEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      resourceId: row.resource_id,
      resourceType: row.resource_type,
      metricName: row.metric_name,
      currentUtilization: parseFloat(row.current_utilization),
      threshold: parseFloat(row.threshold),
      severity: row.severity,
      message: row.message,
      createdAt: row.created_at,
    };
  }
}

export class CapacityReportRepository extends BaseRepository<CapacityReportEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'capacity_reports');
  }

  async findByTenant(tenantId: string): Promise<CapacityReportEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM capacity_reports WHERE tenant_id = $1 ORDER BY generated_at DESC',
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): CapacityReportEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      title: row.title,
      summary: typeof row.summary === 'string' ? JSON.parse(row.summary) : (row.summary ?? {}),
      alerts: typeof row.alerts === 'string' ? JSON.parse(row.alerts) : (row.alerts ?? []),
      forecasts: typeof row.forecasts === 'string' ? JSON.parse(row.forecasts) : (row.forecasts ?? []),
      generatedAt: row.generated_at,
    };
  }
}
