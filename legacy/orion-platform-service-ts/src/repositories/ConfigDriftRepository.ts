/**
 * ConfigDriftRepository - PostgreSQL persistence for drift reports
 */

import { BaseRepository } from '../db/base-repository';

export interface ConfigDriftEntity {
  id: string;
  tenantId: string;
  configGroup?: string;
  driftStatus: string;
  expectedConfig: Record<string, unknown>;
  actualConfig: Record<string, unknown>;
  driftItems: unknown[];
  totalDrifts: number;
  criticalDrifts: number;
  autoRemediationEnabled: boolean;
  remediationLog: unknown[];
  detectedAt: Date;
  lastCheckedAt: Date;
  createdAt: Date;
}

interface RawDriftRow {
  id: string;
  tenant_id: string;
  config_group: string | null;
  drift_status: string;
  expected_config: unknown;
  actual_config: unknown;
  drift_items: unknown;
  total_drifts: number;
  critical_drifts: number;
  auto_remediation_enabled: boolean;
  remediation_log: unknown;
  detected_at: Date | string;
  last_checked_at: Date | string;
  created_at: Date | string;
}

export class ConfigDriftRepository extends BaseRepository<ConfigDriftEntity> {
  private dbAvailable: boolean;

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> } | null) {
    const dummyDb = {
      query: () => Promise.resolve({ rows: [], rowCount: 0 }),
    };
    super(db || dummyDb, 'config_drift_reports');
    this.dbAvailable = db !== null;
  }

  isDbAvailable(): boolean {
    return this.dbAvailable;
  }

  protected mapRowToEntity(row: RawDriftRow): ConfigDriftEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      configGroup: row.config_group || undefined,
      driftStatus: row.drift_status,
      expectedConfig: (this._parseJson(row.expected_config) as Record<string, unknown> | undefined) || {},
      actualConfig: (this._parseJson(row.actual_config) as Record<string, unknown> | undefined) || {},
      driftItems: (this._parseJson(row.drift_items) as unknown[] | undefined) || [],
      totalDrifts: parseInt(String(row.total_drifts), 10) || 0,
      criticalDrifts: parseInt(String(row.critical_drifts), 10) || 0,
      autoRemediationEnabled: Boolean(row.auto_remediation_enabled),
      remediationLog: (this._parseJson(row.remediation_log) as unknown[] | undefined) || [],
      detectedAt: this._toDate(row.detected_at),
      lastCheckedAt: this._toDate(row.last_checked_at),
      createdAt: this._toDate(row.created_at),
    };
  }

  private _parseJson(val: unknown): unknown {
    if (val === undefined || val === null) return null;
    if (typeof val === 'object') return val;
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return null; }
    }
    return null;
  }

  private _toDate(v: unknown): Date {
    if (v instanceof Date) return v;
    if (typeof v === 'string') return new Date(v);
    return new Date();
  }

  /**
   * Upsert a drift report (insert or update on conflict)
   */
  async upsert(report: {
    id: string;
    tenantId: string;
    configGroup?: string;
    driftStatus: string;
    expectedConfig: Record<string, unknown>;
    actualConfig: Record<string, unknown>;
    driftItems: unknown[];
    totalDrifts: number;
    criticalDrifts: number;
    autoRemediationEnabled: boolean;
    remediationLog: unknown[];
    detectedAt: Date;
    lastCheckedAt: Date;
    createdAt: Date;
  }): Promise<void> {
    const jsonFields = [
      JSON.stringify(report.expectedConfig),
      JSON.stringify(report.actualConfig),
      JSON.stringify(report.driftItems),
      JSON.stringify(report.remediationLog),
    ];

    const params = [
      report.id,
      report.tenantId,
      report.configGroup || null,
      report.driftStatus,
      ...jsonFields,
      report.totalDrifts,
      report.criticalDrifts,
      report.autoRemediationEnabled,
      report.detectedAt,
      report.lastCheckedAt,
      report.createdAt,
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatableCols = [
      { col: 'drift_status', paramIdx: 4 },
      { col: 'expected_config', paramIdx: 5 },
      { col: 'actual_config', paramIdx: 6 },
      { col: 'drift_items', paramIdx: 7 },
      { col: 'total_drifts', paramIdx: 8 },
      { col: 'critical_drifts', paramIdx: 9 },
      { col: 'auto_remediation_enabled', paramIdx: 10 },
      { col: 'remediation_log', paramIdx: 11 },
      { col: 'last_checked_at', paramIdx: 12 },
    ];

    const setClause = updatableCols.map(({ col, paramIdx }) => `${col} = $${paramIdx}`).join(', ');

    const query = `
      INSERT INTO config_drift_reports (
        id, tenant_id, config_group, drift_status, expected_config, actual_config,
        drift_items, total_drifts, critical_drifts, auto_remediation_enabled,
        remediation_log, detected_at, last_checked_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET
        ${setClause}
    `;

    await this.db.query(query, params);
  }

  /**
   * Find drift reports by tenant with optional config_group filter
   */
  async findByTenant(tenantId: string, configGroup?: string): Promise<ConfigDriftEntity[]> {
    if (!this.dbAvailable) return [];

    let query = 'SELECT * FROM config_drift_reports WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    let paramIdx = 2;

    if (configGroup) {
      query += ` AND config_group = $${paramIdx}`;
      params.push(configGroup);
      paramIdx++;
    }

    query += ' ORDER BY detected_at DESC';

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find the latest drift report by tenant
   */
  async findLatestByTenant(tenantId: string): Promise<ConfigDriftEntity | null> {
    if (!this.dbAvailable) return null;

    const result = await this.db.query(
      'SELECT * FROM config_drift_reports WHERE tenant_id = $1 ORDER BY detected_at DESC LIMIT 1',
      [tenantId]
    );
    return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0]) : null;
  }

  /**
   * Find reports by drift status for a tenant
   */
  async findByStatus(tenantId: string, status: string): Promise<ConfigDriftEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM config_drift_reports WHERE tenant_id = $1 AND drift_status = $2 ORDER BY detected_at DESC',
      [tenantId, status]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }
}
