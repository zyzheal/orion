/**
 * Code Event Publisher - 发布代码相关事件
 *
 * 使用 EventBusAdapter 统一接口，符合 CloudEvents 1.0 规范
 * ARCH-010: 重构使用 EventBusAdapter 消除接口适配冗余
 */

import { EventBusAdapter, PublishOptions, PublishResult } from './EventBusAdapter';
import {
  CodeEventType,
  PROpenedEventData,
  PRMergedEventData,
  PRClosedEventData,
  PRUpdatedEventData,
  CodeEventExtensions,
} from './types/code';
import { EventBusService } from '../services/event-bus-service';

/**
 * 事件发布器配置
 */
export interface CodeEventPublisherConfig {
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
 * Code 事件发布器
 *
 * ARCH-010: 使用 EventBusAdapter 统一接口
 * 负责将 PR 相关事件发布到 NATS JetStream 事件总线
 */
export class CodeEventPublisher {
  private adapter: EventBusAdapter;
  private source: string;
  private defaultTenantId?: string;
  private defaultUserId?: string;

  constructor(config?: CodeEventPublisherConfig) {
    this.source = config?.source || 'code-service';
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
   * 发布 code.pr.opened 事件
   */
  async publishPROpened(
    data: {
      prId: string;
      repoId: string;
      author: string;
      sourceBranch: string;
      targetBranch: string;
      title?: string;
      description?: string;
    },
    extensions?: CodeEventExtensions
  ): Promise<PublishResult> {
    return this.adapter.publish('code.pr.opened', {
      ...data,
      timestamp: new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 发布 code.pr.merged 事件
   */
  async publishPRMerged(
    data: {
      prId: string;
      repoId: string;
      mergedBy: string;
      targetBranch: string;
      mergeCommitSha?: string;
    },
    extensions?: CodeEventExtensions
  ): Promise<PublishResult> {
    return this.adapter.publish('code.pr.merged', {
      ...data,
      timestamp: new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 发布 code.pr.closed 事件
   */
  async publishPRClosed(
    data: {
      prId: string;
      repoId: string;
      closedBy: string;
      reason?: string;
    },
    extensions?: CodeEventExtensions
  ): Promise<PublishResult> {
    return this.adapter.publish('code.pr.closed', {
      ...data,
      timestamp: new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 发布 code.pr.updated 事件
   */
  async publishPRUpdated(
    data: {
      prId: string;
      repoId: string;
      updatedBy: string;
      updateType: 'title' | 'description' | 'commits' | 'files';
    },
    extensions?: CodeEventExtensions
  ): Promise<PublishResult> {
    return this.adapter.publish('code.pr.updated', {
      ...data,
      timestamp: new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 转换 CodeEventExtensions 为 PublishOptions
   */
  private toPublishOptions(extensions?: CodeEventExtensions): PublishOptions {
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
export const codeEventPublisher = new CodeEventPublisher();
