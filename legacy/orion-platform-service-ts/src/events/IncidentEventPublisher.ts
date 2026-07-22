/**
 * Incident Event Publisher - 发布事故相关事件
 *
 * 使用 EventBusAdapter 统一接口，符合 CloudEvents 1.0 规范
 * ARCH-010: 重构使用 EventBusAdapter 消除接口适配冗余
 */

import { EventBusAdapter, PublishOptions, PublishResult } from './EventBusAdapter';
import {
  IncidentEventType,
  IncidentSeverity,
  IncidentType,
  IncidentDetectedEventData,
  IncidentAcknowledgedEventData,
  IncidentResolvedEventData,
  IncidentEscalatedEventData,
  IncidentEventExtensions,
} from './types/incident';
import { EventBusService } from '../services/event-bus-service';

/**
 * 事件发布器配置
 */
export interface IncidentEventPublisherConfig {
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
 * Incident 事件发布器
 *
 * ARCH-010: 使用 EventBusAdapter 统一接口
 * 负责将事故检测相关事件发布到 NATS JetStream 事件总线
 */
export class IncidentEventPublisher {
  private adapter: EventBusAdapter;
  private source: string;
  private defaultTenantId?: string;
  private defaultUserId?: string;

  constructor(config?: IncidentEventPublisherConfig) {
    this.source = config?.source || 'incident-service';
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
   * 发布 incident.detected 事件
   */
  async publishIncidentDetected(
    data: {
      incidentId: string;
      service: string;
      severity: IncidentSeverity;
      type: IncidentType;
      title?: string;
      description?: string;
      impact?: string;
      alertIds?: string[];
      rootCause?: string;
    },
    extensions?: IncidentEventExtensions
  ): Promise<PublishResult> {
    return this.adapter.publish('incident.detected', {
      ...data,
      timestamp: new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 发布 incident.acknowledged 事件
   */
  async publishIncidentAcknowledged(
    data: {
      incidentId: string;
      service: string;
      acknowledgedBy: string;
      acknowledgedAt?: string;
    },
    extensions?: IncidentEventExtensions
  ): Promise<PublishResult> {
    return this.adapter.publish('incident.acknowledged', {
      ...data,
      timestamp: new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 发布 incident.resolved 事件
   */
  async publishIncidentResolved(
    data: {
      incidentId: string;
      service: string;
      resolvedBy: string;
      resolution?: string;
      durationMs?: number;
    },
    extensions?: IncidentEventExtensions
  ): Promise<PublishResult> {
    return this.adapter.publish('incident.resolved', {
      ...data,
      timestamp: new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 发布 incident.escalated 事件
   */
  async publishIncidentEscalated(
    data: {
      incidentId: string;
      service: string;
      escalationLevel: number;
      reason?: string;
      escalatedTo?: string;
    },
    extensions?: IncidentEventExtensions
  ): Promise<PublishResult> {
    return this.adapter.publish('incident.escalated', {
      ...data,
      timestamp: new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 转换 IncidentEventExtensions 为 PublishOptions
   */
  private toPublishOptions(extensions?: IncidentEventExtensions): PublishOptions {
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
export const incidentEventPublisher = new IncidentEventPublisher();
