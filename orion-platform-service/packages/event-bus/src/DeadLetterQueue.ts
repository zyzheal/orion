/**
 * 死信队列 (Dead Letter Queue) 实现
 *
 * 用于存储处理失败的消息，支持后续重试或人工处理
 */

import { JetStreamClient, JetStreamManager, AckPolicy, StorageType, RetentionPolicy } from 'nats';
import { CloudEvent } from './CloudEvent';
import { RetryConfig } from './types';

export interface DLQEntry {
  /** 原始事件 */
  event: CloudEvent;
  /** 错误信息 */
  error: string;
  /** 进入 DLQ 的时间 */
  timestamp: Date;
  /** 重试次数 */
  retryCount: number;
  /** 原始主题 */
  originalSubject?: string;
}

export interface DLQConfig {
  /** 死信主题 */
  subject: string;
  /** 最大投递次数 */
  maxDeliver: number;
}

export class DeadLetterQueue {
  private jsClient: JetStreamClient;
  private jsManager?: JetStreamManager;
  private dlqSubject: string;
  private dlqStreamName: string;
  private retryConfig: RetryConfig;

  constructor(
    jsClient: JetStreamClient,
    dlqSubject: string,
    retryConfig: RetryConfig,
    jsManager?: JetStreamManager
  ) {
    this.jsClient = jsClient;
    this.jsManager = jsManager;
    this.dlqSubject = dlqSubject;
    this.dlqStreamName = 'orion-dlq-stream';
    this.retryConfig = retryConfig;
  }

  /**
   * 设置 JetStream Manager（用于流管理操作）
   */
  setJetStreamManager(jsm: JetStreamManager): void {
    this.jsManager = jsm;
  }

  /**
   * 初始化死信队列流
   */
  async init(): Promise<void> {
    if (!this.jsManager) {
      console.log('[DLQ] JetStreamManager not available, skipping stream init');
      return;
    }

    try {
      // 创建 DLQ 流
      await this.jsManager.streams.add({
        name: this.dlqStreamName,
        subjects: [this.dlqSubject],
        num_replicas: 3,
        storage: StorageType.File,
        retention: RetentionPolicy.Limits,
        max_msgs: 100000,
        max_age: 2592000000000, // 30 天 (nanoseconds)
      });
      console.log('[DLQ] Stream initialized:', this.dlqStreamName);
    } catch (error: any) {
      if (error.message?.includes('stream name already in use')) {
        console.log('[DLQ] Stream already exists:', this.dlqStreamName);
      } else {
        console.error('[DLQ] Failed to initialize stream:', error);
        throw error;
      }
    }
  }

  /**
   * 发布消息到死信队列
   */
  async publish(entry: DLQEntry): Promise<void> {
    const payload = {
      event: entry.event.toJSON(),
      error: entry.error,
      timestamp: entry.timestamp.toISOString(),
      retryCount: entry.retryCount,
      originalSubject: entry.originalSubject || entry.event.type,
    };

    try {
      await this.jsClient.publish(this.dlqSubject, Buffer.from(JSON.stringify(payload)));
      console.log('[DLQ] Entry published:', {
        eventId: entry.event.id,
        error: entry.error,
        retryCount: entry.retryCount,
      });
    } catch (error) {
      console.error('[DLQ] Failed to publish entry:', error);
      throw error;
    }
  }

  /**
   * 订阅死信队列
   */
  async subscribe(
    handler: (entry: DLQEntry) => Promise<void>
  ): Promise<{ unsubscribe: () => Promise<void> }> {
    try {
      // 使用 JetStreamClient.consumers.get 获取消费者
      const consumer = await this.jsClient.consumers.get(this.dlqStreamName, 'orion-dlq-processor');

      const subscription = await consumer.consume({
        callback: async (message) => {
          try {
            const data = JSON.parse(message.data.toString());
            const entry: DLQEntry = {
              event: CloudEvent.fromJSON(data.event),
              error: data.error,
              timestamp: new Date(data.timestamp),
              retryCount: data.retryCount,
              originalSubject: data.originalSubject,
            };

            await handler(entry);
            message.ack();
          } catch (error) {
            console.error('[DLQ] Handler failed:', error);
            message.nak();
          }
        },
      });

      return {
        unsubscribe: async () => {
          subscription.stop();
        },
      };
    } catch (error) {
      console.error('[DLQ] Failed to subscribe:', error);
      throw error;
    }
  }

  /**
   * 获取 DLQ 中的消息数量
   */
  async getMessageCount(): Promise<number> {
    if (!this.jsManager) {
      console.error('[DLQ] JetStreamManager not available');
      return 0;
    }
    try {
      const streamInfo = await this.jsManager.streams.info(this.dlqStreamName);
      return streamInfo.state.messages;
    } catch (error) {
      console.error('[DLQ] Failed to get message count:', error);
      return 0;
    }
  }

  /**
   * 清空死信队列
   */
  async purge(): Promise<void> {
    if (!this.jsManager) {
      console.error('[DLQ] JetStreamManager not available');
      return;
    }
    try {
      await this.jsManager.streams.purge(this.dlqStreamName);
      console.log('[DLQ] Stream purged:', this.dlqStreamName);
    } catch (error) {
      console.error('[DLQ] Failed to purge stream:', error);
      throw error;
    }
  }
}
