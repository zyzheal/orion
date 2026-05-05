// orion-platform-service/src/services/alert/AlertCorrelationService.ts
/**
 * Alert Correlation Service - Intelligent alert deduplication and correlation
 * Uses clustering and root cause analysis to reduce alert fatigue
 */

import pino from 'pino';
import { AlertSourceType } from './AlertTypes';
import type { AlertTopologyNode, AlertTopologyEdge, RootCauseAnalysis } from './AlertTypes';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface Alert {
  id: string;
  name: string;
  severity: 'critical' | 'warning' | 'info';
  source: string;
  service: string;
  environment: string;
  message: string;
  labels: Record<string, string>;
  value?: number;
  threshold?: number;
  firedAt: Date;
}

export interface AlertGroup {
  id: string;
  rootAlert: Alert;
  correlatedAlerts: Alert[];
  commonLabels: Record<string, string>;
  category: string;
  severity: 'critical' | 'warning' | 'info';
  firstFiredAt: Date;
  lastFiredAt: Date;
  totalCount: number;
  uniqueServices: string[];
  recommendedAction?: string;
}

export interface CorrelationOptions {
  timeWindowMs?: number;        // Time window for correlation (default: 5 min)
  similarityThreshold?: number; // Label similarity threshold (default: 0.7)
  maxGroupSize?: number;        // Max alerts per group (default: 100)
  enableRootCause?: boolean;    // Enable root cause analysis (default: true)
}

const DEFAULT_OPTIONS: Required<CorrelationOptions> = {
  timeWindowMs: 5 * 60 * 1000,  // 5 minutes
  similarityThreshold: 0.7,
  maxGroupSize: 100,
  enableRootCause: true,
};

export class AlertCorrelationService {
  private options: Required<CorrelationOptions>;
  private alertBuffer: Alert[] = [];
  private groups: Map<string, AlertGroup> = new Map();

  constructor(options?: CorrelationOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    logger.info(this.options, '[AlertCorrelation] Initialized');
  }

  /**
   * Add alert to correlation engine
   */
  async addAlert(alert: Alert): Promise<AlertGroup | null> {
    // Add to buffer
    this.alertBuffer.push(alert);
    
    // Clean old alerts
    this.cleanupBuffer();

    // Find or create group
    const group = this.findOrCreateGroup(alert);
    
    if (group) {
      logger.info({ 
        alertId: alert.id, 
        groupId: group.id,
        groupSize: group.totalCount 
      }, '[AlertCorrelation] Alert grouped');
    }

    return group;
  }

  /**
   * Add multiple alerts (batch)
   */
  async addAlerts(alerts: Alert[]): Promise<AlertGroup[]> {
    const groups: AlertGroup[] = [];

    for (const alert of alerts) {
      const group = await this.addAlert(alert);
      if (group) groups.push(group);
    }

    return groups;
  }

  /**
   * Find or create group for alert
   */
  private findOrCreateGroup(alert: Alert): AlertGroup | null {
    // Try to find existing group
    for (const [groupId, group] of this.groups) {
      if (this.isSimilar(alert, group)) {
        this.addToGroup(group, alert);
        return group;
      }
    }

    // Create new group
    const group = this.createGroup(alert);
    this.groups.set(group.id, group);
    return group;
  }

  /**
   * Check if alert belongs to existing group
   */
  private isSimilar(alert: Alert, group: AlertGroup): boolean {
    // Check time window
    const timeDiff = alert.firedAt.getTime() - group.lastFiredAt.getTime();
    if (timeDiff > this.options.timeWindowMs) {
      return false;
    }

    // Check label similarity
    const similarity = this.calculateSimilarity(alert.labels, group.commonLabels);
    if (similarity >= this.options.similarityThreshold) {
      return true;
    }

    // Check service/environment match
    if (alert.service === group.rootAlert.service && 
        alert.environment === group.rootAlert.environment) {
      // Check message pattern similarity
      return this.hasSimilarPattern(alert.message, group.rootAlert.message);
    }

    return false;
  }

  /**
   * Calculate Jaccard similarity between label sets
   */
  private calculateSimilarity(
    labels1: Record<string, string>, 
    labels2: Record<string, string>
  ): number {
    const keys1 = new Set(Object.keys(labels1));
    const keys2 = new Set(Object.keys(labels2));
    
    const intersection = new Set([...keys1].filter(x => keys2.has(x)));
    const union = new Set([...keys1, ...keys2]);
    
    if (union.size === 0) return 0;
    return intersection.size / union.size;
  }

