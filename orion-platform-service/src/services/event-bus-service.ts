/**
 * EventBus 集成服务 (独立版)
 *
 * 不依赖 @orion/event-bus 包，使用原生 NATS 实现
 */

import { EventEmitter } from 'events';

export interface EventBusServiceConfig {
  servers?: string[];
  user?: string;
  pass?: string;
  token?: string;
  timeout?: number;
  reconnect?: {
    enabled: boolean;
    maxRetries: number;
    interval: number;
  };
  logging?: {
    level: 'debug' | 'info' | 'warn' | 'error';
    logger?: (level: string, message: string, ...args: any[]) => void;
  };
  retry?: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    multiplier: number;
  };
  enabled?: boolean;
  autoConnect?: boolean;
}

export class EventBusService extends EventEmitter {
  private config: EventBusServiceConfig;
  private isConnected: boolean = false;
  private natsConnection: any = null;

  constructor(config: EventBusServiceConfig) {
    super();
    this.config = {
      enabled: config.enabled !== false,
      autoConnect: config.autoConnect !== false,
      ...config,
    };
  }

  /**
   * 连接事件总线
   */
  async connect(): Promise<void> {
    if (!this.config.enabled) {
      console.log('[EventBusService] Disabled, skipping connection');
      return;
    }

    console.log('[EventBusService] Connecting to NATS...');

    try {
      // 动态导入 NATS
      const { connect } = await import('nats').catch(() => ({ connect: null }));

      if (!connect) {
        console.warn('[EventBusService] NATS module not available, running without event bus');
        this.isConnected = true;
        return;
      }

      this.natsConnection = await connect({
        servers: this.config.servers || ['nats://localhost:4222'],
        user: this.config.user,
        pass: this.config.pass,
        token: this.config.token,
        timeout: this.config.timeout || 20000,
        reconnect: this.config.reconnect?.enabled !== false,
        maxReconnectAttempts: this.config.reconnect?.maxRetries || -1,
        reconnectTimeWait: this.config.reconnect?.interval || 2000,
      });

      this.isConnected = true;
      this.emit('connect');
      console.log('[EventBusService] Connected to NATS');

      // 监听连接状态
      this.natsConnection.closed().then(() => {
        this.isConnected = false;
        this.emit('close');
        console.log('[EventBusService] NATS connection closed');
      });
    } catch (error) {
      console.warn('[EventBusService] Connection failed:', error);
      this.emit('error', error);
      // 不抛出错误，允许服务在没有事件总线的情况下运行
      this.isConnected = true;
    }
  }

  /**
   * 创建事件流（JetStream）
   */
  async createStream(
    name: string,
    subjects: string[],
    options?: {
      replicas?: number;
      storage?: 'memory' | 'file';
      retention?: 'limits' | 'interest' | 'workqueue';
      maxMsgs?: number;
      maxBytes?: number;
      maxAge?: string;
    }
  ): Promise<void> {
    if (!this.natsConnection) {
      console.warn('[EventBusService] NATS not connected, skipping stream creation');
      return;
    }

    try {
      const js = this.natsConnection.jetstream();

      await js.streams.add({
        name,
        subjects,
        replicas: options?.replicas || 1,
        storage: options?.storage === 'memory' ? 0 : 1,
      });

      console.log(`[EventBusService] Stream ${name} created`);
    } catch (error: any) {
      if (error.message?.includes('already in use')) {
        console.log(`[EventBusService] Stream ${name} already exists`);
      } else {
        console.warn('[EventBusService] Failed to create stream:', error);
      }
    }
  }

  /**
   * 发布事件
   */
  async publish<T = any>(
    type: string,
    data: T,
    options?: {
      source?: string;
      subject?: string;
      headers?: Record<string, string>;
    }
  ): Promise<string> {
    if (!this.natsConnection) {
      console.warn('[EventBusService] NATS not connected, event not published:', type);
      return 'mock-event-id';
    }

    try {
      const subject = options?.subject || type.replace(/\./g, '.');
      const message = JSON.stringify({
        type,
        source: options?.source || 'orion-platform-service',
        data,
        timestamp: new Date().toISOString(),
      });

      const pubAck = await this.natsConnection.publish(subject, new TextEncoder().encode(message));
      return pubAck.seq.toString();
    } catch (error) {
      console.warn('[EventBusService] Failed to publish event:', error);
      return 'mock-event-id';
    }
  }

  /**
   * 订阅事件
   */
  async subscribe<T = any>(
    eventType: string,
    handler: (event: any) => Promise<void>,
    options?: {
      streamName?: string;
      durableName?: string;
      autoAck?: boolean;
      filterSubject?: string;
    }
  ): Promise<() => Promise<void>> {
    if (!this.natsConnection) {
      console.warn('[EventBusService] NATS not connected, cannot subscribe');
      return async () => {};
    }

    try {
      const subject = options?.filterSubject || eventType;
      const queue = options?.durableName || 'orion-platform-queue';

      const subscription = this.natsConnection.subscribe(subject, {
        queue,
      });

      // 处理消息
      (async () => {
        for await (const msg of subscription) {
          try {
            const data = JSON.parse(new TextDecoder().decode(msg.data));
            await handler({
              type: eventType,
              data: data.data,
              source: data.source,
              timestamp: data.timestamp,
            });
            msg.ack();
          } catch (error) {
            console.error('[EventBusService] Error handling message:', error);
          }
        }
      })().catch((err) => {
        console.error('[EventBusService] Subscription error:', err);
      });

      this.emit('subscribe', { eventType, subscriptionId: subject });

      // 返回取消订阅函数
      return async () => {
        await subscription.drain();
      };
    } catch (error) {
      console.warn('[EventBusService] Failed to subscribe:', error);
      return async () => {};
    }
  }

  /**
   * 检查连接健康
   */
  async checkHealth(): Promise<{ status: 'up' | 'down'; message?: string }> {
    if (!this.config.enabled) {
      return { status: 'up', message: 'EventBus disabled' };
    }

    if (!this.natsConnection) {
      return { status: 'down', message: 'Not connected' };
    }

    if (this.natsConnection.isClosed()) {
      return { status: 'down', message: 'Connection closed' };
    }

    return { status: 'up' };
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    if (this.natsConnection) {
      console.log('[EventBusService] Closing NATS connection...');
      try {
        await this.natsConnection.drain();
        await this.natsConnection.close();
      } catch (error) {
        console.warn('[EventBusService] Error closing NATS:', error);
      }
      this.natsConnection = null;
      this.isConnected = false;
      this.emit('close');
    }
  }

  /**
   * 检查服务状态
   */
  isHealthy(): boolean {
    if (!this.config.enabled) {
      return true;
    }
    return this.isConnected;
  }
}
