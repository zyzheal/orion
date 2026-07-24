/**
 * PipelineEventSSEBridge — 将 Pipeline 引擎事件桥接到 SSE 推送服务
 *
 * 职责：
 * - 监听 PipelineEventPublisher 发布的事件（stage/task/run 状态变化）
 * - 转换为 PipelineLogSSEService 的 SSE 事件格式
 * - 推送到订阅了对应 pipelineId/runId 的 SSE 客户端
 *
 * 设计：
 * - 引擎不直接依赖 SSE 服务，通过桥接器解耦
 * - 桥接器接收 PipelineLogSSEService 实例，在引擎调用 eventPublisher 的同时调用
 */

import { PipelineLogSSEService, PipelineLogEvent, PipelineStatusEvent } from './PipelineLogSSEService';
import { Stage } from '../models/Stage';
import { Task } from '../models/Task';
import { PipelineRun } from '../models/PipelineRun';

export interface PipelineEventSSEBridgeOptions {
  sseService: PipelineLogSSEService;
  /** 是否推送日志事件（默认 true） */
  enableLogEvents?: boolean;
  /** 是否推送状态事件（默认 true） */
  enableStatusEvents?: boolean;
}

export class PipelineEventSSEBridge {
  private sseService: PipelineLogSSEService;
  private enableLogEvents: boolean;
  private enableStatusEvents: boolean;

  constructor(options: PipelineEventSSEBridgeOptions) {
    this.sseService = options.sseService;
    this.enableLogEvents = options.enableLogEvents ?? true;
    this.enableStatusEvents = options.enableStatusEvents ?? true;
  }

  // ==========================================================================
  // Run 级别事件
  // ==========================================================================

  publishRunStarted(pipelineId: string, run: PipelineRun): void {
    if (!this.enableStatusEvents) return;
    this.sseService.publishStatusEvent({
      pipelineId,
      runId: run.id,
      status: 'running',
      progress: 0,
      timestamp: new Date(),
    });
  }

  publishRunCompleted(pipelineId: string, run: PipelineRun): void {
    if (!this.enableStatusEvents) return;
    this.sseService.publishStatusEvent({
      pipelineId,
      runId: run.id,
      status: 'success',
      progress: 100,
      timestamp: new Date(),
    });
  }

  publishRunFailed(pipelineId: string, run: PipelineRun, error?: string): void {
    if (!this.enableStatusEvents) return;
    this.sseService.publishStatusEvent({
      pipelineId,
      runId: run.id,
      status: 'failed',
      progress: 100,
      timestamp: new Date(),
    });
    if (error && this.enableLogEvents) {
      this.publishLog(pipelineId, run.id, 'system', 'System', error, 'error');
    }
  }

  publishRunCancelled(pipelineId: string, run: PipelineRun): void {
    if (!this.enableStatusEvents) return;
    this.sseService.publishStatusEvent({
      pipelineId,
      runId: run.id,
      status: 'cancelled',
      progress: 100,
      timestamp: new Date(),
    });
  }

  // ==========================================================================
  // Stage 级别事件
  // ==========================================================================

  publishStageStarted(pipelineId: string, runId: string, stage: Stage): void {
    if (!this.enableStatusEvents) return;
    this.sseService.publishStatusEvent({
      pipelineId,
      runId,
      status: 'running',
      stageId: stage.id,
      stageName: stage.name,
      progress: 0,
      timestamp: new Date(),
    });
    if (this.enableLogEvents) {
      this.publishLog(pipelineId, runId, stage.id, stage.name, `Stage "${stage.name}" started`, 'info');
    }
  }

  publishStageCompleted(pipelineId: string, runId: string, stage: Stage): void {
    if (!this.enableStatusEvents) return;
    this.sseService.publishStatusEvent({
      pipelineId,
      runId,
      status: 'success',
      stageId: stage.id,
      stageName: stage.name,
      progress: 100,
      timestamp: new Date(),
    });
    if (this.enableLogEvents) {
      const duration = stage.durationMs ? ` (${Math.round(stage.durationMs / 1000)}s)` : '';
      this.publishLog(pipelineId, runId, stage.id, stage.name, `Stage "${stage.name}" completed${duration}`, 'info');
    }
  }

  publishStageFailed(pipelineId: string, runId: string, stage: Stage, error?: string): void {
    if (!this.enableStatusEvents) return;
    this.sseService.publishStatusEvent({
      pipelineId,
      runId,
      status: 'failed',
      stageId: stage.id,
      stageName: stage.name,
      progress: 100,
      timestamp: new Date(),
    });
    if (this.enableLogEvents) {
      const msg = error ? `Stage "${stage.name}" failed: ${error}` : `Stage "${stage.name}" failed`;
      this.publishLog(pipelineId, runId, stage.id, stage.name, msg, 'error');
    }
  }

  publishStageSkipped(pipelineId: string, runId: string, stage: Stage): void {
    if (!this.enableStatusEvents) return;
    this.sseService.publishStatusEvent({
      pipelineId,
      runId,
      status: 'success',
      stageId: stage.id,
      stageName: stage.name,
      progress: 100,
      timestamp: new Date(),
    });
    if (this.enableLogEvents) {
      this.publishLog(pipelineId, runId, stage.id, stage.name, `Stage "${stage.name}" skipped`, 'warn');
    }
  }

  // ==========================================================================
  // Task 级别事件
  // ==========================================================================

  publishTaskStarted(pipelineId: string, runId: string, stage: Stage, task: Task): void {
    if (!this.enableLogEvents) return;
    this.sseService.publishStepStart(pipelineId, runId, stage.id, stage.name, task.name);
  }

  publishTaskCompleted(pipelineId: string, runId: string, stage: Stage, task: Task): void {
    if (!this.enableLogEvents) return;
    const duration = task.durationMs ? ` (${task.durationMs}ms)` : '';
    this.sseService.publishStepEnd(pipelineId, runId, stage.id, stage.name, task.name, 'success', task.durationMs);
  }

  publishTaskFailed(pipelineId: string, runId: string, stage: Stage, task: Task, error?: string): void {
    if (!this.enableLogEvents) return;
    const msg = error ? `${task.name} failed: ${error}` : `${task.name} failed`;
    this.sseService.publishStepEnd(pipelineId, runId, stage.id, stage.name, msg, 'failed');
  }

  // ==========================================================================
  // 通用日志推送
  // ==========================================================================

  private publishLog(
    pipelineId: string,
    runId: string,
    stageId: string,
    stageName: string,
    logLine: string,
    level: PipelineLogEvent['level'] = 'info'
  ): void {
    this.sseService.publishLogEvent({
      pipelineId,
      runId,
      stageId,
      stageName,
      logLine,
      timestamp: new Date(),
      level,
    });
  }
}
