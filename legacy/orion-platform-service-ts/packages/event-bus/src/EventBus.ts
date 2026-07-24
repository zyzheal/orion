/**
 * EventBus - 事件总线核心实现
 *
 * 提供 NATS JetStream 的事件发布/订阅能力
 */

import {
  connect,
  ConnectionOptions,
  NatsConnection,
  JetStreamManager,
  JetStreamClient,
  AckPolicy,
  StorageType,
  RetentionPolicy,
  DeliverPolicy,
} from 'nats';
import { CloudEvent, CloudEventBuilder } from './CloudEvent';
import { EventHandler, EventContext, Subscription, SubscriptionOptions, RetryConfig, StreamConfig, EventBusConfig } from './types';
import { DeadLetterQueue } from './DeadLetterQueue';

export class EventBus {
  private connection?: NatsConnection;
  private jsClient?: JetStreamClient;
  private jsManager?: JetStreamManager;
  private config: EventBusConfig;
  private subscriptions: Map<string, Subscription>;
  private deadLetterQueue?: DeadLetterQueue;
  private readonly defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    multiplier: 2,
  };

  constructor(config: EventBusConfig) {
    this.config = config;
    this.subscriptions = new Map();

    if (config.logging?.logger) {
      this.log = config.logging.logger;
    }
  }

  /**
   * 连接到 NATS 服务器
   */
  async connect(): Promise<void> {
    const options: ConnectionOptions = {
      servers: this.config.servers,
      timeout: this.config.timeout || 20000,
      reconnect: this.config.reconnect?.enabled !== false,
      maxReconnectAttempts: this.config.reconnect?.maxRetries || -1,
      reconnectTimeWait: this.config.reconnect?.interval || 2000,
    };

    // 认证配置
    if (this.config.user && this.config.pass) {
      options.user = this.config.user;
      options.pass = this.config.pass;
    }
    if (this.config.token) {
      options.token = this.config.token;
    }

    this.log('info', 'Connecting to NATS servers...', this.config.servers);

    try {
      this.connection = await connect(options);

      // 监听连接事件
      this.connection.closed().then(() => {
        this.log('warn', 'NATS connection closed');
      });

      // 获取 JetStream 客户端
      this.jsClient = this.connection.jetstream();
      this.jsManager = await this.connection.jetstreamManager();

      this.log('info', 'Connected to NATS JetStream');

      // 初始化死信队列
      if (this.config.retry) {
        this.deadLetterQueue = new DeadLetterQueue(
          this.jsClient,
          'orion.dlq',
          this.config.retry,
          this.jsManager
        );
      }
    } catch (error) {
      this.log('error', 'Failed to connect to NATS JetStream', error);
      throw error;
    }
  }

  /**
   * 创建事件流
   */
  async createStream(config: StreamConfig): Promise<void> {
    if (!this.jsManager) {
      throw new Error('JetStream manager not initialized. Call connect() first.');
    }

    this.log('info', `Creating stream: ${config.name}`);

    try {
      await this.jsManager.streams.add({
        name: config.name,
        subjects: config.subjects,
        num_replicas: config.replicas || 3,
        storage: config.storage === 'memory' ? StorageType.Memory : StorageType.File,
        retention: this.mapRetention(config.retention),
        max_msgs: config.maxMsgs ?? -1,
        max_bytes: config.maxBytes ?? -1,
        max_age: config.maxAge ? this.parseDuration(config.maxAge) : 0,
        max_msg_size: config.maxMsgSize ?? -1,
      });

      this.log('info', `Stream ${config.name} created successfully`);
    } catch (error: any) {
      if (error.message?.includes('stream name already in use')) {
        this.log('warn', `Stream ${config.name} already exists, updating...`);
        await this.jsManager.streams.update(config.name, {
          subjects: config.subjects,
        });
      } else {
        this.log('error', `Failed to create stream ${config.name}`, error);
        throw error;
      }
    }
  }

  /**
   * 发布事件
   */
  async publish<T>(event: CloudEvent<T>): Promise<string> {
    if (!this.jsClient) {
      throw new Error('JetStream client not initialized. Call connect() first.');
    }

    // 验证事件
    event.validate();

    const subject = event.type;
    const payload = Buffer.from(JSON.stringify(event.toJSON()));

    this.log('debug', `Publishing event: ${subject}`, { id: event.id });

    try {
      const ack = await this.jsClient.publish(subject, payload);

      if (ack.seq) {
        this.log('debug', `Event published successfully`, {
          id: event.id,
          sequence: ack.seq,
        });
      }

      return ack.seq.toString();
    } catch (error) {
      this.log('error', `Failed to publish event: ${subject}`, { id: event.id, error });
      throw error;
    }
  }

  /**
   * 订阅事件
   */
  async subscribe<T>(
    eventType: string,
    handler: EventHandler<T>,
    options?: SubscriptionOptions
  ): Promise<Subscription> {
    if (!this.jsClient || !this.jsManager) {
      throw new Error('JetStream client not initialized. Call connect() first.');
    }

    const streamName = options?.streamName || this.inferStreamName(eventType);
    const durableName = options?.durableName || `orion-sub-${eventType}-${Date.now()}`;
    const subject = options?.filterSubject || eventType;

    this.log('info', `Subscribing to event: ${eventType}`, {
      stream: streamName,
      durable: durableName,
    });

    try {
      // 先通过 JetStreamManager 创建 consumer
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
          this.log('warn', `Failed to create consumer, may already exist: ${error.message}`);
        }
      }

      // 通过 JetStreamClient 获取已创建的 consumer
      const consumer = await this.jsClient.consumers.get(streamName, durableName);

      const subscription = await consumer.consume({
        callback: async (message) => {
          const event = CloudEvent.fromJSON<T>(message.data.toString());
          const context: EventContext = {
            subscriptionId: durableName,
            seq: message.seq,
            timestamp: new Date(),
            retryCount: 0,
          };

          try {
            await handler(event, context);
            message.ack();
            this.log('debug', `Event handled successfully`, { id: event.id });
          } catch (error) {
            this.log('error', `Event handler failed`, { id: event.id, error });

            // 处理重试和死信
            await this.handleProcessingError(message, event, error);
          }
        },
      });

      const sub: Subscription = {
        id: durableName,
        unsubscribe: async () => {
          subscription.stop();
          this.subscriptions.delete(durableName);
          this.log('info', `Subscription ${durableName} unsubscribed`);
        },
        drain: async () => {
          // ConsumerMessages 没有 drain 方法，使用 stop 替代
          subscription.stop();
          this.subscriptions.delete(durableName);
        },
        isClosed: false,
      };

      this.subscriptions.set(durableName, sub);
      return sub;
    } catch (error) {
      this.log('error', `Failed to subscribe to event: ${eventType}`, error);
      throw error;
    }
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    this.log('info', 'Closing EventBus connection');

    // 取消所有订阅
    for (const [id, sub] of this.subscriptions) {
      try {
        await sub.unsubscribe();
      } catch (error) {
        this.log('error', `Error unsubscribing ${id}`, error);
      }
    }

    // 关闭连接
    if (this.connection) {
      await this.connection.drain();
      this.connection = undefined;
      this.jsClient = undefined;
      this.jsManager = undefined;
    }
  }

  /**
   * 处理处理错误（重试/死信）
   */
  private async handleProcessingError(
    message: any,
    event: CloudEvent,
    error: any
  ): Promise<void> {
    const retryCount = this.getRetryCount(message);

    if (retryCount < (this.config.retry?.maxRetries || 3)) {
      // 计算重试延迟（指数退避）
      const delay = this.calculateRetryDelay(retryCount);
      this.log('warn', `Scheduling retry ${retryCount + 1} for event ${event.id}`, { delay });

      // 使用 nak 进行重试
      message.nak();
    } else {
      // 达到最大重试次数，发送到死信队列
      this.log('error', `Event ${event.id} moved to DLQ after ${retryCount} retries`);
      await this.deadLetterQueue?.publish({
        event,
        error: error.message,
        timestamp: new Date(),
        retryCount,
      });
      message.ack();
    }
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

  /**
   * 计算重试延迟
   */
  private calculateRetryDelay(retryCount: number): number {
    const retry = this.config.retry || this.defaultRetryConfig;
    const delay = retry.initialDelayMs * Math.pow(retry.multiplier, retryCount);
    return Math.min(delay, retry.maxDelayMs);
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
   * 映射保留策略
   */
  private mapRetention(retention: string): RetentionPolicy {
    const map: Record<string, RetentionPolicy> = {
      limits: RetentionPolicy.Limits,
      interest: RetentionPolicy.Interest,
      workqueue: RetentionPolicy.Workqueue,
    };
    return map[retention] || RetentionPolicy.Limits;
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
   * 解析持续时间
   */
  private parseDuration(duration: string): number {
    // 支持格式：1h, 30m, 300s, 1000ms
    const match = duration.match(/^(\d+)(ms|s|m|h|d)$/);
    if (!match) return 0;

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const multipliers: Record<string, number> = {
      ms: 1,
      s: 1000,
      m: 60000,
      h: 3600000,
      d: 86400000,
    };

    return value * (multipliers[unit] || 1);
  }

  /**
   * 日志函数
   */
  private log(
    level: string,
    message: string,
    ...args: any[]
  ): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [EventBus]`;
    console.log(`${prefix} ${message}`, ...args);
  }
}
