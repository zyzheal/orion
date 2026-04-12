/**
 * TASK-703: Alert Rule Engine
 *
 * Evaluates metrics against configurable alerting rules.
 * Supports threshold-based alerts (>, <, >=, <=, ==, !=), rate-of-change
 * detection, cooldown to prevent alert flooding, and alert deduplication.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  AlertRule,
  Alert,
  AlertStatus,
  AlertCondition,
} from './types';
import { MetricCollector } from './MetricCollector';

/**
 * Internal state for cooldown tracking
 */
interface CooldownEntry {
  /** Last time an alert was triggered for this rule */
  lastTriggeredAt: Date;
  /** Alert ID if currently active */
  activeAlertId?: string;
}

/**
 * Alert Rule Engine - Evaluates metrics against rules and generates alerts
 *
 * Supports:
 * - Threshold-based conditions (>, <, >=, <=, ==, !=)
 * - Rate-of-change detection (sudden spikes)
 * - Cooldown to prevent alert flooding
 * - Alert deduplication and suppression
 */
export class AlertRuleEngine {
  /** Registered alert rules */
  private rules: Map<string, AlertRule> = new Map();

  /** Active alerts: alertId -> Alert */
  private alerts: Map<string, Alert> = new Map();

  /** Cooldown tracking per rule */
  private cooldowns: Map<string, CooldownEntry> = new Map();

  /** Suppressed alert rule IDs */
  private suppressedRules: Set<string> = new Set();

  /** Reference to metric collector for evaluating current values */
  private metricCollector?: MetricCollector;

  /** Callback for when new alerts are created */
  onAlert?: (alert: Alert) => void;

  constructor(metricCollector?: MetricCollector) {
    this.metricCollector = metricCollector;
  }

  // ==================== Rule Management ====================

  /**
   * Add a new alerting rule
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);

    // Initialize cooldown if not exists
    if (!this.cooldowns.has(rule.id)) {
      this.cooldowns.set(rule.id, { lastTriggeredAt: new Date(0) });
    }
  }

  /**
   * Update an existing rule
   */
  updateRule(ruleId: string, updates: Partial<AlertRule>): AlertRule | null {
    const existing = this.rules.get(ruleId);
    if (!existing) return null;

    const updated = { ...existing, ...updates };
    this.rules.set(ruleId, updated);
    return updated;
  }

  /**
   * Remove a rule
   */
  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  /**
   * Get a rule by ID
   */
  getRule(ruleId: string): AlertRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Get all rules
   */
  getAllRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Enable or disable a rule
   */
  toggleRule(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;
    rule.enabled = enabled;
    return true;
  }

  // ==================== Alert Suppression ====================

  /**
   * Suppress alerts for a specific rule
   */
  suppressRule(ruleId: string): void {
    this.suppressedRules.add(ruleId);
  }

  /**
   * Unsuppress a rule
   */
  unsuppressRule(ruleId: string): void {
    this.suppressedRules.delete(ruleId);
  }

  /**
   * Check if a rule is suppressed
   */
  isRuleSuppressed(ruleId: string): boolean {
    return this.suppressedRules.has(ruleId);
  }

  // ==================== Alert Evaluation ====================

  /**
   * Evaluate all enabled rules against current metric values
   */
  evaluateRules(): Alert[] {
    const newAlerts: Alert[] = [];
    const now = new Date();

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;
      if (this.suppressedRules.has(rule.id)) continue;
      if (!this.isCooldownExpired(rule, now)) continue;

      // Get the latest metric value
      const currentValue = this.getMetricValue(rule);
      if (currentValue === null) continue;

      // Evaluate the condition
      if (this.evaluateCondition(rule, currentValue)) {
        const alert = this.createAlert(rule, currentValue);
        this.alerts.set(alert.id, alert);
        newAlerts.push(alert);

        // Update cooldown
        this.cooldowns.set(rule.id, {
          lastTriggeredAt: now,
          activeAlertId: alert.id,
        });

        // Notify callback
        if (this.onAlert) {
          this.onAlert(alert);
        }
      }
    }

