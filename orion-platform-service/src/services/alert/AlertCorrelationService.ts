/**
 * AlertCorrelationService - 告警关联分析服务
 *
 * 功能：
 * - 告警关联分析
 * - 根因定位（基于拓扑图）
 * - 影响范围计算
 */

import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';
import {
  Alert,
  AlertSourceType,
  AlertTopologyGraph,
  AlertTopologyNode,
  AlertTopologyEdge,
  RootCauseAnalysis,
  AlertSeverity,
} from './AlertTypes';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * 拓扑节点健康状态
 */
interface NodeHealthStatus {
  nodeId: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  alertCount: number;
  criticalAlertCount: number;
  lastAlertAt?: Date;
}

/**
 * 告警关联分析服务
 */
export class AlertCorrelationService {
  private topology: AlertTopologyGraph = { nodes: [], edges: [] };
  private nodeHealth: Map<string, NodeHealthStatus> = new Map();
  private dependencyCache: Map<string, string[]> = new Map();
  private impactCache: Map<string, string[]> = new Map();

  constructor() {}

  /**
   * 设置拓扑图
   */
  setTopology(topology: AlertTopologyGraph): void {
    this.topology = topology;
    this.buildDependencyCache();
    this.buildImpactCache();
    this.initializeNodeHealth();

    logger.info(
      { nodeCount: topology.nodes.length, edgeCount: topology.edges.length },
      'Topology set for AlertCorrelationService'
    );
  }

  /**
   * 获取拓扑图
   */
  getTopology(): AlertTopologyGraph {
    return this.topology;
  }

  /**
   * 构建依赖缓存（上游依赖）
   * Edge source -> target 表示 source 依赖于 target
   */
  private buildDependencyCache(): void {
    this.dependencyCache.clear();

    for (const node of this.topology.nodes) {
      const dependencies: string[] = [];

      // 查找该节点的所有上游依赖：node 是 source 时，target 是其依赖
      for (const edge of this.topology.edges) {
        if (edge.source === node.id) {
          dependencies.push(edge.target);
        }
      }

      // 添加父节点
      if (node.parentId) {
        dependencies.push(node.parentId);
      }

      this.dependencyCache.set(node.id, dependencies);
    }
  }

  /**
   * 构建影响缓存（下游影响）
   * Edge source -> target 表示 target 受 source 影响
   */
  private buildImpactCache(): void {
    this.impactCache.clear();

    for (const node of this.topology.nodes) {
      const impacted: string[] = [];

      // 查找该节点的所有下游节点：node 是 target 时，source 受其影响
      for (const edge of this.topology.edges) {
        if (edge.target === node.id) {
          impacted.push(edge.source);
        }
      }

      // 添加子节点
      for (const otherNode of this.topology.nodes) {
        if (otherNode.parentId === node.id) {
          impacted.push(otherNode.id);
        }
      }

      this.impactCache.set(node.id, impacted);
    }
  }

  /**
   * 初始化节点健康状态
   */
  private initializeNodeHealth(): void {
    this.nodeHealth.clear();

    for (const node of this.topology.nodes) {
      this.nodeHealth.set(node.id, {
        nodeId: node.id,
        status: 'healthy',
        alertCount: 0,
        criticalAlertCount: 0,
      });
    }
  }

  /**
   * 根因分析
   * 基于拓扑图分析告警的根本原因
   */
  analyzeRootCause(alerts: Alert[]): RootCauseAnalysis | null {
    if (alerts.length === 0) {
      return null;
    }

    // 按来源分组告警
    const alertsBySource = this.groupAlertsBySource(alerts);

    // 找出所有故障节点
    const failedNodes = this.identifyFailedNodes(alerts);

    if (failedNodes.length === 0) {
      return null;
    }

    // 按优先级排序：基础设施 > 数据库 > 网络 > 应用 > 服务
    const sortedNodes = this.sortNodesByPriority(failedNodes);

    // 找到根因节点
    const rootCauseNode = this.findRootCauseNode(sortedNodes);

    if (!rootCauseNode) {
      return null;
    }

    // 找到根因告警
    const rootCauseAlert = this.findRootCauseAlert(rootCauseNode, alerts);

    if (!rootCauseAlert) {
      return null;
    }

    // 计算影响范围
    const affectedAlerts = this.findAffectedAlerts(rootCauseNode, alerts);

    // 计算拓扑路径
    const topologyPath = this.buildTopologyPath(rootCauseNode, alerts);

    // 计算置信度
    const confidence = this.calculateConfidence(rootCauseNode, affectedAlerts, alerts);

    return {
      rootCauseAlertId: rootCauseAlert.id,
      affectedAlertIds: affectedAlerts.map((a) => a.id),
      topologyPath,
      confidence,
      analysis: this.generateAnalysisText(rootCauseNode, rootCauseAlert, affectedAlerts),
    };
  }

