/**
 * NotificationDeliveryService - Business logic for notification delivery orchestration
 *
 * Responsible for:
 *   - Orchestrating delivery across channels (email, sms, webhook, push)
 *   - Retry logic with exponential backoff
 *   - Fallback channel management
 *   - Delivery history tracking
 */

import {
  NotificationDeliveryRepository,
  NotificationDelivery,
  CreateDeliveryInput,
  DeliveryStatus,
  DeliveryChannel,
} from '../../repositories/NotificationDeliveryRepository';
import { NotificationRepository } from './NotificationRepository';
import { createLogger } from '../../utils/logger';
import { OrionError, ErrorCode } from '../../errors';

export class NotificationDeliveryServiceError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = 'NotificationDeliveryServiceError'; }
}

const logger = createLogger('notification-delivery-service');

/**
 * Channel delivery executor interface
 * Each channel (email, sms, webhook, push) implements this interface
 */
export interface ChannelExecutor {
  channel: DeliveryChannel;
  execute(delivery: NotificationDelivery): Promise<{
    success: boolean;
    responseStatus?: number;
    responseBody?: string;
    error?: string;
  }>;
}

export class NotificationDeliveryService {
  private repository: NotificationDeliveryRepository;
  private notificationRepo: NotificationRepository;
  private channelExecutors: Map<DeliveryChannel, ChannelExecutor>;

  constructor(
    repository: NotificationDeliveryRepository,
    notificationRepo: NotificationRepository,
    channelExecutors?: Map<DeliveryChannel, ChannelExecutor>
  ) {
    this.repository = repository;
    this.notificationRepo = notificationRepo;
    this.channelExecutors = channelExecutors ?? new Map();
  }

  registerChannelExecutor(executor: ChannelExecutor): void {
    this.channelExecutors.set(executor.channel, executor);
  }

  /**
   * deliverNotification - Orchestrate delivery across configured channels
   *
   * Reads notification, creates delivery records per channel, executes each.
   * If primary fails, falls back to fallback_channel if configured.
   */
  async deliverNotification(notificationId: string): Promise<NotificationDelivery[]> {
    const notification = await this.notificationRepo.findById(notificationId);
    if (!notification) {
      throw new NotificationDeliveryServiceError(`Notification not found: ${notificationId}`, 'NOT_FOUND');
    }

    const deliveries: NotificationDelivery[] = [];
    const channels = this.resolveChannels(notification);

    for (const channel of channels) {
      const delivery = await this.createAndExecuteDelivery(notification, channel);
      deliveries.push(delivery);

      // If primary delivery failed but has a fallback, try the fallback
      if (delivery.status === 'failed' && delivery.fallback_channel) {
        const fallbackDelivery = await this.createAndExecuteDelivery(
          notification,
          delivery.fallback_channel as DeliveryChannel,
          delivery.id
        );
        deliveries.push(fallbackDelivery);
      }
    }

    return deliveries;
  }

