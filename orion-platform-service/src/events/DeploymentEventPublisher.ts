/**
 * Deployment Event Publisher - 发布部署相关事件
 *
 * 使用 @orion/event-bus SDK，符合 CloudEvents 1.0 规范
 */

import {
  DeploymentEventType,
  DeploymentStatus,
  DeploymentStartedEventData,
  DeploymentCompletedEventData,
  DeploymentFailedEventData,
  DeploymentCancelledEventData,
  DeploymentRolledbackEventData,
  DeploymentEventExtensions,
} from './types/deployment';

/**
 * 事件发布器配置
 */
export interface DeploymentEventPublisherConfig {
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
 * Deployment 事件发布器
 *
 * 负责将部署相关事件发布到 NATS JetStream 事件总线
 */
export class DeploymentEventPublisher {
  private eventBus: any | null;
  private source: string;
  private defaultTenantId?: string;
  private defaultUserId?: string;

  constructor(config?: DeploymentEventPublisherConfig) {
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
   * 发布 deployment.started 事件
   */
  async publishDeploymentStarted(
    data: {
      deploymentId: string;
      service: string;
      environment: string;
      version?: string;
      deployedBy?: string;
      strategy?: 'blue-green' | 'canary' | 'rolling' | 'recreate';
    },
    extensions?: DeploymentEventExtensions
  ): Promise<void> {
    await this.publish<DeploymentStartedEventData>('deployment.started', {
      ...data,
      timestamp: new Date().toISOString(),
    }, extensions);
  }

  /**
   * 发布 deployment.completed 事件
   */
  async publishDeploymentCompleted(
    data: {
      deploymentId: string;
      service: string;
      environment: string;
      status: DeploymentStatus;
      version?: string;
      durationMs?: number;
    },
    extensions?: DeploymentEventExtensions
  ): Promise<void> {
    await this.publish<DeploymentCompletedEventData>('deployment.completed', {
      ...data,
      timestamp: new Date().toISOString(),
    }, extensions);
  }

  /**
   * 发布 deployment.failed 事件
   */
  async publishDeploymentFailed(
    data: {
      deploymentId: string;
      service: string;
      environment: string;
      error: string;
      phase?: string;
    },
    extensions?: DeploymentEventExtensions
  ): Promise<void> {
    await this.publish<DeploymentFailedEventData>('deployment.failed', {
      ...data,
      timestamp: new Date().toISOString(),
    }, extensions);
  }

  /**
   * 发布 deployment.cancelled 事件
   */
  async publishDeploymentCancelled(
    data: {
      deploymentId: string;
      service: string;
      environment: string;
      cancelledBy?: string;
      reason?: string;
    },
    extensions?: DeploymentEventExtensions
  ): Promise<void> {
    await this.publish<DeploymentCancelledEventData>('deployment.cancelled', {
      ...data,
      timestamp: new Date().toISOString(),
    }, extensions);
  }

  /**
   * 发布 deployment.rolledback 事件
   */
  async publishDeploymentRolledback(
    data: {
      deploymentId: string;
      service: string;
      environment: string;
      rollbackToVersion?: string;
      reason?: string;
    },
    extensions?: DeploymentEventExtensions
  ): Promise<void> {
    await this.publish<DeploymentRolledbackEventData>('deployment.rolledback', {
      ...data,
      timestamp: new Date().toISOString(),
    }, extensions);
  }

  /**
   * 发布通用 Deployment 事件
   *
   * @param type 事件类型
   * @param data 事件数据
   * @param extensions 扩展属性（租户/用户/追踪上下文）
   */
  async publish<T extends DeploymentStartedEventData | DeploymentCompletedEventData | DeploymentFailedEventData | DeploymentCancelledEventData | DeploymentRolledbackEventData>(
    type: DeploymentEventType,
    data: T,
    extensions?: DeploymentEventExtensions
  ): Promise<void> {
    if (!this.eventBus) {
      console.log(`[DeploymentEventPublisher] Event Bus not connected, skipping event: ${type}`);
      return;
    }

    try {
      // 构建扩展属性，合并默认值
      const eventExtensions: DeploymentEventExtensions = {
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

      console.log(`[DeploymentEventPublisher] Published event: ${type}`, {
        id: event.id,
        deploymentId: (data as any).deploymentId,
        service: (data as any).service,
        environment: (data as any).environment,
      });
    } catch (error) {
      console.error(`[DeploymentEventPublisher] Failed to publish event ${type}:`, error);
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
export const deploymentEventPublisher = new DeploymentEventPublisher();