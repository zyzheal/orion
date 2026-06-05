/**
 * TASK-703: Alert Notification Service
 *
 * Sends alerts via multiple channels (email, webhook, Slack).
 * Supports escalation policies with timed steps, alert acknowledgment
 * tracking, and notification history.
 */

import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';
import { OrionError } from '../../errors';
import {
  MonitoringNotificationChannelRepository,
} from '../../repositories/MonitoringNotificationChannelRepository';
import {
  MonitoringEscalationPolicyRepository,
} from '../../repositories/MonitoringEscalationPolicyRepository';
import {
  MonitoringNotificationHistoryRepository,
} from '../../repositories/MonitoringNotificationHistoryRepository';

const logger = pino({ name: 'LAlert-LNotification-LService' });
import {
  Alert,
  AlertChannel,
  AlertSeverity,
  ChannelType,
  EscalationPolicy,
  NotificationRecord,
  NotificationStatus,
  ChannelConfig,
  EmailChannelConfig,
  WebhookChannelConfig,
  SlackChannelConfig,
} from './types';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

type DbConnection = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

/**
 * Escalation state for a specific alert
 */
interface EscalationState {
  /** Alert ID */
  alertId: string;
  /** Current step index */
  currentStep: number;
  /** When escalation started */
  startedAt: Date;
  /** Timer for next step */
  nextStepTimer?: NodeJS.Timeout;
  /** Repeat count */
  repeatCount: number;
}

/**
 * Alert Notification Service - Handles alert delivery and escalation
 *
 * Supports:
 * - Multiple notification channels (email, webhook, Slack)
 * - Escalation policies with timed steps
 * - Alert acknowledgment tracking
 * - Notification history and delivery status
 */
export class AlertNotificationService {
  /** Optional PostgreSQL repository for notification channels */
  private readonly channelRepo?: MonitoringNotificationChannelRepository;

  /** Optional PostgreSQL repository for escalation policies */
  private readonly escalationPolicyRepo?: MonitoringEscalationPolicyRepository;

  /** Optional PostgreSQL repository for notification history */
  private readonly notificationHistoryRepo?: MonitoringNotificationHistoryRepository;

  /** Registered notification channels (in-memory cache) */
  private channels: Map<string, AlertChannel> = new Map();

  /** Registered escalation policies (in-memory cache) */
  private escalationPolicies: Map<string, EscalationPolicy> = new Map();

  /** Notification history (in-memory cache) */
  private notifications: NotificationRecord[] = [];

  /** Active escalation states */
  private escalationStates: Map<string, EscalationState> = new Map();

  /** Alert to escalation policy mapping */
  private alertEscalationMap: Map<string, string> = new Map();

  constructor(db?: DbConnection) {
    if (db) {
      this.channelRepo = new MonitoringNotificationChannelRepository(db);
      this.escalationPolicyRepo = new MonitoringEscalationPolicyRepository(db);
      this.notificationHistoryRepo = new MonitoringNotificationHistoryRepository(db);
    }
  }

  // ==================== Channel Management ====================

  /**
   * Add a notification channel
   */
  addChannel(channel: AlertChannel): void {
    this.channels.set(channel.id, channel);

    // Persist to repository if available (fire-and-forget)
    this.channelRepo?.create({
      id: channel.id,
      tenant_id: '00000000-0000-0000-0000-000000000000',
      name: channel.name,
      type: channel.type,
      config: channel.config,
      enabled: channel.enabled,
      severity_filter: channel.severityFilter || [],
    } as any).catch((err: any) =>
      logger.warn('[AlertNotificationService] Failed to persist channel:', err)
    );
  }

