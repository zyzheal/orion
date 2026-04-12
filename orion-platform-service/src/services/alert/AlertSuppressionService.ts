/**
 * AlertSuppressionService - 告警抑制服务
 *
 * 抑制规则：
 * 1. 维护窗口静默 - 维护期间不发送告警
 * 2. 节点故障抑制 - 节点故障时抑制所有相关告警
 * 3. 数据库故障抑制 - DB故障时抑制应用层告警
 * 4. 网络故障抑制 - 网络故障时抑制下游告警
 * 5. 根因优先 - 级联故障只报告根因
 * 6. 重复合并 - 4小时内相同告警不重复通知
 * 7. 已知问题静默 - 关联已知 Issue 时静默
 */

import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';
import {
  Alert,
  AlertSourceType,
  AlertSeverity,
  AlertStatus,
  MaintenanceWindow,
  KnownIssue,
  SuppressionResult,
  SuppressionRuleType,
  RootCauseAnalysis,
} from './AlertTypes';
import { AlertDeduplication } from './AlertDeduplication';
import { AlertCorrelationService } from './AlertCorrelationService';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * 告警严重程度优先级（数值越小越严重）
 */
const SEVERITY_PRIORITY: Record<AlertSeverity, number> = {
  [AlertSeverity.CRITICAL]: 1,
  [AlertSeverity.HIGH]: 2,
  [AlertSeverity.MEDIUM]: 3,
  [AlertSeverity.LOW]: 4,
  [AlertSeverity.INFO]: 5,
};

/**
 * 比较严重程度：返回 true 如果 severity >= threshold（即 severity 不比 threshold 严重）
 */
function isSeverityAtLeast(severity: AlertSeverity, threshold: AlertSeverity): boolean {
  return SEVERITY_PRIORITY[severity] <= SEVERITY_PRIORITY[threshold];
}

/**
 * 告警抑制配置
 */
export interface AlertSuppressionConfig {
  deduplicationWindowMs: number; // 去重窗口
  maintenanceWindowCheckEnabled: boolean;
  nodeFailureSuppressionEnabled: boolean;
  databaseFailureSuppressionEnabled: boolean;
  networkFailureSuppressionEnabled: boolean;
  rootCauseSuppressionEnabled: boolean;
  knownIssueSuppressionEnabled: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: AlertSuppressionConfig = {
  deduplicationWindowMs: 4 * 60 * 60 * 1000, // 4小时
  maintenanceWindowCheckEnabled: true,
  nodeFailureSuppressionEnabled: true,
  databaseFailureSuppressionEnabled: true,
  networkFailureSuppressionEnabled: true,
  rootCauseSuppressionEnabled: true,
  knownIssueSuppressionEnabled: true,
};

/**
 * 告警抑制服务
 */
export class AlertSuppressionService {
  private config: AlertSuppressionConfig;
  private deduplication: AlertDeduplication;
  private correlation: AlertCorrelationService;
  private maintenanceWindows: Map<string, MaintenanceWindow> = new Map();
  private knownIssues: Map<string, KnownIssue> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private suppressionLog: Array<{
    alertId: string;
    ruleType: SuppressionRuleType;
    reason: string;
    timestamp: Date;
  }> = [];
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    deduplication?: AlertDeduplication,
    correlation?: AlertCorrelationService,
    config?: Partial<AlertSuppressionConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.deduplication = deduplication || new AlertDeduplication();
    this.correlation = correlation || new AlertCorrelationService();
  }

  /**
   * 启动服务
   */
  start(): void {
    this.deduplication.start();

    // 启动清理定时器
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000);

