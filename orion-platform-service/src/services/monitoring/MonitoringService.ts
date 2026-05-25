/**
 * MonitoringService - Business logic layer for Monitoring operations
 *
 * Combines repository-backed persistence (configs, alerts, rules, channels,
 * policies, notification history) with in-memory sub-services for real-time
 * metric collection, rule evaluation, and dashboard generation.
 */

import {
  MonitoringRepository,
  MonitoringConfig,
  Alert,
  AlertRuleRecord,
  NotificationChannelRecord,
  EscalationPolicyRecord,
  NotificationHistoryRecord,
  CreateMonitoringConfigInput,
  CreateAlertInput,
  UpdateAlertInput,
  CreateAlertRuleInput,
  CreateNotificationChannelInput,
  CreateEscalationPolicyInput,
} from './MonitoringRepository';
import { MetricCollector } from './MetricCollector';
import { PostgresMetricStorageRepository } from './MetricStorageRepository';
import { AlertRuleEngine } from './AlertRuleEngine';
import { AlertNotificationService } from './AlertNotificationService';
import { MonitoringDashboard } from './MonitoringDashboard';
import { AlertRule, AlertChannel, EscalationPolicy } from './types';

export interface ListAlertsOptions {
  page?: number;
  limit?: number;
  tenantId?: string;
  status?: string;
  severity?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class MonitoringServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'MonitoringServiceError';
  }
}

export class MonitoringService {
  private repository?: MonitoringRepository;

  // In-memory sub-services for real-time operations
  readonly metricCollector: MetricCollector;
  readonly alertRuleEngine: AlertRuleEngine;
  readonly notificationService: AlertNotificationService;
  readonly dashboard: MonitoringDashboard;

  // Service state
  private running = false;
  private collectionTimer?: NodeJS.Timeout;
  private evaluationTimer?: NodeJS.Timeout;

  constructor(repository?: MonitoringRepository, dbPool?: any) {
    this.repository = repository;

    // Create metric storage repository if database is available
    const metricRepo = dbPool ? new PostgresMetricStorageRepository(dbPool) : undefined;

    // Initialize sub-services
    this.metricCollector = new MetricCollector({
      repository: metricRepo,
    });
    this.alertRuleEngine = new AlertRuleEngine(this.metricCollector);
    this.notificationService = new AlertNotificationService();
    this.dashboard = new MonitoringDashboard(this.metricCollector);

    // Wire alert callbacks
    this.alertRuleEngine.onAlert = (alert) => {
      // Auto-send notifications for new alerts via registered channels
      // In production, this would trigger the notification pipeline
    };
  }

  // ==================== Service Lifecycle ====================

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    // Load persisted rules into the in-memory engine
    await this.loadPersistedRules();

    // Load persisted channels into the notification service
    await this.loadPersistedChannels();

    // Start periodic metric collection (every 30s)
    this.collectionTimer = setInterval(() => {
      this.metricCollector.collectSystemMetrics();
    }, 30000);

    // Start periodic alert evaluation (every 60s)
    this.evaluationTimer = setInterval(() => {
      const newAlerts = this.alertRuleEngine.evaluateRules();
      // In production, these would be persisted via repository
    }, 60000);

