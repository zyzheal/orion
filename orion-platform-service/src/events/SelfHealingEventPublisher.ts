/**
 * Self-Healing Event Publisher - 发布自愈相关事件
 *
 * 使用 EventBusAdapter 统一接口，符合 CloudEvents 1.0 规范
 * ARCH-010: 重构使用 EventBusAdapter 消除接口适配冗余
 */

import { EventBusAdapter, PublishOptions, PublishResult } from './EventBusAdapter';
import { EventBusService } from '../services/event-bus-service';
import {
  SelfHealingEventType,
  SelfHealingSeverity,
  SelfHealingActionType,
  SelfHealingIncidentType,
  SelfHealingIncidentDetectedEventData,
  SelfHealingStartedEventData,
  SelfHealingActionExecutedEventData,
  SelfHealingCompletedEventData,
  SelfHealingFailedEventData,
  SelfHealingApprovalRequestedEventData,
  SelfHealingApprovalRespondedEventData,
  SelfHealingIncidentEscalatedEventData,
  SelfHealingEventExtensions,
} from './types/selfhealing';

/**
 * 事件发布器配置
 */
export interface SelfHealingEventPublisherConfig {
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
 * Self-Healing 事件发布器
 *
 * ARCH-010: 使用 EventBusAdapter 统一接口
 * 负责将自愈相关事件发布到 NATS JetStream 事件总线
 */
export class SelfHealingEventPublisher {
  private adapter: EventBusAdapter;
  private source: string;
  private defaultTenantId?: string;
  private defaultUserId?: string;

  constructor(config?: SelfHealingEventPublisherConfig) {
    this.source = config?.source || 'self-healing-service';
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
   * 发布 self-healing.incident_detected 事件
   */
  async publishIncidentDetected(
    data: SelfHealingIncidentDetectedEventData,
    extensions?: SelfHealingEventExtensions
  ): Promise<PublishResult> {
    return this.adapter.publish('self-healing.incident_detected', {
      ...data,
      timestamp: data.timestamp || new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 发布 self-healing.healing_started 事件
   */
  async publishHealingStarted(
    data: SelfHealingStartedEventData,
    extensions?: SelfHealingEventExtensions
  ): Promise<PublishResult> {
    return this.adapter.publish('self-healing.healing_started', {
      ...data,
      timestamp: data.timestamp || new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 发布 self-healing.action_executed 事件
   */
  async publishActionExecuted(
    data: SelfHealingActionExecutedEventData,
    extensions?: SelfHealingEventExtensions
  ): Promise<PublishResult> {
    return this.adapter.publish('self-healing.action_executed', {
      ...data,
      timestamp: data.timestamp || new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 发布 self-healing.healing_completed 事件
   */
  async publishHealingCompleted(
    data: SelfHealingCompletedEventData,
    extensions?: SelfHealingEventExtensions
  ): Promise<PublishResult> {
    return this.adapter.publish('self-healing.healing_completed', {
      ...data,
      timestamp: data.timestamp || new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 发布 self-healing.healing_failed 事件
   */
  async publishHealingFailed(
    data: SelfHealingFailedEventData,
    extensions?: SelfHealingEventExtensions
  ): Promise<PublishResult> {
    return this.adapter.publish('self-healing.healing_failed', {
      ...data,
      timestamp: data.timestamp || new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 发布 self-healing.approval_requested 事件
   */
  async publishApprovalRequested(
    data: SelfHealingApprovalRequestedEventData,
    extensions?: SelfHealingEventExtensions
  ): Promise<PublishResult> {
    return this.adapter.publish('self-healing.approval_requested', {
      ...data,
      timestamp: data.timestamp || new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 发布 self-healing.approval_responded 事件
   */
  async publishApprovalResponded(
    data: SelfHealingApprovalRespondedEventData,
    extensions?: SelfHealingEventExtensions
  ): Promise<PublishResult> {
    return this.adapter.publish('self-healing.approval_responded', {
      ...data,
      timestamp: data.timestamp || new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 发布 self-healing.incident_escalated 事件
   */
  async publishIncidentEscalated(
    data: SelfHealingIncidentEscalatedEventData,
    extensions?: SelfHealingEventExtensions
  ): Promise<PublishResult> {
    return this.adapter.publish('self-healing.incident_escalated', {
      ...data,
      timestamp: data.timestamp || new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 转换 SelfHealingEventExtensions 为 PublishOptions
   */
  private toPublishOptions(extensions?: SelfHealingEventExtensions): PublishOptions {
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
export const selfHealingEventPublisher = new SelfHealingEventPublisher();