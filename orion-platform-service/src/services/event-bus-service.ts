/**
 * EventBus 集成服务 (PostgreSQL Repository 版)
 *
 * NATS 消息总线连接管理 + PostgreSQL 持久化
 * - 事件发布记录持久化到 event_bus_events 表
 * - 订阅信息持久化到 event_subscriptions 表
 * - 配置信息持久化到 event_bus_config 表
 *
 * Migrated from in-memory only to PostgreSQL Repository pattern (M24)
 * Architecture Review 2026-04: Fixed connection state semantics (ARCH-001)
 */

import { EventEmitter } from 'events';
import pino from 'pino';
import {
  EventBusConfigRepository,
  EventSubscriptionRepository,
  EventBusEventRepository,
} from '../repositories/EventBusRepository';
import { TypedEnvelope, JetStreamConfig, ConsumerConfig } from './types/event-types';
import type { JetStreamClient, JetStreamManager } from 'nats';

/**
 * 连接状态枚举 - 明确区分各种状态
 * ARCH-001: 使用状态枚举而非 boolean，避免语义混乱
 */
export type ConnectionState = 'disabled' | 'connected' | 'disconnected' | 'fallback';

/**
 * EventBus 连接状态详情
 */
export interface ConnectionStatus {
  state: ConnectionState;
  message?: string;
  natsAvailable: boolean;
  reconnectAttempts: number;
  lastError?: string;
}

/**
 * EventBus 错误类型
 */
export class EventBusError extends Error {
  constructor(message: string, public code: string, public recoverable: boolean = true) {
    super(message);
    this.name = 'EventBusError';
  }
}

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

const logger = pino({ name: 'event-bus-service' });

export class EventBusService extends EventEmitter {
  private config: EventBusServiceConfig;
  /** ARCH-001: 使用状态枚举而非 boolean */
  private connectionState: ConnectionState = 'disconnected';
  private natsConnection: any = null;
  private jetStream: JetStreamClient | null = null;
  private jetStreamManager: JetStreamManager | null = null;
  private repos: EventBusRepositories;
  /** 重连尝试次数 */
  private reconnectAttempts: number = 0;
  /** 最后错误信息 */
  private lastError?: string;
  /** 监控指标 */
  private metrics = {
    publishSuccess: 0,
    publishFailed: 0,
    subscribeSuccess: 0,
    subscribeFailed: 0,
    mockCalls: 0,
  };

  constructor(config: EventBusServiceConfig, repos?: EventBusRepositories) {
    super();
    this.config = {
      enabled: config.enabled !== false,
      autoConnect: config.autoConnect !== false,
      ...config,
    };
    this.repos = repos || {};

    // ARCH-001: disabled 配置时立即设置状态
    if (!this.config.enabled) {
      this.connectionState = 'disabled';
    }
  }

  /**
   * ARCH-001: 获取完整连接状态（用于健康检查和监控）
   */
  getConnectionStatus(): ConnectionStatus {
    return {
      state: this.connectionState,
      message: this.getStatusMessage(),
      natsAvailable: this.natsConnection !== null,
      reconnectAttempts: this.reconnectAttempts,
      lastError: this.lastError,
    };
  }

  /**
   * ARCH-001: 状态转可读消息
   */
  private getStatusMessage(): string {
    switch (this.connectionState) {
      case 'disabled': return 'EventBus disabled by config';
      case 'connected': return 'Connected to NATS';
      case 'disconnected': return 'Not connected to NATS';
      case 'fallback': return 'Running in fallback mode (NATS unavailable)';
      default: return 'Unknown state';
    }
  }

  /**
   * 获取监控指标（用于 Prometheus 导出）
   */
  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  /**
   * 重置监控指标
   */
  resetMetrics(): void {
    this.metrics = {
      publishSuccess: 0,
      publishFailed: 0,
      subscribeSuccess: 0,
      subscribeFailed: 0,
      mockCalls: 0,
    };
  }

  /**
   * 注入 repositories（用于在已有实例上添加持久化能力）
   */
  setRepositories(repos: EventBusRepositories): void {
    this.repos = { ...this.repos, ...repos };
  }

  /**
   * 获取 repositories（用于状态检查）
   */
  getRepositories(): EventBusRepositories {
    return this.repos;
  }

