/**
 * TASK-703: Monitoring Service (Main Orchestrator)
 *
 * Orchestrates metric collection, alert evaluation, and notifications.
 * Subscribes to NATS events for monitoring. Runs periodic metric collection
 * and alert evaluation loops.
 */

import { EventEmitter } from 'events';
import { MetricCollector } from './MetricCollector';
import { AlertRuleEngine } from './AlertRuleEngine';
import { AlertNotificationService } from './AlertNotificationService';
import { MonitoringDashboard } from './MonitoringDashboard';
import {
  Alert,
  AlertRule,
  AlertChannel,
  AlertSeverity,
  EscalationPolicy,
  MonitoringConfig,
  Metric,
  DashboardData,
  AnomalyResult,
} from './types';
import { WidgetConfig } from './MonitoringDashboard';

/**
 * Default monitoring configuration
 */
const DEFAULT_CONFIG: MonitoringConfig = {
  collectionIntervalMs: 30 * 1000, // 30 seconds
  evaluationIntervalMs: 15 * 1000, // 15 seconds
  retentionMs: 24 * 60 * 60 * 1000, // 24 hours
  maxDataPointsPerMetric: 10000,
  anomalyZScoreThreshold: 2.5,
  enableSystemMetrics: true,
  natsSubjectPrefix: 'orion.monitoring',
};

/**
 * NATS event types for monitoring
 */
export type MonitoringEventType =
  | 'metric.collected'
  | 'alert.triggered'
  | 'alert.resolved'
  | 'alert.acknowledged'
  | 'system.metrics.collected';

/**
 * Monitoring Service - Main orchestration layer
 *
 * Coordinates:
 * - Periodic metric collection
 * - Alert rule evaluation
 * - Alert notification delivery
 * - Escalation management
 * - Dashboard data generation
 * - NATS event subscription for monitoring
 */
export class MonitoringService extends EventEmitter {
  /** Service configuration */
  private config: MonitoringConfig;

  /** Metric collector */
  public metricCollector: MetricCollector;

  /** Alert rule engine */
  public alertRuleEngine: AlertRuleEngine;

  /** Alert notification service */
  public notificationService: AlertNotificationService;

  /** Monitoring dashboard */
  public dashboard: MonitoringDashboard;

  /** Running state */
  private isRunning: boolean = false;

  /** Metric collection interval timer */
  private collectionTimer?: NodeJS.Timeout;

  /** Alert evaluation interval timer */
  private evaluationTimer?: NodeJS.Timeout;

  /** NATS connection (optional) */
  private natsConnection: any = null;

  /** NATS event handler unsubscriber */
  private natsUnsubscribe?: () => Promise<void>;

  constructor(config?: Partial<MonitoringConfig>) {
    super();

    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize components
    this.metricCollector = new MetricCollector({
      retentionMs: this.config.retentionMs,
      maxDataPointsPerMetric: this.config.maxDataPointsPerMetric,
    });

    this.alertRuleEngine = new AlertRuleEngine(this.metricCollector);
    this.notificationService = new AlertNotificationService();
    this.dashboard = new MonitoringDashboard(this.metricCollector, {
      anomalyThreshold: this.config.anomalyZScoreThreshold,
    });

    // Set up alert callback
    this.alertRuleEngine.onAlert = (alert: Alert) => {
      this.handleNewAlert(alert);
    };
  }

  // ==================== Lifecycle ====================

