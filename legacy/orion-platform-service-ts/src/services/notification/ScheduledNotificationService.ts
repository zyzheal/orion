import { ScheduledNotificationRepository, ScheduledNotification, CreateScheduledNotificationInput, UpdateScheduledNotificationInput } from '../../repositories/ScheduledNotificationRepository';
import { createLogger } from '../../utils/logger';

export class ScheduledNotificationServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ScheduledNotificationServiceError';
  }
}

export interface ParsedCronSchedule {
  expression: string;
  description: string;
  nextFireTime: Date | null;
  timezone: string;
  valid: boolean;
  error?: string;
}

export class ScheduledNotificationService {
  private logger = createLogger('scheduled-notification');

  constructor(private repository: ScheduledNotificationRepository) {}

  // =========================================================================
  // CRUD
  // =========================================================================

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

  // =========================================================================
  // Cron Expression Validation
  // =========================================================================

  validateCronExpression(cronExpression: string, timezone: string = 'UTC'): ParsedCronSchedule {
    const fields = cronExpression.trim().split(/\s+/);

    if (fields.length !== 5) {
      return {
        expression: cronExpression,
        description: 'Invalid cron format',
        nextFireTime: null,
        timezone,
        valid: false,
        error: 'Cron expression must have exactly 5 fields (minute hour day-of-month month day-of-week)',
      };
    }

    const [minute, hour, dom, month, dow] = fields;

    const cronFieldRegex = /^[\d\*\/\-,]+$/;
    for (const field of fields) {
      if (!cronFieldRegex.test(field)) {
        return {
          expression: cronExpression,
          description: 'Invalid cron format',
          nextFireTime: null,
          timezone,
          valid: false,
          error: `Invalid field: ${field}`,
        };
      }
    }

    const parts: string[] = [];
    if (minute === '*' && hour === '*') {
      parts.push('every minute');
    } else if (hour === '*') {
      parts.push(`at minute ${minute} of every hour`);
    } else if (minute === '*') {
      parts.push(`every minute during hour ${hour}`);
    } else {
      parts.push(`at ${hour}:${minute.padStart(2, '0')}`);
    }

    if (dom !== '*' || dow !== '*') {
      const domPart = dom !== '*' ? `on day ${dom} of month` : '';
      const dowPart = dow !== '*' ? `on ${dow}` : '';
      if (domPart && dowPart) parts.push(`${domPart} and ${dowPart}`);
      else if (domPart) parts.push(domPart);
      else if (dowPart) parts.push(dowPart);
    }

    if (month !== '*') {
      parts.push(`in month ${month}`);
    }

    const description = parts.join(' ') || cronExpression;

    const now = new Date();
    const nextFire = new Date(now);
    nextFire.setSeconds(0, 0);
    nextFire.setMinutes(nextFire.getMinutes() + 1);

    return {
      expression: cronExpression,
      description: `Runs ${description}`,
      nextFireTime: nextFire,
      timezone,
      valid: true,
    };
  }

  // =========================================================================
  // Schedule Toggle
  // =========================================================================

  async toggleSchedule(id: string, active: boolean): Promise<ScheduledNotification> {
    const newStatus = active ? 'pending' : 'paused';
    const notification = await this.repository.update(id, {
      status: newStatus,
    } as UpdateScheduledNotificationInput);

    if (!notification) {
      throw new ScheduledNotificationServiceError(`Scheduled notification not found: ${id}`, 'NOT_FOUND');
    }

    return notification;
  }
}