  /**
   * retryDelivery - Retry a failed or exhausted delivery
   *
   * Increments attempt count, re-executes via channel executor.
   * Marks as exhausted if max_attempts reached.
   */
  async retryDelivery(deliveryId: string): Promise<NotificationDelivery> {
    const delivery = await this.repository.findById(deliveryId);
    if (!delivery) {
      throw new NotificationDeliveryServiceError(`Delivery not found: ${deliveryId}`, 'NOT_FOUND');
    }

    if (delivery.attempt_number >= delivery.max_attempts) {
      await this.repository.markExhausted(deliveryId, 'Max retries exceeded');
      throw new NotificationDeliveryServiceError(
        `Delivery ${deliveryId} has exhausted all retry attempts`,
        'EXHAUSTED'
      );
    }

    // Increment attempt and set to retrying
    const updated = await this.repository.incrementAttempt(deliveryId);
    if (!updated) {
      throw new NotificationDeliveryServiceError(`Failed to increment attempt for ${deliveryId}`, 'INTERNAL_ERROR');
    }

    // Execute the retry
    try {
      const executor = this.channelExecutors.get(delivery.channel);
      if (!executor) {
        await this.repository.markExhausted(deliveryId, `No executor for channel: ${delivery.channel}`);
        throw new NotificationDeliveryServiceError(
          `No executor registered for channel: ${delivery.channel}`,
          'NO_EXECUTOR'
        );
      }

      const result = await executor.execute(updated);

      if (result.success) {
        await this.repository.updateStatus(deliveryId, {
          status: 'sent',
          sent_at: new Date(),
          response_body: result.responseBody ?? null,
          response_status: result.responseStatus ?? null,
          next_retry_at: null,
          metadata: { ...updated.metadata, retrySuccess: true },
        });
        return { ...updated, status: 'sent', sent_at: new Date(), response_body: result.responseBody ?? null, response_status: result.responseStatus ?? null } as NotificationDelivery;
      } else {
        const nextRetry = this.calculateNextRetry(updated.attempt_number);
        await this.repository.updateStatus(deliveryId, {
          status: updated.attempt_number >= updated.max_attempts ? 'exhausted' : 'failed',
          error_message: result.error ?? null,
          response_body: result.responseBody ?? null,
          response_status: result.responseStatus ?? null,
          next_retry_at: nextRetry,
        });

        if (updated.attempt_number >= updated.max_attempts) {
          await this.repository.markExhausted(deliveryId, result.error);
        }

        return updated;
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      await this.repository.markExhausted(deliveryId, errMsg);
      throw error;
    }
  }

  /**
   * getDeliveryHistory - Get all delivery attempts for a notification
   */
  async getDeliveryHistory(notificationId: string): Promise<NotificationDelivery[]> {
    return this.repository.findByNotificationId(notificationId);
  }

  /**
   * getPendingDeliveries - Used by retry worker to find deliveries due for retry
   */
  async getPendingDeliveries(limit = 50): Promise<NotificationDelivery[]> {
    return this.repository.findPendingForRetry(limit);
  }

  // --- Private helpers ---

  private resolveChannels(notification: { channel?: string }): DeliveryChannel[] {
    const channel = notification.channel || 'in-app';
    // For multi-channel notifications, return all enabled channels
    // For single channel, return just the specified one
    if (channel === 'multi' || channel === 'broadcast') {
      return ['email', 'sms', 'webhook', 'push', 'in-app'];
    }
    return [channel as DeliveryChannel];
  }

  private async createAndExecuteDelivery(
    notification: { id: string; tenant_id: string; user_id: string; type: string; title: string; message: string },
    channel: DeliveryChannel,
    parentDeliveryId?: string
  ): Promise<NotificationDelivery> {
    const delivery = await this.repository.create({
      notification_id: notification.id,
      channel,
      recipient: notification.user_id,
      subject: notification.title,
      body: notification.message,
      max_attempts: 3,
      fallback_channel: this.resolveFallbackChannel(channel),
      metadata: parentDeliveryId ? { parentDeliveryId } : undefined,
    });

    try {
      const executor = this.channelExecutors.get(channel);
      if (!executor) {
        await this.repository.updateStatus(delivery.id, {
          status: 'failed',
          error_message: `No executor registered for channel: ${channel}`,
        });
        return { ...delivery, status: 'failed', error_message: `No executor registered for channel: ${channel}` } as NotificationDelivery;
      }

      const result = await executor.execute(delivery);

      if (result.success) {
        await this.repository.updateStatus(delivery.id, {
          status: 'sent',
          sent_at: new Date(),
          response_body: result.responseBody ?? null,
          response_status: result.responseStatus ?? null,
          next_retry_at: null,
        });
        return { ...delivery, status: 'sent', sent_at: new Date(), response_body: result.responseBody ?? null, response_status: result.responseStatus ?? null } as NotificationDelivery;
      } else {
        await this.repository.updateStatus(delivery.id, {
          status: 'failed',
          error_message: result.error ?? null,
          response_body: result.responseBody ?? null,
          response_status: result.responseStatus ?? null,
        });
        return { ...delivery, status: 'failed', error_message: result.error ?? null, response_body: result.responseBody ?? null, response_status: result.responseStatus ?? null } as NotificationDelivery;
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      await this.repository.updateStatus(delivery.id, {
        status: 'failed',
        error_message: errMsg,
      });
      return { ...delivery, status: 'failed', error_message: errMsg } as NotificationDelivery;
    }
  }

  private resolveFallbackChannel(channel: DeliveryChannel): DeliveryChannel | null {
    const fallbacks: Record<DeliveryChannel, DeliveryChannel | null> = {
      'email': 'push',
      'sms': 'webhook',
      'webhook': 'in-app',
      'push': 'in-app',
      'in-app': null,
    };
    return fallbacks[channel];
  }

  private calculateNextRetry(attemptNumber: number): Date {
    // Exponential backoff: 30s, 5min, 30min
    const backoffMs = [30_000, 300_000, 1_800_000];
    const ms = backoffMs[Math.min(attemptNumber - 1, backoffMs.length - 1)];
    return new Date(Date.now() + ms);
  }
}