  /**
   * Update a channel
   */
  updateChannel(channelId: string, updates: Partial<AlertChannel>): AlertChannel | null {
    const existing = this.channels.get(channelId);
    if (!existing) return null;

    const updated = { ...existing, ...updates };
    this.channels.set(channelId, updated);

    // Persist to repository if available (fire-and-forget)
    const repoUpdate: any = {};
    if (updates.name !== undefined) repoUpdate.name = updates.name;
    if (updates.type !== undefined) repoUpdate.type = updates.type;
    if (updates.config !== undefined) repoUpdate.config = updates.config;
    if (updates.enabled !== undefined) repoUpdate.enabled = updates.enabled;
    if (updates.severityFilter !== undefined) repoUpdate.severity_filter = updates.severityFilter;

    if (Object.keys(repoUpdate).length > 0) {
      this.channelRepo?.update(channelId, repoUpdate).catch((err: any) =>
        logger.warn('[AlertNotificationService] Failed to update channel in repository:', err)
      );
    }

    return updated;
  }

  /**
   * Remove a channel
   */
  removeChannel(channelId: string): boolean {
    const result = this.channels.delete(channelId);

    if (result) {
      this.channelRepo?.delete(channelId).catch((err: any) =>
        logger.warn('[AlertNotificationService] Failed to delete channel from repository:', err)
      );
    }

    return result;
  }

  /**
   * Get a channel by ID
   */
  getChannel(channelId: string): AlertChannel | undefined {
    return this.channels.get(channelId);
  }

  /**
   * Get all channels
   */
  getAllChannels(): AlertChannel[] {
    return Array.from(this.channels.values());
  }

  /**
   * Enable or disable a channel
   */
  toggleChannel(channelId: string, enabled: boolean): boolean {
    const channel = this.channels.get(channelId);
    if (!channel) return false;
    channel.enabled = enabled;

    // Persist to repository if available (fire-and-forget)
    this.channelRepo?.toggleEnabled(channelId, enabled).catch((err: any) =>
      logger.warn('[AlertNotificationService] Failed to toggle channel in repository:', err)
    );

    return true;
  }

  // ==================== Escalation Policy Management ====================

  /**
   * Add an escalation policy
   */
  addEscalationPolicy(policy: EscalationPolicy): void {
    this.escalationPolicies.set(policy.id, policy);

    // Persist to repository if available (fire-and-forget)
    this.escalationPolicyRepo?.create({
      id: policy.id,
      tenant_id: '00000000-0000-0000-0000-000000000000',
      name: policy.name,
      steps: policy.steps,
      repeat_count: policy.repeatCount,
      enabled: policy.enabled,
      description: policy.description ?? null,
    } as any).catch((err: any) =>
      logger.warn('[AlertNotificationService] Failed to persist escalation policy:', err)
    );
  }

  /**
   * Get an escalation policy
   */
  getEscalationPolicy(policyId: string): EscalationPolicy | undefined {
    return this.escalationPolicies.get(policyId);
  }

  /**
   * Get all escalation policies
   */
  getAllEscalationPolicies(): EscalationPolicy[] {
    return Array.from(this.escalationPolicies.values());
  }

  /**
   * Remove an escalation policy
   */
  removeEscalationPolicy(policyId: string): boolean {
    // Cancel any active escalations for this policy
    for (const [alertId] of this.escalationStates) {
      const mappedPolicyId = this.alertEscalationMap.get(alertId) || '';
      const policy = this.escalationPolicies.get(mappedPolicyId);
      if (policy && policy.id === policyId) {
        this.cancelEscalation(alertId);
      }
    }

    const result = this.escalationPolicies.delete(policyId);

    if (result) {
      this.escalationPolicyRepo?.delete(policyId).catch((err: any) =>
        logger.warn('[AlertNotificationService] Failed to delete escalation policy from repository:', err)
      );
    }

    return result;
  }

  // ==================== Notification Sending ====================

