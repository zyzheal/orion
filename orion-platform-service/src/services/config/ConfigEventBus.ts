/**
 * Configuration Change Event Bus
 *
 * 配置变更事件总线 - PostgreSQL 持久化 + 内存降级
 */

import { createLogger } from '../utils/logger';
import { ConfigEventRepository } from '../../repositories/ConfigEventRepository';

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

  private dbRepo: ConfigEventRepository | null = null;
  private dbMode: boolean = false;
  private degraded: boolean = false;

  /**
   * 构造器
   * @param options.db 数据库查询池（可选），不提供则纯内存模式
   */
  constructor(options?: { db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> } }) {
    if (options?.db) {
      try {
        this.dbRepo = new ConfigEventRepository(options.db);
        this.dbMode = true;
      } catch (err) {
        logger.warn({ error: String(err) }, 'ConfigEventRepository init failed, falling back to memory-only mode');
        this.dbMode = false;
      }
    }
  }

  /**
   * 初始化（向后兼容：不需要同步 DB 连接，写操作时异步创建表）
   */
  async initialize(): Promise<void> {
    if (this.dbMode && !this.degraded) {
      // 试探性写操作，确认 DB 可用
      try {
        await this.dbRepo!.getHistory(1);
        logger.info('ConfigEventBus initialized with PostgreSQL persistence');
      } catch (err) {
        logger.warn(
          { error: String(err) },
          'ConfigEventBus DB probe failed, gracefully degraded to memory mode',
        );
        this.degraded = true;
      }
    } else {
      logger.info('ConfigEventBus initialized (local mode)');
    }
  }

  /**
   * 发布配置变更事件
   */
  async publish(event: ConfigChangeEvent): Promise<void> {
    // 1. 写入 DB（如果可用且未降级）
    if (this.dbMode && !this.degraded) {
      try {
        await this.dbRepo!.create({
          eventType: event.eventType,
          domain: event.domain,
          key: event.key,
          changedBy: event.changedBy,
          oldValue: event.oldValue ?? null,
          newValue: event.newValue ?? null,
          version: event.version ?? 1,
          tenantId: event.tenantId ?? '00000000-0000-0000-0000-000000000000',
          metadata: event.metadata ?? {},
        });
      } catch (err) {
        logger.error({ error: String(err) }, 'ConfigEventBus DB write failed, degraded to memory');
        this.degraded = true;
      }
    }

    // 2. 内存 ring buffer 同步维护
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // 3. 通知本地 handlers
    await this.notifyLocalHandlers(event);

    logger.debug({ eventType: event.eventType, domain: event.domain }, 'Event published');
  }

  /**
   * 订阅配置变更
   */
  subscribe(
    handler: EventHandler,
    filter?: (event: ConfigChangeEvent) => boolean,
    subscriptionId?: string,
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
  getConnectionStatus(): { connected: boolean; dbMode: boolean; degraded: boolean } {
    return {
      connected: true,
      dbMode: this.dbMode,
      degraded: this.degraded,
    };
  }

  /**
   * 获取事件历史
   */
  async getHistory(limit: number = 50): Promise<ConfigChangeEvent[]> {
    // 优先从 DB 读取，回退到内存
    if (this.dbMode && !this.degraded) {
      try {
        const entities = await this.dbRepo!.getHistory(Math.max(limit, this.maxHistorySize));
        return entities.map(e => this.mapEntityToEvent(e));
      } catch (err) {
        logger.warn({ error: String(err) }, 'ConfigEventBus DB read failed, falling back to memory');
        this.degraded = true;
      }
    }
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
        }),
      );

    await Promise.all(promises);
  }

  private mapEntityToEvent(entity: {
    eventType: string;
    domain: string;
    key: string;
    changedBy: string;
    oldValue?: Record<string, unknown> | null;
    newValue?: Record<string, unknown> | null;
    version: number;
    tenantId: string;
    metadata: Record<string, unknown>;
    createdAt: Date;
  }): ConfigChangeEvent {
    return {
      eventId: entity.createdAt.getTime().toString(),
      eventType: entity.eventType as ConfigChangeEvent['eventType'],
      domain: entity.domain,
      key: entity.key,
      oldValue: entity.oldValue ?? undefined,
      newValue: entity.newValue ?? undefined,
      changedBy: entity.changedBy,
      timestamp: new Date(entity.createdAt).getTime(),
      version: entity.version,
      tenantId: entity.tenantId,
      metadata: entity.metadata,
    };
  }
}

// 单例实例（无 DB 参数，内存模式；实际使用时通过 app.ts 手动传入 db）
export const configEventBus = new ConfigEventBus();

export default configEventBus;