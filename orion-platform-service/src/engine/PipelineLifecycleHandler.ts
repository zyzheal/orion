/**
 * Pipeline Lifecycle Handler - Pipeline 生命周期处理
 *
 * 从 PipelineEngine 提取的生命周期相关方法：
 * - checkRunCompletion: 检查 run 是否完成
 * - cancelExecution: 取消执行中的 run
 * - approveStage/rejectStage: 审批操作
 */

import { PipelineRun, PipelineRunStatus } from '../models/PipelineRun';
import { Stage, StageStatus } from '../models/Stage';
import { PipelineRunService } from '../services/pipeline/PipelineRunService';
import { PipelineEventPublisher } from '../events/PipelineEventPublisher';
import { PipelineEventSSEBridge } from '../services/pipeline/PipelineEventSSEBridge';
import { PipelineCheckpointManager } from './PipelineCheckpointManager';
import { DebugController } from './DebugController';
import { StageOrchestrator } from './StageOrchestrator';
import { NotificationDispatcher } from './NotificationDispatcher';
import { ScmStatusReporter } from './ScmStatusReporter';
import { PipelineGateController } from './PipelineGateController';
import type { PipelineExecution, RunCompletionCallback } from './PipelineEngine';

import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface LifecycleHandlerDeps {
  runService: PipelineRunService;
  eventPublisher: PipelineEventPublisher;
  sseBridge: PipelineEventSSEBridge | null;
  checkpointManager: PipelineCheckpointManager | null;
  debugController: DebugController | null;
  stageOrchestrator: StageOrchestrator;
  notificationDispatcher: NotificationDispatcher;
  scmStatusReporter: ScmStatusReporter;
  gateController: PipelineGateController;
  executions: Map<string, PipelineExecution>;
  onRunComplete: RunCompletionCallback | null;
}

export class PipelineLifecycleHandler {
  private deps: LifecycleHandlerDeps;

  constructor(deps: LifecycleHandlerDeps) {
    this.deps = deps;
  }

  /**
   * 检查 PipelineRun 是否完成
   */
  async checkRunCompletion(execution: PipelineExecution): Promise<void> {
    const allStagesCompleted = Array.from(execution.stages.values()).every(
      s => s.status === StageStatus.SUCCESS || s.status === StageStatus.FAILED || s.status === StageStatus.SKIPPED
    );

    if (allStagesCompleted && execution.runningStages.size === 0) {
      const hasFailure = Array.from(execution.stages.values()).some(s => s.status === StageStatus.FAILED);

      if (hasFailure) {
        await this.deps.runService.completeRun(execution.run.id, PipelineRunStatus.FAILED);
        this.deps.sseBridge?.publishRunFailed(execution.run.pipelineId, execution.run, 'Pipeline execution failed');
      } else {
        await this.deps.runService.completeRun(execution.run.id, PipelineRunStatus.SUCCESS);
        this.deps.sseBridge?.publishRunCompleted(execution.run.pipelineId, execution.run);
      }

      // 获取更新后的 run 数据并触发回调
      const completedRun = await this.deps.runService.getRun(execution.run.id);
      if (completedRun && this.deps.onRunComplete) {
        this.deps.onRunComplete(completedRun);
      }

      // 发送通知（delegate to NotificationDispatcher）
      if (completedRun) {
        this.deps.notificationDispatcher.sendIMNotifications(completedRun).catch(err => {
          logger.warn({ runId: completedRun.id, error: err }, 'IM notification batch sending failed (non-fatal)');
        });
        this.deps.notificationDispatcher.sendWebhookNotifications(completedRun, this.deps.executions).catch(err => {
          logger.warn({ runId: completedRun.id, error: err }, 'Webhook notification batch sending failed (non-fatal)');
        });
      }

      // SCM bidirectional: write pipeline result back to PR/commit
      if (completedRun) {
        const scmOutcome = hasFailure ? 'failure' as const : 'success' as const;
        this.deps.scmStatusReporter.reportScmStatus(completedRun, scmOutcome, this.deps.executions).catch(err => {
          logger.warn({ runId: completedRun.id, error: err }, 'SCM status reporting failed (non-fatal)');
        });
      }

      // Cleanup after pipeline completion
      if (this.deps.checkpointManager) {
        await this.deps.checkpointManager.cleanupCompleted(execution.run.id);
      }
      if (this.deps.debugController) {
        this.deps.debugController.unregisterRun(execution.run.id);
        logger.debug({ runId: execution.run.id }, 'Debug session unregistered on pipeline completion');
      }

      // 清理执行上下文
      this.deps.executions.delete(execution.run.id);
      this.deps.stageOrchestrator.cleanupVariableContext(execution.run.id);
    }
  }

