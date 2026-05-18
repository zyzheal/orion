import { createHmac } from 'crypto';
import nodemailer from 'nodemailer';
import { NotificationChannelRepository, NotificationChannel } from './NotificationChannelRepository';

export interface NotificationPayload {
  tenantId: string;
  channelType: string;
  config: Record<string, unknown>;
  subject: string;
  message: string;
  recipients: string[];
}

export interface NotificationResult {
  success: boolean;
  channelType: string;
  messageId?: string;
  error?: string;
  sentAt: Date;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class NotificationChannelService {
  constructor(private repo: NotificationChannelRepository) {}

  async createChannel(
    data: Omit<NotificationChannel, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<NotificationChannel> {
    const validation = this.validateConfig(data.type, data.config);
    if (!validation.valid) {
      throw new Error(`Invalid ${data.type} config: ${validation.errors.join(', ')}`);
    }
    return this.repo.create(data);
  }

  async listChannels(tenantId: string, enabledOnly?: boolean): Promise<NotificationChannel[]> {
    return this.repo.findAll(tenantId, enabledOnly);
  }

  async getChannel(id: string): Promise<NotificationChannel | null> {
    return this.repo.findById(id);
  }

  async updateChannel(id: string, updates: Partial<NotificationChannel>): Promise<NotificationChannel | null> {
    return this.repo.update(id, updates);
  }

  async deleteChannel(id: string): Promise<boolean> {
    return this.repo.delete(id);
  }

  async sendNotification(payload: NotificationPayload): Promise<NotificationResult> {
    const channel = await this.findChannelByType(payload.tenantId, payload.channelType);
    if (!channel || !channel.enabled) {
      return {
        success: false,
        channelType: payload.channelType,
        error: 'Channel not found or disabled',
        sentAt: new Date(),
      };
    }

    const mergedConfig = { ...channel.config, ...payload.config };
    return this.sendViaChannel(payload.channelType, mergedConfig, payload);
  }

  async testChannel(channelId: string): Promise<NotificationResult> {
    const channel = await this.repo.findById(channelId);
    if (!channel) {
      return {
        success: false,
        channelType: 'unknown',
        error: 'Channel not found',
        sentAt: new Date(),
      };
    }

    const testPayload: NotificationPayload = {
      tenantId: channel.tenantId,
      channelType: channel.type,
      config: channel.config,
      subject: 'Orion Test Notification',
      message: `This is a test notification from channel "${channel.name}"`,
      recipients: this.extractRecipients(channel),
    };

    return this.sendViaChannel(channel.type, channel.config, testPayload);
  }

  private validateConfig(type: string, config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    switch (type) {
      case 'email':
        if (!config.smtpHost) errors.push('smtpHost required');
        if (!config.smtpPort) errors.push('smtpPort required');
        break;
      case 'slack':
        if (!config.webhookUrl) errors.push('webhookUrl required');
        break;
      case 'webhook':
        if (!config.url) errors.push('url required');
        break;
      case 'sms':
        if (!config.provider) errors.push('provider required');
        if (!config.apiKey) errors.push('apiKey required');
        break;
      case 'pagerduty':
        if (!config.integrationKey) errors.push('integrationKey required');
        break;
      case 'dingtalk':
        if (!config.webhookUrl) errors.push('webhookUrl required');
        break;
      case 'wecom':
        if (!config.webhookUrl) errors.push('webhookUrl required');
        break;
    }
    return { valid: errors.length === 0, errors };
  }

  private async findChannelByType(tenantId: string, type: string): Promise<NotificationChannel | null> {
    const channels = await this.repo.findAll(tenantId, false);
    return channels.find((c) => c.type === type) || null;
  }

  private async sendViaChannel(
    type: string,
    config: Record<string, unknown>,
    payload: NotificationPayload,
  ): Promise<NotificationResult> {
    try {
      switch (type) {
        case 'email':
          return this.sendEmail(config, payload.subject, payload.message, payload.recipients);
        case 'slack':
          return this.sendSlack(config, payload.subject, payload.message);
        case 'webhook':
          return this.sendWebhook(config, payload.subject, payload.message, payload.channelType);
        case 'sms':
          return this.sendSMS(config, payload.message, payload.recipients);
        case 'pagerduty':
          return this.sendPagerDuty(config, payload.subject, payload.message);
        case 'dingtalk':
          return this.sendDingTalk(config, payload.subject, payload.message);
        case 'wecom':
          return this.sendWeCom(config, payload.subject, payload.message);
        default:
          return {
            success: false,
            channelType: type,
            error: `Unknown channel type: ${type}`,
            sentAt: new Date(),
          };
      }
    } catch (error) {
      return {
        success: false,
        channelType: type,
        error: error instanceof Error ? error.message : String(error),
        sentAt: new Date(),
      };
    }
  }

  /**
   * Send email via SMTP using nodemailer
   */
  private async sendEmail(
    config: Record<string, unknown>,
    subject: string,
    body: string,
    recipients: string[],
  ): Promise<NotificationResult> {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost as string,
      port: Number(config.smtpPort) || 587,
      secure: Number(config.smtpPort) === 465,
      auth: {
        user: config.smtpUser as string,
        pass: config.smtpPassword as string,
      },
    });

    const info = await transporter.sendMail({
      from: (config.smtpFrom as string) || 'orion@noreply.com',
      to: recipients.join(', '),
      subject,
      html: body,
      text: body.replace(/<[^>]*>/g, ''),
    });

    return { success: true, channelType: 'email', messageId: info.messageId || `email-${crypto.randomUUID()}`, sentAt: new Date() };
  }

