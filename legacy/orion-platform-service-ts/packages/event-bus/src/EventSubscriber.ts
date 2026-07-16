/**
 * 事件订阅器
 */

import { JetStreamClient, JetStreamManager, AckPolicy, DeliverPolicy } from 'nats';
import { CloudEvent } from './CloudEvent';
import { EventHandler, EventContext, Subscription } from './types';
import { EventPublisher } from './EventPublisher';

export interface SubscriberOptions {
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
  private jsManager?: JetStreamManager;
  private publisher: EventPublisher;

  constructor(jsClient: JetStreamClient, publisher: EventPublisher, jsManager?: JetStreamManager) {
    this.jsClient = jsClient;
    this.jsManager = jsManager;
    this.publisher = publisher;
  }

  /**
   * 设置 JetStream Manager（用于消费者管理操作）
   */
  setJetStreamManager(jsm: JetStreamManager): void {
    this.jsManager = jsm;
  }

  /**
   * 订阅事件
   */
  async subscribe<T>(
    eventType: string,
    handler: EventHandler<T>,
    options?: SubscriberOptions
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
      // 如果有 jsManager，先创建 consumer
      if (this.jsManager) {
        const consumerConfig = {
          durable_name: durableName,
          filter_subject: subject,
          ack_policy: options?.autoAck ? AckPolicy.None : AckPolicy.Explicit,
          max_ack_pending: options?.maxAckPending || 100,
          idle_heartbeat: options?.idleHeartbeat ? options.idleHeartbeat * 1000000 : 30000000000,
          deliver_policy: this.mapDeliverPolicy(options?.deliverPolicy),
          opt_start_seq: options?.optStartSeq,
          opt_start_time: options?.optStartTime?.toISOString(),
        };

        try {
          await this.jsManager.consumers.add(streamName, consumerConfig);
        } catch (error: any) {
          // Consumer may already exist, ignore the error
          if (!error.message?.includes('consumer name already in use')) {
            console.warn('[EventSubscriber] Failed to create consumer, may already exist:', error.message);
          }
        }
      }

      // 通过 JetStreamClient 获取 consumer
      const consumer = await this.jsClient.consumers.get(streamName, durableName);

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
          // ConsumerMessages 没有 drain 方法，使用 stop 替代
          subscription.stop();
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
    options?: SubscriberOptions
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
    options?: SubscriberOptions
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
    options?: SubscriberOptions
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
    options?: SubscriberOptions
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
  private mapDeliverPolicy(policy?: string): DeliverPolicy {
    if (!policy) return DeliverPolicy.All;
    const map: Record<string, DeliverPolicy> = {
      all: DeliverPolicy.All,
      last: DeliverPolicy.Last,
      new: DeliverPolicy.New,
      byStartSequence: DeliverPolicy.StartSequence,
      byStartTime: DeliverPolicy.StartTime,
    };
    return map[policy] || DeliverPolicy.All;
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
