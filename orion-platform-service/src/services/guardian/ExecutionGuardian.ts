import pino from 'pino';
import { EventEmitter } from 'events';
import { HeartbeatWatchdog } from './HeartbeatWatchdog';
import { ProcessKiller } from './ProcessKiller';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

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

export class ExecutionGuardian extends EventEmitter {
  private config: GuardianConfig;
  private heartbeatWatchdog: HeartbeatWatchdog;
  private processKiller: ProcessKiller;
  private activeTasks: Map<string, {
    startTime: number;
    globalTimer: NodeJS.Timeout | undefined;
    stepTimer: NodeJS.Timeout | undefined;
    aborted: boolean;
  }> = new Map();

  constructor(config: Partial<GuardianConfig> = {}) {
    super();
    this.config = { ...DEFAULT_GUARDIAN_CONFIG, ...config };
    this.heartbeatWatchdog = new HeartbeatWatchdog();
    this.processKiller = new ProcessKiller();
  }

  start(): void {
    this.heartbeatWatchdog.start();
    logger.info('ExecutionGuardian started');
  }

  stop(): void {
    this.heartbeatWatchdog.stop();
    for (const [taskId] of this.activeTasks) {
      this.abortTask(taskId, 'guardian_shutdown');
    }
    this.activeTasks.clear();
    logger.info('ExecutionGuardian stopped');
  }

  registerTask(taskId: string, options: { globalTimeoutMs?: number; stepTimeoutMs?: number } = {}): void {
    const globalTimeout = options.globalTimeoutMs || this.config.globalTimeoutMs;
    const stepTimeout = options.stepTimeoutMs || this.config.stepTimeoutMs;

    const taskState: { startTime: number; globalTimer: NodeJS.Timeout | undefined; stepTimer: NodeJS.Timeout | undefined; aborted: boolean } = {
      startTime: Date.now(),
      globalTimer: undefined,
      stepTimer: undefined,
      aborted: false,
    };

    taskState.globalTimer = setTimeout(() => {
      this.onGlobalTimeout(taskId);
    }, globalTimeout);

    taskState.stepTimer = setTimeout(() => {
      this.onStepTimeout(taskId);
    }, stepTimeout);

    this.activeTasks.set(taskId, taskState);

    this.heartbeatWatchdog.register(taskId, {
      intervalMs: this.config.heartbeatIntervalMs,
      timeoutMs: this.config.heartbeatTimeoutMs,
      onTimeout: (tid: string, reason: string) => {
        this.onHeartbeatTimeout(tid, reason);
      },
    });

    logger.info({ taskId, globalTimeout, stepTimeout }, 'Task registered with guardian');
  }

  unregisterTask(taskId: string): void {
    const taskState = this.activeTasks.get(taskId);
    if (taskState) {
      if (taskState.globalTimer) clearTimeout(taskState.globalTimer);
      if (taskState.stepTimer) clearTimeout(taskState.stepTimer);
    }
    this.heartbeatWatchdog.unregister(taskId);
    this.activeTasks.delete(taskId);
    logger.debug({ taskId }, 'Task unregistered from guardian');
  }

  heartbeat(taskId: string): void {
    this.heartbeatWatchdog.beat(taskId);
  }

  async abortTask(taskId: string, reason: string): Promise<void> {
    const taskState = this.activeTasks.get(taskId);
    if (taskState) {
      taskState.aborted = true;
      if (taskState.globalTimer) clearTimeout(taskState.globalTimer);
      if (taskState.stepTimer) clearTimeout(taskState.stepTimer);
    }
    await this.processKiller.kill(taskId, reason);
    this.emit('task:aborted', { taskId, reason });
  }

  createAbortSignal(taskId: string): AbortController {
    const controller = new AbortController();
    this.on('task:aborted', ({ taskId: abortedId }) => {
      if (abortedId === taskId && !controller.signal.aborted) {
        controller.abort(new Error(`Task aborted: ${abortedId}`));
      }
    });
    return controller;
  }

  private onGlobalTimeout(taskId: string): void {
    logger.error({ taskId }, 'Global timeout reached');
    this.emit('task:timeout', { taskId, type: 'global' });
    this.abortTask(taskId, 'global_timeout');
  }

  private onStepTimeout(taskId: string): void {
    logger.warn({ taskId }, 'Step timeout reached');
    this.emit('task:timeout', { taskId, type: 'step' });
  }

  private onHeartbeatTimeout(taskId: string, reason: string): void {
    logger.error({ taskId, reason }, 'Heartbeat timeout - task appears stuck');
    this.emit('task:heartbeat_timeout', { taskId, reason });
    this.abortTask(taskId, 'heartbeat_timeout');
  }
}
