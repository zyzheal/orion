/**
 * Deployment Event Publisher - 发布部署相关事件
 *
 * 使用 @orion/event-bus SDK，符合 CloudEvents 1.0 规范
 * ARCH-010: 重构使用 EventBusAdapter 消除接口适配冗余
 */

import { EventBusAdapter, PublishOptions, PublishResult } from './EventBusAdapter';
import { EventBusService } from '../services/event-bus-service';
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
  /** EventBusService 实例 */
  eventBus?: EventBusService | null;
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
 * ARCH-010: 使用 EventBusAdapter 统一接口
 * 负责将部署相关事件发布到 NATS JetStream 事件总线
 */
export class DeploymentEventPublisher {
  private adapter: EventBusAdapter;
  private source: string;

  constructor(config?: DeploymentEventPublisherConfig) {
    this.source = config?.source || 'deploy-service';
    this.adapter = new EventBusAdapter({
      eventBus: config?.eventBus,
      defaultSource: this.source,
      defaultTenantId: config?.defaultTenantId,
      defaultUserId: config?.defaultUserId,
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
  ): Promise<PublishResult> {
    return this.adapter.publish('deploy.started', {
      ...data,
      timestamp: new Date().toISOString(),
    }, this.toPublishOptions(extensions));
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
  ): Promise<PublishResult> {
    return this.adapter.publish('deploy.finished', {
      ...data,
      timestamp: new Date().toISOString(),
    }, this.toPublishOptions(extensions));
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
  ): Promise<PublishResult> {
    return this.adapter.publish('deploy.failed', {
      ...data,
      timestamp: new Date().toISOString(),
    }, this.toPublishOptions(extensions));
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
  ): Promise<PublishResult> {
    return this.adapter.publish('deploy.cancelled', {
      ...data,
      timestamp: new Date().toISOString(),
    }, this.toPublishOptions(extensions));
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
  ): Promise<PublishResult> {
    return this.adapter.publish('deploy.rolledback', {
      ...data,
      timestamp: new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 转换 DeploymentEventExtensions 为 PublishOptions
   */
  private toPublishOptions(extensions?: DeploymentEventExtensions): PublishOptions {
    return {
      source: this.source,
      tenantId: extensions?.tenantId,
      userId: extensions?.userId,
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
export const deploymentEventPublisher = new DeploymentEventPublisher();