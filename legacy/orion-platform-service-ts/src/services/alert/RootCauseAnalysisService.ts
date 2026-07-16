/**
 * RootCauseAnalysisService - 根因分析服务
 *
 * 功能：
 * 1. 基于拓扑的根因分析
 * 2. 告警关联和去重
 * 3. 根因概率排序
 *
 * 复用 AlertCorrelationService 的告警关联能力
 */

import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../utils/logger';
import { AlertCorrelationService, Alert, AlertGroup } from './AlertCorrelationService';
import { RcaResultRepository, RcaResultEntity } from '../../repositories/RcaResultRepository';
import { ServiceDependencyRepository, ServiceDependencyEntity } from '../../repositories/ServiceDependencyRepository';
import { TimelineEventRepository, TimelineEventEntity } from '../../repositories/TimelineEventRepository';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = createLogger('RootCauseAnalysisService');

// ==================== Types ====================

export interface RcaAffectedService {
  name: string;
  alertCount: number;
  severity: 'critical' | 'warning' | 'info';
}

export interface RcaAlert {
  id: string;
  name: string;
  service: string;
  severity: 'critical' | 'warning' | 'info';
  firedAt: Date;
  message: string;
}

export interface RootCause {
  service: string;
  alertId: string;
  alertName: string;
  confidence: number; // 0-1
  explanation: string;
  category: string;
}

export interface CorrelatedAlert {
  id: string;
  name: string;
  service: string;
  severity: string;
  correlationReason: string;
}

export interface RcaResult {
  analysisId: string;
  tenantId: string;
  status: 'completed' | 'partial' | 'failed';
  affectedServices: RcaAffectedService[];
  correlatedAlerts: CorrelatedAlert[];
  rootCause: RootCause | null;
  topRootCauses: RootCause[];
  topologyPath: string[];
  timeWindowStart: Date;
  timeWindowEnd: Date;
  alertCount: number;
  groupCount: number;
  completedAt: Date;
}

export interface TimeWindow {
  startTime: Date;
  endTime: Date;
}

// ==================== Dependency Graph ====================

export interface ServiceDependency {
  service: string;
  dependsOn: string[];
  dependencyType: 'sync' | 'async' | 'database' | 'cache' | 'external';
}

export interface TimelineEvent {
  timestamp: Date;
  service: string;
  eventType: 'alert_fired' | 'alert_resolved' | 'deployment' | 'config_change' | 'scale_event' | 'anomaly_detected';
  severity: 'critical' | 'warning' | 'info';
  description: string;
  metadata?: Record<string, unknown>;
}

export interface TimelineReport {
  deploymentId: string;
  events: TimelineEvent[];
  timeWindowStart: Date;
  timeWindowEnd: Date;
  totalEvents: number;
  criticalEvents: number;
}

export interface TemporalCorrelationResult {
  correlatedAlerts: CorrelatedAlert[];
  timeCluster: { start: Date; end: Date; alertCount: number };
  burstDetected: boolean;
}

// ==================== Service ====================

export class RootCauseAnalysisService {
  private correlationService: AlertCorrelationService;
  private rcaResultRepository: RcaResultRepository;
  private serviceDependencyRepository: ServiceDependencyRepository;
  private timelineEventRepository: TimelineEventRepository;

