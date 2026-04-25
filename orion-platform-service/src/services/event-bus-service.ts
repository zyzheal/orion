/**
 * EventBus 集成服务 (PostgreSQL Repository 版)
 *
 * NATS 消息总线连接管理 + PostgreSQL 持久化
 * - 事件发布记录持久化到 event_bus_events 表
 * - 订阅信息持久化到 event_subscriptions 表
 * - 配置信息持久化到 event_bus_config 表
 *
 * Migrated from in-memory only to PostgreSQL Repository pattern (M24)
 */

import { EventEmitter } from 'events';
import {
  EventBusConfigRepository,
  EventSubscriptionRepository,
  EventBusEventRepository,
} from '../repositories/EventBusRepository';

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

export interface EventBusRepositories {
  configRepo?: EventBusConfigRepository;
  subscriptionRepo?: EventSubscriptionRepository;
  eventRepo?: EventBusEventRepository;
}

export class EventBusService extends EventEmitter {
  private config: EventBusServiceConfig;
  private isConnected: boolean = false;
  private natsConnection: any = null;
  private repos: EventBusRepositories;

  constructor(config: EventBusServiceConfig, repos?: EventBusRepositories) {
    super();
    this.config = {
      enabled: config.enabled !== false,
      autoConnect: config.autoConnect !== false,
      ...config,
    };
    this.repos = repos || {};
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

      // 持久化连接配置
      await this.persistConfig();

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
   * 持久化配置到数据库
   */
  private async persistConfig(): Promise<void> {
    if (!this.repos.configRepo) return;
    try {
      await this.repos.configRepo.upsert(
        'nats_connection',
        { servers: this.config.servers || ['nats://localhost:4222'], enabled: this.config.enabled },
        'NATS connection configuration',
      );
    } catch (err) {
      console.warn('[EventBusService] Failed to persist config:', err);
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
   * 发布事件（同时记录到 PostgreSQL）
   */
  async publish<T = any>(
    type: string,
    data: T,
    options?: {
      source?: string;
      subject?: string;
      headers?: Record<string, string>;
      tenantId?: string;
      publishedBy?: string;
    }
  ): Promise<string> {
    const subject = options?.subject || type.replace(/\./g, '.');
    const source = options?.source || 'orion-platform-service';

    // 先持久化事件记录（即使 NATS 未连接也记录）
    let eventRecord: any = null;
    if (this.repos.eventRepo) {
      try {
        eventRecord = await this.repos.eventRepo.insert({
          tenant_id: options?.tenantId || 'default',
          event_type: type,
          subject,
          source,
          payload: { data },
          status: 'published',
          published_by: options?.publishedBy,
          published_at: new Date(),
        });
      } catch (err) {
        console.warn('[EventBusService] Failed to persist event record:', err);
      }
    }

    if (!this.natsConnection) {
      console.warn('[EventBusService] NATS not connected, event not published:', type);
      throw new Error(`NATS not connected, cannot publish event: ${type}`);
    }

    try {
      const message = JSON.stringify({
        type,
        source,
        data,
        timestamp: new Date().toISOString(),
      });

      const pubAck = await this.natsConnection.publish(subject, new TextEncoder().encode(message));
      const seq = pubAck?.seq?.toString() || type;

      // 更新事件状态为 delivered
      if (eventRecord && this.repos.eventRepo) {
        try {
          await this.repos.eventRepo.updateStatus(eventRecord.id, 'delivered');
        } catch (err) {
          console.warn('[EventBusService] Failed to update event status:', err);
        }
      }

      return seq;
    } catch (error) {
      // 标记为 failed
      if (eventRecord && this.repos.eventRepo) {
        try {
          await this.repos.eventRepo.updateStatus(eventRecord.id, 'failed');
        } catch (err) {
          console.warn('[EventBusService] Failed to update event status:', err);
        }
      }
      console.error('[EventBusService] Failed to publish event:', error);
      throw error;
    }
  }

  /**
   * 订阅事件（同时持久化订阅信息）
   */
  async subscribe<T = any>(
    eventType: string,
    handler: (event: any) => Promise<void>,
    options?: {
      streamName?: string;
      durableName?: string;
      autoAck?: boolean;
      filterSubject?: string;
      tenantId?: string;
    }
  ): Promise<() => Promise<void>> {
    if (!this.natsConnection) {
      console.warn('[EventBusService] NATS not connected, cannot subscribe');
      return async () => {};
    }

    try {
      const subject = options?.filterSubject || eventType;
      const queue = options?.durableName || 'orion-platform-queue';

      // 持久化订阅信息
      let subRecord: any = null;
      if (this.repos.subscriptionRepo) {
        try {
          subRecord = await this.repos.subscriptionRepo.insert({
            tenant_id: options?.tenantId || 'default',
            subject_pattern: eventType,
            handler_name: eventType,
            handler_type: 'nats',
            durable_name: options?.durableName || null,
            queue_group: queue,
            filter_subject: options?.filterSubject || null,
            status: 'active',
            metadata: { streamName: options?.streamName },
          });
        } catch (err) {
          console.warn('[EventBusService] Failed to persist subscription:', err);
        }
      }

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
            // Nak the message so it can be redelivered (with DLQ handling in JetStream)
            if (msg.nak) {
              msg.nak();
            }
          }
        }
      })().catch((err) => {
        console.error('[EventBusService] Subscription error:', err);
      });

      this.emit('subscribe', { eventType, subscriptionId: subject });

      // 返回取消订阅函数
      return async () => {
        await subscription.drain();
        // 更新订阅状态
        if (subRecord && this.repos.subscriptionRepo) {
          try {
            await this.repos.subscriptionRepo.updateStatus(subRecord.id, 'deleted');
          } catch (err) {
            console.warn('[EventBusService] Failed to update subscription status:', err);
          }
        }
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

  /**
   * 获取配置信息（用于状态查询）
   */
  getConfig(): { servers: string[]; enabled: boolean } {
    return {
      servers: this.config.servers || [],
      enabled: this.config.enabled,
    };
  }

  /**
   * 获取持久化的事件历史
   */
  async getEventHistory(options?: { eventType?: string; status?: string; limit?: number }) {
    if (!this.repos.eventRepo) {
      throw new Error('Event repository not available');
    }
    if (options?.eventType) {
      return this.repos.eventRepo.findByType(options.eventType, { limit: options.limit });
    }
    if (options?.status) {
      return this.repos.eventRepo.findByStatus(options.status, { limit: options.limit });
    }
    return this.repos.eventRepo.findAll({ limit: options?.limit || 50 });
  }

  /**
   * 获取活跃的订阅列表
   */
  async getSubscriptions(tenantId?: string) {
    if (!this.repos.subscriptionRepo) {
      throw new Error('Subscription repository not available');
    }
    if (tenantId) {
      return this.repos.subscriptionRepo.findByTenant(tenantId);
    }
    return this.repos.subscriptionRepo.findAll({ limit: 50 });
  }

  /**
   * 获取事件统计
   */
  async getEventStats() {
    if (!this.repos.eventRepo) {
      throw new Error('Event repository not available');
    }
    const [published, delivered, failed, deadLetter] = await Promise.all([
      this.repos.eventRepo.countByStatus('published'),
      this.repos.eventRepo.countByStatus('delivered'),
      this.repos.eventRepo.countByStatus('failed'),
      this.repos.eventRepo.countByStatus('dead_letter'),
    ]);
    return { published, delivered, failed, deadLetter };
  }
}
