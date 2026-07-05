/**
 * PipelineCheckpointManager - Manages execution state persistence
 *
 * Responsibilities:
 * - Serialize PipelineExecution state into checkpoint_data JSON
 * - Restore PipelineExecution state from checkpoint
 * - Cleanup checkpoints on pipeline completion
 * - Find orphaned runs (RUNNING in DB but actually completed elsewhere)
 *
 * The checkpoint captures the in-memory execution state at key moments:
 * - Stage state changes (PENDING -> RUNNING -> SUCCESS/FAILED)
 * - Task completion
 * - Pipeline run completion (then cleanup)
 */

import { PipelineExecution } from '../engine/PipelineEngine';
import { PipelineRun, PipelineRunStatus } from '../models/PipelineRun';
import { Stage, StageStatus } from '../models/Stage';
import { Task, TaskStatus } from '../models/Task';
import { PipelineCheckpointRepository, CreateCheckpointInput } from '../repositories/PipelineCheckpointRepository';
import { createLogger } from '../utils/logger';

const logger = createLogger('PipelineCheckpointManager');

/**
 * Serialized checkpoint data structure stored in JSONB
 */
export interface CheckpointData {
  run: {
    id: string;
    pipelineId: string;
    pipelineVersion: string;
    triggerType: string;
    triggerBy?: string;
    status: string;
    startedAt?: string; // ISO date string
    completedAt?: string;
    durationMs?: number;
    context: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  };
  stages: Array<{
    id: string;
    runId: string;
    name: string;
    sequence: number;
    status: string;
    dependsOn: string[];
    condition?: string;
    timeoutSeconds: number;
    retryCount: number;
    maxRetries: number;
    startedAt?: string;
    completedAt?: string;
    durationMs?: number;
    result?: Record<string, unknown>;
    error?: string;
    createdAt: string;
  }>;
  pendingStages: string[];
  runningStages: string[];
  completedStages: string[];
  checkpointVersion: number;
  checkpointedAt: string;
  stageOrchestrator?: {
    variableContexts: Record<
      string,
      {
        taskOutputs: Record<string, Record<string, string>>;
        variables: Record<string, string>;
      }
    >;
  };
}

/**
 * Result of startup recovery
 */
export interface RecoveryResult {
  recovered: number;
  markedFailed: number;
  restored: number;
  errors: string[];
}

export class PipelineCheckpointManager {
  private checkpointRepository: PipelineCheckpointRepository | null = null;

  constructor(checkpointRepository?: PipelineCheckpointRepository) {
    this.checkpointRepository = checkpointRepository || null;
  }

  /**
   * Set the checkpoint repository
   */
  setRepository(repository: PipelineCheckpointRepository): void {
    this.checkpointRepository = repository;
  }

  /**
   * Save a checkpoint for the given execution.
   * Serializes the entire execution state into JSON and upserts to DB.
   */
  async saveCheckpoint(
    execution: PipelineExecution,
    lastStageName?: string,
    lastTaskName?: string
  ): Promise<boolean> {
    if (!this.checkpointRepository) {
      logger.debug({ runId: execution.run.id }, 'Checkpoint repository not configured, skipping');
      return false;
    }

    try {
      const checkpointData = this.serializeExecution(execution);

      const input: CreateCheckpointInput = {
        run_id: execution.run.id,
        pipeline_id: execution.run.pipelineId,
        checkpoint_data: checkpointData as Record<string, any>,
        status: this.deriveCheckpointStatus(execution),
        last_stage_name: lastStageName,
        last_task_name: lastTaskName,
      };

      await this.checkpointRepository.saveCheckpoint(input);
      logger.debug(
        { runId: execution.run.id, status: input.status, stageCount: checkpointData.stages.length },
        'Checkpoint saved'
      );
      return true;
    } catch (error) {
      logger.error(
        { runId: execution.run.id, error: error instanceof Error ? error.message : String(error) },
        'Failed to save checkpoint'
      );
      return false;
    }
  }

  /**
   * Load a checkpoint for a given run_id and reconstruct the execution state.
   * Returns null if no checkpoint exists or deserialization fails.
   */
  async loadCheckpoint(runId: string): Promise<PipelineExecution | null> {
    if (!this.checkpointRepository) {
      return null;
    }

    try {
      const record = await this.checkpointRepository.findByRunId(runId);
      if (!record) {
        return null;
      }

      const checkpointData = record.checkpoint_data as CheckpointData;
      const execution = this.deserializeExecution(checkpointData, record.pipeline_id);

      logger.info(
        { runId, stageCount: checkpointData.stages.length, status: record.status },
        'Checkpoint loaded and execution restored'
      );

      return execution;
    } catch (error) {
      logger.error(
        { runId, error: error instanceof Error ? error.message : String(error) },
        'Failed to load checkpoint'
      );
      return null;
    }
  }

