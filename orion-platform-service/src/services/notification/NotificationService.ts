/**
 * NotificationService - Business logic layer for Notification operations
 *
 * Creates in-app notifications and emits events for multi-channel delivery
 * via orion-notify-svc (email, Slack, 钉钉, 企业微信, etc.)
 */

import { NotificationRepository, Notification, CreateNotificationInput } from './NotificationRepository';

export class NotificationServiceError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = 'NotificationServiceError'; }
}

/**
 * EventBus-compatible publish interface (minimal — avoids circular dependency)
 * Matches EventBusService.publish() signature
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface NotificationEventPublisher {
  publish(type: string, data: unknown, options?: any): Promise<void | string>;
}

export class NotificationService {
  private repository: NotificationRepository;
  private eventPublisher: NotificationEventPublisher | null;

  constructor(repository: NotificationRepository, eventPublisher?: NotificationEventPublisher) {
    this.repository = repository;
    this.eventPublisher = eventPublisher || null;
  }

  async send(input: CreateNotificationInput): Promise<Notification> {
    if (!input.tenant_id || !input.user_id) throw new NotificationServiceError('Tenant/User ID required', 'INVALID_INPUT');
    const notification = await this.repository.create(input);

    // Emit event for multi-channel delivery by orion-notify-svc
    if (this.eventPublisher && input.channel && input.channel !== 'in-app') {
      this.eventPublisher.publish('notification.created', {
        notificationId: notification.id,
        tenantId: notification.tenant_id,
        userId: notification.user_id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        channel: notification.channel,
      }, { source: 'notification-service', tenantId: notification.tenant_id }).catch(err => {
        console.error('[NotificationService] Failed to emit notification event:', err);
      });
    }

    return notification;
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
      const notification = await this.repository.create({ tenant_id: tenantId, user_id: userId, type, title, message });
      count++;

      // Emit event for multi-channel delivery
      if (this.eventPublisher) {
        this.eventPublisher.publish('notification.broadcast', {
          notificationId: notification.id,
          tenantId,
          userId,
          type,
          title,
          message,
        }, { source: 'notification-service', tenantId }).catch(err => {
          console.error('[NotificationService] Failed to emit broadcast event:', err);
        });
      }
    }
    return count;
  }
}