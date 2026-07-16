/**
 * PipelineExecutionControlService - Business logic for Pipeline Execution Control
 *
 * Manages pause/resume/abort/retry operations on pipeline runs.
 * Supports checkpoint-based recovery and graceful abort with timeout.
 *
 * State transitions:
 *   running -> paused -> running (resume)
 *   running -> aborted
 *   failed  -> running (retry from checkpoint or restart)
 *   aborted -> running (restart)
 */

import {
  PipelineExecutionControlRepository,
  PauseResumeLog,
  ExecutionCheckpoint,
  CreatePauseResumeLogInput,
  CreateCheckpointInput,
  UpdateCheckpointInput,
} from './PipelineExecutionControlRepository';

export interface PipelineRunStatus {
  id: string;
  status: string;
  checkpoint_data: Record<string, unknown> | null;
  pause_reason: string | null;
  abort_reason: string | null;
  retry_count: number;
  max_retries: number;
}

export interface PauseOptions {
  reason: string;
  operator: string;
}

export interface AbortOptions {
  reason: string;
  operator: string;
  timeoutSeconds?: number;
}

export interface RetryOptions {
  fromCheckpoint?: boolean;
  operator?: string;
}

export class PipelineExecutionControlService {
  constructor(private repository: PipelineExecutionControlRepository) {}

  // ==================== Pause ====================

  async pause(
    runId: string,
    options: PauseOptions,
    updateRunStatus: (runId: string, status: string, data?: Record<string, unknown>) => Promise<void>,
    getCurrentStep?: (runId: string) => Promise<{ stepId: string; stepType: string; data: Record<string, unknown> } | null>,
  ): Promise<PauseResumeLog> {
    // Save checkpoint of current step if available
    let checkpointData: Record<string, unknown> | undefined;
    if (getCurrentStep) {
      const currentStep = await getCurrentStep(runId);
      if (currentStep) {
        await this.repository.createCheckpoint({
          run_id: runId,
          step_id: currentStep.stepId,
          step_type: currentStep.stepType,
          status: 'running',
          checkpoint_data: currentStep.data,
        });
        checkpointData = { stepId: currentStep.stepId, stepType: currentStep.stepType };
      }
    }

    // Update run status to paused
    await updateRunStatus(runId, 'paused', { pause_reason: options.reason });

    // Log the pause action
    const log = await this.repository.createPauseResumeLog({
      run_id: runId,
      action: 'pause',
      reason: options.reason,
      operator: options.operator,
      checkpoint_data: checkpointData,
    });

    return log;
  }

  // ==================== Resume ====================

  async resume(
    runId: string,
    options: PauseOptions,
    updateRunStatus: (runId: string, status: string, data?: Record<string, unknown>) => Promise<void>,
  ): Promise<PauseResumeLog> {
    // Update run status to running
    await updateRunStatus(runId, 'running', { pause_reason: null });

    // Log the resume action
    const log = await this.repository.createPauseResumeLog({
      run_id: runId,
      action: 'resume',
      reason: options.reason,
      operator: options.operator,
    });

    return log;
  }

  // ==================== Abort ====================

  async abort(
    runId: string,
    options: AbortOptions,
    updateRunStatus: (runId: string, status: string, data?: Record<string, unknown>) => Promise<void>,
  ): Promise<PauseResumeLog> {
    // Update run status to aborted
    await updateRunStatus(runId, 'aborted', { abort_reason: options.reason });

    // Log the abort action
    const log = await this.repository.createPauseResumeLog({
      run_id: runId,
      action: 'abort',
      reason: options.reason,
      operator: options.operator,
    });

    return log;
  }

  // ==================== Retry ====================

  async retry(
    runId: string,
    options: RetryOptions,
    getRunStatus: (runId: string) => Promise<PipelineRunStatus>,
    updateRunStatus: (runId: string, status: string, data?: Record<string, unknown>) => Promise<void>,
  ): Promise<{ log: PauseResumeLog; fromCheckpoint: boolean }> {
    const run = await getRunStatus(runId);

    // Check retry limits
    if (run.retry_count >= run.max_retries) {
      throw new OrionError(`Maximum retries (${run.max_retries}) exceeded`, 'VALIDATION_ERROR');
    }

    let fromCheckpoint = false;

    if (options.fromCheckpoint !== false) {
      // Try to find a checkpoint to resume from
      const failedCheckpoint = await this.repository.findFailedCheckpoint(runId);
      if (failedCheckpoint) {
        fromCheckpoint = true;
        // Update the failed checkpoint to running
        await this.repository.updateCheckpoint(failedCheckpoint.id, {
          status: 'running',
        });
      }
    }

    // Update run status
    await updateRunStatus(runId, 'running', {
      retry_count: run.retry_count + 1,
      checkpoint_data: fromCheckpoint ? run.checkpoint_data : null,
    });

    // Log the retry action
    const log = await this.repository.createPauseResumeLog({
      run_id: runId,
      action: 'retry',
      reason: fromCheckpoint ? 'Retry from checkpoint' : 'Retry from beginning',
      operator: options.operator,
      checkpoint_data: fromCheckpoint ? { fromCheckpoint: true } : { fromCheckpoint: false },
    });

    return { log, fromCheckpoint };
  }

  // ==================== Restart ====================

  async restart(
    runId: string,
    options: PauseOptions,
    updateRunStatus: (runId: string, status: string, data?: Record<string, unknown>) => Promise<void>,
  ): Promise<PauseResumeLog> {
    // Clear checkpoints
    await this.repository.deleteCheckpointsByRun(runId);

    // Reset run status
    await updateRunStatus(runId, 'running', {
      retry_count: 0,
      checkpoint_data: null,
      pause_reason: null,
      abort_reason: null,
    });

    // Log the restart action
    const log = await this.repository.createPauseResumeLog({
      run_id: runId,
      action: 'restart',
      reason: options.reason,
      operator: options.operator,
    });

    return log;
  }

  // ==================== Checkpoint Management ====================

  async saveCheckpoint(input: CreateCheckpointInput): Promise<ExecutionCheckpoint> {
    // Check if checkpoint already exists for this step
    const existing = await this.repository.findCheckpointByRunAndStep(input.run_id, input.step_id);
    if (existing) {
      const updated = await this.repository.updateCheckpoint(existing.id, {
        status: input.status,
        checkpoint_data: input.checkpoint_data,
        output_data: input.output_data,
      });
      if (!updated) {
        throw new OrionError('Failed to update checkpoint', 'OPERATION_FAILED');
      }
      return updated;
    }
    return this.repository.createCheckpoint(input);
  }

  async getCheckpoints(runId: string): Promise<ExecutionCheckpoint[]> {
    return this.repository.listCheckpointsByRun(runId);
  }

  async getLatestCheckpoint(runId: string): Promise<ExecutionCheckpoint | null> {
    return this.repository.findLatestCheckpoint(runId);
  }

  // ==================== Query ====================

  async getPauseResumeLogs(runId: string): Promise<PauseResumeLog[]> {
    return this.repository.listPauseResumeLogsByRun(runId);
  }
}

// Inline OrionError to avoid circular dependency
class OrionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'OrionError';
  }
}