  /**
   * Send a notification for an alert
   */
  async sendNotification(
    alert: Alert,
    channelIds: string[]
  ): Promise<NotificationRecord[]> {
    const records: NotificationRecord[] = [];

    for (const channelId of channelIds) {
      const channel = this.channels.get(channelId);
      if (!channel) continue;
      if (!channel.enabled) continue;

      // Check severity filter
      if (channel.severityFilter && !channel.severityFilter.includes(alert.severity)) {
        continue;
      }

      try {
        const record = await this.deliverToChannel(alert, channel);
        records.push(record);
      } catch (error) {
        const record: NotificationRecord = {
          id: uuidv4(),
          alertId: alert.id,
          channelId,
          channelType: channel.type,
          status: 'failed',
          sentAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        };
        records.push(record);
      }
    }

    this.notifications.push(...records);

    // Persist notification records to repository (fire-and-forget)
    for (const record of records) {
      this.notificationHistoryRepo?.create(this.notificationRecordToEntity(record) as any).catch((err: any) =>
        logger.warn('[AlertNotificationService] Failed to persist notification record:', err)
      );
    }

    return records;
  }

  /**
   * Deliver alert to a specific channel
   */
  private async deliverToChannel(
    alert: Alert,
    channel: AlertChannel
  ): Promise<NotificationRecord> {
    const record: NotificationRecord = {
      id: uuidv4(),
      alertId: alert.id,
      channelId: channel.id,
      channelType: channel.type,
      status: 'pending',
      sentAt: new Date(),
    };

    switch (channel.type) {
      case 'email':
        await this.sendEmail(alert, channel.config as EmailChannelConfig, record);
        break;
      case 'webhook':
        await this.sendWebhook(alert, channel.config as WebhookChannelConfig, record);
        break;
      case 'slack':
        await this.sendSlack(alert, channel.config as SlackChannelConfig, record);
        break;
    }

    return record;
  }

  /**
   * Send email notification
   */
  private async sendEmail(
    alert: Alert,
    config: EmailChannelConfig,
    record: NotificationRecord
  ): Promise<void> {
    // Simulate email sending (in production, integrate with SMTP/email service)
    const subject = `${config.subjectPrefix || '[Orion Alert]'} [${alert.severity.toUpperCase()}] ${alert.ruleName || alert.metric}`;
    const body = this.formatAlertText(alert);

    // In production: await emailService.send({ to: config.recipients, subject, body });
    logger.info(`[Email] To: ${config.recipients.join(', ')} | Subject: ${subject}`);

    record.status = 'sent';
    record.responsePayload = JSON.stringify({ recipients: config.recipients, subject });
  }

  /**
   * Send webhook notification
   */
  private async sendWebhook(
    alert: Alert,
    config: WebhookChannelConfig,
    record: NotificationRecord
  ): Promise<void> {
    // Simulate webhook call (in production, make actual HTTP request)
    const payload = {
      alert: {
        id: alert.id,
        ruleId: alert.ruleId,
        ruleName: alert.ruleName,
        metric: alert.metric,
        value: alert.value,
        threshold: alert.threshold,
        severity: alert.severity,
        status: alert.status,
        triggeredAt: alert.triggeredAt,
        message: alert.message,
      },
      timestamp: new Date().toISOString(),
    };

    // In production:
    // const response = await fetch(config.url, {
    //   method: config.method || 'POST',
    //   headers: { 'Content-Type': 'application/json', ...config.headers },
    //   body: JSON.stringify(payload),
    //   signal: AbortSignal.timeout(config.timeoutMs || 10000),
    // });
    // if (!response.ok) throw new OrionError(`Webhook returned ${response.status}`, 'OPERATION_FAILED');

    logger.info(`[Webhook] POST ${config.url} | Payload: ${JSON.stringify(payload).substring(0, 200)}...`);

    record.status = 'sent';
    record.responsePayload = JSON.stringify({ status: 'delivered' });
  }

