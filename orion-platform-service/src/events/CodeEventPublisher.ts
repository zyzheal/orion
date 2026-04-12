/**
 * Code Event Publisher - 发布代码相关事件
 *
 * 使用 @orion/event-bus SDK，符合 CloudEvents 1.0 规范
 */

import {
  CodeEventType,
  PROpenedEventData,
  PRMergedEventData,
  PRClosedEventData,
  PRUpdatedEventData,
  CodeEventExtensions,
} from './types/code';

/**
 * 事件发布器配置
 */
export interface CodeEventPublisherConfig {
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
 * Code 事件发布器
 *
 * 负责将 PR 相关事件发布到 NATS JetStream 事件总线
 */
export class CodeEventPublisher {
  private eventBus: any | null;
  private source: string;
  private defaultTenantId?: string;
  private defaultUserId?: string;

  constructor(config?: CodeEventPublisherConfig) {
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
  ): Promise<void> {
    await this.publish<PROpenedEventData>('code.pr.opened', {
      ...data,
      timestamp: new Date().toISOString(),
    }, extensions);
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
  ): Promise<void> {
    await this.publish<PRMergedEventData>('code.pr.merged', {
      ...data,
      timestamp: new Date().toISOString(),
    }, extensions);
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
  ): Promise<void> {
    await this.publish<PRClosedEventData>('code.pr.closed', {
      ...data,
      timestamp: new Date().toISOString(),
    }, extensions);
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
  ): Promise<void> {
    await this.publish<PRUpdatedEventData>('code.pr.updated', {
      ...data,
      timestamp: new Date().toISOString(),
    }, extensions);
  }

  /**
   * 发布通用 Code 事件
   *
   * @param type 事件类型
   * @param data 事件数据
   * @param extensions 扩展属性（租户/用户/追踪上下文）
   */
  async publish<T extends PROpenedEventData | PRMergedEventData | PRClosedEventData | PRUpdatedEventData>(
    type: CodeEventType,
    data: T,
    extensions?: CodeEventExtensions
  ): Promise<void> {
    if (!this.eventBus) {
      console.log(`[CodeEventPublisher] Event Bus not connected, skipping event: ${type}`);
      return;
    }

    try {
      // 构建扩展属性，合并默认值
      const eventExtensions: CodeEventExtensions = {
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

      console.log(`[CodeEventPublisher] Published event: ${type}`, {
        id: event.id,
        prId: (data as any).prId,
      });
    } catch (error) {
      console.error(`[CodeEventPublisher] Failed to publish event ${type}:`, error);
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
export const codeEventPublisher = new CodeEventPublisher();