  /**
   * Start the monitoring service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[MonitoringService] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[MonitoringService] Starting...');

    // Start periodic metric collection
    if (this.config.enableSystemMetrics) {
      this.startCollectionLoop();
    }

    // Start periodic alert evaluation
    this.startEvaluationLoop();

    // Connect to NATS if available
    await this.connectNats();

    // Collect initial system metrics
    if (this.config.enableSystemMetrics) {
      this.metricCollector.collectSystemMetrics();
    }

    this.emit('started');
    console.log('[MonitoringService] Started');
  }

  /**
   * Stop the monitoring service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;
    console.log('[MonitoringService] Stopping...');

    // Clear timers
    if (this.collectionTimer) {
      clearTimeout(this.collectionTimer);
      this.collectionTimer = undefined;
    }

    if (this.evaluationTimer) {
      clearTimeout(this.evaluationTimer);
      this.evaluationTimer = undefined;
    }

    // Cancel all escalations
    this.notificationService.clearAll();

    // Disconnect NATS
    if (this.natsConnection) {
      try {
        await this.natsUnsubscribe?.();
        await this.natsConnection.close();
      } catch (error) {
        console.warn('[MonitoringService] Error disconnecting NATS:', error);
      }
      this.natsConnection = null;
    }

    this.emit('stopped');
    console.log('[MonitoringService] Stopped');
  }

  /**
   * Check if the service is running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  // ==================== Collection Loop ====================

  /**
   * Start periodic metric collection
   */
  private startCollectionLoop(): void {
    const collect = () => {
      if (!this.isRunning) return;

      try {
        const metrics = this.metricCollector.collectSystemMetrics();
        this.emit('metrics:collected', metrics);

        // Publish to NATS
        this.publishNatsEvent('system.metrics.collected', {
          metricCount: metrics.length,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('[MonitoringService] Collection error:', error);
      }

      this.collectionTimer = setTimeout(collect, this.config.collectionIntervalMs);
    };

    this.collectionTimer = setTimeout(collect, this.config.collectionIntervalMs);
  }

  // ==================== Evaluation Loop ====================

  /**
   * Start periodic alert evaluation
   */
  private startEvaluationLoop(): void {
    const evaluate = () => {
      if (!this.isRunning) return;

      try {
        const newAlerts = this.alertRuleEngine.evaluateRules();

        if (newAlerts.length > 0) {
          this.emit('alerts:new', newAlerts);
        }
      } catch (error) {
        console.error('[MonitoringService] Evaluation error:', error);
      }

      this.evaluationTimer = setTimeout(evaluate, this.config.evaluationIntervalMs);
    };

    this.evaluationTimer = setTimeout(evaluate, this.config.evaluationIntervalMs);
  }

  // ==================== Alert Handling ====================

  /**
   * Handle a new alert trigger
   */
  private async handleNewAlert(alert: Alert): Promise<void> {
    console.log(
      `[MonitoringService] Alert triggered: ${alert.ruleName || alert.metric} (${alert.severity})`
    );

    this.emit('alert:triggered', alert);

    // Publish to NATS
    this.publishNatsEvent('alert.triggered', {
      alertId: alert.id,
      ruleId: alert.ruleId,
      severity: alert.severity,
      metric: alert.metric,
      value: alert.value,
      threshold: alert.threshold,
      message: alert.message,
    });

    // Send notifications
    await this.sendAlertNotifications(alert);
  }

  /**
   * Send notifications for an alert
   */
  private async sendAlertNotifications(alert: Alert): Promise<void> {
    // Find channels that match this alert's severity
    const channels = this.notificationService.getAllChannels();
    const matchingChannelIds = channels
      .filter(c => {
        if (!c.enabled) return false;
        if (c.severityFilter && !c.severityFilter.includes(alert.severity)) return false;
        return true;
      })
      .map(c => c.id);

    if (matchingChannelIds.length === 0) return;

    try {
      const records = await this.notificationService.sendNotification(
        alert,
        matchingChannelIds
      );

      this.emit('alert:notifications:sent', { alert, records });
    } catch (error) {
      console.error('[MonitoringService] Error sending notifications:', error);
      this.emit('alert:notification:error', { alert, error });
    }
  }

  // ==================== Public API ====================

  /**
   * Add an alert rule
   */
  addRule(rule: AlertRule): void {
    this.alertRuleEngine.addRule(rule);
    console.log(`[MonitoringService] Rule added: ${rule.name} (${rule.id})`);
  }

  /**
   * Remove an alert rule
   */
  removeRule(ruleId: string): boolean {
    return this.alertRuleEngine.removeRule(ruleId);
  }

  /**
   * Get all alerts
   */
  getAlerts(filter?: {
    status?: string;
    severity?: AlertSeverity;
    ruleId?: string;
  }) {
    return this.alertRuleEngine.getAlerts(filter as any);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return this.alertRuleEngine.getActiveAlerts();
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): Alert | null {
    const alert = this.alertRuleEngine.acknowledgeAlert(alertId, acknowledgedBy);
    if (alert) {
      this.notificationService.acknowledgeAlert(alertId, acknowledgedBy);
      this.publishNatsEvent('alert.acknowledged', {
        alertId,
        acknowledgedBy,
        timestamp: new Date().toISOString(),
      });
      this.emit('alert:acknowledged', alert);
    }
    return alert;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): Alert | null {
    const alert = this.alertRuleEngine.resolveAlert(alertId);
    if (alert) {
      this.publishNatsEvent('alert.resolved', {
        alertId,
        timestamp: new Date().toISOString(),
      });
      this.emit('alert:resolved', alert);
    }
    return alert;
  }

  /**
   * Get metric data
   */
  getMetrics(metricName?: string, tags?: Record<string, string>) {
    if (metricName) {
      return this.metricCollector.getMetricSeries({ name: metricName, tags });
    }
    return this.metricCollector.getRegisteredMetrics();
  }

  /**
   * Get dashboard data
   */
  getDashboardData(): DashboardData {
    const alertCounts = this.alertRuleEngine.getAlertCountsBySeverity();
    return this.dashboard.getDashboardData(alertCounts as Record<AlertSeverity, number>);
  }

  /**
   * Get anomalies
   */
  getAnomalies(metricName?: string, timeWindow?: string): AnomalyResult[] {
    if (metricName) {
      return this.dashboard.detectAnomalies(metricName, timeWindow as any);
    }
    return this.dashboard.detectAllAnomalies ? this.dashboard.detectAllAnomalies() : [];
  }

  // ==================== NATS Integration ====================

  /**
   * Connect to NATS for monitoring events
   */
  private async connectNats(): Promise<void> {
    try {
      const { connect } = await import('nats').catch(() => ({ connect: null }));

      if (!connect) {
        console.log('[MonitoringService] NATS not available, running without event subscription');
        return;
      }

      this.natsConnection = await connect({
        servers: ['nats://localhost:4222'],
        timeout: 5000,
        reconnect: false,
      });

      console.log('[MonitoringService] Connected to NATS');

      // Subscribe to relevant events
      await this.subscribeToEvents();
    } catch (error) {
      console.log('[MonitoringService] NATS connection failed, running without event bus:', error);
    }
  }

  /**
   * Subscribe to NATS monitoring events
   */
  private async subscribeToEvents(): Promise<void> {
    if (!this.natsConnection) return;

    try {
      const subject = `${this.config.natsSubjectPrefix}.>`;
      const subscription = this.natsConnection.subscribe(subject, {
        queue: 'orion-monitoring',
      });

      (async () => {
        for await (const msg of subscription) {
          try {
            const data = JSON.parse(new TextDecoder().decode(msg.data));
            this.handleNatsMessage(msg.subject, data);
            msg.ack();
          } catch (error) {
            console.error('[MonitoringService] Error processing NATS message:', error);
          }
        }
      })().catch(console.error);

      this.natsUnsubscribe = async () => {
        await subscription.drain();
      };

      console.log(`[MonitoringService] Subscribed to ${subject}`);
    } catch (error) {
      console.warn('[MonitoringService] Failed to subscribe to NATS events:', error);
    }
  }

  /**
   * Handle incoming NATS message
   */
  private handleNatsMessage(subject: string, data: any): void {
    this.emit('nats:message', { subject, data });

    // Process specific event types
    if (subject.includes('metric')) {
      this.handleExternalMetric(data);
    }
  }

  /**
   * Handle external metric data from NATS
   */
  private handleExternalMetric(data: any): void {
    if (data.name && data.value !== undefined) {
      this.metricCollector.recordMetric(
        data.name,
        data.value,
        data.tags,
        data.timestamp ? new Date(data.timestamp) : undefined
      );
      this.emit('metric:recorded', { name: data.name, value: data.value });
    }
  }

  /**
   * Publish event to NATS
   */
  private async publishNatsEvent(eventType: string, data: any): Promise<void> {
    if (!this.natsConnection) return;

    try {
      const subject = `${this.config.natsSubjectPrefix}.${eventType}`;
      const message = JSON.stringify({
        type: eventType,
        source: 'orion-monitoring-service',
        data,
        timestamp: new Date().toISOString(),
      });

      await this.natsConnection.publish(
        subject,
        new TextEncoder().encode(message)
      );
    } catch (error) {
      // Silently fail - NATS is optional
    }
  }

  // ==================== Maintenance ====================

  /**
   * Prune expired metric data
   */
  pruneExpiredMetrics(): number {
    return this.metricCollector.pruneExpired();
  }

  /**
   * Get service health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    isRunning: boolean;
    rulesCount: number;
    alertsCount: number;
    channelsCount: number;
    metricsCount: number;
  } {
    const activeAlerts = this.alertRuleEngine.getActiveAlerts().length;
    const rulesCount = this.alertRuleEngine.getAllRules().length;
    const channelsCount = this.notificationService.getAllChannels().length;
    const metricsCount = this.metricCollector.getRegisteredMetrics().length;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (activeAlerts > 10) status = 'unhealthy';
    else if (activeAlerts > 5) status = 'degraded';

    return {
      status,
      isRunning: this.isRunning,
      rulesCount,
      alertsCount: activeAlerts,
      channelsCount,
      metricsCount,
    };
  }
}
