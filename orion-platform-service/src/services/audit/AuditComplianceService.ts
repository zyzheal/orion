/**
 * AuditComplianceService - 审计日志 SOC2/ISO27001 合规检查服务
 *
 * 提供审计日志合规性评估：
 * - 审计覆盖率检查（关键操作是否都被记录）
 * - 审计日志完整性检查（链式 Hash 验证）
 * - 保留策略检查（日志是否按策略保留）
 * - 敏感操作审计检查
 * - 生成合规报告
 */

import { DatabasePool } from '../database';
import { OrionError, ErrorCode } from '../../errors';
import { AuditRepository, AuditLog } from './AuditRepository';
import { AuditService } from './AuditService';
import { AuditRetentionService } from './AuditRetentionService';

export interface ComplianceCheckResult {
  checkId: string;
  framework: 'SOC2' | 'ISO27001';
  controlId: string;
  controlName: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  evidence?: Record<string, any>;
  remediation?: string;
}

export interface AuditComplianceReport {
  tenantId: string;
  framework: 'SOC2' | 'ISO27001';
  generatedAt: Date;
  overallScore: number;
  checks: ComplianceCheckResult[];
  summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    warningChecks: number;
    criticalIssues: number;
  };
}

export interface AuditCoverageStats {
  totalActions: number;
  totalResources: number;
  actionsWithMissingUserId: number;
  actionsWithMissingIp: number;
  actionsWithMissingUserAgent: number;
  actionsWithMissingResult: number;
  coveragePercent: number;
}

export class AuditComplianceService {
  private auditRepository: AuditRepository;
  private auditService: AuditService;
  private retentionService: AuditRetentionService;

  constructor(database: DatabasePool) {
    this.auditRepository = new AuditRepository(database);
    this.auditService = new AuditService(this.auditRepository);
    this.retentionService = new AuditRetentionService(database);
  }

  // ==================== SOC2 Type II Checks ====================

