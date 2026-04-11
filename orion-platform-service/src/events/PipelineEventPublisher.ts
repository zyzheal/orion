/**
 * Pipeline Event Publisher - 发布 Pipeline 相关事件
 */

import { EventBusService } from '../services/event-bus-service';
import { PipelineRun } from '../models/PipelineRun';
import { Stage } from '../models/Stage';
import { Task } from '../models/Task';

export interface PipelineRunEventPayload {
  runId: string;
  pipelineId: string;
  pipelineVersion: string;
  status: string;
  triggerType: string;
  triggerBy?: string;
  timestamp: string;
}

export interface StageEventPayload {
  runId: string;
  stageId: string;
  stageName: string;
  status: string;
  sequence: number;
  timestamp: string;
}

export interface TaskEventPayload {
  runId: string;
  stageId: string;
  taskId: string;
  taskName: string;
  status: string;
  sequence: number;
  timestamp: string;
}

export class PipelineEventPublisher {
  private eventBus: EventBusService | null = null;

  constructor(eventBus?: EventBusService) {
    this.eventBus = eventBus || null;
  }

  /**
   * 设置事件总线
   */
  setEventBus(eventBus: EventBusService): void {
    this.eventBus = eventBus;
  }

  /**
   * 发布 pipeline.run.created 事件
   */
  async publishRunCreated(run: PipelineRun): Promise<void> {
    await this.publish('pipeline.run.created', {
      runId: run.id,
      pipelineId: run.pipelineId,
      pipelineVersion: run.pipelineVersion,
      status: run.status,
      triggerType: run.triggerType,
      triggerBy: run.triggerBy,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 发布 pipeline.run.started 事件
   */
  async publishRunStarted(run: PipelineRun): Promise<void> {
    await this.publish('pipeline.run.started', {
      runId: run.id,
      pipelineId: run.pipelineId,
      pipelineVersion: run.pipelineVersion,
      status: run.status,
      triggerType: run.triggerType,
      triggerBy: run.triggerBy,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 发布 pipeline.run.completed 事件
   */
  async publishRunCompleted(run: PipelineRun): Promise<void> {
    await this.publish('pipeline.run.completed', {
      runId: run.id,
      pipelineId: run.pipelineId,
      pipelineVersion: run.pipelineVersion,
      status: run.status,
      triggerType: run.triggerType,
      triggerBy: run.triggerBy,
      durationMs: run.durationMs,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 发布 pipeline.run.failed 事件
   */
  async publishRunFailed(run: PipelineRun, error?: string): Promise<void> {
    await this.publish('pipeline.run.failed', {
      runId: run.id,
      pipelineId: run.pipelineId,
      pipelineVersion: run.pipelineVersion,
      status: run.status,
      triggerType: run.triggerType,
      triggerBy: run.triggerBy,
      error,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 发布 pipeline.run.cancelled 事件
   */
  async publishRunCancelled(run: PipelineRun): Promise<void> {
    await this.publish('pipeline.run.cancelled', {
      runId: run.id,
      pipelineId: run.pipelineId,
      pipelineVersion: run.pipelineVersion,
      status: run.status,
      triggerType: run.triggerType,
      triggerBy: run.triggerBy,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 发布 pipeline.stage.started 事件
   */
  async publishStageStarted(runId: string, stage: Stage): Promise<void> {
    await this.publish('pipeline.stage.started', {
      runId,
      stageId: stage.id,
      stageName: stage.name,
      status: stage.status,
      sequence: stage.sequence,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 发布 pipeline.stage.completed 事件
   */
  async publishStageCompleted(runId: string, stage: Stage): Promise<void> {
    await this.publish('pipeline.stage.completed', {
      runId,
      stageId: stage.id,
      stageName: stage.name,
      status: stage.status,
      sequence: stage.sequence,
      durationMs: stage.durationMs,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 发布 pipeline.stage.failed 事件
   */
  async publishStageFailed(runId: string, stage: Stage, error?: string): Promise<void> {
    await this.publish('pipeline.stage.failed', {
      runId,
      stageId: stage.id,
      stageName: stage.name,
      status: stage.status,
      sequence: stage.sequence,
      error,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 发布 pipeline.stage.skipped 事件
   */
  async publishStageSkipped(runId: string, stage: Stage): Promise<void> {
    await this.publish('pipeline.stage.skipped', {
      runId,
      stageId: stage.id,
      stageName: stage.name,
      status: stage.status,
      sequence: stage.sequence,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 发布 pipeline.task.started 事件
   */
  async publishTaskStarted(runId: string, stageId: string, task: Task): Promise<void> {
    await this.publish('pipeline.task.started', {
      runId,
      stageId,
      taskId: task.id,
      taskName: task.name,
      status: task.status,
      sequence: task.sequence,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 发布 pipeline.task.completed 事件
   */
  async publishTaskCompleted(runId: string, stageId: string, task: Task): Promise<void> {
    await this.publish('pipeline.task.completed', {
      runId,
      stageId,
      taskId: task.id,
      taskName: task.name,
      status: task.status,
      sequence: task.sequence,
      durationMs: task.durationMs,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 发布 pipeline.task.failed 事件
   */
  async publishTaskFailed(runId: string, stageId: string, task: Task, error?: string): Promise<void> {
    await this.publish('pipeline.task.failed', {
      runId,
      stageId,
      taskId: task.id,
      taskName: task.name,
      status: task.status,
      sequence: task.sequence,
      error,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 发布通用事件
   */
  private async publish(subject: string, data: Record<string, unknown>): Promise<void> {
    if (!this.eventBus) {
      console.log(`[EventPublisher] Event Bus not connected, skipping event: ${subject}`);
      return;
    }

    try {
      await this.eventBus.publish(subject, data);
      console.log(`[EventPublisher] Published event: ${subject}`);
    } catch (error) {
      console.error(`[EventPublisher] Failed to publish event ${subject}:`, error);
    }
  }
}

// 导出单例
export const pipelineEventPublisher = new PipelineEventPublisher();
