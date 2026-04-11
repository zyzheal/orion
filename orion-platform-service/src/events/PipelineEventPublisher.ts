/**
 * Pipeline Event Publisher - 发布 Pipeline 相关事件
 *
 * 使用 @orion/event-bus SDK，符合 CloudEvents 1.0 规范
 */

import { PipelineRun } from '../models/PipelineRun';
import { Stage } from '../models/Stage';
import { Task } from '../models/Task';
import { PipelineEventType, PipelineRunEventData, StageEventData, TaskEventData, PipelineEventExtensions } from './types';

/**
 * 事件发布器配置
 */
export interface PipelineEventPublisherConfig {
  /** 事件总线实例 */
  eventBus?: {
    publish?: (subject: string, data: any) => Promise<any>;
    isHealthy?: () => boolean;
    [key: string]: any;
  };
  /** 事件源标识 */
  source?: string;
  /** 默认租户 ID */
  defaultTenantId?: string;
  /** 默认用户 ID */
  defaultUserId?: string;
}

/**
 * Pipeline 事件发布器
 *
 * 负责将 Pipeline 和 Stage 的执行状态发布到 NATS JetStream 事件总线
 */
export class PipelineEventPublisher {
  private eventBus: any | null = null;
  private source: string;
  private defaultTenantId?: string;
  private defaultUserId?: string;

