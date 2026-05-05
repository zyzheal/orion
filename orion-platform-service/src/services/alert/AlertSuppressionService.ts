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
  private activeAlerts: Map<string, Alert> = new Map();
  // 内存模式存储（用于测试和无 db 场景）
  private maintenanceWindows: Map<string, MaintenanceWindow> = new Map();
  private knownIssues: Map<string, KnownIssue> = new Map();
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
    config?: Partial<AlertSuppressionConfig>,
    db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.deduplication = deduplication || new AlertDeduplication();
    this.correlation = correlation || new AlertCorrelationService();
    if (db) {
      this.maintenanceWindowRepository = new MaintenanceWindowRepository(db);
      this.knownIssueRepository = new KnownIssueRepository(db);
    }
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
        this.logSuppression(alert.id, maintenanceResult.ruleType!, maintenanceResult.reason!);
        return maintenanceResult;
      }
    }

    // 2. 已知问题静默
    if (this.config.knownIssueSuppressionEnabled) {
      const knownIssueResult = await this.checkKnownIssue(alert);
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
    // Check affected services
    if (window.affectedServices && window.affectedServices.length > 0) {
      // Match if alert source matches any affected service
      if (!window.affectedServices.includes(alert.sourceType)) {
        return false;
      }
    }
    return true;
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

        // 检查标签匹配
        if (alert.labels) {
          const matches = Object.entries(alert.labels).some(
            ([key, value]) => issue.title.includes(key) || issue.fingerprint.includes(String(value))
          );
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

    // 存储到内存（无论是否有 db，内存存储都用于快速访问）
    this.maintenanceWindows.set(newWindow.id, newWindow);

    // 如果有数据库，也持久化
    if (this.maintenanceWindowRepository) {
      // 异步持久化，不阻塞返回
      this.maintenanceWindowRepository['db'].query(
        `INSERT INTO maintenance_windows (id, tenant_id, name, start_time, end_time, affected_services, created_at) VALUES (gen_random_uuid(), 'default', $1, $2, $3, $4, $5) RETURNING *`,
        [window.name, window.startTime, window.endTime, window.scope?.sourceTypes ?? [], new Date()],
      ).catch(err => logger.error({ err }, 'Failed to persist maintenance window'));
    }

    logger.info({ windowId: newWindow.id, name: newWindow.name }, 'Maintenance window added');
    return newWindow;
  }

  /**
   * 移除维护窗口
   */
  removeMaintenanceWindow(windowId: string): boolean {
    const deleted = this.maintenanceWindows.delete(windowId);

    // 如果有数据库，也删除
    if (this.maintenanceWindowRepository) {
      this.maintenanceWindowRepository.delete(windowId).catch(err =>
        logger.error({ err, windowId }, 'Failed to delete maintenance window from db')
      );
    }

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
  addKnownIssue(issue: Omit<KnownIssue, 'id' | 'createdAt' | 'updatedAt'>): KnownIssue {
    const newIssue: KnownIssue = {
      ...issue,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 存储到内存
    this.knownIssues.set(newIssue.id, newIssue);

    // 如果有数据库，也持久化
    if (this.knownIssueRepository) {
      this.knownIssueRepository['db'].query(
        `INSERT INTO known_issues (id, tenant_id, title, description, fingerprint, resolved, created_at) VALUES (gen_random_uuid(), 'default', $1, $2, $3, false, $4) RETURNING *`,
        [issue.title, issue.description ?? null, issue.fingerprintPattern ?? 'unknown', new Date()],
      ).catch(err => logger.error({ err }, 'Failed to persist known issue'));
    }

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
    issue.updatedAt = new Date();

    // 如果有数据库，也更新
    if (this.knownIssueRepository) {
      this.knownIssueRepository.resolve(issueId).catch(err =>
        logger.error({ err, issueId }, 'Failed to resolve known issue in db')
      );
    }

    logger.info({ issueId }, 'Known issue resolved');
    return true;
  }

  /**
   * 获取开放已知问题
   */
  getOpenKnownIssues(): KnownIssue[] {
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

    // 计算活跃的维护窗口和已知问题数量
    const now = new Date();
    let activeMaintenanceWindows = 0;
    for (const window of this.maintenanceWindows.values()) {
      if (window.startTime <= now && window.endTime >= now) {
        activeMaintenanceWindows++;
      }
    }

    let openKnownIssues = 0;
    for (const issue of this.knownIssues.values()) {
      if (issue.status === 'open') {
        openKnownIssues++;
      }
    }

    return {
      activeAlerts: this.activeAlerts.size,
      maintenanceWindows: activeMaintenanceWindows,
      knownIssues: openKnownIssues,
      suppressionLogSize: this.suppressionLog.length,
      deduplicationStats: this.deduplication.getStats(),
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
  async cleanup(): Promise<void> {
    // Repository handles expired data cleanup
    if (this.maintenanceWindowRepository) {
      const deleted = await this.maintenanceWindowRepository.deleteExpired();
      if (deleted > 0) {
        logger.info({ count: deleted }, 'Expired maintenance windows removed');
      }
    }

    // 清理已解决的告警（保留24小时）
    const now = new Date();
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
    this.activeAlerts.clear();
    this.suppressionLog = [];
    this.maintenanceWindows.clear();
    this.knownIssues.clear();
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