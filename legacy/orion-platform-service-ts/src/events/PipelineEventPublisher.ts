/**
 * Pipeline Event Publisher - 发布 Pipeline 相关事件
 *
 * 使用 @orion/event-bus SDK，符合 CloudEvents 1.0 规范
 * ARCH-010: 重构使用 EventBusAdapter 消除接口适配冗余
 */

import { EventBusAdapter, PublishOptions, PublishResult } from './EventBusAdapter';
import { PipelineRun } from '../models/PipelineRun';
import { Stage } from '../models/Stage';
import { Task } from '../models/Task';
import { PipelineEventType, PipelineRunEventData, StageEventData, TaskEventData, PipelineEventExtensions } from './types';
import { EventBusService } from '../services/event-bus-service';

/**
 * 事件发布器配置
 */
export interface PipelineEventPublisherConfig {
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
 * Pipeline 事件发布器
 *
 * ARCH-010: 使用 EventBusAdapter 统一接口
 * 负责将 Pipeline 和 Stage 的执行状态发布到 NATS JetStream 事件总线
 */
export class PipelineEventPublisher {
  private adapter: EventBusAdapter;
  private source: string;

  constructor(config?: PipelineEventPublisherConfig) {
    this.source = config?.source || 'pipeline-service';
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
   * 发布 pipeline.run.created 事件
   */
  async publishRunCreated(run: PipelineRun, extensions?: PipelineEventExtensions): Promise<PublishResult> {
    return this.adapter.publish('pipeline.run.created', {
      runId: run.id,
      pipelineId: run.pipelineId,
      pipelineVersion: run.pipelineVersion,
      status: run.status,
      triggerType: run.triggerType,
      triggeredBy: run.triggerBy,
      gitRef: run.context?.git?.ref,
      gitSha: run.context?.git?.sha,
      timestamp: new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 发布 pipeline.run.started 事件
   */
  async publishRunStarted(run: PipelineRun, extensions?: PipelineEventExtensions): Promise<PublishResult> {
    return this.adapter.publish('pipeline.run.started', {
      runId: run.id,
      pipelineId: run.pipelineId,
      pipelineVersion: run.pipelineVersion,
      status: run.status,
      triggerType: run.triggerType,
      triggeredBy: run.triggerBy,
      gitRef: run.context?.git?.ref,
      gitSha: run.context?.git?.sha,
      timestamp: new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 发布 pipeline.run.completed 事件
   */
  async publishRunCompleted(run: PipelineRun, extensions?: PipelineEventExtensions): Promise<PublishResult> {
    return this.adapter.publish('pipeline.run.completed', {
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
    }, this.toPublishOptions(extensions));
  }

  /**
   * 发布 pipeline.run.failed 事件
   */
  async publishRunFailed(run: PipelineRun, error?: string, extensions?: PipelineEventExtensions): Promise<PublishResult> {
    return this.adapter.publish('pipeline.run.failed', {
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
    }, this.toPublishOptions(extensions));
  }

  /**
   * 发布 pipeline.run.cancelled 事件
   */
  async publishRunCancelled(run: PipelineRun, extensions?: PipelineEventExtensions): Promise<PublishResult> {
    return this.adapter.publish('pipeline.run.cancelled', {
      runId: run.id,
      pipelineId: run.pipelineId,
      pipelineVersion: run.pipelineVersion,
      status: run.status,
      triggerType: run.triggerType,
      triggeredBy: run.triggerBy,
      gitRef: run.context?.git?.ref,
      gitSha: run.context?.git?.sha,
      timestamp: new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 发布 pipeline.stage.started 事件
   */
  async publishStageStarted(runId: string, stage: Stage, pipelineId?: string, extensions?: PipelineEventExtensions): Promise<PublishResult> {
    return this.adapter.publish('pipeline.stage.started', {
      runId,
      pipelineId,
      stageId: stage.id,
      stageName: stage.name,
      sequence: stage.sequence,
      status: stage.status,
      timestamp: new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 发布 pipeline.stage.completed 事件
   */
  async publishStageCompleted(runId: string, stage: Stage, pipelineId?: string, extensions?: PipelineEventExtensions): Promise<PublishResult> {
    return this.adapter.publish('pipeline.stage.completed', {
      runId,
      pipelineId,
      stageId: stage.id,
      stageName: stage.name,
      sequence: stage.sequence,
      status: stage.status,
      durationMs: stage.durationMs,
      timestamp: new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 发布 pipeline.stage.failed 事件
   */
  async publishStageFailed(runId: string, stage: Stage, error?: string, pipelineId?: string, extensions?: PipelineEventExtensions): Promise<PublishResult> {
    return this.adapter.publish('pipeline.stage.failed', {
      runId,
      pipelineId,
      stageId: stage.id,
      stageName: stage.name,
      sequence: stage.sequence,
      status: stage.status,
      error,
      timestamp: new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 发布 pipeline.stage.skipped 事件
   */
  async publishStageSkipped(runId: string, stage: Stage, pipelineId?: string, extensions?: PipelineEventExtensions): Promise<PublishResult> {
    return this.adapter.publish('pipeline.stage.skipped', {
      runId,
      pipelineId,
      stageId: stage.id,
      stageName: stage.name,
      sequence: stage.sequence,
      status: stage.status,
      timestamp: new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 发布 pipeline.task.started 事件
   */
  async publishTaskStarted(runId: string, stageId: string, task: Task, extensions?: PipelineEventExtensions): Promise<PublishResult> {
    return this.adapter.publish('pipeline.task.started', {
      runId,
      stageId,
      taskId: task.id,
      taskName: task.name,
      sequence: task.sequence,
      status: task.status,
      timestamp: new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 发布 pipeline.task.completed 事件
   */
  async publishTaskCompleted(runId: string, stageId: string, task: Task, extensions?: PipelineEventExtensions): Promise<PublishResult> {
    return this.adapter.publish('pipeline.task.completed', {
      runId,
      stageId,
      taskId: task.id,
      taskName: task.name,
      sequence: task.sequence,
      status: task.status,
      durationMs: task.durationMs,
      timestamp: new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 发布 pipeline.task.failed 事件
   */
  async publishTaskFailed(runId: string, stageId: string, task: Task, error?: string, extensions?: PipelineEventExtensions): Promise<PublishResult> {
    return this.adapter.publish('pipeline.task.failed', {
      runId,
      stageId,
      taskId: task.id,
      taskName: task.name,
      sequence: task.sequence,
      status: task.status,
      error,
      timestamp: new Date().toISOString(),
    }, this.toPublishOptions(extensions));
  }

  /**
   * 转换 PipelineEventExtensions 为 PublishOptions
   */
  private toPublishOptions(extensions?: PipelineEventExtensions): PublishOptions {
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
export const pipelineEventPublisher = new PipelineEventPublisher();