import { ScheduledNotificationRepository, ScheduledNotification, CreateScheduledNotificationInput, UpdateScheduledNotificationInput } from '../repositories/ScheduledNotificationRepository';
import { createLogger } from '../../utils/logger';

export class ScheduledNotificationServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ScheduledNotificationServiceError';
  }
}

export class ScheduledNotificationService {
  private logger = createLogger('scheduled-notification');

  constructor(private repository: ScheduledNotificationRepository) {}

  async createScheduledNotification(input: CreateScheduledNotificationInput): Promise<ScheduledNotification> {
    if (!input.user_id || !input.type || !input.title || !input.message || !input.scheduled_at) {
      throw new ScheduledNotificationServiceError('user_id, type, title, message, and scheduled_at are required', 'INVALID_INPUT');
    }
    return this.repository.create(input);
  }

  async getScheduledNotification(id: string): Promise<ScheduledNotification> {
    const notification = await this.repository.findById(id);
    if (!notification) {
      throw new ScheduledNotificationServiceError(`Scheduled notification not found: ${id}`, 'NOT_FOUND');
    }
    return notification;
  }

  async listScheduledNotifications(options?: { userId?: string; status?: string; limit?: number; offset?: number }): Promise<ScheduledNotification[]> {
    return this.repository.findAll(options);
  }

  async updateScheduledNotification(id: string, updates: UpdateScheduledNotificationInput): Promise<ScheduledNotification> {
    const notification = await this.repository.update(id, updates);
    if (!notification) {
      throw new ScheduledNotificationServiceError(`Scheduled notification not found: ${id}`, 'NOT_FOUND');
    }
    return notification;
  }

  async cancelScheduledNotification(id: string): Promise<void> {
    const cancelled = await this.repository.cancel(id);
    if (!cancelled) {
      throw new ScheduledNotificationServiceError(`Scheduled notification not found or already processed: ${id}`, 'NOT_FOUND');
    }
  }

  async deleteScheduledNotification(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new ScheduledNotificationServiceError(`Scheduled notification not found: ${id}`, 'NOT_FOUND');
    }
  }
}