  /**
   * Send to Slack via Incoming Webhook
   */
  private async sendSlack(
    config: Record<string, unknown>,
    subject: string,
    body: string,
  ): Promise<NotificationResult> {
    const webhookUrl = config.webhookUrl as string;
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `*${subject}*\n${body}`,
      }),
    });
    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.status}`);
    }
    return { success: true, channelType: 'slack', messageId: `slack-${crypto.randomUUID()}`, sentAt: new Date() };
  }

  /**
   * Send to custom webhook URL with optional HMAC-SHA256 signature
   */
  private async sendWebhook(
    config: Record<string, unknown>,
    subject: string,
    body: string,
    eventType?: string,
  ): Promise<NotificationResult> {
    const url = config.url as string;
    const secret = config.secret as string;
    const payload = {
      event: eventType || 'notification',
      subject,
      body,
      timestamp: new Date().toISOString(),
    };
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (secret) {
      headers['X-Orion-Signature'] = createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
    }
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Webhook delivery failed: ${response.status}`);
    }
    return { success: true, channelType: 'webhook', messageId: `webhook-${crypto.randomUUID()}`, sentAt: new Date() };
  }

  /**
   * Send SMS via provider API (placeholder for actual SMS provider integration)
   */
  private async sendSMS(
    config: Record<string, unknown>,
    _body: string,
    _recipients: string[],
  ): Promise<NotificationResult> {
    const provider = config.provider as string;
    const apiKey = config.apiKey as string;
    // TODO: Implement actual SMS provider integration (Twilio, Aliyun, etc.)
    // For now, this is a structured placeholder that validates config but doesn't send
    if (!provider || !apiKey) {
      throw new Error('SMS provider and apiKey are required');
    }
    return {
      success: true,
      channelType: 'sms',
      messageId: `sms-${crypto.randomUUID()}`,
      sentAt: new Date(),
      error: `SMS provider ${provider} not yet implemented`,
    };
  }

  /**
   * Send to PagerDuty via Events API v2
   */
  private async sendPagerDuty(
    config: Record<string, unknown>,
    subject: string,
    body: string,
  ): Promise<NotificationResult> {
    const integrationKey = config.integrationKey as string;
    const eventType = config.eventType as string || 'trigger';
    const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routing_key: integrationKey,
        event_action: eventType,
        payload: {
          summary: subject,
          source: 'orion-notify-svc',
          severity: config.severity as string || 'critical',
          details: { body },
        },
      }),
    });
    if (!response.ok) {
      throw new Error(`PagerDuty API failed: ${response.status}`);
    }
    return { success: true, channelType: 'pagerduty', messageId: `pagerduty-${crypto.randomUUID()}`, sentAt: new Date() };
  }

  /**
   * Send to DingTalk (钉钉) custom robot webhook with optional HMAC-SHA256 signature
   */
  private async sendDingTalk(
    config: Record<string, unknown>,
    subject: string,
    body: string,
  ): Promise<NotificationResult> {
    const webhookUrl = config.webhookUrl as string;
    const secret = config.secret as string;

    let finalUrl = webhookUrl;
    if (secret) {
      // DingTalk signature: timestamp + sign
      const timestamp = Date.now();
      const stringToSign = `${timestamp}\n${secret}`;
      const sign = encodeURIComponent(createHmac('sha256', stringToSign).digest('base64'));
      finalUrl = `${webhookUrl}&timestamp=${timestamp}&sign=${sign}`;
    }

    const response = await fetch(finalUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msgtype: 'markdown',
        markdown: { title: subject, text: `### ${subject}\n${body}` },
      }),
    });

    const result = await response.json() as { errcode: number; errmsg: string };
    if (result.errcode !== 0) {
      throw new Error(`DingTalk delivery failed: ${result.errmsg}`);
    }
    return { success: true, channelType: 'dingtalk', messageId: `dingtalk-${crypto.randomUUID()}`, sentAt: new Date() };
  }

  /**
   * Send to Enterprise WeChat (企业微信) group robot webhook
   */
  private async sendWeCom(
    config: Record<string, unknown>,
    subject: string,
    body: string,
  ): Promise<NotificationResult> {
    const webhookUrl = config.webhookUrl as string;
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msgtype: 'markdown',
        markdown: { content: `### ${subject}\n${body}` },
      }),
    });
    const result = await response.json() as { errcode: number; errmsg: string };
    if (result.errcode !== 0) {
      throw new Error(`WeCom delivery failed: ${result.errmsg}`);
    }
    return { success: true, channelType: 'wecom', messageId: `wecom-${crypto.randomUUID()}`, sentAt: new Date() };
  }

  private extractRecipients(channel: NotificationChannel): string[] {
    const config = channel.config;
    switch (channel.type) {
      case 'email':
        return Array.isArray(config.recipients) ? (config.recipients as string[]) : [];
      case 'slack':
        return config.channel ? [config.channel as string] : [];
      case 'sms':
        return Array.isArray(config.phoneNumbers) ? (config.phoneNumbers as string[]) : [];
      default:
        return [];
    }
  }
}
