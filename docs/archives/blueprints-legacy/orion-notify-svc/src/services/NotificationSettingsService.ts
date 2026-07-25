import { NotificationSettingsRepository } from './NotificationSettingsRepository';
import type { NotificationSettings, CreateNotificationSettingsInput } from '../types/notification';

export class NotificationSettingsServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'NotificationSettingsServiceError';
  }
}

export class NotificationSettingsService {
  private repository: NotificationSettingsRepository;

  constructor(repository: NotificationSettingsRepository) {
    this.repository = repository;
  }

  async getSettings(userId: string, tenantId: string): Promise<NotificationSettings> {
    const settings = await this.repository.findByUser(userId, tenantId);
    if (!settings) {
      return this.repository.upsert({ user_id: userId, tenant_id: tenantId });
    }
    return settings;
  }

  async updateSettings(
    userId: string,
    tenantId: string,
    updates: Partial<CreateNotificationSettingsInput>
  ): Promise<NotificationSettings> {
    const existing = await this.repository.findByUser(userId, tenantId);
    if (!existing) {
      return this.repository.upsert({ user_id: userId, tenant_id: tenantId, ...updates });
    }
    return this.repository.upsert({ user_id: userId, tenant_id: tenantId, ...updates });
  }
}
