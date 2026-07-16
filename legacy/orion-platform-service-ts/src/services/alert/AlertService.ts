/**
 * AlertService - Auto-trigger notifications when alerts fire
 *
 * Integrates NotificationService (in-app) and AlertNotificationService
 * (multi-channel: email, webhook, Slack) with severity-based filtering.
 *
 * Wired via AlertRuleEngine.onAlert callback in MonitoringService.
 */

import { createLogger } from '../../utils/logger';
import { Alert } from '../monitoring/types';
import { NotificationService } from '../notification/NotificationService';
import { AlertNotificationService } from '../monitoring/AlertNotificationService';
import { getCurrentTenantId } from '../../db/tenant-context-storage';

const logger = createLogger('LAlert-LService');

/**
 * Resolve user IDs for a tenant (for in-app notification broadcast).
 * Default: returns empty array (no in-app broadcast).
 */
export type TenantUserResolver = (tenantId: string) => Promise<string[]> | string[];

export class AlertService {
  private notificationService: NotificationService | null;
  private alertNotificationService: AlertNotificationService | null;
  private getUserIdsForTenant: TenantUserResolver | null;

  constructor(
    notificationService: NotificationService | null,
    alertNotificationService: AlertNotificationService | null,
    getUserIdsForTenant?: TenantUserResolver
  ) {
    this.notificationService = notificationService;
    this.alertNotificationService = alertNotificationService;
    this.getUserIdsForTenant = getUserIdsForTenant || null;
  }

  /**
   * Handle a newly triggered alert - auto-send notifications.
   * Called by AlertRuleEngine.onAlert callback.
   */
  async onAlert(alert: Alert): Promise<void> {
    logger.info(
      { alertId: alert.id, severity: alert.severity, metric: alert.metric },
      '[AlertService] Alert triggered, sending notifications'
    );

    // Send in-app notifications (best-effort, non-blocking)
    this.sendInAppNotification(alert).catch((err) => {
      logger.warn({ err, alertId: alert.id }, '[AlertService] In-app notification failed');
    });

    // Send multi-channel notifications (email, webhook, Slack) with severity filter
    await this.sendMultiChannelNotifications(alert);
  }

  // ==================== In-App Notifications ====================

  /**
   * Send in-app notification via NotificationService.
   * Broadcasts to all tenant users if resolver is configured.
   */
  private async sendInAppNotification(alert: Alert): Promise<void> {
    if (!this.notificationService || !this.getUserIdsForTenant) return;

    const tenantId = alert.tenantId || getCurrentTenantId();
    if (!tenantId) {
      logger.warn('[AlertService] No tenant ID for in-app notification');
      return;
    }

    try {
      const userIds = await this.getUserIdsForTenant(tenantId);
      if (!userIds || userIds.length === 0) return;

      const severity = alert.severity.toUpperCase();
      const title = `[${severity}] ${alert.ruleName || alert.metric}`;
      const message =
        alert.message || `Metric "${alert.metric}" value=${alert.value} threshold=${alert.threshold}`;

      await this.notificationService.broadcast(
        tenantId,
        userIds,
        'alert',
        title,
        message
      );

      logger.info(
        { alertId: alert.id, userIds, tenantId },
        '[AlertService] In-app notification sent'
      );
    } catch (error) {
      logger.error(
        { err: error instanceof Error ? error.message : error, alertId: alert.id },
        '[AlertService] Failed to send in-app notification'
      );
    }
  }

  // ==================== Multi-Channel Notifications ====================

  /**
   * Send multi-channel notifications via AlertNotificationService.
   * Channels are filtered by severity configuration.
   */
  private async sendMultiChannelNotifications(alert: Alert): Promise<void> {
    if (!this.alertNotificationService) return;

    try {
      const channels = this.alertNotificationService.getAllChannels();
      const enabledChannelIds = channels
        .filter((ch) => ch.enabled && this.matchesSeverity(ch.severityFilter, alert.severity))
        .map((ch) => ch.id);

      if (enabledChannelIds.length === 0) {
        logger.debug(
          { alertId: alert.id, severity: alert.severity },
          '[AlertService] No enabled channels match severity'
        );
        return;
      }

      const records = await this.alertNotificationService.sendNotification(
        alert,
        enabledChannelIds
      );

      logger.info(
        {
          alertId: alert.id,
          channels: enabledChannelIds.length,
          sent: records.filter((r) => r.status === 'sent').length,
          failed: records.filter((r) => r.status === 'failed').length,
        },
        '[AlertService] Multi-channel notification dispatch complete'
      );
    } catch (error) {
      logger.error(
        { err: error instanceof Error ? error.message : error, alertId: alert.id },
        '[AlertService] Multi-channel notification dispatch failed'
      );
    }
  }

  // ==================== Utilities ====================

  /**
   * Check if an alert severity matches a channel's severity filter.
   * If the channel has no filter, all severities match.
   */
  private matchesSeverity(
    severityFilter: string[] | undefined,
    alertSeverity: string
  ): boolean {
    if (!severityFilter || severityFilter.length === 0) return true;
    return severityFilter.includes(alertSeverity);
  }
}
