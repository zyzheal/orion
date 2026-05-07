/**
 * Configuration Change Event Bus
 * 
 * 配置变更事件总线 - 本地事件通知实现
 */

import pino from 'pino';

const logger = pino({ name: 'ConfigEventBus' });

// ==================== 事件类型 ====================

export interface ConfigChangeEvent {
  eventId: string;
  eventType: 'config.created' | 'config.updated' | 'config.deleted' | 'config.snapshot' | 'config.rollback';
  domain: string;
  key: string;
  oldValue?: any;
  newValue?: any;
  changedBy: string;
  timestamp: number;
  version?: number;
  tenantId?: string;
  metadata?: Record<string, any>;
}

export interface ConfigHealthEvent {
  eventType: 'health.check' | 'health.stale' | 'health.error';
  serviceId: string;
  timestamp: number;
  details: Record<string, any>;
}

// ==================== 事件订阅 ====================

export type EventHandler = (event: ConfigChangeEvent | ConfigHealthEvent) => Promise<void>;

interface Subscription {
  id: string;
  handler: EventHandler;
  filter: (event: ConfigChangeEvent) => boolean;
  createdAt: Date;
}

// ==================== 事件总线 ====================

export class ConfigEventBus {
  private localHandlers: Subscription[] = [];
  private eventHistory: ConfigChangeEvent[] = [];
  private maxHistorySize: number = 100;

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    logger.info('ConfigEventBus initialized (local mode)');
  }

  /**
   * 发布配置变更事件
   */
  async publish(event: ConfigChangeEvent): Promise<void> {
    // 记录历史
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
    
    // 本地 handlers 处理
    await this.notifyLocalHandlers(event);
    
    logger.debug({ eventType: event.eventType, domain: event.domain }, 'Event published');
  }

  /**
   * 订阅配置变更
   */
  subscribe(
    handler: EventHandler,
    filter?: (event: ConfigChangeEvent) => boolean,
    subscriptionId?: string
  ): string {
    const id = subscriptionId || `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const subscription: Subscription = {
      id,
      handler,
      filter: filter || (() => true),
      createdAt: new Date(),
    };

    this.localHandlers.push(subscription);
    logger.info({ subscriptionId: id }, 'Subscription added');

    return id;
  }

  /**
   * 取消订阅
   */
  unsubscribe(subscriptionId: string): boolean {
    const index = this.localHandlers.findIndex(s => s.id === subscriptionId);
    if (index !== -1) {
      this.localHandlers.splice(index, 1);
      logger.info({ subscriptionId }, 'Subscription removed');
      return true;
    }
    return false;
  }

  /**
   * 发布健康检查事件
   */
  async publishHealthCheck(event: ConfigHealthEvent): Promise<void> {
    logger.debug({ eventType: event.eventType }, 'Health check event published');
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus(): { connected: boolean } {
    return { connected: true };
  }

  /**
   * 获取事件历史
   */
  getHistory(limit: number = 50): ConfigChangeEvent[] {
    return this.eventHistory.slice(-limit);
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    this.localHandlers = [];
    this.eventHistory = [];
    logger.info('ConfigEventBus closed');
  }

  // ==================== 私有方法 ====================

  private async notifyLocalHandlers(event: ConfigChangeEvent): Promise<void> {
    const promises = this.localHandlers
      .filter(sub => sub.filter(event))
      .map(sub => 
        Promise.resolve(sub.handler(event)).catch(error => {
          logger.error({ error, subscriptionId: sub.id }, 'Handler error');
        })
      );
    
    await Promise.all(promises);
  }
}

// 单例实例
export const configEventBus = new ConfigEventBus();

export default configEventBus;