  /**
   * 连接事件总线
   * ARCH-001: 明确状态转换，不再混淆 isConnected
   */
  async connect(): Promise<void> {
    if (!this.config.enabled) {
      this.connectionState = 'disabled';
      logger.info('Disabled, skipping connection');
      return;
    }

    logger.info('Connecting to NATS...');
    this.connectionState = 'disconnected';

    try {
      // 动态导入 NATS
      const { connect } = await import('nats').catch(() => ({ connect: null }));

      if (!connect) {
        // ARCH-001: NATS 模块不可用时进入 fallback 状态，而非 isConnected=true
        logger.warn('NATS module not available, entering fallback mode');
        this.connectionState = 'fallback';
        this.lastError = 'NATS module not available';
        this.emit('fallback', { reason: 'module_unavailable' });
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

      // ARCH-001: 连接成功明确设置 connected
      this.connectionState = 'connected';
      this.reconnectAttempts = 0;
      this.lastError = undefined;

      // Initialize JetStream client and manager
      this.jetStream = this.natsConnection.jetstream();
      this.jetStreamManager = this.natsConnection.jetstreamManager();
      logger.info('JetStream initialized');

      this.emit('connect');
      logger.info('Connected to NATS');

      // SRE: 从 fallback 恢复后自动重试 pending 事件
      if (this.repos.eventRepo) {
        this.retryPendingEvents().catch(err => {
          logger.warn({ err: String(err) }, 'Failed to retry pending events after reconnect');
        });
      }

      // 持久化连接配置
      await this.persistConfig();

      // 监听连接状态
      this.natsConnection.closed().then(() => {
        this.connectionState = 'disconnected';
        this.emit('close');
        logger.info('NATS connection closed');
      });
    } catch (error: unknown) {
      // ARCH-001: 连接失败明确设置 disconnected 或 fallback
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.warn({ error: errorMsg }, 'Connection failed');
      this.lastError = errorMsg;
      this.connectionState = 'fallback';
      this.emit('error', error);
      this.emit('fallback', { reason: 'connection_failed', error: errorMsg });
      // 不抛出错误，允许服务在没有事件总线的情况下运行（降级模式）
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
      logger.warn({ err: String(err) }, 'Failed to persist config');
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
      logger.warn('NATS not connected, skipping stream creation');
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

      logger.info({ stream: name }, 'Stream created');
    } catch (error: any) {
      if (error.message?.includes('already in use')) {
        logger.info({ stream: name }, 'Stream already exists');
      } else {
        logger.warn({ error: String(error) }, 'Failed to create stream');
      }
    }
  }

  /**
   * 发布事件（同时记录到 PostgreSQL）
   * ARCH-002: Fallback 模式下事件写入 PostgreSQL，后台 Job 可重试
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
    const subject = options?.subject || type;  // S1 Fix: removed no-op replace(/\./g, '.')
    const source = options?.source || 'orion-platform-service';

    // C3 Fix: Always persist first with 'pending_published', then try NATS.
    // This eliminates the race condition where connection drops between persist and publish.
    // If NATS publish fails, the event remains in 'pending_published' and can be retried.
    let eventRecord: any = null;
    if (this.repos.eventRepo) {
      try {
        eventRecord = await this.repos.eventRepo.insert({
          tenant_id: options?.tenantId || 'default',
          event_type: type,
          subject,
          source,
          payload: { data },
          status: 'pending_published',  // Always start as pending until NATS confirms
          published_by: options?.publishedBy,
          published_at: new Date(),
        });
      } catch (err) {
        logger.warn({ err: String(err) }, 'Failed to persist event record');
      }
    }

    // If not connected, return fallback ID — event is safely persisted for retry
    if (this.connectionState !== 'connected' || !this.natsConnection) {
      logger.warn({ type }, 'NATS not connected, event persisted for retry');
      this.metrics.publishFailed++;

      if (eventRecord) {
        this.emit('fallback_publish', { eventId: eventRecord.id, type, subject });
        return `fallback:${eventRecord.id}`;
      }

      throw new EventBusError(
        `NATS not connected (state: ${this.connectionState}), cannot publish event: ${type}`,
        'NOT_CONNECTED',
        true
      );
    }

    try {
      const message = JSON.stringify({
        type,
        source,
        data,
        timestamp: new Date().toISOString(),
      });

      if (this.isJetStreamAvailable()) {
        const payload = new TextEncoder().encode(JSON.stringify({ type, source, data, timestamp: new Date().toISOString() }));
        const ack = await this.jetStream!.publish(subject, payload);
        if (eventRecord && this.repos.eventRepo) {
          try { await this.repos.eventRepo.updateStatus(eventRecord.id, 'delivered'); } catch (err) { logger.warn({ err: String(err) }, 'Failed to update event status after JetStream ack'); }
        }
        this.metrics.publishSuccess++;
        return eventRecord?.id || type;
      } else {
        await this.natsConnection.publish(subject, new TextEncoder().encode(message));
        if (eventRecord && this.repos.eventRepo) {
          try { await this.repos.eventRepo.updateStatus(eventRecord.id, 'delivered'); } catch (err) { logger.warn({ err: String(err) }, 'Failed to update event status'); }
        }
        this.metrics.publishSuccess++;
        return eventRecord?.id || type;
      }
    } catch (error) {
      // NATS publish failed — event stays as 'pending_published' for retry
      // Update to 'failed' only for non-recoverable errors
      if (eventRecord && this.repos.eventRepo) {
        try {
          const isRecoverable = this.connectionState === 'connected';
          if (!isRecoverable) {
            await this.repos.eventRepo.updateStatus(eventRecord.id, 'failed');
          }
          // Otherwise leave as 'pending_published' for automatic retry on reconnect
        } catch (err) {
          logger.warn({ err: String(err) }, 'Failed to update event status');
        }
      }
      this.metrics.publishFailed++;
      logger.error({ error: String(error) }, 'Failed to publish event');
      throw error;
    }
  }

  /**
   * 订阅事件（同时持久化订阅信息）
   * ARCH-003: 订阅失败明确上报，不再静默返回空函数
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
    // ARCH-003: Fallback 模式下抛出明确错误，而非静默返回空函数
    if (this.connectionState === 'disabled') {
      throw new EventBusError(
        'EventBus disabled, cannot subscribe',
        'DISABLED',
        false  // 不可恢复
      );
    }

    if (this.connectionState === 'fallback' || !this.natsConnection) {
      // ARCH-003: Fallback 模式下抛出可恢复错误，调用方可选择降级策略
      throw new EventBusError(
        `NATS not connected (state: ${this.connectionState}), cannot subscribe to ${eventType}`,
        'NOT_CONNECTED',
        true  // 可恢复，等待重连
      );
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
            durable_name: options?.durableName,
            queue_group: queue,
            filter_subject: options?.filterSubject,
            status: 'active',
            metadata: { streamName: options?.streamName },
          });
        } catch (err) {
          logger.warn({ err: String(err) }, 'Failed to persist subscription');
        }
      }

      // JetStream path: use consumers.get + fetch when streamName and durableName provided
      if (options?.streamName && options?.durableName && this.isJetStreamAvailable()) {
        const consumer = await this.jetStream!.consumers.get(options.streamName, options.durableName);

        // Start message processing in background
        (async () => {
          try {
            const messages = await consumer.fetch({ max_messages: 100 });
            for await (const msg of messages as AsyncIterable<any>) {
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
                logger.error({ error: String(error) }, 'Error handling message');
                if (msg.nak) {
                  msg.nak();
                }
              }
            }
          } catch (err) {
            logger.error({ err: String(err) }, 'JetStream subscription error');
            this.metrics.subscribeFailed++;
          }
        })();

        this.metrics.subscribeSuccess++;
        this.emit('subscribe', { eventType, subscriptionId: `${options.streamName}:${options.durableName}` });

        return async () => {
          // Update subscription status
          if (subRecord && this.repos.subscriptionRepo) {
            try {
              await this.repos.subscriptionRepo.updateStatus(subRecord.id, 'deleted');
            } catch (err) {
              logger.warn({ err: String(err) }, 'Failed to update subscription status');
            }
          }
        };
      }

      // Core NATS path (fallback)
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
            logger.error({ error: String(error) }, 'Error handling message');
            // Nak the message so it can be redelivered (with DLQ handling in JetStream)
            if (msg.nak) {
              msg.nak();
            }
          }
        }
      })().catch((err) => {
        logger.error({ err: String(err) }, 'Subscription error');
        this.metrics.subscribeFailed++;
      });

      this.metrics.subscribeSuccess++;
      this.emit('subscribe', { eventType, subscriptionId: subject });

      // 返回取消订阅函数
      return async () => {
        await subscription.drain();
        // 更新订阅状态
        if (subRecord && this.repos.subscriptionRepo) {
          try {
            await this.repos.subscriptionRepo.updateStatus(subRecord.id, 'deleted');
          } catch (err) {
            logger.warn({ err: String(err) }, 'Failed to update subscription status');
          }
        }
      };
    } catch (error: unknown) {
      this.metrics.subscribeFailed++;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      // ARCH-003: 记录错误而非静默返回空函数
      logger.warn({ eventType, error: errorMsg }, 'Failed to subscribe');
      this.emit('subscribe_failed', { eventType, error: errorMsg });
      throw new EventBusError(
        `Failed to subscribe to ${eventType}: ${errorMsg}`,
        'SUBSCRIBE_FAILED',
        true
      );
    }
  }

  /**
   * 检查连接健康
   * ARCH-001: 使用 connectionState 而非 isConnected
   * 兼容原有 HealthChecker 接口 (status: 'up' | 'down')
   */
  async checkHealth(): Promise<{ status: 'up' | 'down'; message?: string; state?: ConnectionState; latency?: number }> {
    if (this.connectionState === 'disabled') {
      return { status: 'up', message: 'EventBus disabled', state: 'disabled' };
    }

    if (this.connectionState === 'fallback') {
      // ARCH-001: Fallback 模式下返回 'up' (服务可用但降级)
      return { status: 'up', message: 'Running in fallback mode (NATS unavailable)', state: 'fallback' };
    }

    if (!this.natsConnection) {
      return { status: 'down', message: 'Not connected', state: 'disconnected' };
    }

    if (this.natsConnection.isClosed()) {
      return { status: 'down', message: 'Connection closed', state: 'disconnected' };
    }

    return { status: 'up', message: 'Connected to NATS', state: 'connected' };
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    this.jetStream = null;
    this.jetStreamManager = null;
    if (this.natsConnection) {
      logger.info('Closing NATS connection...');
      try {
        await this.natsConnection.drain();
        await this.natsConnection.close();
      } catch (error) {
        logger.warn({ error: String(error) }, 'Error closing NATS');
      }
      this.natsConnection = null;
      this.connectionState = 'disconnected';
      this.emit('close');
    }
  }

  /**
   * 检查服务状态
   * ARCH-001: connected 和 fallback 都返回 true（降级模式仍可服务）
   */
  isHealthy(): boolean {
    if (this.connectionState === 'disabled') {
      return true;
    }
    return this.connectionState === 'connected' || this.connectionState === 'fallback';
  }

  /**
   * 检查是否为连接状态（仅 NATS 真正连接）
   * ARCH-001: 区分 "健康" 和 "已连接"
   */
  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  /**
   * 检查是否为 fallback 模式
   */
  isFallback(): boolean {
    return this.connectionState === 'fallback';
  }

  /**
   * 获取配置信息（用于状态查询）
   */
  getConfig(): { servers: string[]; enabled: boolean } {
    return {
      servers: this.config.servers || [],
      enabled: this.config.enabled !== false,
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
    const [published, pendingFallback, delivered, failed, deadLetter] = await Promise.all([
      this.repos.eventRepo.countByStatus('published'),
      this.repos.eventRepo.countByStatus('pending_fallback'),
      this.repos.eventRepo.countByStatus('delivered'),
      this.repos.eventRepo.countByStatus('failed'),
      this.repos.eventRepo.countByStatus('dead_letter'),
    ]);
    return { published, pendingFallback, delivered, failed, deadLetter };
  }

  /**
   * 重试 pending_fallback 事件
   * 当 NATS 从 fallback 恢复为 connected 时调用
   *
   * SRE: 确保 fallback 期间积累的事件不会丢失
   * I3 Fix: Adds exponential backoff delay between retries
   * I4 Fix: Uses returned entity from incrementRetryCount for accurate count
   */
  async retryPendingEvents(options?: {
    limit?: number;
    maxRetryCount?: number;
    onProgress?: (eventId: string, success: boolean) => void;
  }): Promise<{ retried: number; succeeded: number; failed: number }> {
    if (!this.repos.eventRepo) {
      throw new Error('Event repository not available');
    }
    if (this.connectionState !== 'connected' || !this.natsConnection) {
      throw new EventBusError('NATS not connected, cannot retry events', 'NOT_CONNECTED', true);
    }

    const limit = options?.limit ?? 100;
    const maxRetryCount = options?.maxRetryCount ?? 3;

    const pendingEvents = await this.repos.eventRepo.findPendingFallbackEvents(limit, maxRetryCount);
    if (pendingEvents.length === 0) {
      return { retried: 0, succeeded: 0, failed: 0 };
    }

    logger.info({ count: pendingEvents.length }, 'Retrying pending fallback events');

    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < pendingEvents.length; i++) {
      const event = pendingEvents[i];

      // I3 Fix: Exponential backoff between retries (100ms, 200ms, 400ms, ...)
      if (i > 0) {
        const delayMs = Math.min(100 * Math.pow(2, i - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      try {
        const message = JSON.stringify({
          type: event.eventType,
          source: event.source,
          data: event.payload.data,
          timestamp: new Date().toISOString(),
        });

        await this.natsConnection.publish(event.subject, new TextEncoder().encode(message));

        // I4 Fix: Get the updated entity to know the actual retry count
        const updatedEvent = await this.repos.eventRepo.incrementRetryCount(event.id);
        await this.repos.eventRepo.updateStatus(event.id, 'delivered');

        succeeded++;
        options?.onProgress?.(event.id, true);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        logger.warn({ eventId: event.id, error: errorMsg }, 'Retry failed for event');

        // I4 Fix: Use returned entity for accurate retry count
        const updatedEvent = await this.repos.eventRepo.incrementRetryCount(event.id);
        const actualRetryCount = updatedEvent?.retryCount ?? 1;

        // If max retries exceeded, mark as dead_letter
        if (actualRetryCount >= maxRetryCount) {
          await this.repos.eventRepo.updateStatus(event.id, 'dead_letter');
        }

        failed++;
        options?.onProgress?.(event.id, false);
      }
    }

    logger.info(
      { succeeded, failed, total: pendingEvents.length },
      'Retry complete'
    );
    return { retried: pendingEvents.length, succeeded, failed };
  }

  // ============================================================
  // JetStream Methods (Task 2: JetStream Upgrade)
  // ============================================================

  isJetStreamAvailable(): boolean {
    return this.jetStream !== null && this.connectionState === 'connected';
  }

  getJetStreamClient(): JetStreamClient | null {
    return this.jetStream;
  }

  getJetStreamManager(): JetStreamManager | null {
    return this.jetStreamManager;
  }

  async ensureStream(config: JetStreamConfig): Promise<void> {
    if (!this.jetStreamManager) return;
    const jsmService = new (await import('./jetstream-manager')).JetStreamManagerService(this.jetStreamManager);
    await jsmService.ensureStream({
      name: config.name, subjects: config.subjects, retention: config.retention,
      maxMsgs: config.maxMsgs, maxAge: config.maxAge, storage: config.storage, replicas: config.replicas,
    });
  }

  async ensureConsumer(streamName: string, config: ConsumerConfig): Promise<void> {
    if (!this.jetStreamManager) return;
    const jsmService = new (await import('./jetstream-manager')).JetStreamManagerService(this.jetStreamManager);
    await jsmService.ensureConsumer(streamName, config);
  }

  async getJetStreamMetrics(streamName?: string): Promise<Record<string, unknown>> {
    if (!this.jetStreamManager) return { available: false };
    const jsmService = new (await import('./jetstream-manager')).JetStreamManagerService(this.jetStreamManager);
    if (streamName) {
      const metrics = await jsmService.getMetrics(streamName);
      return { available: true, stream: streamName, ...metrics };
    }
    const { ORION_STREAMS } = await import('./types/event-types');
    const results: Record<string, unknown> = { available: true };
    for (const [key, stream] of Object.entries(ORION_STREAMS)) {
      try { results[key] = await jsmService.getMetrics(stream.name); } catch { results[key] = { error: 'stream not found' }; }
    }
    return results;
  }

  async listConsumers(streamName: string): Promise<Array<{ name: string; pending: number }>> {
    if (!this.jetStreamManager) return [];
    const jsmService = new (await import('./jetstream-manager')).JetStreamManagerService(this.jetStreamManager);
    return jsmService.listConsumers(streamName);
  }
}
