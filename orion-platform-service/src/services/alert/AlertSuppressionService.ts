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
import { MaintenanceWindowRepository, MaintenanceWindowEntity } from '../../repositories/MaintenanceWindowRepository';
import { KnownIssueRepository, KnownIssueEntity } from '../../repositories/KnownIssueRepository';
import { AlertActiveAlertRepository, AlertActiveAlertEntity } from '../../repositories/AlertActiveAlertRepository';
import { SuppressionLogRepository } from '../../repositories/SuppressionLogRepository';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

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
  private maintenanceWindowRepository?: MaintenanceWindowRepository;
  private knownIssueRepository?: KnownIssueRepository;
  private activeAlertRepository?: AlertActiveAlertRepository;
  private suppressionLogRepository?: SuppressionLogRepository;
  // 内存模式回退（用于测试和无 db 场景）
  private activeAlertsMemory: Map<string, Alert> = new Map();
  private maintenanceWindows: Map<string, MaintenanceWindow> = new Map();
  private knownIssues: Map<string, KnownIssue> = new Map();
  private suppressionLogMemory: Array<{
    alertId: string;
    ruleType: SuppressionRuleType;
    reason: string;
    timestamp: Date;
  }> = [];
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    deduplication: AlertDeduplication | undefined,
    correlation: AlertCorrelationService | undefined,
    config: Partial<AlertSuppressionConfig> | undefined,
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.deduplication = deduplication || new AlertDeduplication(db);
    this.correlation = correlation || new AlertCorrelationService(undefined, db);
    this.maintenanceWindowRepository = new MaintenanceWindowRepository(db);
    this.knownIssueRepository = new KnownIssueRepository(db);
    this.activeAlertRepository = new AlertActiveAlertRepository(db);
    this.suppressionLogRepository = new SuppressionLogRepository(db);
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
  async processAlert(alert: Alert): Promise<SuppressionResult> {
    logger.info({ alertId: alert.id, name: alert.name }, 'Processing alert for suppression');

    // 应用抑制规则（按优先级顺序）

    // 1. 维护窗口静默
    if (this.config.maintenanceWindowCheckEnabled) {
      const maintenanceResult = await this.checkMaintenanceWindow(alert);
      if (maintenanceResult.suppressed) {
        await this.logSuppression(alert.id, maintenanceResult.ruleType!, maintenanceResult.reason!);
        return maintenanceResult;
      }
    }

    // 2. 已知问题静默
    if (this.config.knownIssueSuppressionEnabled) {
      const knownIssueResult = await this.checkKnownIssue(alert);
      if (knownIssueResult.suppressed) {
        await this.logSuppression(alert.id, knownIssueResult.ruleType!, knownIssueResult.reason!);
        return knownIssueResult;
      }
    }

    // 3. 重复告警抑制
    const dupResult = this.checkDuplication(alert);
    if (dupResult.suppressed) {
      await this.logSuppression(alert.id, dupResult.ruleType!, dupResult.reason!);
      return dupResult;
    }

    // 4. 根因抑制（级联故障）
    if (this.config.rootCauseSuppressionEnabled) {
      const rootCauseResult = await this.checkRootCauseSuppression(alert);
      if (rootCauseResult.suppressed) {
        await this.logSuppression(alert.id, rootCauseResult.ruleType!, rootCauseResult.reason!);
        return rootCauseResult;
      }
    }

    // 5. 节点故障抑制
    if (this.config.nodeFailureSuppressionEnabled) {
      const nodeResult = await this.checkNodeFailure(alert);
      if (nodeResult.suppressed) {
        await this.logSuppression(alert.id, nodeResult.ruleType!, nodeResult.reason!);
        return nodeResult;
      }
    }

    // 6. 数据库故障抑制
    if (this.config.databaseFailureSuppressionEnabled) {
      const dbResult = await this.checkDatabaseFailure(alert);
      if (dbResult.suppressed) {
        await this.logSuppression(alert.id, dbResult.ruleType!, dbResult.reason!);
        return dbResult;
      }
    }

    // 7. 网络故障抑制
    if (this.config.networkFailureSuppressionEnabled) {
      const networkResult = await this.checkNetworkFailure(alert);
      if (networkResult.suppressed) {
        await this.logSuppression(alert.id, networkResult.ruleType!, networkResult.reason!);
        return networkResult;
      }
    }

    // 未被抑制，保存到活跃告警列表
    await this.saveActiveAlert(alert);

    return {
      suppressed: false,
    };
  }

  /**
   * 批量处理告警
   * 先进行根因分析，再应用抑制规则
   */
  async batchProcess(alerts: Alert[]): Promise<{ processed: number; suppressed: number; unsuppressed: number; rootCauseAnalysis?: RootCauseAnalysis; results: Array<{ alertId: string; result: SuppressionResult }>; }> {
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

      const result = await this.processAlert(alert);
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
  private async checkMaintenanceWindow(alert: Alert): Promise<SuppressionResult> {
    // 优先检查数据库存储
    if (this.maintenanceWindowRepository) {
      const activeWindows = await this.maintenanceWindowRepository.findActive();

      for (const window of activeWindows) {
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
    }

    // 内存模式：检查内存中的维护窗口
    const now = new Date();
    for (const window of this.maintenanceWindows.values()) {
      // 检查时间范围
      if (window.startTime <= now && window.endTime >= now) {
        // 检查范围匹配
        const matchesScope = this.matchesMaintenanceScopeMemory(alert, window);
        if (matchesScope) {
          logger.info(
            { alertId: alert.id, windowId: window.id, windowName: window.name },
            'Alert suppressed by maintenance window (memory)'
          );

          return {
            suppressed: true,
            ruleType: SuppressionRuleType.MAINTENANCE_WINDOW,
            reason: `Maintenance window "${window.name}" is active`,
            maintenanceWindowId: window.id,
          };
        }
      }
    }

    return { suppressed: false };
  }

  /**
   * 检查告警是否匹配维护窗口范围（数据库实体）
   * 空范围（无 sourceTypes/sourceIds/labelSelectors）表示不匹配任何告警
   */
  private matchesMaintenanceScope(alert: Alert, window: MaintenanceWindowEntity): boolean {
    const scope = window.scope || {};

    // Check affected services (sourceTypes)
    if (window.affectedServices && window.affectedServices.length > 0) {
      if (!window.affectedServices.includes(alert.sourceType)) {
        return false;
      }
    }

    // Check sourceIds
    if (scope.sourceIds && scope.sourceIds.length > 0) {
      if (!scope.sourceIds.includes(alert.sourceId)) {
        return false;
      }
    }

    // Check labelSelectors
    if (scope.labelSelectors && Object.keys(scope.labelSelectors).length > 0) {
      for (const [key, value] of Object.entries(scope.labelSelectors)) {
        if (alert.labels?.[key] !== value) {
          return false;
        }
      }
    }

    // If no scope conditions, don't match
    const hasScopeConditions =
      (window.affectedServices && window.affectedServices.length > 0) ||
      (scope.sourceIds && scope.sourceIds.length > 0) ||
      (scope.labelSelectors && Object.keys(scope.labelSelectors).length > 0);

    return Boolean(hasScopeConditions);
  }

  /**
   * 检查告警是否匹配维护窗口范围（内存对象）
   */
  private matchesMaintenanceScopeMemory(alert: Alert, window: MaintenanceWindow): boolean {
    const scope = window.scope || {};

    // 检查 sourceIds 匹配
    if (scope.sourceIds && scope.sourceIds.length > 0) {
      if (!scope.sourceIds.includes(alert.sourceId)) {
        return false;
      }
    }

    // 检查 sourceTypes 匹配
    if (scope.sourceTypes && scope.sourceTypes.length > 0) {
      if (!scope.sourceTypes.includes(alert.sourceType)) {
        return false;
      }
    }

    // 检查 labelSelectors 匹配
    if (scope.labelSelectors && Object.keys(scope.labelSelectors).length > 0) {
      for (const [key, value] of Object.entries(scope.labelSelectors)) {
        if (alert.labels?.[key] !== value) {
          return false;
        }
      }
    }

    // 如果没有任何限制条件，则不匹配任何告警（空 scope = 不抑制）
    const hasScopeConditions =
      (scope.sourceIds && scope.sourceIds.length > 0) ||
      (scope.sourceTypes && scope.sourceTypes.length > 0) ||
      (scope.labelSelectors && Object.keys(scope.labelSelectors).length > 0);

    return Boolean(hasScopeConditions);
  }

  /**
   * 规则2: 已知问题静默
   */
  private async checkKnownIssue(alert: Alert): Promise<SuppressionResult> {
    // 优先检查数据库存储
    if (this.knownIssueRepository) {
      const openIssues = await this.knownIssueRepository.findOpen();

      for (const issue of openIssues) {
        // 检查指纹匹配
        if (alert.fingerprint && alert.fingerprint.includes(issue.fingerprint)) {
          return this.createKnownIssueSuppression(alert, issue);
        }

        // 检查 labelSelectors 匹配
        if (issue.labelSelectors && alert.labels) {
          let matches = true;
          for (const [key, value] of Object.entries(issue.labelSelectors)) {
            if (alert.labels[key] !== value) {
              matches = false;
              break;
            }
          }
          if (matches) {
            return this.createKnownIssueSuppression(alert, issue);
          }
        }
      }
    }

    // 内存模式：检查内存中的已知问题
    for (const issue of this.knownIssues.values()) {
      // 只检查 open 状态的问题
      if (issue.status === 'resolved') {
        continue;
      }

      // 检查 labelSelectors 匹配
      if (issue.labelSelectors) {
        let matches = true;
        for (const [key, value] of Object.entries(issue.labelSelectors)) {
          if (alert.labels?.[key] !== value) {
            matches = false;
            break;
          }
        }
        if (matches) {
          return this.createKnownIssueSuppressionMemory(alert, issue);
        }
      }
    }

    return { suppressed: false };
  }

  /**
   * 创建已知问题抑制结果（数据库实体）
   */
  private createKnownIssueSuppression(alert: Alert, issue: KnownIssueEntity): SuppressionResult {
    const silencedUntil = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4小时静默

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
   * 创建已知问题抑制结果（内存对象）
   */
  private createKnownIssueSuppressionMemory(alert: Alert, issue: KnownIssue): SuppressionResult {
    const silencedUntil = new Date(Date.now() + issue.silenceDuration);

    logger.info(
      { alertId: alert.id, issueId: issue.id, issueTitle: issue.title },
      'Alert suppressed by known issue (memory)'
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
  private async checkRootCauseSuppression(alert: Alert): Promise<SuppressionResult> {
    // 检查是否有根因告警标记
    if (alert.rootCauseAlertId) {
      const rootCauseAlert = await this.getActiveAlert(alert.rootCauseAlertId);

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
      const impactedAlert = await this.getActiveAlert(impactedId);
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
  private async checkNodeFailure(alert: Alert): Promise<SuppressionResult> {
    // 只抑制非节点类型的告警
    if (alert.sourceType === AlertSourceType.NODE) {
      return { suppressed: false };
    }

    // 检查是否有节点故障告警
    const nodeAlerts = await this.getActiveAlertsBySourceType(AlertSourceType.NODE);
    for (const activeAlert of nodeAlerts) {
      if (
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
  private async checkDatabaseFailure(alert: Alert): Promise<SuppressionResult> {
    // 只抑制应用层告警
    if (
      alert.sourceType !== AlertSourceType.APPLICATION &&
      alert.sourceType !== AlertSourceType.SERVICE
    ) {
      return { suppressed: false };
    }

    // 检查是否有数据库故障告警
    const dbAlerts = await this.getActiveAlertsBySourceType(AlertSourceType.DATABASE, AlertSeverity.HIGH);
    for (const activeAlert of dbAlerts) {
      if (
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
  private async checkNetworkFailure(alert: Alert): Promise<SuppressionResult> {
    // 只抑制下游告警
    if (alert.sourceType === AlertSourceType.NETWORK) {
      return { suppressed: false };
    }

    // 检查是否有网络故障告警
    const networkAlerts = await this.getActiveAlertsBySourceType(AlertSourceType.NETWORK, AlertSeverity.HIGH);
    for (const activeAlert of networkAlerts) {
      if (
        activeAlert.status === AlertStatus.FIRING &&
        isSeverityAtLeast(activeAlert.severity, AlertSeverity.HIGH)
      ) {
        // 检查是否在网络故障的下游
        const impacts = this.correlation.getImpactScope(activeAlert.sourceId);
        if (impacts.includes(alert.sourceId)) {
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
  async addMaintenanceWindow(window: Omit<MaintenanceWindow, 'id' | 'createdAt' | 'updatedAt'>): Promise<MaintenanceWindow> {
    const id = uuidv4();
    const now = new Date();

    if (this.maintenanceWindowRepository) {
      const entity = await this.maintenanceWindowRepository.create({
        id,
        tenantId: 'default',
        name: window.name,
        startTime: window.startTime,
        endTime: window.endTime,
        timezone: 'UTC',
        description: null,
        affectedServices: window.scope?.sourceTypes ?? [],
        scope: window.scope ?? null,
        createdBy: null,
        createdAt: now,
        updatedAt: now,
      });

      const newWindow: MaintenanceWindow = {
        ...window,
        id: entity.id,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      };

      logger.info({ windowId: newWindow.id, name: newWindow.name }, 'Maintenance window added');
      return newWindow;
    }

    // 内存模式回退
    const newWindow: MaintenanceWindow = {
      ...window,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.maintenanceWindows.set(newWindow.id, newWindow);
    logger.info({ windowId: newWindow.id, name: newWindow.name }, 'Maintenance window added (memory)');
    return newWindow;
  }

  /**
   * 移除维护窗口
   */
  async removeMaintenanceWindow(windowId: string): Promise<boolean> {
    if (this.maintenanceWindowRepository) {
      const deleted = await this.maintenanceWindowRepository.delete(windowId);
      if (deleted) {
        logger.info({ windowId }, 'Maintenance window removed');
      }
      return deleted;
    }

    // 内存模式回退
    const deleted = this.maintenanceWindows.delete(windowId);
    if (deleted) {
      logger.info({ windowId }, 'Maintenance window removed (memory)');
    }
    return deleted;
  }

  /**
   * 获取活跃维护窗口
   */
  async getActiveMaintenanceWindows(): Promise<MaintenanceWindow[]> {
    if (this.maintenanceWindowRepository) {
      const entities = await this.maintenanceWindowRepository.findActive();
      return entities.map(e => ({
        id: e.id,
        name: e.name,
        startTime: e.startTime,
        endTime: e.endTime,
        scope: { sourceTypes: e.affectedServices },
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      } as MaintenanceWindow));
    }

    // 内存模式回退
    const now = new Date();
    const active: MaintenanceWindow[] = [];
    for (const window of this.maintenanceWindows.values()) {
      if (window.startTime <= now && window.endTime >= now) {
        active.push(window);
      }
    }
    return active;
  }

  /**
   * 添加已知问题
   */
  async addKnownIssue(issue: Omit<KnownIssue, 'id' | 'createdAt' | 'updatedAt'>): Promise<KnownIssue> {
    const id = uuidv4();
    const now = new Date();

    if (this.knownIssueRepository) {
      const entity = await this.knownIssueRepository.create({
        id,
        tenantId: 'default',
        title: issue.title,
        description: issue.description ?? null,
        fingerprint: issue.fingerprintPattern ?? 'unknown',
        labelSelectors: issue.labelSelectors ?? null,
        ticketId: null,
        resolved: false,
        resolvedAt: null,
        createdAt: now,
      });

      const newIssue: KnownIssue = {
        ...issue,
        id: entity.id,
        createdAt: entity.createdAt,
        updatedAt: now,
      };

      logger.info({ issueId: newIssue.id, title: newIssue.title }, 'Known issue added');
      return newIssue;
    }

    // 内存模式回退
    const newIssue: KnownIssue = {
      ...issue,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.knownIssues.set(newIssue.id, newIssue);
    logger.info({ issueId: newIssue.id, title: newIssue.title }, 'Known issue added (memory)');
    return newIssue;
  }

  /**
   * 解决已知问题
   */
  async resolveKnownIssue(issueId: string): Promise<boolean> {
    if (this.knownIssueRepository) {
      const resolved = await this.knownIssueRepository.resolve(issueId);
      if (!resolved) {
        return false;
      }
      logger.info({ issueId }, 'Known issue resolved');
      return true;
    }

    // 内存模式回退
    const issue = this.knownIssues.get(issueId);
    if (!issue) {
      return false;
    }
    issue.status = 'resolved';
    issue.updatedAt = new Date();
    logger.info({ issueId }, 'Known issue resolved (memory)');
    return true;
  }

  /**
   * 获取开放已知问题
   */
  async getOpenKnownIssues(): Promise<KnownIssue[]> {
    if (this.knownIssueRepository) {
      const entities = await this.knownIssueRepository.findOpen();
      return entities.map(e => ({
        id: e.id,
        title: e.title,
        description: e.description ?? undefined,
        fingerprintPattern: e.fingerprint,
        status: 'open' as const,
        silenceDuration: 4 * 60 * 60 * 1000,
        createdAt: e.createdAt,
        updatedAt: e.createdAt,
      } as KnownIssue));
    }

    // 内存模式回退
    const open: KnownIssue[] = [];
    for (const issue of this.knownIssues.values()) {
      if (issue.status === 'open') {
        open.push(issue);
      }
    }
    return open;
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
  async getSuppressionLog(options?: {
    startTime?: Date;
    endTime?: Date;
    ruleType?: SuppressionRuleType;
    limit?: number;
  }): Promise<Array<{
    alertId: string;
    ruleType: SuppressionRuleType;
    reason: string;
    timestamp: Date;
  }>> {
    if (this.suppressionLogRepository) {
      let entities;
      if (options?.startTime && options?.endTime) {
        entities = await this.suppressionLogRepository.findInRange(
          options.startTime, options.endTime, undefined,
        );
      } else if (options?.ruleType) {
        entities = await this.suppressionLogRepository.findByRuleType(
          options.ruleType, undefined, options?.limit || 100,
        );
      } else {
        entities = await this.suppressionLogRepository.findByTenantId(
          'default', options?.limit || 100,
        );
      }

      let log = entities.map(e => ({
        alertId: e.alertId,
        ruleType: e.ruleType as SuppressionRuleType,
        reason: e.reason,
        timestamp: e.loggedAt,
      }));

      // Apply remaining filters
      if (options?.startTime && !options?.endTime) {
        log = log.filter(l => l.timestamp >= options.startTime!);
      }
      if (options?.endTime && !options?.startTime) {
        log = log.filter(l => l.timestamp <= options.endTime!);
      }
      if (options?.ruleType && options?.startTime) {
        log = log.filter(l => l.ruleType === options.ruleType);
      }

      log.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      if (options?.limit) {
        log = log.slice(0, options.limit);
      }
      return log;
    }

    // Memory fallback
    let log = [...this.suppressionLogMemory];

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
  async getStats(): Promise<{
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
  }> {
    const nodeHealth = await this.correlation.getAllNodeHealth();

    // 计算活跃的维护窗口数量
    let activeMaintenanceWindows = 0;
    if (this.maintenanceWindowRepository) {
      const activeWindows = await this.maintenanceWindowRepository.findActive();
      activeMaintenanceWindows = activeWindows.length;
    } else {
      const now = new Date();
      for (const window of this.maintenanceWindows.values()) {
        if (window.startTime <= now && window.endTime >= now) {
          activeMaintenanceWindows++;
        }
      }
    }

    // 计算开放的已知问题数量
    let openKnownIssues = 0;
    if (this.knownIssueRepository) {
      const openIssues = await this.knownIssueRepository.findOpen();
      openKnownIssues = openIssues.length;
    } else {
      for (const issue of this.knownIssues.values()) {
        if (issue.status === 'open') {
          openKnownIssues++;
        }
      }
    }

    // 计算活跃告警和抑制日志数量
    let activeAlertCount = this.activeAlertsMemory.size;
    let suppressionLogSize = this.suppressionLogMemory.length;

    if (this.activeAlertRepository) {
      const counts = await this.activeAlertRepository.countByStatus();
      activeAlertCount = counts.firing;
    }

    return {
      activeAlerts: activeAlertCount,
      maintenanceWindows: activeMaintenanceWindows,
      knownIssues: openKnownIssues,
      suppressionLogSize,
      deduplicationStats: await this.deduplication.getStats() as any,
      nodeHealthStats: {
        healthy: nodeHealth.filter((h: { nodeId: string; status: string }) => h.status === 'healthy').length,
        degraded: nodeHealth.filter((h: { nodeId: string; status: string }) => h.status === 'degraded').length,
        unhealthy: nodeHealth.filter((h: { nodeId: string; status: string }) => h.status === 'unhealthy').length,
      },
    };
  }

  /**
   * 清除告警（已解决）
   */
  async clearAlert(alertId: string): Promise<boolean> {
    if (this.activeAlertRepository) {
      const existing = await this.activeAlertRepository.findById(alertId);
      if (!existing) return false;
      await this.activeAlertRepository.markResolved(alertId);
      logger.info({ alertId }, 'Alert cleared');
      return true;
    }

    const deleted = this.activeAlertsMemory.delete(alertId);
    if (deleted) {
      logger.info({ alertId }, 'Alert cleared');
    }
    return deleted;
  }

  /**
   * 记录抑制日志
   */
  private async logSuppression(alertId: string, ruleType: SuppressionRuleType, reason: string): Promise<void> {
    if (this.suppressionLogRepository) {
      try {
        await this.suppressionLogRepository.create({
          id: uuidv4(),
          tenantId: 'default',
          alertId,
          ruleType,
          reason,
          loggedAt: new Date(),
        } as any);
      } catch (err) {
        logger.error({ traceId: getCurrentTraceId(), err, alertId }, 'Failed to persist suppression log');
      }
    } else {
      this.suppressionLogMemory.push({
        alertId,
        ruleType,
        reason,
        timestamp: new Date(),
      });
      // 限制内存日志大小
      if (this.suppressionLogMemory.length > 10000) {
        this.suppressionLogMemory = this.suppressionLogMemory.slice(-5000);
      }
    }
  }

  /**
   * 清理过期数据
   */
  async cleanup(): Promise<void> {
    // Repository handles expired data cleanup
    if (this.maintenanceWindowRepository) {
      const deleted = await this.maintenanceWindowRepository.deleteExpired();
      if (deleted > 0) {
        logger.info({ count: deleted }, 'Expired maintenance windows removed');
      }
    }

    // 清理已解决的告警（保留24小时）
    if (this.activeAlertRepository) {
      const alertExpiryTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const deleted = await this.activeAlertRepository.deleteResolved(alertExpiryTime);
      if (deleted > 0) {
        logger.info({ count: deleted }, 'Resolved alerts cleaned up from repository');
      }
    } else {
      const now = new Date();
      const alertExpiryTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      for (const [id, alert] of this.activeAlertsMemory.entries()) {
        if (alert.status === AlertStatus.RESOLVED && alert.resolvedAt && alert.resolvedAt < alertExpiryTime) {
          this.activeAlertsMemory.delete(id);
        }
      }
    }
  }

  /**
   * 保存活跃告警到 repository 或内存
   */
  private async saveActiveAlert(alert: Alert): Promise<void> {
    if (this.activeAlertRepository) {
      try {
        await this.activeAlertRepository.create({
          id: alert.id,
          tenantId: alert.tenantId || 'default',
          fingerprint: alert.fingerprint,
          name: alert.name,
          severity: alert.severity,
          status: alert.status,
          sourceType: alert.sourceType,
          sourceId: alert.sourceId,
          sourceName: alert.sourceName,
          labels: alert.labels || {},
          annotations: alert.annotations || {},
          value: alert.value,
          threshold: alert.threshold,
          startsAt: alert.startsAt,
          endsAt: alert.endsAt ?? null,
          resolvedAt: alert.resolvedAt ?? null,
          suppressedAt: alert.suppressedAt ?? null,
          suppressedReason: alert.suppressedReason ?? null,
          rootCauseAlertId: alert.rootCauseAlertId ?? null,
          relatedAlertIds: alert.relatedAlertIds ?? [],
          maintenanceWindowId: alert.maintenanceWindowId ?? null,
          knownIssueId: alert.knownIssueId ?? null,
        } as any);
      } catch (err) {
        logger.error({ traceId: getCurrentTraceId(), err, alertId: alert.id }, 'Failed to persist active alert, falling back to memory');
        this.activeAlertsMemory.set(alert.id, alert);
      }
    } else {
      this.activeAlertsMemory.set(alert.id, alert);
    }
  }

  /**
   * 获取活跃告警（从 repository 或内存）
   */
  private async getActiveAlert(alertId: string): Promise<Alert | undefined> {
    if (this.activeAlertRepository) {
      const entity = await this.activeAlertRepository.findById(alertId);
      if (entity) {
        return this.entityToAlert(entity);
      }
      return undefined;
    }
    return this.activeAlertsMemory.get(alertId);
  }

  /**
   * 按 sourceType 获取活跃告警（从 repository 或内存）
   */
  private async getActiveAlertsBySourceType(
    sourceType: AlertSourceType,
    minSeverity?: AlertSeverity,
  ): Promise<Alert[]> {
    if (this.activeAlertRepository) {
      const entities = await this.activeAlertRepository.findFiringBySourceType(
        sourceType,
        minSeverity,
      );
      return entities.map(e => this.entityToAlert(e));
    }

    // Memory fallback
    const results: Alert[] = [];
    for (const alert of this.activeAlertsMemory.values()) {
      if (alert.sourceType === sourceType && alert.status === AlertStatus.FIRING) {
        if (!minSeverity || isSeverityAtLeast(alert.severity, minSeverity)) {
          results.push(alert);
        }
      }
    }
    return results;
  }

  /**
   * 将 repository entity 转换为 Alert 接口
   */
  private entityToAlert(entity: AlertActiveAlertEntity): Alert {
    return {
      id: entity.id,
      fingerprint: entity.fingerprint,
      name: entity.name,
      severity: entity.severity as AlertSeverity,
      status: entity.status as AlertStatus,
      sourceType: entity.sourceType as AlertSourceType,
      sourceId: entity.sourceId,
      sourceName: entity.sourceName,
      labels: entity.labels,
      annotations: entity.annotations,
      value: entity.value,
      threshold: entity.threshold,
      startsAt: entity.startsAt,
      endsAt: entity.endsAt ?? undefined,
      resolvedAt: entity.resolvedAt ?? undefined,
      suppressedAt: entity.suppressedAt ?? undefined,
      suppressedReason: entity.suppressedReason ?? undefined,
      rootCauseAlertId: entity.rootCauseAlertId ?? undefined,
      relatedAlertIds: entity.relatedAlertIds,
      maintenanceWindowId: entity.maintenanceWindowId ?? undefined,
      knownIssueId: entity.knownIssueId ?? undefined,
      tenantId: entity.tenantId,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  /**
   * 清除所有数据（用于测试）
   */
  async clearAll(): Promise<void> {
    this.activeAlertsMemory.clear();
    this.suppressionLogMemory = [];
    this.maintenanceWindows.clear();
    this.knownIssues.clear();
    await this.deduplication.clearAll();
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