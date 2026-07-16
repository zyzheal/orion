/**
 * EventBusAdapter - 统一事件发布接口适配器
 *
 * ARCH-010: 消除 EventPublisher 中的接口适配重复代码
 *
 * 功能:
 * 1. 统一 EventBus 和 EventBusService 两种接口
 * 2. 自动适配 publish 方法签名
 * 3. 提供标准化的 CloudEvents 格式
 * 4. 支持事件持久化和 fallback 模式
 */

import { EventBusService } from '../services/event-bus-service';
import { createLogger } from '../utils/logger';

const logger = createLogger('LEvent-LBus-LAdapter');

/**
 * CloudEvents 1.0 标准格式
 */
export interface CloudEvent {
  id: string;
  source: string;
  specversion: string;
  type: string;
  datacontenttype?: string;
  data: Record<string, unknown>;
  time: string;
  // 扩展属性
  tenantid?: string;
  userid?: string;
  traceid?: string;
  correlationid?: string;
}

/**
 * 发布选项
 */
export interface PublishOptions {
  /** 事件源 (默认 'orion-platform-service') */
  source?: string;
  /** 租户 ID */
  tenantId?: string;
  /** 用户 ID */
  userId?: string;
  /** 追踪 ID */
  traceId?: string;
  /** 关联 ID */
  correlationId?: string;
  /** 优先级 */
  priority?: 'low' | 'normal' | 'high' | 'critical';
  /** 事件版本 */
  version?: string;
}

/**
 * EventBusAdapter 配置
 */
export interface EventBusAdapterConfig {
  /** EventBusService 实例 */
  eventBus?: EventBusService | null;
  /** 默认事件源 */
  defaultSource?: string;
  /** 默认租户 ID */
  defaultTenantId?: string;
  /** 默认用户 ID */
  defaultUserId?: string;
}

/**
 * 事件发布结果
 */
export interface PublishResult {
  success: boolean;
  eventId?: string;
  fallback?: boolean;
  /** JetStream delivery mode */
  deliveryMode?: 'jetstream' | 'fallback' | 'disabled';
  /** JetStream ack sequence number */
  jetStreamSeq?: number;
  error?: string;
}

/**
 * EventBusAdapter - 统一事件发布接口
 */
export class EventBusAdapter {
  private eventBus: EventBusService | null;
  private defaultSource: string;
  private defaultTenantId?: string;
  private defaultUserId?: string;

  constructor(config: EventBusAdapterConfig = {}) {
    this.eventBus = config.eventBus ?? null;
    this.defaultSource = config.defaultSource ?? 'orion-platform-service';
    this.defaultTenantId = config.defaultTenantId;
    this.defaultUserId = config.defaultUserId;
  }

  /**
   * 设置 EventBus 实例 (用于延迟注入)
   */
  setEventBus(eventBus: EventBusService): void {
    this.eventBus = eventBus;
  }

  /**
   * 发布事件 - 统一接口
   *
   * ARCH-010: 消除 publish.length 检查的重复代码
   */
  async publish(
    type: string,
    data: Record<string, unknown>,
    options: PublishOptions = {},
  ): Promise<PublishResult> {
    if (!this.eventBus) {
      logger.warn(`[EventBusAdapter] EventBus not available, event ${type} not published`);
      return {
        success: false,
        error: 'EventBus not available',
        deliveryMode: 'disabled',
      };
    }

    const event = this.createCloudEvent(type, data, options);

    try {
      // 检查 JetStream 是否可用以确定投递模式
      const isJetStream = this.eventBus.isJetStreamAvailable?.() ?? false;

      // ARCH-010: 直接使用 EventBusService 的 publish 方法
      // EventBusService 已统一接口: publish(type, data, options)
      const eventId = await this.eventBus.publish(type, event.data, {
        source: event.source,
        tenantId: event.tenantid,
        publishedBy: event.userid,
        traceId: event.traceid,
      });

      // 检查是否为 fallback 发布
      const isFallback = eventId.startsWith('fallback:');

      return {
        success: true,
        eventId,
        fallback: isFallback,
        deliveryMode: isJetStream ? 'jetstream' : (isFallback ? 'fallback' : 'disabled'),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[EventBusAdapter] Failed to publish ${type}:`, errorMsg);
      return {
        success: false,
        error: errorMsg,
        deliveryMode: 'disabled',
      };
    }
  }

  /**
   * 批量发布事件
   */
  async publishBatch(
    events: Array<{ type: string; data: Record<string, unknown>; options?: PublishOptions }>,
  ): Promise<PublishResult[]> {
    const results: PublishResult[] = [];

    for (const event of events) {
      const result = await this.publish(event.type, event.data, event.options ?? {});
      results.push(result);
    }

    return results;
  }

  /**
   * 创建 CloudEvent 格式事件
   */
  private createCloudEvent(
    type: string,
    data: Record<string, unknown>,
    options: PublishOptions,
  ): CloudEvent {
    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    return {
      id,
      source: options.source ?? this.defaultSource,
      specversion: '1.0',
      type,
      datacontenttype: 'application/json',
      data,
      time: new Date().toISOString(),
      tenantid: options.tenantId ?? this.defaultTenantId,
      userid: options.userId ?? this.defaultUserId,
      traceid: options.traceId ?? id,
      correlationid: options.correlationId,
    };
  }

  /**
   * 检查 EventBus 是否可用
   */
  isAvailable(): boolean {
    return this.eventBus !== null;
  }

  /**
   * 获取 EventBus 连接状态
   */
  getConnectionState(): string {
    if (!this.eventBus) return 'unavailable';
    return this.eventBus.getConnectionStatus().state;
  }
}

/**
 * 创建全局 EventBusAdapter 实例
 */
export function createEventBusAdapter(config: EventBusAdapterConfig = {}): EventBusAdapter {
  return new EventBusAdapter(config);
}