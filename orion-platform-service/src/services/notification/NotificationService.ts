/**
 * NotificationService - Business logic layer for Notification operations
 */

import { NotificationRepository, Notification, CreateNotificationInput } from './NotificationRepository';

export class NotificationServiceError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = 'NotificationServiceError'; }
}

export class NotificationService {
  private repository: NotificationRepository;
  constructor(repository: NotificationRepository) { this.repository = repository; }

  async send(input: CreateNotificationInput): Promise<Notification> {
    if (!input.tenant_id || !input.user_id) throw new NotificationServiceError('Tenant/User ID required', 'INVALID_INPUT');
    return this.repository.create(input);
  }

  async getNotifications(userId: string, limit?: number): Promise<Notification[]> {
    return this.repository.findAll({ userId, limit });
  }

  async markAsRead(id: string): Promise<Notification> {
    const notification = await this.repository.findById(id);
    if (!notification) throw new NotificationServiceError(`Notification not found: ${id}`, 'NOT_FOUND');
    const updated = await this.repository.markAsRead(id);
    return updated!;
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.repository.getUnreadCount(userId);
  }

  async broadcast(tenantId: string, userIds: string[], type: string, title: string, message: string): Promise<number> {
    let count = 0;
    for (const userId of userIds) {
      await this.repository.create({ tenant_id: tenantId, user_id: userId, type, title, message });
      count++;
    }
    return count;
  }
}