  /**
   * 取消正在执行的 PipelineRun
   */
  async cancelExecution(runId: string): Promise<boolean> {
    const execution = this.deps.executions.get(runId);
    if (!execution) {
      return false;
    }

    // 取消所有运行中的 Stages
    for (const stageId of execution.runningStages) {
      const stage = execution.stages.get(stageId);
      if (stage) {
        const cancelledStage = {
          ...stage,
          status: StageStatus.SKIPPED,
          completedAt: new Date(),
          durationMs: Date.now() - stage.startedAt!.getTime(),
        };
        execution.stages.set(stageId, cancelledStage);
        await this.deps.runService.updateStage(cancelledStage);
        await this.deps.eventPublisher.publishStageSkipped(execution.run.id, cancelledStage);
        this.deps.sseBridge?.publishStageSkipped(execution.run.pipelineId, execution.run.id, cancelledStage);
      }
    }

    // 标记所有待处理的 Stages 为跳过
    for (const stageId of execution.pendingStages) {
      const stage = execution.stages.get(stageId);
      if (stage) {
        const skippedStage = {
          ...stage,
          status: StageStatus.SKIPPED,
          completedAt: new Date(),
        };
        execution.stages.set(stageId, skippedStage);
        await this.deps.runService.updateStage(skippedStage);
        await this.deps.eventPublisher.publishStageSkipped(execution.run.id, skippedStage);
        this.deps.sseBridge?.publishStageSkipped(execution.run.pipelineId, execution.run.id, skippedStage);
      }
    }

    // 取消 PipelineRun
    await this.deps.runService.cancelRun(runId);
    this.deps.sseBridge?.publishRunCancelled(execution.run.pipelineId, execution.run);

    // SCM bidirectional: write cancellation back
    this.deps.scmStatusReporter.reportScmStatus(execution.run, 'cancelled', this.deps.executions).catch(err => {
      logger.warn({ runId: execution.run.id, error: err }, 'SCM status reporting failed (non-fatal)');
    });

    // Cleanup checkpoint on cancellation
    if (this.deps.checkpointManager) {
      await this.deps.checkpointManager.cleanupCompleted(runId);
    }

    // 清理执行上下文
    this.deps.executions.delete(runId);
    this.deps.stageOrchestrator.cleanupVariableContext(runId);

    return true;
  }

  /**
   * 审批通过一个 stage
   */
  async approveStage(
    runId: string,
    stageId: string,
    userId: string,
    comment?: string
  ): Promise<void> {
    await this.deps.gateController.approveStage(runId, stageId, userId, comment);
    this.resumeAfterApproval(runId, stageId);
  }

  /**
   * 审批拒绝一个 stage
   */
  async rejectStage(
    runId: string,
    stageId: string,
    userId: string,
    comment?: string
  ): Promise<void> {
    await this.deps.gateController.rejectStage(runId, stageId, userId, comment);

    const execution = this.deps.executions.get(runId);
    if (execution) {
      const stage = execution.stages.get(stageId);
      if (stage) {
        const rejectedStage = {
          ...stage,
          status: StageStatus.FAILED,
          completedAt: new Date(),
          error: `Approval rejected by ${userId}${comment ? `: ${comment}` : ''}`,
        };
        execution.stages.set(stageId, rejectedStage);
        await this.deps.runService.updateStage(rejectedStage);
        await this.deps.eventPublisher.publishStageFailed(execution.run.id, rejectedStage, rejectedStage.error);
        this.deps.sseBridge?.publishStageFailed(execution.run.pipelineId, execution.run.id, rejectedStage, rejectedStage.error);

        execution.runningStages.delete(stageId);
        execution.completedStages.add(stageId);

        await this.deps.stageOrchestrator.saveCheckpoint(execution, stage.name);
        this.deps.stageOrchestrator.failDependentStages(execution, rejectedStage);
        this.checkRunCompletion(execution);
      }
    }
  }

  /**
   * 审批通过后恢复 stage 执行
   */
  private resumeAfterApproval(runId: string, stageId: string): void {
    const execution = this.deps.executions.get(runId);
    if (!execution) return;

    const stage = execution.stages.get(stageId);
    if (!stage) return;

    execution.pendingStages.add(stageId);
    // Note: executePendingStages should be called by the caller (PipelineEngine)
  }

  /**
   * 获取审批状态
   */
  async getApprovalStatus(runId: string, stageId: string) {
    return this.deps.gateController.getApprovalStatus(runId, stageId);
  }

  /**
   * 获取 run 的所有审批请求
   */
  async getApprovalRequestsByRun(runId: string) {
    return this.deps.gateController.getApprovalRequestsByRun(runId);
  }
}
