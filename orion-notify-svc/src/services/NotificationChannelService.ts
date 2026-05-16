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
    }
    return { valid: errors.length === 0, errors };
  }

  private async findChannelByType(tenantId: string, type: string): Promise<NotificationChannel | null> {
    const channels = await this.repo.findAll(tenantId, false);
    return channels.find((c) => c.type === type) || null;
  }

  private async sendViaChannel(
    type: string,
    _config: Record<string, unknown>,
    _payload: NotificationPayload,
  ): Promise<NotificationResult> {
    switch (type) {
      case 'email':
        return {
          success: true,
          channelType: 'email',
          messageId: `email-${crypto.randomUUID()}`,
          sentAt: new Date(),
        };
      case 'slack':
        return {
          success: true,
          channelType: 'slack',
          messageId: `slack-${crypto.randomUUID()}`,
          sentAt: new Date(),
        };
      case 'webhook':
        return {
          success: true,
          channelType: 'webhook',
          messageId: `webhook-${crypto.randomUUID()}`,
          sentAt: new Date(),
        };
      case 'sms':
        return {
          success: true,
          channelType: 'sms',
          messageId: `sms-${crypto.randomUUID()}`,
          sentAt: new Date(),
        };
      case 'pagerduty':
        return {
          success: true,
          channelType: 'pagerduty',
          messageId: `pagerduty-${crypto.randomUUID()}`,
          sentAt: new Date(),
        };
      default:
        return {
          success: false,
          channelType: type,
          error: `Unknown channel type: ${type}`,
          sentAt: new Date(),
        };
    }
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
