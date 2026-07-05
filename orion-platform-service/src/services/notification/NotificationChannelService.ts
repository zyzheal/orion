/**
 * NotificationChannelService - Actual delivery of notifications via channels
 *
 * Supports:
 *   - email   : SMTP config (logged, real SMTP future work)
 *   - webhook : HTTP POST to configured URL
 *   - in-app  : simulated (logged)
 *   - slack   : simulated (logged)
 *   - dingtalk: simulated (logged)
 *   - wechat  : simulated (logged)
 */

import { Notification, CreateNotificationInput } from './NotificationRepository';
import { createLogger } from '../../utils/logger';

const logger = createLogger('notification-channel');

/**
 * Channel-specific configuration
 */
export interface EmailChannelConfig {
  type: 'email';
  host: string;
  port: number;
  from: string;
  to?: string;
}

export interface WebhookChannelConfig {
  type: 'webhook';
  url: string;
  method?: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface InAppChannelConfig {
  type: 'in-app';
}

export interface SlackChannelConfig {
  type: 'slack';
  webhookUrl?: string;
}

export interface DingtalkChannelConfig {
  type: 'dingtalk';
  webhookUrl?: string;
}

export interface WechatChannelConfig {
  type: 'wechat';
  webhookUrl?: string;
}

export type ChannelConfig =
  | EmailChannelConfig
  | WebhookChannelConfig
  | InAppChannelConfig
  | SlackChannelConfig
  | DingtalkChannelConfig
  | WechatChannelConfig;

export interface ChannelSendResult {
  success: boolean;
  channel: string;
  messageId?: string;
  error?: string;
}

export class NotificationChannelService {
  private notificationRepository: {
    create(input: CreateNotificationInput): Promise<Notification>;
    markAsSent(id: string): Promise<Notification | null>;
  };

  constructor(
    notificationRepository: {
      create(input: CreateNotificationInput): Promise<Notification>;
      markAsSent(id: string): Promise<Notification | null>;
    }
  ) {
    this.notificationRepository = notificationRepository;
  }

