/**
 * ConfigDriftDetector - 配置漂移检测服务
 *
 * 检测并报告实际配置与期望配置之间的差异，支持自动修复。
 *
 * 数据持久化：ConfigDriftRepository (PostgreSQL)
 */

import { v4 as uuidv4 } from 'uuid';
import { ConfigDriftRepository, ConfigDriftEntity } from '../../repositories/ConfigDriftRepository';
import { ConfigService } from './ConfigService';
import { OrionError, ErrorCode } from '../../errors';
import { createLogger } from '../utils/logger';

const logger = pino({ name: 'ConfigDriftDetector' });

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
// Converter
// ============================================================

function entityToDriftReport(e: ConfigDriftEntity): DriftReport {
  return {
    id: e.id,
    tenantId: e.tenantId,
    configGroup: e.configGroup,
    driftStatus: e.driftStatus as DriftStatus,
    expectedConfig: (e.expectedConfig as Record<string, unknown>) || {},
    actualConfig: (e.actualConfig as Record<string, unknown>) || {},
    driftItems: ((e.driftItems || []) as Array<Record<string, unknown>>).map((item) => ({
      configKey: (item.configKey as string) || '',
      configGroup: (item.configGroup as string) || undefined,
      path: (item.path as string) || '',
      expectedValue: item.expectedValue,
      actualValue: item.actualValue,
      severity: (item.severity as 'low' | 'medium' | 'high' | 'critical') || 'low',
      description: (item.description as string) || '',
    })),
    totalDrifts: e.totalDrifts,
    criticalDrifts: e.criticalDrifts,
    autoRemediationEnabled: e.autoRemediationEnabled,
    remediationLog: ((e.remediationLog || []) as Array<Record<string, unknown>>).map((entry) => ({
      driftId: (entry.driftId as string) || '',
      configKey: (entry.configKey as string) || '',
      action: (entry.action as string) || '',
      success: (entry.success as boolean) || false,
      error: (entry.error as string) || undefined,
      timestamp: (entry.timestamp as Date) || new Date(),
    })),
    detectedAt: e.detectedAt,
    lastCheckedAt: e.lastCheckedAt,
    createdAt: e.createdAt,
  };
}

// ============================================================
// Service
// ============================================================

export class ConfigDriftDetector {
  private repository: ConfigDriftRepository;
  private configService?: ConfigService;
  private expectedConfigs = new Map<string, Record<string, unknown>>();

  constructor(options: {
    repository?: ConfigDriftRepository;
    configService?: ConfigService;
  } = {}) {
    if (!options.repository) {
      throw new Error('ConfigDriftRepository is required');
    }
    this.repository = options.repository;
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
      await this.saveReport(report);
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

    await this.saveReport(report);
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
    const report = await this.getDriftReportById(driftId);
    if (!report) {
      throw new OrionError(`Drift report '${driftId}' not found`, ErrorCode.NOT_FOUND);
    }

    if (report.driftStatus !== 'drift_detected') {
      throw new OrionError(`Can only remediate drift in 'drift_detected' state (current: ${report.driftStatus})`, 'OPERATION_FAILED')
    }

    report.driftStatus = 'remediating';
    report.lastCheckedAt = new Date();
    await this.saveReport(report);

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

    await this.saveReport(report);
    return { ...report };
  }

  /**
   * 获取漂移报告
   */
  async getDriftReport(tenantId: string, configGroup?: string): Promise<DriftReport | null> {
    const reports = await this.repository.findByTenant(tenantId, configGroup);
    if (reports.length === 0) return null;
    return entityToDriftReport(reports[0]);
  }

  /**
   * 获取所有漂移报告
   */
  async getAllDriftReports(tenantId: string): Promise<DriftReport[]> {
    const reports = await this.repository.findByTenant(tenantId);
    return reports.map(entityToDriftReport);
  }

  // ============================================================
  // Internal Methods
  // ============================================================

  private async saveReport(report: DriftReport): Promise<void> {
    await this.repository.upsert({
      id: report.id,
      tenantId: report.tenantId,
      configGroup: report.configGroup,
      driftStatus: report.driftStatus,
      expectedConfig: report.expectedConfig,
      actualConfig: report.actualConfig,
      driftItems: report.driftItems,
      totalDrifts: report.totalDrifts,
      criticalDrifts: report.criticalDrifts,
      autoRemediationEnabled: report.autoRemediationEnabled,
      remediationLog: report.remediationLog,
      detectedAt: report.detectedAt,
      lastCheckedAt: report.lastCheckedAt,
      createdAt: report.createdAt,
    });
  }

  private async getDriftReportById(id: string): Promise<DriftReport | null> {
    const entity = await this.repository.findById(id);
    if (entity) return entityToDriftReport(entity);
    return null;
  }

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
    if (path.includes('security') || path.includes('auth') || path.includes('credential')) {
      return 'critical';
    }
    if (path.includes('database') || path.includes('connection') || path.includes('port')) {
      return 'high';
    }
    if (path.includes('timeout') || path.includes('retry') || path.includes('limit')) {
      return 'medium';
    }
    return 'low';
  }
}
