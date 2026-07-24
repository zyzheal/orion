import type {
  Alert,
  AlertSubscription,
  SubscribeAlertInput,
  Severity,
  Status,
  NotificationChannel,
} from '../types/monitor.js';
import { AlertRepository } from '../repositories/AlertRepository.js';

export class AlertService {
  constructor(private repo: AlertRepository) {}

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
    const alert = await this.repo.create(tenantId, projectId, createdBy, {
      ruleId: input.ruleId,
      ruleName: input.ruleName,
      severity: input.severity,
      triggeredAt: new Date().toISOString(),
      currentValue: input.currentValue,
      threshold: input.threshold,
      message: input.message,
    });

    // Fire-and-forget notification
    this.notifySubscribers(alert).catch(() => {});
    return alert;
  }

  async resolveAlert(tenantId: string, alertId: string): Promise<Alert | undefined> {
    const alert = await this.repo.findById(alertId);
    if (alert?.tenantId !== tenantId) return undefined;
    return (await this.repo.updateStatus(alertId, 'resolved')) ?? undefined;
  }

  async listAlerts(
    tenantId: string,
    filters?: { projectId?: string; severity?: Severity; status?: Status },
  ): Promise<Alert[]> {
    return this.repo.findByTenant(tenantId, filters);
  }

  async subscribe(
    userId: string,
    tenantId: string,
    input: SubscribeAlertInput,
  ): Promise<AlertSubscription> {
    return this.repo.createSubscription(tenantId, userId, input.channels, input.filters);
  }

  async notifySubscribers(alert: Alert): Promise<void> {
    const subs = await this.repo.findSubscriptions(alert.tenantId);
    for (const sub of subs) {
      if (!sub.enabled || !this.matchesFilter(sub, alert)) continue;
      for (const channel of sub.channels) {
        await this.sendNotification(channel, sub, alert);
      }
    }
  }

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