  /**
   * Check if messages have similar patterns
   */
  private hasSimilarPattern(msg1: string, msg2: string): boolean {
    // Extract key terms (remove numbers, special chars)
    const terms1 = this.extractKeyTerms(msg1);
    const terms2 = this.extractKeyTerms(msg2);
    
    const intersection = terms1.filter(t => terms2.includes(t));
    const minLen = Math.min(terms1.length, terms2.length);
    
    return minLen > 0 && intersection.length / minLen >= 0.5;
  }

  /**
   * Extract key terms from message
   */
  private extractKeyTerms(message: string): string[] {
    return message
      .toLowerCase()
      .replace(/[0-9.]+/g, '')
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 3);
  }

  /**
   * Create new alert group
   */
  private createGroup(alert: Alert): AlertGroup {
    const group: AlertGroup = {
      id: `group-${alert.id}-${Date.now()}`,
      rootAlert: alert,
      correlatedAlerts: [],
      commonLabels: { ...alert.labels },
      category: this.categorizeAlert(alert),
      severity: alert.severity,
      firstFiredAt: alert.firedAt,
      lastFiredAt: alert.firedAt,
      totalCount: 1,
      uniqueServices: [alert.service],
      recommendedAction: this.getRecommendedAction(alert),
    };

    return group;
  }

  /**
   * Add alert to existing group
   */
  private addToGroup(group: AlertGroup, alert: Alert): void {
    group.correlatedAlerts.push(alert);
    group.lastFiredAt = alert.firedAt;
    group.totalCount++;

    // Update common labels (intersection)
    const newCommon: Record<string, string> = {};
    for (const key of Object.keys(group.commonLabels)) {
      if (alert.labels[key] === group.commonLabels[key]) {
        newCommon[key] = alert.labels[key];
      }
    }
    group.commonLabels = newCommon;

    // Update severity to highest
    if (this.severityLevel(alert.severity) > this.severityLevel(group.severity)) {
      group.severity = alert.severity;
    }

    // Track unique services
    if (!group.uniqueServices.includes(alert.service)) {
      group.uniqueServices.push(alert.service);
    }

    // Update recommended action if needed
    if (!group.recommendedAction) {
      group.recommendedAction = this.getRecommendedAction(alert);
    }
  }

  /**
   * Categorize alert
   */
  private categorizeAlert(alert: Alert): string {
    const name = alert.name.toLowerCase();
    const msg = alert.message.toLowerCase();

    if (name.includes('cpu') || msg.includes('cpu')) return 'resource';
    if (name.includes('memory') || msg.includes('memory')) return 'resource';
    if (name.includes('disk') || msg.includes('disk')) return 'storage';
    if (name.includes('network') || msg.includes('network')) return 'network';
    if (name.includes('error') || msg.includes('error')) return 'error';
    if (name.includes('timeout') || msg.includes('timeout')) return 'performance';
    if (name.includes('latency') || msg.includes('latency')) return 'performance';
    if (name.includes('pod') || msg.includes('pod')) return 'kubernetes';
    if (name.includes('node') || msg.includes('node')) return 'kubernetes';
    if (name.includes('database') || msg.includes('db')) return 'database';

    return 'other';
  }

  /**
   * Get recommended action based on alert
   */
  private getRecommendedAction(alert: Alert): string {
    const category = this.categorizeAlert(alert);

    const actionMap: Record<string, string> = {
      resource: 'Check resource limits and scale if needed',
      storage: 'Clean up disk space or expand storage',
      network: 'Check network connectivity and firewall rules',
      error: 'Review error logs and identify root cause',
      performance: 'Analyze performance metrics and optimize',
      kubernetes: 'Check pod status and Kubernetes events',
      database: 'Check database connections and queries',
    };

    return actionMap[category] || 'Investigate alert details';
  }

  /**
   * Severity level for comparison
   */
  private severityLevel(severity: string): number {
    const levels: Record<string, number> = { critical: 3, warning: 2, info: 1 };
    return levels[severity] || 0;
  }

  /**
   * Clean up old alerts from buffer
   */
  private cleanupBuffer(): void {
    const cutoff = Date.now() - this.options.timeWindowMs * 2;
    this.alertBuffer = this.alertBuffer.filter(a => a.firedAt.getTime() > cutoff);
  }

  /**
   * Get all active groups
   */
  getActiveGroups(): AlertGroup[] {
    // Clean up old groups
    const cutoff = Date.now() - this.options.timeWindowMs;
    for (const [id, group] of this.groups) {
      if (group.lastFiredAt.getTime() < cutoff) {
        this.groups.delete(id);
      }
    }

    return Array.from(this.groups.values());
  }

  /**
   * Get group by ID
   */
  getGroup(id: string): AlertGroup | undefined {
    return this.groups.get(id);
  }

  /**
   * Get correlation statistics
   */
  getStats(): {
    totalAlerts: number;
    activeGroups: number;
    alertsPerGroup: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
    deduplicationRate: number;
  } {
    const groups = this.getActiveGroups();
    const totalAlerts = this.alertBuffer.length + groups.reduce(
      (sum, g) => sum + g.correlatedAlerts.length, 0
    );

    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    for (const group of groups) {
      byCategory[group.category] = (byCategory[group.category] || 0) + 1;
      bySeverity[group.severity] = (bySeverity[group.severity] || 0) + 1;
    }

    const alertsPerGroup = groups.length > 0 
      ? totalAlerts / groups.length 
      : 0;
    
    const deduplicationRate = totalAlerts > 0 
      ? ((totalAlerts - groups.length) / totalAlerts) * 100 
      : 0;

    return {
      totalAlerts,
      activeGroups: groups.length,
      alertsPerGroup: Math.round(alertsPerGroup * 10) / 10,
      byCategory,
      bySeverity,
      deduplicationRate: Math.round(deduplicationRate),
    };
  }

  /**
   * Acknowledge group (mark as handled)
   */
  acknowledgeGroup(groupId: string): boolean {
    return this.groups.delete(groupId);
  }

  /**
   * Clear all groups
   */
  clear(): void {
    this.groups.clear();
    this.alertBuffer = [];
  }

  // ==================== Topology & Dependency Management ====================

  private topologyNodes: Map<string, AlertTopologyNode> = new Map();
  private topologyEdges: AlertTopologyEdge[] = [];
  private nodeHealth: Map<string, 'healthy' | 'degraded' | 'unhealthy'> = new Map();
  private dependencyMap: Map<string, string[]> = new Map();
  private impactMap: Map<string, string[]> = new Map();

  /**
   * Get the current topology
   */
  getTopology(): {
    nodes: Array<{ id: string; type: string; name: string; status: string }>;
    edges: Array<{ source: string; target: string; relationType: string }>;
  } {
    const nodes = Array.from(this.topologyNodes.values()).map(n => ({
      id: n.id,
      type: n.type,
      name: n.name,
      status: this.nodeHealth.get(n.id) || 'healthy',
    }));
    const edges = this.topologyEdges.map(e => ({
      source: e.source,
      target: e.target,
      relationType: e.relationType,
    }));
    return { nodes, edges };
  }

  /**
   * Set the topology graph
   */
  setTopology(topology: {
    nodes: Array<{ id: string; type: AlertSourceType; name: string; parentId?: string; status?: 'healthy' | 'degraded' | 'unhealthy' }>;
    edges: Array<{ source: string; target: string; relationType: 'depends_on' | 'runs_on' | 'connected_to' }>;
  }): void {
    this.topologyNodes.clear();
    this.topologyEdges = topology.edges;
    this.dependencyMap.clear();
    this.impactMap.clear();

    // Build node map
    for (const node of topology.nodes) {
      const topoNode: AlertTopologyNode = {
        id: node.id,
        type: node.type,
        name: node.name,
        status: node.status || 'healthy',
        parentId: node.parentId,
        childrenIds: [],
      };
      this.topologyNodes.set(node.id, topoNode);
      if (!this.nodeHealth.has(node.id)) {
        this.nodeHealth.set(node.id, 'healthy');
      }
    }

    // Build parent-child relationships
    for (const node of topology.nodes) {
      if (node.parentId) {
        const parent = this.topologyNodes.get(node.parentId);
        if (parent && parent.childrenIds) {
          parent.childrenIds.push(node.id);
        }
      }
    }

    // Build dependency and impact maps
    for (const edge of topology.edges) {
      // edge.source depends on edge.target
      const deps = this.dependencyMap.get(edge.source) || [];
      deps.push(edge.target);
      this.dependencyMap.set(edge.source, deps);

      // edge.target impacts edge.source
      const impacts = this.impactMap.get(edge.target) || [];
      impacts.push(edge.source);
      this.impactMap.set(edge.target, impacts);
    }

    logger.info(
      { nodeCount: this.topologyNodes.size, edgeCount: this.topologyEdges.length },
      '[AlertCorrelation] Topology set'
    );
  }

  /**
   * Get dependencies of a node (what this node depends on)
   */
  getDependencies(nodeId: string): string[] {
    return this.dependencyMap.get(nodeId) || [];
  }

  /**
   * Get impact scope of a node (what is impacted if this node fails)
   */
  getImpactScope(nodeId: string): string[] {
    return this.impactMap.get(nodeId) || [];
  }

  /**
   * Update node health based on alerts
   */
  updateNodeHealth(alerts: Array<{ id: string; sourceId?: string; severity?: string; status?: string }>): void {
    for (const alert of alerts) {
      const sourceId = (alert as any).sourceId || alert.id;
      const severity = (alert as any).severity || '';
      const status = (alert as any).status || '';

      if (status === 'resolved' || status === 'silenced') {
        continue;
      }

      const currentHealth = this.nodeHealth.get(sourceId) || 'healthy';
      let newHealth: 'healthy' | 'degraded' | 'unhealthy' = currentHealth;

      if (severity === 'critical') {
        newHealth = 'unhealthy';
      } else if (severity === 'high' || severity === 'warning') {
        if (currentHealth !== 'unhealthy') {
          newHealth = 'degraded';
        }
      }

      if (newHealth !== currentHealth) {
        this.nodeHealth.set(sourceId, newHealth);
        // Propagate to dependents
        this.propagateHealthDegradation(sourceId, newHealth);
      }
    }
  }

  /**
   * Propagate health degradation to impacted nodes
   */
  private propagateHealthDegradation(nodeId: string, health: 'healthy' | 'degraded' | 'unhealthy'): void {
    const impacted = this.impactMap.get(nodeId) || [];
    for (const impactedId of impacted) {
      const currentHealth = this.nodeHealth.get(impactedId) || 'healthy';
      const healthLevel = { healthy: 0, degraded: 1, unhealthy: 2 };
      if (healthLevel[health] > healthLevel[currentHealth]) {
        this.nodeHealth.set(impactedId, health);
        // Recursively propagate
        this.propagateHealthDegradation(impactedId, health);
      }
    }
  }

  /**
   * Analyze root cause for a set of alerts
   */
  analyzeRootCause(alerts: Array<{ id: string; sourceId?: string; severity?: string }>): RootCauseAnalysis | null {
    if (alerts.length === 0) return null;

    // Find the most severe alert as potential root cause
    const severityLevel: Record<string, number> = { critical: 3, high: 2, medium: 1, info: 0 };
    let rootCauseAlert = alerts[0];
    let maxSeverity = severityLevel[(rootCauseAlert as any).severity || 'info'] || 0;

    for (const alert of alerts) {
      const level = severityLevel[(alert as any).severity || 'info'] || 0;
      if (level > maxSeverity) {
        maxSeverity = level;
        rootCauseAlert = alert;
      }
    }

    // Check if root cause alert has upstream dependencies that are also alerting
    const alertingSourceIds = new Set(alerts.map(a => (a as any).sourceId || a.id));
    const rootSourceId = (rootCauseAlert as any).sourceId || rootCauseAlert.id;
    const rootDeps = this.getDependencies(rootSourceId);

    let actualRootCause = rootCauseAlert;
    for (const depId of rootDeps) {
      if (alertingSourceIds.has(depId)) {
        // This dependency is also alerting, it might be the root cause
        const depAlert = alerts.find(a => (a as any).sourceId === depId || a.id === depId);
        if (depAlert) {
          actualRootCause = depAlert;
          break;
        }
      }
    }

    const actualRootSourceId = (actualRootCause as any).sourceId || actualRootCause.id;
    const affectedAlertIds = alerts
      .filter(a => a.id !== actualRootCause.id)
      .map(a => a.id);

    return {
      rootCauseAlertId: actualRootCause.id,
      affectedAlertIds,
      topologyPath: [actualRootSourceId],
      confidence: alerts.length > 1 ? 0.8 : 0.5,
      analysis: `Root cause identified: ${actualRootCause.id} (${actualRootSourceId}). ${affectedAlertIds.length} affected alerts.`,
    };
  }

  /**
   * Get all node health status
   */
  getAllNodeHealth(): Array<{ nodeId: string; status: 'healthy' | 'degraded' | 'unhealthy' }> {
    const result: Array<{ nodeId: string; status: 'healthy' | 'degraded' | 'unhealthy' }> = [];
    for (const [nodeId, status] of this.nodeHealth.entries()) {
      result.push({ nodeId, status });
    }
    return result;
  }
}

export default AlertCorrelationService;