    // Collect initial metrics
    this.metricCollector.collectSystemMetrics();
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    if (this.collectionTimer) clearInterval(this.collectionTimer);
    if (this.evaluationTimer) clearInterval(this.evaluationTimer);
  }

  getHealthStatus(): { running: boolean; uptime: string; metricsCount: number; rulesCount: number; activeAlerts: number; alertsCount?: number; status?: string } {
    const activeAlerts = this.alertRuleEngine.getActiveAlerts().length;
    let status = 'healthy';
    if (activeAlerts > 5) status = 'degraded';
    if (activeAlerts > 10) status = 'unhealthy';

    return {
      running: this.running,
      uptime: this.running ? 'running' : 'stopped',
      metricsCount: this.metricCollector.getRegisteredMetrics().length,
      rulesCount: this.alertRuleEngine.getAllRules().length,
      activeAlerts,
      alertsCount: activeAlerts,
      status,
    };
  }

  // ==================== Monitoring Config ====================

  async getConfig(id: string): Promise<MonitoringConfig> {
    if (!this.repository) throw new MonitoringServiceError('Database not configured', 'NO_DATABASE');
    const config = await this.repository.findConfigById(id);
    if (!config) throw new MonitoringServiceError(`Config not found: ${id}`, 'CONFIG_NOT_FOUND');
    return config;
  }

  async listConfigs(tenantId?: string): Promise<MonitoringConfig[]> {
    if (!this.repository) throw new MonitoringServiceError('Database not configured', 'NO_DATABASE');
    return this.repository.findAllConfigs(tenantId);
  }

  async createConfig(input: CreateMonitoringConfigInput): Promise<MonitoringConfig> {
    if (!this.repository) throw new MonitoringServiceError('Database not configured', 'NO_DATABASE');
    if (!input.tenant_id) throw new MonitoringServiceError('Tenant ID required', 'INVALID_INPUT');
    if (!input.name) throw new MonitoringServiceError('Name required', 'INVALID_INPUT');
    return this.repository.createConfig(input);
  }

  async updateConfig(id: string, input: Partial<CreateMonitoringConfigInput>): Promise<MonitoringConfig> {
    if (!this.repository) throw new MonitoringServiceError('Database not configured', 'NO_DATABASE');
    const existing = await this.repository.findConfigById(id);
    if (!existing) throw new MonitoringServiceError(`Config not found: ${id}`, 'CONFIG_NOT_FOUND');
    const updated = await this.repository.updateConfig(id, input);
    if (!updated) throw new MonitoringServiceError(`Failed to update config: ${id}`, 'UPDATE_FAILED');
    return updated;
  }

  async deleteConfig(id: string): Promise<boolean> {
    if (!this.repository) throw new MonitoringServiceError('Database not configured', 'NO_DATABASE');
    const existing = await this.repository.findConfigById(id);
    if (!existing) throw new MonitoringServiceError(`Config not found: ${id}`, 'CONFIG_NOT_FOUND');
    return this.repository.deleteConfig(id);
  }

  async enableConfig(id: string): Promise<MonitoringConfig> {
    return this.updateConfig(id, { enabled: true });
  }

  async disableConfig(id: string): Promise<MonitoringConfig> {
    return this.updateConfig(id, { enabled: false });
  }

  // ==================== Alerts ====================

  async getAlert(id: string): Promise<Alert> {
    if (!this.repository) throw new MonitoringServiceError('Database not configured', 'NO_DATABASE');
    const alert = await this.repository.findAlertById(id);
    if (!alert) throw new MonitoringServiceError(`Alert not found: ${id}`, 'ALERT_NOT_FOUND');
    return alert;
  }

  async listAlerts(options: ListAlertsOptions = {}): Promise<PaginatedResult<Alert>> {
    if (!this.repository) throw new MonitoringServiceError('Database not configured', 'NO_DATABASE');
    const { page = 1, limit = 20, tenantId, status, severity } = options;
    const offset = (page - 1) * limit;

    const [alerts, total] = await Promise.all([
      this.repository.findAllAlerts({ tenantId, status, severity, limit, offset }),
      this.repository.countAlerts({ tenantId, status }),
    ]);

    return { data: alerts, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async createAlert(input: CreateAlertInput): Promise<Alert> {
    if (!this.repository) throw new MonitoringServiceError('Database not configured', 'NO_DATABASE');
    if (!input.tenant_id) throw new MonitoringServiceError('Tenant ID required', 'INVALID_INPUT');
    if (!input.title) throw new MonitoringServiceError('Title required', 'INVALID_INPUT');
    return this.repository.createAlert(input);
  }

  async acknowledgeAlert(id: string, userId: string): Promise<Alert> {
    if (!this.repository) {
      // In-memory mode: acknowledge in alertRuleEngine
      const alerts = this.alertRuleEngine.getActiveAlerts();
      const alert = alerts.find(a => a.id === id);
      if (!alert) throw new MonitoringServiceError(`Alert not found: ${id}`, 'ALERT_NOT_FOUND');
      alert.status = 'acknowledged';
      alert.acknowledgedBy = userId;
      alert.acknowledgedAt = new Date();
      return alert as unknown as Alert;
    }
    const alert = await this.repository.findAlertById(id);
    if (!alert) throw new MonitoringServiceError(`Alert not found: ${id}`, 'ALERT_NOT_FOUND');
    const updated = await this.repository.acknowledgeAlert(id, userId);
    if (!updated) throw new MonitoringServiceError(`Failed to acknowledge: ${id}`, 'UPDATE_FAILED');
    return updated;
  }

  async resolveAlert(id: string): Promise<Alert> {
    if (!this.repository) {
      // In-memory mode: resolve in alertRuleEngine
      const alerts = this.alertRuleEngine.getActiveAlerts();
      const alert = alerts.find(a => a.id === id);
      if (!alert) throw new MonitoringServiceError(`Alert not found: ${id}`, 'ALERT_NOT_FOUND');
      alert.status = 'resolved';
      alert.resolvedAt = new Date();
      return alert as unknown as Alert;
    }
    const alert = await this.repository.findAlertById(id);
    if (!alert) throw new MonitoringServiceError(`Alert not found: ${id}`, 'ALERT_NOT_FOUND');
    const updated = await this.repository.resolveAlert(id);
    if (!updated) throw new MonitoringServiceError(`Failed to resolve: ${id}`, 'UPDATE_FAILED');
    return updated;
  }

  // ==================== Alert Rules ====================

  async listRules(tenantId?: string): Promise<AlertRuleRecord[]> {
    if (!this.repository) throw new MonitoringServiceError('Database not configured', 'NO_DATABASE');
    return this.repository.findAllRules(tenantId);
  }

  async getRule(id: string): Promise<AlertRuleRecord> {
    if (!this.repository) throw new MonitoringServiceError('Database not configured', 'NO_DATABASE');
    const rule = await this.repository.findRuleById(id);
    if (!rule) throw new MonitoringServiceError(`Rule not found: ${id}`, 'RULE_NOT_FOUND');
    return rule;
  }

  async createRule(input: CreateAlertRuleInput): Promise<AlertRuleRecord> {
    if (!this.repository) throw new MonitoringServiceError('Database not configured', 'NO_DATABASE');
    if (!input.tenant_id) throw new MonitoringServiceError('Tenant ID required', 'INVALID_INPUT');
    if (!input.name) throw new MonitoringServiceError('Name required', 'INVALID_INPUT');
    if (!input.metric) throw new MonitoringServiceError('Metric required', 'INVALID_INPUT');
    if (!input.condition) throw new MonitoringServiceError('Condition required', 'INVALID_INPUT');
    if (input.threshold === undefined) throw new MonitoringServiceError('Threshold required', 'INVALID_INPUT');

    const record = await this.repository.createRule(input);

    // Also add to in-memory engine for real-time evaluation
    this.alertRuleEngine.addRule(this.ruleRecordToRule(record));

    return record;
  }

  async updateRule(id: string, input: Partial<CreateAlertRuleInput>): Promise<AlertRuleRecord> {
    if (!this.repository) throw new MonitoringServiceError('Database not configured', 'NO_DATABASE');
    const existing = await this.repository.findRuleById(id);
    if (!existing) throw new MonitoringServiceError(`Rule not found: ${id}`, 'RULE_NOT_FOUND');
    const updated = await this.repository.updateRule(id, input);
    if (!updated) throw new MonitoringServiceError(`Failed to update rule: ${id}`, 'UPDATE_FAILED');

    // Update in-memory engine
    this.alertRuleEngine.updateRule(id, this.ruleRecordToPartialRule(updated));

    return updated;
  }

  async deleteRule(id: string): Promise<boolean> {
    if (!this.repository) throw new MonitoringServiceError('Database not configured', 'NO_DATABASE');
    const existing = await this.repository.findRuleById(id);
    if (!existing) throw new MonitoringServiceError(`Rule not found: ${id}`, 'RULE_NOT_FOUND');

    // Remove from in-memory engine
    this.alertRuleEngine.removeRule(id);

    return this.repository.deleteRule(id);
  }

  async toggleRule(id: string, enabled: boolean): Promise<AlertRuleRecord> {
    if (!this.repository) throw new MonitoringServiceError('Database not configured', 'NO_DATABASE');
    const updated = await this.repository.toggleRule(id, enabled);
    if (!updated) throw new MonitoringServiceError(`Rule not found: ${id}`, 'RULE_NOT_FOUND');
    this.alertRuleEngine.toggleRule(id, enabled);
    return updated;
  }

  async suppressRule(id: string): Promise<AlertRuleRecord> {
    if (!this.repository) throw new MonitoringServiceError('Database not configured', 'NO_DATABASE');
    const updated = await this.repository.suppressRule(id);
    if (!updated) throw new MonitoringServiceError(`Rule not found: ${id}`, 'RULE_NOT_FOUND');
    return updated;
  }

  async unsuppressRule(id: string): Promise<AlertRuleRecord> {
    if (!this.repository) throw new MonitoringServiceError('Database not configured', 'NO_DATABASE');
    const updated = await this.repository.unsuppressRule(id);
    if (!updated) throw new MonitoringServiceError(`Rule not found: ${id}`, 'RULE_NOT_FOUND');
    return updated;
  }

  async evaluateRules(): Promise<any[]> {
    const newAlerts = this.alertRuleEngine.evaluateRules();
    return newAlerts;
  }

  // ==================== Notification Channels ====================

  async listChannels(tenantId?: string): Promise<NotificationChannelRecord[]> {
    if (!this.repository) throw new MonitoringServiceError('Database not configured', 'NO_DATABASE');
    return this.repository.findAllChannels(tenantId);
  }

  async createChannel(input: CreateNotificationChannelInput): Promise<NotificationChannelRecord> {
    if (!this.repository) throw new MonitoringServiceError('Database not configured', 'NO_DATABASE');
    if (!input.tenant_id) throw new MonitoringServiceError('Tenant ID required', 'INVALID_INPUT');
    if (!input.name) throw new MonitoringServiceError('Name required', 'INVALID_INPUT');
    if (!input.type) throw new MonitoringServiceError('Type required', 'INVALID_INPUT');
    if (!input.config) throw new MonitoringServiceError('Config required', 'INVALID_INPUT');

    const record = await this.repository.createChannel(input);

    // Also add to in-memory notification service
    this.notificationService.addChannel(this.channelRecordToChannel(record));

    return record;
  }

  async toggleChannel(id: string, enabled: boolean): Promise<NotificationChannelRecord> {
    if (!this.repository) throw new MonitoringServiceError('Database not configured', 'NO_DATABASE');
    const updated = await this.repository.toggleChannel(id, enabled);
    if (!updated) throw new MonitoringServiceError(`Channel not found: ${id}`, 'CHANNEL_NOT_FOUND');
    this.notificationService.toggleChannel(id, enabled);
    return updated;
  }

  // ==================== Escalation Policies ====================

  async listPolicies(tenantId?: string): Promise<EscalationPolicyRecord[]> {
    if (!this.repository) throw new MonitoringServiceError('Database not configured', 'NO_DATABASE');
    return this.repository.findAllPolicies(tenantId);
  }

  async createPolicy(input: CreateEscalationPolicyInput): Promise<EscalationPolicyRecord> {
    if (!this.repository) throw new MonitoringServiceError('Database not configured', 'NO_DATABASE');
    if (!input.tenant_id) throw new MonitoringServiceError('Tenant ID required', 'INVALID_INPUT');
    if (!input.name) throw new MonitoringServiceError('Name required', 'INVALID_INPUT');
    if (!input.steps || !Array.isArray(input.steps)) throw new MonitoringServiceError('Steps array required', 'INVALID_INPUT');

    const record = await this.repository.createPolicy(input);

    // Also add to in-memory notification service
    this.notificationService.addEscalationPolicy(this.policyRecordToPolicy(record));

    return record;
  }

  // ==================== Notification History ====================

  async getNotificationHistory(options?: { tenantId?: string; alertId?: string; channelId?: string; status?: string; limit?: number }): Promise<NotificationHistoryRecord[]> {
    if (!this.repository) throw new MonitoringServiceError('Database not configured', 'NO_DATABASE');
    return this.repository.findNotificationHistory(options);
  }

  // ==================== Stats ====================

  async getAlertStats(tenantId?: string) {
    if (!this.repository) throw new MonitoringServiceError('Database not configured', 'NO_DATABASE');
    return this.repository.getAlertStats(tenantId);
  }

  // ==================== Dashboard ====================

  getDashboardData() {
    const activeAlerts = this.alertRuleEngine.getAlertCountsBySeverity();
    return this.dashboard.getDashboardData(activeAlerts as any);
  }

  // ==================== In-memory operations (compatibility) ====================

  /**
   * Add a rule directly to the in-memory engine (for legacy compatibility).
   * Prefer createRule() for database-backed persistence.
   */
  addRule(rule: AlertRule): void {
    this.alertRuleEngine.addRule(rule);
  }

  /**
   * Remove a rule from the in-memory engine (for legacy compatibility).
   * Prefer deleteRule() for database-backed persistence.
   */
  removeRule(id: string): void {
    this.alertRuleEngine.removeRule(id);
  }

  /**
   * Get alerts from in-memory engine (for legacy compatibility).
   * Prefer listAlerts() for database-backed persistence.
   */
  getAlerts(filter?: { status?: string; severity?: string; ruleId?: string }): any[] {
    return this.alertRuleEngine.getAlerts(filter as any);
  }

  /**
   * Get active alerts from in-memory engine.
   */
  getActiveAlerts(): any[] {
    return this.alertRuleEngine.getActiveAlerts();
  }

  /**
   * Get registered metrics from the metric collector (for legacy compatibility).
   */
  getMetrics(metricName?: string): { dataPoints: any[] } | string[] {
    if (metricName) {
      return this.metricCollector.getMetricSeries({ name: metricName });
    }
    return this.metricCollector.getRegisteredMetrics();
  }

  // ==================== Private Helpers ====================

  private async loadPersistedRules(): Promise<void> {
    if (!this.repository) return;
    try {
      const rules = await this.repository.findAllRules();
      for (const record of rules) {
        this.alertRuleEngine.addRule(this.ruleRecordToRule(record));
      }
    } catch (error) {
      console.warn('[MonitoringService] Failed to load persisted rules:', error);
    }
  }

  private async loadPersistedChannels(): Promise<void> {
    if (!this.repository) return;
    try {
      const channels = await this.repository.findAllChannels();
      for (const record of channels) {
        this.notificationService.addChannel(this.channelRecordToChannel(record));
      }
    } catch (error) {
      console.warn('[MonitoringService] Failed to load persisted channels:', error);
    }
  }

  private ruleRecordToRule(record: AlertRuleRecord): AlertRule {
    return {
      id: record.id,
      name: record.name,
      metric: record.metric,
      condition: record.condition as any,
      threshold: Number(record.threshold),
      severity: record.severity as any,
      enabled: record.enabled,
      cooldownMs: record.cooldown_ms,
      tags: record.tags || undefined,
      rateOfChangePercent: record.rate_of_change_percent || undefined,
      description: record.description || undefined,
      evaluationWindowMs: record.evaluation_window_ms || undefined,
    };
  }

  private ruleRecordToPartialRule(record: AlertRuleRecord): Partial<AlertRule> {
    return {
      name: record.name,
      metric: record.metric,
      condition: record.condition as any,
      threshold: Number(record.threshold),
      severity: record.severity as any,
      enabled: record.enabled,
      cooldownMs: record.cooldown_ms,
      tags: record.tags || undefined,
      rateOfChangePercent: record.rate_of_change_percent || undefined,
      description: record.description || undefined,
      evaluationWindowMs: record.evaluation_window_ms || undefined,
    };
  }

  private channelRecordToChannel(record: NotificationChannelRecord): AlertChannel {
    return {
      id: record.id,
      name: record.name,
      type: record.type as any,
      config: record.config as any,
      enabled: record.enabled,
      severityFilter: record.severity_filter as any,
    };
  }

  private policyRecordToPolicy(record: EscalationPolicyRecord): EscalationPolicy {
    return {
      id: record.id,
      name: record.name,
      steps: record.steps as any,
      repeatCount: record.repeat_count,
      enabled: record.enabled,
      description: record.description || undefined,
    };
  }
}