    logger.info('AlertSuppressionService started');
  }

  /**
   * 停止服务
   */
  stop(): void {
    this.deduplication.stop();

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    logger.info('AlertSuppressionService stopped');
  }

  /**
   * 处理告警
   * 应用所有抑制规则，返回处理结果
   */
  processAlert(alert: Alert): SuppressionResult {
    logger.info({ alertId: alert.id, name: alert.name }, 'Processing alert for suppression');

    // 应用抑制规则（按优先级顺序）

    // 1. 维护窗口静默
    if (this.config.maintenanceWindowCheckEnabled) {
      const maintenanceResult = this.checkMaintenanceWindow(alert);
      if (maintenanceResult.suppressed) {
        this.logSuppression(alert.id, maintenanceResult.ruleType!, maintenanceResult.reason!);
        return maintenanceResult;
      }
    }

    // 2. 已知问题静默
    if (this.config.knownIssueSuppressionEnabled) {
      const knownIssueResult = this.checkKnownIssue(alert);
      if (knownIssueResult.suppressed) {
        this.logSuppression(alert.id, knownIssueResult.ruleType!, knownIssueResult.reason!);
        return knownIssueResult;
      }
    }

    // 3. 重复告警抑制
    const dupResult = this.checkDuplication(alert);
    if (dupResult.suppressed) {
      this.logSuppression(alert.id, dupResult.ruleType!, dupResult.reason!);
      return dupResult;
    }

    // 4. 根因抑制（级联故障）
    if (this.config.rootCauseSuppressionEnabled) {
      const rootCauseResult = this.checkRootCauseSuppression(alert);
      if (rootCauseResult.suppressed) {
        this.logSuppression(alert.id, rootCauseResult.ruleType!, rootCauseResult.reason!);
        return rootCauseResult;
      }
    }

    // 5. 节点故障抑制
    if (this.config.nodeFailureSuppressionEnabled) {
      const nodeResult = this.checkNodeFailure(alert);
      if (nodeResult.suppressed) {
        this.logSuppression(alert.id, nodeResult.ruleType!, nodeResult.reason!);
        return nodeResult;
      }
    }

    // 6. 数据库故障抑制
    if (this.config.databaseFailureSuppressionEnabled) {
      const dbResult = this.checkDatabaseFailure(alert);
      if (dbResult.suppressed) {
        this.logSuppression(alert.id, dbResult.ruleType!, dbResult.reason!);
        return dbResult;
      }
    }

    // 7. 网络故障抑制
    if (this.config.networkFailureSuppressionEnabled) {
      const networkResult = this.checkNetworkFailure(alert);
      if (networkResult.suppressed) {
        this.logSuppression(alert.id, networkResult.ruleType!, networkResult.reason!);
        return networkResult;
      }
    }

    // 未被抑制，保存到活跃告警列表
    this.activeAlerts.set(alert.id, alert);

    return {
      suppressed: false,
    };
  }

  /**
   * 批量处理告警
   * 先进行根因分析，再应用抑制规则
   */
  batchProcess(alerts: Alert[]): {
    processed: number;
    suppressed: number;
    unsuppressed: number;
    rootCauseAnalysis?: RootCauseAnalysis;
    results: Array<{ alertId: string; result: SuppressionResult }>;
  } {
    // 更新拓扑健康状态
    this.correlation.updateNodeHealth(alerts);

    // 进行根因分析
    const rootCauseAnalysis = this.correlation.analyzeRootCause(alerts);

    // 处理每个告警
    const results: Array<{ alertId: string; result: SuppressionResult }> = [];
    let suppressed = 0;
    let unsuppressed = 0;

    for (const alert of alerts) {
      // 如果有根因分析结果，标记相关告警
      if (rootCauseAnalysis) {
        if (rootCauseAnalysis.affectedAlertIds.includes(alert.id)) {
          alert.rootCauseAlertId = rootCauseAnalysis.rootCauseAlertId;
        }
      }

      const result = this.processAlert(alert);
      results.push({ alertId: alert.id, result });

      if (result.suppressed) {
        suppressed++;
      } else {
        unsuppressed++;
      }
    }

    return {
      processed: alerts.length,
      suppressed,
      unsuppressed,
      rootCauseAnalysis: rootCauseAnalysis ?? undefined,
      results,
    };
  }

  // ==================== 抑制规则 ====================

  /**
   * 规则1: 维护窗口静默
   */
  private checkMaintenanceWindow(alert: Alert): SuppressionResult {
    const now = new Date();

    for (const window of this.maintenanceWindows.values()) {
      // 检查时间范围
      if (now < window.startTime || now > window.endTime) {
        continue;
      }

      // 检查范围匹配
      const matchesScope = this.matchesMaintenanceScope(alert, window);
      if (matchesScope) {
        logger.info(
          { alertId: alert.id, windowId: window.id, windowName: window.name },
          'Alert suppressed by maintenance window'
        );

        return {
          suppressed: true,
          ruleType: SuppressionRuleType.MAINTENANCE_WINDOW,
          reason: `Maintenance window "${window.name}" is active`,
          maintenanceWindowId: window.id,
        };
      }
    }

    return { suppressed: false };
  }

  /**
   * 检查告警是否匹配维护窗口范围
   * 空范围（无 sourceTypes/sourceIds/labelSelectors）表示不匹配任何告警
   */
  private matchesMaintenanceScope(alert: Alert, window: MaintenanceWindow): boolean {
    const scope = window.scope;

    // 如果没有任何范围定义，则不匹配任何告警
    if (!scope.sourceTypes && !scope.sourceIds && !scope.labelSelectors) {
      return false;
    }

    // 检查来源类型
    if (scope.sourceTypes) {
      if (!scope.sourceTypes.includes(alert.sourceType)) {
        return false;
      }
    }

    // 检查来源 ID
    if (scope.sourceIds) {
      if (!scope.sourceIds.includes(alert.sourceId)) {
        return false;
      }
    }

    // 检查标签选择器
    if (scope.labelSelectors) {
      for (const [key, value] of Object.entries(scope.labelSelectors)) {
        if (alert.labels[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * 规则2: 已知问题静默
   */
  private checkKnownIssue(alert: Alert): SuppressionResult {
    for (const issue of this.knownIssues.values()) {
      if (issue.status !== 'open') {
        continue;
      }

      // 检查指纹模式匹配
      if (issue.fingerprintPattern) {
        if (alert.fingerprint && alert.fingerprint.match(issue.fingerprintPattern)) {
          return this.createKnownIssueSuppression(alert, issue);
        }
      }

      // 检查标签选择器匹配
      if (issue.labelSelectors) {
        const matches = Object.entries(issue.labelSelectors).every(
          ([key, value]) => alert.labels[key] === value
        );
        if (matches) {
          return this.createKnownIssueSuppression(alert, issue);
        }
      }
    }

    return { suppressed: false };
  }

  /**
   * 创建已知问题抑制结果
   */
  private createKnownIssueSuppression(alert: Alert, issue: KnownIssue): SuppressionResult {
    const silencedUntil = new Date(Date.now() + issue.silenceDuration);

    logger.info(
      { alertId: alert.id, issueId: issue.id, issueTitle: issue.title },
      'Alert suppressed by known issue'
    );

    return {
      suppressed: true,
      ruleType: SuppressionRuleType.KNOWN_ISSUE,
      reason: `Known issue "${issue.title}" is open`,
      knownIssueId: issue.id,
      silencedUntil,
    };
  }

  /**
   * 规则3: 重复告警抑制
   */
  private checkDuplication(alert: Alert): SuppressionResult {
    const fingerprint = this.deduplication.generateFingerprint(alert).fingerprint;

    if (this.deduplication.isDuplicate(fingerprint)) {
      logger.info(
        { alertId: alert.id, fingerprint },
        'Alert suppressed due to duplication'
      );

      return {
        suppressed: true,
        ruleType: SuppressionRuleType.DUPLICATION,
        reason: 'Duplicate alert within deduplication window',
      };
    }

    // 记录指纹
    this.deduplication.recordFingerprint(fingerprint);

    return { suppressed: false };
  }

  /**
   * 规则4: 根因抑制（级联故障）
   */
  private checkRootCauseSuppression(alert: Alert): SuppressionResult {
    // 检查是否有根因告警标记
    if (alert.rootCauseAlertId) {
      const rootCauseAlert = this.activeAlerts.get(alert.rootCauseAlertId);

      if (rootCauseAlert) {
        logger.info(
          { alertId: alert.id, rootCauseAlertId: alert.rootCauseAlertId },
          'Alert suppressed as cascade failure'
        );

        return {
          suppressed: true,
          ruleType: SuppressionRuleType.ROOT_CAUSE,
          reason: `Cascade failure from root cause: ${rootCauseAlert.name}`,
          relatedAlertId: alert.rootCauseAlertId,
        };
      }
    }

    // 检查是否是下游告警（基于拓扑）
    const impactScope = this.correlation.getImpactScope(alert.sourceId);

    // 检查影响范围内是否有更严重的告警
    for (const impactedId of impactScope) {
      const impactedAlert = this.activeAlerts.get(impactedId);
      if (impactedAlert && impactedAlert.id !== alert.id) {
        // 如果有上游告警，抑制此告警
        const deps = this.correlation.getDependencies(alert.sourceId);
        if (deps.includes(impactedId)) {
          return {
            suppressed: true,
            ruleType: SuppressionRuleType.ROOT_CAUSE,
            reason: `Downstream of active alert: ${impactedAlert.name}`,
            relatedAlertId: impactedAlert.id,
          };
        }
      }
    }

    return { suppressed: false };
  }

  /**
   * 规则5: 节点故障抑制
   */
  private checkNodeFailure(alert: Alert): SuppressionResult {
    // 只抑制非节点类型的告警
    if (alert.sourceType === AlertSourceType.NODE) {
      return { suppressed: false };
    }

    // 检查是否有节点故障告警
    for (const activeAlert of this.activeAlerts.values()) {
      if (
        activeAlert.sourceType === AlertSourceType.NODE &&
        activeAlert.status === AlertStatus.FIRING &&
        activeAlert.severity === AlertSeverity.CRITICAL
      ) {
        // 检查是否相关
        const deps = this.correlation.getDependencies(alert.sourceId);
        if (deps.includes(activeAlert.sourceId)) {
          logger.info(
            { alertId: alert.id, nodeAlertId: activeAlert.id },
            'Alert suppressed due to node failure'
          );

          return {
            suppressed: true,
            ruleType: SuppressionRuleType.NODE_FAILURE,
            reason: `Node failure: ${activeAlert.sourceName}`,
            relatedAlertId: activeAlert.id,
          };
        }
      }
    }

    return { suppressed: false };
  }

  /**
   * 规则6: 数据库故障抑制
   */
  private checkDatabaseFailure(alert: Alert): SuppressionResult {
    // 只抑制应用层告警
    if (
      alert.sourceType !== AlertSourceType.APPLICATION &&
      alert.sourceType !== AlertSourceType.SERVICE
    ) {
      return { suppressed: false };
    }

    // 检查是否有数据库故障告警
    for (const activeAlert of this.activeAlerts.values()) {
      if (
        activeAlert.sourceType === AlertSourceType.DATABASE &&
        activeAlert.status === AlertStatus.FIRING &&
        isSeverityAtLeast(activeAlert.severity, AlertSeverity.HIGH)
      ) {
        // 检查是否依赖此数据库
        const deps = this.correlation.getDependencies(alert.sourceId);
        if (deps.includes(activeAlert.sourceId)) {
          logger.info(
            { alertId: alert.id, dbAlertId: activeAlert.id },
            'Alert suppressed due to database failure'
          );

          return {
            suppressed: true,
            ruleType: SuppressionRuleType.DATABASE_FAILURE,
            reason: `Database failure: ${activeAlert.sourceName}`,
            relatedAlertId: activeAlert.id,
          };
        }
      }
    }

    return { suppressed: false };
  }

  /**
   * 规则7: 网络故障抑制
   */
  private checkNetworkFailure(alert: Alert): SuppressionResult {
    // 只抑制下游告警
    if (alert.sourceType === AlertSourceType.NETWORK) {
      return { suppressed: false };
    }

    // 检查是否有网络故障告警
    for (const activeAlert of this.activeAlerts.values()) {
      if (
        activeAlert.sourceType === AlertSourceType.NETWORK &&
        activeAlert.status === AlertStatus.FIRING &&
        isSeverityAtLeast(activeAlert.severity, AlertSeverity.HIGH)
      ) {
        // 检查是否在网络故障的下游
        const deps = this.correlation.getDependencies(alert.sourceId);
        if (deps.includes(activeAlert.sourceId)) {
          logger.info(
            { alertId: alert.id, networkAlertId: activeAlert.id },
            'Alert suppressed due to network failure'
          );

          return {
            suppressed: true,
            ruleType: SuppressionRuleType.NETWORK_FAILURE,
            reason: `Network failure: ${activeAlert.sourceName}`,
            relatedAlertId: activeAlert.id,
          };
        }
      }
    }

    return { suppressed: false };
  }

  // ==================== 管理接口 ====================

  /**
   * 添加维护窗口
   */
  addMaintenanceWindow(window: Omit<MaintenanceWindow, 'id' | 'createdAt' | 'updatedAt'>): MaintenanceWindow {
    const newWindow: MaintenanceWindow = {
      ...window,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.maintenanceWindows.set(newWindow.id, newWindow);

    logger.info({ windowId: newWindow.id, name: newWindow.name }, 'Maintenance window added');

    return newWindow;
  }

  /**
   * 移除维护窗口
   */
  removeMaintenanceWindow(windowId: string): boolean {
    const deleted = this.maintenanceWindows.delete(windowId);

    if (deleted) {
      logger.info({ windowId }, 'Maintenance window removed');
    }

    return deleted;
  }

  /**
   * 获取活跃维护窗口
   */
  getActiveMaintenanceWindows(): MaintenanceWindow[] {
    const now = new Date();

    return Array.from(this.maintenanceWindows.values()).filter(
      (w) => w.startTime <= now && w.endTime >= now
    );
  }

  /**
   * 添加已知问题
   */
  addKnownIssue(issue: Omit<KnownIssue, 'id' | 'createdAt' | 'updatedAt'>): KnownIssue {
    const newIssue: KnownIssue = {
      ...issue,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.knownIssues.set(newIssue.id, newIssue);

    logger.info({ issueId: newIssue.id, title: newIssue.title }, 'Known issue added');

    return newIssue;
  }

  /**
   * 解决已知问题
   */
  resolveKnownIssue(issueId: string): boolean {
    const issue = this.knownIssues.get(issueId);

    if (!issue) {
      return false;
    }

    issue.status = 'resolved';
    issue.resolvedAt = new Date();
    issue.updatedAt = new Date();

    logger.info({ issueId }, 'Known issue resolved');

    return true;
  }

  /**
   * 获取开放已知问题
   */
  getOpenKnownIssues(): KnownIssue[] {
    return Array.from(this.knownIssues.values()).filter((i) => i.status === 'open');
  }

  /**
   * 设置拓扑图
   */
  setTopology(topology: {
    nodes: Array<{ id: string; type: AlertSourceType; name: string; parentId?: string }>;
    edges: Array<{ source: string; target: string; relationType: string }>;
  }): void {
    this.correlation.setTopology({
      nodes: topology.nodes.map((n) => ({
        ...n,
        status: 'healthy',
      })),
      edges: topology.edges.map((e) => ({
        ...e,
        relationType: e.relationType as 'depends_on' | 'runs_on' | 'connected_to',
      })),
    });
  }

  /**
   * 获取抑制日志
   */
  getSuppressionLog(options?: {
    startTime?: Date;
    endTime?: Date;
    ruleType?: SuppressionRuleType;
    limit?: number;
  }): Array<{
    alertId: string;
    ruleType: SuppressionRuleType;
    reason: string;
    timestamp: Date;
  }> {
    let log = [...this.suppressionLog];

    if (options?.startTime) {
      log = log.filter((l) => l.timestamp >= options.startTime!);
    }

    if (options?.endTime) {
      log = log.filter((l) => l.timestamp <= options.endTime!);
    }

    if (options?.ruleType) {
      log = log.filter((l) => l.ruleType === options.ruleType);
    }

    log.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (options?.limit) {
      log = log.slice(0, options.limit);
    }

    return log;
  }

  /**
   * 获取统计数据
   */
  getStats(): {
    activeAlerts: number;
    maintenanceWindows: number;
    knownIssues: number;
    suppressionLogSize: number;
    deduplicationStats: ReturnType<AlertDeduplication['getStats']>;
    nodeHealthStats: {
      healthy: number;
      degraded: number;
      unhealthy: number;
    };
  } {
    const nodeHealth = this.correlation.getAllNodeHealth();

    return {
      activeAlerts: this.activeAlerts.size,
      maintenanceWindows: this.maintenanceWindows.size,
      knownIssues: this.knownIssues.size,
      suppressionLogSize: this.suppressionLog.length,
      deduplicationStats: this.deduplication.getStats(),
      nodeHealthStats: {
        healthy: nodeHealth.filter((h) => h.status === 'healthy').length,
        degraded: nodeHealth.filter((h) => h.status === 'degraded').length,
        unhealthy: nodeHealth.filter((h) => h.status === 'unhealthy').length,
      },
    };
  }

  /**
   * 清除告警（已解决）
   */
  clearAlert(alertId: string): boolean {
    const deleted = this.activeAlerts.delete(alertId);

    if (deleted) {
      logger.info({ alertId }, 'Alert cleared');
    }

    return deleted;
  }

  /**
   * 记录抑制日志
   */
  private logSuppression(alertId: string, ruleType: SuppressionRuleType, reason: string): void {
    this.suppressionLog.push({
      alertId,
      ruleType,
      reason,
      timestamp: new Date(),
    });

    // 限制日志大小
    if (this.suppressionLog.length > 10000) {
      this.suppressionLog = this.suppressionLog.slice(-5000);
    }
  }

  /**
   * 清理过期数据
   */
  cleanup(): void {
    const now = new Date();

    // 清理过期的维护窗口
    for (const [id, window] of this.maintenanceWindows.entries()) {
      if (window.endTime < now) {
        this.maintenanceWindows.delete(id);
        logger.info({ windowId: id }, 'Expired maintenance window removed');
      }
    }

    // 清理已解决的告警（保留24小时）
    const alertExpiryTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    for (const [id, alert] of this.activeAlerts.entries()) {
      if (alert.status === AlertStatus.RESOLVED && alert.resolvedAt && alert.resolvedAt < alertExpiryTime) {
        this.activeAlerts.delete(id);
      }
    }
  }

  /**
   * 清除所有数据（用于测试）
   */
  clearAll(): void {
    this.maintenanceWindows.clear();
    this.knownIssues.clear();
    this.activeAlerts.clear();
    this.suppressionLog = [];
    this.deduplication.clearAll();
  }

  /**
   * 获取去重服务（用于直接访问）
   */
  getDeduplication(): AlertDeduplication {
    return this.deduplication;
  }

  /**
   * 获取关联分析服务（用于直接访问）
   */
  getCorrelation(): AlertCorrelationService {
    return this.correlation;
  }
}