  /**
   * send - Deliver a single notification via the specified channel
   */
  async send(notification: Notification, channel: ChannelConfig): Promise<ChannelSendResult> {
    logger.info(
      { notificationId: notification.id, channel: channel.type, tenantId: notification.tenant_id },
      '[NotificationChannelService] Sending notification'
    );

    try {
      switch (channel.type) {
        case 'email':
          return this.sendEmail(notification, channel);
        case 'webhook':
          return this.sendWebhook(notification, channel);
        case 'in-app':
          return this.sendInApp(notification, channel);
        case 'slack':
          return this.sendSlack(notification, channel);
        case 'dingtalk':
          return this.sendDingtalk(notification, channel);
        case 'wechat':
          return this.sendWechat(notification, channel);
        default:
          return {
            success: false,
            channel: (channel as ChannelConfig).type,
            error: `Unsupported channel type: ${(channel as ChannelConfig).type}`,
          };
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(
        { notificationId: notification.id, channel: channel.type, error: errorMessage },
        '[NotificationChannelService] Failed to send notification'
      );
      return {
        success: false,
        channel: channel.type,
        error: errorMessage,
      };
    }
  }

  /**
   * sendBatch - Deliver multiple notifications via the same channel
   */
  async sendBatch(notifications: Notification[], channel: ChannelConfig): Promise<ChannelSendResult[]> {
    logger.info(
      { count: notifications.length, channel: channel.type },
      '[NotificationChannelService] Sending batch notifications'
    );

    const results: ChannelSendResult[] = [];
    for (const notification of notifications) {
      const result = await this.send(notification, channel);
      results.push(result);
    }
    return results;
  }

  /**
   * sendByChannel - Filter notifications by channel type and send
   *
   * @param tenantId   - Tenant ID for logging context
   * @param channel    - Channel type string (e.g. 'email', 'webhook')
   * @param notifications - Notifications to send (caller provides pre-filtered list)
   */
  async sendByChannel(
    tenantId: string,
    channel: string,
    notifications: Notification[]
  ): Promise<ChannelSendResult[]> {
    logger.info(
      { tenantId, channel, count: notifications.length },
      '[NotificationChannelService] Sending notifications by channel'
    );

    const config = this.resolveChannelConfig(channel);
    if (!config) {
      return notifications.map((n) => ({
        success: false,
        channel,
        error: `Unknown channel: ${channel}`,
      }));
    }

    return this.sendBatch(notifications, config);
  }

  // ==================== Channel Implementations ====================

  private sendEmail(notification: Notification, config: EmailChannelConfig): ChannelSendResult {
    const messageId = `email-${notification.id}-${Date.now()}`;
    const payload = {
      from: config.from,
      to: config.to || notification.user_id,
      subject: `[Orion] ${notification.title}`,
      body: notification.message,
      tenantId: notification.tenant_id,
      userId: notification.user_id,
      type: notification.type,
    };

    logger.info(
      { messageId, to: payload.to, subject: payload.subject, host: config.host, port: config.port },
      '[NotificationChannelService] Email queued (SMTP integration pending)'
    );

    // TODO: Integrate with actual SMTP (nodemailer / postal)
    // For now, log and return success
    return {
      success: true,
      channel: 'email',
      messageId,
    };
  }

  private async sendWebhook(notification: Notification, config: WebhookChannelConfig): Promise<ChannelSendResult> {
    const messageId = `webhook-${notification.id}-${Date.now()}`;
    const method = config.method || 'POST';
    const timeout = config.timeoutMs || 5000;
    const payload = {
      notificationId: notification.id,
      tenantId: notification.tenant_id,
      userId: notification.user_id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      channel: notification.channel,
      status: notification.status,
      sentAt: notification.sent_at,
      createdAt: notification.created_at,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(config.url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(config.headers || {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text().catch(() => 'unknown');
        logger.warn(
          { messageId, status: response.status, response: text.slice(0, 200) },
          '[NotificationChannelService] Webhook returned non-OK status'
        );
        return {
          success: false,
          channel: 'webhook',
          messageId,
          error: `Webhook returned ${response.status}: ${text.slice(0, 200)}`,
        };
      }

      logger.info(
        { messageId, url: config.url, status: response.status },
        '[NotificationChannelService] Webhook delivered'
      );

      return {
        success: true,
        channel: 'webhook',
        messageId,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error({ messageId, url: config.url, error: errorMessage }, '[NotificationChannelService] Webhook failed');
      return {
        success: false,
        channel: 'webhook',
        messageId,
        error: errorMessage,
      };
    }
  }

  private sendInApp(notification: Notification, _config: InAppChannelConfig): ChannelSendResult {
    logger.info(
      { notificationId: notification.id, userId: notification.user_id },
      '[NotificationChannelService] In-app notification (simulated)'
    );
    return {
      success: true,
      channel: 'in-app',
      messageId: `in-app-${notification.id}-${Date.now()}`,
    };
  }

  private sendSlack(notification: Notification, _config: SlackChannelConfig): ChannelSendResult {
    logger.info(
      { notificationId: notification.id, title: notification.title },
      '[NotificationChannelService] Slack notification (simulated)'
    );
    return {
      success: true,
      channel: 'slack',
      messageId: `slack-${notification.id}-${Date.now()}`,
    };
  }

  private sendDingtalk(notification: Notification, _config: DingtalkChannelConfig): ChannelSendResult {
    logger.info(
      { notificationId: notification.id, title: notification.title },
      '[NotificationChannelService] Dingtalk notification (simulated)'
    );
    return {
      success: true,
      channel: 'dingtalk',
      messageId: `dingtalk-${notification.id}-${Date.now()}`,
    };
  }

  private sendWechat(notification: Notification, _config: WechatChannelConfig): ChannelSendResult {
    logger.info(
      { notificationId: notification.id, title: notification.title },
      '[NotificationChannelService] WeChat notification (simulated)'
    );
    return {
      success: true,
      channel: 'wechat',
      messageId: `wechat-${notification.id}-${Date.now()}`,
    };
  }

  // ==================== Helpers ====================

  private resolveChannelConfig(channel: string): ChannelConfig | null {
    switch (channel) {
      case 'email':
        return { type: 'email', host: 'localhost', port: 25, from: 'noreply@orion.local' };
      case 'webhook':
        return { type: 'webhook', url: 'http://localhost:3000/webhook', method: 'POST' };
      case 'in-app':
        return { type: 'in-app' };
      case 'slack':
        return { type: 'slack' };
      case 'dingtalk':
        return { type: 'dingtalk' };
      case 'wechat':
        return { type: 'wechat' };
      default:
        return null;
    }
  }
}
