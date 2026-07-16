/**
 * Pipeline Crash Recovery - 崩溃恢复逻辑
 *
 * 从 PipelineEngine 提取的恢复相关方法：
 * - recoverOrphanedRuns: 使用 checkpoint 数据恢复孤立的 runs
 * - recoverRuns: 恢复中断的 Pipeline Runs
 * - rebuildExecutionQueue: 重建执行队列
 */

import { PipelineRunStatus } from '../models/PipelineRun';
import { PipelineRunService } from '../services/pipeline/PipelineRunService';
import { PipelineEventPublisher } from '../events/PipelineEventPublisher';
import { PipelineEventSSEBridge } from '../services/pipeline/PipelineEventSSEBridge';
import { PipelineExecutionQueue } from '../services/pipeline/PipelineExecutionQueue';
import { PipelineCheckpointManager } from './PipelineCheckpointManager';
import type { PipelineExecution } from './PipelineEngine';

import { createLogger } from '../utils/logger';

const logger = createLogger('PipelineCrashRecovery');

export interface RecoveryResult {
  recovered: number;
  markedFailed: number;
  restored: number;
  errors: string[];
}

export interface CrashRecoveryDependencies {
  runService: PipelineRunService;
  eventPublisher: PipelineEventPublisher;
  sseBridge: PipelineEventSSEBridge | null;
  checkpointManager: PipelineCheckpointManager | null;
  executionQueue: PipelineExecutionQueue | null;
  executions: Map<string, PipelineExecution>;
}

export class PipelineCrashRecovery {
  private deps: CrashRecoveryDependencies;

  constructor(deps: CrashRecoveryDependencies) {
    this.deps = deps;
  }

  /**
   * Recover orphaned runs during startup using checkpoint data.
   */
  async recoverOrphanedRuns(options?: {
    onRestored?: (execution: PipelineExecution) => void;
    markFailedIfStale?: boolean;
  }): Promise<RecoveryResult> {
    if (!this.deps.checkpointManager) {
      logger.info('Checkpoint manager not configured, falling back to legacy recovery');
      const legacyResult = await this.recoverRuns();
      return { ...legacyResult, restored: 0 };
    }

    const recoveryResult = await this.deps.checkpointManager.recoverOrphanedRuns(
      {
        getRun: (id) => this.deps.runService.getRun(id),
        completeRun: (id, status) => this.deps.runService.completeRun(id, status),
      },
      {
        onRestored: (execution) => {
          // Re-add to in-memory executions map
          this.deps.executions.set(execution.run.id, execution);
          logger.info(
            { runId: execution.run.id, pendingStages: execution.pendingStages.size },
            'Restored execution to in-memory map'
          );
          // Notify caller for re-enqueue or resume
          options?.onRestored?.(execution);
        },
        markFailedIfStale: options?.markFailedIfStale,
      }
    );

    logger.info(
      { recovered: recoveryResult.recovered, restored: recoveryResult.restored, markedFailed: recoveryResult.markedFailed },
      'Orphaned run recovery complete'
    );

    return recoveryResult;
  }

  /**
   * 恢复中断的 Pipeline Runs
   */
  async recoverRuns(): Promise<RecoveryResult> {
    if (!this.deps.runService) {
      return { recovered: 0, markedFailed: 0, restored: 0, errors: ['RunService not available'] };
    }

    const errors: string[] = [];
    let markedFailed = 0;
    let runningCount = 0;

    try {
      const runningRuns = await this.deps.runService.findRunsByStatus(PipelineRunStatus.RUNNING);
      runningCount = runningRuns.length;

      if (runningRuns.length === 0) {
        logger.info('No running pipeline runs to recover');
        return { recovered: 0, markedFailed: 0, restored: 0, errors: [] };
      }

      logger.info(
        { count: runningRuns.length, runIds: runningRuns.map(r => r.id) },
        'Found running pipeline runs to recover'
      );

      for (const run of runningRuns) {
        try {
          await this.deps.runService.completeRun(run.id, PipelineRunStatus.FAILED);
          await this.deps.eventPublisher.publishRunFailed(run, 'Server restarted, pipeline run interrupted');
          this.deps.sseBridge?.publishRunFailed(run.pipelineId, run, 'Server restarted, pipeline run interrupted');
          markedFailed++;
          logger.info({ runId: run.id }, 'Marked interrupted pipeline run as failed');
        } catch (err) {
          const errMsg = `Failed to recover run ${run.id}: ${err instanceof Error ? err.message : String(err)}`;
          errors.push(errMsg);
          logger.error({ runId: run.id, error: err }, 'Failed to recover pipeline run');
        }
      }
    } catch (err) {
      errors.push(`Recovery scan failed: ${err instanceof Error ? err.message : String(err)}`);
      logger.error({ error: err }, 'Pipeline run recovery scan failed');
    }

    return {
      recovered: runningCount,
      markedFailed,
      restored: 0,
      errors,
    };
  }

  /**
   * 重建执行队列（从数据库加载待执行的 runs）
   */
  async rebuildExecutionQueue(): Promise<number> {
    if (!this.deps.executionQueue) return 0;

    logger.info('Execution queue rebuild: no persistent pending executions to restore');
    return 0;
  }
}
