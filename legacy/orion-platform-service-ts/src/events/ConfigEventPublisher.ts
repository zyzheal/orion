/**
 * Config Event Publisher - 发布配置相关事件
 *
 * 使用 EventBusAdapter 统一接口，符合 CloudEvents 1.0 规范
 * ARCH-010: 重构使用 EventBusAdapter 消除接口适配冗余
 */

import { EventBusAdapter, PublishOptions, PublishResult } from './EventBusAdapter';
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
import { EventBusService } from '../services/event-bus-service';

/**
 * 事件发布器配置
 */
export interface ConfigEventPublisherConfig {
  /** EventBusService 实例 (ARCH-010: 统一使用 EventBusService 类型) */
  eventBus?: EventBusService | null;
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
 * ARCH-010: 使用 EventBusAdapter 统一接口
 * 负责将配置漂移相关事件发布到 NATS JetStream 事件总线
 */
export class ConfigEventPublisher {
  private adapter: EventBusAdapter;
  private source: string;
  private defaultTenantId?: string;
  private defaultUserId?: string;

  constructor(config?: ConfigEventPublisherConfig) {
    this.source = config?.source || 'config-service';
    this.defaultTenantId = config?.defaultTenantId;
    this.defaultUserId = config?.defaultUserId;
    this.adapter = new EventBusAdapter({
      eventBus: config?.eventBus,
      defaultSource: this.source,
      defaultTenantId: this.defaultTenantId,
      defaultUserId: this.defaultUserId,
    });
  }

  /**
   * 设置事件总线
   * ARCH-010: 通过 Adapter 设置
   */
  setEventBus(eventBus: EventBusService): void {
    this.adapter.setEventBus(eventBus);
  }

  /**
   * 获取 Adapter (用于检查连接状态)
   */
  getAdapter(): EventBusAdapter {
    return this.adapter;
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
  ): Promise<PublishResult> {
    return this.adapter.publish('config.drift.detected', {
      ...data,
      timestamp: new Date().toISOString(),
    }, this.toPublishOptions(extensions));
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
  ): Promise<PublishResult> {
    return this.adapter.publish('config.drift.resolved', {
      ...data,
      timestamp: new Date().toISOString(),
    }, this.toPublishOptions(extensions));
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
  ): Promise<PublishResult> {
    return this.adapter.publish('config.change.applied', {
      ...data,
      timestamp: new Date().toISOString(),
    }, this.toPublishOptions(extensions));
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
  ): Promise<PublishResult> {
    return this.adapter.publish('config.change.rejected', {
      ...data,
      timestamp: new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 转换 ConfigEventExtensions 为 PublishOptions
   */
  private toPublishOptions(extensions?: ConfigEventExtensions): PublishOptions {
    return {
      source: this.source,
      tenantId: extensions?.tenantId || this.defaultTenantId,
      userId: extensions?.userId || this.defaultUserId,
      traceId: extensions?.traceId,
      priority: extensions?.priority,
      version: extensions?.version,
    };
  }

  /**
   * 检查连接是否可用
   */
  isAvailable(): boolean {
    return this.adapter.isAvailable();
  }

  /**
   * 获取连接状态
   */
  getConnectionState(): string {
    return this.adapter.getConnectionState();
  }
}

// 导出单例
export const configEventPublisher = new ConfigEventPublisher();
