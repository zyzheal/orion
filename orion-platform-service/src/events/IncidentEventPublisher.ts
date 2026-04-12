/**
 * Incident Event Publisher - 发布事故相关事件
 *
 * 使用 @orion/event-bus SDK，符合 CloudEvents 1.0 规范
 */

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

/**
 * 事件发布器配置
 */
export interface IncidentEventPublisherConfig {
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
 * Incident 事件发布器
 *
 * 负责将事故检测相关事件发布到 NATS JetStream 事件总线
 */
export class IncidentEventPublisher {
  private eventBus: any | null;
  private source: string;
  private defaultTenantId?: string;
  private defaultUserId?: string;

  constructor(config?: IncidentEventPublisherConfig) {
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
  ): Promise<void> {
    await this.publish<IncidentDetectedEventData>('incident.detected', {
      ...data,
      timestamp: new Date().toISOString(),
    }, extensions);
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
  ): Promise<void> {
    await this.publish<IncidentAcknowledgedEventData>('incident.acknowledged', {
      ...data,
      timestamp: new Date().toISOString(),
    }, extensions);
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
  ): Promise<void> {
    await this.publish<IncidentResolvedEventData>('incident.resolved', {
      ...data,
      timestamp: new Date().toISOString(),
    }, extensions);
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
  ): Promise<void> {
    await this.publish<IncidentEscalatedEventData>('incident.escalated', {
      ...data,
      timestamp: new Date().toISOString(),
    }, extensions);
  }

  /**
   * 发布通用 Incident 事件
   *
   * @param type 事件类型
   * @param data 事件数据
   * @param extensions 扩展属性（租户/用户/追踪上下文）
   */
  async publish<T extends IncidentDetectedEventData | IncidentAcknowledgedEventData | IncidentResolvedEventData | IncidentEscalatedEventData>(
    type: IncidentEventType,
    data: T,
    extensions?: IncidentEventExtensions
  ): Promise<void> {
    if (!this.eventBus) {
      console.log(`[IncidentEventPublisher] Event Bus not connected, skipping event: ${type}`);
      return;
    }

    try {
      // 构建扩展属性，合并默认值
      const eventExtensions: IncidentEventExtensions = {
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

      console.log(`[IncidentEventPublisher] Published event: ${type}`, {
        id: event.id,
        incidentId: (data as any).incidentId,
        service: (data as any).service,
        severity: (data as any).severity,
      });
    } catch (error) {
      console.error(`[IncidentEventPublisher] Failed to publish event ${type}:`, error);
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
export const incidentEventPublisher = new IncidentEventPublisher();