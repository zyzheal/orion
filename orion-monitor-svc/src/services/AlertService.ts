import type {
  Alert,
  AlertSubscription,
  SubscribeAlertInput,
  Severity,
  Status,
  NotificationChannel,
} from '../types/monitor.js';

/**
 * In-memory store (stub — replace with database in production).
 */
const alerts: Map<string, Alert> = new Map();
const subscriptions: Map<string, AlertSubscription> = new Map();

export class AlertService {
  /**
   * Create an alert (called by the monitoring engine when a rule fires).
   */
  async createAlert(
    tenantId: string,
    projectId: string,
    createdBy: string,
    input: {
      ruleId: string;
      ruleName: string;
      severity: Severity;
      currentValue: number;
      threshold: number;
      message: string;
    },
  ): Promise<Alert> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const alert: Alert = {
      id,
      tenantId,
      projectId,
      ruleId: input.ruleId,
      ruleName: input.ruleName,
      severity: input.severity,
      status: 'active',
      triggeredAt: now,
      currentValue: input.currentValue,
      threshold: input.threshold,
      message: input.message,
      createdAt: now,
      updatedAt: now,
      createdBy,
    };

    alerts.set(id, alert);

    // TODO: Notify subscribers via AlertService.notifySubscribers()
    // TODO: Create ticket via orion-ticket-svc integration

    return alert;
  }

  /**
   * Resolve an alert.
   */
  async resolveAlert(
    tenantId: string,
    alertId: string,
  ): Promise<Alert | undefined> {
    const alert = alerts.get(alertId);
    if (alert?.tenantId !== tenantId) return undefined;

    alert.status = 'resolved';
    alert.resolvedAt = new Date().toISOString();
    alert.updatedAt = new Date().toISOString();
    alerts.set(alertId, alert);
    return alert;
  }

  /**
   * List alerts with filtering.
   */
  async listAlerts(
    tenantId: string,
    filters?: {
      projectId?: string;
      severity?: Severity;
      status?: Status;
    },
  ): Promise<Alert[]> {
    return Array.from(alerts.values()).filter((a) => {
      if (a.tenantId !== tenantId) return false;
      if (filters?.projectId && a.projectId !== filters.projectId) return false;
      if (filters?.severity && a.severity !== filters.severity) return false;
      if (filters?.status && a.status !== filters.status) return false;
      return true;
    });
  }

  /**
   * Subscribe to alerts.
   */
  async subscribe(
    userId: string,
    tenantId: string,
    input: SubscribeAlertInput,
  ): Promise<AlertSubscription> {
    const id = crypto.randomUUID();
    const sub: AlertSubscription = {
      id,
      tenantId,
      userId,
      channels: input.channels,
      filters: input.filters,
      enabled: true,
    };
    subscriptions.set(id, sub);
    return sub;
  }

  /**
   * Notify subscribers about an alert (stub).
   */
  async notifySubscribers(alert: Alert): Promise<void> {
    const subs = Array.from(subscriptions.values()).filter(
      (s) =>
        s.enabled &&
        s.tenantId === alert.tenantId &&
        this.matchesFilter(s, alert),
    );

    for (const sub of subs) {
      for (const channel of sub.channels) {
        await this.sendNotification(channel, sub, alert);
      }
    }
  }

  // -- Private helpers --

  private matchesFilter(sub: AlertSubscription, alert: Alert): boolean {
    const f = sub.filters;
    if (!f) return true;
    if (f.severities && !f.severities.includes(alert.severity)) return false;
    if (f.projectIds && !f.projectIds.includes(alert.projectId)) return false;
    return true;
  }

  private async sendNotification(
    _channel: NotificationChannel,
    _sub: AlertSubscription,
    _alert: Alert,
  ): Promise<void> {
    // TODO: Implement per-channel notification (email, webhook, slack, etc.)
  }
}
