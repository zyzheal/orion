/**
 * Audit Integrity Verifier
 *
 * 审计日志完整性校验器：
 * - 定期校验（每日）
 * - 链断裂检测
 * - 异常告警
 * - 校验报告生成
 */

import { EventEmitter } from 'events';
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import { AuditLogChain } from './AuditLogChain';
import { ImmutableAuditStorage } from './ImmutableAuditStorage';
import {
import { OrionError } from '../../errors';
  IntegrityReport,
  IntegrityIssue,
  ChainVerificationResult,
  AlertConfig,
  VerificationSchedule,
  DEFAULT_ALERT_CONFIG,
  DEFAULT_VERIFICATION_SCHEDULE,
  ChainedAuditLogEntry,
} from './AuditTypes';

const logger = pino({ level: process.env.LOG_LEVEL || 'info', name: 'integrity-verifier' });

/**
 * 校验选项
 */
interface VerificationOptions {
  startSequence?: number;
  endSequence?: number;
  verifyFiles?: boolean;
  verifySignatures?: boolean;
}

/**
 * 校验结果
 */
interface VerificationResult {
  report: IntegrityReport;
  chainResult?: ChainVerificationResult;
  storageIssues?: string[];
}

/**
 * 告警事件
 */
interface AlertEvent {
  id: string;
  type: 'CHAIN_BREAK' | 'STORAGE_TAMPERING' | 'MISSING_ENTRIES' | 'VERIFICATION_FAILED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  details: Record<string, any>;
  timestamp: Date;
  acknowledged: boolean;
}

/**
 * Audit Integrity Verifier
 */
export class AuditIntegrityVerifier extends EventEmitter {
  private chain: AuditLogChain;
  private storage?: ImmutableAuditStorage;
  private alertConfig: AlertConfig;
  private schedule: VerificationSchedule;
  private verificationTimer?: NodeJS.Timeout;
  private lastVerification?: Date;
  private verificationHistory: IntegrityReport[] = [];
  private alertHistory: AlertEvent[] = [];
  private isRunning: boolean = false;

  constructor(options: {
    chain: AuditLogChain;
    storage?: ImmutableAuditStorage;
    alertConfig?: Partial<AlertConfig>;
    schedule?: Partial<VerificationSchedule>;
  }) {
    super();
    this.chain = options.chain;
    this.storage = options.storage;
    this.alertConfig = { ...DEFAULT_ALERT_CONFIG, ...options.alertConfig };
    this.schedule = { ...DEFAULT_VERIFICATION_SCHEDULE, ...options.schedule };
  }

  /**
   * 启动定期校验
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Verifier is already running');
      return;
    }

    this.isRunning = true;

    // 计算下次校验时间
    const intervalMs = this.parseInterval();
    this.verificationTimer = setInterval(
      () => {
        this.runVerification().catch(err => {
          logger.error({ error: err }, 'Verification failed');
        });
      },
      intervalMs
    );

    logger.info({ intervalMs, cronExpression: this.schedule.cronExpression }, 'Integrity verifier started');
    this.emit('started');
  }

  /**
   * 停止定期校验
   */
  stop(): void {
    if (this.verificationTimer) {
      clearInterval(this.verificationTimer);
      this.verificationTimer = undefined;
    }
    this.isRunning = false;
    logger.info('Integrity verifier stopped');
    this.emit('stopped');
  }

  /**
   * 执行完整校验
   */
  async runVerification(options?: VerificationOptions): Promise<VerificationResult> {
    const startTime = Date.now();
    const reportId = uuidv4();

    logger.info({ reportId, options }, 'Starting integrity verification');

    const issues: IntegrityIssue[] = [];
    let chainResult: ChainVerificationResult | undefined;
    let storageIssues: string[] = [];

    try {
      // 1. 验证链完整性
      chainResult = await this.verifyChain(options);

      // 将链断裂转换为问题
      for (const breakInfo of chainResult.breaks) {
        const issue: IntegrityIssue = {
          type: this.mapBreakTypeToIssueType(breakInfo.breakType),
          severity: this.getBreakSeverity(breakInfo.breakType),
          entryId: breakInfo.entryId,
          sequenceNumber: breakInfo.sequenceNumber,
          description: breakInfo.description,
          details: {
            expectedHash: breakInfo.expectedHash,
            actualHash: breakInfo.actualHash,
          },
        };
        issues.push(issue);
      }

      // 2. 验证存储完整性
      if (this.storage && options?.verifyFiles !== false) {
        storageIssues = await this.verifyStorage(options);

        for (const issue of storageIssues) {
          issues.push({
            type: 'STORAGE_TAMPERING',
            severity: 'HIGH',
            description: issue,
          });
        }
      }

      // 3. 确定状态
      const status = this.determineStatus(issues);

      const durationMs = Date.now() - startTime;

      const report: IntegrityReport = {
        id: reportId,
        verifiedAt: new Date(),
        rangeStart: new Date(), // 可扩展为实际范围
        rangeEnd: new Date(),
        totalEntries: chainResult.totalCount,
        validEntries: chainResult.verifiedCount,
        issues,
        status,
        durationMs,
      };

      // 记录报告
      this.verificationHistory.push(report);
      this.lastVerification = new Date();

      // 发送告警
      if (issues.length > 0 && this.alertConfig.enabled) {
        await this.sendAlerts(issues, report);
      }

      logger.info({
        reportId,
        status,
        issuesCount: issues.length,
        durationMs,
      }, 'Verification completed');

      this.emit('verification:completed', report);

      return { report, chainResult, storageIssues };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage }, 'Verification failed');