  /**
   * Send Slack notification
   */
  private async sendSlack(
    alert: Alert,
    config: SlackChannelConfig,
    record: NotificationRecord
  ): Promise<void> {
    // Simulate Slack notification
    const severityEmoji: Record<AlertSeverity, string> = {
      critical: ':red_circle:',
      warning: ':large_yellow_circle:',
      info: ':large_blue_circle:',
    };

    const message = {
      channel: config.channel || '#alerts',
      username: config.username || 'Orion Monitor',
      icon_emoji: config.iconEmoji || severityEmoji[alert.severity],
      text: this.formatSlackMessage(alert),
    };

    // In production: await fetch(config.webhookUrl, { method: 'POST', body: JSON.stringify(message) });
    logger.info(`[Slack] Channel: ${message.channel} | Text: ${message.text.substring(0, 200)}...`);

    record.status = 'sent';
    record.responsePayload = JSON.stringify(message);
  }

  // ==================== Escalation ====================

  /**
   * Start escalation for an alert
   */
  startEscalation(alertId: string, policyId: string): void {
    const policy = this.escalationPolicies.get(policyId);
    if (!policy || !policy.enabled) return;
    if (policy.steps.length === 0) return;

    // Cancel any existing escalation
    this.cancelEscalation(alertId);

    const state: EscalationState = {
      alertId,
      currentStep: 0,
      startedAt: new Date(),
      repeatCount: 0,
    };

    this.escalationStates.set(alertId, state);
    this.alertEscalationMap.set(alertId, policyId);

    // Execute first step immediately
    this.executeEscalationStep(alertId, policy, state);
  }

  /**
   * Execute an escalation step
   */
  private executeEscalationStep(
    alertId: string,
    policy: EscalationPolicy,
    state: EscalationState
  ): void {
    const step = policy.steps[state.currentStep];
    if (!step) {
      // All steps completed, check if we should repeat
      if (state.repeatCount < policy.repeatCount) {
        state.repeatCount++;
        state.currentStep = 0;
        this.executeEscalationStep(alertId, policy, state);
      } else {
        // Escalation complete
        this.cancelEscalation(alertId);
      }
      return;
    }

    // Send notification to step recipients
    (async () => {
      const record: NotificationRecord = {
        id: uuidv4(),
        alertId,
        channelId: step.channelIds[0] || 'default',
        channelType: 'email',
        status: 'escalated',
        sentAt: new Date(),
        escalationStep: state.currentStep,
      };

      // Log escalation
      logger.info(
        `[Escalation] Alert ${alertId} -> Step ${state.currentStep} | Recipients: ${step.recipients.join(', ')}`
      );

      record.responsePayload = JSON.stringify({
        step: state.currentStep,
        recipients: step.recipients,
        channels: step.channelIds,
      });

      this.notifications.push(record);

      // Persist escalation notification to repository (fire-and-forget)
      this.notificationHistoryRepo?.create(this.notificationRecordToEntity(record) as any).catch((err: any) =>
        logger.warn('[AlertNotificationService] Failed to persist escalation notification:', err)
      );
    })().catch((err) => logger.error({ traceId: getCurrentTraceId(), err }, 'Notification step failed'));

    // Schedule next step
    if (state.currentStep < policy.steps.length - 1) {
      const nextStep = policy.steps[state.currentStep + 1];
      state.nextStepTimer = setTimeout(() => {
        state.currentStep++;
        this.executeEscalationStep(alertId, policy, state);
      }, nextStep.waitMs);
    } else if (state.repeatCount < policy.repeatCount) {
      // Schedule repeat
      const firstStep = policy.steps[0];
      state.nextStepTimer = setTimeout(() => {
        state.repeatCount++;
        state.currentStep = 0;
        this.executeEscalationStep(alertId, policy, state);
      }, firstStep.waitMs);
    }
  }

  /**
   * Cancel escalation for an alert
   */
  cancelEscalation(alertId: string): void {
    const state = this.escalationStates.get(alertId);
    if (state && state.nextStepTimer) {
      clearTimeout(state.nextStepTimer);
    }
    this.escalationStates.delete(alertId);
    this.alertEscalationMap.delete(alertId);
  }

