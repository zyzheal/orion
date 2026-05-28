/**
 * ConfigDriftDetector - 配置漂移检测服务
 *
 * 检测并报告实际配置与期望配置之间的差异，支持自动修复。
 *
 * 功能：
 * - detectDrift(tenantId, configGroup) — 检测配置漂移
 * - compareConfig(expected, actual) — 对比配置差异
 * - autoRemediateDrift(driftId) — 自动修复漂移
 * - getDriftReport(tenantId) — 漂移报告
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabasePool } from '../database';
import { ConfigService } from './ConfigService';
import { OrionError, ErrorCode } from '../../../errors';

// ============================================================
// Types
// ============================================================

export type DriftStatus = 'in_sync' | 'drift_detected' | 'remediating' | 'remediated' | 'remediation_failed';

export interface DriftItem {
  configKey: string;
  configGroup?: string;
  path: string;
  expectedValue: unknown;
  actualValue: unknown;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export interface DriftReport {
  id: string;
  tenantId: string;
  configGroup?: string;
  driftStatus: DriftStatus;
  expectedConfig: Record<string, unknown>;
  actualConfig: Record<string, unknown>;
  driftItems: DriftItem[];
  totalDrifts: number;
  criticalDrifts: number;
  autoRemediationEnabled: boolean;
  remediationLog: RemediationEntry[];
  detectedAt: Date;
  lastCheckedAt: Date;
  createdAt: Date;
}

export interface RemediationEntry {
  driftId: string;
  configKey: string;
  action: string;
  success: boolean;
  error?: string;
  timestamp: Date;
}

export interface ConfigComparisonResult {
  isEqual: boolean;
  differences: {
    path: string;
    expected: unknown;
    actual: unknown;
  }[];
  missingInExpected: string[];
  missingInActual: string[];
}

// ============================================================
// Repository
// ============================================================

interface DriftReportRow {
  id: string;
  tenant_id: string;
  config_group: string | null;
  drift_status: string;
  expected_config: Record<string, unknown>;
  actual_config: Record<string, unknown>;
  drift_items: Record<string, unknown>[];
  total_drifts: number;
  critical_drifts: number;
  auto_remediation_enabled: boolean;
  remediation_log: Record<string, unknown>[];
  detected_at: Date;
  last_checked_at: Date;
  created_at: Date;
}

class DriftReportRepository {
  private pool: DatabasePool | null;
  private memory = new Map<string, DriftReport>();

  constructor(pool?: DatabasePool) {
    this.pool = pool || null;
  }

  private isDbAvailable(): boolean {
    return this.pool !== null;
  }

  async save(report: DriftReport): Promise<void> {
    if (!this.isDbAvailable()) {
      this.memory.set(report.id, report);
      return;
    }
    await this.pool!.query(
      `INSERT INTO config_drift_reports (
        id, tenant_id, config_group, drift_status, expected_config, actual_config,
        drift_items, total_drifts, critical_drifts, auto_remediation_enabled,
        remediation_log, detected_at, last_checked_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET
        drift_status = EXCLUDED.drift_status,
        expected_config = EXCLUDED.expected_config,
        actual_config = EXCLUDED.actual_config,
        drift_items = EXCLUDED.drift_items,
        total_drifts = EXCLUDED.total_drifts,
        critical_drifts = EXCLUDED.critical_drifts,
        auto_remediation_enabled = EXCLUDED.auto_remediation_enabled,
        remediation_log = EXCLUDED.remediation_log,
        last_checked_at = EXCLUDED.last_checked_at`,
      [
        report.id,
        report.tenantId,
        report.configGroup || null,
        report.driftStatus,
        JSON.stringify(report.expectedConfig),
        JSON.stringify(report.actualConfig),
        JSON.stringify(report.driftItems.map((d) => ({
          configKey: d.configKey,
          configGroup: d.configGroup,
          path: d.path,
          expectedValue: d.expectedValue,
          actualValue: d.actualValue,
          severity: d.severity,
          description: d.description,
        }))),
        report.totalDrifts,
        report.criticalDrifts,
        report.autoRemediationEnabled,
        JSON.stringify(report.remediationLog),
        report.detectedAt,
        report.lastCheckedAt,
        report.createdAt,
      ]
    );
  }

  async findById(id: string): Promise<DriftReport | null> {
    if (!this.isDbAvailable()) {
      return this.memory.get(id) || null;
    }
    const rows = (
      await this.pool!.query('SELECT * FROM config_drift_reports WHERE id = $1', [id])
    ).rows;
    if (rows.length === 0) return null;
    return this.rowToReport(rows[0]);
  }

  async findByTenant(tenantId: string, configGroup?: string): Promise<DriftReport[]> {
    if (!this.isDbAvailable()) {
      let results = Array.from(this.memory.values()).filter((r) => r.tenantId === tenantId);
      if (configGroup) results = results.filter((r) => r.configGroup === configGroup);
      results.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
      return results;
    }

    let query = 'SELECT * FROM config_drift_reports WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    if (configGroup) {
      query += ' AND config_group = $2';
      params.push(configGroup);
    }
    query += ' ORDER BY detected_at DESC';

    const rows = (await this.pool!.query(query, params)).rows;
    return rows.map((r: DriftReportRow) => this.rowToReport(r));
  }

  async findLatestByTenant(tenantId: string): Promise<DriftReport | null> {
    const reports = await this.findByTenant(tenantId);
    return reports.length > 0 ? reports[0] : null;
  }

  private rowToReport(row: DriftReportRow): DriftReport {
    const rawItems = (row.drift_items || []) as Record<string, unknown>[];
    return {
      id: row.id,
      tenantId: row.tenant_id,
      configGroup: row.config_group || undefined,
      driftStatus: row.drift_status as DriftStatus,
      expectedConfig: (row.expected_config as Record<string, unknown>) || {},
      actualConfig: (row.actual_config as Record<string, unknown>) || {},
      driftItems: rawItems.map((item) => ({
        configKey: (item.configKey as string) || '',
        configGroup: (item.configGroup as string) || undefined,
        path: (item.path as string) || '',
        expectedValue: item.expectedValue,
        actualValue: item.actualValue,
        severity: (item.severity as 'low' | 'medium' | 'high' | 'critical') || 'low',
        description: (item.description as string) || '',
      })),
      totalDrifts: row.total_drifts,
      criticalDrifts: row.critical_drifts,
      autoRemediationEnabled: row.auto_remediation_enabled,
      remediationLog: (row.remediation_log || []).map((entry) => ({
        driftId: (entry.driftId as string) || '',
        configKey: (entry.configKey as string) || '',
        action: (entry.action as string) || '',
        success: (entry.success as boolean) || false,
        error: (entry.error as string) || undefined,
        timestamp: (entry.timestamp as Date) || new Date(),
      })),
      detectedAt: row.detected_at,
      lastCheckedAt: row.last_checked_at,
      createdAt: row.created_at,
    };
  }
}

// ============================================================
// Service
// ============================================================

export class ConfigDriftDetector {
  private repository: DriftReportRepository;
  private configService?: ConfigService;
  private expectedConfigs = new Map<string, Record<string, unknown>>();

  constructor(options: {
    database?: DatabasePool;
    configService?: ConfigService;
  } = {}) {
    this.repository = new DriftReportRepository(options.database);
    this.configService = options.configService;
  }

  /**
   * 注册期望配置（用于漂移对比基准）
   */
  registerExpectedConfig(tenantId: string, configGroup: string, config: Record<string, unknown>): void {
    const key = `${tenantId}:${configGroup}`;
    this.expectedConfigs.set(key, config);
  }

  /**
   * 检测配置漂移
   */
  async detectDrift(
    tenantId: string,
    configGroup?: string
  ): Promise<DriftReport> {
    const now = new Date();
    const driftItems: DriftItem[] = [];

    // Check registered expected configs
    for (const [key, expectedConfig] of this.expectedConfigs) {
      const [expectedTenantId, expectedGroup] = key.split(':');
      if (expectedTenantId !== tenantId) continue;
      if (configGroup && expectedGroup !== configGroup) continue;

      // Get actual config
      let actualConfig: Record<string, unknown> = {};
      if (this.configService) {
        try {
          const configs = await this.configService.getAll(tenantId);
          actualConfig = configs.reduce(
            (acc, c) => {
              acc[c.key] = c.value;
              return acc;
            },
            {} as Record<string, unknown>
          );
        } catch {
          // Fallback: use empty config
        }
      }

      // Compare
      const comparison = this.compareConfig(expectedConfig, actualConfig);

      // Build drift items
      for (const diff of comparison.differences) {
        driftItems.push({
          configKey: diff.path,
          configGroup: expectedGroup,
          path: diff.path,
          expectedValue: diff.expected,
          actualValue: diff.actual,
          severity: this.assessSeverity(diff.path, diff.expected, diff.actual),
          description: `Configuration drift detected at ${diff.path}`,
        });
      }

      for (const missing of comparison.missingInActual) {
        driftItems.push({
          configKey: missing,
          configGroup: expectedGroup,
          path: missing,
          expectedValue: this.deepGet(expectedConfig, missing),
          actualValue: undefined,
          severity: 'high',
          description: `Missing configuration: ${missing}`,
        });
      }
    }

    // If no expected configs registered, simulate drift detection
    if (driftItems.length === 0) {
      const reportId = uuidv4();
      const report: DriftReport = {
        id: reportId,
        tenantId,
        configGroup,
        driftStatus: 'in_sync',
        expectedConfig: {},
        actualConfig: {},
        driftItems: [],
        totalDrifts: 0,
        criticalDrifts: 0,
        autoRemediationEnabled: false,
        remediationLog: [],
        detectedAt: now,
        lastCheckedAt: now,
        createdAt: now,
      };
      await this.repository.save(report);
      return { ...report };
    }

    const criticalDrifts = driftItems.filter((d) => d.severity === 'critical' || d.severity === 'high').length;
    const reportId = uuidv4();

    const report: DriftReport = {
      id: reportId,
      tenantId,
      configGroup,
      driftStatus: driftItems.length > 0 ? 'drift_detected' : 'in_sync',
      expectedConfig: this.expectedConfigs.get(`${tenantId}:${configGroup || 'default'}`) || {},
      actualConfig: {},
      driftItems,
      totalDrifts: driftItems.length,
      criticalDrifts,
      autoRemediationEnabled: criticalDrifts > 0,
      remediationLog: [],
      detectedAt: now,
      lastCheckedAt: now,
      createdAt: now,
    };

    await this.repository.save(report);
    return { ...report };
  }

  /**
   * 对比配置差异
   */
  compareConfig(
    expected: Record<string, unknown>,
    actual: Record<string, unknown>
  ): ConfigComparisonResult {
    const differences: { path: string; expected: unknown; actual: unknown }[] = [];
    const missingInExpected: string[] = [];
    const missingInActual: string[] = [];

    // Walk expected config
    this.walkObject(expected, '', (path, expectedValue) => {
      const actualValue = this.deepGet(actual, path);
      if (actualValue === undefined) {
        missingInActual.push(path);
      } else if (!this.valuesEqual(expectedValue, actualValue)) {
        differences.push({ path, expected: expectedValue, actual: actualValue });
      }
    });

    // Walk actual config for extras
    this.walkObject(actual, '', (path, actualValue) => {
      const expectedValue = this.deepGet(expected, path);
      if (expectedValue === undefined) {
        missingInExpected.push(path);
      }
    });

    return {
      isEqual: differences.length === 0 && missingInActual.length === 0 && missingInExpected.length === 0,
      differences,
      missingInExpected,
      missingInActual,
    };
  }

  /**
   * 自动修复漂移
   */
  async autoRemediateDrift(driftId: string): Promise<DriftReport> {
    const report = await this.repository.findById(driftId);
    if (!report) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Drift report '${driftId}' not found`);
    }

    if (report.driftStatus !== 'drift_detected') {
      throw new Error(`Can only remediate drift in 'drift_detected' state (current: ${report.driftStatus})`);
    }

    report.driftStatus = 'remediating';
    report.lastCheckedAt = new Date();
    await this.repository.save(report);

    const remediationLog: RemediationEntry[] = [...report.remediationLog];

    for (const driftItem of report.driftItems) {
      try {
        // Apply expected value to actual config
        if (this.configService) {
          await this.configService.set(
            report.tenantId,
            driftItem.configKey,
            driftItem.expectedValue as Record<string, unknown>,
            `drift-remediation:${report.id}`
          );
        }

        remediationLog.push({
          driftId: report.id,
          configKey: driftItem.configKey,
          action: 'remediate',
          success: true,
          timestamp: new Date(),
        });
      } catch (error) {
        remediationLog.push({
          driftId: report.id,
          configKey: driftItem.configKey,
          action: 'remediate',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
        });
      }
    }

    const failedItems = remediationLog.filter(
      (e) => e.driftId === report.id && !e.success
    ).length;

    report.remediationLog = remediationLog;
    report.driftStatus = failedItems === 0 ? 'remediated' : 'remediation_failed';
    report.lastCheckedAt = new Date();

    if (report.driftStatus === 'remediated') {
      report.driftItems = [];
      report.totalDrifts = 0;
      report.criticalDrifts = 0;
    }

    await this.repository.save(report);
    return { ...report };
  }

  /**
   * 获取漂移报告
   */
  async getDriftReport(tenantId: string, configGroup?: string): Promise<DriftReport | null> {
    const reports = await this.repository.findByTenant(tenantId, configGroup);
    return reports.length > 0 ? reports[0] : null;
  }

  /**
   * 获取所有漂移报告
   */
  async getAllDriftReports(tenantId: string): Promise<DriftReport[]> {
    return this.repository.findByTenant(tenantId);
  }

  // ============================================================
  // Internal Methods
  // ============================================================

  private walkObject(
    obj: Record<string, unknown>,
    prefix: string,
    callback: (path: string, value: unknown) => void
  ): void {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        this.walkObject(value as Record<string, unknown>, path, callback);
      } else {
        callback(path, value);
      }
    }
  }

  private deepGet(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
      if (typeof current !== 'object' || current === null) return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  private valuesEqual(a: unknown, b: unknown): boolean {
    if (typeof a !== typeof b) return false;
    if (typeof a !== 'object' || a === null || b === null) return a === b;
    return JSON.stringify(a) === JSON.stringify(b);
  }

  private assessSeverity(
    path: string,
    expected: unknown,
    actual: unknown
  ): 'low' | 'medium' | 'high' | 'critical' {
    // Critical paths
    if (path.includes('security') || path.includes('auth') || path.includes('credential')) {
      return 'critical';
    }
    // High paths
    if (path.includes('database') || path.includes('connection') || path.includes('port')) {
      return 'high';
    }
    // Medium paths
    if (path.includes('timeout') || path.includes('retry') || path.includes('limit')) {
      return 'medium';
    }
    return 'low';
  }
}
