/**
 * 事件订阅器
 */

import { JetStreamClient } from 'nats';
import { CloudEvent } from './CloudEvent';
import { EventHandler, EventContext, Subscription, SubscriptionOptions } from './types';
import { EventPublisher } from './EventPublisher';

export interface SubscriptionOptions {
  /** 流名称 */
  streamName?: string;
  /** 持久化订阅名称 */
  durableName?: string;
  /** 主题过滤 */
  filterSubject?: string;
  /** 自动 ACK */
  autoAck?: boolean;
  /** 最大未确认消息数 */
  maxAckPending?: number;
  /** 批量大小 */
  batchSize?: number;
  /** 心跳间隔 (ms) */
  idleHeartbeat?: number;
  /** 从何处开始消费 */
  deliverPolicy?: 'all' | 'last' | 'new' | 'byStartSequence' | 'byStartTime';
  /** 起始序列号 */
  optStartSeq?: number;
  /** 起始时间 */
  optStartTime?: Date;
}

export class EventSubscriber {
  private jsClient: JetStreamClient;
  private publisher: EventPublisher;

  constructor(jsClient: JetStreamClient, publisher: EventPublisher) {
    this.jsClient = jsClient;
    this.publisher = publisher;
  }

  /**
   * 订阅事件
   */
  async subscribe<T>(
    eventType: string,
    handler: EventHandler<T>,
    options?: SubscriptionOptions
  ): Promise<Subscription> {
    const streamName = options?.streamName || this.inferStreamName(eventType);
    const durableName = options?.durableName || `orion-sub-${eventType}-${Date.now()}`;
    const subject = options?.filterSubject || eventType;

    console.log('[EventSubscriber] Subscribing to:', eventType, {
      stream: streamName,
      durable: durableName,
      subject: subject,
    });

    try {
      // 获取或创建消费者
      const consumer = await this.jsClient.consumers.get(streamName, {
        durable_name: durableName,
        filter_subject: subject,
        ack_policy: options?.autoAck ? 0 : 2, // 0 = None, 2 = Explicit
        max_ack_pending: options?.maxAckPending || 100,
        max_batch: options?.batchSize || 10,
        idle_heartbeat: options?.idleHeartbeat || 30000,
        deliver_policy: this.mapDeliverPolicy(options?.deliverPolicy),
        opt_start_seq: options?.optStartSeq,
        opt_start_time: options?.optStartTime?.toISOString(),
      });

      // 开始消费
      const subscription = await consumer.consume({
        callback: async (message) => {
          const event = CloudEvent.fromJSON<T>(message.data.toString());
          const context: EventContext = {
            subscriptionId: durableName,
            seq: message.seq,
            timestamp: new Date(),
            retryCount: this.getRetryCount(message),
          };

          try {
            await handler(event, context);
            if (!options?.autoAck) {
              message.ack();
            }
          } catch (error) {
            console.error('[EventSubscriber] Handler failed:', error);
            if (!options?.autoAck) {
              message.nak();
            }
          }
        },
      });

      return {
        id: durableName,
        unsubscribe: async () => {
          subscription.stop();
        },
        drain: async () => {
          await subscription.drain();
        },
        isClosed: false,
      };
    } catch (error) {
      console.error('[EventSubscriber] Failed to subscribe:', error);
      throw error;
    }
  }

  /**
   * 订阅 Pipeline 事件
   */
  async subscribeToPipelineEvents<T>(
    handler: EventHandler<T>,
    options?: SubscriptionOptions
  ): Promise<Subscription> {
    return this.subscribe('pipeline.run.>', handler, {
      ...options,
      streamName: options?.streamName || 'orion-pipeline-stream',
    });
  }

  /**
   * 订阅部署事件
   */
  async subscribeToDeploymentEvents<T>(
    handler: EventHandler<T>,
    options?: SubscriptionOptions
  ): Promise<Subscription> {
    return this.subscribe('deployment.>', handler, {
      ...options,
      streamName: options?.streamName || 'orion-deployment-stream',
    });
  }

  /**
   * 订阅代码事件
   */
  async subscribeToCodeEvents<T>(
    handler: EventHandler<T>,
    options?: SubscriptionOptions
  ): Promise<Subscription> {
    return this.subscribe('code.>', handler, {
      ...options,
      streamName: options?.streamName || 'orion-code-stream',
    });
  }

  /**
   * 订阅配置事件
   */
  async subscribeToConfigEvents<T>(
    handler: EventHandler<T>,
    options?: SubscriptionOptions
  ): Promise<Subscription> {
    return this.subscribe('config.>', handler, {
      ...options,
      streamName: options?.streamName || 'orion-config-stream',
    });
  }

  /**
   * 推断流名称
   */
  private inferStreamName(eventType: string): string {
    const parts = eventType.split('.');
    if (parts.length >= 2) {
      return `orion-${parts[0]}-stream`;
    }
    return 'orion-default-stream';
  }

  /**
   * 映射投递策略
   */
  private mapDeliverPolicy(policy?: string): number {
    if (!policy) return 0; // all
    const map: Record<string, number> = {
      all: 0,
      last: 1,
      new: 2,
      byStartSequence: 3,
      byStartTime: 4,
    };
    return map[policy] || 0;
  }

  /**
   * 获取重试次数
   */
  private getRetryCount(message: any): number {
    const headers = message.headers;
    if (headers) {
      return parseInt(headers.get('Nats-Redelivered') || '0', 10);
    }
    return 0;
  }
}
