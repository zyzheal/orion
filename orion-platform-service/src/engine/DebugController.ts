// orion-platform-service/src/engine/DebugController.ts
// Debug Controller - pause/resume/step for running pipeline executions
//
// Architecture: In-process state snapshot + Promise wait.
// Since the entire platform runs in one process, debug state can be held in memory.

import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Debug state for a running pipeline.
 */
export interface DebugState {
  runId: string;
  status: 'running' | 'paused' | 'stepping';
  currentStage?: string;
  currentTask?: string;
  completedTasks: Array<{ taskId: string; status: string; result?: any }>;
  variables: Record<string, any>;
  pausedAt?: Date;
  snapshot: Record<string, any>;
}

/**
 * Debug Controller - manages interactive debugging of pipeline executions.
 *
 * Supports:
 * - pause(runId): Signal the pipeline to pause at the next task boundary
 * - resume(runId): Signal the pipeline to continue from paused state
 * - step(runId): Execute exactly one task then pause again
 * - getState(runId): Return current pipeline state snapshot
 */
export class DebugController {
  private static instance: DebugController | null = null;

  // Map of runId -> debug state
  private debugStates = new Map<string, DebugState>();

  // Map of runId -> resolver for the pause-waiting Promise
  private resumeResolvers = new Map<string, (value: void) => void>();

  // Map of runId -> resolver for step-waiting Promise
  private stepResolvers = new Map<string, (value: void) => void>();

  static getInstance(): DebugController {
    if (!DebugController.instance) {
      DebugController.instance = new DebugController();
    }
    return DebugController.instance;
  }

  static resetForTesting(): void {
    DebugController.instance = null;
  }

  /**
   * Pause a running pipeline at the next task boundary.
   */
  async pause(runId: string): Promise<DebugState> {
    const state = this.debugStates.get(runId);

    if (!state) {
      // Create initial debug state for this run
      const newState: DebugState = {
        runId,
        status: 'paused',
        completedTasks: [],
        variables: {},
        pausedAt: new Date(),
        snapshot: {},
      };
      this.debugStates.set(runId, newState);
      logger.info({ runId }, 'Debug pause state created (no active execution to signal)');
      return newState;
    }

    if (state.status === 'paused') {
      return state; // Already paused
    }

    // Signal the execution to pause
    state.status = 'paused';
    state.pausedAt = new Date();
    logger.info({ runId }, 'Pipeline marked for debug pause');

    return state;
  }

  /**
   * Resume a paused pipeline execution.
   */
  async resume(runId: string): Promise<void> {
    const state = this.debugStates.get(runId);
    if (!state) {
      throw new Error(`No debug state found for run ${runId}`);
    }

    if (state.status !== 'paused') {
      throw new Error(`Pipeline run ${runId} is not paused (status: ${state.status})`);
    }

    state.status = 'running';
    state.pausedAt = undefined;

    // Resolve the waiting pause Promise
    const resolver = this.resumeResolvers.get(runId);
    if (resolver) {
      resolver();
      this.resumeResolvers.delete(runId);
      logger.info({ runId }, 'Pipeline resumed via debug controller');
    }
  }

  /**
   * Execute exactly one task then pause again.
   * If the run is currently paused (and blocked in waitForSignal), this
   * unblocks the executor so it can proceed to the next task. The executor
   * will then see the 'stepping' status, pass through waitForSignal, and
   * the status will be reset to 'paused' after that one task completes.
   */
  async step(runId: string): Promise<DebugState> {
    const state = this.debugStates.get(runId);
    if (!state) {
      throw new Error(`No debug state found for run ${runId}`);
    }

    if (state.status !== 'paused') {
      throw new Error(`Pipeline run ${runId} is not paused (status: ${state.status})`);
    }

    // Unblock any executor waiting in waitForSignal
    const resumeResolver = this.resumeResolvers.get(runId);
    if (resumeResolver) {
      resumeResolver();
      this.resumeResolvers.delete(runId);
    }

    // Set to stepping mode - allows exactly one task to execute
    state.status = 'stepping';
    logger.info({ runId }, 'Pipeline set to debug step mode');

    return state;
  }

  /**
   * Get the current debug state snapshot for a run.
   */
  getState(runId: string): DebugState | undefined {
    return this.debugStates.get(runId);
  }

  /**
   * Check if a run should pause at the next task boundary.
   * Called by PipelineEngine/StageExecutor before each task.
   *
   * @returns true if the execution should wait/pause
   */
  shouldPause(runId: string): boolean {
    const state = this.debugStates.get(runId);
    if (!state) return false;

    return state.status === 'paused' || state.status === 'stepping';
  }

  /**
   * Wait for resume or step signal.
   * Returns true if we should proceed with execution (stepping),
   * or blocks until resumed.
   */
  async waitForSignal(runId: string): Promise<boolean> {
    const state = this.debugStates.get(runId);
    if (!state) return true; // No debug session, proceed normally

    if (state.status === 'stepping') {
      // Step mode: allow one task to execute, then pause again
      state.status = 'paused';
      return true;
    }

    if (state.status === 'paused') {
      // Wait for resume signal
      logger.info({ runId }, 'Execution waiting for debug resume signal');
      return new Promise<boolean>((resolve) => {
        this.resumeResolvers.set(runId, () => {
          resolve(true);
        });
      });
    }

    return true;
  }

  /**
   * After a step completes in step mode, re-pause the execution.
   */
  completeStep(runId: string, taskResult?: any): void {
    const state = this.debugStates.get(runId);
    if (!state) return;

    if (state.status === 'stepping') {
      // This shouldn't happen as we switch to paused in waitForSignal
      state.status = 'paused';
    }

    // Record the completed task
    if (taskResult) {
      state.completedTasks.push(taskResult);
    }
  }

  /**
   * Update the debug state with current execution info.
   */
  updateState(runId: string, updates: Partial<Omit<DebugState, 'runId'>>): void {
    const state = this.debugStates.get(runId);
    if (state) {
      Object.assign(state, updates);
    }
  }

  /**
   * Register a new debug session with initial state.
   */
  registerRun(runId: string, initialState?: Partial<DebugState>): void {
    this.debugStates.set(runId, {
      runId,
      status: 'running',
      completedTasks: [],
      variables: {},
      snapshot: {},
      ...initialState,
    });
  }

  /**
   * Unregister a debug session (pipeline completed or aborted).
   */
  unregisterRun(runId: string): void {
    // Clean up any waiting resolvers
    this.resumeResolvers.delete(runId);
    this.stepResolvers.delete(runId);
    this.debugStates.delete(runId);
    logger.debug({ runId }, 'Debug session unregistered');
  }

  /**
   * List all active debug sessions.
   */
  listSessions(): Array<{ runId: string; status: string; pausedAt?: Date }> {
    const sessions: Array<{ runId: string; status: string; pausedAt?: Date }> = [];
    for (const [runId, state] of this.debugStates) {
      sessions.push({
        runId,
        status: state.status,
        pausedAt: state.pausedAt,
      });
    }
    return sessions;
  }
}
