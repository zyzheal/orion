import { createLogger } from '../../utils/logger';
import { OrionError, ErrorCode } from '../../errors';
import { EventEmitter } from 'events';
import { HeartbeatWatchdog } from './HeartbeatWatchdog';
import { ProcessKiller } from './ProcessKiller';
import { GuardianTaskRepository } from '../../repositories/GuardianTaskRepository';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger('ExecutionGuardian');

export interface GuardianConfig {
  globalTimeoutMs: number;
  stepTimeoutMs: number;
  heartbeatIntervalMs: number;
  heartbeatTimeoutMs: number;
}

export const DEFAULT_GUARDIAN_CONFIG: GuardianConfig = {
  globalTimeoutMs: 30 * 60 * 1000,
  stepTimeoutMs: 5 * 60 * 1000,
  heartbeatIntervalMs: 5000,
  heartbeatTimeoutMs: 15000,
};

// Timer state kept in-memory (NodeJS.Timeout cannot be persisted to DB)
interface TaskTimerState {
  globalTimer: NodeJS.Timeout | undefined;
  stepTimer: NodeJS.Timeout | undefined;
  aborted: boolean;
  abortListener?: () => void;
}

export class ExecutionGuardian extends EventEmitter {
  private config: GuardianConfig;
  private heartbeatWatchdog: HeartbeatWatchdog;
  private processKiller: ProcessKiller;
  private repository: GuardianTaskRepository;
  // In-memory timer state (timers cannot be persisted to DB)
  private timerStates: Map<string, TaskTimerState> = new Map();

  constructor(
    config: Partial<GuardianConfig> = {},
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {
    super();
    if (!db) {
      throw new OrionError('ExecutionGuardian requires a database connection', ErrorCode.INTERNAL_ERROR);
    }
    this.config = { ...DEFAULT_GUARDIAN_CONFIG, ...config };
    this.heartbeatWatchdog = new HeartbeatWatchdog(db);
    this.processKiller = new ProcessKiller(db);
    this.repository = new GuardianTaskRepository(db);
  }

  start(): void {
    this.heartbeatWatchdog.start();
    logger.info('ExecutionGuardian started');
  }

  async stop(): Promise<void> {
    this.heartbeatWatchdog.stop();
    for (const [taskId] of this.timerStates) {
      await this.abortTask(taskId, 'guardian_shutdown');
    }
    this.timerStates.clear();
    logger.info('ExecutionGuardian stopped');
  }

  registerTask(taskId: string, options: { globalTimeoutMs?: number; stepTimeoutMs?: number } = {}): void {
    const globalTimeout = options.globalTimeoutMs || this.config.globalTimeoutMs;
    const stepTimeout = options.stepTimeoutMs || this.config.stepTimeoutMs;

    const timerState: TaskTimerState = {
      globalTimer: undefined,
      stepTimer: undefined,
      aborted: false,
    };

    timerState.globalTimer = setTimeout(() => {
      this.onGlobalTimeout(taskId);
    }, globalTimeout);

    timerState.stepTimer = setTimeout(() => {
      this.onStepTimeout(taskId);
    }, stepTimeout);

    this.timerStates.set(taskId, timerState);

    // Persist to DB
    this.repository.create({
      id: uuidv4(),
      taskId,
      startTime: Date.now(),
      globalTimeoutMs: globalTimeout,
      stepTimeoutMs: stepTimeout,
      aborted: false,
      status: 'active',
    }).catch((err) => {
      logger.warn({ err, taskId }, 'Failed to persist guardian task');
    });

    logger.info({ taskId, globalTimeout, stepTimeout }, 'Task registered with guardian');
  }

  unregisterTask(taskId: string): void {
    const timerState = this.timerStates.get(taskId);
    if (timerState) {
      if (timerState.globalTimer) clearTimeout(timerState.globalTimer);
      if (timerState.stepTimer) clearTimeout(timerState.stepTimer);
      if (timerState.abortListener) {
        this.off('task:aborted', timerState.abortListener);
      }
    }
    this.heartbeatWatchdog.unregister(taskId);
    this.timerStates.delete(taskId);

    // Remove from DB
    this.repository.markCompleted(taskId).catch((err) => {
      logger.warn({ err, taskId }, 'Failed to mark guardian task as completed');
    });

    logger.debug({ taskId }, 'Task unregistered from guardian');
  }

  heartbeat(taskId: string): void {
    this.heartbeatWatchdog.beat(taskId);
    const timerState = this.timerStates.get(taskId);
    if (timerState && !timerState.aborted) {
      if (timerState.stepTimer) {
        clearTimeout(timerState.stepTimer);
      }
      timerState.stepTimer = setTimeout(() => {
        this.onStepTimeout(taskId);
      }, this.config.stepTimeoutMs);
    }
  }

  async abortTask(taskId: string, reason: string): Promise<void> {
    const timerState = this.timerStates.get(taskId);
    if (!timerState) return;

    timerState.aborted = true;
    if (timerState.globalTimer) clearTimeout(timerState.globalTimer);
    if (timerState.stepTimer) clearTimeout(timerState.stepTimer);
    if (timerState.abortListener) {
      this.off('task:aborted', timerState.abortListener);
    }

    await this.processKiller.kill(taskId, reason);
    this.emit('task:aborted', { taskId, reason });

    this.timerStates.delete(taskId);
    this.heartbeatWatchdog.unregister(taskId);

    // Mark as aborted in DB
    this.repository.markAborted(taskId).catch((err) => {
      logger.warn({ err, taskId }, 'Failed to mark guardian task as aborted');
    });

    logger.info({ taskId, reason }, 'Task aborted and cleaned up');
  }

  createAbortSignal(taskId: string): AbortController {
    const controller = new AbortController();
    const listener = (data: { taskId: string }) => {
      if (data.taskId === taskId && !controller.signal.aborted) {
        controller.abort(new Error(`Task aborted: ${data.taskId}`));
      }
    };
    this.once('task:aborted', listener);

    const timerState = this.timerStates.get(taskId);
    if (timerState) {
      timerState.abortListener = listener as () => void;
    }

    return controller;
  }

  private onGlobalTimeout(taskId: string): void {
    logger.error({ taskId }, 'Global timeout reached');
    this.emit('task:timeout', { taskId, type: 'global' });
    this.abortTask(taskId, 'global_timeout').catch(err => {
      logger.error({ taskId, err: err instanceof Error ? err.message : String(err) }, 'Error aborting task on global timeout');
    });
  }

  private onStepTimeout(taskId: string): void {
    logger.warn({ taskId }, 'Step timeout reached');
    this.emit('task:timeout', { taskId, type: 'step' });
    this.abortTask(taskId, 'step_timeout').catch(err => {
      logger.error({ taskId, err: err instanceof Error ? err.message : String(err) }, 'Error aborting task on step timeout');
    });
  }

  private onHeartbeatTimeout(taskId: string, reason: string): void {
    logger.error({ taskId, reason }, 'Heartbeat timeout - task appears stuck');
    this.emit('task:heartbeat_timeout', { taskId, reason });
    this.abortTask(taskId, 'heartbeat_timeout').catch(err => {
      logger.error({ taskId, err: err instanceof Error ? err.message : String(err) }, 'Error aborting task on heartbeat timeout');
    });
  }
}