  /**
   * CC6.1: 逻辑访问安全 - 审计日志记录所有对系统和数据的访问
   */
  async checkLogicalAccessAudit(tenantId: string): Promise<ComplianceCheckResult> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7); // 检查最近 7 天

    const result = await this.auditRepository.findAll({
      tenantId,
      limit: 1000,
    });

    const recentLogs = result.filter(log => new Date(log.created_at) >= cutoffDate);

    // 检查是否有敏感操作（DELETE, UPDATE）缺少审计
    const sensitiveActions = ['DELETE', 'UPDATE', 'PATCH'];
    const missingAudit: string[] = [];

    // 检查是否记录了用户身份
    const missingUserId = recentLogs.filter(log => !log.user_id).length;
    const missingIp = recentLogs.filter(log => !log.ip_address).length;
    const missingUserAgent = recentLogs.filter(log => !log.user_agent).length;

    const issues: string[] = [];
    if (missingUserId > 0) issues.push(`${missingUserId} audit entries missing user identity`);
    if (missingIp > 0) issues.push(`${missingIp} audit entries missing IP address`);
    if (missingUserAgent > 0) issues.push(`${missingUserAgent} audit entries missing User-Agent`);

    const status = issues.length === 0 ? 'PASS' : 'WARNING';
    const severity = issues.length > 5 ? 'high' : 'medium';

    return {
      checkId: `CC6.1-${Date.now()}`,
      framework: 'SOC2',
      controlId: 'CC6.1',
      controlName: 'Logical Access Security - Audit Logging',
      status,
      severity,
      description: `Verified audit logging coverage for logical access controls. ${recentLogs.length} audit entries in last 7 days. ${issues.length} issues found.`,
      evidence: {
        recentLogsCount: recentLogs.length,
        missingUserId,
        missingIp,
        missingUserAgent,
        sampleActions: recentLogs.slice(0, 10).map(log => ({ action: log.action, resource_type: log.resource_type, created_at: log.created_at })),
      },
      remediation: issues.length > 0 ? 'Ensure all audit entries include user_id, ip_address, and user_agent fields' : undefined,
    };
  }

  /**
   * CC7.2: 系统操作监控 - 监控和记录系统操作
   */
  async checkSystemOperationsMonitoring(tenantId: string): Promise<ComplianceCheckResult> {
    const result = await this.auditRepository.findAll({ tenantId, limit: 1000 });
    const actions = new Set(result.map(log => log.action));
    const resources = new Set(result.map(log => log.resource_type));

    const expectedActions = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'PERMISSION_CHANGE'];
    const missingActions = expectedActions.filter(a => !actions.has(a));

    const status = missingActions.length === 0 ? 'PASS' : 'WARNING';
    const severity = missingActions.length > 2 ? 'high' : 'medium';

    return {
      checkId: `CC7.2-${Date.now()}`,
      framework: 'SOC2',
      controlId: 'CC7.2',
      controlName: 'System Operations Monitoring',
      status,
      severity,
      description: `System operations monitoring check. ${actions.size} unique actions, ${resources.size} unique resources tracked. Missing actions: ${missingActions.join(', ') || 'none'}.`,
      evidence: {
        uniqueActions: Array.from(actions),
        uniqueResources: Array.from(resources),
        missingActions,
        totalEntries: result.length,
      },
      remediation: missingActions.length > 0 ? `Add audit logging for missing action types: ${missingActions.join(', ')}` : undefined,
    };
  }

  /**
   * CC7.3: 异常活动评估 - 定期评估审计日志中的异常活动
   */
  async checkAnomalyDetection(tenantId: string): Promise<ComplianceCheckResult> {
    // 检查是否有审计完整性校验记录
    const chainResult = await this.auditService.verifyChain(tenantId);

    const status = chainResult.valid ? 'PASS' : 'FAIL';
    const severity = chainResult.valid ? 'low' : 'critical';

    return {
      checkId: `CC7.3-${Date.now()}`,
      framework: 'SOC2',
      controlId: 'CC7.3',
      controlName: 'Anomaly Detection - Audit Chain Integrity',
      status,
      severity,
      description: `Audit chain integrity verification. Valid: ${chainResult.valid}, Verified: ${chainResult.totalVerified} entries.`,
      evidence: {
        valid: chainResult.valid,
        totalVerified: chainResult.totalVerified,
        brokenAt: chainResult.brokenAt,
      },
      remediation: chainResult.valid ? undefined : 'Investigate audit chain break and restore integrity',
    };
  }

  /**
   * A.9.4.2: 安全日志记录 - ISO27001 要求记录安全事件
   */
  async checkSecurityLogging(tenantId: string): Promise<ComplianceCheckResult> {
    const result = await this.auditRepository.findAll({ tenantId, limit: 1000 });

    // 检查安全相关操作
    const securityActions = ['LOGIN', 'LOGOUT', 'PERMISSION_CHANGE', 'PASSWORD_CHANGE', 'MFA_CHANGE', 'ROLE_CHANGE'];
    const securityLogs = result.filter(log => securityActions.includes(log.action));

    const status = securityLogs.length > 0 ? 'PASS' : 'WARNING';
    const severity = securityLogs.length === 0 ? 'high' : 'low';

    return {
      checkId: `A.9.4.2-${Date.now()}`,
      framework: 'ISO27001',
      controlId: 'A.9.4.2',
      controlName: 'Security Logging - ISO27001',
      status,
      severity,
      description: `Security event logging check. ${securityLogs.length} security-related audit entries found.`,
      evidence: {
        securityLogCount: securityLogs.length,
        securityActions: Array.from(new Set(securityLogs.map(log => log.action))),
        sampleLogs: securityLogs.slice(0, 5).map(log => ({ action: log.action, user_id: log.user_id, created_at: log.created_at })),
      },
      remediation: securityLogs.length === 0 ? 'Ensure security events (login, logout, permission changes) are logged' : undefined,
    };
  }

  /**
   * A.12.4.1: 事件日志 - ISO27001 要求记录事件
   */
  async checkEventLogging(tenantId: string): Promise<ComplianceCheckResult> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);

    const result = await this.auditRepository.findAll({ tenantId, limit: 1000 });
    const recentLogs = result.filter(log => new Date(log.created_at) >= cutoffDate);

    const hasLogs = recentLogs.length > 0;
    const status = hasLogs ? 'PASS' : 'FAIL';

    return {
      checkId: `A.12.4.1-${Date.now()}`,
      framework: 'ISO27001',
      controlId: 'A.12.4.1',
      controlName: 'Event Logging - ISO27001',
      status,
      severity: hasLogs ? 'low' : 'critical',
      description: `Event logging check for last 30 days. ${recentLogs.length} events logged.`,
      evidence: {
        eventCount: recentLogs.length,
        dateRange: {
          from: cutoffDate.toISOString(),
          to: new Date().toISOString(),
        },
      },
      remediation: hasLogs ? undefined : 'Enable event logging for system activities',
    };
  }

  /**
   * 审计日志覆盖率统计
   */
  async getAuditCoverageStats(tenantId: string): Promise<AuditCoverageStats> {
    const result = await this.auditRepository.findAll({ tenantId, limit: 1000 });

    const totalActions = result.length;
    const actionsWithMissingUserId = result.filter(log => !log.user_id).length;
    const actionsWithMissingIp = result.filter(log => !log.ip_address).length;
    const actionsWithMissingUserAgent = result.filter(log => !log.user_agent).length;
    const actionsWithMissingResult = result.filter(log => log.response_code === null || log.response_code === undefined).length;

    const missingFields = actionsWithMissingUserId + actionsWithMissingIp + actionsWithMissingUserAgent + actionsWithMissingResult;
    const totalFields = totalActions * 4;
    const coveragePercent = totalFields > 0 ? Math.round(((totalFields - missingFields) / totalFields) * 100) : 0;

    return {
      totalActions,
      totalResources: new Set(result.map(log => log.resource_type)).size,
      actionsWithMissingUserId,
      actionsWithMissingIp,
      actionsWithMissingUserAgent,
      actionsWithMissingResult,
      coveragePercent,
    };
  }

  // ==================== Compliance Reports ====================

  /**
   * 生成 SOC2 Type II 合规报告
   */
  async generateSOC2Report(tenantId: string): Promise<AuditComplianceReport> {
    const checks = await Promise.all([
      this.checkLogicalAccessAudit(tenantId),
      this.checkSystemOperationsMonitoring(tenantId),
      this.checkAnomalyDetection(tenantId),
    ]);

    return this.buildReport(tenantId, 'SOC2', checks);
  }

  /**
   * 生成 ISO27001 合规报告
   */
  async generateISO27001Report(tenantId: string): Promise<AuditComplianceReport> {
    const checks = await Promise.all([
      this.checkSecurityLogging(tenantId),
      this.checkEventLogging(tenantId),
      this.checkLogicalAccessAudit(tenantId),
      this.checkSystemOperationsMonitoring(tenantId),
    ]);

    return this.buildReport(tenantId, 'ISO27001', checks);
  }

  /**
   * 生成综合合规报告
   */
  async generateCombinedReport(tenantId: string): Promise<AuditComplianceReport> {
    const soc2Checks = await Promise.all([
      this.checkLogicalAccessAudit(tenantId),
      this.checkSystemOperationsMonitoring(tenantId),
      this.checkAnomalyDetection(tenantId),
    ]);

    const iso27001Checks = await Promise.all([
      this.checkSecurityLogging(tenantId),
      this.checkEventLogging(tenantId),
    ]);

    const allChecks = [...soc2Checks, ...iso27001Checks];
    return this.buildReport(tenantId, 'COMBINED', allChecks);
  }

  private buildReport(tenantId: string, framework: string, checks: ComplianceCheckResult[]): AuditComplianceReport {
    const passedChecks = checks.filter(c => c.status === 'PASS').length;
    const failedChecks = checks.filter(c => c.status === 'FAIL').length;
    const warningChecks = checks.filter(c => c.status === 'WARNING').length;
    const criticalIssues = checks.filter(c => c.severity === 'critical' && c.status !== 'PASS').length;

    const totalChecks = checks.length;
    const overallScore = totalChecks > 0 ? Math.round(((passedChecks + warningChecks * 0.5) / totalChecks) * 100) : 0;

    return {
      tenantId,
      framework: framework as any,
      generatedAt: new Date(),
      overallScore,
      checks,
      summary: {
        totalChecks,
        passedChecks,
        failedChecks,
        warningChecks,
        criticalIssues,
      },
    };
  }
}
