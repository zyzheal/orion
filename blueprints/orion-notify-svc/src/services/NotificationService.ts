import { NotificationRepository } from './NotificationRepository';
import { NotificationChannelService } from './NotificationChannelService';
import type { CreateNotificationInput, Notification } from '../types/notification';
import type { NotificationPayload, NotificationResult } from './NotificationChannelService';

export class NotificationServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'NotificationServiceError';
  }
}

export class NotificationService {
  private repository: NotificationRepository;
  private channelService: NotificationChannelService;

  constructor(repository: NotificationRepository, channelService?: NotificationChannelService) {
    this.repository = repository;
    this.channelService = channelService || new NotificationChannelService({} as any);
  }

  async send(input: CreateNotificationInput): Promise<Notification> {
    if (!input.tenant_id || !input.user_id) {
      throw new NotificationServiceError('Tenant ID and user ID are required', 'INVALID_INPUT');
    }
    if (!input.type || !input.title || !input.message) {
      throw new NotificationServiceError('Type, title, and message are required', 'INVALID_INPUT');
    }

    // Step 1: Create the notification record in DB (status: 'pending')
    const notification = await this.repository.create(input);

    // Step 2: If a channel is specified, try to send via that channel
    if (input.channel && input.channel !== 'in-app') {
      try {
        const payload: NotificationPayload = {
          tenantId: input.tenant_id,
          channelType: input.channel,
          config: {},
          subject: input.title,
          message: input.message,
          recipients: [input.user_id], // Default recipient
        };

        const result: NotificationResult = await this.channelService.sendNotification(payload);

        // Step 3: Update status based on result
        if (result.success) {
          await this.repository.markAsSent(notification.id);
        } else {
          // Mark as failed — could add a markAsFailed method later
          // For now, leave as pending with error logged
          console.error(`Notification ${notification.id} failed to send via ${input.channel}: ${result.error}`);
        }
      } catch (error) {
        console.error(`Notification ${notification.id} delivery error: ${error}`);
      }
    }

    return notification;
  }

  async getNotifications(userId: string, limit?: number): Promise<Notification[]> {
    return this.repository.findAll({ userId, limit: limit ?? 50 });
  }

  async markAsRead(id: string): Promise<Notification> {
    const notification = await this.repository.findById(id);
    if (!notification) {
      throw new NotificationServiceError(`Notification not found: ${id}`, 'NOT_FOUND');
    }
    const updated = await this.repository.markAsRead(id);
    if (!updated) {
      throw new NotificationServiceError(`Failed to mark notification as read: ${id}`, 'UPDATE_FAILED');
    }
    return updated;
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.repository.getUnreadCount(userId);
  }

  async broadcast(tenantId: string, userIds: string[], type: string, title: string, message: string): Promise<number> {
    if (!tenantId || userIds.length === 0) {
      throw new NotificationServiceError('Tenant ID and at least one user ID are required', 'INVALID_INPUT');
    }
    if (!type || !title || !message) {
      throw new NotificationServiceError('Type, title, and message are required', 'INVALID_INPUT');
    }
    return this.repository.broadcast(tenantId, userIds, type, title, message);
  }
}
