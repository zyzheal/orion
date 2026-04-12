/**
 * Config Event Publisher - 发布配置相关事件
 *
 * 使用 @orion/event-bus SDK，符合 CloudEvents 1.0 规范
 */

import {
  ConfigEventType,
  DriftType,
  DriftSeverity,
  ConfigDriftDetectedEventData,
  ConfigDriftResolvedEventData,
  ConfigChangeAppliedEventData,
  ConfigChangeRejectedEventData,
  ConfigEventExtensions,
} from './types/config';

/**
 * 事件发布器配置
 */
export interface ConfigEventPublisherConfig {
  /** 事件总线实例 */
  eventBus?: {
    publish?: (subject: string, data: any, options?: any) => Promise<any>;
    isHealthy?: () => boolean;
    [key: string]: any;
  } | null;
  /** 事件源标识 */
  source?: string;
  /** 默认租户 ID */
  defaultTenantId?: string;
  /** 默认用户 ID */
  defaultUserId?: string;
}

/**
 * Config 事件发布器
 *
 * 负责将配置漂移相关事件发布到 NATS JetStream 事件总线
 */
export class ConfigEventPublisher {
  private eventBus: any | null;
  private source: string;
  private defaultTenantId?: string;
  private defaultUserId?: string;

  constructor(config?: ConfigEventPublisherConfig) {
    this.eventBus = config?.eventBus || null;
    this.source = config?.source || 'orion-platform-service';
    this.defaultTenantId = config?.defaultTenantId;
    this.defaultUserId = config?.defaultUserId;
  }

  /**
   * 设置事件总线
   */
  setEventBus(eventBus: any): void {
    this.eventBus = eventBus;
  }

  /**
   * 获取事件总线
   */
  getEventBus(): any {
    return this.eventBus;
  }

  /**
   * 发布 config.drift.detected 事件
   */
  async publishDriftDetected(
    data: {
      configId: string;
      configName?: string;
      resourceType: string;
      resourceId?: string;
      expected: Record<string, unknown>;
      actual: Record<string, unknown>;
      driftType: DriftType;
      severity?: DriftSeverity;
      diff?: Record<string, { expected: unknown; actual: unknown }>;
    },
    extensions?: ConfigEventExtensions
  ): Promise<void> {
    await this.publish<ConfigDriftDetectedEventData>('config.drift.detected', {
      ...data,
      timestamp: new Date().toISOString(),
    }, extensions);
  }

  /**
   * 发布 config.drift.resolved 事件
   */
  async publishDriftResolved(
    data: {
      configId: string;
      configName?: string;
      resourceType: string;
      resolution: 'reconciled' | 'ignored' | 'manual';
      resolvedBy?: string;
    },
    extensions?: ConfigEventExtensions
  ): Promise<void> {
    await this.publish<ConfigDriftResolvedEventData>('config.drift.resolved', {
      ...data,
      timestamp: new Date().toISOString(),
    }, extensions);
  }

  /**
   * 发布 config.change.applied 事件
   */
  async publishChangeApplied(
    data: {
      configId: string;
      configName?: string;
      changeType: 'create' | 'update' | 'delete';
      changedBy?: string;
      changes?: Record<string, unknown>;
    },
    extensions?: ConfigEventExtensions
  ): Promise<void> {
    await this.publish<ConfigChangeAppliedEventData>('config.change.applied', {
      ...data,
      timestamp: new Date().toISOString(),
    }, extensions);
  }

  /**
   * 发布 config.change.rejected 事件
   */
  async publishChangeRejected(
    data: {
      configId: string;
      configName?: string;
      reason: string;
      validationErrors?: string[];
    },
    extensions?: ConfigEventExtensions
  ): Promise<void> {
    await this.publish<ConfigChangeRejectedEventData>('config.change.rejected', {
      ...data,
      timestamp: new Date().toISOString(),
    }, extensions);
  }

  /**
   * 发布通用 Config 事件
   *
   * @param type 事件类型
   * @param data 事件数据
   * @param extensions 扩展属性（租户/用户/追踪上下文）
   */
  async publish<T extends ConfigDriftDetectedEventData | ConfigDriftResolvedEventData | ConfigChangeAppliedEventData | ConfigChangeRejectedEventData>(
    type: ConfigEventType,
    data: T,
    extensions?: ConfigEventExtensions
  ): Promise<void> {
    if (!this.eventBus) {
      console.log(`[ConfigEventPublisher] Event Bus not connected, skipping event: ${type}`);
      return;
    }

    try {
      // 构建扩展属性，合并默认值
      const eventExtensions: ConfigEventExtensions = {
        tenantId: extensions?.tenantId || this.defaultTenantId || 'default-tenant',
        userId: extensions?.userId || this.defaultUserId || 'system',
        traceId: extensions?.traceId || this.generateTraceId(),
        version: extensions?.version || 'v1',
        priority: extensions?.priority || 'normal',
      };

      // 构建符合 CloudEvents 1.0 规范的事件
      const event = {
        specversion: '1.0',
        id: this.generateEventId(),
        type,
        source: this.source,
        time: new Date().toISOString(),
        data,
        ...eventExtensions,
      };

      // 发布事件 - 支持 EventBus 和 EventBusService 两种接口
      if (typeof this.eventBus.publish === 'function') {
        // 检查是否是 EventBus 实例（有 publish(event) 方法）
        if (this.eventBus.publish.length === 1) {
          await this.eventBus.publish(event);
        } else {
          // EventBusService 接口：publish(subject, data)
          await this.eventBus.publish(type, data, { extensions: eventExtensions });
        }
      }

      console.log(`[ConfigEventPublisher] Published event: ${type}`, {
        id: event.id,
        configId: (data as any).configId,
      });
    } catch (error) {
      console.error(`[ConfigEventPublisher] Failed to publish event ${type}:`, error);
      throw error;
    }
  }

  /**
   * 生成追踪 ID
   */
  private generateTraceId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    return `trace-${timestamp}-${random}`;
  }

  /**
   * 生成事件 ID
   */
  private generateEventId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    return `${timestamp}-${random}`;
  }
}

// 导出单例
export const configEventPublisher = new ConfigEventPublisher();