    return newAlerts;
  }

  /**
   * Evaluate a single rule
   */
  evaluateRule(ruleId: string): Alert | null {
    const rule = this.rules.get(ruleId);
    if (!rule || !rule.enabled) return null;
    if (this.suppressedRules.has(ruleId)) return null;

    const now = new Date();
    if (!this.isCooldownExpired(rule, now)) return null;

    const currentValue = this.getMetricValue(rule);
    if (currentValue === null) return null;

    if (this.evaluateCondition(rule, currentValue)) {
      const alert = this.createAlert(rule, currentValue);
      this.alerts.set(alert.id, alert);

      this.cooldowns.set(ruleId, {
        lastTriggeredAt: now,
        activeAlertId: alert.id,
      });

      if (this.onAlert) {
        this.onAlert(alert);
      }

      return alert;
    }

    return null;
  }

  // ==================== Alert Management ====================

  /**
   * Create an alert instance
   */
  createAlert(rule: AlertRule, currentValue: number): Alert {
    return {
      id: uuidv4(),
      ruleId: rule.id,
      ruleName: rule.name,
      metric: rule.metric,
      value: currentValue,
      threshold: rule.threshold,
      severity: rule.severity,
      status: 'triggered',
      triggeredAt: new Date(),
      tags: rule.tags,
      message: this.generateAlertMessage(rule, currentValue),
    };
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): Alert | null {
    const alert = this.alerts.get(alertId);
    if (!alert) return null;

    alert.status = 'resolved';
    alert.resolvedAt = new Date();

    // Clear cooldown active alert reference
    const entry = this.cooldowns.get(alert.ruleId);
    if (entry && entry.activeAlertId === alertId) {
      entry.activeAlertId = undefined;
    }

    return alert;
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy?: string): Alert | null {
    const alert = this.alerts.get(alertId);
    if (!alert) return null;
    if (alert.status === 'resolved' || alert.status === 'suppressed') return null;

    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = acknowledgedBy;

    return alert;
  }

  /**
   * Suppress an existing alert
   */
  suppressAlert(alertId: string): Alert | null {
    const alert = this.alerts.get(alertId);
    if (!alert) return null;

    alert.status = 'suppressed';
    return alert;
  }

  /**
   * Get an alert by ID
   */
  getAlert(alertId: string): Alert | undefined {
    return this.alerts.get(alertId);
  }

  /**
   * Get all alerts with optional filters
   */
  getAlerts(filter?: {
    status?: AlertStatus;
    severity?: AlertStatus;
    ruleId?: string;
    metric?: string;
  }): Alert[] {
    let result = Array.from(this.alerts.values());

    if (filter?.status) {
      result = result.filter(a => a.status === filter.status);
    }
    if (filter?.severity) {
      result = result.filter(a => a.severity === filter.severity);
    }
    if (filter?.ruleId) {
      result = result.filter(a => a.ruleId === filter.ruleId);
    }
    if (filter?.metric) {
      result = result.filter(a => a.metric === filter.metric);
    }

    // Sort by triggeredAt descending
    result.sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime());
    return result;
  }

  /**
   * Get active (non-resolved, non-suppressed) alerts
   */
  getActiveAlerts(): Alert[] {
    return this.getAlerts().filter(
      a => a.status === 'triggered' || a.status === 'acknowledged'
    );
  }

  /**
   * Get alerts count by severity
   */
  getAlertCountsBySeverity(): Record<string, number> {
    const active = this.getActiveAlerts();
    const counts: Record<string, number> = {
      critical: 0,
      warning: 0,
      info: 0,
    };

    for (const alert of active) {
      counts[alert.severity] = (counts[alert.severity] || 0) + 1;
    }

    return counts;
  }

  // ==================== Condition Evaluation ====================

  /**
   * Check if a rule's cooldown period has expired
   */
  private isCooldownExpired(rule: AlertRule, now: Date): boolean {
    const entry = this.cooldowns.get(rule.id);
    if (!entry) return true;

    const elapsed = now.getTime() - entry.lastTriggeredAt.getTime();
    return elapsed >= rule.cooldownMs;
  }

  /**
   * Get the current metric value for a rule
   */
  private getMetricValue(rule: AlertRule): number | null {
    if (!this.metricCollector) return null;

    const value = this.metricCollector.getLatestValue(rule.metric, rule.tags);
    return value;
  }

  /**
   * Evaluate a condition against a value
   */
  private evaluateCondition(rule: AlertRule, value: number): boolean {
    switch (rule.condition) {
      case '>':
        return value > rule.threshold;
      case '<':
        return value < rule.threshold;
      case '>=':
        return value >= rule.threshold;
      case '<=':
        return value <= rule.threshold;
      case '==':
        return value === rule.threshold;
      case '!=':
        return value !== rule.threshold;
      case 'rate_of_change':
        return this.evaluateRateOfChange(rule, value);
      default:
        return false;
    }
  }

  /**
   * Evaluate rate-of-change condition
   * Checks if the metric value has changed by more than rateOfChangePercent
   * compared to the previous recorded value
   */
  private evaluateRateOfChange(rule: AlertRule, currentValue: number): boolean {
    if (!this.metricCollector) return false;

    const metricName = rule.metric;
    const query = this.metricCollector.getMetricSeries({ name: metricName, tags: rule.tags, maxPoints: 2 });

    if (query.dataPoints.length < 2) return false;

    const points = query.dataPoints;
    const previousValue = points[points.length - 2].value;

    if (previousValue === 0) {
      return currentValue !== 0;
    }

    const rateOfChange = Math.abs(((currentValue - previousValue) / previousValue)) * 100;
    const threshold = rule.rateOfChangePercent ?? rule.threshold;

    return rateOfChange >= threshold;
  }

  /**
   * Generate a human-readable alert message
   */
  private generateAlertMessage(rule: AlertRule, value: number): string {
    const conditionSymbols: Record<AlertCondition, string> = {
      '>': '>',
      '<': '<',
      '>=': '>=',
      '<=': '<=',
      '==': '==',
      '!=': '!=',
      'rate_of_change': 'rate_of_change',
    };

    const condition = conditionSymbols[rule.condition] || rule.condition;

    if (rule.condition === 'rate_of_change') {
      return `Alert: ${rule.name} - Metric "${rule.metric}" changed by ${Math.round(value * 100) / 100}% (threshold: ${rule.rateOfChangePercent ?? rule.threshold}%)`;
    }

    return `Alert: ${rule.name} - Metric "${rule.metric}" is ${value} ${condition} ${rule.threshold}`;
  }

  // ==================== Maintenance ====================

  /**
   * Clear all alerts
   */
  clearAlerts(): void {
    this.alerts.clear();
  }

  /**
   * Clear all rules
   */
  clearRules(): void {
    this.rules.clear();
    this.cooldowns.clear();
    this.suppressedRules.clear();
  }

  /**
   * Get alert history (all alerts)
   */
  getAlertHistory(limit?: number): Alert[] {
    const all = Array.from(this.alerts.values());
    all.sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime());

    if (limit) {
      return all.slice(0, limit);
    }

    return all;
  }
}