  /**
   * 按来源分组告警
   */
  private groupAlertsBySource(alerts: Alert[]): Map<string, Alert[]> {
    const groups = new Map<string, Alert[]>();

    for (const alert of alerts) {
      const key = `${alert.sourceType}:${alert.sourceId}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(alert);
    }

    return groups;
  }

  /**
   * 识别故障节点
   */
  private identifyFailedNodes(alerts: Alert[]): AlertTopologyNode[] {
    const failedNodeIds = new Set<string>();

    for (const alert of alerts) {
      failedNodeIds.add(alert.sourceId);
    }

    const failedNodes = this.topology.nodes.filter((node) =>
      failedNodeIds.has(node.id)
    );

    return failedNodes;
  }

  /**
   * 按优先级排序节点
   * 基础设施优先级最高，因为它是最底层的根因
   */
  private sortNodesByPriority(nodes: AlertTopologyNode[]): AlertTopologyNode[] {
    const priority: Record<AlertSourceType, number> = {
      [AlertSourceType.INFRASTRUCTURE]: 1,
      [AlertSourceType.NODE]: 2,
      [AlertSourceType.NETWORK]: 3,
      [AlertSourceType.DATABASE]: 4,
      [AlertSourceType.APPLICATION]: 5,
      [AlertSourceType.SERVICE]: 6,
      [AlertSourceType.CUSTOM]: 7,
    };

    return [...nodes].sort((a, b) => {
      const priorityDiff = (priority[a.type] || 99) - (priority[b.type] || 99);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      // 同优先级按节点 ID
      return a.id.localeCompare(b.id);
    });
  }

  /**
   * 找到根因节点
   * 检查每个故障节点的上游依赖，如果上游也有故障，则上游是根因
   */
  private findRootCauseNode(failedNodes: AlertTopologyNode[]): AlertTopologyNode | null {
    const failedNodeIds = new Set(failedNodes.map((n) => n.id));

    for (const node of failedNodes) {
      const dependencies = this.getDependencies(node.id);

      // 检查上游依赖是否也有故障
      const hasFailedDependency = dependencies.some((depId) => failedNodeIds.has(depId));

      // 如果没有故障的上游依赖，则这个节点就是根因
      if (!hasFailedDependency) {
        return node;
      }
    }

    // 如果都有上游故障，返回优先级最高的
    return failedNodes[0] || null;
  }

  /**
   * 找到根因告警
   */
  private findRootCauseAlert(node: AlertTopologyNode, alerts: Alert[]): Alert | null {
    const nodeAlerts = alerts.filter(
      (a) => a.sourceId === node.id && a.status !== 'resolved'
    );

    if (nodeAlerts.length === 0) {
      return null;
    }

    // 按严重程度排序
    const severityOrder: Record<AlertSeverity, number> = {
      [AlertSeverity.CRITICAL]: 1,
      [AlertSeverity.HIGH]: 2,
      [AlertSeverity.MEDIUM]: 3,
      [AlertSeverity.LOW]: 4,
      [AlertSeverity.INFO]: 5,
    };

    nodeAlerts.sort((a, b) => {
      const severityDiff = (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99);
      if (severityDiff !== 0) {
        return severityDiff;
      }
      // 同严重程度按时间排序
      return a.startsAt.getTime() - b.startsAt.getTime();
    });

    return nodeAlerts[0];
  }

  /**
   * 找到受影响的告警
   */
  private findAffectedAlerts(rootCauseNode: AlertTopologyNode, alerts: Alert[]): Alert[] {
    const impactScope = this.getImpactScope(rootCauseNode.id);
    const impactNodeIds = new Set([rootCauseNode.id, ...impactScope]);

    return alerts.filter((a) => impactNodeIds.has(a.sourceId) && a.sourceId !== rootCauseNode.id);
  }

  /**
   * 获取节点的上游依赖
   */
  getDependencies(nodeId: string): string[] {
    return this.dependencyCache.get(nodeId) || [];
  }

  /**
   * 获取节点的影响范围（下游节点）
   */
  getImpactScope(nodeId: string): string[] {
    const directImpacts = this.impactCache.get(nodeId) || [];
    const allImpacts = new Set<string>(directImpacts);

    // 递归获取间接影响
    for (const impactId of directImpacts) {
      const indirectImpacts = this.getImpactScope(impactId);
      for (const id of indirectImpacts) {
        allImpacts.add(id);
      }
    }

    return Array.from(allImpacts);
  }

  /**
   * 构建拓扑路径
   */
  private buildTopologyPath(rootCauseNode: AlertTopologyNode, alerts: Alert[]): string[] {
    const path: string[] = [rootCauseNode.id];
    const impactScope = this.getImpactScope(rootCauseNode.id);

    // 按层级组织影响范围
    const levelMap = new Map<number, string[]>();
    levelMap.set(0, [rootCauseNode.id]);

    // BFS 遍历影响范围
    for (let i = 0; i < impactScope.length; i++) {
      const impactId = impactScope[i];
      const dependencies = this.getDependencies(impactId);

      // 找到最近的已处理节点
      let level = 1;
      for (const depId of dependencies) {
        for (const [lvl, nodes] of levelMap.entries()) {
          if (nodes.includes(depId)) {
            level = Math.max(level, lvl + 1);
            break;
          }
        }
      }

      if (!levelMap.has(level)) {
        levelMap.set(level, []);
      }
      levelMap.get(level)!.push(impactId);
    }

    // 按层级顺序构建路径
    const sortedLevels = Array.from(levelMap.keys()).sort((a, b) => a - b);
    for (const level of sortedLevels) {
      if (level > 0) {
        path.push(...levelMap.get(level)!);
      }
    }

    return path;
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(
    rootCauseNode: AlertTopologyNode,
    affectedAlerts: Alert[],
    allAlerts: Alert[]
  ): number {
    let confidence = 0.5; // 基础置信度

    // 因素1：影响范围大小
    const impactRatio = affectedAlerts.length / (allAlerts.length || 1);
    confidence += Math.min(impactRatio * 0.2, 0.2);

    // 因素2：节点类型优先级
    const typePriority: Record<AlertSourceType, number> = {
      [AlertSourceType.INFRASTRUCTURE]: 0.15,
      [AlertSourceType.NODE]: 0.12,
      [AlertSourceType.NETWORK]: 0.1,
      [AlertSourceType.DATABASE]: 0.1,
      [AlertSourceType.APPLICATION]: 0.05,
      [AlertSourceType.SERVICE]: 0.03,
      [AlertSourceType.CUSTOM]: 0.02,
    };
    confidence += typePriority[rootCauseNode.type] || 0;

    // 因素3：是否有明确的依赖关系
    const impactedNodes = this.getImpactScope(rootCauseNode.id);
    if (impactedNodes.length > 0) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * 生成分析文本
   */
  private generateAnalysisText(
    rootCauseNode: AlertTopologyNode,
    rootCauseAlert: Alert,
    affectedAlerts: Alert[]
  ): string {
    const parts: string[] = [];

    parts.push(`Root cause identified: ${rootCauseNode.name} (${rootCauseNode.type})`);
    parts.push(`Primary alert: ${rootCauseAlert.name}`);

    if (affectedAlerts.length > 0) {
      parts.push(`Affected alerts: ${affectedAlerts.length}`);
      parts.push(
        `Impact scope: ${affectedAlerts.map((a) => a.sourceName).slice(0, 5).join(', ')}${
          affectedAlerts.length > 5 ? '...' : ''
        }`
      );
    }

    return parts.join('. ');
  }

  /**
   * 更新节点健康状态
   */
  updateNodeHealth(alerts: Alert[]): void {
    // 重置健康状态
    this.initializeNodeHealth();

    // 根据告警更新健康状态
    for (const alert of alerts) {
      const health = this.nodeHealth.get(alert.sourceId);
      if (!health) {
        this.nodeHealth.set(alert.sourceId, {
          nodeId: alert.sourceId,
          status: alert.severity === AlertSeverity.CRITICAL ? 'unhealthy' : 'degraded',
          alertCount: 1,
          criticalAlertCount: alert.severity === AlertSeverity.CRITICAL ? 1 : 0,
          lastAlertAt: alert.startsAt,
        });
        continue;
      }

      health.alertCount++;
      if (alert.severity === AlertSeverity.CRITICAL) {
        health.criticalAlertCount++;
      }
      if (!health.lastAlertAt || alert.startsAt > health.lastAlertAt) {
        health.lastAlertAt = alert.startsAt;
      }

      // 更新状态
      if (health.criticalAlertCount > 0) {
        health.status = 'unhealthy';
      } else if (health.alertCount > 0) {
        health.status = 'degraded';
      }
    }

    // 更新拓扑节点状态
    for (const node of this.topology.nodes) {
      const health = this.nodeHealth.get(node.id);
      if (health) {
        node.status = health.status;
      }
    }
  }

  /**
   * 获取节点健康状态
   */
  getNodeHealth(nodeId: string): NodeHealthStatus | undefined {
    return this.nodeHealth.get(nodeId);
  }

  /**
   * 获取所有节点健康状态
   */
  getAllNodeHealth(): NodeHealthStatus[] {
    return Array.from(this.nodeHealth.values());
  }

  /**
   * 检测告警关联
   * 判断两个告警是否关联
   */
  detectCorrelation(alert1: Alert, alert2: Alert): {
    correlated: boolean;
    correlationType: string;
    confidence: number;
  } {
    // 同源关联
    if (alert1.sourceId === alert2.sourceId) {
      return {
        correlated: true,
        correlationType: 'same_source',
        confidence: 0.9,
      };
    }

    // 拓扑关联
    const deps1 = this.getDependencies(alert1.sourceId);
    const deps2 = this.getDependencies(alert2.sourceId);

    // 一个是另一个的上游
    if (deps1.includes(alert2.sourceId)) {
      return {
        correlated: true,
        correlationType: 'dependency',
        confidence: 0.8,
      };
    }

    if (deps2.includes(alert1.sourceId)) {
      return {
        correlated: true,
        correlationType: 'dependency',
        confidence: 0.8,
      };
    }

    // 共同上游
    const commonDeps = deps1.filter((d) => deps2.includes(d));
    if (commonDeps.length > 0) {
      return {
        correlated: true,
        correlationType: 'common_dependency',
        confidence: 0.7,
      };
    }

    // 时间关联（5分钟内）
    const timeDiff = Math.abs(alert1.startsAt.getTime() - alert2.startsAt.getTime());
    if (timeDiff < 5 * 60 * 1000) {
      return {
        correlated: true,
        correlationType: 'temporal',
        confidence: 0.5,
      };
    }

    return {
      correlated: false,
      correlationType: 'none',
      confidence: 0,
    };
  }

  /**
   * 批量分析告警关联
   */
  analyzeCorrelations(alerts: Alert[]): Array<{
    alertId: string;
    correlatedAlertIds: string[];
    correlationType: string;
  }> {
    const results: Array<{
      alertId: string;
      correlatedAlertIds: string[];
      correlationType: string;
    }> = [];

    for (let i = 0; i < alerts.length; i++) {
      const correlatedIds: string[] = [];
      let primaryType = 'none';

      for (let j = 0; j < alerts.length; j++) {
        if (i === j) continue;

        const correlation = this.detectCorrelation(alerts[i], alerts[j]);
        if (correlation.correlated) {
          correlatedIds.push(alerts[j].id);
          if (primaryType === 'none') {
            primaryType = correlation.correlationType;
          }
        }
      }

      results.push({
        alertId: alerts[i].id,
        correlatedAlertIds: correlatedIds,
        correlationType: primaryType,
      });
    }

    return results;
  }

  /**
   * 计算告警影响范围
   */
  calculateImpact(alert: Alert): {
    directImpact: string[];
    indirectImpact: string[];
    totalImpactCount: number;
  } {
    const directImpact = this.impactCache.get(alert.sourceId) || [];
    const indirectImpact: string[] = [];

    // 计算间接影响
    for (const impactId of directImpact) {
      const subImpacts = this.impactCache.get(impactId) || [];
      for (const subImpactId of subImpacts) {
        if (!directImpact.includes(subImpactId) && !indirectImpact.includes(subImpactId)) {
          indirectImpact.push(subImpactId);
        }
      }
    }

    return {
      directImpact,
      indirectImpact,
      totalImpactCount: directImpact.length + indirectImpact.length,
    };
  }
}