  /**
   * Cleanup checkpoint after pipeline completion (success, failed, or cancelled).
   */
  async cleanupCompleted(runId: string): Promise<boolean> {
    if (!this.checkpointRepository) {
      return false;
    }

    try {
      const deleted = await this.checkpointRepository.deleteByRunId(runId);
      if (deleted) {
        logger.debug({ runId }, 'Checkpoint cleaned up after pipeline completion');
      }
      return deleted;
    } catch (error) {
      logger.error(
        { runId, error: error instanceof Error ? error.message : String(error) },
        'Failed to cleanup checkpoint'
      );
      return false;
    }
  }

  /**
   * Find all runs that have RUNNING checkpoints.
   * Used during startup recovery to identify potentially orphaned runs.
   */
  async findRunningCheckpoints(): Promise<Array<{ runId: string; pipelineId: string; lastStageName?: string; lastTaskName?: string }>> {
    if (!this.checkpointRepository) {
      return [];
    }

    try {
      const records = await this.checkpointRepository.findAllByStatus('running');
      return records.map(r => ({
        runId: r.run_id,
        pipelineId: r.pipeline_id,
        lastStageName: r.last_stage_name || undefined,
        lastTaskName: r.last_task_name || undefined,
      }));
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to find running checkpoints'
      );
      return [];
    }
  }

  /**
   * Recover orphaned runs during startup.
   * For each RUNNING checkpoint, attempts to load and restore the execution.
   * If restoration is not possible (e.g., the run was actually completed elsewhere),
   * marks it as failed.
   *
   * @param runService - Used to update run status in DB
   * @param onRestored - Callback when execution is successfully restored (for re-enqueue)
   * @param markFailedIfStale - If true, mark stale running runs as failed (default: true)
   */
  async recoverOrphanedRuns(
    runService: {
      getRun: (id: string) => Promise<PipelineRun | null>;
      completeRun: (id: string, status: PipelineRunStatus.SUCCESS | PipelineRunStatus.FAILED) => Promise<PipelineRun | null>;
    },
    options?: {
      onRestored?: (execution: PipelineExecution) => void;
      markFailedIfStale?: boolean;
    }
  ): Promise<RecoveryResult> {
    const result: RecoveryResult = {
      recovered: 0,
      markedFailed: 0,
      restored: 0,
      errors: [],
    };

    if (!this.checkpointRepository) {
      logger.info('Checkpoint repository not configured, skipping orphaned run recovery');
      return result;
    }

    const markFailedIfStale = options?.markFailedIfStale ?? true;

    try {
      const runningCheckpoints = await this.findRunningCheckpoints();
      result.recovered = runningCheckpoints.length;

      if (runningCheckpoints.length === 0) {
        logger.info('No running checkpoints to recover');
        return result;
      }

      logger.info(
        { count: runningCheckpoints.length },
        'Found running checkpoints to evaluate for recovery'
      );

      for (const checkpoint of runningCheckpoints) {
        try {
          // Load the current run status from DB
          const run = await runService.getRun(checkpoint.runId);
          if (!run) {
            // Run record doesn't exist, clean up the orphaned checkpoint
            await this.cleanupCompleted(checkpoint.runId);
            continue;
          }

          // If the run is still marked as running in DB, try to restore from checkpoint
          if (run.status === PipelineRunStatus.RUNNING) {
            const execution = await this.loadCheckpoint(checkpoint.runId);
            if (execution && options?.onRestored) {
              options.onRestored(execution);
              result.restored++;
              logger.info(
                { runId: checkpoint.runId, lastStage: checkpoint.lastStageName },
                'Restored execution from checkpoint'
              );
            } else if (markFailedIfStale) {
              // Cannot restore, mark as failed
              await runService.completeRun(checkpoint.runId, PipelineRunStatus.FAILED);
              await this.cleanupCompleted(checkpoint.runId);
              result.markedFailed++;
              logger.info(
                { runId: checkpoint.runId },
                'Marked stale running pipeline as failed (cannot restore)'
              );
            }
          } else {
            // Run is no longer RUNNING in DB (completed/cancelled elsewhere), clean up checkpoint
            await this.cleanupCompleted(checkpoint.runId);
            logger.debug(
              { runId: checkpoint.runId, status: run.status },
              'Cleaned up checkpoint for non-running pipeline'
            );
          }
        } catch (err) {
          const errMsg = `Failed to recover checkpoint for run ${checkpoint.runId}: ${err instanceof Error ? err.message : String(err)}`;
          result.errors.push(errMsg);
          logger.error({ runId: checkpoint.runId, error: err }, 'Failed to recover checkpoint');
        }
      }
    } catch (err) {
      result.errors.push(`Recovery scan failed: ${err instanceof Error ? err.message : String(err)}`);
      logger.error({ error: err }, 'Checkpoint recovery scan failed');
    }

    return result;
  }

  // ==================== Serialization / Deserialization ====================

  /**
   * Serialize a PipelineExecution into checkpoint data (JSON-serializable)
   */
  private serializeExecution(execution: PipelineExecution): CheckpointData {
    const stages: CheckpointData['stages'] = [];
    for (const [, stage] of execution.stages) {
      stages.push({
        id: stage.id,
        runId: stage.runId,
        name: stage.name,
        sequence: stage.sequence,
        status: stage.status,
        dependsOn: stage.dependsOn,
        condition: stage.condition,
        timeoutSeconds: stage.timeoutSeconds,
        retryCount: stage.retryCount,
        maxRetries: stage.maxRetries,
        startedAt: stage.startedAt?.toISOString(),
        completedAt: stage.completedAt?.toISOString(),
        durationMs: stage.durationMs,
        result: stage.result,
        error: stage.error,
        createdAt: stage.createdAt.toISOString(),
      });
    }

    return {
      run: {
        id: execution.run.id,
        pipelineId: execution.run.pipelineId,
        pipelineVersion: execution.run.pipelineVersion,
        triggerType: execution.run.triggerType,
        triggerBy: execution.run.triggerBy,
        status: execution.run.status,
        startedAt: execution.run.startedAt?.toISOString(),
        completedAt: execution.run.completedAt?.toISOString(),
        durationMs: execution.run.durationMs,
        context: execution.run.context,
        createdAt: execution.run.createdAt.toISOString(),
        updatedAt: execution.run.updatedAt.toISOString(),
      },
      stages,
      pendingStages: Array.from(execution.pendingStages),
      runningStages: Array.from(execution.runningStages),
      completedStages: Array.from(execution.completedStages),
      checkpointVersion: 1,
      checkpointedAt: new Date().toISOString(),
      stageOrchestrator: (execution as any).stageOrchestratorState
        ? {
            variableContexts: (execution as any).stageOrchestratorState.variableContexts,
          }
        : undefined,
    };
  }

  /**
   * Deserialize checkpoint data back into a PipelineExecution
   */
  private deserializeExecution(data: CheckpointData, pipelineId: string): PipelineExecution {
    // Reconstruct the run
    const run: PipelineRun = {
      id: data.run.id,
      pipelineId: data.run.pipelineId,
      pipelineVersion: data.run.pipelineVersion,
      triggerType: data.run.triggerType as PipelineRun['triggerType'],
      triggerBy: data.run.triggerBy,
      status: data.run.status as PipelineRunStatus,
      startedAt: data.run.startedAt ? new Date(data.run.startedAt) : undefined,
      completedAt: data.run.completedAt ? new Date(data.run.completedAt) : undefined,
      durationMs: data.run.durationMs,
      context: data.run.context,
      createdAt: new Date(data.run.createdAt),
      updatedAt: new Date(data.run.updatedAt),
    };

    // Reconstruct stages
    const stages = new Map<string, Stage>();
    for (const s of data.stages) {
      const stage: Stage = {
        id: s.id,
        runId: s.runId,
        name: s.name,
        sequence: s.sequence,
        status: s.status as StageStatus,
        dependsOn: s.dependsOn,
        condition: s.condition,
        timeoutSeconds: s.timeoutSeconds,
        retryCount: s.retryCount,
        maxRetries: s.maxRetries,
        startedAt: s.startedAt ? new Date(s.startedAt) : undefined,
        completedAt: s.completedAt ? new Date(s.completedAt) : undefined,
        durationMs: s.durationMs,
        result: s.result,
        error: s.error,
        createdAt: new Date(s.createdAt),
      };
      stages.set(s.id, stage);
    }

    // Reconstruct Sets
    const pendingStages = new Set(data.pendingStages);
    const runningStages = new Set(data.runningStages);
    const completedStages = new Set(data.completedStages);

    const execution: PipelineExecution = {
      run,
      stages,
      pendingStages,
      runningStages,
      completedStages,
    };

    // Restore StageOrchestrator state if present
    if (data.stageOrchestrator) {
      (execution as any).stageOrchestratorState = {
        variableContexts: data.stageOrchestrator.variableContexts,
      };
    }

    return execution;
  }

  /**
   * Derive the checkpoint status from the current execution state
   */
  private deriveCheckpointStatus(execution: PipelineExecution): string {
    // If the run has a terminal status, reflect that
    if (
      execution.run.status === PipelineRunStatus.SUCCESS ||
      execution.run.status === PipelineRunStatus.FAILED ||
      execution.run.status === PipelineRunStatus.CANCELLED
    ) {
      return execution.run.status;
    }

    // If there are running stages, it's still in progress
    if (execution.runningStages.size > 0) {
      return 'running';
    }

    // If there are pending stages, it's still in progress
    if (execution.pendingStages.size > 0) {
      return 'running';
    }

    // Default to running if we can't determine
    return 'running';
  }
}