      const failedReport: IntegrityReport = {
        id: reportId,
        verifiedAt: new Date(),
        rangeStart: new Date(),
        rangeEnd: new Date(),
        totalEntries: 0,
        validEntries: 0,
        issues: [{
          type: 'CHAIN_BREAK',
          severity: 'CRITICAL',
          description: `Verification failed: ${errorMessage}`,
        }],
        status: 'FAILED',
        durationMs: Date.now() - startTime,
      };

      this.emit('verification:failed', { error: errorMessage, report: failedReport });

      return { report: failedReport };
    }
  }

  /**
   * 验证链完整性
   */
  private async verifyChain(options?: VerificationOptions): Promise<ChainVerificationResult> {
    return this.chain.verifyChain({
      startSequence: options?.startSequence,
      endSequence: options?.endSequence,
    });
  }

  /**
   * 验证存储完整性
   */
  private async verifyStorage(options?: VerificationOptions): Promise<string[]> {
    const issues: string[] = [];

    if (!this.storage) {
      return issues;
    }

    const stats = await this.storage.getStats();
    const chainState = this.chain.getChainState();

    // 检查序列号连续性
    if (stats.lastSequenceNumber !== chainState.lastSequenceNumber) {
      issues.push(
        `Sequence number mismatch: storage has ${stats.lastSequenceNumber}, chain has ${chainState.lastSequenceNumber}`
      );
    }

    // 检查链 Hash 一致性
    if (stats.lastChainHash !== chainState.lastChainHash) {
      issues.push(
        `Chain hash mismatch: storage has ${stats.lastChainHash.substring(0, 8)}..., chain has ${chainState.lastChainHash.substring(0, 8)}...`
      );
    }

    // 验证文件完整性
    const files = await this.getStorageFiles();
    for (const file of files) {
      const result = await this.storage.verifyFileIntegrity(file);
      issues.push(...result.issues);
    }

    return issues;
  }

  /**
   * 获取存储文件列表
   */
  private async getStorageFiles(): Promise<string[]> {
    // 简化实现，返回空数组
    // 实际实现需要从 storage 获取文件列表
    return [];
  }

  /**
   * 发送告警
   */
  private async sendAlerts(issues: IntegrityIssue[], report: IntegrityReport): Promise<void> {
    // 按严重程度分组
    const criticalIssues = issues.filter(i => i.severity === 'CRITICAL');
    const highIssues = issues.filter(i => i.severity === 'HIGH');

    // 只对严重问题发送告警
    if (criticalIssues.length >= this.alertConfig.breakThreshold ||
        highIssues.length >= this.alertConfig.breakThreshold) {

      const alertEvent: AlertEvent = {
        id: uuidv4(),
        type: 'CHAIN_BREAK',
        severity: criticalIssues.length > 0 ? 'CRITICAL' : 'HIGH',
        message: `Audit integrity issues detected: ${issues.length} issues found`,
        details: {
          reportId: report.id,
          issuesCount: issues.length,
          criticalCount: criticalIssues.length,
          highCount: highIssues.length,
          issues: issues.slice(0, 10), // 限制详情数量
        },
        timestamp: new Date(),
        acknowledged: false,
      };

      this.alertHistory.push(alertEvent);
      this.emit('alert', alertEvent);

      // 发送通知
      await this.sendNotification(alertEvent);

      logger.warn({
        alertId: alertEvent.id,
        severity: alertEvent.severity,
        issuesCount: issues.length,
      }, 'Alert sent for integrity issues');
    }
  }

  /**
   * 发送通知
   */
  private async sendNotification(alert: AlertEvent): Promise<void> {
    for (const channel of this.alertConfig.channels) {
      try {
        switch (channel) {
          case 'webhook':
            if (this.alertConfig.webhookUrl) {
              await this.sendWebhookAlert(alert);
            }
            break;
          case 'email':
            if (this.alertConfig.emailRecipients?.length) {
              await this.sendEmailAlert(alert);
            }
            break;
          case 'slack':
            // Slack 集成可以扩展
            logger.info({ alertId: alert.id }, 'Slack alert would be sent here');
            break;
        }
      } catch (error) {
        logger.error({ error, channel }, `Failed to send alert via ${channel}`);
      }
    }
  }

  /**
   * 发送 Webhook 告警
   */
  private async sendWebhookAlert(alert: AlertEvent): Promise<void> {
    if (!this.alertConfig.webhookUrl) return;

    try {
      const response = await fetch(this.alertConfig.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertId: alert.id,
          type: alert.type,
          severity: alert.severity,
          message: alert.message,
          details: alert.details,
          timestamp: alert.timestamp.toISOString(),
        }),
      });

      if (!response.ok) {
        throw new OrionError('OPERATION_FAILED', `Webhook returned ${response.status}`)
      }

      logger.info({ alertId: alert.id }, 'Webhook alert sent successfully');
    } catch (error) {
      logger.error({ error, alertId: alert.id }, 'Failed to send webhook alert');
      throw error;
    }
  }

  /**
   * 发送 Email 告警
   */
  private async sendEmailAlert(alert: AlertEvent): Promise<void> {
    // Email 发送需要集成邮件服务
    // 这里只记录日志
    logger.info({
      alertId: alert.id,
      recipients: this.alertConfig.emailRecipients,
      message: alert.message,
    }, 'Email alert would be sent');
  }

  /**
   * 确认告警
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alertHistory.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit('alert:acknowledged', alert);
      return true;
    }
    return false;
  }

  /**
   * 获取校验历史
   */
  getVerificationHistory(limit?: number): IntegrityReport[] {
    const history = [...this.verificationHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * 获取告警历史
   */
  getAlertHistory(limit?: number): AlertEvent[] {
    const history = [...this.alertHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * 获取未确认告警
   */
  getUnacknowledgedAlerts(): AlertEvent[] {
    return this.alertHistory.filter(a => !a.acknowledged);
  }

  /**
   * 获取上次校验时间
   */
  getLastVerification(): Date | undefined {
    return this.lastVerification;
  }

  /**
   * 是否正在运行
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * 获取校验统计
   */
  getStats(): {
    totalVerifications: number;
    totalAlerts: number;
    unacknowledgedAlerts: number;
    lastVerification?: Date;
    isRunning: boolean;
  } {
    return {
      totalVerifications: this.verificationHistory.length,
      totalAlerts: this.alertHistory.length,
      unacknowledgedAlerts: this.alertHistory.filter(a => !a.acknowledged).length,
      lastVerification: this.lastVerification,
      isRunning: this.isRunning,
    };
  }

  /**
   * 手动触发校验
   */
  async verifyNow(options?: VerificationOptions): Promise<VerificationResult> {
    return this.runVerification(options);
  }

  /**
   * 解析校验间隔
   */
  private parseInterval(): number {
    // 简化实现：默认 24 小时
    // 实际可以从 cron 表达式解析
    return 24 * 60 * 60 * 1000; // 24 小时
  }

  /**
   * 映射断裂类型到问题类型
   */
  private mapBreakTypeToIssueType(
    breakType: 'HASH_MISMATCH' | 'SEQUENCE_GAP' | 'INVALID_SIGNATURE' | 'MODIFIED_CONTENT'
  ): IntegrityIssue['type'] {
    switch (breakType) {
      case 'HASH_MISMATCH':
        return 'CHAIN_BREAK';
      case 'SEQUENCE_GAP':
        return 'MISSING_ENTRIES';
      case 'INVALID_SIGNATURE':
        return 'CHAIN_BREAK';
      case 'MODIFIED_CONTENT':
        return 'MODIFIED_ENTRY';
      default:
        return 'CHAIN_BREAK';
    }
  }

  /**
   * 获取断裂严重程度
   */
  private getBreakSeverity(
    breakType: 'HASH_MISMATCH' | 'SEQUENCE_GAP' | 'INVALID_SIGNATURE' | 'MODIFIED_CONTENT'
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    switch (breakType) {
      case 'HASH_MISMATCH':
        return 'CRITICAL';
      case 'MODIFIED_CONTENT':
        return 'CRITICAL';
      case 'INVALID_SIGNATURE':
        return 'CRITICAL';
      case 'SEQUENCE_GAP':
        return 'HIGH';
      default:
        return 'MEDIUM';
    }
  }

  /**
   * 确定校验状态
   */
  private determineStatus(issues: IntegrityIssue[]): 'PASSED' | 'WARNING' | 'FAILED' {
    if (issues.length === 0) {
      return 'PASSED';
    }

    const critical = issues.filter(i => i.severity === 'CRITICAL').length;
    const high = issues.filter(i => i.severity === 'HIGH').length;

    if (critical > 0) {
      return 'FAILED';
    }

    if (high > 0) {
      return 'WARNING';
    }

    return 'WARNING';
  }
}