  constructor(config?: PipelineEventPublisherConfig) {
    this.eventBus = config?.eventBus || null;
    this.source = config?.source || 'pipeline-service';
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
   * 发布 pipeline.run.created 事件
   */
  async publishRunCreated(run: PipelineRun, extensions?: PipelineEventExtensions): Promise<void> {
    await this.publish('pipeline.run.created', {
      runId: run.id,
      pipelineId: run.pipelineId,
      pipelineVersion: run.pipelineVersion,
      status: run.status,
      triggerType: run.triggerType,
      triggeredBy: run.triggerBy,
      gitRef: run.context?.git?.ref,
      gitSha: run.context?.git?.sha,
      timestamp: new Date().toISOString(),
    }, extensions);
  }

  /**
   * 发布 pipeline.run.started 事件
   */
  async publishRunStarted(run: PipelineRun, extensions?: PipelineEventExtensions): Promise<void> {
    await this.publish('pipeline.run.started', {
      runId: run.id,
      pipelineId: run.pipelineId,
      pipelineVersion: run.pipelineVersion,
      status: run.status,
      triggerType: run.triggerType,
      triggeredBy: run.triggerBy,
      gitRef: run.context?.git?.ref,
      gitSha: run.context?.git?.sha,
      timestamp: new Date().toISOString(),
    }, extensions);
  }

  /**
   * 发布 pipeline.run.completed 事件
   */
  async publishRunCompleted(run: PipelineRun, extensions?: PipelineEventExtensions): Promise<void> {
    await this.publish('pipeline.run.completed', {
      runId: run.id,
      pipelineId: run.pipelineId,
      pipelineVersion: run.pipelineVersion,
      status: run.status,
      triggerType: run.triggerType,
      triggeredBy: run.triggerBy,
      durationMs: run.durationMs,
      gitRef: run.context?.git?.ref,
      gitSha: run.context?.git?.sha,
      timestamp: new Date().toISOString(),
    }, extensions);
  }

  /**
   * 发布 pipeline.run.failed 事件
   */
  async publishRunFailed(run: PipelineRun, error?: string, extensions?: PipelineEventExtensions): Promise<void> {
    await this.publish('pipeline.run.failed', {
      runId: run.id,
      pipelineId: run.pipelineId,
      pipelineVersion: run.pipelineVersion,
      status: run.status,
      triggerType: run.triggerType,
      triggeredBy: run.triggerBy,
      error,
      gitRef: run.context?.git?.ref,
      gitSha: run.context?.git?.sha,
      timestamp: new Date().toISOString(),
    }, extensions);
  }

  /**
   * 发布 pipeline.run.cancelled 事件
   */
  async publishRunCancelled(run: PipelineRun, extensions?: PipelineEventExtensions): Promise<void> {
    await this.publish('pipeline.run.cancelled', {
      runId: run.id,
      pipelineId: run.pipelineId,
      pipelineVersion: run.pipelineVersion,
      status: run.status,
      triggerType: run.triggerType,
      triggeredBy: run.triggerBy,
      gitRef: run.context?.git?.ref,
      gitSha: run.context?.git?.sha,
      timestamp: new Date().toISOString(),
    }, extensions);
  }

  /**
   * 发布 pipeline.stage.started 事件
   */
  async publishStageStarted(runId: string, stage: Stage, pipelineId?: string, extensions?: PipelineEventExtensions): Promise<void> {
    await this.publish('pipeline.stage.started', {
      runId,
      pipelineId,
      stageId: stage.id,
      stageName: stage.name,
      sequence: stage.sequence,
      status: stage.status,
      timestamp: new Date().toISOString(),
    }, extensions);
  }

  /**
   * 发布 pipeline.stage.completed 事件
   */
  async publishStageCompleted(runId: string, stage: Stage, pipelineId?: string, extensions?: PipelineEventExtensions): Promise<void> {
    await this.publish('pipeline.stage.completed', {
      runId,
      pipelineId,
      stageId: stage.id,
      stageName: stage.name,
      sequence: stage.sequence,
      status: stage.status,
      durationMs: stage.durationMs,
      timestamp: new Date().toISOString(),
    }, extensions);
  }

  /**
   * 发布 pipeline.stage.failed 事件
   */
  async publishStageFailed(runId: string, stage: Stage, error?: string, pipelineId?: string, extensions?: PipelineEventExtensions): Promise<void> {
    await this.publish('pipeline.stage.failed', {
      runId,
      pipelineId,
      stageId: stage.id,
      stageName: stage.name,
      sequence: stage.sequence,
      status: stage.status,
      error,
      timestamp: new Date().toISOString(),
    }, extensions);
  }

  /**
   * 发布 pipeline.stage.skipped 事件
   */
  async publishStageSkipped(runId: string, stage: Stage, pipelineId?: string, extensions?: PipelineEventExtensions): Promise<void> {
    await this.publish('pipeline.stage.skipped', {
      runId,
      pipelineId,
      stageId: stage.id,
      stageName: stage.name,
      sequence: stage.sequence,
      status: stage.status,
      timestamp: new Date().toISOString(),
    }, extensions);
  }

  /**
   * 发布 pipeline.task.started 事件
   */
  async publishTaskStarted(runId: string, stageId: string, task: Task, extensions?: PipelineEventExtensions): Promise<void> {
    await this.publish('pipeline.task.started', {
      runId,
      stageId,
      taskId: task.id,
      taskName: task.name,
      sequence: task.sequence,
      status: task.status,
      timestamp: new Date().toISOString(),
    }, extensions);
  }

  /**
   * 发布 pipeline.task.completed 事件
   */
  async publishTaskCompleted(runId: string, stageId: string, task: Task, extensions?: PipelineEventExtensions): Promise<void> {
    await this.publish('pipeline.task.completed', {
      runId,
      stageId,
      taskId: task.id,
      taskName: task.name,
      sequence: task.sequence,
      status: task.status,
      durationMs: task.durationMs,
      timestamp: new Date().toISOString(),
    }, extensions);
  }

  /**
   * 发布 pipeline.task.failed 事件
   */
  async publishTaskFailed(runId: string, stageId: string, task: Task, error?: string, extensions?: PipelineEventExtensions): Promise<void> {
    await this.publish('pipeline.task.failed', {
      runId,
      stageId,
      taskId: task.id,
      taskName: task.name,
      sequence: task.sequence,
      status: task.status,
      error,
      timestamp: new Date().toISOString(),
    }, extensions);
  }

  /**
   * 发布通用 Pipeline 事件
   *
   * @param type 事件类型
   * @param data 事件数据
   * @param extensions 扩展属性（租户/用户/追踪上下文）
   */
  async publish<T extends PipelineRunEventData | StageEventData | TaskEventData>(
    type: PipelineEventType,
    data: T,
    extensions?: PipelineEventExtensions
  ): Promise<void> {
    if (!this.eventBus) {
      console.log(`[PipelineEventPublisher] Event Bus not connected, skipping event: ${type}`);
      return;
    }

    try {
      // 构建扩展属性，合并默认值
      const eventExtensions: PipelineEventExtensions = {
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

      console.log(`[PipelineEventPublisher] Published event: ${type}`, {
        id: event.id,
        runId: data.runId,
      });
    } catch (error) {
      console.error(`[PipelineEventPublisher] Failed to publish event ${type}:`, error);
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
export const pipelineEventPublisher = new PipelineEventPublisher();
