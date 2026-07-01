/**
 * TASK-703: Alert Rule Engine
 *
 * Evaluates metrics against configurable alerting rules.
 * Supports threshold-based alerts (>, <, >=, <=, ==, !=), rate-of-change
 * detection, cooldown to prevent alert flooding, and alert deduplication.
 *
 * Persistence: When `db` is provided, PostgreSQL is the primary store and
 * Maps are used as write-through caches. Without `db`, in-memory Maps are
 * the sole store (for tests and legacy usage).
 */

import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';
import {
  AlertRule,
  Alert,
  AlertStatus,
  AlertSeverity,
  AlertCondition,
} from './types';
import { MetricCollector } from './MetricCollector';
import {
  MonitoringAlertRuleRepository,
  MonitoringAlertRuleEntity,
} from '../../repositories/MonitoringAlertRuleRepository';
import {
  MonitoringAlertInstanceRepository,
  MonitoringAlertInstanceEntity,
} from '../../repositories/MonitoringAlertInstanceRepository';
import { getCurrentTraceId, getCurrentTenantId } from '../../db/tenant-context-storage';

const logger = pino({ name: 'LAlert-LRule-LEngine' });

type DbConnection = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

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
  /** PostgreSQL repository for alert rules (primary when available) */
  private readonly ruleRepo?: MonitoringAlertRuleRepository;

  /** PostgreSQL repository for alert instances (primary when available) */
  private readonly alertRepo?: MonitoringAlertInstanceRepository;

  /** Registered alert rules (write-through cache / memory fallback) */
  private rules: Map<string, AlertRule> = new Map();

  /** Active alerts: alertId -> Alert (write-through cache / memory fallback) */
  private alerts: Map<string, Alert> = new Map();

  /** Cooldown tracking per rule (always in-memory, runtime state) */
  private cooldowns: Map<string, CooldownEntry> = new Map();

  /** Suppressed alert rule IDs (always in-memory, runtime state) */
  private suppressedRules: Set<string> = new Set();

  /** Reference to metric collector for evaluating current values */
  private metricCollector?: MetricCollector;

  /** Callback for when new alerts are created */
  onAlert?: (alert: Alert) => void;

  constructor(metricCollector?: MetricCollector, db?: DbConnection) {
    this.metricCollector = metricCollector;
    if (db) {
      this.ruleRepo = new MonitoringAlertRuleRepository(db);
      this.alertRepo = new MonitoringAlertInstanceRepository(db);
    }
  }

  /**
   * Load persisted rules and active alerts from PostgreSQL into in-memory Maps.
   * Call this once after construction when db is provided.
   */
  async init(): Promise<void> {
    if (this.ruleRepo) {
      const ruleEntities = await this.ruleRepo.findEnabled();
      for (const entity of ruleEntities) {
        const rule = this.entityToRule(entity);
        this.rules.set(rule.id, rule);
        if (!this.cooldowns.has(rule.id)) {
          this.cooldowns.set(rule.id, { lastTriggeredAt: new Date(0) });
        }
      }
      logger.info(`[AlertRuleEngine] Loaded ${ruleEntities.length} rules from repository`);
    }

    if (this.alertRepo) {
      const alertEntities = await this.alertRepo.findActive();
      for (const entity of alertEntities) {
        const alert = this.entityToAlert(entity);
        this.alerts.set(alert.id, alert);
      }
      logger.info(`[AlertRuleEngine] Loaded ${alertEntities.length} active alerts from repository`);
    }
  }

  // ==================== Rule Management ====================

  /**
   * Add a new alerting rule
   */
  async addRule(rule: AlertRule): Promise<void> {
    // Initialize cooldown if not exists
    if (!this.cooldowns.has(rule.id)) {
      this.cooldowns.set(rule.id, { lastTriggeredAt: new Date(0) });
    }

    // Persist to repository first (primary store when available)
    if (this.ruleRepo) {
      await this.ruleRepo.create({
        id: rule.id,
        tenant_id: getCurrentTenantId(),
        name: rule.name,
        metric: rule.metric,
        condition: rule.condition,
        threshold: rule.threshold,
        severity: rule.severity,
        enabled: rule.enabled,
        suppressed: false,
        cooldown_ms: rule.cooldownMs,
        tags: rule.tags || {},
        rate_of_change_percent: rule.rateOfChangePercent ?? null,
        description: rule.description ?? null,
        evaluation_window_ms: rule.evaluationWindowMs ?? null,
      });
    }

    // Update in-memory cache
    this.rules.set(rule.id, rule);
  }

  /**
   * Update an existing rule
   */
  async updateRule(ruleId: string, updates: Partial<AlertRule>): Promise<AlertRule | null> {
    const existing = this.rules.get(ruleId);
    if (!existing) return null;

    const updated = { ...existing, ...updates };

    // Persist to repository first
    if (this.ruleRepo) {
      const repoUpdate: any = {};
      if (updates.name !== undefined) repoUpdate.name = updates.name;
      if (updates.metric !== undefined) repoUpdate.metric = updates.metric;
      if (updates.condition !== undefined) repoUpdate.condition = updates.condition;
      if (updates.threshold !== undefined) repoUpdate.threshold = updates.threshold;
      if (updates.severity !== undefined) repoUpdate.severity = updates.severity;
      if (updates.enabled !== undefined) repoUpdate.enabled = updates.enabled;
      if (updates.cooldownMs !== undefined) repoUpdate.cooldown_ms = updates.cooldownMs;
      if (updates.tags !== undefined) repoUpdate.tags = updates.tags;
      if (updates.rateOfChangePercent !== undefined) repoUpdate.rate_of_change_percent = updates.rateOfChangePercent;
      if (updates.description !== undefined) repoUpdate.description = updates.description;
      if (updates.evaluationWindowMs !== undefined) repoUpdate.evaluation_window_ms = updates.evaluationWindowMs;

      if (Object.keys(repoUpdate).length > 0) {
        await this.ruleRepo.update(ruleId, repoUpdate);
      }
    }

    // Update in-memory cache
    this.rules.set(ruleId, updated);
    return updated;
  }

  /**
   * Remove a rule
   */
  async removeRule(ruleId: string): Promise<boolean> {
    const exists = this.rules.has(ruleId);
    if (!exists) return false;

    // Delete from repository first
    if (this.ruleRepo) {
      await this.ruleRepo.delete(ruleId);
    }

    // Update in-memory cache
    this.rules.delete(ruleId);
    return true;
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
  async toggleRule(ruleId: string, enabled: boolean): Promise<boolean> {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    // Persist to repository first
    if (this.ruleRepo) {
      await this.ruleRepo.toggleEnabled(ruleId, enabled);
    }

    // Update in-memory cache
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
  async evaluateRules(): Promise<Alert[]> {
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

        // Persist alert to repository first
        if (this.alertRepo) {
          await this.alertRepo.create(this.alertToEntity(alert) as any);
        }

        // Update in-memory cache
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
  async evaluateRule(ruleId: string): Promise<Alert | null> {
    const rule = this.rules.get(ruleId);
    if (!rule || !rule.enabled) return null;
    if (this.suppressedRules.has(ruleId)) return null;

    const now = new Date();
    if (!this.isCooldownExpired(rule, now)) return null;

    const currentValue = this.getMetricValue(rule);
    if (currentValue === null) return null;

    if (this.evaluateCondition(rule, currentValue)) {
      const alert = this.createAlert(rule, currentValue);

      // Persist alert to repository first
      if (this.alertRepo) {
        await this.alertRepo.create(this.alertToEntity(alert) as any);
      }

      // Update in-memory cache
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
  async resolveAlert(alertId: string): Promise<Alert | null> {
    const alert = this.alerts.get(alertId);
    if (!alert) return null;

    // Persist to repository first
    if (this.alertRepo) {
      await this.alertRepo.updateStatus(alertId, 'resolved');
    }

    // Update in-memory cache
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
  async acknowledgeAlert(alertId: string, acknowledgedBy?: string): Promise<Alert | null> {
    const alert = this.alerts.get(alertId);
    if (!alert) return null;
    if (alert.status === 'resolved' || alert.status === 'suppressed') return null;

    // Persist to repository first
    if (this.alertRepo) {
      await this.alertRepo.updateStatus(alertId, 'acknowledged', { acknowledged_by: acknowledgedBy });
    }

    // Update in-memory cache
    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = acknowledgedBy;

    return alert;
  }

  /**
   * Suppress an existing alert
   */
  async suppressAlert(alertId: string): Promise<Alert | null> {
    const alert = this.alerts.get(alertId);
    if (!alert) return null;

    // Persist to repository first
    if (this.alertRepo) {
      await this.alertRepo.updateStatus(alertId, 'suppressed');
    }

    // Update in-memory cache
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
    severity?: AlertSeverity;
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
  async clearAlerts(): Promise<void> {
    // Clear repository if available
    if (this.alertRepo) {
      const allAlerts = Array.from(this.alerts.keys());
      for (const alertId of allAlerts) {
        await this.alertRepo.delete(alertId).catch((err: any) =>
          logger.warn({ traceId: getCurrentTraceId(), err, alertId }, '[AlertRuleEngine] Failed to delete alert from repository')
        );
      }
    }

    // Clear in-memory cache
    this.alerts.clear();
  }

  /**
   * Clear all rules
   */
  async clearRules(): Promise<void> {
    // Clear repository if available
    if (this.ruleRepo) {
      for (const ruleId of this.rules.keys()) {
        await this.ruleRepo.delete(ruleId).catch((err: any) =>
          logger.warn({ traceId: getCurrentTraceId(), err, ruleId }, '[AlertRuleEngine] Failed to delete rule from repository')
        );
      }
    }

    // Clear in-memory cache
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

  // ==================== Private Helpers ====================

  /**
   * Convert an Alert to a repository entity object
   */
  private alertToEntity(alert: Alert): Record<string, any> {
    return {
      id: alert.id,
      tenant_id: getCurrentTenantId(),
      rule_id: alert.ruleId,
      rule_name: alert.ruleName ?? null,
      metric: alert.metric,
      value: alert.value,
      threshold: alert.threshold,
      severity: alert.severity,
      status: alert.status,
      triggered_at: alert.triggeredAt,
      acknowledged_at: alert.acknowledgedAt ?? null,
      acknowledged_by: alert.acknowledgedBy ?? null,
      resolved_at: alert.resolvedAt ?? null,
      tags: alert.tags || {},
      message: alert.message ?? null,
    };
  }

  /**
   * Convert a repository entity to an AlertRule domain object
   */
  private entityToRule(entity: MonitoringAlertRuleEntity): AlertRule {
    return {
      id: entity.id,
      name: entity.name,
      metric: entity.metric,
      condition: entity.condition as AlertCondition,
      threshold: entity.threshold,
      severity: entity.severity as AlertSeverity,
      enabled: entity.enabled,
      cooldownMs: entity.cooldown_ms,
      tags: entity.tags,
      rateOfChangePercent: entity.rate_of_change_percent ?? undefined,
      description: entity.description ?? undefined,
      evaluationWindowMs: entity.evaluation_window_ms ?? undefined,
    };
  }

  /**
   * Convert a repository entity to an Alert domain object
   */
  private entityToAlert(entity: MonitoringAlertInstanceEntity): Alert {
    return {
      id: entity.id,
      ruleId: entity.rule_id,
      ruleName: entity.rule_name ?? undefined,
      metric: entity.metric,
      value: entity.value,
      threshold: entity.threshold,
      severity: entity.severity as AlertSeverity,
      status: entity.status as AlertStatus,
      triggeredAt: entity.triggered_at,
      acknowledgedAt: entity.acknowledged_at ?? undefined,
      acknowledgedBy: entity.acknowledged_by ?? undefined,
      resolvedAt: entity.resolved_at ?? undefined,
      tags: entity.tags,
      message: entity.message ?? undefined,
    };
  }
}
