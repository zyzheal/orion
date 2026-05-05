// orion-platform-service/src/services/alert/AlertCorrelationService.ts
/**
 * Alert Correlation Service - Intelligent alert deduplication and correlation
 * Uses clustering and root cause analysis to reduce alert fatigue
 */

import pino from 'pino';

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
    const levels = { critical: 3, warning: 2, info: 1 };
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
}

export default AlertCorrelationService;