  constructor(
    correlationService: AlertCorrelationService,
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {
    this.correlationService = correlationService;
    this.rcaResultRepository = new RcaResultRepository(db);
    this.serviceDependencyRepository = new ServiceDependencyRepository(db);
    this.timelineEventRepository = new TimelineEventRepository(db);
    this.initializeDefaultDependencyGraph();
    logger.info('[RootCauseAnalysisService] Initialized');
  }

  /**
   * 初始化默认依赖图
   */
  private async initializeDefaultDependencyGraph(): Promise<void> {
    const defaultDeps: ServiceDependency[] = [
      { service: 'api-gateway', dependsOn: ['auth-service', 'user-service', 'pipeline-service'], dependencyType: 'sync' },
      { service: 'auth-service', dependsOn: ['user-service', 'redis-cache'], dependencyType: 'sync' },
      { service: 'pipeline-service', dependsOn: ['tekton-controller', 'artifact-registry'], dependencyType: 'sync' },
      { service: 'tekton-controller', dependsOn: ['k8s-api'], dependencyType: 'sync' },
      { service: 'user-service', dependsOn: ['postgres-db'], dependencyType: 'database' },
      { service: 'alert-service', dependsOn: ['prometheus', 'notification-service'], dependencyType: 'async' },
      { service: 'notification-service', dependsOn: ['email-provider', 'slack-webhook'], dependencyType: 'external' },
    ];

    for (const dep of defaultDeps) {
      await this.serviceDependencyRepository.upsertDependency(
        dep.service, 'default', dep.dependsOn, dep.dependencyType,
      );
    }
  }

  /**
   * 执行根因分析
   * @param affectedServices 受影响的服务列表
   * @param alerts 告警列表
   * @param timeWindow 时间窗口
   */
  async analyze(
    affectedServices: string[],
    alerts: RcaAlert[],
    timeWindow: TimeWindow,
    tenantId?: string,
  ): Promise<RcaResult> {
    const analysisId = `rca-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    logger.info(
      { analysisId, alertCount: alerts.length, serviceCount: affectedServices.length },
      '[RootCauseAnalysisService] Starting RCA'
    );

    try {
      // Convert alerts to AlertCorrelationService format
      const correlationAlerts: Alert[] = alerts.map((a) => ({
        id: a.id,
        name: a.name,
        severity: a.severity,
        source: 'observability',
        service: a.service,
        environment: 'production',
        message: a.message,
        labels: { service: a.service, severity: a.severity },
        value: 1,
        firedAt: a.firedAt,
      }));

      // Feed alerts into correlation engine
      const groups = await this.correlationService.addAlerts(correlationAlerts);

      // Get correlation stats and active groups
      const activeGroups = await this.correlationService.getActiveGroups();
      const stats = this.correlationService.getStats();

      // Identify root cause from correlated groups
      const rootCause = this.identifyRootCause(activeGroups, correlationAlerts);

      // Get top root causes with probability ranking
      const topRootCauses = this.computeTopRootCauses(activeGroups, correlationAlerts);

      // Build affected services summary
      const affectedServicesSummary = this.buildAffectedServicesSummary(
        correlationAlerts,
        affectedServices
      );

      // Build correlated alerts list
      const correlatedAlertsList = this.buildCorrelatedAlertsList(activeGroups, rootCause);

      // Determine topology path
      const topologyPath = this.buildTopologyPath(activeGroups);

      const result: RcaResult = {
        analysisId,
        tenantId: tenantId ?? 'default',
        status: rootCause ? 'completed' : 'partial',
        affectedServices: affectedServicesSummary,
        correlatedAlerts: correlatedAlertsList,
        rootCause,
        topRootCauses,
        topologyPath,
        timeWindowStart: timeWindow.startTime,
        timeWindowEnd: timeWindow.endTime,
        alertCount: correlationAlerts.length,
        groupCount: activeGroups.length,
        completedAt: new Date(),
      };

      await this.saveAnalysisResult(result);
      logger.info(
        { analysisId, rootCauseFound: !!rootCause, topCausesCount: topRootCauses.length },
        '[RootCauseAnalysisService] RCA completed'
      );

      return result;
    } catch (error) {
      logger.error({ traceId: getCurrentTraceId(), analysisId, error }, '[RootCauseAnalysisService] RCA failed');

      const failedResult: RcaResult = {
        analysisId,
        tenantId: tenantId ?? 'default',
        status: 'failed',
        affectedServices: [],
        correlatedAlerts: [],
        rootCause: null,
        topRootCauses: [],
        topologyPath: [],
        timeWindowStart: timeWindow.startTime,
        timeWindowEnd: timeWindow.endTime,
        alertCount: alerts.length,
        groupCount: 0,
        completedAt: new Date(),
      };

      await this.saveAnalysisResult(failedResult);
      return failedResult;
    }
  }

  /**
   * 获取关联告警详情
   */
  async getCorrelatedAlerts(alertIds: string[]): Promise<CorrelatedAlert[]> {
    const activeGroups = await this.correlationService.getActiveGroups();
    const correlated: CorrelatedAlert[] = [];

    for (const group of activeGroups) {
      for (const alert of [group.rootAlert, ...group.correlatedAlerts]) {
        if (alertIds.includes(alert.id)) {
          const isRoot = group.rootAlert.id === alert.id;
          correlated.push({
            id: alert.id,
            name: alert.name,
            service: alert.service,
            severity: alert.severity,
            correlationReason: isRoot
              ? 'Root cause alert'
              : `Correlated with ${group.rootAlert.name} (category: ${group.category})`,
          });
        }
      }
    }

    return correlated;
  }

  /**
   * 获取 Top 根因
   */
  async getTopRootCauses(
    tenantId: string,
    timeWindow?: TimeWindow,
    limit: number = 10,
  ): Promise<RootCause[]> {
    const activeGroups = await this.correlationService.getActiveGroups();
    const allCauses: RootCause[] = [];

    for (const group of activeGroups) {
      // Filter by time window if provided
      if (timeWindow) {
        if (
          group.firstFiredAt < timeWindow.startTime ||
          group.firstFiredAt > timeWindow.endTime
        ) {
          continue;
        }
      }

      const rootAlert = group.rootAlert;
      allCauses.push({
        service: rootAlert.service,
        alertId: rootAlert.id,
        alertName: rootAlert.name,
        confidence: this.computeConfidence(group),
        explanation: `Root cause of ${group.totalCount} correlated alerts in category '${group.category}'. Unique services affected: ${group.uniqueServices.join(', ')}`,
        category: group.category,
      });
    }

    // Sort by confidence descending
    allCauses.sort((a, b) => b.confidence - a.confidence);

    return allCauses.slice(0, limit);
  }

  /**
   * 获取分析结果
   */
  async getAnalysis(analysisId: string): Promise<RcaResult | undefined> {
    const entity = await this.rcaResultRepository.findById(analysisId);
    return entity ? this.entityToRcaResult(entity) : undefined;
  }

  /**
   * 获取所有分析结果
   */
  async getAllAnalyses(limit: number = 50): Promise<RcaResult[]> {
    const entities = await this.rcaResultRepository.findByTenantId('default', limit);
    return entities.map(e => this.entityToRcaResult(e));
  }

  /**
   * 获取告警关联服务实例（供外部使用）
   */
  getCorrelationService(): AlertCorrelationService {
    return this.correlationService;
  }

  /**
   * 注册服务依赖关系
   */
  async registerDependency(dep: ServiceDependency): Promise<void> {
    await this.serviceDependencyRepository.upsertDependency(
      dep.service, 'default', dep.dependsOn, dep.dependencyType,
    );
    logger.info({ service: dep.service }, '[RootCauseAnalysisService] Dependency registered');
  }

  /**
   * 获取依赖图
   */
  async getDependencyGraph(): Promise<ServiceDependency[]> {
    const entities = await this.serviceDependencyRepository.findByTenantId('default');
    return entities.map(e => ({
      service: e.id,
      dependsOn: e.dependsOn,
      dependencyType: e.dependencyType as ServiceDependency['dependencyType'],
    }));
  }

  /**
   * 基于依赖图的根因识别
   * 遍历依赖图，找到最底层导致级联故障的服务
   */
  async identifyRootCauseViaDependencyGraph(affectedServices: string[]): Promise<string[]> {
    const candidateRoots: string[] = [];

    for (const service of affectedServices) {
      const upstream = await this.getUpstreamDependencies(service, new Set<string>());
      const affectedUpstream = upstream.filter((s) => affectedServices.includes(s));
      if (affectedUpstream.length === 0) {
        candidateRoots.push(service);
      }
    }

    if (candidateRoots.length === 0) {
      const impactMap = new Map<string, number>();
      for (const service of affectedServices) {
        const downstream = await this.getDownstreamDependents(service);
        const affectedDownstream = downstream.filter((s) => affectedServices.includes(s));
        impactMap.set(service, affectedDownstream.length);
      }
      const maxImpact = Math.max(...Array.from(impactMap.values()), 0);
      for (const [svc, count] of impactMap) {
        if (count === maxImpact) {
          candidateRoots.push(svc);
        }
      }
    }

    return candidateRoots;
  }

  /**
   * 获取上游依赖（递归）
   */
  private async getUpstreamDependencies(service: string, visited: Set<string>): Promise<string[]> {
    if (visited.has(service)) return [];
    visited.add(service);

    const dep = await this.getDependency(service);
    if (!dep) return [];

    const upstream: string[] = [...dep.dependsOn];
    for (const upstreamSvc of dep.dependsOn) {
      upstream.push(...(await this.getUpstreamDependencies(upstreamSvc, visited)));
    }
    return [...new Set(upstream)];
  }

  /**
   * 获取下游依赖该服务的其他服务
   */
  private async getDownstreamDependents(service: string): Promise<string[]> {
    const entities = await this.serviceDependencyRepository.findDependentsOf(service);
    return entities.map(e => e.id);
  }

  /**
   * 时间关联分析 - 找出时间窗口内聚集的告警
   */
  analyzeTemporalCorrelation(
    alerts: RcaAlert[],
    windowMs: number = 300000, // default 5 minutes
  ): TemporalCorrelationResult {
    if (alerts.length === 0) {
      return {
        correlatedAlerts: [],
        timeCluster: { start: new Date(), end: new Date(), alertCount: 0 },
        burstDetected: false,
      };
    }

    const sorted = [...alerts].sort((a, b) => a.firedAt.getTime() - b.firedAt.getTime());

    // Find the densest time window
    let bestStart = sorted[0].firedAt;
    let bestEnd = sorted[0].firedAt;
    let bestCount = 0;

    for (let i = 0; i < sorted.length; i++) {
      const windowEnd = new Date(sorted[i].firedAt.getTime() + windowMs);
      const count = sorted.filter(
        (a) => a.firedAt >= sorted[i].firedAt && a.firedAt <= windowEnd,
      ).length;
      if (count > bestCount) {
        bestCount = count;
        bestStart = sorted[i].firedAt;
        bestEnd = windowEnd;
      }
    }

    // Alerts in the best time cluster
    const clusteredAlerts = sorted.filter(
      (a) => a.firedAt >= bestStart && a.firedAt <= bestEnd,
    );

    const burstDetected = bestCount >= 3; // 3+ alerts in window = burst

    const correlatedAlerts = clusteredAlerts.map((a) => ({
      id: a.id,
      name: a.name,
      service: a.service,
      severity: a.severity,
      correlationReason: burstDetected
        ? `Temporal correlation: fired within ${windowMs / 1000}s window (${bestCount} alerts)`
        : `Fired at ${a.firedAt.toISOString()}`,
    }));

    return {
      correlatedAlerts,
      timeCluster: { start: bestStart, end: bestEnd, alertCount: bestCount },
      burstDetected,
    };
  }

  /**
   * 生成部署时间线报告
   * GET /rca/:deploymentId/timeline
   */
  async generateTimelineReport(
    deploymentId: string,
    timeWindow: { start: Date; end: Date },
    alerts: RcaAlert[] = [],
    deploymentEvents: Array<{ timestamp: Date; description: string; type?: string }> = [],
  ): Promise<TimelineReport> {
    const events: TimelineEvent[] = [];

    // Convert alerts to timeline events
    for (const alert of alerts) {
      events.push({
        timestamp: alert.firedAt,
        service: alert.service,
        eventType: 'alert_fired',
        severity: alert.severity,
        description: alert.message,
        metadata: { alertId: alert.id, alertName: alert.name },
      });
    }

    // Add deployment events
    for (const event of deploymentEvents) {
      events.push({
        timestamp: event.timestamp,
        service: 'deployment',
        eventType: event.type as TimelineEvent['eventType'] || 'deployment',
        severity: 'info',
        description: event.description,
        metadata: { deploymentId },
      });
    }

    // Filter to time window and sort
    const filtered = events
      .filter((e) => e.timestamp >= timeWindow.start && e.timestamp <= timeWindow.end)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Store for retrieval
    // Clear old events for this deployment
    await this.timelineEventRepository.deleteByDeploymentId(deploymentId);
    for (const event of filtered) {
      await this.timelineEventRepository.create({
        id: uuidv4(),
        tenantId: 'default',
        deploymentId,
        eventTimestamp: event.timestamp,
        service: event.service,
        eventType: event.eventType,
        severity: event.severity,
        description: event.description,
        metadata: event.metadata || {},
      });
    }

    const criticalEvents = filtered.filter((e) => e.severity === 'critical').length;

    logger.info(
      { deploymentId, totalEvents: filtered.length, criticalEvents },
      '[RootCauseAnalysisService] Timeline report generated',
    );

    return {
      deploymentId,
      events: filtered,
      timeWindowStart: timeWindow.start,
      timeWindowEnd: timeWindow.end,
      totalEvents: filtered.length,
      criticalEvents,
    };
  }

  /**
   * 获取部署时间线
   */
  async getTimeline(deploymentId: string): Promise<TimelineReport | undefined> {
    const entities = await this.timelineEventRepository.findByDeploymentId(deploymentId);
    if (entities.length === 0) return undefined;
    const events: TimelineEvent[] = entities.map(e => ({
      timestamp: e.eventTimestamp,
      service: e.service,
      eventType: e.eventType as TimelineEvent['eventType'],
      severity: e.severity as TimelineEvent['severity'],
      description: e.description,
      metadata: e.metadata,
    }));

    const criticalEvents = events.filter((e) => e.severity === 'critical').length;
    return {
      deploymentId,
      events,
      timeWindowStart: events.length > 0 ? events[0].timestamp : new Date(),
      timeWindowEnd: events.length > 0 ? events[events.length - 1].timestamp : new Date(),
      totalEvents: events.length,
      criticalEvents,
    };
  }

  // ==================== Private Methods ====================

  /**
   * 识别根因告警
   */
  private identifyRootCause(
    groups: AlertGroup[],
    alerts: Alert[],
  ): RootCause | null {
    if (groups.length === 0 || alerts.length === 0) {
      // Fallback: find the most severe alert
      if (alerts.length === 0) return null;

      const sorted = [...alerts].sort(
        (a, b) => this.severityScore(a.severity) - this.severityScore(b.severity)
      );
      const earliest = sorted[0];

      return {
        service: earliest.service,
        alertId: earliest.id,
        alertName: earliest.name,
        confidence: 0.5,
        explanation: `Earliest and most severe alert: ${earliest.name} on ${earliest.service}`,
        category: 'severity-based',
      };
    }

    // Find the group with the most correlated alerts and highest severity
    let bestGroup = groups[0];
    for (const group of groups) {
      if (this.severityScore(group.severity) < this.severityScore(bestGroup.severity)) {
        bestGroup = group;
      } else if (
        this.severityScore(group.severity) === this.severityScore(bestGroup.severity) &&
        group.totalCount > bestGroup.totalCount
      ) {
        bestGroup = group;
      }
    }

    const rootAlert = bestGroup.rootAlert;
    const confidence = this.computeConfidence(bestGroup);

    return {
      service: rootAlert.service,
      alertId: rootAlert.id,
      alertName: rootAlert.name,
      confidence,
      explanation: `Root cause of ${bestGroup.totalCount} correlated alerts. Category: ${bestGroup.category}. Affected services: ${bestGroup.uniqueServices.join(', ')}. Recommended: ${bestGroup.recommendedAction}`,
      category: bestGroup.category,
    };
  }

  /**
   * 计算 Top 根因（带概率排序）
   */
  private computeTopRootCauses(groups: AlertGroup[], alerts: Alert[]): RootCause[] {
    const causes: RootCause[] = [];

    // From correlation groups
    for (const group of groups) {
      const rootAlert = group.rootAlert;
      causes.push({
        service: rootAlert.service,
        alertId: rootAlert.id,
        alertName: rootAlert.name,
        confidence: this.computeConfidence(group),
        explanation: `Correlated ${group.totalCount} alerts across ${group.uniqueServices.length} services. Category: ${group.category}`,
        category: group.category,
      });
    }

    // From individual alerts not in groups
    const groupedAlertIds = new Set(
      groups.flatMap((g) => [g.rootAlert.id, ...g.correlatedAlerts.map((a) => a.id)])
    );
    for (const alert of alerts) {
      if (!groupedAlertIds.has(alert.id)) {
        causes.push({
          service: alert.service,
          alertId: alert.id,
          alertName: alert.name,
          confidence: 0.3,
          explanation: `Independent alert on ${alert.service}: ${alert.message}`,
          category: 'independent',
        });
      }
    }

    // Sort by confidence
    causes.sort((a, b) => b.confidence - a.confidence);
    return causes.slice(0, 10);
  }

  /**
   * 构建受影响服务摘要
   */
  private buildAffectedServicesSummary(
    alerts: Alert[],
    requestedServices: string[],
  ): RcaAffectedService[] {
    const serviceMap = new Map<string, { count: number; severities: string[] }>();

    for (const alert of alerts) {
      const existing = serviceMap.get(alert.service);
      if (existing) {
        existing.count++;
        existing.severities.push(alert.severity);
      } else {
        serviceMap.set(alert.service, { count: 1, severities: [alert.severity] });
      }
    }

    // Include requested services even if no alerts
    for (const service of requestedServices) {
      if (!serviceMap.has(service)) {
        serviceMap.set(service, { count: 0, severities: [] });
      }
    }

    const result: RcaAffectedService[] = [];
    for (const [name, data] of serviceMap) {
      // Find the highest severity
      let highestSeverity: 'critical' | 'warning' | 'info' = 'info';
      for (const sev of data.severities) {
        if (this.severityScore(sev) < this.severityScore(highestSeverity)) {
          highestSeverity = sev as 'critical' | 'warning' | 'info';
        }
      }

      result.push({
        name,
        alertCount: data.count,
        severity: highestSeverity,
      });
    }

    // Sort by severity then count
    result.sort(
      (a, b) =>
        this.severityScore(a.severity) - this.severityScore(b.severity) ||
        b.alertCount - a.alertCount
    );

    return result;
  }

  /**
   * 构建关联告警列表
   */
  private buildCorrelatedAlertsList(
    groups: AlertGroup[],
    rootCause: RootCause | null,
  ): CorrelatedAlert[] {
    const correlated: CorrelatedAlert[] = [];

    for (const group of groups) {
      const allAlerts = [group.rootAlert, ...group.correlatedAlerts];
      for (const alert of allAlerts) {
        const isRoot = rootCause && alert.id === rootCause.alertId;
        correlated.push({
          id: alert.id,
          name: alert.name,
          service: alert.service,
          severity: alert.severity,
          correlationReason: isRoot
            ? 'Identified root cause'
            : `Correlated in group '${group.category}' with root alert '${group.rootAlert.name}'`,
        });
      }
    }

    return correlated;
  }

  /**
   * 构建拓扑路径
   */
  private buildTopologyPath(groups: AlertGroup[]): string[] {
    // Collect unique services from all groups, ordered by severity
    const services = new Map<string, number>();
    for (const group of groups) {
      for (const service of group.uniqueServices) {
        const current = services.get(service) ?? 10;
        const severityScore = this.severityScore(group.severity);
        if (severityScore < current) {
          services.set(service, severityScore);
        }
      }
    }

    const sorted = Array.from(services.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([name]) => name);

    return sorted;
  }

  /**
   * 计算告警分组的置信度
   */
  private computeConfidence(group: AlertGroup): number {
    let confidence = 0.3; // base confidence

    // More correlated alerts = higher confidence
    confidence += Math.min(group.totalCount * 0.05, 0.3);

    // More unique services affected = higher confidence
    confidence += Math.min(group.uniqueServices.length * 0.05, 0.2);

    // Critical severity = higher confidence
    if (group.severity === 'critical') {
      confidence += 0.2;
    } else if (group.severity === 'warning') {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * 严重程度评分（越小越严重）
   */
  private severityScore(severity: string): number {
    const scores: Record<string, number> = { critical: 1, warning: 2, info: 3 };
    return scores[severity] ?? 4;
  }

  // ==================== Repository Helper Methods ====================

  /**
   * Get a dependency from repository or memory
   */
  private async getDependency(service: string): Promise<ServiceDependency | undefined> {
    const entity = await this.serviceDependencyRepository.findByService(service);
    if (entity) {
      return {
        service: entity.id,
        dependsOn: entity.dependsOn,
        dependencyType: entity.dependencyType as ServiceDependency['dependencyType'],
      };
    }
    return undefined;
  }

  /**
   * Save analysis result to repository or memory
   */
  private async saveAnalysisResult(result: RcaResult): Promise<void> {
    await this.rcaResultRepository.create({
      id: result.analysisId,
      tenantId: result.tenantId,
      status: result.status,
      affectedServices: result.affectedServices as any,
      correlatedAlerts: result.correlatedAlerts as any,
      rootCause: result.rootCause as any,
      topRootCauses: result.topRootCauses as any,
      topologyPath: result.topologyPath,
      timeWindowStart: result.timeWindowStart,
      timeWindowEnd: result.timeWindowEnd,
      alertCount: result.alertCount,
      groupCount: result.groupCount,
      completedAt: result.completedAt,
    });
  }

  /**
   * Convert repository entity to RcaResult
   */
  private entityToRcaResult(entity: RcaResultEntity): RcaResult {
    return {
      analysisId: entity.id,
      tenantId: entity.tenantId,
      status: entity.status as RcaResult['status'],
      affectedServices: entity.affectedServices as any,
      correlatedAlerts: entity.correlatedAlerts as any,
      rootCause: entity.rootCause as any,
      topRootCauses: entity.topRootCauses as any,
      topologyPath: entity.topologyPath,
      timeWindowStart: entity.timeWindowStart,
      timeWindowEnd: entity.timeWindowEnd,
      alertCount: entity.alertCount,
      groupCount: entity.groupCount,
      completedAt: entity.completedAt,
    };
  }
}