  /**
   * Get escalation state for an alert
   */
  getEscalationState(alertId: string): EscalationState | undefined {
    return this.escalationStates.get(alertId);
  }

  // ==================== Alert Acknowledgment ====================

  /**
   * Acknowledge an alert and cancel its escalation
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): void {
    // Cancel escalation
    this.cancelEscalation(alertId);

    logger.info(`[Alert] Alert ${alertId} acknowledged by ${acknowledgedBy}`);
  }

  // ==================== Notification History ====================

  /**
   * Get notification history with optional filters
   */
  getNotificationHistory(filter?: {
    alertId?: string;
    channelId?: string;
    status?: NotificationStatus;
    limit?: number;
  }): NotificationRecord[] {
    let result = [...this.notifications];

    if (filter?.alertId) {
      result = result.filter(n => n.alertId === filter.alertId);
    }
    if (filter?.channelId) {
      result = result.filter(n => n.channelId === filter.channelId);
    }
    if (filter?.status) {
      result = result.filter(n => n.status === filter.status);
    }

    // Sort by sentAt descending
    result.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());

    if (filter?.limit) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  /**
   * Get notifications for a specific alert
   */
  getAlertNotifications(alertId: string): NotificationRecord[] {
    return this.getNotificationHistory({ alertId });
  }

  // ==================== Utility ====================

  /**
   * Format alert as text
   */
  private formatAlertText(alert: Alert): string {
    const lines = [
      `Alert: ${alert.ruleName || alert.metric}`,
      `Severity: ${alert.severity.toUpperCase()}`,
      `Metric: ${alert.metric}`,
      `Value: ${alert.value}`,
      `Threshold: ${alert.threshold}`,
      `Status: ${alert.status}`,
      `Triggered At: ${alert.triggeredAt.toISOString()}`,
    ];

    if (alert.message) {
      lines.push(`Message: ${alert.message}`);
    }

    return lines.join('\n');
  }

  /**
   * Format alert as Slack message
   */
  private formatSlackMessage(alert: Alert): string {
    const severityEmoji: Record<AlertSeverity, string> = {
      critical: ':red_circle:',
      warning: ':large_yellow_circle:',
      info: ':large_blue_circle:',
    };

    const emoji = severityEmoji[alert.severity] || ':white_circle:';

    let text = `${emoji} *${alert.severity.toUpperCase()}: ${alert.ruleName || alert.metric}*\n`;
    text += `Metric: \`${alert.metric}\` = ${alert.value}\n`;
    text += `Threshold: ${alert.threshold}\n`;
    text += `Status: ${alert.status}\n`;
    text += `Time: ${alert.triggeredAt.toISOString()}`;

    if (alert.message) {
      text += `\n${alert.message}`;
    }

    return text;
  }

  /**
   * Clear all notification history
   */
  clearNotificationHistory(): void {
    this.notifications = [];
  }

  /**
   * Clear all channels and policies
   */
  clearAll(): void {
    // Cancel all escalations
    for (const alertId of this.escalationStates.keys()) {
      this.cancelEscalation(alertId);
    }

    this.channels.clear();
    this.escalationPolicies.clear();
    this.notifications = [];
    this.escalationStates.clear();
    this.alertEscalationMap.clear();
  }

  // ==================== Private Helpers ====================

  /**
   * Convert a NotificationRecord to a repository entity object
   */
  private notificationRecordToEntity(record: NotificationRecord): Record<string, any> {
    return {
      id: record.id,
      tenant_id: '00000000-0000-0000-0000-000000000000',
      alert_id: record.alertId,
      channel_id: record.channelId,
      channel_type: record.channelType,
      status: record.status,
      sent_at: record.sentAt,
      error_message: record.errorMessage ?? null,
      response_payload: record.responsePayload ?? null,
      escalation_step: record.escalationStep ?? null,
    };
  }
}
